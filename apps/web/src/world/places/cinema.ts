import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';
import { benchPair, frameSeats, registerSeats } from '../seats';

/**
 * Star Cinema & Library in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28),
 * z from the front fence (0) into the yard (-23.5). One building: the cinema foyer on the left (box office,
 * snack bar, a screen room at the back-left), the library on the right behind a partition (open at the front).
 */
export const AREA = areaById('cinema');
export const FRAME = areaFrame(AREA);

export const BUILDING: Building = {
  area: 'cinema',
  x0: -25,
  x1: 25,
  z0: -22,
  z1: -4,
  doorX: 0,
  doorW: 3.6,
  wall: '#f1eaf8',
  roof: '#5e35b1',
  floor: '#4a3b6b',
};

/** Partition between cinema and library (x = 5), open from z = -11 to the front wall. */
export const PARTITION = { x: 5, z0: -22, z1: -11 };
/** Screen room (back-left): walls on its front (z1) and right (x1) side, doorway centred at doorX. */
export const SCREEN_ROOM = { x0: -25, x1: -5, z0: -22, z1: -13, doorX: -16, doorW: 2.4 };
/** Screen on the back wall of the screen room. */
export const SCREEN = { x0: -21, x1: -11, z: -21.7, y0: 0.7, y1: 2.9 };
/** Seat rows (front row first), seat x positions with an aisle in the middle under the doorway. */
export const SEAT_ROWS = [-17.4, -16.0, -14.6];
export const SEAT_XS = [
  -22.4, -21.4, -20.4, -19.4, -18.4, -17.4, -14.6, -13.6, -12.6, -11.6, -10.6, -9.6, -8.6,
];

export const BOX_OFFICE: Aabb = { minX: -12.5, maxX: -7, minZ: -10.4, maxZ: -9.6 };
export const SNACK_BAR: Aabb = { minX: -24, maxX: -19.5, minZ: -10.4, maxZ: -9.6 };
/** Ticket seller behind the box office (local), librarian behind her desk. */
export const USHER_SPOT = { x: -9.75, z: -11.4 };
export const LIBRARIAN_SPOT = { x: 9, z: -14.3 };

export const LIB_DESK: Aabb = { minX: 7, maxX: 11, minZ: -13.4, maxZ: -12.6 };
/** Bookshelves: along the back wall, along the right wall and two free-standing ones. */
export const BOOKSHELVES: (Aabb & { along: 'x' | 'z' })[] = [
  { minX: 5.4, maxX: 24.6, minZ: -21.8, maxZ: -21.1, along: 'x' },
  { minX: 24.0, maxX: 24.7, minZ: -20, maxZ: -6.5, along: 'z' },
  { minX: 12, maxX: 17.5, minZ: -17.9, maxZ: -17.1, along: 'x' },
  { minX: 18.5, maxX: 22.5, minZ: -17.9, maxZ: -17.1, along: 'x' },
];
/** "New books" display rack (LPM library_kit, faces +z) and its A-frame sign; where you stand to browse. */
export const BOOK_DISPLAY = { x: 17, z: -14.2 };
export const BOOK_SPOTS = [
  { x: 17, z: -13.1 },
  { x: 15, z: -20.3 },
];
/** Reading tables (centre, 2.6 × 1.2) with chairs on both long sides. */
export const READING_TABLES = [
  { x: 14, z: -9 },
  { x: 20, z: -9 },
];

const t = 0.2;
const sr = SCREEN_ROOM;
const hd = sr.doorW / 2;
export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(BUILDING),
  { minX: PARTITION.x - t, maxX: PARTITION.x + t, minZ: PARTITION.z0, maxZ: PARTITION.z1 },
  { minX: sr.x0, maxX: sr.doorX - hd, minZ: sr.z1 - t, maxZ: sr.z1 + t },
  { minX: sr.doorX + hd, maxX: sr.x1, minZ: sr.z1 - t, maxZ: sr.z1 + t },
  { minX: sr.x1 - t, maxX: sr.x1 + t, minZ: sr.z0, maxZ: sr.z1 },
  // seat rows, left and right of the aisle
  ...SEAT_ROWS.flatMap((z) => [
    { minX: -22.8, maxX: -17.0, minZ: z - 0.35, maxZ: z + 0.35 },
    { minX: -15.0, maxX: -8.2, minZ: z - 0.35, maxZ: z + 0.35 },
  ]),
  BOX_OFFICE,
  SNACK_BAR,
  LIB_DESK,
  { minX: BOOK_DISPLAY.x - 0.95, maxX: BOOK_DISPLAY.x + 0.95, minZ: BOOK_DISPLAY.z - 0.38, maxZ: BOOK_DISPLAY.z + 0.38 },
  ...BOOKSHELVES.map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ })),
  ...READING_TABLES.map((r) => ({
    minX: r.x - 1.3,
    maxX: r.x + 1.3,
    minZ: r.z - 0.6,
    maxZ: r.z + 0.6,
  })),
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));

// seats: screen-room seats (facing the screen, −z), lobby benches, reading chairs, armchair, forecourt benches
registerSeats(
  frameSeats(FRAME, [
    ...SEAT_ROWS.flatMap((z) => SEAT_XS.map((x): [number, number, number] => [x, z, Math.PI])),
    ...[-15.5, -19.5].flatMap((z): [number, number, number][] => [
      [-3.75, z - 0.6, Math.PI / 2],
      [-3.75, z + 0.6, Math.PI / 2],
    ]),
    ...READING_TABLES.flatMap((t) =>
      [-0.65, 0.65].flatMap((dx): [number, number, number][] => [
        [t.x + dx, t.z - 0.95, 0],
        [t.x + dx, t.z + 0.95, Math.PI],
      ]),
    ),
    [7, -19.9, 0],
    ...benchPair(-14, -2, 0),
    ...benchPair(14, -2, 0),
  ]),
);

/** Screen 1 seat names: rows A (front) … C, seats 1 … 13 from the left (as you face the screen). */
export const SEAT_ROW_NAMES = ['A', 'B', 'C'];
export const seatName = (row: number, n: number) => `${SEAT_ROW_NAMES[row]}${n + 1}`;
/** The Screen 1 seat at this world position (a seat you sit on), or null. */
export function cinemaSeatAt(x: number, z: number): { row: number; n: number } | null {
  const [lx, lz] = FRAME.toLocal(x, z);
  const row = SEAT_ROWS.findIndex((r) => Math.abs(r - lz) < 0.3);
  const n = SEAT_XS.findIndex((sx) => Math.abs(sx - lx) < 0.3);
  return row >= 0 && n >= 0 ? { row, n } : null;
}
