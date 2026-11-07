/**
 * Sunny Sports Park mini-games that the server runs (football) and their world coordinates. The park is laid out in
 * apps/web/src/world/places/sports.ts (area frame); these are the same rectangles in world space (checked in dev).
 */
export const FOOTBALL = {
  /** the pitch in world coordinates; goals at minX (west) and maxX (east) */
  pitch: { minX: 84, maxX: 104, minZ: 63.5, maxZ: 76.5 },
  goalZ: 70,
  /** half the goal mouth (posts at goalZ ± 1.6, minus the post) */
  goalHalf: 1.45,
  goalH: 2.1,
  ballR: 0.17,
  /** a match: this long, or first to WIN_GOALS */
  matchMs: 4 * 60_000,
  winGoals: 5,
  kickReach: 1.3,
} as const;
export type Team = 'red' | 'blue';
/** Red attacks the west goal (x = minX), blue the east goal. */
export const goalOf = (team: Team) => (team === 'red' ? FOOTBALL.pitch.minX : FOOTBALL.pitch.maxX);

export type SportSend =
  /** kick the ball: direction (radians, world, 0 = +z) and power 0..1 */
  | { op: 'kick'; dir: number; power: number }
  | { op: 'team'; team: Team | '' };

export type SportEvent =
  | { op: 'goal'; team: Team; red: number; blue: number; by: string }
  | { op: 'final'; red: number; blue: number }
  | { op: 'kickoff' };

/** Mini-game rewards (POST /me/minigame): XP per result, capped per day per game. */
export const MINIGAMES = {
  football: { win: 20, draw: 12, lose: 6, perDay: 3 },
  hoops: { perPoint: 2, max: 20, perDay: 3 },
  race: { finish: 8, record: 15, perDay: 3 },
  coach: { perPoint: 2, max: 16, perDay: 3 },
  fishing: { perPoint: 2, max: 10, perDay: 6 },
  cooking: { perPoint: 3, max: 18, perDay: 3 },
  /** supermarket checkout: list lines right + the right change (0-6) */
  checkout: { perPoint: 3, max: 18, perDay: 3 },
  /** cinema: questions right after the film (0-3) */
  movie: { perPoint: 4, max: 12, perDay: 3 },
  /** train ride: right destination + right ticket type (0-2) */
  train: { perPoint: 6, max: 12, perDay: 3 },
  /** Maple School: questions right at the end of a timed class (0-3) */
  class: { perPoint: 5, max: 15, perDay: 4 },
  /** hospital: right sentence, body part and medicine (0-3) */
  clinic: { perPoint: 5, max: 15, perDay: 3 },
  /** zoo feeding time: animals fed the right food first time (0-4) */
  zookeeper: { perPoint: 3, max: 12, perDay: 3 },
  /** farm jobs (milking, eggs): the right amount (0-1) */
  farmhand: { perPoint: 6, max: 6, perDay: 6 },
  /** Sunny Bay: the beach hunt (5) and a sandcastle (0-4 steps right) */
  beach: { perPoint: 3, max: 15, perDay: 4 },
  /** Maple Hill: the hike (1-5), packing the backpack (0-4), animal riddles (0-4) */
  hill: { perPoint: 3, max: 15, perDay: 4 },
  /** Riverside: the market list (1-4), helping Lily find her things (1-4) */
  riverside: { perPoint: 3, max: 12, perDay: 4 },
  /** Old Town: telling the time (0-5), the museum questions (0-5) */
  oldtown: { perPoint: 3, max: 15, perDay: 4 },
  /** Word Relay (team game): a win 5, a loss 2, a draw 3 */
  relay: { perPoint: 3, max: 15, perDay: 6 },
  /** table tennis in the sports hall: your points (0-7) */
  pingpong: { perPoint: 2, max: 14, perDay: 4 },
  /** taking passengers across the river: 1 per trip */
  ferryman: { perPoint: 4, max: 4, perDay: 6 },
  /** the other team games: the same scoring as Word Relay */
  hunt: { perPoint: 3, max: 15, perDay: 6 },
  rush: { perPoint: 3, max: 15, perDay: 6 },
  harvest: { perPoint: 3, max: 15, perDay: 6 },
  draw: { perPoint: 3, max: 15, perDay: 6 },
  spell: { perPoint: 3, max: 15, perDay: 6 },
  /** skipping rope: jumps (0-30) */
  jumprope: { perPoint: 1, max: 20, perDay: 4 },
  /** zoo: sorting rubbish into the right bins (0-6) */
  cleaner: { perPoint: 2, max: 12, perDay: 4 },
  /** farm: driving the tractor to the barn (0-3 good drives) */
  tractor: { perPoint: 4, max: 12, perDay: 4 },
} as const;
export type MinigameId = keyof typeof MINIGAMES;
