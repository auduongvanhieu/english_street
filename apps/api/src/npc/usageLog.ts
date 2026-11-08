import { prisma } from '../plugins/prisma';
import { budget, costUsd } from './budget';

/** What a Claude call was for (admin "Claude AI" page). */
export type LlmPurpose = 'npc_turn' | 'pair_judge' | 'word_translate' | 'content_translate' | 'key_check';
export interface LlmTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** Usage of one Claude response, in our shape. */
export const tokensOf = (u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): LlmTokens => ({
  input: u.input_tokens,
  output: u.output_tokens,
  cacheRead: u.cache_read_input_tokens ?? 0,
  cacheWrite: u.cache_creation_input_tokens ?? 0,
});

/**
 * Count one Claude call: the daily spend ceiling (Redis, budget.ts) and the per-day log in Postgres (LlmUsage,
 * by purpose, detail and model). Fire and forget: a failed write never breaks the game.
 */
export function logLlmUsage(purpose: LlmPurpose, detail: string, model: string, t: LlmTokens) {
  budget.recordUsage(model, t);
  const usd = costUsd(model, t);
  const day = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const key = { day, purpose, detail: detail.slice(0, 120), model };
  void prisma.llmUsage
    .upsert({
      where: { day_purpose_detail_model: key },
      create: { ...key, requests: 1, ...t, usd },
      update: { requests: { increment: 1 }, input: { increment: t.input }, output: { increment: t.output }, cacheRead: { increment: t.cacheRead }, cacheWrite: { increment: t.cacheWrite }, usd: { increment: usd } },
    })
    .catch(() => undefined);
}
