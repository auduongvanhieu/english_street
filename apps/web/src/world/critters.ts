import { TILE } from './layout';

/**
 * Street life that costs the server nothing: every client evaluates the same deterministic schedule
 * against the shared server clock (net/client.ts serverNow), so everyone sees the cat nap and the dogs
 * trot past at the same moment.
 */
export type CritterKind = 'cat' | 'shiba' | 'husky' | 'duck' | 'duckling' | 'rabbit';
export interface Critter {
  id: string;
  kind: CritterKind;
  name: string;
  /** Loop of waypoints; the critter walks between them and pauses at each one. */
  path: [number, number][];
  speed: number;
  /** Seconds idling at each waypoint. */
  pause: number;
  /** Phase offset so critters sharing a path pattern are not in lock-step. */
  offset: number;
  /** Learning line shown when tapped. */
  sentence: string;
  word: { en: string; vi: string };
  sound: 'meow' | 'woof' | 'quack' | 'squeak';
}

/** Ducks float on the river (Horizon.tsx WATER_Y = -0.3). */
export const DUCK_Y = -0.27;
const BANK = 4.5 * TILE + 2.2; // just off the near river bank (z ≈ 20)
const FAR = 9.5 * TILE + 4; // meadow beyond the far bank fence (z ≈ 42)
/** A swimming loop: an oval on the river around (cx, cz). */
const pond = (cx: number, cz: number, rx: number, rz: number, n = 8): [number, number][] => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cz + Math.sin((i / n) * Math.PI * 2) * rz]);
const PAVE_N = -1 * TILE + 0.9; // north pavement, close to the shops (z ≈ -3.1)
const PAVE_S = 1 * TILE + 0.9; // south pavement, park side (z ≈ 4.9)

export const CRITTERS: Critter[] = [
  { id: 'cat-1', kind: 'cat', name: 'Mochi', path: [[-18, PAVE_N], [-9, PAVE_N], [-12.5, PAVE_N + 1.2]], speed: 1.1, pause: 25, offset: 0, sentence: 'The cat is sleeping in the sun.', word: { en: 'cat', vi: 'con mèo' }, sound: 'meow' },
  { id: 'cat-2', kind: 'cat', name: 'Pepper', path: [[2.5, 2 * TILE + 2.2], [-2.6, 2 * TILE + 1.8], [0, 3 * TILE - 0.6]], speed: 1.0, pause: 18, offset: 40, sentence: 'A black cat is sitting by the fountain.', word: { en: 'fountain', vi: 'đài phun nước' }, sound: 'meow' },
  { id: 'cat-3', kind: 'cat', name: 'Ginger', path: [[23, PAVE_N], [31, PAVE_N], [27, PAVE_N - 0.9]], speed: 1.2, pause: 30, offset: 70, sentence: 'The cat is waiting outside the bank.', word: { en: 'wait', vi: 'chờ, đợi' }, sound: 'meow' },
  { id: 'dog-1', kind: 'shiba', name: 'Biscuit', path: [[-34, PAVE_S], [34, PAVE_S], [34, PAVE_S + 2.5], [-34, PAVE_S + 2.5]], speed: 2.2, pause: 6, offset: 10, sentence: 'The dog is running along the street.', word: { en: 'dog', vi: 'con chó' }, sound: 'woof' },
  // A duck family (mother + 3 ducklings in a row) and a brown duck with two ducklings; ducklings use the
  // mother's loop with a smaller offset, so they paddle along right behind her.
  { id: 'duck-1', kind: 'duck', name: 'Daisy', path: pond(-14, BANK + 2.4, 9, 1.8), speed: 0.7, pause: 0, offset: 0, sentence: 'The duck is swimming with her ducklings.', word: { en: 'duck', vi: 'con vịt' }, sound: 'quack' },
  ...[1, 2, 3].map((i): Critter => ({ id: `duckling-1${i}`, kind: 'duckling', name: ['Pip', 'Pop', 'Peep'][i - 1]!, path: pond(-14, BANK + 2.4, 9, 1.8), speed: 0.7, pause: 0, offset: -1.1 * i, sentence: 'The little duckling follows its mother.', word: { en: 'duckling', vi: 'vịt con' }, sound: 'quack' })),
  { id: 'duck-2', kind: 'duck', name: 'Hazel', path: pond(17, BANK + 3.2, 7, 1.6), speed: 0.6, pause: 0, offset: 30, sentence: 'A brown duck is floating on the river.', word: { en: 'river', vi: 'dòng sông' }, sound: 'quack' },
  ...[1, 2].map((i): Critter => ({ id: `duckling-2${i}`, kind: 'duckling', name: ['Bean', 'Bubbles'][i - 1]!, path: pond(17, BANK + 3.2, 7, 1.6), speed: 0.6, pause: 0, offset: 30 - 1.2 * i, sentence: 'The ducklings are swimming in a line.', word: { en: 'swim', vi: 'bơi' }, sound: 'quack' })),
  // Rabbits hop around the meadow beyond the far bank and the grass outside both end fences.
  { id: 'rabbit-1', kind: 'rabbit', name: 'Clover', path: [[-12, FAR + 1], [-4, FAR + 3], [-9, FAR + 6], [-16, FAR + 3]], speed: 1.4, pause: 7, offset: 0, sentence: 'The rabbit is hopping in the field.', word: { en: 'rabbit', vi: 'con thỏ' }, sound: 'squeak' },
  { id: 'rabbit-2', kind: 'rabbit', name: 'Cotton', path: [[8, FAR + 2], [15, FAR + 5], [21, FAR + 2], [13, FAR + 1]], speed: 1.3, pause: 9, offset: 13, sentence: 'A white rabbit is eating grass.', word: { en: 'grass', vi: 'cỏ' }, sound: 'squeak' },
  { id: 'rabbit-3', kind: 'rabbit', name: 'Hopper', path: [[52, 3 * TILE], [60, 2 * TILE + 1], [66, 3 * TILE + 1], [57, 3 * TILE + 1.5]], speed: 1.5, pause: 6, offset: 5, sentence: 'The rabbit has long ears.', word: { en: 'ear', vi: 'cái tai' }, sound: 'squeak' },
  { id: 'rabbit-4', kind: 'rabbit', name: 'Mocha', path: [[-53, 2 * TILE + 1], [-61, 3 * TILE], [-67, 2 * TILE + 0.5], [-58, 3 * TILE + 1.5]], speed: 1.3, pause: 8, offset: 21, sentence: 'The brown rabbit jumps over the grass.', word: { en: 'jump', vi: 'nhảy' }, sound: 'squeak' },
  { id: 'dog-2', kind: 'husky', name: 'Luna', path: [[-6, 3 * TILE], [6, 3 * TILE], [6, 2 * TILE + 3], [-6, 2 * TILE + 3]], speed: 1.8, pause: 10, offset: 55, sentence: 'A big dog is walking in the park.', word: { en: 'park', vi: 'công viên' }, sound: 'woof' },
];

export interface CritterPose {
  x: number;
  z: number;
  /** Heading in radians (atan2(dx, dz), same convention as players). */
  rot: number;
  clip: 'walk' | 'idle';
  /** 0..1 progress through the current pause (for picking a nap pose). */
  pauseT: number;
}

interface Segment {
  from: [number, number];
  to: [number, number];
  len: number;
  /** cumulative start time of this segment's walk within one loop (seconds) */
  t0: number;
}

const cache = new Map<string, { segs: Segment[]; loop: number }>();
function schedule(c: Critter) {
  let s = cache.get(c.id);
  if (s) return s;
  const segs: Segment[] = [];
  let t = 0;
  for (let i = 0; i < c.path.length; i++) {
    const from = c.path[i]!;
    const to = c.path[(i + 1) % c.path.length]!;
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    segs.push({ from, to, len, t0: t });
    t += len / c.speed + c.pause;
  }
  s = { segs, loop: t };
  cache.set(c.id, s);
  return s;
}

/** Where a critter is at server time `tMs`. */
export function poseAt(c: Critter, tMs: number): CritterPose {
  const { segs, loop } = schedule(c);
  const t = (((tMs / 1000 + c.offset) % loop) + loop) % loop;
  let seg = segs[segs.length - 1]!;
  for (const s of segs) if (t >= s.t0) seg = s;
  const walkDur = seg.len / c.speed;
  const dt = t - seg.t0;
  const dx = seg.to[0] - seg.from[0];
  const dz = seg.to[1] - seg.from[1];
  const rot = Math.atan2(dx, dz);
  if (dt < walkDur) {
    const k = dt / walkDur;
    return { x: seg.from[0] + dx * k, z: seg.from[1] + dz * k, rot, clip: 'walk', pauseT: 0 };
  }
  return { x: seg.to[0], z: seg.to[1], rot, clip: 'idle', pauseT: c.pause > 0 ? (dt - walkDur) / c.pause : 0 };
}
