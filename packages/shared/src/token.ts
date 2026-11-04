// (Node only) Small HMAC-SHA256 bearer tokens shared by the API and the game server.
import { createHmac, timingSafeEqual } from 'node:crypto';

const b64u = (s: string) => Buffer.from(s).toString('base64url');

function sign(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** `sub` identifies the holder (a user id, or "beta" for an invite pass); `ttlSec` is the lifetime. */
export function signToken(secret: string, sub: string, ttlSec: number, extra: Record<string, unknown> = {}): string {
  const payload = b64u(JSON.stringify({ ...extra, sub, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  return `${payload}.${sign(secret, payload)}`;
}

/** Returns the token claims when the signature is valid and it has not expired, else null. */
export function verifyToken(secret: string, token: unknown): { sub: string; exp: number; [k: string]: unknown } | null {
  if (typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(secret, payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number };
    return typeof claims.sub === 'string' && claims.exp > Date.now() / 1000 ? claims : null;
  } catch {
    return null;
  }
}

/** Invite passes for the closed beta: minted when a player enters a valid code. */
export const BETA_PASS_TTL_S = 90 * 24 * 3600;
export const isBetaPass = (secret: string, token: unknown) => verifyToken(secret, token)?.sub === 'beta';

/** Human pass: minted by POST /auth/guest after a captcha, lets a guest join the street and use the API. */
export const HUMAN_PASS_TTL_S = 30 * 24 * 3600;
export const isHumanPass = (secret: string, token: unknown) => verifyToken(secret, token)?.sub === 'human';
