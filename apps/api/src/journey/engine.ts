import {
  AREA_STEPS,
  DAILY_BONUS,
  DAILY_POOL,
  INVITEE_BONUS,
  INVITE_PAY_STEP,
  INVITE_REWARD,
  weekKey,
  weeklyFor,
  type WeeklyView,
  MAIN_STEPS,
  STAMP_AREAS,
  dailyFor,
  goalMatches,
  type JourneyEvent,
  type JourneyState,
  type JourneyStep,
  type JourneyView,
} from '@es/shared';
import type { AttemptRepo, EventInput } from '../npc/attempts';
import { prisma } from '../plugins/prisma';

/**
 * Journey progress (plans/english-street-quest-journey.md). Every logged game event with a player goes through
 * onEvent(): the current main chapter, the area tasks and today's daily tasks count it; finished steps pay XP and
 * coins and are pushed to the player's open game. State: User.gameState.journey.
 */
/** Vietnam day (UTC+7): daily tasks change at local midnight. */
export const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

function fresh(playerId: string): JourneyState {
  const day = today();
  return { done: [], prog: {}, day, daily: dailyFor(playerId, day), dailyDone: [], dailyProg: {}, dailyBonus: false, tracked: [] };
}
function rollDay(st: JourneyState, playerId: string) {
  const day = today();
  if (st.day === day) return;
  Object.assign(st, { day, daily: dailyFor(playerId, day), dailyDone: [], dailyProg: {}, dailyBonus: false });
}
export const stampsOf = (st: JourneyState) => STAMP_AREAS.filter((a) => AREA_STEPS.filter((s) => s.area === a).every((s) => st.done.includes(s.id)));
export const chapterOf = (st: JourneyState) => {
  const i = MAIN_STEPS.findIndex((s) => !st.done.includes(s.id));
  return i < 0 ? MAIN_STEPS.length : i;
};

/** Apply one event to a state (no saving). Returns the steps it finished and a new stamp, if any. */
export function applyEvent(st: JourneyState, name: string, props: Record<string, unknown>): { done: JourneyStep[]; stamp?: string; dailyBonus: boolean } {
  const done: JourneyStep[] = [];
  const bump = (s: JourneyStep, prog: Record<string, number>) => {
    if (!goalMatches(s.goal, name, props)) return false;
    const n = (prog[s.id] ?? 0) + 1;
    prog[s.id] = n;
    return n >= (s.goal.count ?? 1);
  };
  // area tasks (all open at once)
  const before = stampsOf(st);
  for (const s of AREA_STEPS) if (!st.done.includes(s.id) && bump(s, st.prog)) (st.done.push(s.id), done.push(s));
  const after = stampsOf(st);
  const stamp = after.find((a) => !before.includes(a));
  // the main chain: only the current chapter counts (a new stamp can finish the last one)
  for (let guard = 0; guard < 2; guard++) {
    const cur = MAIN_STEPS[chapterOf(st)];
    if (!cur) break;
    const ok = cur.goal.stamps ? after.length >= cur.goal.stamps : bump(cur, st.prog);
    if (!ok) break;
    st.done.push(cur.id);
    done.push(cur);
  }
  // today's tasks
  for (const id of st.daily) {
    if (st.dailyDone.includes(id)) continue;
    const s = DAILY_POOL.find((x) => x.id === id);
    if (s && bump(s, st.dailyProg)) (st.dailyDone.push(id), done.push(s));
  }
  let dailyBonus = false;
  if (!st.dailyBonus && st.daily.length && st.daily.every((id) => st.dailyDone.includes(id))) {
    st.dailyBonus = true;
    dailyBonus = true;
  }
  return { done, stamp, dailyBonus };
}

type Push = (uid: string, ev: JourneyEvent) => Promise<unknown>;

/** The server-wide weekly challenge: total, who helped (and how much), whether it was paid out. */
interface WeekRow {
  week: string;
  id: string;
  count: number;
  by: Record<string, number>;
  paid: boolean;
}
const WEEK_KEY = 'journey:week';
let memWeek: WeekRow | null = null;

export class Journey {
  /** one event at a time per player (batches from the client arrive together) */
  private queue = new Map<string, Promise<unknown>>();
  constructor(
    private repo: AttemptRepo,
    private push: Push,
  ) {}

  private async load(playerId: string): Promise<{ gs: Record<string, unknown>; st: JourneyState; isNew: boolean }> {
    const u = await this.repo.getUser(playerId);
    const gs = (u?.gameState ?? {}) as Record<string, unknown> & { journey?: JourneyState };
    const isNew = !gs.journey;
    const st = gs.journey ? { ...fresh(playerId), ...gs.journey } : fresh(playerId);
    rollDay(st, playerId);
    return { gs, st, isNew };
  }
  private save(playerId: string, gs: Record<string, unknown>, st: JourneyState) {
    return this.repo.updateUser(playerId, { gameState: { ...gs, journey: st } });
  }

  /** Players who were here before the journey existed: count what they already did (no rewards). */
  private async backfill(playerId: string, st: JourneyState) {
    if (this.repo.name !== 'postgres') return;
    const rows = await prisma.event.findMany({ where: { playerId }, orderBy: { createdAt: 'asc' }, take: 5000, select: { name: true, props: true } }).catch(() => []);
    for (const r of rows) applyEvent(st, r.name, (r.props ?? {}) as Record<string, unknown>);
    // the backfill must not hand out today's tasks for old events
    Object.assign(st, { dailyDone: [], dailyProg: {}, dailyBonus: false });
  }

  private async week(): Promise<WeekRow> {
    const wk = weekKey();
    let row: WeekRow | null = memWeek;
    if (this.repo.name === 'postgres') {
      const r = await prisma.setting.findUnique({ where: { key: WEEK_KEY } }).catch(() => null);
      row = (r?.value as WeekRow | undefined) ?? null;
    }
    if (!row || row.week !== wk) row = { week: wk, id: weeklyFor(wk).id, count: 0, by: {}, paid: false };
    return row;
  }
  private async saveWeek(row: WeekRow) {
    memWeek = row;
    if (this.repo.name === 'postgres') await prisma.setting.upsert({ where: { key: WEEK_KEY }, create: { key: WEEK_KEY, value: row as object, updatedBy: 'journey' }, update: { value: row as object } }).catch(() => undefined);
  }
  private async weeklyView(playerId: string): Promise<WeeklyView> {
    const row = await this.week();
    const c = weeklyFor(row.week);
    return { id: c.id, week: row.week, count: row.count, target: c.target, mine: row.by[playerId] ?? 0, done: row.count >= c.target };
  }
  /** Count an event for the weekly challenge; pay everybody who helped when the target is reached. */
  private weekChain: Promise<unknown> = Promise.resolve();
  private countWeek(pid: string, name: string, props: Record<string, unknown>) {
    this.weekChain = this.weekChain.then(async () => {
      const row = await this.week();
      const c = weeklyFor(row.week);
      if (row.paid || !goalMatches(c.goal, name, props)) return;
      row.count += 1;
      row.by[pid] = (row.by[pid] ?? 0) + 1;
      if (row.count >= c.target) row.paid = true;
      await this.saveWeek(row);
      if (!row.paid) return;
      for (const uid of Object.keys(row.by)) {
        await this.repo.reward(uid, c.reward.xp, c.reward.coins, 'journey');
        await this.push(uid, { done: [{ id: 'weekly', ...c.reward }] });
      }
      await this.repo.logEvent({ name: 'journey_weekly', props: { id: c.id, week: row.week, players: Object.keys(row.by).length } });
    }).catch((e) => console.error('[journey week]', e));
  }

  async view(playerId: string): Promise<JourneyView> {
    const { gs, st, isNew } = await this.load(playerId);
    if (isNew) {
      await this.backfill(playerId, st);
      await this.save(playerId, gs, st);
    } else if (gs.journey && (gs.journey as JourneyState).day !== st.day) await this.save(playerId, gs, st);
    return { state: st, chapter: chapterOf(st), stamps: stampsOf(st), weekly: await this.weeklyView(playerId) };
  }

  private async payInviter(inviter: string) {
    const { gs, st } = await this.load(inviter);
    st.invited = (st.invited ?? 0) + 1;
    await this.save(inviter, gs, st);
    await this.repo.reward(inviter, INVITE_REWARD.xp, INVITE_REWARD.coins, 'journey');
    await this.repo.logEvent({ name: 'journey_invite', playerId: inviter, props: { invited: st.invited } });
    await this.push(inviter, { done: [{ id: 'invite', ...INVITE_REWARD }] });
  }

  async setTracked(playerId: string, id: string, on: boolean) {
    const { gs, st } = await this.load(playerId);
    st.tracked = on ? [...new Set([...st.tracked, id])].slice(-3) : st.tracked.filter((x) => x !== id);
    await this.save(playerId, gs, st);
    return st.tracked;
  }

  onEvent(e: EventInput) {
    const pid = e.playerId;
    if (!pid) return;
    const prev = this.queue.get(pid) ?? Promise.resolve();
    const next = prev.then(() => this.handle(pid, e.name, (e.props ?? {}) as Record<string, unknown>)).catch((err) => console.error('[journey]', err));
    this.queue.set(pid, next);
    void next.finally(() => this.queue.get(pid) === next && this.queue.delete(pid));
  }

  private async handle(pid: string, name: string, props: Record<string, unknown>) {
    // the journey's own events don't count
    if (name.startsWith('journey_') || name === 'coins_earned' || name === 'device' || name === 'perf') return;
    const u = await this.repo.getUser(pid);
    if (!u) return;
    this.countWeek(pid, name, props);
    const { gs, st, isNew } = await this.load(pid);
    if (isNew) await this.backfill(pid, st);
    const r = applyEvent(st, name, props);
    if (!r.done.length && !r.dailyBonus && !isNew) return;
    await this.save(pid, gs, st);
    const paid: JourneyEvent['done'] = [];
    for (const s of r.done) {
      await this.repo.reward(pid, s.reward.xp, s.reward.coins, 'journey');
      paid.push({ id: s.id, xp: s.reward.xp, coins: s.reward.coins });
      await this.repo.logEvent({ name: 'journey_step', playerId: pid, props: { id: s.id, kind: s.kind } });
    }
    if (r.dailyBonus) {
      await this.repo.reward(pid, DAILY_BONUS.xp, DAILY_BONUS.coins, 'journey');
      paid.push({ id: 'daily-bonus', ...DAILY_BONUS });
    }
    // invited by a friend: when I finish chapter 2, we both get something
    const inv = gs as { invitedBy?: string; invitePaid?: boolean };
    if (inv.invitedBy && !inv.invitePaid && r.done.some((s) => s.id === INVITE_PAY_STEP)) {
      await this.repo.updateUser(pid, { gameState: { ...gs, journey: st, invitePaid: true } });
      await this.repo.reward(pid, INVITEE_BONUS.xp, INVITEE_BONUS.coins, 'journey');
      paid.push({ id: 'welcome', ...INVITEE_BONUS });
      await this.payInviter(inv.invitedBy);
    }
    if (r.stamp) await this.repo.logEvent({ name: 'journey_stamp', playerId: pid, props: { area: r.stamp } });
    if (paid.length) await this.push(pid, { done: paid, stamp: r.stamp });
  }
}

/** Route every logged event with a player through the journey. */
export function withJourney(repo: AttemptRepo, journey: () => Journey) {
  const orig = repo.logEvent.bind(repo);
  repo.logEvent = async (e: EventInput) => {
    await orig(e);
    if (e.playerId) journey().onEvent(e);
  };
}
