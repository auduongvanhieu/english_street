import { AREA_INFO, type AreaId } from '@es/shared';
import type { Aabb } from './layout';

/**
 * Themed areas. The main street (x axis, road centre z = 0) runs between end fences at x = ±294, with welcome
 * gates over the road at x = ±46 and ±170. North of the road each area has a yard or a building reached
 * through a gap in its front fence (z = -6). Across the river (z 18…38, two footbridges at x = ±50) a second,
 * shorter road runs along the south bank (centre z = 48) with more areas south of it (front fence z = 54).
 *
 *   north:  -294 [cinema][clothes] -170 [restaurant][supermarket] -46 … main street … 46 [zoo][farm] 170 [school][home] 294
 *   south:        -170 [hotel][station]  bridge -50 … bridge 50  [sports][hospital] 170
 *
 * New areas (home, school, …) are built in a local frame (areaFrame): origin at the middle of the front fence,
 * local -z pointing into the yard, so the same scene code works on either side of a road.
 */
export const GATE_X = 46;
/** Welcome gates over the main road. */
export const GATES_X = [46, 170];
export const STREET_END_X = 294;
/** North edge of the street corridor (the pavement in front of the shops / area fences). */
export const CORRIDOR_MIN_Z = -5.5;
export const CORRIDOR_MAX_Z = 17.2;
/** North area yards reach from the front fence (z = -6) north to here. */
export const YARD_MIN_Z = -29.5;
export const FRONT_Z = -6;
/** Depth of every yard (front fence to back). */
export const YARD_DEPTH = FRONT_Z - YARD_MIN_Z;

/** South bank: road centre, its walkable strip (river bank → front fences) and the end of that road. */
export const SOUTH_ROAD_Z = 48;
export const SOUTH_MIN_Z = 39.5;
export const SOUTH_FRONT_Z = SOUTH_ROAD_Z + 6;
export const SOUTH_BACK_Z = SOUTH_FRONT_Z + YARD_DEPTH;
export const SOUTH_END_X = 170;
/** The two footbridges over the river (x = ±BRIDGE_X), walkable half-width. */
export const BRIDGE_X = 50;
export const BRIDGE_HALF = 0.95;

export type AreaSide = 'north' | 'south';

export interface AreaDef {
  id: AreaId;
  icon: string;
  /** English name (learning content, also on the gate sign). */
  name: string;
  x0: number;
  x1: number;
  /** Centre of the gap in the front fence (world x). */
  doorX: number;
  /** Width of that gap. */
  doorW: number;
  color: string;
  /** Which road the area is on: north of the main street or south of the south-bank road. */
  side: AreaSide;
  /** Extra rectangles that count as "inside" besides the yard (farm fields south of the road). */
  extra?: Aabb[];
  /** Bus stop on the pavement across from / beside the area. */
  stopX: number;
}

const def = (id: AreaId, side: AreaSide, x0: number, x1: number, doorX: number, doorW: number, stopX: number, extra?: Aabb[]): AreaDef => ({
  id,
  icon: AREA_INFO[id].icon,
  name: AREA_INFO[id].name,
  color: AREA_INFO[id].color,
  side,
  x0,
  x1,
  doorX,
  doorW,
  stopX,
  extra,
});

export const AREAS: AreaDef[] = [
  // extra: the petting corner across the road (zooLayout.ts PETTING)
  def('zoo', 'north', 50, 106, 78, 6, 78, [{ minX: 84, maxX: 100, minZ: 7, maxZ: 14.8 }]),
  def('farm', 'north', 110, 166, 128, 6, 138, [{ minX: 112, maxX: 164, minZ: 6.5, maxZ: 15.5 }]),
  def('supermarket', 'north', -106, -50, -78, 5, -78),
  def('restaurant', 'north', -166, -110, -138, 4, -138),
  // main street, beyond the second gates
  def('school', 'north', 174, 230, 202, 5, 202),
  def('home', 'north', 234, 290, 262, 4, 262),
  def('clothes', 'north', -230, -174, -202, 4, -202),
  def('cinema', 'north', -290, -234, -262, 5, -255),
  // south bank
  def('station', 'south', -106, -50, -78, 6, -78),
  def('hotel', 'south', -166, -110, -138, 5, -128),
  def('sports', 'south', 50, 106, 78, 6, 78),
  def('hospital', 'south', 110, 166, 138, 5, 140),
];
export const areaById = (id: AreaId) => AREAS.find((a) => a.id === id)!;

/** Road centre (z) the area is on. */
export const roadZ = (a: AreaDef) => (a.side === 'north' ? 0 : SOUTH_ROAD_Z);
/** z of the front fence. */
export const frontZ = (a: AreaDef) => (a.side === 'north' ? FRONT_Z : SOUTH_FRONT_Z);
/** z of the back of the yard. */
export const backZ = (a: AreaDef) => (a.side === 'north' ? YARD_MIN_Z : SOUTH_BACK_Z);
/** Yard rectangle (front fence to back, whole width). */
export const yardRect = (a: AreaDef): Aabb =>
  a.side === 'north' ? { minX: a.x0, maxX: a.x1, minZ: YARD_MIN_Z, maxZ: FRONT_Z } : { minX: a.x0, maxX: a.x1, minZ: SOUTH_FRONT_Z, maxZ: SOUTH_BACK_Z };

/**
 * Local frame of an area: origin at the middle of its front fence, local x along the fence, local -z into the
 * yard (0 … -YARD_DEPTH), local +z towards the road. North areas: world = local + origin. South areas are
 * turned half way round (rotation-y = π).
 */
export interface AreaFrame {
  /** World position of the local origin. */
  ox: number;
  oz: number;
  /** rotation-y of the scene group. */
  rot: number;
  /** Half width of the yard. */
  half: number;
  /** Door gap centre in local x. */
  door: number;
  toWorld: (lx: number, lz: number) => [number, number];
  toLocal: (x: number, z: number) => [number, number];
  /** A local rectangle as a world Aabb. */
  rect: (r: Aabb) => Aabb;
  /** Facing (rotation-y) in the world for a local facing. */
  yaw: (localYaw: number) => number;
}
export function areaFrame(a: AreaDef): AreaFrame {
  const ox = (a.x0 + a.x1) / 2;
  const oz = frontZ(a);
  const s = a.side === 'north' ? 1 : -1;
  const toWorld = (lx: number, lz: number): [number, number] => [ox + s * lx, oz + s * lz];
  return {
    ox,
    oz,
    rot: a.side === 'north' ? 0 : Math.PI,
    half: (a.x1 - a.x0) / 2,
    door: s * (a.doorX - ox),
    toWorld,
    toLocal: (x, z) => [s * (x - ox), s * (z - oz)],
    rect: (r) => {
      const [ax, az] = toWorld(r.minX, r.minZ);
      const [bx, bz] = toWorld(r.maxX, r.maxZ);
      return { minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minZ: Math.min(az, bz), maxZ: Math.max(az, bz) };
    },
    yaw: (y) => (a.side === 'north' ? y : y + Math.PI),
  };
}

export type StopId = 'main' | AreaId;
/** Bus stops: one per area plus the main street. `road` = centre z of the road the bus drives on. */
export const BUS_STOPS: { id: StopId; x: number; z: number; road: number }[] = [
  { id: 'main', x: 0, z: 5.2, road: 0 },
  ...AREAS.map((a) => ({ id: a.id, x: a.stopX, z: roadZ(a) + 5.2, road: roadZ(a) })),
];

const inRect = (x: number, z: number, r: Aabb, m = 0) => x >= r.minX - m && x <= r.maxX + m && z >= r.minZ - m && z <= r.maxZ + m;

/** Is (x, z) on one of the two footbridges? */
export const onBridge = (x: number, z: number) => Math.abs(Math.abs(x) - BRIDGE_X) <= BRIDGE_HALF && z >= CORRIDOR_MAX_Z - 0.5 && z <= SOUTH_MIN_Z + 0.5;

/** Is (x, z) somewhere the player may stand? Street corridors, bridges and every area yard. */
/** Extra walkable floors registered by interiors (hotel corridors and rooms, …) off the street map. */
const extraFloors: Aabb[] = [];
export const registerFloor = (r: Aabb) => void extraFloors.push(r);

export function walkable(x: number, z: number): boolean {
  for (const r of extraFloors) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
  if (x < -STREET_END_X + 0.5 || x > STREET_END_X - 0.5 || z < YARD_MIN_Z || z > SOUTH_BACK_Z) return false;
  if (z >= CORRIDOR_MIN_Z && z <= CORRIDOR_MAX_Z) return true;
  if (onBridge(x, z)) return true;
  if (z >= SOUTH_MIN_Z && z <= SOUTH_FRONT_Z && Math.abs(x) <= SOUTH_END_X - 0.5) return true;
  for (const a of AREAS) {
    const y = yardRect(a);
    if (a.side === 'north' ? x >= y.minX + 0.5 && x <= y.maxX - 0.5 && z >= y.minZ && z <= y.maxZ + 0.6 : x >= y.minX + 0.5 && x <= y.maxX - 0.5 && z >= y.minZ - 0.6 && z <= y.maxZ) return true;
  }
  return false;
}

/** Front fences with their door gap, as blockers (the yard behind is walkable). */
export function areaFenceBlockers(): Aabb[] {
  const out: Aabb[] = [];
  for (const a of AREAS) {
    const h = a.doorW / 2;
    const z = frontZ(a);
    out.push({ minX: a.x0, maxX: a.doorX - h, minZ: z - 0.15, maxZ: z + 0.15 });
    out.push({ minX: a.doorX + h, maxX: a.x1, minZ: z - 0.15, maxZ: z + 0.15 });
  }
  return out;
}

/** Which area is (x, z) in? Yard (behind the front fence) or one of the extra rects. Small hysteresis by the caller. */
export function areaAt(x: number, z: number, margin = 0): AreaId | null {
  for (const a of AREAS) {
    if (x >= a.x0 - margin && x <= a.x1 + margin) {
      if (a.side === 'north' ? z <= FRONT_Z + 0.4 + margin && z >= YARD_MIN_Z - 1 : z >= SOUTH_FRONT_Z - 0.4 - margin && z <= SOUTH_BACK_Z + 1) return a.id;
    }
    for (const r of a.extra ?? []) if (inRect(x, z, r, margin)) return a.id;
  }
  return null;
}

/** Content near enough to be worth drawing (areas are skipped when far away to keep draw calls low). */
export function areaNear(a: AreaDef, x: number, range: number, z?: number): boolean {
  if (z !== undefined && (a.side === 'north' ? z > 30 : z < 8)) return false;
  return x > a.x0 - range && x < a.x1 + range;
}
