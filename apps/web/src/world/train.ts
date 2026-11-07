import { TRAIN_CAR } from '@es/shared';
import { registerBlockers, type Aabb } from './layout';
import { registerSeats, type Seat } from './seats';

/**
 * The train ride (store/train.ts, scene/TrainRide.tsx): the carriage interior off the map, and the script of a ride on
 * the shared clock, counted in seconds from the train's real departure (timetable + delay, world/places/station.ts).
 * Carriage layout: assets-src/lpm/recipes/train_interior.py (bays at x -5.25 … 5.25, aisle |z| < 0.4).
 */
export const BAYS = [-5.25, -1.75, 1.75, 5.25];
const CX = TRAIN_CAR.x;
const CZ = TRAIN_CAR.z;

/** Seconds after departure. */
export const RIDE = {
  welcome: 5,
  inspect: 13,
  approach: 32,
  arrive: 40,
  leaveDest: 50,
  homeSoon: 60,
  home: 68,
} as const;

/** Train speed (m/s) at t seconds after departure: away, stop at the destination, back home. */
export function speedAt(t: number): number {
  const CRUISE = 22;
  const ramp = (a: number, b: number, from: number, to: number) => from + ((to - from) * (t - a)) / (b - a);
  if (t <= 0) return 0;
  if (t < 6) return ramp(0, 6, 0, CRUISE);
  if (t < RIDE.approach) return CRUISE;
  if (t < RIDE.arrive) return ramp(RIDE.approach, RIDE.arrive, CRUISE, 0);
  if (t < RIDE.leaveDest) return 0;
  if (t < RIDE.leaveDest + 6) return ramp(RIDE.leaveDest, RIDE.leaveDest + 6, 0, CRUISE);
  if (t < RIDE.homeSoon) return CRUISE;
  if (t < RIDE.home) return ramp(RIDE.homeSoon, RIDE.home, CRUISE, 0);
  return 0;
}
/** Metres travelled t seconds after departure. */
export function distAt(t: number): number {
  let d = 0;
  const step = 0.1;
  for (let s = 0; s < t; s += step) d += speedAt(s + step / 2) * Math.min(step, t - s);
  return d;
}
export const DIST_ARRIVE = distAt(RIDE.arrive);
export const DIST_HOME = distAt(RIDE.home);

/** Where you stand after boarding (aisle by a door) and the sitting places (two per seat bench). */
export const carSpot = (dx: number) => ({ x: CX + dx, z: CZ });
const seats: Seat[] = [];
for (const b of BAYS)
  for (const side of [-1, 1])
    for (const dz of [0.65, 1.05])
      for (const [dx, rot] of [
        [-0.8, Math.PI / 2],
        [0.8, -Math.PI / 2],
      ] as const)
        seats.push({ x: CX + b + dx, z: CZ + side * dz, rot });
registerSeats(seats);

const blockers: Aabb[] = [
  // side walls and end walls
  { minX: CX - 7.2, maxX: CX + 7.2, minZ: CZ - 1.5, maxZ: CZ - 1.3 },
  { minX: CX - 7.2, maxX: CX + 7.2, minZ: CZ + 1.3, maxZ: CZ + 1.5 },
  { minX: CX - 7.3, maxX: CX - 7.0, minZ: CZ - 1.5, maxZ: CZ + 1.5 },
  { minX: CX + 7.0, maxX: CX + 7.3, minZ: CZ - 1.5, maxZ: CZ + 1.5 },
  // seat bays (sit with the button; walk in the aisle)
  ...BAYS.flatMap((b) => [-1, 1].map((s) => ({ minX: CX + b - 1.1, maxX: CX + b + 1.1, minZ: s < 0 ? CZ - 1.3 : CZ + 0.42, maxZ: s < 0 ? CZ - 0.42 : CZ + 1.3 }))),
];
registerBlockers(blockers);
