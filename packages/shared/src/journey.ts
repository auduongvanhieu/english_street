import type { AreaId } from './schemas/area';

/**
 * "Journey": the quest system that walks players through the whole game (plans/english-street-quest-journey.md).
 *  - main: 12 chapters given by Priya at Tourist Info, one after the other;
 *  - area: 3 tasks per area — all done = that area's stamp in the passport;
 *  - daily: 3 small tasks a day picked from DAILY_POOL.
 * Progress is counted by the API from game events (server events, and the client events it accepts); the texts
 * live in the web app (journeyText.ts) so they go through the translations.
 */
export interface JourneyGoal {
  /** event name(s) that count */
  event: string | string[];
  /** props the event must have: a value, a list of allowed values, or a prefix ending in * */
  where?: Record<string, string | number | boolean | (string | number)[]>;
  /** how many times (default 1) */
  count?: number;
  /** special goal: number of passport stamps */
  stamps?: number;
}
/** Where "Take me there" goes. */
export type JourneyGuide = { npc: string } | { area: AreaId } | { place: 'river' | 'ferry' | 'fishing' | 'kitchen' | 'kiosk' | 'library' };
export interface JourneyStep {
  id: string;
  kind: 'main' | 'area' | 'daily';
  area?: AreaId | 'river';
  goal: JourneyGoal;
  reward: { xp: number; coins: number };
  guide?: JourneyGuide;
}

const R = (xp: number, coins: number) => ({ xp, coins });
const PLAY = ['football', 'hoops', 'race', 'coach'];

export const MAIN_STEPS: JourneyStep[] = [
  { id: 'm01-hello', kind: 'main', goal: { event: 'npc_open', where: { npc: 'guide' } }, reward: R(20, 5), guide: { npc: 'guide' } },
  { id: 'm02-coffee', kind: 'main', goal: { event: 'quest_end', where: { npc: 'barista', status: 'completed' } }, reward: R(30, 8), guide: { npc: 'barista' } },
  { id: 'm03-look', kind: 'main', goal: { event: ['avatar_save', 'clothes_wardrobe_save'] }, reward: R(20, 10), guide: { area: 'clothes' } },
  { id: 'm04-shopping', kind: 'main', goal: { event: 'shopping_done' }, reward: R(30, 10), guide: { area: 'supermarket' } },
  { id: 'm05-dinner', kind: 'main', goal: { event: 'restaurant_pay' }, reward: R(30, 10), guide: { area: 'restaurant' } },
  { id: 'm06-chef', kind: 'main', goal: { event: 'minigame_done', where: { game: 'cooking' } }, reward: R(30, 10), guide: { place: 'kitchen' } },
  { id: 'm07-friend', kind: 'main', goal: { event: ['chat_send', 'friend_request'] }, reward: R(20, 10) },
  { id: 'm08-river', kind: 'main', goal: { event: ['ferry_board', 'boat_board'] }, reward: R(30, 10), guide: { place: 'ferry' } },
  { id: 'm09-hotel', kind: 'main', goal: { event: 'hotel_checkout' }, reward: R(40, 15), guide: { area: 'hotel' } },
  { id: 'm10-sports', kind: 'main', goal: { event: 'minigame_done', where: { game: PLAY } }, reward: R(30, 10), guide: { area: 'sports' } },
  { id: 'm11-book', kind: 'main', goal: { event: 'book_quiz' }, reward: R(30, 10), guide: { place: 'library' } },
  { id: 'm12-citizen', kind: 'main', goal: { event: 'stamp', stamps: 6 }, reward: R(100, 50) },
];

/** Three tasks per area (and the river); all three = the stamp. */
const area = (a: AreaId | 'river', tasks: [string, JourneyGoal, JourneyGuide?][]): JourneyStep[] =>
  tasks.map(([id, goal, guide]) => ({ id: `a-${a}-${id}`, kind: 'area' as const, area: a, goal, reward: R(15, 4), guide: guide ?? (a === 'river' ? { place: 'river' } : { area: a }) }));
const cards = (a: AreaId, n = 5): JourneyGoal => ({ event: 'word_card_open', where: { area: a }, count: n });
const quiz = (a: AreaId): JourneyGoal => ({ event: 'quiz_done', where: { area: a } });
const talk = (npc: string): JourneyGoal => ({ event: 'quest_end', where: { npc, status: 'completed' } });
export const AREA_STEPS: JourneyStep[] = [
  ...area('zoo', [['cards', cards('zoo')], ['quiz', quiz('zoo')], ['keeper', talk('zookeeper')]]),
  ...area('farm', [['plant', { event: 'farm_action', where: { action: 'plant' } }], ['harvest', { event: 'farm_action', where: { action: 'harvest' } }], ['visit', { event: 'garden_visit' }]]),
  ...area('restaurant', [['order', { event: 'restaurant_order' }], ['cook', { event: 'minigame_done', where: { game: 'cooking' } }, { place: 'kitchen' }], ['tip', { event: 'restaurant_pay', where: { ok: true, tip: [10, 15, 20] } }]]),
  ...area('supermarket', [['cards', cards('supermarket')], ['list', { event: 'shopping_done' }], ['grocer', talk('grocer')]]),
  ...area('home', [['cards', cards('home')], ['shelf', { event: 'book_bought' }, { place: 'library' }], ['mum', talk('mum')]]),
  ...area('school', [['cards', cards('school')], ['quiz', quiz('school')], ['teacher', talk('teacher')]]),
  ...area('clothes', [['cards', cards('clothes')], ['outfit', { event: 'clothes_wardrobe_save' }], ['stylist', talk('stylist')]]),
  ...area('cinema', [['cards', cards('cinema')], ['read', { event: 'book_quiz' }, { place: 'library' }], ['usher', talk('usher')]]),
  ...area('station', [['cards', cards('station')], ['tickets', { event: 'station_tickets_done' }], ['master', talk('stationmaster')]]),
  ...area('hospital', [['cards', cards('hospital')], ['pharmacy', { event: 'hospital_pharmacy_done' }], ['doctor', talk('doctor')]]),
  ...area('hotel', [['checkin', { event: 'hotel_checkin' }], ['service', { event: 'hotel_room_service' }], ['checkout', { event: 'hotel_checkout' }]]),
  ...area('sports', [['goal', { event: 'football_goal' }], ['hoops', { event: 'minigame_done', where: { game: 'hoops' } }], ['coach', { event: 'minigame_done', where: { game: 'coach' } }]]),
  ...area('river', [['ferry', { event: 'ferry_board' }, { place: 'ferry' }], ['row', { event: 'boat_board' }, { place: 'kiosk' }], ['fish', { event: 'fishing_catch', count: 3 }, { place: 'fishing' }]]),
];
export const STAMP_AREAS = [...new Set(AREA_STEPS.map((s) => s.area!))];

/** Daily tasks: three a day, picked per player and day. */
export const DAILY_POOL: JourneyStep[] = [
  { id: 'd-quest', kind: 'daily', goal: { event: 'quest_end', where: { status: 'completed' } }, reward: R(15, 3) },
  { id: 'd-cards', kind: 'daily', goal: { event: 'word_card_open', count: 5 }, reward: R(10, 3) },
  { id: 'd-fish', kind: 'daily', goal: { event: 'fishing_catch', count: 2 }, reward: R(10, 3), guide: { place: 'fishing' } },
  { id: 'd-cook', kind: 'daily', goal: { event: 'minigame_done', where: { game: 'cooking' } }, reward: R(15, 3), guide: { place: 'kitchen' } },
  { id: 'd-read', kind: 'daily', goal: { event: 'book_quiz' }, reward: R(15, 3), guide: { place: 'library' } },
  { id: 'd-chat', kind: 'daily', goal: { event: 'chat_send', count: 3 }, reward: R(10, 3) },
  { id: 'd-sport', kind: 'daily', goal: { event: 'minigame_done', where: { game: PLAY } }, reward: R(15, 3), guide: { area: 'sports' } },
  { id: 'd-hug', kind: 'daily', goal: { event: 'critter_hug' }, reward: R(10, 2) },
  { id: 'd-quiz', kind: 'daily', goal: { event: 'quiz_done' }, reward: R(15, 3) },
  { id: 'd-farm', kind: 'daily', goal: { event: 'farm_action', where: { action: 'harvest' } }, reward: R(10, 3), guide: { area: 'farm' } },
  { id: 'd-till', kind: 'daily', goal: { event: 'minigame_done', where: { game: 'checkout' } }, reward: R(15, 3), guide: { area: 'supermarket' } },
  { id: 'd-movie', kind: 'daily', goal: { event: 'minigame_done', where: { game: 'movie' } }, reward: R(15, 3), guide: { area: 'cinema' } },
  { id: 'd-train', kind: 'daily', goal: { event: 'minigame_done', where: { game: 'train' } }, reward: R(15, 3), guide: { area: 'station' } },
];
export const DAILY_COUNT = 3;
export const DAILY_BONUS = R(20, 10);

/** The day's tasks for a player (same everywhere: hash of id + date). */
export function dailyFor(playerId: string, day: string): string[] {
  let h = 2166136261;
  for (const ch of `${playerId}|${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pool = DAILY_POOL.map((s) => s.id);
  const out: string[] = [];
  while (out.length < DAILY_COUNT && pool.length) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]!);
  }
  return out;
}

// ---- weekly challenge (everybody together) and invites ---------------------------------------------------
export interface WeeklyChallenge {
  id: string;
  goal: JourneyGoal;
  /** the whole server's target */
  target: number;
  /** paid to everyone who helped, when the target is reached */
  reward: { xp: number; coins: number };
}
export const WEEKLY: WeeklyChallenge[] = [
  { id: 'w-goals', goal: { event: 'football_goal' }, target: 60, reward: R(60, 30) },
  { id: 'w-quests', goal: { event: 'quest_end', where: { status: 'completed' } }, target: 80, reward: R(60, 30) },
  { id: 'w-fish', goal: { event: 'fishing_catch' }, target: 100, reward: R(60, 30) },
  { id: 'w-books', goal: { event: 'book_quiz' }, target: 50, reward: R(60, 30) },
  { id: 'w-dishes', goal: { event: 'minigame_done', where: { game: 'cooking' } }, target: 50, reward: R(60, 30) },
];
/** Week key in Vietnam time, Monday first: "2026-W45". */
export function weekKey(ms = Date.now()): string {
  const d = new Date(ms + 7 * 3600_000);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
export function weeklyFor(week: string): WeeklyChallenge {
  let h = 0;
  for (const ch of week) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return WEEKLY[h % WEEKLY.length]!;
}
export interface WeeklyView {
  id: string;
  week: string;
  count: number;
  target: number;
  mine: number;
  done: boolean;
}
/** Inviting a friend (link with ?invite=<playerId>): paid when the friend finishes chapter 2. */
export const INVITE_REWARD = R(40, 20);
export const INVITEE_BONUS = R(20, 10);
export const INVITE_PAY_STEP = 'm02-coffee';

export const ALL_STEPS: JourneyStep[] = [...MAIN_STEPS, ...AREA_STEPS, ...DAILY_POOL];
export const stepById = (id: string) => ALL_STEPS.find((s) => s.id === id);

/** Saved per player (User.gameState.journey). */
export interface JourneyState {
  /** finished step ids (main + area) */
  done: string[];
  /** counters for steps that need several events */
  prog: Record<string, number>;
  /** today's daily tasks */
  day: string;
  daily: string[];
  dailyDone: string[];
  dailyProg: Record<string, number>;
  dailyBonus: boolean;
  /** tracked side steps (shown on the HUD under the main one) */
  tracked: string[];
  /** friends who joined with my invite link and finished chapter 2 */
  invited?: number;
}
/** What the API sends to the game. */
export interface JourneyView {
  state: JourneyState;
  /** the current main chapter (index), or MAIN_STEPS.length when all are done */
  chapter: number;
  stamps: string[];
  weekly: WeeklyView | null;
}
/** Pushed by the game server when a step is finished. */
export interface JourneyEvent {
  /** step ids, plus 'daily-bonus', 'weekly', 'invite' (my friend joined), 'welcome' (I joined with an invite) */
  done: { id: string; xp: number; coins: number }[];
  stamp?: string;
}

/** Does an event match a goal? */
export function goalMatches(goal: JourneyGoal, name: string, props: Record<string, unknown>): boolean {
  const names = Array.isArray(goal.event) ? goal.event : [goal.event];
  if (!names.includes(name)) return false;
  for (const [k, want] of Object.entries(goal.where ?? {})) {
    const v = props[k];
    if (Array.isArray(want)) {
      if (!want.some((w) => w === v)) return false;
    } else if (typeof want === 'string' && want.endsWith('*')) {
      if (typeof v !== 'string' || !v.startsWith(want.slice(0, -1))) return false;
    } else if (v !== want) return false;
  }
  return true;
}
