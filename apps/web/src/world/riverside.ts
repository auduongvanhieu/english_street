import { RIVERSIDE } from '@es/shared';
import { registerBlockers, type Aabb } from './layout';
import { registerSeats } from './seats';

/**
 * Riverside village (world coordinates, south of Sunny Bay; RIVERSIDE in @es/shared), reached by train. The station
 * is at the top (north), then the market square, the river path, the river (one stone bridge) and the mill bank.
 *   station z -668 … -661 · market z -705 … -672 · path z -733 … -715 · river z -745 … -733 · mill bank z < -745
 */
export const VILLAGE = RIVERSIDE;
export const PLATFORM = { x0: -22, x1: 22, z0: -668, z1: -661 };
export const ARRIVE = { x: 0, z: -671 };
export const SHELTER = { x: 0, z: -663.5 };
export const RIVER = { z0: -745, z1: -733 };
export const BRIDGE = { x: 20, z: -739 };
export const MILL = { x: -25, z: -752 };
/** The water wheel on the mill's east side (axle along x), in its own little pond. */
export const WHEEL = { x: MILL.x + 3.35, y: 1.6, z: MILL.z };
export const MILL_POND = { minX: -22.6, maxX: -19.6, minZ: -755, maxZ: -749 };
export const BOAT = { x: 8, z: -736 };
export const BENCH = { x: -8, z: -729.6 };
export const WILLOWS: [number, number][] = [
  [35, -756],
  [43, -756],
  [-45, -723],
  [52, -760],
  [-50, -760],
];
export const PARASOLS: [number, number][] = [
  [24, -699],
  [30, -693],
];
export const POST_BOX = { x: 24, z: -677 };
export const COTTAGES: { x: number; z: number; rot: number; b?: boolean }[] = [
  { x: -42, z: -682, rot: Math.PI / 2 },
  { x: -42, z: -697, rot: Math.PI / 2, b: true },
  { x: 45, z: -684, rot: -Math.PI / 2, b: true },
  { x: -10, z: -762, rot: 0 },
  { x: 8, z: -762, rot: 0, b: true },
];
export const LOST_BOARD = { x: 6.5, z: -726 };
export const LIST_BOARD = { x: 5, z: -676 };

/** Market stalls: the front (the counter) faces the square; customers stand 2 m in front. */
export interface Stall {
  id: string;
  name: string;
  x: number;
  z: number;
  rot: number;
  green?: boolean;
}
export const STALLS: Stall[] = [
  { id: 'fruit', name: 'Fruit & Veg', x: -12, z: -684, rot: Math.PI / 2 },
  { id: 'bakery', name: 'Bakery', x: -12, z: -694, rot: Math.PI / 2, green: true },
  { id: 'dairy', name: 'Dairy', x: 12, z: -684, rot: -Math.PI / 2, green: true },
  { id: 'flowers', name: 'Flowers', x: 12, z: -694, rot: -Math.PI / 2 },
  { id: 'drinks', name: 'Honey & Drinks', x: 0, z: -703, rot: 0, green: true },
];
export const stallFront = (s: Stall, d = 2) => ({ x: s.x + Math.sin(s.rot) * d, z: s.z + Math.cos(s.rot) * d });

/** Places where Lily may have lost something (prepositions of place). */
export const SPOTS: { id: string; en: string; x: number; z: number }[] = [
  { id: 'bridge', en: 'on the bridge', x: BRIDGE.x, z: BRIDGE.z },
  { id: 'bench', en: 'on the bench', x: BENCH.x, z: BENCH.z + 0.9 },
  { id: 'millfront', en: 'in front of the mill', x: MILL.x, z: -747.2 },
  { id: 'millback', en: 'behind the mill', x: MILL.x, z: -757.5 },
  { id: 'trees', en: 'between the two trees', x: 39, z: -756 },
  { id: 'boat', en: 'next to the boat', x: BOAT.x, z: RIVER.z1 + 1.8 },
  { id: 'umbrella', en: 'under the big umbrella', x: PARASOLS[0]![0] + 1.2, z: PARASOLS[0]![1] + 1.2 },
  { id: 'postbox', en: 'next to the post box', x: POST_BOX.x + 1.2, z: POST_BOX.z },
  { id: 'bakery', en: 'in front of the bakery', x: stallFront(STALLS[1]!, 2.4).x, z: stallFront(STALLS[1]!, 2.4).z },
];

const t = 0.3;
const box = (x: number, z: number, hx: number, hz: number): Aabb => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
/** A stall's footprint (3 x 1.6, turned with it). */
const stallBox = (s: Stall) => (Math.abs(Math.sin(s.rot)) > 0.5 ? box(s.x, s.z, 0.85, 1.55) : box(s.x, s.z, 1.55, 0.85));
export const BLOCKERS: Aabb[] = [
  { minX: VILLAGE.minX - t, maxX: VILLAGE.minX, minZ: VILLAGE.minZ, maxZ: VILLAGE.maxZ },
  { minX: VILLAGE.maxX, maxX: VILLAGE.maxX + t, minZ: VILLAGE.minZ, maxZ: VILLAGE.maxZ },
  { minX: VILLAGE.minX, maxX: VILLAGE.maxX, minZ: PLATFORM.z1, maxZ: PLATFORM.z1 + t },
  { minX: VILLAGE.minX, maxX: VILLAGE.maxX, minZ: VILLAGE.minZ - t, maxZ: VILLAGE.minZ },
  // the river, except the bridge (its stone walls are solid)
  { minX: VILLAGE.minX, maxX: BRIDGE.x - 1.35, minZ: RIVER.z0, maxZ: RIVER.z1 },
  { minX: BRIDGE.x + 1.35, maxX: VILLAGE.maxX, minZ: RIVER.z0, maxZ: RIVER.z1 },
  box(BRIDGE.x - 1.5, BRIDGE.z, 0.15, 8),
  box(BRIDGE.x + 1.5, BRIDGE.z, 0.15, 8),
  box(SHELTER.x, SHELTER.z + 1.15, 3.1, 0.15),
  box(MILL.x, MILL.z, 3.1, 2.6),
  MILL_POND,
  ...STALLS.map(stallBox),
  ...COTTAGES.map((c) => box(c.x, c.z, Math.abs(Math.sin(c.rot)) > 0.5 ? 2.6 : 3.1, Math.abs(Math.sin(c.rot)) > 0.5 ? 3.1 : 2.6)),
  ...WILLOWS.map(([x, z]) => box(x, z, 0.4, 0.4)),
  ...PARASOLS.map(([x, z]) => box(x, z, 0.5, 0.5)),
  box(POST_BOX.x, POST_BOX.z, 0.3, 0.3),
  box(BENCH.x, BENCH.z, 0.8, 0.25),
  box(LOST_BOARD.x, LOST_BOARD.z, 0.7, 0.12),
  box(LIST_BOARD.x, LIST_BOARD.z, 0.7, 0.12),
  box(0, -687.8, 0.7, 0.12),
];
registerBlockers(BLOCKERS);
registerSeats([
  ...[-1, 0, 1].map((k) => ({ x: SHELTER.x + k * 0.9, z: SHELTER.z + 0.55, rot: Math.PI })),
  // the river bench faces the river (south)
  ...[-0.4, 0.4].map((dx) => ({ x: BENCH.x + dx, z: BENCH.z, rot: Math.PI })),
]);
