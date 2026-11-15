import { FRIEND_MSG_KEEP, type FriendEntry, type FriendList, type FriendMessage } from '@es/shared';
import { prisma } from './plugins/prisma';

/**
 * Friend lists. One row per pair (aId < bId), pending until the other player accepts. Ids are account ids or
 * guest player ids (no foreign keys: a guest may not have a User row). Names are the display names at the time.
 */
export interface FriendRow {
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  requester: string;
  status: 'pending' | 'accepted';
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendRepo {
  get(a: string, b: string): Promise<FriendRow | null>;
  /** All rows that involve this player. */
  listFor(id: string): Promise<FriendRow[]>;
  upsert(row: Omit<FriendRow, 'createdAt' | 'updatedAt'>): Promise<void>;
  remove(a: string, b: string): Promise<void>;
  /** A guest signed up: their friendships (and friend messages) move to the new account id. */
  transfer(from: string, to: string): Promise<void>;
  /** Store a message (and drop the oldest ones past FRIEND_MSG_KEEP for this pair). */
  addMessage(from: string, to: string, text: string): Promise<FriendMessage>;
  /** Newest `limit` messages between two players, oldest first; marks the ones sent to `me` as read. */
  thread(me: string, other: string, limit: number): Promise<FriendMessage[]>;
  /** Unread messages sent to this player, by sender. */
  unread(me: string): Promise<Record<string, number>>;
}

export interface MsgRow {
  id: string;
  fromId: string;
  toId: string;
  text: string;
  createdAt: Date;
  readAt: Date | null;
}
const toMsg = (m: MsgRow): FriendMessage => ({ id: m.id, from: m.fromId, text: m.text, at: m.createdAt.toISOString(), read: !!m.readAt });

/** Order a pair the way rows store it. */
export const pair = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

/** Rows -> the list one player sees. */
export function friendListFor(id: string, rows: FriendRow[]): FriendList {
  const out: FriendList = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const other: FriendEntry =
      r.aId === id
        ? { pid: r.bId, name: r.bName, since: r.updatedAt.toISOString() }
        : { pid: r.aId, name: r.aName, since: r.updatedAt.toISOString() };
    if (r.status === 'accepted') out.friends.push(other);
    else if (r.requester === id) out.outgoing.push(other);
    else out.incoming.push(other);
  }
  out.friends.sort((x, y) => x.name.localeCompare(y.name));
  return out;
}

export class MemoryFriendRepo implements FriendRepo {
  private rows = new Map<string, FriendRow>();
  private msgs: MsgRow[] = [];
  private n = 0;
  async addMessage(from: string, to: string, text: string) {
    const m: MsgRow = { id: `m${++this.n}`, fromId: from, toId: to, text, createdAt: new Date(), readAt: null };
    this.msgs.push(m);
    const k = this.key(from, to);
    const mine = this.msgs.filter((x) => this.key(x.fromId, x.toId) === k);
    if (mine.length > FRIEND_MSG_KEEP) {
      const drop = new Set(mine.slice(0, mine.length - FRIEND_MSG_KEEP));
      this.msgs = this.msgs.filter((x) => !drop.has(x));
    }
    return toMsg(m);
  }
  async thread(me: string, other: string, limit: number) {
    const k = this.key(me, other);
    const rows = this.msgs.filter((x) => this.key(x.fromId, x.toId) === k).slice(-limit);
    const out = rows.map(toMsg);
    for (const r of rows) if (r.toId === me && !r.readAt) r.readAt = new Date();
    return out;
  }
  async unread(me: string) {
    const out: Record<string, number> = {};
    for (const m of this.msgs) if (m.toId === me && !m.readAt) out[m.fromId] = (out[m.fromId] ?? 0) + 1;
    return out;
  }
  private key = (a: string, b: string) => pair(a, b).join('|');
  async get(a: string, b: string) {
    return this.rows.get(this.key(a, b)) ?? null;
  }
  async listFor(id: string) {
    return [...this.rows.values()].filter((r) => r.aId === id || r.bId === id);
  }
  async upsert(row: Omit<FriendRow, 'createdAt' | 'updatedAt'>) {
    const k = this.key(row.aId, row.bId);
    const old = this.rows.get(k);
    this.rows.set(k, { ...row, createdAt: old?.createdAt ?? new Date(), updatedAt: new Date() });
  }
  async remove(a: string, b: string) {
    this.rows.delete(this.key(a, b));
  }
  async transfer(from: string, to: string) {
    for (const m of this.msgs) {
      if (m.fromId === from) m.fromId = to;
      if (m.toId === from) m.toId = to;
    }
    for (const r of await this.listFor(from)) {
      this.rows.delete(this.key(r.aId, r.bId));
      const other = r.aId === from ? r.bId : r.aId;
      const otherName = r.aId === from ? r.bName : r.aName;
      const myName = r.aId === from ? r.aName : r.bName;
      if (other === to) continue;
      const [a, b] = pair(to, other);
      await this.upsert({
        aId: a,
        bId: b,
        aName: a === to ? myName : otherName,
        bName: b === to ? myName : otherName,
        requester: r.requester === from ? to : r.requester,
        status: r.status,
      });
    }
  }
}

export class PrismaFriendRepo implements FriendRepo {
  async get(a: string, b: string) {
    const [x, y] = pair(a, b);
    return (await prisma.friendship.findUnique({
      where: { aId_bId: { aId: x, bId: y } },
    })) as FriendRow | null;
  }
  async listFor(id: string) {
    return (await prisma.friendship.findMany({
      where: { OR: [{ aId: id }, { bId: id }] },
      take: 500,
    })) as FriendRow[];
  }
  async upsert(row: Omit<FriendRow, 'createdAt' | 'updatedAt'>) {
    await prisma.friendship.upsert({
      where: { aId_bId: { aId: row.aId, bId: row.bId } },
      create: row,
      update: row,
    });
  }
  async remove(a: string, b: string) {
    const [x, y] = pair(a, b);
    await prisma.friendship.deleteMany({ where: { aId: x, bId: y } });
  }
  async addMessage(from: string, to: string, text: string) {
    const m = await prisma.friendMessage.create({ data: { fromId: from, toId: to, text } });
    const pairWhere = { OR: [{ fromId: from, toId: to }, { fromId: to, toId: from }] };
    const old = await prisma.friendMessage.findMany({
      where: pairWhere,
      orderBy: { createdAt: 'desc' },
      skip: FRIEND_MSG_KEEP,
      select: { id: true },
      take: 100,
    });
    if (old.length) await prisma.friendMessage.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return toMsg(m);
  }
  async thread(me: string, other: string, limit: number) {
    const rows = await prisma.friendMessage.findMany({
      where: { OR: [{ fromId: me, toId: other }, { fromId: other, toId: me }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const out = rows.reverse().map(toMsg);
    if (rows.some((r) => r.toId === me && !r.readAt))
      await prisma.friendMessage.updateMany({ where: { fromId: other, toId: me, readAt: null }, data: { readAt: new Date() } });
    return out;
  }
  async unread(me: string) {
    const g = await prisma.friendMessage.groupBy({ by: ['fromId'], where: { toId: me, readAt: null }, _count: { _all: true } });
    return Object.fromEntries(g.map((x) => [x.fromId, x._count._all]));
  }
  async transfer(from: string, to: string) {
    await prisma.friendMessage.updateMany({ where: { fromId: from }, data: { fromId: to } });
    await prisma.friendMessage.updateMany({ where: { toId: from }, data: { toId: to } });
    const rows = await this.listFor(from);
    for (const r of rows) {
      await this.remove(r.aId, r.bId);
      const other = r.aId === from ? r.bId : r.aId;
      if (other === to) continue;
      const otherName = r.aId === from ? r.bName : r.aName;
      const myName = r.aId === from ? r.aName : r.bName;
      const [a, b] = pair(to, other);
      await this.upsert({
        aId: a,
        bId: b,
        aName: a === to ? myName : otherName,
        bName: b === to ? myName : otherName,
        requester: r.requester === from ? to : r.requester,
        status: r.status,
      });
    }
  }
}

let repo: FriendRepo = new MemoryFriendRepo();
/** Chosen at start-up with the attempts repo (Postgres when the database is up). */
export const setFriendRepo = (r: FriendRepo) => (repo = r);
export const friendRepo = () => repo;
