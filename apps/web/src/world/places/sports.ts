import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';
import { benchPair, frameSeats, registerSeats } from '../seats';
import { sky } from '../sky';

/**
 * Sunny Sports Park layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z
 * from the front fence (0) into the yard (-23.5). Running track along the front, football pitch on the -x side,
 * basketball court in the middle, the indoor sports hall (walk-in) on the +x side.
 */
export const AREA = areaById('sports');
export const FRAME = areaFrame(AREA);

export const TRACK = { x0: -26, x1: 10, z0: -6.4, z1: -1.4, lanes: 3 };
export const PITCH = { x0: -26, x1: -6, z0: -22.5, z1: -9.5 };
export const COURT = { x0: -3, x1: 9, z0: -22.5, z1: -13 };
export const HALL: Building = { area: 'sports', x0: 12, x1: 27, z0: -22.5, z1: -9, doorX: 19.5, doorW: 3.2, wall: '#e8f1e4', roof: '#43a047', floor: '#d9a066' };
/** Bleachers between the track and the pitch, facing the pitch. */
export const BLEACHERS: Aabb = { minX: -24, maxX: -10, minZ: -8.6, maxZ: -7.2 };
export const SCOREBOARD = { x: -16, z: -23 };
export const COACH = { x: -2.5, z: -9.5 };
export const PING_PONG = [
  { x: 16, z: -4.5 },
  { x: 22.5, z: -4.5 },
];
const goalZ = (PITCH.z0 + PITCH.z1) / 2;

export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(HALL),
  BLEACHERS,
  { minX: SCOREBOARD.x - 2.5, maxX: SCOREBOARD.x + 2.5, minZ: SCOREBOARD.z - 0.3, maxZ: SCOREBOARD.z + 0.3 },
  // goal posts (the mouth stays open), hoop poles
  ...[PITCH.x0 + 0.3, PITCH.x1 - 0.3].flatMap((x) => [-1.6, 1.6].map((dz) => ({ minX: x - 0.6, maxX: x + 0.6, minZ: goalZ + dz - 0.12, maxZ: goalZ + dz + 0.12 }))),
  ...[COURT.x0 - 0.2, COURT.x1 + 0.2].map((x) => ({ minX: x - 0.15, maxX: x + 0.15, minZ: -17.9, maxZ: -17.6 })),
  ...PING_PONG.map((t) => ({ minX: t.x - 1.4, maxX: t.x + 1.4, minZ: t.z - 0.8, maxZ: t.z + 0.8 })),
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));

/** Real weather says rain or storm: the games move into the sports hall (sky.kind is set every frame by Sky). */
export const gamesInHall = () => sky.kind === 'rain' || sky.kind === 'storm';

// seats: three steps of bleachers facing the pitch (−z), the bench in the sports hall
registerSeats(
  frameSeats(FRAME, [
    ...[0, 1, 2].flatMap((i) => {
      const out: [number, number, number, number][] = [];
      for (let x = BLEACHERS.minX + 0.75; x < BLEACHERS.maxX; x += 1.5) out.push([x, BLEACHERS.minZ + 0.25 + i * 0.45, Math.PI, 0.4 * i - 0.07]);
      return out;
    }),
    ...benchPair((HALL.x0 + HALL.x1) / 2, HALL.z1 - 0.8, Math.PI, 0.8),
  ]),
);
