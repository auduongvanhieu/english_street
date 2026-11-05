import { prisma } from './plugins/prisma';

/** What the API and the game server need to know about an account on every request / join. */
export interface UserStatus {
  role: 'player' | 'editor' | 'admin';
  bannedUntil: Date | null;
  banReason: string;
  mutedUntil: Date | null;
  tokenVersion: number;
}

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; s: UserStatus | null }>();
let enabled = false;

/** Status lookups need Postgres; with the in-memory repo everyone is a plain, unbanned player. */
export function enableModeration(on: boolean) {
  enabled = on;
}

export async function userStatus(id: string, fresh = false): Promise<UserStatus | null> {
  if (!enabled) return null;
  const hit = cache.get(id);
  if (!fresh && hit && Date.now() - hit.at < TTL_MS) return hit.s;
  const u = await prisma.user.findUnique({ where: { id }, select: { role: true, bannedUntil: true, banReason: true, mutedUntil: true, tokenVersion: true } });
  const s = u ? (u as UserStatus) : null;
  cache.set(id, { at: Date.now(), s });
  if (cache.size > 20_000) cache.delete(cache.keys().next().value!);
  return s;
}
export const forgetStatus = (id: string) => cache.delete(id);

export const isBanned = (s: UserStatus | null) => !!s?.bannedUntil && s.bannedUntil.getTime() > Date.now();
export const isMuted = (s: UserStatus | null) => !!s?.mutedUntil && s.mutedUntil.getTime() > Date.now();
