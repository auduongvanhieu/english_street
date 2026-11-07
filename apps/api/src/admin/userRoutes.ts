import { getPairQuest, getQuest } from '@es/quests';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AREA_STEPS, CEFR_LEVELS, CROPS, FarmStateSchema, MAIN_STEPS, PlayerSettingsSchema, STAMP_AREAS, emptyFarm, maskProfanity, type JourneyState } from '@es/shared';
import { chapterOf, stampsOf, today } from '../journey/engine';
import { prisma } from '../plugins/prisma';
import { hashPassword } from '../auth';
import { forgetStatus } from '../moderation';
import type { Prisma } from '../generated/prisma/client';
import { audit, bad } from './core';
import { gameKick, gameMute, gameOnline, gameSettings } from './game';
import { areaStats } from '../routes/play';

const PUBLIC_USER = {
  id: true,
  playSeconds: true,
  email: true,
  name: true,
  cefrLevel: true,
  xp: true,
  coins: true,
  streak: true,
  lastActiveAt: true,
  createdAt: true,
  nativeLang: true,
  role: true,
  bannedUntil: true,
  banReason: true,
  mutedUntil: true,
  placementDoneAt: true,
  reviewsDone: true,
  device: true,
  lastIp: true,
} as const;

const ListQuery = z.object({
  q: z.string().max(100).optional(),
  level: z.enum(CEFR_LEVELS).optional(),
  lang: z.string().max(10).optional(),
  kind: z.enum(['all', 'registered', 'guest', 'banned', 'muted', 'staff']).default('all'),
  active: z.coerce.number().int().min(0).max(3650).optional(),
  sort: z.enum(['recent', 'created', 'play', 'xp', 'coins', 'name']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(5).max(200).default(50),
});

const PatchSchema = z.object({
  name: z.string().trim().min(2).max(20).optional(),
  cefrLevel: z.enum(CEFR_LEVELS).optional(),
  role: z.enum(['player', 'editor', 'admin']).optional(),
  coinsDelta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  xpDelta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  /** Farm basket: crop → pieces; `resetPlots` empties the garden. */
  basket: z.partialRecord(z.enum(CROPS), z.number().int().min(0).max(100_000)).optional(),
  resetPlots: z.boolean().optional(),
  resetPlacement: z.boolean().optional(),
});

export function adminUserRoutes(app: FastifyInstance) {
  app.get('/admin/users', async (req, reply) => {
    const q = ListQuery.safeParse(req.query);
    if (!q.success) return bad(reply, 'bad_request');
    const { q: text, level, lang, kind, active, sort, page, size } = q.data;
    const now = new Date();
    const where: Prisma.UserWhereInput = {
      NOT: { id: { startsWith: 'admin-test-' } },
      ...(text ? { OR: [{ name: { contains: text, mode: 'insensitive' } }, { email: { contains: text, mode: 'insensitive' } }, { id: text }, { lastIp: { startsWith: text } }] } : {}),
      ...(level ? { cefrLevel: level } : {}),
      ...(lang ? { nativeLang: lang } : {}),
      ...(active ? { lastActiveAt: { gte: new Date(Date.now() - active * 86_400_000) } } : {}),
      ...(kind === 'registered' ? { email: { not: null } } : kind === 'guest' ? { email: null } : kind === 'banned' ? { bannedUntil: { gt: now } } : kind === 'muted' ? { mutedUntil: { gt: now } } : kind === 'staff' ? { role: { in: ['editor', 'admin'] } } : {}),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput =
      sort === 'created' ? { createdAt: 'desc' } : sort === 'play' ? { playSeconds: 'desc' } : sort === 'xp' ? { xp: 'desc' } : sort === 'coins' ? { coins: 'desc' } : sort === 'name' ? { name: 'asc' } : { lastActiveAt: 'desc' };
    const [total, rows] = await Promise.all([prisma.user.count({ where }), prisma.user.findMany({ where, orderBy, skip: (page - 1) * size, take: size, select: PUBLIC_USER })]);
    return { total, page, size, rows };
  });

  app.get<{ Params: { id: string } }>('/admin/users/:id', async (req, reply) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id }, select: { ...PUBLIC_USER, avatarConfig: true, gameState: true } });
    if (!u) return bad(reply, 'not_found', 404);
    const [attempts, vocabCount, vocab, reportsBy, reportsAgainst, events, online] = await Promise.all([
      prisma.questAttempt.findMany({ where: { userId: u.id }, orderBy: { startedAt: 'desc' }, take: 50, select: { id: true, questId: true, npcId: true, status: true, score: true, turns: true, goalsDone: true, startedAt: true, finishedAt: true } }),
      prisma.vocabEntry.count({ where: { userId: u.id } }),
      prisma.vocabEntry.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 100, select: { word: true, meaning: true, lang: true, intervalDays: true, nextReviewAt: true, createdAt: true } }),
      prisma.report.findMany({ where: { reporterId: u.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.report.findMany({ where: { targetPlayerId: u.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.event.findMany({ where: { playerId: u.id }, orderBy: { createdAt: 'desc' }, take: 60, select: { name: true, props: true, createdAt: true } }),
      gameOnline(),
    ]);
    // coin history: rewards, spending and admin changes (newest first)
    const money = await prisma.event.findMany({ where: { playerId: u.id, name: { in: ['coins_earned', 'coins_spent', 'coins_admin'] } }, orderBy: { createdAt: 'desc' }, take: 300, select: { name: true, props: true, createdAt: true } });
    const wallet = money
      .map((e) => {
        const p = (e.props ?? {}) as Record<string, unknown>;
        const n = Number(p.coins) || 0;
        const coins = e.name === 'coins_spent' ? -Math.abs(n) : n;
        return { at: e.createdAt, coins, source: e.name === 'coins_admin' ? 'admin' : String(p.source ?? 'other'), item: String(p.item ?? p.quest ?? (e.name === 'coins_admin' ? (p.by ?? '') : '')), xp: Number(p.xp) || 0 };
      })
      .filter((w) => w.coins !== 0);
    // what each quest attempt paid: the logged reward when there is one, else the reward rule on the quest content
    const paid = new Map<string, { xp: number; coins: number }>();
    for (const e of money) {
      const p = (e.props ?? {}) as Record<string, unknown>;
      if (e.name === 'coins_earned' && typeof p.attempt === 'string' && p.attempt) paid.set(p.attempt, { xp: Number(p.xp) || 0, coins: Number(p.coins) || 0 });
    }
    const rewardOf = (a: (typeof attempts)[number]) => {
      const got = paid.get(a.id);
      if (got) return got;
      if (a.status === 'active' || a.status === 'abandoned') return { xp: 0, coins: 0 };
      const q = getQuest(a.questId) ?? getPairQuest(a.questId);
      if (!q) return null;
      const goals = 'goals' in q ? q.goals.length : Math.max(1, ...q.roles.map((r) => r.goals.length));
      const ratio = (a.goalsDone?.length ?? 0) / Math.max(1, goals);
      const full = a.status === 'completed';
      return { xp: full ? q.reward.xp : Math.round((q.reward.xp * ratio) / 2), coins: full ? q.reward.coins : Math.round((q.reward.coins * ratio) / 2) };
    };
    const playDays = await prisma.playDay.findMany({ where: { userId: u.id }, orderBy: { day: 'desc' }, take: 60, select: { day: true, seconds: true, sessions: true } });
    const farm = FarmStateSchema.safeParse(((u.gameState ?? {}) as { farm?: unknown }).farm);
    return {
      user: u,
      areas: areaStats(u.gameState),
      farm: farm.success ? farm.data : emptyFarm(),
      attempts: attempts.map((a) => ({ ...a, reward: rewardOf(a) })),
      wallet,
      vocabCount,
      vocab,
      reportsBy,
      reportsAgainst,
      events,
      online: online?.players.filter((p) => p.uid === u.id) ?? [],
      playDays,
    };
  });

  app.get<{ Params: { id: string; aid: string } }>('/admin/users/:id/attempts/:aid', async (req, reply) => {
    const a = await prisma.questAttempt.findFirst({ where: { id: req.params.aid, userId: req.params.id } });
    return a ?? bad(reply, 'not_found', 404);
  });

  app.patch<{ Params: { id: string } }>('/admin/users/:id', async (req, reply) => {
    const body = PatchSchema.safeParse(req.body);
    if (!body.success) return bad(reply, 'invalid', 400, { issues: body.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) return bad(reply, 'not_found', 404);
    const p = body.data;
    if (p.role && u.id === req.admin!.id && p.role !== 'admin') return bad(reply, 'cannot_demote_self');
    const data: Prisma.UserUpdateInput = {};
    if (p.name) data.name = maskProfanity(p.name);
    if (p.cefrLevel) data.cefrLevel = p.cefrLevel;
    if (p.role) data.role = p.role;
    if (p.coinsDelta) data.coins = Math.max(0, u.coins + p.coinsDelta);
    if (p.xpDelta) data.xp = Math.max(0, u.xp + p.xpDelta);
    if (p.resetPlacement) data.placementDoneAt = null;
    if (p.basket || p.resetPlots) {
      const gs = { ...((u.gameState ?? {}) as Record<string, unknown>) };
      const f = FarmStateSchema.safeParse(gs.farm);
      const farm = f.success ? f.data : emptyFarm();
      if (p.basket) for (const [k, v] of Object.entries(p.basket)) farm.basket[k] = v!;
      if (p.resetPlots) farm.plots = emptyFarm().plots;
      gs.farm = farm;
      data.gameState = gs as Prisma.InputJsonValue;
    }
    const after = await prisma.user.update({ where: { id: u.id }, data, select: PUBLIC_USER });
    forgetStatus(u.id);
    // the player's coin history (admin page): an admin's change, kept apart from the game economy
    if (after.coins !== u.coins) await prisma.event.create({ data: { name: 'coins_admin', playerId: u.id, props: { coins: after.coins - u.coins, by: req.admin!.name } } });
    const before = { name: u.name, cefrLevel: u.cefrLevel, role: u.role, coins: u.coins, xp: u.xp, farm: (u.gameState as { farm?: unknown })?.farm ?? null };
    await audit(req, 'user.update', u.id, before, p);
    return after;
  });

  /** Ban: days > 0 for a while, days = null for good, days = 0 to lift it. Kicks the player out of the street. */
  app.post<{ Params: { id: string } }>('/admin/users/:id/ban', async (req, reply) => {
    const body = z.object({ days: z.number().min(0).max(36500).nullable(), reason: z.string().max(300).default('') }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    if (req.params.id === req.admin!.id) return bad(reply, 'cannot_ban_self');
    const until = body.data.days === null ? new Date('9999-12-31T00:00:00Z') : body.data.days === 0 ? null : new Date(Date.now() + body.data.days * 86_400_000);
    // guests have a user row too (ensureUser); create one if the id is new so the ban sticks
    const u = await prisma.user.upsert({ where: { id: req.params.id }, create: { id: req.params.id, name: 'Guest', bannedUntil: until, banReason: body.data.reason }, update: { bannedUntil: until, banReason: body.data.reason } });
    forgetStatus(u.id);
    if (until) await gameKick(u.id, body.data.reason || 'Your account has been suspended.', true);
    await audit(req, until ? 'user.ban' : 'user.unban', u.id, null, { until, reason: body.data.reason });
    return { ok: true, bannedUntil: until };
  });

  app.post<{ Params: { id: string } }>('/admin/users/:id/mute', async (req, reply) => {
    const body = z.object({ minutes: z.number().int().min(0).max(525_600) }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    const until = body.data.minutes ? new Date(Date.now() + body.data.minutes * 60_000) : null;
    const u = await prisma.user.upsert({ where: { id: req.params.id }, create: { id: req.params.id, name: 'Guest', mutedUntil: until }, update: { mutedUntil: until } });
    forgetStatus(u.id);
    await gameMute(u.id, until?.getTime() ?? 0);
    await audit(req, until ? 'user.mute' : 'user.unmute', u.id, null, { until });
    return { ok: true, mutedUntil: until };
  });

  app.post<{ Params: { id: string } }>('/admin/users/:id/kick', async (req) => {
    const reason = String((req.body as { reason?: unknown } | undefined)?.reason ?? '').slice(0, 200) || 'Removed by a moderator.';
    const r = await gameKick(req.params.id, reason);
    await audit(req, 'user.kick', req.params.id, null, { reason });
    return { kicked: r?.kicked ?? 0, gameServer: !!r };
  });

  /**
   * Change a player's in-game settings: pushed to their open game right away (game server), kept as the known
   * settings, and — if they are not online — handed to the game on their next join (/me/hello).
   */
  app.post<{ Params: { id: string } }>('/admin/users/:id/settings', async (req, reply) => {
    const body = PlayerSettingsSchema.safeParse(req.body);
    if (!body.success || !Object.keys(body.data).length) return bad(reply, 'bad_request');
    const u = await prisma.user.findUnique({ where: { id: req.params.id }, select: { device: true, gameState: true } });
    if (!u) return reply.code(404).send({ error: 'not_found' });
    const r = await gameSettings(req.params.id, body.data);
    const applied = r?.applied ?? 0;
    const device = (u.device ?? {}) as Record<string, unknown>;
    const gs = (u.gameState ?? {}) as Record<string, unknown>;
    const data: Prisma.UserUpdateInput = { device: { ...device, settings: { ...((device.settings as object) ?? {}), ...body.data } } as Prisma.InputJsonValue };
    if (!applied) data.gameState = { ...gs, adminSettings: { ...((gs.adminSettings as object) ?? {}), ...body.data } } as Prisma.InputJsonValue;
    await prisma.user.update({ where: { id: req.params.id }, data });
    await audit(req, 'user.settings', req.params.id, null, body.data);
    return { applied, pending: !applied };
  });

  /** Journey overview: how far players got (chapters), stamps per area, today's tasks, the weekly challenge. */
  app.get('/admin/journey', async () => {
    const users = await prisma.user.findMany({ select: { gameState: true } });
    const reached = MAIN_STEPS.map(() => 0);
    const stamps: Record<string, number> = Object.fromEntries(STAMP_AREAS.map((a) => [a, 0]));
    const areaTasks: Record<string, number> = Object.fromEntries(AREA_STEPS.map((s) => [s.id, 0]));
    let players = 0;
    let dailyAll = 0;
    let dailyAny = 0;
    let invited = 0;
    const day = today();
    for (const u of users) {
      const j = (u.gameState as { journey?: JourneyState } | null)?.journey;
      if (!j) continue;
      players += 1;
      const ch = chapterOf(j);
      for (let i = 0; i < Math.min(ch + 1, MAIN_STEPS.length); i++) reached[i]! += 1;
      for (const a of stampsOf(j)) stamps[a]! += 1;
      for (const id of j.done) if (id in areaTasks) areaTasks[id]! += 1;
      if (j.day === day && j.dailyDone.length) dailyAny += 1;
      if (j.day === day && j.dailyBonus) dailyAll += 1;
      invited += j.invited ?? 0;
    }
    const week = await prisma.setting.findUnique({ where: { key: 'journey:week' } }).catch(() => null);
    return { players, chapters: MAIN_STEPS.map((s, i) => ({ id: s.id, reached: reached[i] })), stamps, areaTasks, dailyAny, dailyAll, invited, week: week?.value ?? null };
  });

  /** Start a player's journey again (progress counted again from new events, no back-fill). */
  app.post<{ Params: { id: string } }>('/admin/users/:id/journey/reset', async (req, reply) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id }, select: { gameState: true } });
    if (!u) return reply.code(404).send({ error: 'not_found' });
    const gs = { ...((u.gameState as Record<string, unknown>) ?? {}) };
    const before = gs.journey ?? null;
    gs.journey = { done: [], prog: {}, day: '', daily: [], dailyDone: [], dailyProg: {}, dailyBonus: false, tracked: [] };
    await prisma.user.update({ where: { id: req.params.id }, data: { gameState: gs as Prisma.InputJsonValue } });
    await audit(req, 'user.journey_reset', req.params.id, before, null);
    return { ok: true };
  });

  /** Sign out everywhere (every token minted before stops working). */
  app.post<{ Params: { id: string } }>('/admin/users/:id/signout', async (req, reply) => {
    const u = await prisma.user.update({ where: { id: req.params.id }, data: { tokenVersion: { increment: 1 } } }).catch(() => null);
    if (!u) return bad(reply, 'not_found', 404);
    forgetStatus(u.id);
    await gameKick(u.id, 'You have been signed out.');
    await audit(req, 'user.signout', u.id);
    return { ok: true };
  });

  /**
   * "Forgot password" requests of the last 30 days, newest first, with what happened after: the player reset it with
   * the e-mailed code (or changed it), an admin set it, the admin marked it handled, or still open.
   */
  app.get('/admin/password-requests', async () => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const ev = await prisma.event.findMany({ where: { name: { in: ['password_reset_request', 'password_reset', 'password_change', 'password_request_dismissed'] }, createdAt: { gte: since }, playerId: { not: null } }, orderBy: { createdAt: 'asc' }, select: { name: true, playerId: true, props: true, createdAt: true } });
    type Row = { playerId: string; at: Date; mailed: boolean; count: number; status: 'open' | 'self' | 'admin' | 'dismissed'; doneAt: Date | null };
    const rows: Row[] = [];
    const openBy = new Map<string, Row>();
    for (const e of ev) {
      const id = e.playerId!;
      const p = (e.props ?? {}) as { mailed?: boolean; via?: string };
      const cur = openBy.get(id);
      if (e.name === 'password_reset_request') {
        if (cur) {
          cur.count += 1;
          cur.at = e.createdAt;
          cur.mailed ||= !!p.mailed;
        } else {
          const r: Row = { playerId: id, at: e.createdAt, mailed: !!p.mailed, count: 1, status: 'open', doneAt: null };
          rows.push(r);
          openBy.set(id, r);
        }
      } else if (cur) {
        cur.status = e.name === 'password_request_dismissed' ? 'dismissed' : p.via === 'admin' ? 'admin' : 'self';
        cur.doneAt = e.createdAt;
        openBy.delete(id);
      }
    }
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.playerId))] } }, select: { id: true, name: true, email: true, lastActiveAt: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      rows: rows
        .filter((r) => byId.has(r.playerId))
        .reverse()
        .map((r) => ({ ...r, id: r.playerId, name: byId.get(r.playerId)!.name, email: byId.get(r.playerId)!.email, lastActiveAt: byId.get(r.playerId)!.lastActiveAt })),
      open: openBy.size,
    };
  });

  /** The admin types a new password for the player (they tell the player); old sessions end. */
  app.post<{ Params: { id: string } }>('/admin/users/:id/set-password', async (req, reply) => {
    const pw = (req.body as { password?: unknown } | undefined)?.password;
    if (typeof pw !== 'string' || pw.length < 6 || pw.length > 100) return bad(reply, 'bad_password', 400, { detail: 'At least 6 characters.' });
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u?.email) return bad(reply, 'no_account', 400, { detail: 'Guests have no password.' });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(pw), tokenVersion: { increment: 1 } } });
    forgetStatus(u.id);
    await gameKick(u.id, 'Your password was changed. Please sign in again.');
    await prisma.event.create({ data: { name: 'password_reset', playerId: u.id, props: { via: 'admin' } } });
    await audit(req, 'user.set_password', u.id);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/admin/users/:id/password-request/dismiss', async (req) => {
    await prisma.event.create({ data: { name: 'password_request_dismissed', playerId: req.params.id, props: {} } });
    await audit(req, 'user.password_request_dismiss', req.params.id);
    return { ok: true };
  });

  /** There is no e-mail service: the admin gets a temporary password to pass on (shown once), and old sessions end. */
  app.post<{ Params: { id: string } }>('/admin/users/:id/reset-password', async (req, reply) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u?.email) return bad(reply, 'no_account', 400, { detail: 'Guests have no password.' });
    const temp = randomBytes(6).toString('base64url');
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(temp), tokenVersion: { increment: 1 } } });
    forgetStatus(u.id);
    await prisma.event.create({ data: { name: 'password_reset', playerId: u.id, props: { via: 'admin' } } });
    await audit(req, 'user.reset_password', u.id);
    return { password: temp };
  });

  /** Delete the account and everything linked to it. Body { confirm: <name> } guards against slips. */
  app.delete<{ Params: { id: string } }>('/admin/users/:id', async (req, reply) => {
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) return bad(reply, 'not_found', 404);
    if (u.id === req.admin!.id) return bad(reply, 'cannot_delete_self');
    if ((req.body as { confirm?: unknown } | undefined)?.confirm !== u.name) return bad(reply, 'confirm_name');
    await gameKick(u.id, 'Your account was deleted.', true);
    await prisma.$transaction([
      prisma.event.deleteMany({ where: { playerId: u.id } }),
      prisma.pushToken.deleteMany({ where: { playerId: u.id } }),
      prisma.feedback.updateMany({ where: { playerId: u.id }, data: { playerId: null } }),
      prisma.friendship.deleteMany({ where: { OR: [{ aId: u.id }, { bId: u.id }] } }),
      prisma.user.delete({ where: { id: u.id } }), // attempts + vocab cascade
    ]);
    forgetStatus(u.id);
    await audit(req, 'user.delete', u.id, { name: u.name, email: u.email, xp: u.xp, coins: u.coins }, null);
    return { ok: true };
  });

  // ---------------------------------------------------------------- online + moderation queues
  app.get('/admin/online', async () => {
    const o = await gameOnline();
    if (!o) return { gameServer: false, players: [], rooms: [] };
    const ids = [...new Set(o.players.map((p) => p.uid).filter(Boolean))];
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, cefrLevel: true, role: true } });
    const byId = new Map(users.map((u) => [u.id, u]));
    return { gameServer: true, rooms: o.rooms, players: o.players.map((p) => ({ ...p, account: byId.get(p.uid) ?? null })) };
  });

  app.get('/admin/reports', async (req) => {
    const status = (req.query as { status?: string }).status;
    const rows = await prisma.report.findMany({ where: status && status !== 'all' ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
    const ids = [...new Set(rows.flatMap((r) => [r.reporterId, r.targetPlayerId ?? '']).filter(Boolean))];
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, bannedUntil: true, mutedUntil: true } });
    return { rows, users: Object.fromEntries(users.map((u) => [u.id, u])), counts: Object.fromEntries((await prisma.report.groupBy({ by: ['status'], _count: true })).map((g) => [g.status, g._count])) };
  });
  app.patch<{ Params: { id: string } }>('/admin/reports/:id', async (req, reply) => {
    const body = z.object({ status: z.enum(['new', 'done', 'ignored']), note: z.string().max(500).optional() }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    const r = await prisma.report.update({ where: { id: req.params.id }, data: { status: body.data.status, note: body.data.note ?? undefined, handledBy: req.admin!.name, handledAt: new Date() } }).catch(() => null);
    if (!r) return bad(reply, 'not_found', 404);
    await audit(req, 'report.update', r.id, null, body.data);
    return r;
  });

  app.get('/admin/feedback', async (req) => {
    const status = (req.query as { status?: string }).status;
    return prisma.feedback.findMany({ where: status && status !== 'all' ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
  });
  app.patch<{ Params: { id: string } }>('/admin/feedback/:id', async (req, reply) => {
    const body = z.object({ status: z.enum(['new', 'done']) }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    const r = await prisma.feedback.update({ where: { id: req.params.id }, data: { status: body.data.status } }).catch(() => null);
    if (!r) return bad(reply, 'not_found', 404);
    await audit(req, 'feedback.update', r.id, null, body.data);
    return r;
  });
}
