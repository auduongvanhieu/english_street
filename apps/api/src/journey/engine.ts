import {
  AREA_STEPS,
  BONUS_STEPS,
  DAILY_BONUS,
  STORY_BONUS,
  STORY_STEPS,
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
import { setting } from '../settings';
import { giftGems } from '../gems/core';

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
  Object.assign(st, { day, daily: dailyFor(playerId, day), dailyDone: [], dailyProg: {}, dailyBonus: false, story: 0, storyBonus: false });
}
export const stampsOf = (st: JourneyState) => STAMP_AREAS.filter((a) => AREA_STEPS.filter((s) => s.area === a).every((s) => st.done.includes(s.id)));
export const chapterOf = (st: JourneyState) => {
  const i = MAIN_STEPS.findIndex((s) => !st.done.includes(s.id));
  return i < 0 ? MAIN_STEPS.length : i;
};

/** Main chapters finished by an event (marked done in st). */
function mainSteps(st: JourneyState, name: string, props: Record<string, unknown>, stamps: number, bump: (s: JourneyStep, prog: Record<string, number>) => boolean): JourneyStep[] {
  const out: JourneyStep[] = [];
  for (const s of MAIN_STEPS) {
    if (st.done.includes(s.id)) continue;
    if (s.goal.stamps ? stamps >= s.goal.stamps : bump(s, st.prog)) (st.done.push(s.id), out.push(s));
  }
  return out;
}
/** Main chapters an old event would have finished (players who did a later chapter early, before 2026-11-07). */
export function catchUpMain(st: JourneyState, name: string, props: Record<string, unknown>): JourneyStep[] {
  const bump = (s: JourneyStep, prog: Record<string, number>) => {
    if (!goalMatches(s.goal, name, props)) return false;
    const n = (prog[s.id] ?? 0) + 1;
    prog[s.id] = n;
    return n >= (s.goal.count ?? 1);
  };
  // counts of the main steps are rebuilt from the events
  return mainSteps(st, name, props, stampsOf(st).length, bump);
}

/** Apply one event to a state (no saving). Returns the steps it finished and a new stamp, if any. */
export function applyEvent(st: JourneyState, name: string, props: Record<string, unknown>): { done: JourneyStep[]; stamp?: string; dailyBonus: boolean; storyBonus: boolean } {
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
  // one-off bonus tasks (install the app)
  for (const s of BONUS_STEPS) if (!st.done.includes(s.id) && bump(s, st.prog)) (st.done.push(s.id), done.push(s));
  const after = stampsOf(st);
  const stamp = after.find((a) => !before.includes(a));
  // the main chain: every chapter counts when it is done, in any order (the HUD shows the first one not done);
  // a new stamp can finish the last one
  done.push(...mainSteps(st, name, props, after.length, bump));
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
  // a day in English Street: only the next step counts
  const si = st.story ?? 0;
  const next = STORY_STEPS[si];
  if (next && goalMatches(next.goal, name, props)) {
    st.story = si + 1;
    done.push(next);
  }
  let storyBonus = false;
  if ((st.story ?? 0) >= STORY_STEPS.length && !st.storyBonus) {
    st.storyBonus = true;
    storyBonus = true;
  }
  return { done, stamp, dailyBonus, storyBonus };
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
    Object.assign(st, { dailyDone: [], dailyProg: {}, dailyBonus: false, story: 0, storyBonus: false });
  }

  /** Once per player: main chapters done earlier out of order (they did not count then) are marked done and paid. */
  private async catchUp(playerId: string, st: JourneyState) {
    if (st.mainAny) return;
    st.mainAny = true;
    if (this.repo.name !== 'postgres') return;
    const rows = await prisma.event.findMany({ where: { playerId }, orderBy: { createdAt: 'asc' }, take: 5000, select: { name: true, props: true } }).catch(() => []);
    const prog = st.prog;
    st.prog = { ...prog };
    for (const id of MAIN_STEPS.map((s) => s.id)) delete st.prog[id];
    const found: JourneyStep[] = [];
    for (const r of rows) found.push(...catchUpMain(st, r.name, (r.props ?? {}) as Record<string, unknown>));
    for (const s of found) {
      await this.repo.reward(playerId, s.reward.xp, s.reward.coins, 'journey');
      await this.repo.logEvent({ name: 'journey_step', playerId, props: { id: s.id, kind: s.kind, catchUp: true } });
    }
    if (found.length) console.log(`[journey] catch-up ${playerId}: ${found.map((s) => s.id).join(', ')}`);
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
      st.mainAny = true;
      await this.save(playerId, gs, st);
    } else if (!st.mainAny) {
      await this.catchUp(playerId, st);
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
    if (isNew) (await this.backfill(pid, st), (st.mainAny = true));
    const caught = !isNew && !st.mainAny;
    if (caught) await this.catchUp(pid, st);
    const r = applyEvent(st, name, props);
    if (!r.done.length && !r.dailyBonus && !r.storyBonus && !isNew && !caught) return;
    await this.save(pid, gs, st);
    const paid: JourneyEvent['done'] = [];
    for (const s of r.done) {
      await this.repo.reward(pid, s.reward.xp, s.reward.coins, 'journey');
      // 💎 each main chapter also gives a few gems (signed-up players; journey state makes it once per chapter)
      const gems = s.kind === 'main' && this.repo.name === 'postgres' ? await giftGems(pid, setting('gemGiftChapter'), 'journey', s.id).catch(() => 0) : 0;
      paid.push({ id: s.id, xp: s.reward.xp, coins: s.reward.coins, ...(gems ? { gems } : {}) });
      await this.repo.logEvent({ name: 'journey_step', playerId: pid, props: { id: s.id, kind: s.kind } });
    }
    if (r.dailyBonus) {
      await this.repo.reward(pid, DAILY_BONUS.xp, DAILY_BONUS.coins, 'journey');
      paid.push({ id: 'daily-bonus', ...DAILY_BONUS });
    }
    if (r.storyBonus) {
      await this.repo.reward(pid, STORY_BONUS.xp, STORY_BONUS.coins, 'journey');
      paid.push({ id: 'story-bonus', ...STORY_BONUS });
      await this.repo.logEvent({ name: 'journey_story', playerId: pid, props: {} });
    }
    // invited by a friend: when I finish the invite chapter (INVITE_PAY_STEP), we both get something
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
