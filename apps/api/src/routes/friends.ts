import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FRIEND_MSG_MAX, FRIENDS_MAX, maskProfanity, type FriendList, type FriendMessage } from '@es/shared';
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
 *   GET  /friends/messages?with=<pid>                  -> { messages: FriendMessage[] } (marks them read)
 *   POST /friends/messages { to, text }                -> { message: FriendMessage }   (friends only, online or not)
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
    const repo = friendRepo();
    const [rows, unread] = await Promise.all([repo.listFor(pid), repo.unread(pid)]);
    const list: FriendList = friendListFor(pid, rows);
    // only messages from current friends count (a removed friend's old messages stay unread, unseen)
    const friends = new Set(list.friends.map((f) => f.pid));
    list.unread = Object.fromEntries(Object.entries(unread).filter(([k]) => friends.has(k)));
    return list;
  });

  app.get('/friends/messages', async (req, reply) => {
    const q = req.query as { playerId?: unknown; with?: unknown };
    const pid = playerIdFrom(req, q.playerId);
    if (!pid) return reply.code(401).send({ error: 'unauthorized' });
    const other = Id.safeParse(q.with);
    if (!other.success) return reply.code(400).send({ error: 'bad_request' });
    const row = await friendRepo().get(pid, other.data);
    if (row?.status !== 'accepted') return reply.code(403).send({ error: 'not_friends' });
    return { messages: await friendRepo().thread(pid, other.data, 100) } satisfies { messages: FriendMessage[] };
  });

  app.post('/friends/messages', async (req, reply) => {
    const pid = me(req, req.body);
    const body = z.object({ to: Id, text: z.string().max(FRIEND_MSG_MAX * 2) }).safeParse(req.body);
    if (!pid) return reply.code(401).send({ error: 'unauthorized' });
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    const text = maskProfanity(body.data.text.trim().slice(0, FRIEND_MSG_MAX));
    if (!text) return reply.code(400).send({ error: 'bad_request' });
    const row = await friendRepo().get(pid, body.data.to);
    if (row?.status !== 'accepted') return reply.code(403).send({ error: 'not_friends' });
    if (!(await limiter.allow(`friendmsg:${pid}`, 20, 60)) || !(await limiter.allow(`friendmsgday:${pid}`, 500, 86400)))
      return reply.code(429).send({ error: 'rate_limited' });
    return { message: await friendRepo().addMessage(pid, body.data.to, text) } satisfies { message: FriendMessage };
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
