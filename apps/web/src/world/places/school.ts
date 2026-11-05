import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';

/**
 * School layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z from the
 * front fence (0) into the yard (-23.5). The school building (classroom + library corner) is on the left, the
 * playground on the right. LOCAL_BLOCKERS are turned into world blockers below.
 */
export const AREA = areaById('school');
export const FRAME = areaFrame(AREA);

export const SCHOOL: Building = { area: 'school', x0: -26, x1: 2, z0: -22.8, z1: -10, doorX: -16, doorW: 2.6, wall: '#fdf3df', roof: '#5b8def', floor: '#e6d3ad' };
/** Low wall between the classroom (left) and the library corner (right), gap near the front. */
export const LIB_X = -7;
export const PARTITION: Aabb[] = [
  { minX: LIB_X - 0.08, maxX: LIB_X + 0.08, minZ: SCHOOL.z0, maxZ: -13.1 },
  { minX: LIB_X - 0.08, maxX: LIB_X + 0.08, minZ: -11.1, maxZ: SCHOOL.z1 },
];

/** Pupils' desks: two groups of two columns either side of the middle aisle (x = door), three rows. */
export const DESK_COLS = [-23.4, -20.6, -11.4, -8.6];
export const DESK_ROWS = [-18.0, -15.6, -13.2];
export const TEACHER_DESK: Aabb = { minX: -17.1, maxX: -14.9, minZ: -20.65, maxZ: -19.75 };
export const BOARD = { x: -16, w: 6.4, y: 1.75, h: 1.9 };
/** Library: bookcases on the back and right walls, a reading table. */
export const BOOKCASES: Aabb[] = [
  { minX: -6.2, maxX: -2.6, minZ: -22.65, maxZ: -22.15 },
  { minX: -2.2, maxX: 1.4, minZ: -22.65, maxZ: -22.15 },
  { minX: 1.35, maxX: 1.85, minZ: -20.5, maxZ: -15.5 },
];
export const READING_TABLE: Aabb = { minX: -4.4, maxX: -1.6, minZ: -18.2, maxZ: -16.8 };

/** Playground (right half). */
export const COURT: Aabb = { minX: 11, maxX: 27, minZ: -23, maxZ: -13 };
export const HOOP = { x: 19, z: -22.4 };
export const SWINGS = { x0: 5.6, x1: 9.8, z: -19.5 };
export const HOPSCOTCH = { x: 16, z0: -11, step: 0.9 };
export const FLAG = { x: -4.2, z: -5.2 };
export const BENCHES: Aabb[] = [
  { minX: 21.8, maxX: 24.2, minZ: -10.3, maxZ: -9.7 },
  { minX: 5.6, maxX: 8, minZ: -14.3, maxZ: -13.7 },
];
export const BIKE_RACK: Aabb = { minX: -24, maxX: -19.5, minZ: -6.4, maxZ: -5.6 };
export const TREES: [number, number, number][] = [
  [-26, -2.6, 1.1],
  [26, -3, 1.1],
  [26, -11.5, 0.9],
  [6.5, -6.5, 0.9],
];

/** Things with a word card (tap in the scene). The board and the timetable open the activity instead. */
export const SPOTS: { item: string; x: number; z: number; r: number }[] = [
  { item: 'board', x: BOARD.x, z: SCHOOL.z0 + 0.1, r: 3.3 },
  { item: 'timetable', x: -25.8, z: -16.5, r: 1.2 },
  { item: 'desk', x: -16, z: -20.2, r: 1.2 },
  ...DESK_COLS.flatMap((x) => DESK_ROWS.map((z) => ({ item: 'desk', x, z, r: 0.8 }))),
  { item: 'book', x: -16.5, z: -20.2, r: 0.4 },
  { item: 'schoolbag', x: -25.6, z: -12, r: 1.2 },
  { item: 'library', x: -2.5, z: -22.4, r: 3 },
  { item: 'dictionary', x: -3, z: -17.5, r: 1.4 },
  { item: 'playground', x: 7.7, z: -19.5, r: 2.4 },
  { item: 'pe', x: HOOP.x, z: HOOP.z, r: 1.5 },
  { item: 'geography', x: -9.2, z: -22.3, r: 0.8 },
  { item: 'school', x: FLAG.x, z: FLAG.z, r: 1 },
];

/** Ms. Green stands next to her desk, in front of the board. */
export const TEACHER = { x: -13.4, z: -20.6 };

const r = (x: number, z: number, w: number, d: number): Aabb => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(SCHOOL),
  ...PARTITION,
  // each pair of desks with its chairs
  ...[-22, -10].flatMap((x) => DESK_ROWS.map((z) => ({ minX: x - 2.1, maxX: x + 2.1, minZ: z - 0.35, maxZ: z + 0.85 }))),
  TEACHER_DESK,
  ...BOOKCASES,
  READING_TABLE,
  r(HOOP.x, HOOP.z, 0.4, 0.4),
  r(SWINGS.x0, SWINGS.z, 0.4, 1.4),
  r(SWINGS.x1, SWINGS.z, 0.4, 1.4),
  r(FLAG.x, FLAG.z, 0.6, 0.6),
  ...BENCHES,
  BIKE_RACK,
  ...TREES.map(([x, z]) => r(x, z, 0.5, 0.5)),
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));
