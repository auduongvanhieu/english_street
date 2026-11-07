import type { FastifyInstance } from 'fastify';
import { MyFarmActionSchema, MyFarmStateSchema, applyMyFarm, emptyMyFarm, type FarmView, type MyFarmState } from '@es/shared';
import type { AttemptRepo } from '../npc/attempts';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';
import { friendRepo, pair } from '../friends';
import { today } from '../journey/engine';

/**
 * "My farm" (@es/shared myfarm.ts): the player's own farm in User.gameState.myfarm. Buying takes coins, selling
 * gives coins (daily cap), all checked here. Friends (or everybody, as the owner chooses) can look at a farm.
 */
export function myFarmRoutes(repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);
    const farmOf = (gs: Record<string, unknown>): MyFarmState => {
      const r = MyFarmStateSchema.safeParse(gs.myfarm);
      return r.success && r.data.plots.length ? r.data : emptyMyFarm();
    };

    app.get('/me/myfarm', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      return { farm: farmOf((u.gameState ?? {}) as Record<string, unknown>), coins: u.coins, now: Date.now(), day: today() };
    });

    app.post('/me/myfarm', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await limiter.allow(`myfarm:${id}`, 60))) return reply.code(429).send({ error: 'rate_limited' });
      const body = MyFarmActionSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      const u = await repo.ensureUser(id, (await repo.getUser(id))?.name ?? 'Guest');
      const gs = (u.gameState ?? {}) as Record<string, unknown>;
      const r = applyMyFarm(farmOf(gs), body.data, Date.now(), u.coins, today());
      if (r.error) return { ...r, coins: u.coins, now: Date.now() };
      await repo.updateUser(id, { gameState: { ...gs, myfarm: r.farm } });
      if (r.coins < 0) {
        await repo.updateUser(id, { coins: u.coins + r.coins });
        await repo.logEvent({ name: 'coins_spent', playerId: id, props: { source: 'myfarm', coins: -r.coins, item: body.data.action === 'buy' ? body.data.item : '' } });
      }
      if (r.coins > 0 || r.xp) await repo.reward(id, r.xp, Math.max(0, r.coins), 'myfarm');
      await repo.logEvent({ name: `myfarm_${body.data.action}`, playerId: id, props: { coins: r.coins, ...(body.data.action === 'buy' ? { item: body.data.item } : {}) } });
      return { farm: r.farm, said: r.said, xp: r.xp, delta: r.coins, coins: u.coins + r.coins, now: Date.now() };
    });

    /** Somebody's farm, for a visitor: friends only, everyone, or closed (the owner chooses). */
    app.get<{ Params: { id: string } }>('/farms/:id', async (req, reply) => {
      const me = who(req);
      const owner = await repo.getUser(req.params.id);
      if (!owner) return reply.code(404).send({ error: 'not_found' });
      const farm = farmOf((owner.gameState ?? {}) as Record<string, unknown>);
      if (me !== owner.id) {
        if (farm.visits === 'closed') return reply.code(403).send({ error: 'closed' });
        if (farm.visits === 'friends') {
          const [a, b] = pair(me ?? '', owner.id);
          const row = me ? await friendRepo().get(a, b) : null;
          if (row?.status !== 'accepted') return reply.code(403).send({ error: 'friends_only' });
        }
      }
      const view: FarmView = { owner: owner.id, name: owner.name, fields: farm.fields, plots: farm.plots, animals: farm.animals, visits: farm.visits };
      return { farm: view, now: Date.now() };
    });
  };
}
