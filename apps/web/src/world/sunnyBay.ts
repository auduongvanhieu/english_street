import { SUNNY_BAY } from '@es/shared';
import { registerBlockers, type Aabb } from './layout';
import { registerSeats } from './seats';

/**
 * Sunny Bay (world coordinates, far south of the interiors; SUNNY_BAY in @es/shared). The station is at the top
 * (north, z ≈ -455), the promenade below it, then the sand, and the sea from z -516 (swimmable to z -540).
 *   station platform z -458 … -451 · promenade z -464 … -458 · sand z -516 … -464 · sea z < -516
 */
export const BAY = SUNNY_BAY;
export const SHORE_Z = -516;
/** Where you can swim (the LocalPlayer swims here as in the hotel pool). */
export const SEA_SWIM: Aabb = { minX: -50, maxX: 50, minZ: -540, maxZ: SHORE_Z - 0.6 };
export const PLATFORM = { x0: -22, x1: 22, z0: -458, z1: -451 };
export const ARRIVE = { x: 0, z: -460 };
export const SHELTER = { x: 0, z: -453.5 };
export const KIOSK = { x: -18, z: -470 };
export const KIOSK_SPOT = { x: -18, z: -472.2 };
export const TOWER = { x: 10, z: -505 };
export const CASTLE_SPOT = { x: 22, z: -498 };
export const ROCKS: { x: number; z: number; s: number }[] = [
  { x: -42, z: -511, s: 1.4 },
  { x: -45.5, z: -506, s: 1.0 },
  { x: -38, z: -514, s: 0.8 },
  { x: 43, z: -509, s: 1.3 },
  { x: 46, z: -503, s: 0.9 },
];
export const PALMS: [number, number, number][] = [
  [-44, -466, 0],
  [-31, -467, 1.1],
  [-8, -466, 2.3],
  [27, -467, 0.6],
  [40, -466, 1.9],
  [-48, -490, 2.8],
  [48, -488, 0.3],
];
export const UMBRELLAS: { x: number; z: number; towel: number; chair?: boolean }[] = [
  { x: -30, z: -492, towel: 0.2, chair: true },
  { x: -12, z: -497, towel: -0.3 },
  { x: 2, z: -488, towel: 0.1, chair: true },
  { x: 32, z: -490, towel: -0.2 },
  { x: -24, z: -505, towel: 0.4 },
];
/** Things to find on the beach (word, icon, where). */
export const FINDS: { id: string; en: string; icon: string; x: number; z: number }[] = [
  { id: 'shell', en: 'a shell', icon: '🐚', x: -20, z: -510 },
  { id: 'starfish', en: 'a starfish', icon: '⭐', x: -40, z: -509 },
  { id: 'crab', en: 'a crab', icon: '🦀', x: 41, z: -506 },
  { id: 'seaweed', en: 'some seaweed', icon: '🌿', x: 5, z: -513 },
  { id: 'pebble', en: 'a pebble', icon: '🪨', x: 30, z: -511 },
  { id: 'bottle', en: 'a message in a bottle', icon: '🍾', x: -6, z: -514 },
  { id: 'sunglasses', en: 'some sunglasses', icon: '🕶️', x: -27, z: -489 },
  { id: 'bucket', en: 'a bucket and spade', icon: '🪣', x: 18, z: -495 },
  { id: 'coconut', en: 'a coconut', icon: '🥥', x: -44, z: -468.5 },
  { id: 'ball', en: 'a beach ball', icon: '🏐', x: 12, z: -485 },
];

const t = 0.3;
export const BLOCKERS: Aabb[] = [
  // edges of the bay: the hills either side, the station wall at the top, deep water at the bottom
  { minX: BAY.minX - t, maxX: BAY.minX, minZ: BAY.minZ, maxZ: BAY.maxZ },
  { minX: BAY.maxX, maxX: BAY.maxX + t, minZ: BAY.minZ, maxZ: BAY.maxZ },
  { minX: BAY.minX, maxX: BAY.maxX, minZ: PLATFORM.z1, maxZ: PLATFORM.z1 + t },
  { minX: BAY.minX, maxX: BAY.maxX, minZ: SEA_SWIM.minZ - t, maxZ: SEA_SWIM.minZ },
  // station shelter back wall, kiosk, tower legs, rocks
  { minX: SHELTER.x - 3.1, maxX: SHELTER.x + 3.1, minZ: SHELTER.z + 1.0, maxZ: SHELTER.z + 1.3 },
  { minX: KIOSK.x - 1.4, maxX: KIOSK.x + 1.4, minZ: KIOSK.z - 1.0, maxZ: KIOSK.z + 1.0 },
  { minX: TOWER.x - 1.1, maxX: TOWER.x + 1.1, minZ: TOWER.z - 1.1, maxZ: TOWER.z + 1.1 },
  ...ROCKS.map((r) => ({ minX: r.x - 0.6 * r.s, maxX: r.x + 0.6 * r.s, minZ: r.z - 0.6 * r.s, maxZ: r.z + 0.6 * r.s })),
  ...PALMS.map(([x, z]) => ({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 })),
];
registerBlockers(BLOCKERS);
registerSeats([
  // the station bench (facing the sea, -z) and the deckchairs
  ...[-1, 0, 1].map((k) => ({ x: SHELTER.x + k * 0.9, z: SHELTER.z + 0.55, rot: Math.PI })),
  ...UMBRELLAS.filter((u) => u.chair).map((u) => ({ x: u.x + 1.2, z: u.z - 0.4, rot: Math.PI })),
]);
