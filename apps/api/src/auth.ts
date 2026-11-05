import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { signToken as signShared, verifyToken as verifyShared } from '@es/shared/token';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from './env';
import { isBanned, userStatus } from './moderation';

const scrypt = promisify(scryptCb) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const TOKEN_TTL_S = 30 * 24 * 3600;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(pw, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const key = await scrypt(pw, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Sign-in token; `v` = the account's tokenVersion (bumping it signs the account out everywhere). */
export const signToken = (userId: string, v = 0) => signShared(env.AUTH_SECRET, userId, TOKEN_TTL_S, { v });
/** Claims of a sign-in token (beta / human passes are not accounts). */
export const tokenClaims = (token: string) => {
  const c = verifyShared(env.AUTH_SECRET, token);
  // beta / human passes and short-lived tickets ("cap:…") are not accounts
  return c && c.sub !== 'beta' && c.sub !== 'human' && !c.sub.includes(':') ? c : null;
};
/** User id of a sign-in token. */
export const verifyToken = (token: string) => tokenClaims(token)?.sub ?? null;

declare module 'fastify' {
  interface FastifyRequest {
    /** Player id from a valid bearer token, if any. */
    authPlayerId: string | null;
  }
}

/** Reads `Authorization: Bearer <token>` on every request (signed-out tokens are ignored). */
export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('authPlayerId', null);
  app.addHook('onRequest', async (req) => {
    const h = req.headers.authorization;
    const c = h?.startsWith('Bearer ') ? tokenClaims(h.slice(7)) : null;
    req.authPlayerId = null;
    if (!c) return;
    const s = await userStatus(c.sub).catch(() => null);
    if (s && Number(c.v ?? 0) !== s.tokenVersion) return; // signed out by an admin
    req.authPlayerId = c.sub;
  });
  // Banned players (signed in, or guests by their id) can still read but not write.
  app.addHook('preHandler', async (req, reply) => {
    if (req.method === 'GET' || req.url.startsWith('/admin')) return;
    const id = req.authPlayerId ?? (req.body as { playerId?: unknown } | undefined)?.playerId ?? (req.query as { playerId?: unknown } | undefined)?.playerId;
    if (typeof id !== 'string' || id.length < 8 || id.length > 64) return;
    const s = await userStatus(id).catch(() => null);
    if (isBanned(s)) return reply.code(403).send({ error: 'account_banned', until: s!.bannedUntil, reason: s!.banReason });
  });
}

/** Identity for a request: the token wins; guests may still pass their anonymous id. */
export function playerIdFrom(req: FastifyRequest, fallback: unknown): string | null {
  if (req.authPlayerId) return req.authPlayerId;
  return typeof fallback === 'string' && fallback.length >= 8 && fallback.length <= 64 ? fallback : null;
}
