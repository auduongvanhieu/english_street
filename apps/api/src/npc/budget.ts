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

  /** Bought NPC turns (💎, gems/core.ts): set when the database is on. */
  private bonus: { take(pid: string): Promise<boolean>; giveBack(pid: string): Promise<void>; count(pid: string): Promise<number> } | null = null;
  useBonusTurns(b: NonNullable<Budget['bonus']>) {
    this.bonus = b;
  }

  /**
   * Throws a 429 NpcError when a limit is reached. Past the free daily turns (or the free daily budget) a bought
   * turn is used: take it now (`consume`, give it back with giveBack() if the turn fails), or only check there is one.
   * Bought turns have their own budget on top of the free one (npcPaidDailyBudgetUsd).
   */
  async check(playerId: string, ip: string, consume = false): Promise<{ bonus: boolean }> {
    const [usd, player, perIp] = await this.counters.get(dayKey(), ['usd', `p:${playerId}`, `ip:${ip}`]);
    const free = setting('npcDailyTurnsPerPlayer');
    const freeBudget = usd! < setting('npcDailyBudgetUsd');
    if (freeBudget && player! < free && perIp! < free * 3) return { bonus: false };
    const why = freeBudget ? 'daily_quota_exhausted' : 'daily_budget_exhausted';
    if (!this.bonus || usd! >= setting('npcDailyBudgetUsd') + setting('npcPaidDailyBudgetUsd')) throw new NpcError(429, why);
    const ok = consume ? await this.bonus.take(playerId) : (await this.bonus.count(playerId)) > 0;
    if (!ok) throw new NpcError(429, why);
    return { bonus: consume };
  }
  async giveBack(playerId: string) {
    await this.bonus?.giveBack(playerId);
  }
  async bonusLeft(playerId: string) {
    return this.bonus ? this.bonus.count(playerId) : 0;
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
