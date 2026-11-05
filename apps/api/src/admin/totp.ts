import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — what Google Authenticator, Authy, 1Password… use. */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function decode(secret: string): Buffer {
  let bits = '';
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(ch);
    if (v >= 0) bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', decode(secret)).update(msg).digest();
  const o = h[h.length - 1]! & 0xf;
  const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(n % 1_000_000).padStart(6, '0');
}

/** Accepts the current code and one step either side (clock drift). */
export function checkTotp(secret: string, code: unknown, now = Date.now()): boolean {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return false;
  const step = Math.floor(now / 30_000);
  const want = Buffer.from(code.trim());
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(totpAt(secret, step + d)), want));
}

export const otpauthUrl = (secret: string, account: string) => `otpauth://totp/${encodeURIComponent(`English Street Admin:${account}`)}?secret=${secret}&issuer=${encodeURIComponent('English Street')}`;
