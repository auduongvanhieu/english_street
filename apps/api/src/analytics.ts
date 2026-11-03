import type { AttemptRepo } from './npc/attempts';
import { budget } from './npc/budget';

/** Aggregates for the admin dashboard, computed over the last `days` days. */
export async function computeStats(repo: AttemptRepo, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [events, attempts, users, spend] = await Promise.all([repo.listEventsSince(since), repo.listAttemptsSince(since), repo.countUsers(), budget.snapshot()]);

  const count = (name: string) => events.filter((e) => e.name === name).length;
  const byDay = new Map<string, Set<string>>();
  for (const e of events) {
    if (!e.playerId) continue;
    const d = e.createdAt.toISOString().slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, new Set());
    byDay.get(d)!.add(e.playerId);
  }

  const finished = attempts.filter((a) => a.status !== 'active');
  const completed = finished.filter((a) => a.status === 'completed');
  const scores = completed.map((a) => a.score ?? 0);
  const perQuest = new Map<string, { started: number; completed: number; score: number[] }>();
  for (const a of attempts) {
    const q = perQuest.get(a.questId) ?? { started: 0, completed: 0, score: [] };
    q.started += 1;
    if (a.status === 'completed') {
      q.completed += 1;
      q.score.push(a.score ?? 0);
    }
    perQuest.set(a.questId, q);
  }

  const turns = events.filter((e) => e.name === 'npc_turn');
  const correctionTypes = new Map<string, number>();
  let voiceTurns = 0;
  for (const t of turns) {
    if (t.props?.source === 'voice') voiceTurns += 1;
    for (const ty of (t.props?.correction_types as string[] | undefined) ?? []) correctionTypes.set(ty, (correctionTypes.get(ty) ?? 0) + 1);
  }
  const fps = events.filter((e) => e.name === 'perf').map((e) => Number(e.props?.fps ?? 0)).filter((n) => n > 0);
  const loads = events.filter((e) => e.name === 'page_load');
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

  return {
    days,
    since: since.toISOString(),
    users: {
      total: users.total,
      registered: users.registered,
      activeToday: await users.activeSince(today),
      activeInPeriod: await users.activeSince(since),
      dailyActive: [...byDay.entries()].sort().map(([day, set]) => ({ day, players: set.size })),
    },
    quests: {
      started: attempts.length,
      completed: completed.length,
      failed: finished.filter((a) => a.status === 'failed').length,
      abandoned: finished.filter((a) => a.status === 'abandoned').length,
      completionRate: finished.length ? Math.round((completed.length / finished.length) * 100) : null,
      avgScore: avg(scores),
      avgTurns: avg(finished.map((a) => a.turns)),
      byQuest: [...perQuest.entries()]
        .map(([questId, q]) => ({ questId, ...q, avgScore: avg(q.score) }))
        .sort((a, b) => b.started - a.started),
    },
    npc: {
      turns: turns.length,
      voiceShare: turns.length ? Math.round((voiceTurns / turns.length) * 100) : null,
      correctionTypes: [...correctionTypes.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, n })),
      errors: { rateLimited: count('rate_limited'), quota: count('daily_quota_exhausted'), budget: count('daily_budget_exhausted') },
      spendToday: spend,
    },
    social: { pairQuests: count('pair_start'), voiceChatEnabled: count('voice_chat_on'), reports: count('report'), feedback: count('feedback'), talks: count('talk_start'), shouts: count('shout'), voiceShouts: count('voice_shout') },
    learning: {
      subtitleTurns: events.filter((e) => e.name === 'npc_turn' && e.props?.subtitles === true).length,
      wordTaps: count('word_tap'),
      chatTranslations: count('translate_chat'),
      settingsChanges: count('settings_change'),
    },
    client: {
      pageLoads: loads.length,
      touchShare: loads.length ? Math.round((loads.filter((e) => e.props?.touch === true).length / loads.length) * 100) : null,
      avgFps: avg(fps),
      lowFpsSessions: fps.filter((f) => f < 30).length,
      avgDrawCalls: avg(events.filter((e) => e.name === 'perf').map((e) => Number(e.props?.calls ?? 0)).filter((n) => n > 0)),
    },
  };
}
