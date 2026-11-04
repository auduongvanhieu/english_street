import { randomBytes, randomInt } from 'node:crypto';
import type Redis from 'ioredis';

/**
 * Image captcha for sign-in / sign-up, made here (no third-party service).
 *
 * The SVG holds only stroked paths drawn from a tiny built-in stroke font, never <text>, so the answer is
 * not in the markup. Every glyph is jittered, rotated, scaled and overlaid with noise curves. A challenge
 * lives 5 minutes and can be checked once (right or wrong), so it cannot be replayed or brute-forced.
 */

/** Unambiguous characters only (no 0/O, 1/I/L, S/5…). */
const CHARS = 'ABCDEFGHJKMNPRTUVWXYZ2346789';

/** Stroke font on a 4 × 6 grid (y down): strokes separated by "|", points by spaces. */
const GLYPHS: Record<string, string> = {
  A: '0,6 2,0 4,6|1,3.6 3,3.6',
  B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|0,0 3,0 4,1 4,2 3,3',
  C: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5',
  D: '0,0 0,6 2.5,6 4,4.5 4,1.5 2.5,0 0,0',
  E: '4,0 0,0 0,6 4,6|0,3 3,3',
  F: '4,0 0,0 0,6|0,3 3,3',
  G: '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3.5 2.5,3.5',
  H: '0,0 0,6|4,0 4,6|0,3 4,3',
  J: '4,0 4,5 3,6 1,6 0,5',
  K: '0,0 0,6|4,0 0,3.5|1.3,2.7 4,6',
  M: '0,6 0,0 2,3 4,0 4,6',
  N: '0,6 0,0 4,6 4,0',
  P: '0,6 0,0 3,0 4,1 4,2 3,3 0,3',
  R: '0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6',
  T: '0,0 4,0|2,0 2,6',
  U: '0,0 0,5 1,6 3,6 4,5 4,0',
  V: '0,0 2,6 4,0',
  W: '0,0 1,6 2,3 3,6 4,0',
  X: '0,0 4,6|4,0 0,6',
  Y: '0,0 2,3 4,0|2,3 2,6',
  Z: '0,0 4,0 0,6 4,6',
  '2': '0,1 1,0 3,0 4,1 4,2 0,6 4,6',
  '3': '0,1 1,0 3,0 4,1 4,2 3,3 4,4 4,5 3,6 1,6 0,5|1.5,3 3,3',
  '4': '3,6 3,0 0,4 4,4',
  '6': '4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,4 3,3 0,3',
  '7': '0,0 4,0 1.5,6',
  '8': '1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3 1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3',
  '9': '0,5 1,6 3,6 4,5 4,1 3,0 1,0 0,1 0,2 1,3 4,3',
};

const LEN = 5;
const W = 170;
const H = 60;
const TTL_SEC = 300;
const COLORS = ['#1d4ed8', '#7c3aed', '#be185d', '#b45309', '#047857', '#0f172a', '#9a3412'];

const rnd = (a: number, b: number) => a + (randomInt(0, 1_000_000) / 1_000_000) * (b - a);
const pick = <T>(xs: readonly T[]) => xs[randomInt(0, xs.length)]!;
const f = (n: number) => n.toFixed(1);

function glyphPath(ch: string, cx: number, cy: number): string {
  const sx = rnd(4.2, 5.4);
  const sy = rnd(6, 7.4);
  const rot = rnd(-0.4, 0.4);
  const skew = rnd(-0.25, 0.25);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return GLYPHS[ch]!.split('|')
    .map((stroke) =>
      stroke
        .split(' ')
        .map((pt, i) => {
          const [gx, gy] = pt.split(',').map(Number) as [number, number];
          // centre the 4 × 6 grid, scale, skew, rotate, then jitter each point a little
          const x = (gx - 2) * sx + (gy - 3) * skew * sx;
          const y = (gy - 3) * sy;
          const px = cx + x * cos - y * sin + rnd(-1.1, 1.1);
          const py = cy + x * sin + y * cos + rnd(-1.1, 1.1);
          return `${i ? 'L' : 'M'}${f(px)} ${f(py)}`;
        })
        .join(''),
    )
    .join('');
}

/** Render a challenge text as an SVG string. */
export function renderCaptcha(text: string): string {
  const parts: string[] = [];
  // background noise: soft curves and dots
  for (let i = 0; i < 4; i++) {
    parts.push(
      `<path d="M${f(rnd(0, 20))} ${f(rnd(5, H - 5))}C${f(rnd(30, 70))} ${f(rnd(0, H))} ${f(rnd(90, 140))} ${f(rnd(0, H))} ${f(rnd(150, W))} ${f(rnd(5, H - 5))}" stroke="${pick(COLORS)}" stroke-opacity="0.35" stroke-width="${f(rnd(1, 2))}" fill="none"/>`,
    );
  }
  for (let i = 0; i < 40; i++)
    parts.push(
      `<circle cx="${f(rnd(0, W))}" cy="${f(rnd(0, H))}" r="${f(rnd(0.6, 1.6))}" fill="${pick(COLORS)}" fill-opacity="0.45"/>`,
    );
  const step = (W - 30) / LEN;
  [...text].forEach((ch, i) => {
    const cx = 15 + step * (i + 0.5) + rnd(-3, 3);
    const cy = H / 2 + rnd(-4, 4);
    parts.push(
      `<path d="${glyphPath(ch, cx, cy)}" stroke="${pick(COLORS)}" stroke-width="${f(rnd(2.6, 3.6))}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    );
  });
  // two strike-through curves on top
  for (let i = 0; i < 2; i++) {
    parts.push(
      `<path d="M0 ${f(rnd(15, H - 15))}Q${f(rnd(50, 120))} ${f(rnd(-10, H + 10))} ${W} ${f(rnd(15, H - 15))}" stroke="${pick(COLORS)}" stroke-opacity="0.6" stroke-width="1.6" fill="none"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="8" fill="#f8fafc"/>${parts.join('')}</svg>`;
}

/** Challenge store: Redis when available (shared by all instances), memory otherwise. */
class CaptchaStore {
  private redis: Redis | null = null;
  private mem = new Map<string, { answer: string; exp: number }>();

  useRedis(redis: Redis | null) {
    this.redis = redis;
  }

  async create(): Promise<{ id: string; svg: string }> {
    const answer = Array.from({ length: LEN }, () => pick([...CHARS])).join('');
    const id = randomBytes(16).toString('hex');
    if (this.redis) await this.redis.set(`captcha:${id}`, answer, 'EX', TTL_SEC);
    else {
      const now = Date.now();
      if (this.mem.size > 5000) for (const [k, v] of this.mem) if (v.exp < now) this.mem.delete(k);
      this.mem.set(id, { answer, exp: now + TTL_SEC * 1000 });
    }
    return { id, svg: renderCaptcha(answer) };
  }

  /** One check per challenge: it is deleted whether the answer is right or wrong. */
  async verify(id: unknown, answer: unknown): Promise<boolean> {
    if (typeof id !== 'string' || typeof answer !== 'string' || !/^[0-9a-f]{32}$/.test(id))
      return false;
    let want: string | null = null;
    if (this.redis) {
      const k = `captcha:${id}`;
      const [[, v]] = (await this.redis.multi().get(k).del(k).exec()) as [
        [null, string | null],
        unknown,
      ];
      want = v;
    } else {
      const v = this.mem.get(id);
      this.mem.delete(id);
      want = v && v.exp > Date.now() ? v.answer : null;
    }
    return !!want && want === answer.trim().toUpperCase().replace(/\s+/g, '');
  }
}

export const captcha = new CaptchaStore();

/** Cloudflare Turnstile server-side check (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). */
export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Human check for sign-in / sign-up: a Turnstile token when Turnstile is configured, else (or when the
 * Turnstile script could not load on the player's network) a built-in image captcha answer.
 */
export async function humanCheck(
  body: { turnstileToken?: string; captchaId?: string; captchaAnswer?: string },
  ip: string,
  secret: string,
): Promise<boolean> {
  if (body.turnstileToken && secret) return verifyTurnstile(secret, body.turnstileToken, ip);
  return captcha.verify(body.captchaId, body.captchaAnswer);
}
