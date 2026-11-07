import type { AreaFrame } from './areas';
import { BUS_STOPS, walkable } from './areas';
import { PLAYER_RADIUS, buildBlockers } from './layout';

/**
 * Every chair, bench, sofa and bleacher step a player can sit on (restaurant tables have their own system in
 * store/restaurant.ts). World coordinates; `rot` = the direction the seated player faces (rotation.y);
 * `y` = how much higher than a normal chair the seat is (bleachers).
 */
export interface Seat {
  x: number;
  z: number;
  rot: number;
  y?: number;
}
export const SEATS: Seat[] = [];

/** Seats of the place you are in right now (the furniture in a room…), swapped by its scene. */
export const DYN_SEATS: Seat[] = [];
export function setDynamicSeats(list: Seat[]) {
  DYN_SEATS.length = 0;
  DYN_SEATS.push(...list);
}
export function registerSeats(list: Seat[]) {
  SEATS.push(...list);
}

/** Seats given in an area's local frame: [x, z, facing, y?]. */
export function frameSeats(frame: AreaFrame, list: [number, number, number, number?][]): Seat[] {
  return list.map(([x, z, rot, y]) => {
    const [wx, wz] = frame.toWorld(x, z);
    return { x: wx, z: wz, rot: frame.yaw(rot), y };
  });
}

/** Two places on a bench centred at (x, z), `half` apart from the middle along x (local). */
export const benchPair = (x: number, z: number, rot: number, half = 0.55): [number, number, number][] => [
  [x - half, z, rot],
  [x + half, z, rot],
];

/** Nearest seat within `max` metres that `free` accepts. */
export function nearestSeat(x: number, z: number, free: (s: Seat) => boolean, max = 1.6): Seat | null {
  let best: Seat | null = null;
  let bestD = max;
  for (const s of [...SEATS, ...DYN_SEATS]) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD && free(s)) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Somewhere next to the seat to stand up to: in front first, then the sides, then behind. */
export function standSpot(s: Seat): [number, number] {
  const blockers = buildBlockers();
  const fx = Math.sin(s.rot);
  const fz = Math.cos(s.rot);
  const r = PLAYER_RADIUS + 0.02;
  const free = (x: number, z: number) => walkable(x, z) && !blockers.some((b) => x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r);
  for (const d of [0.9, 1.3, 1.8])
    for (const [ax, az] of [
      [fx, fz],
      [fz, -fx],
      [-fz, fx],
      [-fx, -fz],
    ] as const) {
      const x = s.x + ax * d;
      const z = s.z + az * d;
      if (free(x, z)) return [x, z];
    }
  return [s.x + fx * 0.9, s.z + fz * 0.9];
}

// the bench under every bus shelter (scene/areas/Areas.tsx BusStop): the shelter opens towards the road (−z)
registerSeats(BUS_STOPS.flatMap((b) => [-0.5, 0.5].map((dx) => ({ x: b.x + 3 + dx, z: b.z + 0.2, rot: Math.PI }))));
