import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env, isProd } from '../env';
import { budget } from '../npc/budget';
import type { AttemptRepo } from '../npc/attempts';
import { computeStats } from '../analytics';

/** Admin routes: `Authorization: Bearer $ADMIN_TOKEN`. Without ADMIN_TOKEN they are open in dev and disabled in production. */
export function adminRoutes(repo: AttemptRepo) {
  return async function routes(app: FastifyInstance) {
    app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
      const h = req.headers.authorization ?? '';
      const ok = env.ADMIN_TOKEN ? h === `Bearer ${env.ADMIN_TOKEN}` : !isProd;
      if (!ok) return reply.code(env.ADMIN_TOKEN ? 403 : 404).send({ error: 'forbidden' });
    });
    app.get('/admin/budget', async () => budget.snapshot());
    app.get<{ Querystring: { days?: string } }>('/admin/stats', async (req) => computeStats(repo, Math.min(90, Math.max(1, Number(req.query.days) || 7))));
    app.get('/admin/reports', async () => repo.listReports(100));
    app.get('/admin/feedback', async () => repo.listFeedback(100));
  };
}
