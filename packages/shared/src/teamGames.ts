/**
 * Team games (game server rooms/teamGames.ts, web store/teamGame.ts). First one: Word Relay - two teams, each
 * member answers in turn (the baton passes on a right answer), the first team to RELAY_TARGET right answers wins.
 */
export const RELAY_TARGET = 8;
export const RELAY_TEAMS = ['red', 'blue'] as const;
export type RelayTeam = (typeof RELAY_TEAMS)[number];
export const RELAY_MAX_PER_TEAM = 6;
/** Seconds: countdown before the start, the lock after a wrong answer, the whole game. */
export const RELAY_COUNTDOWN_S = 4;
export const RELAY_WRONG_LOCK_S = 2;
export const RELAY_MAX_S = 180;

/** Words with a picture (emoji), for "picture → word" and "word → picture" questions. */
export const RELAY_WORDS: [string, string][] = [
  ['an apple', '🍎'], ['a banana', '🍌'], ['a carrot', '🥕'], ['bread', '🍞'], ['cheese', '🧀'], ['an egg', '🥚'],
  ['milk', '🥛'], ['a cake', '🍰'], ['a pizza', '🍕'], ['ice cream', '🍦'], ['a dog', '🐕'], ['a cat', '🐈'],
  ['a horse', '🐎'], ['a cow', '🐄'], ['a pig', '🐖'], ['a chicken', '🐔'], ['a fish', '🐟'], ['a bird', '🐦'],
  ['a rabbit', '🐇'], ['a frog', '🐸'], ['a car', '🚗'], ['a bus', '🚌'], ['a train', '🚆'], ['a bicycle', '🚲'],
  ['a plane', '✈️'], ['a boat', '⛵'], ['a house', '🏠'], ['a school', '🏫'], ['a hospital', '🏥'], ['a book', '📕'],
  ['a pencil', '✏️'], ['a clock', '🕰️'], ['a phone', '📱'], ['a key', '🔑'], ['an umbrella', '☂️'], ['a hat', '🎩'],
  ['a shoe', '👟'], ['a T-shirt', '👕'], ['glasses', '👓'], ['a bag', '👜'], ['the sun', '☀️'], ['the moon', '🌙'],
  ['a star', '⭐'], ['rain', '🌧️'], ['snow', '❄️'], ['a tree', '🌳'], ['a flower', '🌸'], ['a ball', '⚽'],
  ['a guitar', '🎸'], ['a camera', '📷'], ['a gift', '🎁'], ['a bed', '🛏️'], ['a chair', '🪑'], ['a door', '🚪'],
];

export interface RelayQuestion {
  /** 'pic': show the word, pick the picture; 'word': show the picture, pick the word */
  kind: 'pic' | 'word';
  prompt: string;
  options: string[];
}
/** Question n of a game (the same for both teams, from the game's seed); `answer` is the right option index. */
export function relayQuestion(seed: number, n: number): RelayQuestion & { answer: number } {
  let s = (seed * 9301 + n * 49297 + 233280) % 2147483647;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const pick = Math.floor(rnd() * RELAY_WORDS.length);
  const others: number[] = [];
  while (others.length < 3) {
    const k = Math.floor(rnd() * RELAY_WORDS.length);
    if (k !== pick && !others.includes(k)) others.push(k);
  }
  const answer = Math.floor(rnd() * 4);
  const idx = [...others];
  idx.splice(answer, 0, pick);
  const kind = rnd() < 0.5 ? 'pic' : 'word';
  const [w, e] = RELAY_WORDS[pick]!;
  return kind === 'pic' ? { kind, prompt: w, options: idx.map((i) => RELAY_WORDS[i]![1]), answer } : { kind, prompt: e, options: idx.map((i) => RELAY_WORDS[i]![0]), answer };
}

export type RelayPhase = 'lobby' | 'countdown' | 'playing' | 'done';
export interface RelayPlayer {
  id: string;
  name: string;
}
/** What everybody in the zone sees (server → clients). */
export interface RelayState {
  phase: RelayPhase;
  teams: Record<RelayTeam, RelayPlayer[]>;
  /** right answers so far, whose turn it is (session id), the question index, locked until (ms) */
  progress: Record<RelayTeam, number>;
  runner: Record<RelayTeam, string>;
  question: Record<RelayTeam, (RelayQuestion & { n: number }) | null>;
  lockedUntil: Record<RelayTeam, number>;
  startsAt: number;
  endsAt: number;
  winner: RelayTeam | 'draw' | null;
}
export type TeamSend = { op: 'join'; team: RelayTeam } | { op: 'leave' } | { op: 'start' } | { op: 'answer'; n: number; choice: number } | { op: 'hello' };
export type TeamEvent = { op: 'state'; state: RelayState } | { op: 'answer'; team: RelayTeam; by: string; ok: boolean; word: string };
