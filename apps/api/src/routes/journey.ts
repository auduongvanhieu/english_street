import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { stepById } from '@es/shared';
import type { Journey } from '../journey/engine';
import { playerIdFrom } from '../auth';

/** The player's journey: chapter, area stamps, today's tasks; tracking side tasks on the HUD. */
export function journeyRoutes(journey: Journey) {
  return async function routes(app: FastifyInstance) {
    const who = (req: { authPlayerId: string | null; query: unknown; body?: unknown }) =>
      playerIdFrom(req as never, (req.query as { playerId?: string })?.playerId ?? (req.body as { playerId?: string } | undefined)?.playerId);
    app.get('/me/journey', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      return journey.view(id);
    });
    app.post('/me/journey/track', async (req, reply) => {
      const id = who(req);
      if (!id) return reply.code(401).send({ error: 'unauthorized' });
      const b = z.object({ id: z.string().max(40), on: z.boolean() }).safeParse(req.body);
      if (!b.success || !stepById(b.data.id)) return reply.code(400).send({ error: 'bad_request' });
      return { tracked: await journey.setTracked(id, b.data.id, b.data.on) };
    });
  };
}
