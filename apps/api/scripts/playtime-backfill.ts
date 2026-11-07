/**
 * One-off: estimate play time from before the game server counted it (events in the Event table).
 * A player's events closer than GAP apart make one session; a session lasts from its first to its last event plus
 * TAIL (a lower bound). Added to User.playSeconds and PlayDay (Vietnam day of the session start). Runs once
 * (Setting "playtime:backfill"); only events before the run.
 *   pnpm --filter @es/api playtime:backfill [--dry]
 */
import { prisma } from '../src/plugins/prisma';

const GAP = 10 * 60_000;
const TAIL = 60_000;
const dry = process.argv.includes('--dry');
const done = await prisma.setting.findUnique({ where: { key: 'playtime:backfill' } });
if (done && !dry) {
  console.log('already done', JSON.stringify(done.value));
  process.exit(0);
}
const cutoff = new Date();
const vnDay = (t: Date) => new Date(t.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const users = new Set((await prisma.user.findMany({ select: { id: true } })).map((u) => u.id));
const perUser = new Map<string, Map<string, { sec: number; n: number }>>();
let cursor: string | undefined;
let rows = 0;
let last: { id: string; start: number; end: number } | null = null;
const close = () => {
  if (!last) return;
  const sec = Math.round((last.end - last.start + TAIL) / 1000);
  const days = perUser.get(last.id) ?? new Map();
  const d = vnDay(new Date(last.start));
  const cur = days.get(d) ?? { sec: 0, n: 0 };
  cur.sec += sec;
  cur.n += 1;
  days.set(d, cur);
  perUser.set(last.id, days);
};
// walk events per player in time order (paged)
for (;;) {
  const page = await prisma.event.findMany({
    where: { playerId: { not: null }, createdAt: { lt: cutoff } },
    orderBy: [{ playerId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: 20_000,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    select: { id: true, playerId: true, createdAt: true },
  });
  if (!page.length) break;
  for (const e of page) {
    rows++;
    const id = e.playerId!;
    const t = e.createdAt.getTime();
    if (!users.has(id)) continue;
    if (last && last.id === id && t - last.end <= GAP) last.end = t;
    else {
      close();
      last = { id, start: t, end: t };
    }
  }
  cursor = page[page.length - 1]!.id;
}
close();
let total = 0;
for (const [id, days] of perUser) {
  const sum = [...days.values()].reduce((a, d) => a + d.sec, 0);
  total += sum;
  if (dry) continue;
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { playSeconds: { increment: sum } } }),
    ...[...days].map(([day, d]) =>
      prisma.playDay.upsert({ where: { userId_day: { userId: id, day } }, create: { userId: id, day, seconds: d.sec, sessions: d.n }, update: { seconds: { increment: d.sec }, sessions: { increment: d.n } } }),
    ),
  ]);
}
if (!dry) await prisma.setting.upsert({ where: { key: 'playtime:backfill' }, create: { key: 'playtime:backfill', value: { at: cutoff.toISOString(), players: perUser.size, seconds: total } }, update: { value: { at: cutoff.toISOString(), players: perUser.size, seconds: total } } });
console.log(`${dry ? '[dry] ' : ''}events ${rows}, players ${perUser.size}, total ${Math.round(total / 3600)} h`);
process.exit(0);
