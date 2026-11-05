import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma';
import { budget } from '../npc/budget';
import { audit, bad } from './core';
import { gameOnline } from './game';
import { isTestPlayer } from './testRoutes';

/**
 * Daily rollups (DailyStat) so the stats pages never scan the whole Event table. The job recomputes today and
 * yesterday every hour, fills missing days (up to 90) at start, and can be re-run from the admin site.
 */
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const dayStart = (day: string) => new Date(`${day}T00:00:00.000Z`);
const addDays = (day: string, n: number) => dayStr(new Date(dayStart(day).getTime() + n * 86_400_000));

type Row = { metric: string; key: string; value: number };

/** Every metric of one UTC day. */
async function computeDay(day: string): Promise<Row[]> {
  const from = dayStart(day);
  const to = new Date(from.getTime() + 86_400_000);
  const [events, attempts, newUsers] = await Promise.all([
    prisma.event.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { name: true, playerId: true, props: true } }),
    prisma.questAttempt.findMany({ where: { startedAt: { gte: from, lt: to } }, select: { questId: true, npcId: true, status: true, score: true } }),
    prisma.user.count({ where: { createdAt: { gte: from, lt: to } } }),
  ]);
  const rows = new Map<string, Row>();
  const add = (metric: string, key: string, v = 1) => {
    const k = `${metric}|${key}`;
    const r = rows.get(k) ?? { metric, key, value: 0 };
    r.value += v;
    rows.set(k, r);
  };
  const active = new Set<string>();
  // device dimensions: counted once per player and day (players join many times)
  const devSeen = new Set<string>();
  const devAdd = (pid: string | null, metric: string, key: string | undefined) => {
    if (!key) return;
    const k = `${pid}|${metric}|${key}`;
    if (devSeen.has(k)) return;
    devSeen.add(k);
    add(metric, key);
  };
  for (const e of events) {
    if (isTestPlayer(e.playerId)) continue; // admin "try the NPC" sessions
    const p = (e.props ?? {}) as Record<string, unknown>;
    if (e.playerId) active.add(e.playerId);
    add('event', e.name);
    switch (e.name) {
      case 'area_enter':
        add('area_enter', String(p.area ?? '?'));
        break;
      case 'area_leave':
        add('area_seconds', String(p.area ?? '?'), Math.min(4 * 3600, Math.max(0, Number(p.seconds) || 0)));
        break;
      case 'quest_start':
      case 'free_talk_start':
        add('npc_talk', String(p.npcId ?? '?'));
        break;
      case 'npc_turn':
        add('npc_turns', String(p.npcId ?? '?'));
        if (p.source === 'voice') add('voice_turns', '');
        for (const t of (p.correction_types as string[] | undefined) ?? []) add('correction', t);
        break;
      case 'quiz_done':
        add('quiz', String(p.area ?? '?'));
        add('quiz_correct', String(p.area ?? '?'), Number(p.correct) || 0);
        add('quiz_total', String(p.area ?? '?'), Number(p.total) || 0);
        for (const w of (p.wrong as string[] | undefined) ?? []) add('quiz_wrong', `${p.area}:${w}`);
        break;
      case 'coins_earned':
        add('coins_earned', String(p.source ?? 'other'), Number(p.coins) || 0);
        break;
      case 'coins_spent':
        add('coins_spent', String(p.source ?? 'other'), Number(p.coins) || 0);
        break;
      case 'restaurant_order':
        add('dish', String(p.item ?? '?'));
        break;
      case 'word_card_open':
        add('word_card', `${p.area}:${p.item}`);
        break;
      case 'bus_ride':
        add('bus', String(p.to ?? '?'));
        break;
      case 'join':
        add('join_device', p.app ? 'app' : p.touch ? 'touch' : 'desktop');
        break;
      case 'device': {
        const os = String(p.os ?? '');
        devAdd(e.playerId, 'dev_os', os || undefined);
        devAdd(e.playerId, 'dev_os_version', os && p.osVersion ? `${os} ${String(p.osVersion).split('.')[0]}` : undefined);
        devAdd(e.playerId, 'dev_model', p.model ? String(p.model) : undefined);
        devAdd(e.playerId, 'dev_network', p.network === 'cellular' ? `cellular${p.radio ? ` ${p.radio}` : ''}` : p.network ? String(p.network) : 'unknown');
        devAdd(e.playerId, 'dev_kind', String(p.kind ?? 'web'));
        devAdd(e.playerId, 'dev_browser', p.kind === 'app' ? 'app' : p.browser ? String(p.browser) : undefined);
        break;
      }
      case 'translation_report':
        add('translation_report', String(p.area ?? ''));
        break;
    }
  }
  add('dau', '', active.size);
  add('new_users', '', newUsers);
  if (active.size) {
    const regs = await prisma.user.findMany({ where: { id: { in: [...active] } }, select: { email: true, nativeLang: true, cefrLevel: true } });
    add('dau_registered', '', regs.filter((u) => u.email).length);
    for (const u of regs) {
      add('dau_lang', u.nativeLang || '?');
      add('dau_level', u.cefrLevel);
    }
  }
  for (const a of attempts) {
    add('quest_started', a.questId);
    if (a.status === 'completed') {
      add('quest_completed', a.questId);
      add('quest_score', a.questId, a.score ?? 0);
    }
  }
  if (day === dayStr(new Date())) {
    const b = await budget.snapshot();
    add('spend_usd', '', b.spentUsd);
  }
  return [...rows.values()];
}

export async function rollupDay(day: string) {
  const rows = await computeDay(day);
  const today = day === dayStr(new Date());
  // spend is only known for the running day (Redis counter); keep the stored value for older days
  await prisma.$transaction([
    prisma.dailyStat.deleteMany({ where: { day, ...(today ? {} : { metric: { not: 'spend_usd' } }) } }),
    prisma.dailyStat.createMany({ data: rows.filter((r) => today || r.metric !== 'spend_usd').map((r) => ({ day, ...r })) }),
  ]);
  return rows.length;
}

let running = false;
async function rollupRecent(backfill = 0) {
  if (running) return;
  running = true;
  try {
    const today = dayStr(new Date());
    await rollupDay(today);
    await rollupDay(addDays(today, -1));
    if (backfill) {
      const have = new Set((await prisma.dailyStat.findMany({ where: { metric: 'dau' }, select: { day: true } })).map((r) => r.day));
      const first = await prisma.event.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
      for (let i = 2; i <= backfill; i++) {
        const d = addDays(today, -i);
        if (first && d < dayStr(first.createdAt)) break;
        if (!have.has(d)) await rollupDay(d);
      }
    }
  } catch (e) {
    console.warn('[stats] rollup failed', e);
  } finally {
    running = false;
  }
}

export function startStatsJob(dbOn: boolean) {
  if (!dbOn) return;
  setTimeout(() => void rollupRecent(90), 20_000).unref();
  setInterval(() => void rollupRecent(), 60 * 60_000).unref();
}

// ---------------------------------------------------------------- routes
const Range = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export function adminStatsRoutes(app: FastifyInstance) {
  /** Series + totals of the rollups for the last `days` days (today included, refreshed on read). */
  app.get('/admin/stats/daily', async (req, reply) => {
    const q = Range.safeParse(req.query);
    if (!q.success) return bad(reply, 'bad_request');
    await rollupDay(dayStr(new Date())).catch(() => undefined);
    const from = addDays(dayStr(new Date()), -(q.data.days - 1));
    const rows = await prisma.dailyStat.findMany({ where: { day: { gte: from } }, orderBy: { day: 'asc' } });
    const days: string[] = [];
    for (let d = from; d <= dayStr(new Date()); d = addDays(d, 1)) days.push(d);
    return { days, rows: rows.map((r) => [r.day, r.metric, r.key, r.value] as const) };
  });

  app.post('/admin/stats/rollup', async (req) => {
    const days = Math.min(365, Math.max(1, Number((req.body as { days?: unknown } | undefined)?.days) || 7));
    const today = dayStr(new Date());
    for (let i = 0; i < days; i++) await rollupDay(addDays(today, -i));
    await audit(req, 'stats.rollup', String(days));
    return { ok: true, days };
  });

  /** Overview tiles. */
  app.get('/admin/stats/overview', async () => {
    const now = Date.now();
    const since = (d: number) => new Date(now - d * 86_400_000);
    const distinct = async (d: number) =>
      Number(((await prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT "playerId")::int AS n FROM "Event" WHERE "createdAt" >= $1 AND "playerId" IS NOT NULL`, since(d))) as { n: number }[])[0]?.n ?? 0);
    const [d1, d7, d30, users, registered, newToday, online, spend, errors, reportsNew] = await Promise.all([
      distinct(1),
      distinct(7),
      distinct(30),
      prisma.user.count(),
      prisma.user.count({ where: { email: { not: null } } }),
      prisma.user.count({ where: { createdAt: { gte: since(1) } } }),
      gameOnline(),
      budget.snapshot(),
      prisma.event.findMany({ where: { name: 'client_error', createdAt: { gte: since(1) } }, orderBy: { createdAt: 'desc' }, take: 10, select: { props: true, createdAt: true } }),
      prisma.report.count({ where: { status: 'new' } }),
    ]);
    return {
      active: { d1, d7, d30 },
      users: { total: users, registered, guests: users - registered, newToday },
      online: online ? { players: online.players.length, guests: online.players.filter((p) => p.guest).length, rooms: online.rooms } : null,
      spend,
      errors,
      reportsNew,
    };
  });

  /** Heat map: player samples per 4 m cell (every 30 s per player) over a date range and hours of the day (UTC). */
  app.get('/admin/stats/heat', async (req, reply) => {
    const q = z.object({ days: z.coerce.number().int().min(1).max(365).default(7), h0: z.coerce.number().int().min(0).max(23).default(0), h1: z.coerce.number().int().min(0).max(23).default(23) }).safeParse(req.query);
    if (!q.success) return bad(reply, 'bad_request');
    const { days, h0, h1 } = q.data;
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "cx","cz",SUM("count")::int AS n FROM "HeatCell" WHERE "hour" >= $1 AND EXTRACT(HOUR FROM "hour") BETWEEN $2 AND $3 GROUP BY "cx","cz"`,
      new Date(Date.now() - days * 86_400_000),
      Math.min(h0, h1),
      Math.max(h0, h1),
    )) as { cx: number; cz: number; n: number }[];
    return { cell: 4, cells: rows.map((r) => [r.cx, r.cz, r.n]) };
  });

  /** Weekly sign-up cohorts: share of players back on day 1, 7 and 30 (any event that day). */
  app.get('/admin/stats/retention', async () => {
    const since = new Date(Date.now() - 120 * 86_400_000);
    const users = await prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } });
    const act = (await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "playerId" AS id, to_char("createdAt", 'YYYY-MM-DD') AS d FROM "Event" WHERE "createdAt" >= $1 AND "playerId" IS NOT NULL`,
      since,
    )) as { id: string; d: string }[];
    const days = new Map<string, Set<string>>();
    for (const a of act) {
      if (!days.has(a.id)) days.set(a.id, new Set());
      days.get(a.id)!.add(a.d);
    }
    const today = dayStr(new Date());
    const cohorts = new Map<string, { users: number; d1: number; d7: number; d30: number; n1: number; n7: number; n30: number }>();
    for (const u of users) {
      const d0 = dayStr(u.createdAt);
      const wk = new Date(u.createdAt);
      wk.setUTCDate(wk.getUTCDate() - ((wk.getUTCDay() + 6) % 7));
      const key = dayStr(wk);
      const c = cohorts.get(key) ?? { users: 0, d1: 0, d7: 0, d30: 0, n1: 0, n7: 0, n30: 0 };
      c.users += 1;
      const seen = days.get(u.id);
      for (const [n, k, nk] of [[1, 'd1', 'n1'], [7, 'd7', 'n7'], [30, 'd30', 'n30']] as const) {
        const target = addDays(d0, n);
        if (target > today) continue;
        c[nk] += 1; // eligible
        if (seen?.has(target)) c[k] += 1;
      }
      cohorts.set(key, c);
    }
    return [...cohorts].sort((a, b) => b[0].localeCompare(a[0])).map(([week, c]) => ({ week, ...c }));
  });

  /** First steps funnel for players who started in the range. */
  app.get('/admin/stats/funnel', async (req) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    const since = new Date(Date.now() - days * 86_400_000);
    const users = await prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, email: true } });
    const ids = users.map((u) => u.id);
    const firsts = ids.length
      ? ((await prisma.$queryRawUnsafe(`SELECT name, COUNT(DISTINCT "playerId")::int AS n FROM "Event" WHERE "playerId" = ANY($1) AND name IN ('join','npc_turn','area_enter','word_card_open') GROUP BY name`, ids)) as { name: string; n: number }[])
      : [];
    const completed = ids.length ? await prisma.questAttempt.findMany({ where: { userId: { in: ids }, status: 'completed' }, distinct: ['userId'], select: { userId: true } }) : [];
    const n = (name: string) => firsts.find((f) => f.name === name)?.n ?? 0;
    return [
      { step: 'started', n: users.length },
      { step: 'joined the street', n: n('join') },
      { step: 'entered an area', n: n('area_enter') },
      { step: 'opened a word card', n: n('word_card_open') },
      { step: 'talked to an NPC', n: n('npc_turn') },
      { step: 'finished a quest', n: completed.length },
      { step: 'created an account', n: users.filter((u) => u.email).length },
    ];
  });

  /** Most missed goals of a quest (completed goals vs. attempts). */
  app.get<{ Params: { id: string } }>('/admin/stats/quest/:id', async (req) => {
    const atts = await prisma.questAttempt.findMany({ where: { questId: req.params.id, status: { not: 'active' } }, select: { status: true, score: true, goalsDone: true, turns: true }, take: 2000, orderBy: { startedAt: 'desc' } });
    const goals = new Map<string, number>();
    for (const a of atts) for (const g of a.goalsDone) goals.set(g, (goals.get(g) ?? 0) + 1);
    const done = atts.filter((a) => a.status === 'completed');
    return {
      attempts: atts.length,
      completed: done.length,
      avgScore: done.length ? Math.round(done.reduce((s, a) => s + (a.score ?? 0), 0) / done.length) : null,
      avgTurns: atts.length ? Math.round((atts.reduce((s, a) => s + a.turns, 0) / atts.length) * 10) / 10 : null,
      goals: Object.fromEntries(goals),
    };
  });

  /** Words most often wrong in area quizzes, and the word cards opened the most ("area:item"). */
  app.get('/admin/stats/words', async (req) => {
    const days = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 30));
    const from = addDays(dayStr(new Date()), -(days - 1));
    const top = async (metric: string) =>
      (await prisma.dailyStat.groupBy({ by: ['key'], where: { metric, day: { gte: from } }, _sum: { value: true }, orderBy: { _sum: { value: 'desc' } }, take: 30 })).map((r) => ({ key: r.key, n: r._sum.value ?? 0 }));
    return { wrong: await top('quiz_wrong'), opened: await top('word_card') };
  });
}
