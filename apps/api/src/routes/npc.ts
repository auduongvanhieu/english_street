import type { FastifyInstance } from 'fastify';
import { SessionChatRequestSchema, StartSessionRequestSchema } from '@es/shared';
import { NpcError, type NpcService } from '../npc/service';
import { budget } from '../npc/budget';
import { playerIdFrom } from '../auth';
import { allowTurn } from '../npc/ratelimit';

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
      const pid = playerIdFrom(req, body.data.playerId);
      if (!pid) return reply.code(401).send({ error: 'unauthorized' });
      return svc.start(q.npc, q.id, pid, body.data.playerName);
    });

    // Free conversation with an NPC (no quest)
    app.post<{ Params: { id: string } }>('/npc/:id/talk', async (req, reply) => {
      const body = StartSessionRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      const pid = playerIdFrom(req, body.data.playerId);
      if (!pid) return reply.code(401).send({ error: 'unauthorized' });
      return svc.start(req.params.id, null, pid, body.data.playerName);
    });

    // One learner turn
    app.post<{ Params: { id: string } }>('/sessions/:id/chat', async (req, reply) => {
      const body = SessionChatRequestSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
      const pid = playerIdFrom(req, body.data.playerId);
      if (!pid) return reply.code(401).send({ error: 'unauthorized' });
      if (!(await allowTurn(pid))) return reply.code(429).send({ error: 'rate_limited' });
      const b = await budget.check(pid, req.ip, true);
      let out;
      try {
        out = await svc.chat(req.params.id, pid, body.data.text, body.data.source, body.data.subtitles === true, body.data.lang);
      } catch (e) {
        // a bought turn that did not happen is given back
        if (b.bonus) await budget.giveBack(pid);
        throw e;
      }
      await budget.recordTurn(pid, req.ip);
      return out;
    });

    // Give up / close
    app.post<{ Params: { id: string }; Body: { playerId?: string } }>('/sessions/:id/end', async (req, reply) => {
      const playerId = playerIdFrom(req, req.body?.playerId) ?? '';
      if (!playerId) return reply.code(400).send({ error: 'bad_request' });
      return { summary: await svc.end(req.params.id, playerId) };
    });
  };
}
