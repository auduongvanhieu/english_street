import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AREA_BADGE, AREA_BADGE_WORDS, AREA_IDS, AreaIdSchema, FarmActionSchema, FarmStateSchema, applyFarm, emptyFarm, type AreaId, type FarmState } from '@es/shared';
import { getArea } from '@es/quests';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';

/** Small per-player game state kept in User.gameState (JSON). */
export interface GameState {
  farm?: FarmState;
  quiz?: { day: string; xp: number };
  /** Themed areas: word cards opened and whether a quiz was passed (≥ 80 %). */
  areas?: Partial<Record<AreaId, { learned: string[]; quiz?: boolean }>>;
}

/** Area progress for the profile, and the area badges it earns. */
export function areaStats(gameState: unknown) {
  const gs = (gameState ?? {}) as GameState;
  const areas: Record<string, { learned: number; total: number; quiz: boolean }> = {};
  const badges: string[] = [];
  for (const id of AREA_IDS) {
    const a = gs.areas?.[id];
    const ids = new Set(getArea(id)?.items.map((i) => i.id) ?? []);
    const learned = (a?.learned ?? []).filter((x) => ids.has(x)).length;
    areas[id] = { learned, total: ids.size, quiz: !!a?.quiz };
    if (a?.quiz && learned >= Math.min(AREA_BADGE_WORDS, ids.size)) badges.push(AREA_BADGE[id]);
  }
  return { areas, badges };
}
const QUIZ_XP_PER_DAY = 120;

/** Themed-area actions: the farm garden and area quizzes. Rewards are computed (and capped) here. */
export function playRoutes(repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);
    const state = async (id: string) => {
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const gs = (u.gameState ?? {}) as GameState;
      const farm = FarmStateSchema.safeParse(gs.farm ?? emptyFarm());
      return { u, gs, farm: farm.success && farm.data.plots.length ? farm.data : emptyFarm() };
    };

    app.get('/me/farm', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const { farm } = await state(id);
      return { farm, now: Date.now() };
    });

    app.post('/me/farm', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`farm:${id}`, 40))) return reply.code(429).send({ error: 'rate_limited' });
      const body = FarmActionSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const { gs, farm } = await state(id);
      const now = Date.now();
      const r = applyFarm(farm, body.data, now);
      if (r.error) return { ...r, now };
      await repo.updateUser(id, { gameState: { ...gs, farm: r.farm } });
      if (r.xp || r.coins) await repo.reward(id, r.xp, r.coins);
      await repo.logEvent({ name: 'farm_action', playerId: id, props: { action: body.data.action, coins: r.coins } });
      return { ...r, now };
    });

    // Word cards opened in an area (the client also keeps them locally and sends any the server lacks).
    app.get('/me/areas', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const { gs } = await state(id);
      const learned: Record<string, string[]> = {};
      for (const a of AREA_IDS) learned[a] = gs.areas?.[a]?.learned ?? [];
      return { learned };
    });

    app.post('/me/area-learned', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ area: AreaIdSchema, items: z.array(z.string().max(40)).min(1).max(80) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      if (!(await limiter.allow(`learned:${id}`, 60))) return reply.code(429).send({ error: 'rate_limited' });
      const valid = new Set(getArea(body.data.area)?.items.map((i) => i.id) ?? []);
      const { gs } = await state(id);
      const cur = gs.areas?.[body.data.area] ?? { learned: [] };
      const add = body.data.items.filter((x) => valid.has(x) && !cur.learned.includes(x));
      if (!add.length) return { learned: cur.learned.length, badge: null };
      const before = areaStats(gs).badges;
      const next: GameState = { ...gs, areas: { ...gs.areas, [body.data.area]: { ...cur, learned: [...cur.learned, ...add] } } };
      await repo.updateUser(id, { gameState: next });
      const badge = areaStats(next).badges.find((b) => !before.includes(b)) ?? null;
      if (badge) await repo.logEvent({ name: 'badge_earned', playerId: id, props: { badge } });
      return { learned: cur.learned.length + add.length, badge };
    });

    app.post('/me/area-quiz', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const body = z.object({ area: AreaIdSchema, correct: z.number().int().min(0).max(20), total: z.number().int().min(1).max(20) }).safeParse(req.body);
      if (!body.success || body.data.correct > body.data.total) return reply.code(400).send({ error: 'bad_request' });
      if (!(await limiter.allow(`quiz:${id}`, 6))) return reply.code(429).send({ error: 'rate_limited' });
      const { gs } = await state(id);
      const day = new Date().toISOString().slice(0, 10);
      const used = gs.quiz?.day === day ? gs.quiz.xp : 0;
      const want = body.data.correct * 3;
      const xp = Math.max(0, Math.min(want, QUIZ_XP_PER_DAY - used));
      const coins = xp > 0 && body.data.correct / body.data.total >= 0.8 ? 5 : 0;
      const passed = body.data.correct / body.data.total >= 0.8;
      const area = body.data.area;
      const next: GameState = { ...gs, quiz: { day, xp: used + xp } };
      if (passed) next.areas = { ...gs.areas, [area]: { learned: gs.areas?.[area]?.learned ?? [], quiz: true } };
      await repo.updateUser(id, { gameState: next });
      if (xp || coins) await repo.reward(id, xp, coins);
      const before = areaStats(gs).badges;
      const badge = areaStats(next).badges.find((b) => !before.includes(b)) ?? null;
      if (badge) await repo.logEvent({ name: 'badge_earned', playerId: id, props: { badge } });
      await repo.logEvent({ name: 'quiz_done', playerId: id, props: { area: body.data.area, correct: body.data.correct, total: body.data.total } });
      return { xp, coins, capped: xp < want, passed, badge };
    });
  };
}
