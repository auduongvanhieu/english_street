import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';
import { benchPair, frameSeats, registerSeats } from '../seats';

/**
 * Style Corner layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z from the
 * front fence (0) into the yard (-23.5). One walk-in boutique: clothes rails on the left, folded jeans and the shoe wall
 * at the back, a display table in the middle, the till on the right and two fitting rooms with a big mirror in the back
 * right corner. LOCAL_BLOCKERS are turned into world blockers below.
 */
export const AREA = areaById('clothes');
export const FRAME = areaFrame(AREA);

export const SHOP: Building = { area: 'clothes', x0: -20, x1: 20, z0: -21, z1: -4, doorX: 0, doorW: 3.6, wall: '#fbeef5', roof: '#d16ba5', floor: '#efe3d3' };

/** Hanging rails (x0…x1 at z): shirts and hoodies on the left, dresses further back. */
export const RAILS: { x0: number; x1: number; z: number; kind: 'tops' | 'dresses' }[] = [
  { x0: -18, x1: -11, z: -9, kind: 'tops' },
  { x0: -18, x1: -11, z: -13, kind: 'tops' },
  { x0: -8, x1: -2, z: -17.2, kind: 'dresses' },
];
/** Shelves of folded jeans along the back wall (left) and the shoe wall (right). */
export const JEANS: Aabb = { minX: -19.6, maxX: -10, minZ: -20.85, maxZ: -20.05 };
export const SHOE_WALL: Aabb = { minX: 1, maxX: 11, minZ: -20.85, maxZ: -20.25 };
/** Display table with folded T-shirts, hats and glasses. */
export const TABLE: Aabb = { minX: -3, maxX: 3, minZ: -12.8, maxZ: -11.2 };
/** Counter with the till; the shop assistant stands behind it. */
export const COUNTER: Aabb = { minX: 11.5, maxX: 17.5, minZ: -9.6, maxZ: -8.6 };
export const STYLIST_SPOT: [number, number] = [14.5, -10.6];
/** Two fitting rooms in the back right corner, curtains on the front (z = FITTING.z1). */
export const FITTING = { x0: 12.6, x1: 19.8, z0: -21, z1: -16.2, split: 16.2 };
/** Big standing mirror on the right wall, between the till and the fitting rooms. */
export const MIRROR = { x: 19.55, z: -13.2, w: 2.2 };
/** Window platforms with mannequins, inside the front wall. */
export const WINDOWS: Aabb[] = [
  { minX: -14.2, maxX: -5, minZ: -5.9, maxZ: -4.2 },
  { minX: 6, maxX: 15.2, minZ: -5.9, maxZ: -4.2 },
];
export const MANNEQUINS: { x: number; z: number; top: string; bottom: string; kind: 'dress' | 'suit' | 'tee' }[] = [
  { x: -12.2, z: -5.1, top: '#ef8fb0', bottom: '#2f3437', kind: 'dress' },
  { x: -7, z: -5.1, top: '#f3d14a', bottom: '#4a6488', kind: 'tee' },
  { x: 8, z: -5.1, top: '#24365c', bottom: '#24365c', kind: 'suit' },
  { x: 13.2, z: -5.1, top: '#43b86a', bottom: '#c2a878', kind: 'tee' },
];
/** Benches in the side gardens (x, z, rotation). */
export const BENCHES: [number, number, number][] = [
  [-24, -12, Math.PI / 2],
  [24, -12, -Math.PI / 2],
];

const thin = 0.2;
export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(SHOP),
  ...RAILS.map((r) => ({ minX: r.x0 - 0.3, maxX: r.x1 + 0.3, minZ: r.z - 0.45, maxZ: r.z + 0.45 })),
  JEANS,
  SHOE_WALL,
  TABLE,
  COUNTER,
  ...WINDOWS,
  // fitting room side walls and divider (the curtains are open: you can step in)
  { minX: FITTING.x0 - thin, maxX: FITTING.x0 + thin, minZ: FITTING.z0, maxZ: FITTING.z1 },
  { minX: FITTING.split - thin, maxX: FITTING.split + thin, minZ: FITTING.z0, maxZ: FITTING.z1 },
  { minX: MIRROR.x - 0.3, maxX: SHOP.x1, minZ: MIRROR.z - MIRROR.w / 2, maxZ: MIRROR.z + MIRROR.w / 2 },
  ...BENCHES.map(([x, z]) => ({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.9, maxZ: z + 0.9 })),
  // hedges along the sides and the back of the yard
  { minX: -28, maxX: -27.4, minZ: -23.5, maxZ: 0 },
  { minX: 27.4, maxX: 28, minZ: -23.5, maxZ: 0 },
  { minX: -28, maxX: 28, minZ: -23.5, maxZ: -22.9 },
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));

// seats: garden benches (along z, facing their rotation) and the pouf by the fitting rooms
registerSeats(
  frameSeats(FRAME, [
    ...BENCHES.flatMap(([x, z, r]): [number, number, number][] => [
      [x, z - 0.45, r],
      [x, z + 0.45, r],
    ]),
    [10.4, -14.6, 0],
  ]),
);
