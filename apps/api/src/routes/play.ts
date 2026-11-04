import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AreaIdSchema, FarmActionSchema, FarmStateSchema, applyFarm, emptyFarm, type FarmState } from '@es/shared';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';

/** Small per-player game state kept in User.gameState (JSON). */
interface GameState {
  farm?: FarmState;
  quiz?: { day: string; xp: number };
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
      await repo.updateUser(id, { gameState: { ...gs, quiz: { day, xp: used + xp } } });
      if (xp || coins) await repo.reward(id, xp, coins);
      await repo.logEvent({ name: 'quiz_done', playerId: id, props: { area: body.data.area, correct: body.data.correct, total: body.data.total } });
      return { xp, coins, capped: xp < want };
    });
  };
}
