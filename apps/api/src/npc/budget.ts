import { env } from '../env';
import { NpcError } from './service';

/** USD per million tokens: input, output, cache read, cache write (5-minute). */
const PRICES: Record<string, [number, number, number, number]> = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
};

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily anti-burn limits kept in memory (per API instance):
 *  - NPC turns per player per day, also per client IP (guests can mint ids)
 *  - global estimated spend per day
 */
class Budget {
  private day = dayKey();
  private perPlayer = new Map<string, number>();
  private perIp = new Map<string, number>();
  spentUsd = 0;
  turnsToday = 0;

  private roll() {
    const k = dayKey();
    if (k !== this.day) {
      this.day = k;
      this.perPlayer.clear();
      this.perIp.clear();
      this.spentUsd = 0;
      this.turnsToday = 0;
    }
  }

  /** Throws a 429 NpcError when a limit is reached. */
  check(playerId: string, ip: string) {
    this.roll();
    if (this.spentUsd >= env.NPC_DAILY_BUDGET_USD) throw new NpcError(429, 'daily_budget_exhausted');
    if ((this.perPlayer.get(playerId) ?? 0) >= env.NPC_DAILY_TURNS_PER_PLAYER) throw new NpcError(429, 'daily_quota_exhausted');
    if ((this.perIp.get(ip) ?? 0) >= env.NPC_DAILY_TURNS_PER_PLAYER * 3) throw new NpcError(429, 'daily_quota_exhausted');
  }

  recordTurn(playerId: string, ip: string) {
    this.roll();
    this.perPlayer.set(playerId, (this.perPlayer.get(playerId) ?? 0) + 1);
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
    this.turnsToday += 1;
  }

  recordUsage(model: string, u: { input: number; output: number; cacheRead: number; cacheWrite: number }) {
    this.roll();
    const [pi, po, pr, pw] = PRICES[model] ?? PRICES['claude-opus-5-5']!;
    this.spentUsd += (u.input * pi + u.output * po + u.cacheRead * pr + u.cacheWrite * pw) / 1e6;
  }

  remainingFor(playerId: string) {
    this.roll();
    return Math.max(0, env.NPC_DAILY_TURNS_PER_PLAYER - (this.perPlayer.get(playerId) ?? 0));
  }

  snapshot() {
    this.roll();
    return { day: this.day, spentUsd: Number(this.spentUsd.toFixed(4)), budgetUsd: env.NPC_DAILY_BUDGET_USD, turnsToday: this.turnsToday };
  }
}

export const budget = new Budget();
