import type { AreaId } from '@es/shared';
import { registerBlockers, type Aabb } from './layout';

/**
 * The two walk-in buildings: FreshWay Supermarket and The Grand Garden Restaurant. Walls are thin blockers
 * with a door gap in the front wall; the scenes hide the front wall and roof while the player is inside.
 */
export interface Building {
  area: AreaId | string;
  x0: number;
  x1: number;
  z0: number;
  /** front wall (south) */
  z1: number;
  doorX: number;
  doorW: number;
  wall: string;
  roof: string;
  floor: string;
}

export const SUPERMARKET: Building = { area: 'supermarket', x0: -100, x1: -56, z0: -28.5, z1: -9, doorX: -78, doorW: 4.6, wall: '#e8f4f2', roof: '#2a9d8f', floor: '#f2efe6' };
export const RESTAURANT: Building = { area: 'restaurant', x0: -160, x1: -116, z0: -28.5, z1: -9, doorX: -138, doorW: 3.6, wall: '#f6e7d2', roof: '#b5452f', floor: '#c99a6b' };

export function insideBuilding(b: Building, x: number, z: number) {
  return x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
}

/** Wall blockers of a building (door gap in the front wall), in the building's own coordinates. */
export function walls(b: Building): Aabb[] {
  const t = 0.2;
  const h = b.doorW / 2;
  return [
    { minX: b.x0, maxX: b.x1, minZ: b.z0 - t, maxZ: b.z0 + t },
    { minX: b.x0 - t, maxX: b.x0 + t, minZ: b.z0, maxZ: b.z1 },
    { minX: b.x1 - t, maxX: b.x1 + t, minZ: b.z0, maxZ: b.z1 },
    { minX: b.x0, maxX: b.doorX - h, minZ: b.z1 - t, maxZ: b.z1 + t },
    { minX: b.doorX + h, maxX: b.x1, minZ: b.z1 - t, maxZ: b.z1 + t },
  ];
}

// ---------------------------------------------------------------- supermarket interior
export interface Shelf {
  category: string;
  x0: number;
  x1: number;
  z: number;
  /** 'shelf' = double-sided gondola, 'fridge' = against the back wall, 'stand' = low produce stand */
  type: 'shelf' | 'fridge' | 'stand';
}
export const SHELVES: Shelf[] = [
  { category: 'fruit-veg', x0: -97, x1: -83, z: -14.2, type: 'stand' },
  { category: 'bakery', x0: -97, x1: -83, z: -19, type: 'shelf' },
  { category: 'snacks', x0: -97, x1: -83, z: -23.6, type: 'shelf' },
  { category: 'dairy', x0: -73, x1: -59, z: -14.2, type: 'shelf' },
  { category: 'drinks', x0: -73, x1: -59, z: -19, type: 'shelf' },
  { category: 'household', x0: -73, x1: -59, z: -23.6, type: 'shelf' },
  { category: 'meat-fish', x0: -98, x1: -80, z: -27.7, type: 'fridge' },
  { category: 'frozen', x0: -76, x1: -58, z: -27.7, type: 'fridge' },
];
/** Checkout counters (the cashier NPC stands behind the first). */
export const CHECKOUTS: Aabb[] = [
  { minX: -93.5, maxX: -88.5, minZ: -12.2, maxZ: -11.4 },
  { minX: -67.5, maxX: -62.5, minZ: -12.2, maxZ: -11.4 },
];

// ---------------------------------------------------------------- restaurant interior
export interface Table {
  id: number;
  x: number;
  z: number;
  /** chairs: world position + facing (rotation.y the seated player faces) */
  seats: { x: number; z: number; rot: number }[];
}
export const TABLES: Table[] = [];
{
  let id = 0;
  for (const x of [-154, -146, -130, -122]) {
    for (const z of [-14.5, -20.5]) {
      TABLES.push({ id: id++, x, z, seats: [{ x, z: z - 1.0, rot: 0 }, { x, z: z + 1.0, rot: Math.PI }] });
    }
  }
}
export const BAR: Aabb = { minX: -150, maxX: -126, minZ: -26.4, maxZ: -25.4 };
export const TABLE_R = 0.75;

registerBlockers([
  ...walls(SUPERMARKET),
  ...walls(RESTAURANT),
  ...SHELVES.map((s) => ({ minX: s.x0, maxX: s.x1, minZ: s.z - (s.type === 'fridge' ? 0.5 : 0.55), maxZ: s.z + (s.type === 'fridge' ? 0.5 : 0.55) })),
  ...CHECKOUTS,
  BAR,
  ...TABLES.map((t) => ({ minX: t.x - TABLE_R, maxX: t.x + TABLE_R, minZ: t.z - 0.45, maxZ: t.z + 0.45 })),
]);
