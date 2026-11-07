import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { setting } from '../settings';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CLOTH_COLORS,
  DeviceInfoSchema, GfxInfoSchema, PlayerSettingsSchema,
  maskProfanity,
  INVITE_PAY_STEP,
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
import { friendRepo } from '../friends';
import { areaStats } from './play';
import { captcha, humanCheck } from '../captcha';
import { env } from '../env';
import { prisma } from '../plugins/prisma';
import { isBanned, userStatus } from '../moderation';
import { HUMAN_PASS_TTL_S, signToken as signShared } from '@es/shared/token';
import { forgetStatus } from '../moderation';
import { sendMail, mailEnabled } from '../mailer';
import { countryOf } from '../geo';
import { gameRename } from '../admin/game';

const OTP_TTL_MS = 10 * 60_000;
const OTP_TRIES = 5;
const escapeHtml = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Display names: letters of any language, digits, dash, space (same rule as the game server). */
export const cleanName = (n: string) => maskProfanity(n.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\- ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20));

export function accountRoutes(repo: AttemptRepo) {
  async function profile(u: UserRecord): Promise<Profile> {
    const completed = await repo.listCompleted(u.id);
    const today = new Date();
    const start = new Date(today);
    start.setUTCHours(0, 0, 0, 0);
    // Today's quests come from every area, around the player's level (one step either side) when there are enough.
    const rank = (l: string) => CEFR_LEVELS.indexOf(l as (typeof CEFR_LEVELS)[number]);
    const all = loadQuests().filter((q) => !q.disabled);
    const near = all.filter((q) => Math.abs(rank(q.level) - rank(u.cefrLevel)) <= 1);
    const daily = dailyQuestIds((near.length >= 6 ? near : all).map((q) => q.id), today).map((id) => {
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

    // Guests: a captcha (Turnstile or the image code) buys a 30-day human pass for the street and the API.
    app.post('/auth/guest', async (req, reply) => {
      if (!(await allowAuth(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ turnstileToken: z.string().max(4096).optional(), captchaId: z.string().max(64).optional(), captchaAnswer: z.string().max(16).optional() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      // guest passes per IP: a few per hour and per day (a school or café shares one IP, so not too strict)
      if (!(await limiter.allow(`guestpass:h:${req.ip}`, setting('guestPassesPerIpHour'), 3600)) || !(await limiter.allow(`guestpass:d:${req.ip}`, setting('guestPassesPerIpDay'), 86400)))
        return reply.code(429).send({ error: 'too_many_guests' });
      if (!(await humanCheck(body.data, req.ip, env.TURNSTILE_SECRET))) return reply.code(400).send({ error: 'captcha_failed' });
      await repo.logEvent({ name: 'guest_pass', props: {} });
      return { pass: signShared(env.AUTH_SECRET, 'human', HUMAN_PASS_TTL_S) };
    });

    app.post('/auth/register', async (req, reply) => {
      if (!(await allowAuth(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = RegisterRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      if (!(await humanCheck(body.data, req.ip, env.TURNSTILE_SECRET))) return reply.code(400).send({ error: 'captcha_failed' });
      if (await repo.getUserByEmail(body.data.email)) return reply.code(409).send({ error: 'email_taken' });
      const u = await repo.createUser({ id: randomUUID(), email: body.data.email, name: body.data.name, passwordHash: await hashPassword(body.data.password) });
      if (body.data.guestId) {
        await repo.transferGuest(body.data.guestId, u.id);
        await friendRepo().transfer(body.data.guestId, u.id).catch(() => undefined);
      }
      const fresh = (await repo.getUser(u.id)) ?? u;
      await repo.logEvent({ name: 'register', playerId: u.id, props: { fromGuest: !!body.data.guestId } });
      return reply.code(201).send({ token: signToken(u.id), profile: await profile(fresh) });
    });

    app.post('/auth/login', async (req, reply) => {
      if (!(await allowAuth(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = LoginRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      if (!(await humanCheck(body.data, req.ip, env.TURNSTILE_SECRET))) return reply.code(400).send({ error: 'captcha_failed' });
      const u = await repo.getUserByEmail(body.data.email);
      if (!u?.passwordHash || !(await verifyPassword(body.data.password, u.passwordHash))) return reply.code(401).send({ error: 'invalid_credentials' });
      const st = await userStatus(u.id, true);
      if (isBanned(st)) return reply.code(403).send({ error: 'account_banned', until: st!.bannedUntil, reason: st!.banReason });
      await repo.ensureUser(u.id, u.name); // streak
      await repo.logEvent({ name: 'login', playerId: u.id });
      return { token: signToken(u.id, st?.tokenVersion ?? 0), profile: await profile((await repo.getUser(u.id)) ?? u) };
    });

    // ---- forgot password: a 6-digit code (OTP) e-mailed to the account; the player types it with a new password ----
    // The code is kept hashed in User.gameState.pwOtp for OTP_TTL_MS, OTP_TRIES wrong tries; one per minute at most.
    const otpHash = (id: string, code: string) => createHmac('sha256', env.AUTH_SECRET).update(`otp:${id}:${code}`).digest('hex');
    app.post('/auth/forgot', async (req, reply) => {
      if (!(await allowAuth(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ email: z.string().email().max(120), captchaId: z.string().max(64).optional(), captchaAnswer: z.string().max(16).optional(), turnstileToken: z.string().max(4096).optional() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      if (!(await humanCheck(body.data, req.ip, env.TURNSTILE_SECRET))) return reply.code(400).send({ error: 'captcha_failed' });
      if (!mailEnabled()) return reply.code(503).send({ error: 'mail_off' });
      if (!(await limiter.allow(`forgot:${body.data.email.toLowerCase()}`, 5, 3600))) return reply.code(429).send({ error: 'rate_limited' });
      const u = await repo.getUserByEmail(body.data.email);
      if (u?.passwordHash) {
        const gs = (u.gameState ?? {}) as Record<string, unknown> & { pwOtp?: { at: number } };
        if (!gs.pwOtp || Date.now() - gs.pwOtp.at > 60_000) {
          const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
          await repo.updateUser(u.id, { gameState: { ...gs, pwOtp: { h: otpHash(u.id, code), at: Date.now(), exp: Date.now() + OTP_TTL_MS, tries: 0 } } });
          const mailed = await sendMail(
            u.email!,
            `English Street: ${code} là mã đặt lại mật khẩu / is your reset code`,
            `Xin chào ${u.name},\n\nMã đặt lại mật khẩu English Street của bạn là: ${code}\nMã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.\n\nHi ${u.name},\nYour English Street password reset code is: ${code}\nIt is valid for 10 minutes. If you did not ask for it, ignore this e-mail.`,
            `<div style="font-family:sans-serif;font-size:15px"><p>Xin chào <b>${escapeHtml(u.name)}</b>,</p><p>Mã đặt lại mật khẩu English Street của bạn:</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px">${code}</p><p>Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p><hr><p style="color:#666">Your English Street password reset code is <b>${code}</b> (valid for 10 minutes).</p></div>`,
          );
          await repo.logEvent({ name: 'password_reset_request', playerId: u.id, props: { email: u.email, mailed } });
          if (!mailed) return reply.code(502).send({ error: 'mail_failed' });
        }
      }
      // the same answer whether or not the address has an account
      return { ok: true };
    });

    app.post('/auth/reset', async (req, reply) => {
      if (!(await allowAuth(req.ip))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ email: z.string().email().max(120), code: z.string().regex(/^\d{6}$/), password: z.string().min(6).max(100) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const u = await repo.getUserByEmail(body.data.email);
      const gs = (u?.gameState ?? {}) as Record<string, unknown> & { pwOtp?: { h: string; exp: number; tries: number; at: number } };
      const otp = gs.pwOtp;
      if (!u || !otp || otp.exp < Date.now() || otp.tries >= OTP_TRIES) return reply.code(400).send({ error: 'code_expired' });
      const want = Buffer.from(otp.h);
      const got = Buffer.from(otpHash(u.id, body.data.code));
      if (want.length !== got.length || !timingSafeEqual(want, got)) {
        await repo.updateUser(u.id, { gameState: { ...gs, pwOtp: { ...otp, tries: otp.tries + 1 } } });
        return reply.code(400).send({ error: otp.tries + 1 >= OTP_TRIES ? 'code_expired' : 'wrong_code' });
      }
      const rest = { ...gs };
      delete rest.pwOtp;
      await repo.updateUser(u.id, { gameState: rest });
      const nu = await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(body.data.password), tokenVersion: { increment: 1 } } });
      forgetStatus(u.id);
      await repo.logEvent({ name: 'password_reset', playerId: u.id, props: { via: 'otp' } });
      return { token: signToken(u.id, nu.tokenVersion), profile: await profile((await repo.getUser(u.id))!) };
    });

    // Signed-in players: change the password (the old one is needed; other devices are signed out).
    app.post('/me/password', async (req, reply) => {
      const id = req.authPlayerId;
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`pw:${id}`, 10, 3600))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ current: z.string().min(1).max(100), password: z.string().min(6).max(100) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const u = await prisma.user.findUnique({ where: { id } });
      if (!u?.passwordHash) return reply.code(400).send({ error: 'no_account' });
      if (!(await verifyPassword(body.data.current, u.passwordHash))) return reply.code(401).send({ error: 'wrong_password' });
      const nu = await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(body.data.password), tokenVersion: { increment: 1 } } });
      forgetStatus(id);
      await repo.logEvent({ name: 'password_change', playerId: id });
      return { token: signToken(id, nu.tokenVersion) };
    });

    // Change the display name (accounts and guests); the name tag in the street changes at once.
    app.post('/me/name', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ name: z.string().max(40) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const name = cleanName(body.data.name);
      if (name.length < 2) return reply.code(400).send({ error: 'bad_name' });
      const prev = await repo.getUser(id);
      if (prev?.name === name) return { name };
      if (!(await limiter.allow(`rename:${id}`, 5, 86400))) return reply.code(429).send({ error: 'rate_limited' });
      await repo.ensureUser(id, name);
      await repo.updateUser(id, { name });
      await gameRename(id, name).catch(() => undefined);
      await repo.logEvent({ name: 'rename', playerId: id, props: { from: prev?.name ?? '', to: name } });
      return { name };
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

    // Joining the street: the name the guest chose (accounts keep theirs) and the device they play on.
    app.post('/me/hello', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`hello:${id}`, 10, 60))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ name: z.string().max(40).optional(), device: z.unknown().optional(), invitedBy: z.string().min(8).max(64).optional() }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const clean = maskProfanity((body.data.name ?? '').normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\- ]/gu, '').trim().slice(0, 20));
      const prev = await repo.getUser(id);
      // guests are known by the name they type; accounts keep their own name
      await repo.ensureUser(id, !prev?.email && clean.length >= 2 ? clean : (prev?.name ?? 'Guest'));
      // the IP they play from (admin site: players list); behind nginx req.ip is the client (TRUST_PROXY)
      if (repo.name === 'postgres') await prisma.user.update({ where: { id }, data: { lastIp: (req.ip ?? '').slice(0, 64) } }).catch(() => undefined);
      const d = DeviceInfoSchema.safeParse(body.data.device ?? {});
      if (d.success && repo.name === 'postgres') {
        // the server knows these better than the page: the browser's user agent and the country of the IP
        const dev = { ...d.data, ua: String(req.headers['user-agent'] ?? '').slice(0, 400) || undefined, country: countryOf(req.ip) || undefined };
        await prisma.user.update({ where: { id }, data: { device: dev as object } }).catch(() => undefined);
        const { kind, os, osVersion, model, form, browser, network, radio, deviceId } = d.data;
        await repo.logEvent({ name: 'device', playerId: id, props: Object.fromEntries(Object.entries({ kind, os, osVersion, model, form, browser, network, radio, deviceId, country: dev.country }).filter(([, v]) => v !== undefined)) });
      }
      // came with a friend's invite link: remember it once, for a new player only (paid when they finish INVITE_PAY_STEP)
      const inviter = body.data.invitedBy;
      if (inviter && inviter !== id) {
        const me = await repo.getUser(id);
        const mgs = (me?.gameState ?? {}) as Record<string, unknown>;
        // "new" = has not finished the invite chapter yet
        const jd = ((mgs.journey as { done?: string[] } | undefined)?.done ?? []) as string[];
        const isNew = !!me && !jd.includes(INVITE_PAY_STEP) && me.xp < 200;
        if (isNew && !mgs.invitedBy && (await repo.getUser(inviter))) await repo.updateUser(id, { gameState: { ...mgs, invitedBy: inviter } });
      }
      // settings an admin changed while the player was away: applied by the game now, then forgotten
      const u = await repo.getUser(id);
      const gs = (u?.gameState ?? {}) as Record<string, unknown> & { adminSettings?: unknown };
      if (gs.adminSettings) {
        const pending = PlayerSettingsSchema.safeParse(gs.adminSettings);
        const rest = { ...gs };
        delete rest.adminSettings;
        await repo.updateUser(id, { gameState: rest });
        if (pending.success) return { ok: true, settings: pending.data };
      }
      return { ok: true };
    });

    // Graphics settings and measured FPS (sent after joining and whenever the player switches quality).
    app.post('/me/gfx', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`gfx:${id}`, 20, 60))) return reply.code(429).send({ error: 'rate_limited' });
      const g = GfxInfoSchema.safeParse(req.body);
      const st = PlayerSettingsSchema.safeParse((req.body as { settings?: unknown } | null)?.settings ?? {});
      if (!g.success || repo.name !== 'postgres') return { ok: true };
      const row = await prisma.user.findUnique({ where: { id }, select: { device: true } }).catch(() => null);
      const prev = (row?.device ?? {}) as { gfx?: object };
      const device = { ...prev, gfx: { ...(prev.gfx ?? {}), ...Object.fromEntries(Object.entries(g.data).filter(([, v]) => v !== undefined)), at: Date.now() }, ...(st.success && Object.keys(st.data).length ? { settings: st.data } : {}) };
      await prisma.user.update({ where: { id }, data: { device } }).catch(() => undefined);
      return { ok: true };
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
      await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'avatar', item: body.data.item, coins: price } });
      return { avatar, coins: u.coins - price };
    });

  };
}
