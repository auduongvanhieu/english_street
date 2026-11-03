import type { FastifyInstance } from 'fastify';
import { SessionChatRequestSchema, StartSessionRequestSchema } from '@es/shared';
import { NpcError, type NpcService } from '../npc/service';
import { env } from '../env';

/** Simple per-player sliding window rate limit (in-memory; fine for one API instance). */
const buckets = new Map<string, number[]>();
function allow(playerId: string) {
  const now = Date.now();
  const arr = (buckets.get(playerId) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= env.NPC_RATE_PER_MIN) return false;
  arr.push(now);
  buckets.set(playerId, arr);
  return true;
}

export function npcRoutes(svc: NpcService) {
  return async function routes(app: FastifyInstance) {
    app.setErrorHandler((err, _req, reply) => {
      if (err instanceof NpcError) return reply.code(err.status).send({ error: err.message });
      app.log.error(err);
      return reply.code(500).send({ error: 'internal_error' });
    });

    // Start a quest with its NPC
    app.post<{ Params: { id: string } }>('/quests/:id/start', async (req, reply) => {
      const body = StartSessionRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      const { getQuest } = await import('@es/quests');
      const q = getQuest(req.params.id);
      if (!q) return reply.code(404).send({ error: 'quest_not_found' });
      return svc.start(q.npc, q.id, body.data.playerId, body.data.playerName);
    });

    // Free conversation with an NPC (no quest)
    app.post<{ Params: { id: string } }>('/npc/:id/talk', async (req, reply) => {
      const body = StartSessionRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      return svc.start(req.params.id, null, body.data.playerId, body.data.playerName);
    });

    // One learner turn
    app.post<{ Params: { id: string } }>('/sessions/:id/chat', async (req, reply) => {
      const body = SessionChatRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      if (!allow(body.data.playerId)) return reply.code(429).send({ error: 'rate_limited' });
      return svc.chat(req.params.id, body.data.playerId, body.data.text);
    });

    // Give up / close
    app.post<{ Params: { id: string }; Body: { playerId?: string } }>('/sessions/:id/end', async (req, reply) => {
      const playerId = typeof req.body?.playerId === 'string' ? req.body.playerId : '';
      if (!playerId) return reply.code(400).send({ error: 'bad_request' });
      return { summary: await svc.end(req.params.id, playerId) };
    });
  };
}
