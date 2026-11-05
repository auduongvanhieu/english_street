import type Redis from 'ioredis';
import { setting } from '../settings';
import { env } from '../env';
import { NpcError } from './service';

/** USD per million tokens: input, output, cache read, cache write (5-minute). */
const PRICES: Record<string, [number, number, number, number]> = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
};

export function costUsd(model: string, u: { input: number; output: number; cacheRead: number; cacheWrite: number }) {
  const [pi, po, pr, pw] = PRICES[model] ?? PRICES['claude-opus-5-5']!;
  return (u.input * pi + u.output * po + u.cacheRead * pr + u.cacheWrite * pw) / 1e6;
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Daily counters: per player, per client IP, global turns and global estimated spend. */
interface Counters {
  get(day: string, keys: string[]): Promise<number[]>;
  incr(day: string, key: string, by: number): Promise<void>;
}

class MemoryCounters implements Counters {
  private day = '';
  private map = new Map<string, number>();
  private roll(day: string) {
    if (day !== this.day) {
      this.day = day;
      this.map.clear();
    }
  }
  async get(day: string, keys: string[]) {
    this.roll(day);
    return keys.map((k) => this.map.get(k) ?? 0);
  }
  async incr(day: string, key: string, by: number) {
    this.roll(day);
    this.map.set(key, (this.map.get(key) ?? 0) + by);
  }
}

/** Shared across API instances; keys expire after two days. */
class RedisCounters implements Counters {
  constructor(private redis: Redis) {}
  private k = (day: string, key: string) => `budget:${day}:${key}`;
  async get(day: string, keys: string[]) {
    const vals = await this.redis.mget(keys.map((k) => this.k(day, k)));
    return vals.map((v) => Number(v ?? 0));
  }
  async incr(day: string, key: string, by: number) {
    const k = this.k(day, key);
    await this.redis.multi().incrbyfloat(k, by).expire(k, 2 * 86_400).exec();
  }
}

/**
 * Anti-burn limits, per calendar day (UTC):
 *  - NPC turns per player, also per client IP (guests can mint ids)
 *  - global estimated spend
 */
class Budget {
  private counters: Counters = new MemoryCounters();
  backend = 'memory';

  useRedis(redis: Redis | null) {
    if (!redis) return;
    this.counters = new RedisCounters(redis);
    this.backend = 'redis';
  }

  /** Throws a 429 NpcError when a limit is reached. */
  async check(playerId: string, ip: string) {
    const [usd, player, perIp] = await this.counters.get(dayKey(), ['usd', `p:${playerId}`, `ip:${ip}`]);
    if (usd! >= setting('npcDailyBudgetUsd')) throw new NpcError(429, 'daily_budget_exhausted');
    if (player! >= setting('npcDailyTurnsPerPlayer')) throw new NpcError(429, 'daily_quota_exhausted');
    if (perIp! >= setting('npcDailyTurnsPerPlayer') * 3) throw new NpcError(429, 'daily_quota_exhausted');
  }

  async recordTurn(playerId: string, ip: string) {
    const day = dayKey();
    await Promise.all([this.counters.incr(day, `p:${playerId}`, 1), this.counters.incr(day, `ip:${ip}`, 1), this.counters.incr(day, 'turns', 1)]);
  }

  /** Fire-and-forget from the LLM client. */
  recordUsage(model: string, u: { input: number; output: number; cacheRead: number; cacheWrite: number }) {
    void this.counters.incr(dayKey(), 'usd', costUsd(model, u)).catch(() => undefined);
  }

  async remainingFor(playerId: string) {
    const [n] = await this.counters.get(dayKey(), [`p:${playerId}`]);
    return Math.max(0, setting('npcDailyTurnsPerPlayer') - n!);
  }

  async snapshot() {
    const day = dayKey();
    const [usd, turns] = await this.counters.get(day, ['usd', 'turns']);
    return { day, backend: this.backend, spentUsd: Number(usd!.toFixed(4)), budgetUsd: setting('npcDailyBudgetUsd'), turnsToday: turns };
  }
}

export const budget = new Budget();
