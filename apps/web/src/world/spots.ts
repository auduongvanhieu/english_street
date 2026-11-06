import { ENCLOSURES, type Enclosure } from './zooLayout';

/**
 * Critters put down somewhere (server state `spots`: id → "x,z,t"). A critter stays on its spot until someone
 * picks it up again; one dropped into the lion's or tiger's enclosure gets eaten (and is back on its usual
 * walk a while later).
 */
export interface Spot {
  x: number;
  z: number;
  /** server ms when it was put down */
  t: number;
}
export const spots = new Map<string, Spot>();

export function setSpot(id: string, v: string | undefined) {
  const [x, z, t] = (v ?? '').split(',').map(Number);
  if (v && Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(t)) spots.set(id, { x: x!, z: z!, t: t! });
  else spots.delete(id);
}

/** The big cat runs over and pounces this long after the drop… */
export const CHOMP_MS = 2400;
/** …and its meal turns up again on its usual walk after this long. */
export const EATEN_MS = 90_000;

const PREDATORS = new Set(['lion', 'tiger']);
const inside = (e: Enclosure, x: number, z: number, m = 0) => x > e.x0 + m && x < e.x1 - m && z > e.z0 + m && z < e.z1 - m;

/** The lion / tiger enclosure at this point, if any. */
export function predatorPen(x: number, z: number): Enclosure | null {
  return ENCLOSURES.find((e) => PREDATORS.has(e.kind) && inside(e, x, z)) ?? null;
}
/** Any zoo enclosure at this point (to reach over its fence when putting a pet down). */
export function enclosureAt(x: number, z: number): Enclosure | null {
  return ENCLOSURES.find((e) => inside(e, x, z, 0.3)) ?? null;
}

export type SpotState = 'none' | 'stay' | 'scared' | 'eaten';
/** What a critter on a spot is doing now. */
export function spotState(id: string, now: number): SpotState {
  const s = spots.get(id);
  if (!s) return 'none';
  if (!predatorPen(s.x, s.z)) return 'stay';
  const age = now - s.t;
  return age < CHOMP_MS ? 'scared' : age < EATEN_MS ? 'eaten' : 'none';
}

/** Prey in this enclosure the big cat is going for right now (until a while after the pounce). */
export function preyIn(e: Enclosure, now: number): { id: string; x: number; z: number; age: number } | null {
  for (const [id, s] of spots) {
    const age = now - s.t;
    if (age >= 0 && age < CHOMP_MS + 2600 && inside(e, s.x, s.z)) return { id, x: s.x, z: s.z, age };
  }
  return null;
}
