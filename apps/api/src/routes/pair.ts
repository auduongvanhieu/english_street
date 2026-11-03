import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PairStartRequestSchema, ReportRequestSchema, SessionChatRequestSchema } from '@es/shared';
import { NpcError } from '../npc/service';
import type { PairService } from '../npc/pairService';
import type { AttemptRepo } from '../npc/attempts';
import { budget } from '../npc/budget';
import { playerIdFrom } from '../auth';
import { allowTurn } from '../npc/ratelimit';

export function pairRoutes(pairs: PairService, repo: AttemptRepo) {
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
      const pid = playerIdFrom(req, body.data.playerId);
      if (!pid) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await allowTurn(pid))) return reply.code(429).send({ error: 'rate_limited' });
      await budget.check(pid, req.ip);
      const out = await pairs.chat(req.params.id, pid, body.data.text);
      await budget.recordTurn(pid, req.ip);
      return out;
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
      await repo.logEvent({ name: 'report', playerId: body.data.reporterId, props: { reason: body.data.reason } });
      return reply.code(201).send({ ok: true });
    });
  };
}
