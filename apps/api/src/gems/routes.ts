import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';
import { GemError, buyNpcTurns, exchangeGems, gemInfo } from './core';

/** 💎 the player's side: balance and prices, gems → coins, extra NPC turns. Needs Postgres. */
export function gemRoutes(dbOn: boolean) {
  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);

    app.get('/me/gems', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!dbOn) return reply.code(404).send({ error: 'not_found' });
      return gemInfo(id);
    });

    app.post('/me/gems/exchange', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!dbOn) return reply.code(404).send({ error: 'not_found' });
      if (!(await limiter.allow(`gem:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      const body = z.object({ gems: z.number().int().min(1).max(1_000_000) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      try {
        return await exchangeGems(id, body.data.gems);
      } catch (e) {
        if (e instanceof GemError) return reply.code(e.code === 'not_enough_gems' ? 402 : 400).send({ error: e.code });
        throw e;
      }
    });

    app.post('/me/gems/npc-turns', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      if (!dbOn) return reply.code(404).send({ error: 'not_found' });
      if (!(await limiter.allow(`gem:${id}`, 20))) return reply.code(429).send({ error: 'rate_limited' });
      try {
        return await buyNpcTurns(id);
      } catch (e) {
        if (e instanceof GemError) return reply.code(402).send({ error: e.code });
        throw e;
      }
    });
  };
}
