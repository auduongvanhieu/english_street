import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PairStartRequestSchema, ReportRequestSchema, SessionChatRequestSchema } from '@es/shared';
import { NpcError } from '../npc/service';
import type { PairService } from '../npc/pairService';
import type { AttemptRepo } from '../npc/attempts';

export function pairRoutes(pairs: PairService, repo: AttemptRepo, allow: (playerId: string) => boolean) {
  return async function routes(app: FastifyInstance) {
    app.setErrorHandler((err, _req, reply) => {
      if (err instanceof NpcError) return reply.code(err.status).send({ error: err.message });
      app.log.error(err);
      return reply.code(500).send({ error: 'internal_error' });
    });

    app.post('/pair/start', async (req, reply) => {
      const body = PairStartRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      return pairs.start(body.data.questId, body.data.players);
    });

    app.post<{ Params: { id: string } }>('/pair/:id/chat', async (req, reply) => {
      const body = SessionChatRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      if (!allow(body.data.playerId)) return reply.code(429).send({ error: 'rate_limited' });
      return pairs.chat(req.params.id, body.data.playerId, body.data.text);
    });

    app.post<{ Params: { id: string } }>('/pair/:id/end', async (req, reply) => {
      const body = z.object({ playerId: z.string().min(8) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      return { summaries: await pairs.end(req.params.id, body.data.playerId) };
    });

    app.post('/reports', async (req, reply) => {
      const body = ReportRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      await repo.createReport(body.data);
      return reply.code(201).send({ ok: true });
    });
  };
}
