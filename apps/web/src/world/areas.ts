import type { AreaId } from '@es/shared';
import type { Aabb } from './layout';

/**
 * Themed areas along the extended street. The old end fences at x = ±46 became welcome gates; the road
 * now runs to new end fences at x = ±170. North of the road each area has a fenced yard (zoo, farm) or a
 * building (supermarket, restaurant) reached through a gap in its front fence.
 *
 *   x: -170 [restaurant -166…-110] [supermarket -106…-50] gate -46 … main street … gate 46 [zoo 50…106] [farm 110…166] 170
 */
export const GATE_X = 46;
export const STREET_END_X = 170;
/** North edge of the street corridor (the pavement in front of the shops / area fences). */
export const CORRIDOR_MIN_Z = -5.5;
export const CORRIDOR_MAX_Z = 17.2;
/** Area yards reach from the front fence (z = -6) north to here. */
export const YARD_MIN_Z = -29.5;
export const FRONT_Z = -6;

export interface AreaDef {
  id: AreaId;
  icon: string;
  /** English name (learning content, also on the gate sign). */
  name: string;
  x0: number;
  x1: number;
  /** Centre of the gap in the front fence. */
  doorX: number;
  /** Width of that gap. */
  doorW: number;
  color: string;
  /** Extra rectangles that count as "inside" besides the yard (farm fields south of the road). */
  extra?: Aabb[];
  /** Bus stop on the south pavement. */
  stopX: number;
}

export const AREAS: AreaDef[] = [
  // extra: the petting corner across the road (zooLayout.ts PETTING)
  { id: 'zoo', icon: '🦁', name: 'Sunny Hills Zoo', x0: 50, x1: 106, doorX: 78, doorW: 6, color: '#f2a93b', stopX: 78, extra: [{ minX: 84, maxX: 100, minZ: 7, maxZ: 14.8 }] },
  { id: 'farm', icon: '🐄', name: 'Green Valley Farm', x0: 110, x1: 166, doorX: 128, doorW: 6, color: '#8bc34a', stopX: 138, extra: [{ minX: 112, maxX: 164, minZ: 6.5, maxZ: 15.5 }] },
  { id: 'supermarket', icon: '🛒', name: 'FreshWay Supermarket', x0: -106, x1: -50, doorX: -78, doorW: 5, color: '#38b2ac', stopX: -78 },
  { id: 'restaurant', icon: '🍽️', name: 'The Grand Garden Restaurant', x0: -166, x1: -110, doorX: -138, doorW: 4, color: '#e05f5f', stopX: -138 },
];
export const areaById = (id: AreaId) => AREAS.find((a) => a.id === id)!;

/** Bus stops: one per area plus the main street. */
export const BUS_STOPS: { id: 'main' | AreaId; x: number; z: number }[] = [
  { id: 'main', x: 0, z: 5.2 },
  ...AREAS.map((a) => ({ id: a.id, x: a.stopX, z: 5.2 })),
];

const yard = (a: AreaDef): Aabb => ({ minX: a.x0 + 0.5, maxX: a.x1 - 0.5, minZ: YARD_MIN_Z, maxZ: FRONT_Z });

/** Is (x, z) somewhere the player may stand? Street corridor + every area yard. */
export function walkable(x: number, z: number): boolean {
  if (x < -STREET_END_X + 0.5 || x > STREET_END_X - 0.5 || z > CORRIDOR_MAX_Z || z < YARD_MIN_Z) return false;
  if (z >= CORRIDOR_MIN_Z) return true;
  for (const a of AREAS) {
    const y = yard(a);
    if (x >= y.minX && x <= y.maxX && z >= y.minZ && z <= y.maxZ + 0.6) return true;
  }
  return false;
}

/** Front fences with their door gap, as blockers (the yard behind is walkable). */
export function areaFenceBlockers(): Aabb[] {
  const out: Aabb[] = [];
  for (const a of AREAS) {
    const h = a.doorW / 2;
    out.push({ minX: a.x0, maxX: a.doorX - h, minZ: FRONT_Z - 0.15, maxZ: FRONT_Z + 0.15 });
    out.push({ minX: a.doorX + h, maxX: a.x1, minZ: FRONT_Z - 0.15, maxZ: FRONT_Z + 0.15 });
  }
  return out;
}

/** Which area is (x, z) in? Yard (north of the front fence) or one of the extra rects. Small hysteresis by the caller. */
export function areaAt(x: number, z: number, margin = 0): AreaId | null {
  for (const a of AREAS) {
    if (x >= a.x0 - margin && x <= a.x1 + margin && z <= FRONT_Z + 0.4 + margin && z >= YARD_MIN_Z - 1) return a.id;
    for (const r of a.extra ?? []) if (x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin) return a.id;
  }
  return null;
}

/** Content near enough to be worth drawing (areas are skipped when far away to keep draw calls low). */
export function areaNear(a: AreaDef, x: number, range: number): boolean {
  return x > a.x0 - range && x < a.x1 + range;
}
