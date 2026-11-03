import type Redis from 'ioredis';
import { env } from '../env';

/**
 * Fixed-window per-key rate limiter (e.g. NPC turns per player per minute, login attempts per IP).
 * Memory on a single instance; Redis when available so all instances share the window.
 */
class RateLimiter {
  private redis: Redis | null = null;
  private windows = new Map<string, { n: number; exp: number }>();

  useRedis(redis: Redis | null) {
    this.redis = redis;
  }

  /** True when the call is allowed (counter below `limit` within a `windowSec` window). */
  async allow(key: string, limit: number, windowSec = 60): Promise<boolean> {
    const slot = Math.floor(Date.now() / (windowSec * 1000));
    const k = `rl:${key}:${slot}`;
    if (this.redis) {
      const [[, n]] = (await this.redis.multi().incr(k).expire(k, windowSec + 1).exec()) as [[null, number], unknown];
      return n <= limit;
    }
    const now = Date.now();
    let w = this.windows.get(k);
    if (!w) {
      w = { n: 0, exp: now + windowSec * 1000 };
      this.windows.set(k, w);
      if (this.windows.size > 10_000) for (const [kk, v] of this.windows) if (v.exp < now) this.windows.delete(kk);
    }
    w.n += 1;
    return w.n <= limit;
  }
}

export const limiter = new RateLimiter();
/** NPC turns per player per minute. */
export const allowTurn = (playerId: string) => limiter.allow(`turn:${playerId}`, env.NPC_RATE_PER_MIN);
/** Login / register attempts per IP per minute. */
export const allowAuth = (ip: string) => limiter.allow(`auth:${ip}`, 10);
/** Client analytics + feedback posts per IP per minute. */
export const allowTelemetry = (ip: string) => limiter.allow(`tel:${ip}`, 30);
