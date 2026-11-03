import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { signToken as signShared, verifyToken as verifyShared } from '@es/shared/token';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from './env';

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

export const signToken = (userId: string) => signShared(env.AUTH_SECRET, userId, TOKEN_TTL_S);
export const verifyToken = (token: string) => verifyShared(env.AUTH_SECRET, token)?.sub ?? null;

declare module 'fastify' {
  interface FastifyRequest {
    /** Player id from a valid bearer token, if any. */
    authPlayerId: string | null;
  }
}

/** Reads `Authorization: Bearer <token>` on every request. */
export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('authPlayerId', null);
  app.addHook('onRequest', async (req) => {
    const h = req.headers.authorization;
    req.authPlayerId = h?.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  });
}

/** Identity for a request: the token wins; guests may still pass their anonymous id. */
export function playerIdFrom(req: FastifyRequest, fallback: unknown): string | null {
  if (req.authPlayerId) return req.authPlayerId;
  return typeof fallback === 'string' && fallback.length >= 8 && fallback.length <= 64 ? fallback : null;
}
