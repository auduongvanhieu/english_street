import { TILE } from './layout';

/**
 * Street life that costs the server nothing: every client evaluates the same deterministic schedule
 * against the shared server clock (net/client.ts serverNow), so everyone sees the cat nap and the dogs
 * trot past at the same moment.
 */
export type CritterKind = 'cat' | 'shiba' | 'husky';
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
  sound: 'meow' | 'woof';
}

const PAVE_N = -1 * TILE + 0.9; // north pavement, close to the shops (z ≈ -3.1)
const PAVE_S = 1 * TILE + 0.9; // south pavement, park side (z ≈ 4.9)

export const CRITTERS: Critter[] = [
  { id: 'cat-1', kind: 'cat', name: 'Mochi', path: [[-18, PAVE_N], [-9, PAVE_N], [-12.5, PAVE_N + 1.2]], speed: 1.1, pause: 25, offset: 0, sentence: 'The cat is sleeping in the sun.', word: { en: 'cat', vi: 'con mèo' }, sound: 'meow' },
  { id: 'cat-2', kind: 'cat', name: 'Pepper', path: [[2.5, 2 * TILE + 2.2], [-2.6, 2 * TILE + 1.8], [0, 3 * TILE - 0.6]], speed: 1.0, pause: 18, offset: 40, sentence: 'A black cat is sitting by the fountain.', word: { en: 'fountain', vi: 'đài phun nước' }, sound: 'meow' },
  { id: 'cat-3', kind: 'cat', name: 'Ginger', path: [[23, PAVE_N], [31, PAVE_N], [27, PAVE_N - 0.9]], speed: 1.2, pause: 30, offset: 70, sentence: 'The cat is waiting outside the bank.', word: { en: 'wait', vi: 'chờ, đợi' }, sound: 'meow' },
  { id: 'dog-1', kind: 'shiba', name: 'Biscuit', path: [[-34, PAVE_S], [34, PAVE_S], [34, PAVE_S + 2.5], [-34, PAVE_S + 2.5]], speed: 2.2, pause: 6, offset: 10, sentence: 'The dog is running along the street.', word: { en: 'dog', vi: 'con chó' }, sound: 'woof' },
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
  return { x: seg.to[0], z: seg.to[1], rot, clip: 'idle', pauseT: (dt - walkDur) / c.pause };
}
