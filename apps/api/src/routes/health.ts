import type { FastifyInstance } from 'fastify';
import { prisma } from '../plugins/prisma';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    let db: 'ok' | 'down' = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return { ok: true, service: 'api', db };
  });
}
