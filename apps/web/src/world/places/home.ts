import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';
import { benchPair, frameSeats, registerSeats } from '../seats';

/**
 * Home layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z from the
 * front fence (0) into the yard (-23.5). A one-storey house with four rooms (cut-away while you are inside)
 * and a front garden. LOCAL_BLOCKERS are turned into world blockers below.
 */
export const AREA = areaById('home');
export const FRAME = areaFrame(AREA);

export const HOUSE: Building = { area: 'home', x0: -16, x1: 16, z0: -22, z1: -9, doorX: 0, doorW: 2.4, wall: '#fff1dc', roof: '#c4553a', floor: '#d8b48a' };
/** Wall between the front rooms and the back rooms. */
export const MID_Z = -15.5;
export const INNER_H = 1.05;

export interface Room {
  id: string;
  label: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  floor: string;
}
export const ROOMS: Room[] = [
  { id: 'living-room', label: 'LIVING ROOM', x0: -16, x1: 4, z0: MID_Z, z1: -9, floor: '#d8b48a' },
  { id: 'kitchen', label: 'KITCHEN', x0: 4, x1: 16, z0: MID_Z, z1: -9, floor: '#e9e3d3' },
  { id: 'bedroom', label: 'BEDROOM', x0: -16, x1: -4, z0: -22, z1: MID_Z, floor: '#b9cde6' },
  { id: 'bathroom', label: 'BATHROOM', x0: -4, x1: 4, z0: -22, z1: MID_Z, floor: '#d6eef0' },
  { id: 'dining', label: 'DINING ROOM', x0: 4, x1: 16, z0: -22, z1: MID_Z, floor: '#e3c9a0' },
];

/** Low inner walls (local), door gaps left open. */
const T = 0.08;
export const INNER_WALLS: Aabb[] = [
  // between front and back rooms: gaps at x -9 (bedroom), 0 (bathroom), 10 (dining room)
  { minX: -16, maxX: -9.8, minZ: MID_Z - T, maxZ: MID_Z + T },
  { minX: -8.2, maxX: -0.8, minZ: MID_Z - T, maxZ: MID_Z + T },
  { minX: 0.8, maxX: 9.2, minZ: MID_Z - T, maxZ: MID_Z + T },
  { minX: 10.8, maxX: 16, minZ: MID_Z - T, maxZ: MID_Z + T },
  // living room | kitchen, gap at z -12.2
  { minX: 4 - T, maxX: 4 + T, minZ: MID_Z, maxZ: -13 },
  { minX: 4 - T, maxX: 4 + T, minZ: -11.4, maxZ: -9 },
  // bedroom | bathroom | dining room
  { minX: -4 - T, maxX: -4 + T, minZ: -22, maxZ: MID_Z },
  { minX: 4 - T, maxX: 4 + T, minZ: -22, maxZ: MID_Z },
];

/** Furniture with a word card: tapping it in the scene opens the card. x, z = centre, w × d footprint. */
export interface Furniture {
  item: string;
  x: number;
  z: number;
  w: number;
  d: number;
  /** Solid (a blocker)? Small things on the wall or on other furniture are not. */
  solid?: boolean;
}
export const FURNITURE: Furniture[] = [
  // living room
  { item: 'sofa', x: -11.5, z: -14.7, w: 3.2, d: 1.0, solid: true },
  { item: 'table', x: -11.5, z: -12.6, w: 1.6, d: 0.8, solid: true },
  { item: 'chair', x: -7.4, z: -13.9, w: 1.0, d: 1.0, solid: true },
  { item: 'bookcase', x: -5.2, z: -15.1, w: 1.8, d: 0.5, solid: true },
  { item: 'lamp', x: -14.8, z: -14.9, w: 0.5, d: 0.5, solid: true },
  { item: 'plant', x: 3.2, z: -9.7, w: 0.6, d: 0.6, solid: true },
  { item: 'clock', x: -11.5, z: MID_Z + 0.12, w: 0.6, d: 0.1 },
  // kitchen
  { item: 'fridge', x: 15.35, z: -14.75, w: 1.0, d: 1.2, solid: true },
  { item: 'cooker', x: 15.4, z: -12.9, w: 0.9, d: 1.2, solid: true },
  { item: 'sink', x: 15.4, z: -11.3, w: 0.9, d: 1.4, solid: true },
  { item: 'cupboard', x: 15.4, z: -9.85, w: 0.9, d: 1.4, solid: true },
  { item: 'cup', x: 8.5, z: -12.8, w: 0.3, d: 0.3 },
  { item: 'bowl', x: 9.3, z: -12.6, w: 0.3, d: 0.3 },
  // bedroom
  { item: 'bed', x: -13.6, z: -20.6, w: 2.0, d: 2.8, solid: true },
  { item: 'desk', x: -7.2, z: -21.5, w: 1.9, d: 0.8, solid: true },
  { item: 'wardrobe', x: -15.5, z: -16.9, w: 0.8, d: 1.8, solid: true },
  { item: 'teddy-bear', x: -13.6, z: -21.3, w: 0.4, d: 0.4 },
  { item: 'ball', x: -12.8, z: -19.6, w: 0.4, d: 0.4 },
  { item: 'window', x: -10, z: -21.92, w: 1.6, d: 0.1 },
  // bathroom
  { item: 'bath', x: -1.6, z: -21.35, w: 2.6, d: 1.1, solid: true },
  { item: 'toilet', x: 2.9, z: -21.5, w: 0.6, d: 0.8, solid: true },
  { item: 'sink', x: 3.6, z: -18.6, w: 0.6, d: 0.9, solid: true },
  { item: 'mirror', x: 3.88, z: -18.6, w: 0.1, d: 0.8 },
  { item: 'toothbrush', x: 3.55, z: -18.2, w: 0.2, d: 0.2 },
  { item: 'soap', x: 3.55, z: -19.0, w: 0.2, d: 0.2 },
  // dining room
  { item: 'table', x: 10, z: -19, w: 2.6, d: 1.4, solid: true },
  // garden
  { item: 'garden', x: 5, z: -6.5, w: 4.5, d: 1.8, solid: true },
  { item: 'door', x: 0, z: -9, w: 2.4, d: 0.3 },
  { item: 'keys', x: -1.6, z: -9.25, w: 0.3, d: 0.2 },
];

/** Front-garden things (local). */
export const FLOWER_BEDS: Aabb[] = [
  { minX: -7.25, maxX: -2.75, minZ: -7.4, maxZ: -5.6 },
  { minX: 2.75, maxX: 7.25, minZ: -7.4, maxZ: -5.6 },
];
export const SHED: Aabb = { minX: -25.5, maxX: -21, minZ: -21.5, maxZ: -17.5 };
export const WASHING_LINE = { x0: 17.5, x1: 25.5, z: -5 };
export const KENNEL: Aabb = { minX: 19.2, maxX: 20.8, minZ: -15.2, maxZ: -13.8 };
export const TREES: [number, number, number][] = [
  [-24.5, -3, 1.1],
  [24.5, -21, 1.2],
  [-19, -11.5, 0.9],
  [22, -10.5, 0.8],
];
export const BENCH: Aabb = { minX: -22, maxX: -19.6, minZ: -6.3, maxZ: -5.7 };

/** Mum stands in the living room, just inside the front door. */
export const MUM = { x: -2.6, z: -11.6 };

const r = (x: number, z: number, w: number, d: number): Aabb => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(HOUSE),
  ...INNER_WALLS,
  ...FURNITURE.filter((f) => f.solid && f.item !== 'garden').map((f) => r(f.x, f.z, f.w, f.d)),
  ...FURNITURE.filter((f) => f.item === 'table' && f.z < -18).flatMap(() => [r(10, -17.9, 2.4, 0.5), r(10, -20.1, 2.4, 0.5)]), // dining chairs
  ...FLOWER_BEDS,
  SHED,
  KENNEL,
  BENCH,
  r(WASHING_LINE.x0, WASHING_LINE.z, 0.3, 0.3),
  r(WASHING_LINE.x1, WASHING_LINE.z, 0.3, 0.3),
  ...TREES.map(([x, z]) => r(x, z, 0.5, 0.5)),
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));

// seats: sofa, armchair, dining chairs, garden bench
registerSeats(
  frameSeats(FRAME, [
    [-12.3, -14.55, 0],
    [-11.5, -14.55, 0],
    [-10.7, -14.55, 0],
    [-7.4, -13.8, 0],
    ...[9.4, 10.6].flatMap((x): [number, number, number][] => [
      [x, -20.05, 0],
      [x, -17.95, Math.PI],
    ]),
    ...benchPair((BENCH.minX + BENCH.maxX) / 2, -6, 0),
  ]),
);
