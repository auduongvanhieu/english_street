import type { FastifyInstance } from 'fastify';
import type { WorldDto } from '@es/shared';
import { contentVersion, loadWorld } from '@es/quests';
import { prisma } from '../plugins/prisma';
import { setting } from '../settings';

let annCache: { at: number; list: WorldDto['announcements'] } = { at: 0, list: [] };
let dbOn = false;
export const enableAnnouncements = (on: boolean) => (dbOn = on);
export const forgetAnnouncements = () => (annCache = { at: 0, list: [] });

/** Announcements running now (cached 30 s). */
export async function activeAnnouncements(): Promise<WorldDto['announcements']> {
  if (!dbOn) return [];
  if (Date.now() - annCache.at < 30_000) return annCache.list;
  const now = new Date();
  const rows = await prisma.announcement.findMany({ where: { startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { startsAt: 'desc' }, take: 5 }).catch(() => []);
  annCache = { at: Date.now(), list: rows.map((r) => ({ id: r.id, text: r.text, level: r.level === 'warning' ? 'warning' : 'info', endsAt: r.endsAt.toISOString() })) };
  return annCache.list;
}

/** World settings for the game (animal names, farm rules, sold-out items) + notices and maintenance. */
export async function worldRoutes(app: FastifyInstance) {
  app.get('/world', async (_req, reply): Promise<WorldDto> => {
    reply.header('cache-control', 'no-store');
    return { ...loadWorld(), version: contentVersion(), announcements: await activeAnnouncements(), maintenance: setting('maintenance') };
  });
}
