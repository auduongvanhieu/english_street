import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isInternalKey } from '@es/shared/token';
import { env } from '../env';
import { prisma } from '../plugins/prisma';
import { isBanned, userStatus } from '../moderation';
import { setting } from '../settings';

const HeatSchema = z.object({
  cells: z.array(z.tuple([z.string().datetime(), z.number().int().min(-500).max(500), z.number().int().min(-500).max(500), z.number().int().min(1).max(100_000)])).max(20_000),
});

/** Service calls from the game server (x-internal-key). */
export function internalRoutes(dbOn: boolean) {
  return async function routes(app: FastifyInstance) {
    app.addHook('onRequest', async (req, reply) => {
      if (!isInternalKey(env.AUTH_SECRET, req.headers['x-internal-key'])) return reply.code(403).send({ error: 'forbidden' });
    });

    app.get('/internal/settings', async () => ({ maxGuestsPerIp: setting('maxGuestsPerIp'), extraBannedWords: setting('extraBannedWords'), allowedWords: setting('allowedWords') }));

    app.get<{ Params: { id: string } }>('/internal/user/:id', async (req) => {
      const s = await userStatus(req.params.id).catch(() => null);
      return { banned: isBanned(s), until: s?.bannedUntil ?? null, reason: s?.banReason ?? '', mutedUntil: s?.mutedUntil ? s.mutedUntil.getTime() : 0, tokenVersion: s?.tokenVersion ?? 0 };
    });

    /**
     * Time in the street: the game server reports, about once a minute, the seconds each player has been online since
     * the last report (start = a new session). Added to User.playSeconds and to PlayDay for today (Vietnam day).
     */
    app.post('/internal/playtime', async (req, reply) => {
      const Pos = z.object({ x: z.number().finite(), z: z.number().finite(), rot: z.number().finite() });
      const body = z.object({ items: z.array(z.object({ id: z.string().min(1).max(64), sec: z.number().int().min(0).max(3600), start: z.boolean().optional(), pos: Pos.optional() })).max(5000) }).safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      if (!dbOn) return { ok: true };
      const day = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
      const merged = new Map<string, { sec: number; start: number; pos?: z.infer<typeof Pos> }>();
      for (const it of body.data.items) {
        const m = merged.get(it.id) ?? { sec: 0, start: 0 };
        m.sec += it.sec;
        if (it.start) m.start += 1;
        if (it.pos) m.pos = it.pos; // the latest place wins
        merged.set(it.id, m);
      }
      const known = new Set((await prisma.user.findMany({ where: { id: { in: [...merged.keys()] } }, select: { id: true } })).map((u) => u.id));
      for (const [id, m] of merged) {
        if (!known.has(id) || (!m.sec && !m.start && !m.pos)) continue;
        // where they are now (the game puts them back there next time: GET /me lastPos)
        const lastPos = m.pos ? { x: Math.round(m.pos.x * 100) / 100, z: Math.round(m.pos.z * 100) / 100, rot: Math.round(m.pos.rot * 100) / 100, at: Date.now() } : undefined;
        await prisma.$transaction([
          prisma.user.update({ where: { id }, data: { playSeconds: { increment: m.sec }, ...(lastPos ? { lastPos } : {}) } }),
          prisma.playDay.upsert({ where: { userId_day: { userId: id, day } }, create: { userId: id, day, seconds: m.sec, sessions: m.start }, update: { seconds: { increment: m.sec }, sessions: { increment: m.start } } }),
        ]);
      }
      return { ok: true };
    });

    /** Heat-map samples: add the counts to the cells (one statement per 2000 cells). */
    app.post('/internal/heat', async (req, reply) => {
      const body = HeatSchema.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: 'bad_request' });
      if (!dbOn) return { ok: true };
      // merge duplicate cells first (one INSERT … ON CONFLICT can't touch the same row twice)
      const merged = new Map<string, [string, number, number, number]>();
      for (const [h, cx, cz, n] of body.data.cells) {
        const k = `${new Date(h).toISOString()}|${cx}|${cz}`;
        const cur = merged.get(k);
        if (cur) cur[3] += n;
        else merged.set(k, [h, cx, cz, n]);
      }
      const rows = [...merged.values()];
      for (let i = 0; i < rows.length; i += 2000) {
        const chunk = rows.slice(i, i + 2000);
        const v = chunk.map((_, j) => `($${j * 4 + 1}::timestamp, $${j * 4 + 2}::int, $${j * 4 + 3}::int, $${j * 4 + 4}::int)`).join(',');
        const p = chunk.flatMap(([h, cx, cz, n]) => [new Date(h), cx, cz, n]);
        await prisma.$executeRawUnsafe(`INSERT INTO "HeatCell" ("hour","cx","cz","count") VALUES ${v} ON CONFLICT ("hour","cx","cz") DO UPDATE SET "count" = "HeatCell"."count" + EXCLUDED."count"`, ...p);
      }
      return { ok: true };
    });
  };
}
