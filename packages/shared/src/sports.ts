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
} as const;
export type MinigameId = keyof typeof MINIGAMES;
