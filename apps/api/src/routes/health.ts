import type { FastifyInstance } from 'fastify';
import { prisma } from '../plugins/prisma';
import { budget } from '../npc/budget';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    let db: 'ok' | 'down' = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return { ok: true, service: 'api', db, counters: budget.backend, uptime: Math.round(process.uptime()) };
  });
}
