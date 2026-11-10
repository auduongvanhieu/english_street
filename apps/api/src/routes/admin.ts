import type { FastifyInstance } from 'fastify';
import { adminPayRoutes } from '../payments/routes';
import { budget } from '../npc/budget';
import type { AttemptRepo } from '../npc/attempts';
import type { NpcService } from '../npc/service';
import { computeStats } from '../analytics';
import { adminCore } from '../admin/core';
import { adminContentRoutes } from '../admin/contentRoutes';
import { adminUserRoutes } from '../admin/userRoutes';
import { adminStatsRoutes } from '../admin/stats';
import { adminOpsRoutes } from '../admin/opsRoutes';
import { adminTestRoutes } from '../admin/testRoutes';
import { adminLlmRoutes } from '../admin/llmRoutes';

/**
 * Admin site API (/admin/*): sign in with an editor/admin account (POST /admin/login), or
 * `Authorization: Bearer $ADMIN_TOKEN` for scripts. See src/admin/.
 */
export function adminRoutes(repo: AttemptRepo, npc: NpcService) {
  return async function routes(app: FastifyInstance) {
    adminCore(app, repo.name === 'postgres');
    adminContentRoutes(app);
    adminUserRoutes(app);
    adminStatsRoutes(app);
    adminOpsRoutes(app);
    adminTestRoutes(app, npc);
    adminLlmRoutes(app);
    adminPayRoutes(app);
    app.get('/admin/budget', async () => budget.snapshot());
    app.get<{ Querystring: { days?: string } }>('/admin/stats', async (req) => computeStats(repo, Math.min(90, Math.max(1, Number(req.query.days) || 7))));
  };
}
