import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CLOTH_COLORS,
  avatarLook,
  checkLook,
  itemPrice,
  AvatarSchema,
  isLang,
  LangSchema,
  BADGES,
  CEFR_LEVELS,
  LoginRequestSchema,
  PlacementSubmitSchema,
  RegisterRequestSchema,
  ReviewGradeSchema,
  dailyQuestIds,
  levelForXp,
  placementLevel,
  xpForLevel,
  type Profile,
  type VocabEntryDto,
} from '@es/shared';
import { getQuest, loadPairQuests, loadPlacement, loadQuests } from '@es/quests';
import { hashPassword, playerIdFrom, signToken, verifyPassword } from '../auth';
import { DAILY_BONUS_XP, type AttemptRepo, type UserRecord } from '../npc/attempts';
import { budget } from '../npc/budget';
import { allowAuth, limiter } from '../npc/ratelimit';
import { areaStats } from './play';
import { captcha } from '../captcha';

export function accountRoutes(repo: AttemptRepo) {
  async function profile(u: UserRecord): Promise<Profile> {
    const completed = await repo.listCompleted(u.id);
    const today = new Date();
    const start = new Date(today);
    start.setUTCHours(0, 0, 0, 0);
    const daily = dailyQuestIds(loadQuests().map((q) => q.id), today).map((id) => {
      const q = getQuest(id)!;
      return { questId: id, title: q.title, npcId: q.npc, level: q.level, bonusXp: DAILY_BONUS_XP, done: completed.some((a) => a.questId === id && a.finishedAt && a.finishedAt >= start) };
    });
    const byNpc = new Map<string, number>();
    for (const a of completed) byNpc.set(a.npcId, (byNpc.get(a.npcId) ?? 0) + 1);
    const pairIds = new Set(loadPairQuests().map((q) => q.id));
    const pairDone = completed.some((a) => pairIds.has(a.questId));
    const badges = BADGES.filter((b) => {
      switch (b.id) {
        case 'first-steps': return completed.length >= 1;
        case 'regular': return completed.length >= 5;
        case 'cafe-regular': return (byNpc.get('barista') ?? 0) >= 3;
        case 'well-travelled': return byNpc.size >= 4;
        case 'streak-3': return u.streak >= 3;
        case 'team-player': return pairDone;
        case 'bookworm': return u.reviewsDone >= 20;
      }
      return false;
    }).map((b) => b.id as string);
    const area = areaStats(u.gameState);
    badges.push(...area.badges);
    const level = levelForXp(u.xp);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      cefrLevel: (CEFR_LEVELS as readonly string[]).includes(u.cefrLevel) ? (u.cefrLevel as Profile['cefrLevel']) : 'A1',
      placementDone: !!u.placementDoneAt,
      nativeLang: isLang(u.nativeLang) ? u.nativeLang : '',
      xp: u.xp,
      level,
      nextLevelXp: xpForLevel(level + 1),
      coins: u.coins,
      streak: u.streak,
      avatar: AvatarSchema.parse(u.avatarConfig ?? {}),
      stats: { questsCompleted: completed.length, reviewsDone: u.reviewsDone },
      badges,
      areas: area.areas,
      daily,
    };
  }

  const toDto = (v: { id: string; word: string; meaning: string; lang: string; example: string; ease: number; intervalDays: number; nextReviewAt: Date }): VocabEntryDto => ({
    id: v.id,
    word: v.word,
    meaning: v.meaning,
    lang: v.lang,
    example: v.example,
    ease: v.ease,
    intervalDays: v.intervalDays,
    nextReviewAt: v.nextReviewAt.toISOString(),
    due: v.nextReviewAt.getTime() <= Date.now(),
  });

  return async function routes(app: FastifyInstance) {
    // ---- auth ----
    // Image captcha for sign-in / sign-up (one check per challenge, 5 minutes).
    app.get('/auth/captcha', async (req, reply) => {
      if (!(await limiter.allow(`captcha:${req.ip}`, 30))) return reply.code(429).send({ error: 'rate_limited' });
      reply.header('cache-control', 'no-store');
      return captcha.create();
    });

    app.post('/auth/register', async (req, reply) => {
      if (!(await allowAuth(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = RegisterRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      if (!(await captcha.verify(body.data.captchaId, body.data.captchaAnswer))) return reply.code(400).send({ error: 'captcha_failed' });
      if (await repo.getUserByEmail(body.data.email)) return reply.code(409).send({ error: 'email_taken' });
      const u = await repo.createUser({ id: randomUUID(), email: body.data.email, name: body.data.name, passwordHash: await hashPassword(body.data.password) });
      if (body.data.guestId) await repo.transferGuest(body.data.guestId, u.id);
      const fresh = (await repo.getUser(u.id)) ?? u;
      await repo.logEvent({ name: 'register', playerId: u.id, props: { fromGuest: !!body.data.guestId } });
      return reply.code(201).send({ token: signToken(u.id), profile: await profile(fresh) });
    });

    app.post('/auth/login', async (req, reply) => {
      if (!(await allowAuth(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = LoginRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      if (!(await captcha.verify(body.data.captchaId, body.data.captchaAnswer))) return reply.code(400).send({ error: 'captcha_failed' });
      const u = await repo.getUserByEmail(body.data.email);
      if (!u?.passwordHash || !(await verifyPassword(body.data.password, u.passwordHash))) return reply.code(401).send({ error: 'invalid_credentials' });
      await repo.ensureUser(u.id, u.name); // streak
      await repo.logEvent({ name: 'login', playerId: u.id });
      return { token: signToken(u.id), profile: await profile((await repo.getUser(u.id)) ?? u) };
    });

    // ---- profile (token, or ?playerId= for guests) ----
    const who = (req: { authPlayerId: string | null; query: unknown }) => playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId);

    app.get('/me', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      return { ...(await profile(u)), quota: { turnsLeftToday: await budget.remainingFor(id) } };
    });

    app.get('/placement', async () => loadPlacement().map(({ answer: _a, ...q }) => q));

    app.post('/me/placement', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = PlacementSubmitSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const qs = loadPlacement();
      const correct = qs.reduce((n, q, i) => n + (body.data.answers[i] === q.answer ? 1 : 0), 0);
      const level = placementLevel(correct);
      await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      await repo.updateUser(id, { cefrLevel: level, placementDoneAt: new Date() });
      await repo.logEvent({ name: 'placement', playerId: id, props: { level, correct } });
      return { correct, total: qs.length, level };
    });

    app.get('/me/vocab', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      return (await repo.listVocab(id)).map(toDto);
    });

    app.post('/me/vocab/review', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ id: z.string(), grade: ReviewGradeSchema }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const v = await repo.reviewVocab(id, body.data.id, body.data.grade);
      if (!v) return reply.code(404).send({ error: 'not_found' });
      return toDto(v);
    });

    // Learner's own language (translations everywhere). '' is not accepted: pick one, 'en' = no translation.
    app.post('/me/lang', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ lang: LangSchema }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      await repo.updateUser(id, { nativeLang: body.data.lang });
      await repo.logEvent({ name: 'lang_set', playerId: id, props: { lang: body.data.lang } });
      return { lang: body.data.lang };
    });

    // Save the whole character look. Every colour must come from the palettes and paid items must be owned.
    app.post('/me/avatar', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!req.body || typeof req.body !== 'object') return reply.code(400).send({ error: 'bad_request' });
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const current = AvatarSchema.parse(u.avatarConfig ?? {});
      // Old clients send { color: 'gold' } (a palette id): treat it as the top colour.
      const raw = req.body as Record<string, unknown>;
      const legacy = typeof raw.color === 'string' && !raw.color.startsWith('#') ? CLOTH_COLORS.find((c) => c.id === raw.color)?.hex : undefined;
      const next = AvatarSchema.parse({ ...avatarLook(current), ...raw, ...(legacy ? { top: legacy } : {}), owned: current.owned });
      const bad = checkLook(avatarLook(next), next.owned);
      if (bad) return reply.code(bad.error === 'not_owned' ? 402 : 400).send(bad);
      await repo.updateUser(id, { avatarConfig: next });
      return next;
    });

    app.post('/me/shop/buy', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ item: z.string().max(40) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const avatar = AvatarSchema.parse(u.avatarConfig ?? {});
      const price = itemPrice(body.data.item);
      if (price === null) return reply.code(400).send({ error: 'unknown_item' });
      if (price === 0 || avatar.owned.includes(body.data.item)) return reply.code(409).send({ error: 'already_owned' });
      if (u.coins < price) return reply.code(402).send({ error: 'not_enough_coins' });
      avatar.owned.push(body.data.item);
      await repo.updateUser(id, { avatarConfig: avatar, coins: u.coins - price });
      return { avatar, coins: u.coins - price };
    });

  };
}
