import { WORLD_BOUNDS } from '@es/shared';

/** One Kenney city tile = TILE world units (metres). */
export const TILE = 4;

export type TileModel =
  | 'road-straight'
  | 'road-straight-lightposts'
  | 'pavement'
  | 'pavement-fountain'
  | 'grass'
  | 'grass-trees'
  | 'grass-trees-tall'
  | 'building-small-a'
  | 'building-small-b'
  | 'building-small-c'
  | 'building-small-d'
  | 'building-garage';

/** Model height in tile units (from the GLB bounds), used to place shop signs. */
export const MODEL_HEIGHT: Record<TileModel, number> = {
  'road-straight': 0.05,
  'road-straight-lightposts': 0.55,
  pavement: 0.06,
  'pavement-fountain': 0.54,
  grass: 0.06,
  'grass-trees': 0.64,
  'grass-trees-tall': 0.76,
  'building-small-a': 0.95,
  'building-small-b': 1.63,
  'building-small-c': 1.75,
  'building-small-d': 1.0,
  'building-garage': 0.55,
};

export const MODEL_URL = (m: TileModel) => `/models/city/${m}.glb`;

export interface TilePlacement {
  model: TileModel;
  tx: number;
  tz: number;
  /** Y rotation in radians */
  rot?: number;
}

export interface ShopDef {
  id: string;
  label: string;
  /** NPC id from the API (packages/quests); null = not staffed yet */
  npcId: string | null;
  tx: number;
  model: TileModel;
  tint: string;
}

/** Shops line the north side of the street (tz = SHOP_ROW_TZ). */
export const SHOP_ROW_TZ = -2;
export const SHOPS: ShopDef[] = [
  { id: 'bistro', label: 'Le Petit Bistro', npcId: 'maitre', tx: -5, model: 'building-small-c', tint: '#f9c6d8' },
  { id: 'cafe', label: 'Sunny Side Café', npcId: 'barista', tx: -3, model: 'building-small-a', tint: '#ffd3a1' },
  { id: 'mart', label: 'QuickMart', npcId: 'cashier', tx: -1, model: 'building-small-d', tint: '#b8f0bd' },
  { id: 'info', label: 'Tourist Info', npcId: 'guide', tx: 1, model: 'building-garage', tint: '#ffe78f' },
  { id: 'post', label: 'Post Office', npcId: 'postal', tx: 3, model: 'building-small-b', tint: '#ffb3b3' },
  { id: 'clinic', label: 'Clinic', npcId: 'doctor', tx: 5, model: 'building-small-c', tint: '#e3ecff' },
  { id: 'bank', label: 'Bank', npcId: 'teller', tx: 7, model: 'building-small-b', tint: '#d3ccff' },
  { id: 'jobs', label: 'Job Center', npcId: 'recruiter', tx: 9, model: 'building-small-a', tint: '#c6ecf5' },
];

const TX_MIN = -10;
const TX_MAX = 10;
const ROAD_ROT = Math.PI / 2; // road-straight runs along Z by default; rotate to run along X

/** Everything except the shop buildings (those are rendered tinted, with signs). */
export function buildTiles(): TilePlacement[] {
  const tiles: TilePlacement[] = [];
  const shopAt = new Map(SHOPS.map((s) => [s.tx, s]));
  for (let tx = TX_MIN; tx <= TX_MAX; tx++) {
    // north: back row of grass behind the shops
    tiles.push({ model: tx % 3 === 0 ? 'grass-trees-tall' : 'grass', tx, tz: -3 });
    // shop row: trees between shops
    if (!shopAt.has(tx)) tiles.push({ model: tx % 2 === 0 ? 'grass-trees' : 'grass', tx, tz: SHOP_ROW_TZ });
    // pavements
    tiles.push({ model: 'pavement', tx, tz: -1 });
    tiles.push({ model: 'pavement', tx, tz: 1 });
    // road
    tiles.push({ model: tx % 2 === 0 ? 'road-straight-lightposts' : 'road-straight', tx, tz: 0, rot: ROAD_ROT });
    // south: small park
    if (tx === 0) tiles.push({ model: 'pavement-fountain', tx, tz: 2 });
    else tiles.push({ model: tx % 2 === 0 ? 'grass-trees' : 'grass', tx, tz: 2 });
    tiles.push({ model: tx % 3 === 1 ? 'grass-trees-tall' : 'grass', tx, tz: 3 });
  }
  return tiles;
}

export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Solid obstacles the player cannot walk through. */
export function buildBlockers(): Aabb[] {
  const half = TILE / 2;
  const list: Aabb[] = SHOPS.map((s) => ({
    minX: s.tx * TILE - half,
    maxX: s.tx * TILE + half,
    minZ: SHOP_ROW_TZ * TILE - half,
    maxZ: SHOP_ROW_TZ * TILE + half,
  }));
  // fountain in the park
  list.push({ minX: -1.2, maxX: 1.2, minZ: 2 * TILE - 1.2, maxZ: 2 * TILE + 1.2 });
  return list;
}

export const BOUNDS: Aabb = { ...WORLD_BOUNDS };

export const PLAYER_RADIUS = 0.4;

/**
 * Move from (x,z) by (dx,dz), sliding along obstacles and clamping to the world bounds.
 * Axis-separated so the player slides along walls instead of sticking.
 */
export function resolveMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
  blockers: Aabb[],
): [number, number] {
  let nx = x + dx;
  if (collides(nx, z, blockers)) nx = x;
  let nz = z + dz;
  if (collides(nx, nz, blockers)) nz = z;
  nx = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, nx));
  nz = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, nz));
  return [nx, nz];
}

function collides(x: number, z: number, blockers: Aabb[]) {
  const r = PLAYER_RADIUS;
  for (const b of blockers) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
  }
  return false;
}
