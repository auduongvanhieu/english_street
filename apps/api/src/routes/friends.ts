import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FRIENDS_MAX, type FriendList } from '@es/shared';
import { playerIdFrom } from '../auth';
import { limiter } from '../npc/ratelimit';
import { friendListFor, friendRepo, pair } from '../friends';

/**
 * Friend lists for accounts and guests (same identity rules as the rest of the API: the token wins, guests pass
 * their anonymous player id). The game server pings the other player live; this is the source of truth.
 *
 *   GET  /friends?playerId=            -> FriendList
 *   POST /friends/request  { to, toName, myName }      -> { status: 'pending' | 'friends' }
 *   POST /friends/respond  { from, accept, myName }    -> { status: 'friends' | 'declined' }
 *   POST /friends/remove   { pid }                     -> { ok }
 */
const Id = z.string().min(8).max(64);
const Name = z
  .string()
  .max(40)
  .transform((s) => s.trim().slice(0, 32));

export async function friendRoutes(app: FastifyInstance) {
  const me = (req: Parameters<typeof playerIdFrom>[0], body: unknown) =>
    playerIdFrom(req, (body as { playerId?: unknown } | undefined)?.playerId);

  app.get('/friends', async (req, reply) => {
    const pid = playerIdFrom(req, (req.query as { playerId?: unknown }).playerId);
    if (!pid) return reply.code(401).send({ error: 'unauthorized' });
    return friendListFor(pid, await friendRepo().listFor(pid)) satisfies FriendList;
  });

  app.post('/friends/request', async (req, reply) => {
    const pid = me(req, req.body);
    const body = z.object({ to: Id, toName: Name, myName: Name }).safeParse(req.body);
    if (!pid) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success || body.data.to === pid)
      return reply.code(400).send({ error: 'bad_request' });
    if (!(await limiter.allow(`friendreq:${pid}`, 30, 3600)))
      return reply.code(429).send({ error: 'rate_limited' });
    const { to, toName, myName } = body.data;
    const repo = friendRepo();
    const row = await repo.get(pid, to);
    const [a, b] = pair(pid, to);
    const names = { aName: a === pid ? myName : toName, bName: b === pid ? myName : toName };
    if (row?.status === 'accepted') return { status: 'friends' };
    // they already asked me: asking back means yes
    if (row && row.requester === to) {
      await repo.upsert({ aId: a, bId: b, ...names, requester: row.requester, status: 'accepted' });
      return { status: 'friends' };
    }
    if (!row && (await repo.listFor(pid)).length >= FRIENDS_MAX)
      return reply.code(409).send({ error: 'too_many_friends' });
    await repo.upsert({ aId: a, bId: b, ...names, requester: pid, status: 'pending' });
    return { status: 'pending' };
  });

  app.post('/friends/respond', async (req, reply) => {
    const pid = me(req, req.body);
    const body = z.object({ from: Id, accept: z.boolean(), myName: Name }).safeParse(req.body);
    if (!pid) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    const repo = friendRepo();
    const row = await repo.get(pid, body.data.from);
    if (!row || row.status !== 'pending' || row.requester !== body.data.from)
      return reply.code(404).send({ error: 'no_request' });
    if (!body.data.accept) {
      await repo.remove(pid, body.data.from);
      return { status: 'declined' };
    }
    if ((await repo.listFor(pid)).filter((r) => r.status === 'accepted').length >= FRIENDS_MAX)
      return reply.code(409).send({ error: 'too_many_friends' });
    const mine =
      row.aId === pid
        ? { aName: body.data.myName || row.aName }
        : { bName: body.data.myName || row.bName };
    await repo.upsert({ ...row, ...mine, status: 'accepted' });
    return { status: 'friends' };
  });

  app.post('/friends/remove', async (req, reply) => {
    const pid = me(req, req.body);
    const body = z.object({ pid: Id }).safeParse(req.body);
    if (!pid) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    await friendRepo().remove(pid, body.data.pid);
    return { ok: true };
  });
}
