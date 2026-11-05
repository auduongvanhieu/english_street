import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NpcError, type NpcService } from '../npc/service';
import { budget } from '../npc/budget';
import { limiter } from '../npc/ratelimit';
import { setting } from '../settings';
import { bad } from './core';

/** Test player id of an admin: its events are left out of the stats (prefix "admin-test-"). */
export const testPlayer = (adminId: string) => `admin-test-${adminId}`.slice(0, 64);
export const isTestPlayer = (id: string | null | undefined) => !!id && id.startsWith('admin-test-');

/**
 * "Try the NPC": a real conversation with an NPC (and quest) from the admin site, showing the raw grading.
 * Counts against the global Claude budget; limited per admin per day (setting adminTestTurnsPerDay).
 */
export function adminTestRoutes(app: FastifyInstance, npc: NpcService) {
  const fail = (reply: Parameters<typeof bad>[0], e: unknown) => {
    if (e instanceof NpcError) return bad(reply, e.message, e.status);
    throw e;
  };

  app.post('/admin/test/start', async (req, reply) => {
    const body = z.object({ npcId: z.string(), questId: z.string().nullable().default(null) }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    try {
      return await npc.start(body.data.npcId, body.data.questId, testPlayer(req.admin!.id), `🛠 ${req.admin!.name}`.slice(0, 20));
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post('/admin/test/chat', async (req, reply) => {
    const body = z.object({ sessionId: z.string(), text: z.string().min(1).max(500) }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    const day = new Date().toISOString().slice(0, 10);
    if (!(await limiter.allow(`admintest:${req.admin!.id}:${day}`, setting('adminTestTurnsPerDay'), 86_400))) return bad(reply, 'daily_quota_exhausted', 429);
    const pid = testPlayer(req.admin!.id);
    try {
      const snap = await budget.snapshot();
      if (snap.spentUsd >= snap.budgetUsd) return bad(reply, 'daily_budget_exhausted', 429);
      return await npc.chat(body.data.sessionId, pid, body.data.text, 'text', true);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post('/admin/test/end', async (req, reply) => {
    const body = z.object({ sessionId: z.string() }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    try {
      return { summary: await npc.end(body.data.sessionId, testPlayer(req.admin!.id)) };
    } catch (e) {
      return fail(reply, e);
    }
  });
}
