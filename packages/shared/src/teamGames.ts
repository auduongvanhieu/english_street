/**
 * Team games (game server rooms/teamGames.ts, web store/teamGame.ts, ui/TeamGameHud.tsx). One lobby per zone:
 * two teams (red, blue), a game chosen in the lobby, then a race the game server referees.
 *  - relay: each member answers in turn (the baton passes on a right answer); first to the target wins.
 *  - hunt: English clues to places on the map; any member who gets there moves the team on.
 *  - rush: restaurant orders in three steps (take the order, cook, serve the right table), members take turns.
 *  - harvest: the whole team picks fruit and vegetables following English instructions.
 *  - draw: one member draws a word, the team guesses it (typed); rounds alternate between the teams.
 */
export const TEAM_IDS = ['red', 'blue'] as const;
export type TeamId = (typeof TEAM_IDS)[number];
export const TEAM_MAX = 6;
export const TEAM_COUNTDOWN_S = 4;
export const WRONG_LOCK_S = 2;

export const TEAM_GAMES = {
  relay: { icon: '🏃', name: 'Word Relay', target: 8, maxS: 180, about: 'Take turns: answer right and the next player on your team answers.' },
  hunt: { icon: '🗺️', name: 'Treasure Hunt', target: 5, maxS: 420, about: 'Read the English clues and go to the right places on the map. Anyone on your team can find it.' },
  rush: { icon: '🍔', name: 'Restaurant Rush', target: 5, maxS: 300, about: 'Take the order, cook the right food, serve the right table. Your team takes turns.' },
  harvest: { icon: '🌽', name: 'Harvest Festival', target: 6, maxS: 240, about: 'Everybody picks together: follow the English instructions.' },
  draw: { icon: '🎨', name: 'Draw & Guess', target: 4, maxS: 330, about: 'One player draws a word, the team types what it is. Faster = more points.' },
  spell: { icon: '🐝', name: 'Spelling Bee', target: 8, maxS: 240, about: 'Listen to the word and spell it. Take turns; a wrong spelling stops your team for a moment.' },
} as const;
export type TeamGameId = keyof typeof TEAM_GAMES;
export const TEAM_GAME_IDS = Object.keys(TEAM_GAMES) as TeamGameId[];

/** A small seeded random generator (the same game on every client and the server). */
export function rng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/* ------------------------------------------------------------------------------------------- relay */
/** Words with a picture (emoji): relay questions, draw words. */
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
/** Question n of a game (the same for both teams); `answer` is the right option index. */
export function relayQuestion(seed: number, n: number): RelayQuestion & { answer: number } {
  const r = rng(seed * 7919 + n * 104729 + 13);
  const pick = Math.floor(r() * RELAY_WORDS.length);
  const others: number[] = [];
  while (others.length < 3) {
    const k = Math.floor(r() * RELAY_WORDS.length);
    if (k !== pick && !others.includes(k)) others.push(k);
  }
  const answer = Math.floor(r() * 4);
  const idx = [...others];
  idx.splice(answer, 0, pick);
  const kind = r() < 0.5 ? 'pic' : 'word';
  const [w, e] = RELAY_WORDS[pick]!;
  return kind === 'pic' ? { kind, prompt: w, options: idx.map((i) => RELAY_WORDS[i]![1]), answer } : { kind, prompt: e, options: idx.map((i) => RELAY_WORDS[i]![0]), answer };
}

/* ------------------------------------------------------------------------------------------- hunt */
/** Places on the street map (world x, z; any of `at` counts) and clues to them. */
export const HUNT_PLACES: { id: string; at: [number, number][]; clue: string }[] = [
  { id: 'supermarket', at: [[-78, -8]], clue: 'Go to the place where you can buy fruit, milk and bread.' },
  { id: 'restaurant', at: [[-138, -8]], clue: 'Find the place where a chef cooks dinner for you.' },
  { id: 'clothes', at: [[-202, -8]], clue: 'Go where you can try on a new T-shirt.' },
  { id: 'cinema', at: [[-262, -8]], clue: 'Find the place where you can watch a film and borrow a book.' },
  { id: 'zoo', at: [[78, -8]], clue: 'Go and say hello to the lions and the giraffes.' },
  { id: 'farm', at: [[128, -8]], clue: 'Find the cows, the pigs and the windmill.' },
  { id: 'school', at: [[202, -8]], clue: 'Go to the place where children learn in a classroom.' },
  { id: 'home', at: [[262, -8]], clue: 'Find the cosy house with a kitchen and a garden.' },
  { id: 'station', at: [[-78, 56]], clue: 'Go where you can catch a train.' },
  { id: 'hotel', at: [[-138, 56]], clue: 'Find a place where you can sleep for a night.' },
  { id: 'sports', at: [[78, 56]], clue: 'Go where you can play football and basketball.' },
  { id: 'hospital', at: [[138, 56]], clue: 'Find the place where a doctor helps sick people.' },
  { id: 'fountain', at: [[0, 8]], clue: 'Go to the fountain in the middle of Main Street.' },
  { id: 'bridge', at: [[-50, 28], [50, 28]], clue: 'Walk onto a bridge over the river.' },
];
export const HUNT_RADIUS = 7;
/** The clues of a game: the same five places for both teams, in a different order. */
export function huntPlaces(seed: number, team: TeamId): number[] {
  const r = rng(seed * 31 + 5);
  const all = HUNT_PLACES.map((_, i) => i).sort(() => r() - 0.5).slice(0, TEAM_GAMES.hunt.target);
  const r2 = rng(seed * 17 + (team === 'red' ? 1 : 2));
  return [...all].sort(() => r2() - 0.5);
}

/* ------------------------------------------------------------------------------------------- rush */
export const RUSH_MENU: { id: string; en: string; plural: string; icon: string }[] = [
  { id: 'burger', en: 'a burger', plural: 'burgers', icon: '🍔' },
  { id: 'pizza', en: 'a pizza', plural: 'pizzas', icon: '🍕' },
  { id: 'salad', en: 'a salad', plural: 'salads', icon: '🥗' },
  { id: 'soup', en: 'a bowl of soup', plural: 'bowls of soup', icon: '🍲' },
  { id: 'chips', en: 'some chips', plural: 'portions of chips', icon: '🍟' },
  { id: 'sandwich', en: 'a sandwich', plural: 'sandwiches', icon: '🥪' },
  { id: 'cake', en: 'a piece of cake', plural: 'pieces of cake', icon: '🍰' },
  { id: 'icecream', en: 'an ice cream', plural: 'ice creams', icon: '🍦' },
  { id: 'cola', en: 'a cola', plural: 'colas', icon: '🥤' },
  { id: 'juice', en: 'an orange juice', plural: 'orange juices', icon: '🧃' },
  { id: 'tea', en: 'a cup of tea', plural: 'cups of tea', icon: '🍵' },
  { id: 'coffee', en: 'a coffee', plural: 'coffees', icon: '☕' },
];
export const RUSH_TABLES = 6;
export type RushTicket = Record<string, number>;
export interface RushOrder {
  table: number;
  items: RushTicket;
  sentence: string;
}
const NUM = ['zero', 'one', 'two', 'three'];
const phrase = (id: string, n: number) => {
  const m = RUSH_MENU.find((x) => x.id === id)!;
  return n === 1 ? m.en : `${NUM[n]} ${m.plural}`;
};
/** Order n of a game (the same for both teams). */
export function rushOrder(seed: number, n: number): RushOrder {
  const r = rng(seed * 6007 + n * 911 + 3);
  const kinds = r() < 0.5 ? 1 : 2;
  const items: RushTicket = {};
  while (Object.keys(items).length < kinds) items[RUSH_MENU[Math.floor(r() * RUSH_MENU.length)]!.id] = r() < 0.65 ? 1 : 2;
  const table = 1 + Math.floor(r() * RUSH_TABLES);
  const parts = Object.entries(items).map(([id, q]) => phrase(id, q));
  const list = parts.length === 1 ? parts[0] : `${parts[0]} and ${parts[1]}`;
  const open = ['Can I have', "I'd like", 'Could we have'][Math.floor(r() * 3)]!;
  return { table, items, sentence: `Table ${table}: ${open} ${list}, please?` };
}
/** The ticket as the cook reads it ("2 × burger, 1 × cola"). */
export const ticketText = (t: RushTicket) =>
  Object.entries(t)
    .map(([id, q]) => `${q} × ${RUSH_MENU.find((x) => x.id === id)?.plural.replace(/^(bowls|portions|pieces|cups) of /, '') ?? id}`)
    .join(', ');
export const sameTicket = (a: RushTicket, b: RushTicket) => {
  const ka = Object.entries(a).filter(([, v]) => v > 0);
  const kb = Object.entries(b).filter(([, v]) => v > 0);
  return ka.length === kb.length && ka.every(([k, v]) => b[k] === v);
};
export const RUSH_STEPS = ['order', 'cook', 'serve'] as const;
export type RushStep = (typeof RUSH_STEPS)[number];

/* ------------------------------------------------------------------------------------------- harvest */
export const HARVEST_ITEMS: { id: string; en: string; color: 'red' | 'green' | 'yellow' | 'orange' | 'purple'; icon: string }[] = [
  { id: 'apple', en: 'apple', color: 'red', icon: '🍎' },
  { id: 'greenapple', en: 'apple', color: 'green', icon: '🍏' },
  { id: 'tomato', en: 'tomato', color: 'red', icon: '🍅' },
  { id: 'strawberry', en: 'strawberry', color: 'red', icon: '🍓' },
  { id: 'lemon', en: 'lemon', color: 'yellow', icon: '🍋' },
  { id: 'banana', en: 'banana', color: 'yellow', icon: '🍌' },
  { id: 'corn', en: 'corn', color: 'yellow', icon: '🌽' },
  { id: 'carrot', en: 'carrot', color: 'orange', icon: '🥕' },
  { id: 'pumpkin', en: 'pumpkin', color: 'orange', icon: '🎃' },
  { id: 'orange', en: 'orange', color: 'orange', icon: '🍊' },
  { id: 'grapes', en: 'grapes', color: 'purple', icon: '🍇' },
  { id: 'aubergine', en: 'aubergine', color: 'purple', icon: '🍆' },
  { id: 'broccoli', en: 'broccoli', color: 'green', icon: '🥦' },
  { id: 'cucumber', en: 'cucumber', color: 'green', icon: '🥒' },
  { id: 'pear', en: 'pear', color: 'green', icon: '🍐' },
];
export const HARVEST_GRID = 12;
export interface HarvestTask {
  text: string;
  grid: string[];
  /** grid indexes that are right to pick, and how many to pick */
  right: number[];
  need: number;
}
const PLURALS: Record<string, string> = { apple: 'apples', tomato: 'tomatoes', strawberry: 'strawberries', lemon: 'lemons', banana: 'bananas', corn: 'corn cobs', carrot: 'carrots', pumpkin: 'pumpkins', orange: 'oranges', grapes: 'bunches of grapes', aubergine: 'aubergines', broccoli: 'broccoli', cucumber: 'cucumbers', pear: 'pears' };
/** Task n of a game: a grid of 12 and an instruction ("Pick all the red things!", "Pick two pumpkins!"). */
export function harvestTask(seed: number, n: number): HarvestTask {
  const r = rng(seed * 4241 + n * 769 + 11);
  const grid = Array.from({ length: HARVEST_GRID }, () => HARVEST_ITEMS[Math.floor(r() * HARVEST_ITEMS.length)]!.id);
  const item = (id: string) => HARVEST_ITEMS.find((x) => x.id === id)!;
  const kind = r();
  if (kind < 0.4) {
    const color = item(grid[Math.floor(r() * grid.length)]!).color;
    const right = grid.map((id, i) => (item(id).color === color ? i : -1)).filter((i) => i >= 0);
    return { text: `Pick all the ${color} things!`, grid, right, need: right.length };
  }
  const target = item(grid[Math.floor(r() * grid.length)]!);
  // "two apples" counts red and green apples alike; make sure there are enough of them
  const same = (id: string) => item(id).en === target.en;
  let right = grid.map((id, i) => (same(id) ? i : -1)).filter((i) => i >= 0);
  if (right.length < 2) {
    const j = grid.findIndex((id) => !same(id));
    grid[j] = target.id;
    right = grid.map((id, i) => (same(id) ? i : -1)).filter((i) => i >= 0);
  }
  const need = Math.min(right.length, 2 + Math.floor(r() * 2));
  return { text: `Pick ${NUM[need]} ${PLURALS[target.en] ?? target.en}!`, grid, right, need };
}

/* ------------------------------------------------------------------------------------------- draw */
/** Words to draw (from the picture words, without the article). */
export const DRAW_WORDS = RELAY_WORDS.map(([w]) => w.replace(/^(a|an|the) /, '')).filter((w) => !['T-shirt', 'rain', 'snow', 'milk', 'bread', 'cheese', 'glasses', 'ice cream'].includes(w));
export const DRAW_ROUND_S = 60;
export const normGuess = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\b(a|an|the|it is|its|is)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
/** Points for a right guess after `s` seconds. */
export const drawPoints = (s: number) => (s < 20 ? 3 : s < 40 ? 2 : 1);

/* ------------------------------------------------------------------------------------------- spell */
/** Word n of a spelling bee (the same for both teams): the word and its picture. */
export function spellWord(seed: number, n: number): { word: string; emoji: string } {
  const r = rng(seed * 3571 + n * 199 + 29);
  const list = RELAY_WORDS.filter(([w]) => !/-/.test(w));
  const [w, emoji] = list[Math.floor(r() * list.length)]!;
  return { word: w.replace(/^(a|an|the) /, ''), emoji };
}
export const normSpelling = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------------------------------- state */
export type TeamPhase = 'lobby' | 'countdown' | 'playing' | 'done';
export interface TeamPlayer {
  id: string;
  name: string;
  /** a computer player */
  bot?: boolean;
}
export const BOT_NAMES = ['Robo Ruby', 'Robo Rex', 'Robo Max', 'Robo Mia'];
export interface TeamState {
  phase: TeamPhase;
  game: TeamGameId;
  teams: Record<TeamId, TeamPlayer[]>;
  score: Record<TeamId, number>;
  startsAt: number;
  endsAt: number;
  winner: TeamId | 'draw' | null;
  /** whose turn (relay, rush step), and a team locked after a wrong answer (until, ms) */
  turn: Record<TeamId, string>;
  locked: Record<TeamId, number>;
  relay?: Record<TeamId, (RelayQuestion & { n: number }) | null>;
  /** hunt: the current clue per team, who found the last one */
  hunt?: Record<TeamId, { n: number; clue: string; last: string } | null>;
  rush?: Record<TeamId, { n: number; step: RushStep; order: RushOrder; ticket: RushTicket | null } | null>;
  harvest?: Record<TeamId, { n: number; text: string; grid: string[]; picked: number[]; need: number } | null>;
  /** draw: the round, the drawing team and player, when the round ends, who guessed it */
  draw?: { round: number; team: TeamId; drawer: string; endsAt: number; guessed: string; word: string; strokes: number };
  /** spell: the word to say (the client speaks it, never shows it) and its picture */
  spell?: Record<TeamId, { n: number; word: string; emoji: string } | null>;
}
export type TeamSend =
  | { op: 'hello' }
  | { op: 'join'; team: TeamId }
  /** join the team with fewer players */
  | { op: 'quick' }
  /** add / remove a computer player (relay, hunt, rush, harvest) */
  | { op: 'bot'; team: TeamId }
  | { op: 'kickbot'; team: TeamId }
  | { op: 'leave' }
  | { op: 'game'; game: TeamGameId }
  | { op: 'start' }
  | { op: 'relay'; n: number; choice: number }
  | { op: 'rush'; n: number; step: RushStep; ticket?: RushTicket; table?: number }
  | { op: 'harvest'; n: number; index: number }
  | { op: 'guess'; text: string }
  | { op: 'spell'; n: number; text: string }
  /** a stroke of the drawing: x, y pairs 0…1000 (the drawer only) */
  | { op: 'stroke'; pts: number[]; color: string }
  | { op: 'clear' };
export type TeamEvent =
  | { op: 'state'; state: TeamState }
  | { op: 'feed'; team: TeamId; by: string; ok: boolean; text: string }
  /** to the drawer only: the word to draw */
  | { op: 'word'; word: string }
  | { op: 'stroke'; pts: number[]; color: string }
  | { op: 'strokes'; list: { pts: number[]; color: string }[] }
  | { op: 'clear' };

/* ----------------------------------------------------------------------------- old names (Word Relay v1) */
export const RELAY_TARGET = TEAM_GAMES.relay.target;
export const RELAY_TEAMS = TEAM_IDS;
export type RelayTeam = TeamId;
