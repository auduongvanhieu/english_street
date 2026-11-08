import Anthropic from '@anthropic-ai/sdk';
import type { FastifyInstance } from 'fastify';
import { env, hasRealApiKey } from '../env';
import { prisma } from '../plugins/prisma';
import { setting } from '../settings';
import { budget } from '../npc/budget';
import { logLlmUsage, tokensOf } from '../npc/usageLog';
import { audit } from './core';

const vnDay = (ms = Date.now()) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);
type Sum = { requests: number; input: number; output: number; cacheRead: number; cacheWrite: number; usd: number };
const zero = (): Sum => ({ requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 });
const add = (a: Sum, b: Sum) => {
  a.requests += b.requests;
  a.input += b.input;
  a.output += b.output;
  a.cacheRead += b.cacheRead;
  a.cacheWrite += b.cacheWrite;
  a.usd += b.usd;
};

/**
 * Admin "Claude AI": what the Claude API cost (LlmUsage, per Vietnam day, by purpose / NPC+quest / model) and a
 * check that the key still works (one tiny request: catches a revoked key or an empty credit balance).
 */
export function adminLlmRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { days?: string } }>('/admin/llm-usage', async (req) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const from = vnDay(Date.now() - (days - 1) * 86_400_000);
    const [rows, all, today] = await Promise.all([
      prisma.llmUsage.findMany({ where: { day: { gte: from } } }),
      prisma.llmUsage.aggregate({ _sum: { usd: true, requests: true }, _min: { day: true } }),
      budget.snapshot(),
    ]);
    const total = zero();
    const byDay = new Map<string, Sum>();
    const byPurpose = new Map<string, Sum>();
    const byDetail = new Map<string, Sum & { purpose: string }>();
    const byModel = new Map<string, Sum>();
    const bump = <T extends Sum>(m: Map<string, T>, k: string, r: Sum, init: () => T) => {
      if (!m.has(k)) m.set(k, init());
      add(m.get(k)!, r);
    };
    for (const r of rows) {
      add(total, r);
      bump(byDay, r.day, r, zero);
      bump(byPurpose, r.purpose, r, zero);
      bump(byDetail, `${r.purpose}|${r.detail}`, r, () => ({ ...zero(), purpose: r.purpose }));
      bump(byModel, r.model, r, zero);
    }
    const list = <T extends Sum>(m: Map<string, T>, keyName: string) => [...m].map(([k, v]) => ({ [keyName]: k, ...v })).sort((a, b) => b.usd - a.usd);
    const daysList: (Sum & { day: string })[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = vnDay(Date.now() - i * 86_400_000);
      daysList.push({ day: d, ...(byDay.get(d) ?? zero()) });
    }
    return {
      days,
      total,
      allTime: { usd: all._sum.usd ?? 0, requests: all._sum.requests ?? 0, since: all._min.day },
      today: { ...(byDay.get(vnDay()) ?? zero()), budgetUsd: setting('npcDailyBudgetUsd'), spentUtcUsd: today.spentUsd },
      byDay: daysList,
      byPurpose: list(byPurpose, 'purpose'),
      byDetail: [...byDetail].map(([k, v]) => ({ detail: k.split('|')[1] ?? '', ...v })).sort((a, b) => b.usd - a.usd).slice(0, 40),
      byModel: list(byModel, 'model'),
      config: { model: setting('npcModel'), modelBasic: setting('npcModelBasic'), realKey: hasRealApiKey() },
    };
  });

  app.post('/admin/llm-usage/check', async (req) => {
    if (!hasRealApiKey()) return { ok: false, error: 'no_api_key' };
    const model = setting('npcModelBasic');
    const t0 = Date.now();
    try {
      const res = await new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 20_000 }).messages.create({ model, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] });
      logLlmUsage('key_check', '', model, tokensOf(res.usage));
      await audit(req, 'llm.check', model, null, { ok: true });
      return { ok: true, model, ms: Date.now() - t0 };
    } catch (e) {
      const err = e as { status?: number; message?: string };
      const msg = String(err.message ?? e).slice(0, 300);
      // 400 "credit balance is too low", 401 bad key, 403 no permission, 429 rate / spend limit, 529 overloaded
      const kind = /credit balance/i.test(msg) ? 'no_credit' : err.status === 401 ? 'bad_key' : err.status === 403 ? 'forbidden' : err.status === 429 ? 'rate_limited' : err.status === 529 ? 'overloaded' : 'error';
      await audit(req, 'llm.check', model, null, { ok: false, kind });
      return { ok: false, model, status: err.status ?? null, error: kind, message: msg, ms: Date.now() - t0 };
    }
  });
}
