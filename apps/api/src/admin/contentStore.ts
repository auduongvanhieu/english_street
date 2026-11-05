import type Redis from 'ioredis';
import { applyFarmConfig } from '@es/shared';
import { loadWorld, onContentChange, setContentOverrides, type ContentKind } from '@es/quests';
import { prisma } from '../plugins/prisma';

/**
 * Admin edits live in ContentDoc and overlay the YAML in packages/quests. Every API process loads them at start
 * and reloads when the Redis version counter changes (an edit in any process bumps it).
 */
let redis: Redis | null = null;
let dbOn = false;
let seen = '';

export async function reloadContent() {
  if (!dbOn) return;
  const rows = await prisma.contentDoc.findMany();
  setContentOverrides(rows.map((r) => ({ kind: r.kind as ContentKind, id: r.id, data: r.data, deleted: r.deleted })));
}

/** After a write in this process: reload here, tell the others. */
export async function contentChanged() {
  await reloadContent();
  if (redis) seen = String(await redis.incr('content:ver'));
}

export async function startContent(r: Redis | null, db: boolean) {
  redis = r;
  dbOn = db;
  // farm rules follow the world document
  onContentChange(() => applyFarmConfig(loadWorld().farm));
  await reloadContent().catch((e: unknown) => console.warn('[content] load failed — using the YAML only', e));
  applyFarmConfig(loadWorld().farm);
  if (!redis) return;
  seen = (await redis.get('content:ver')) ?? '';
  setInterval(() => {
    void redis!
      .get('content:ver')
      .then(async (v) => {
        if ((v ?? '') !== seen) {
          seen = v ?? '';
          await reloadContent();
        }
      })
      .catch(() => undefined);
  }, 10_000).unref();
}
