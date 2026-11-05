import { WORLD_BOUNDS } from '@es/shared';
import { STREET_END_X, areaFenceBlockers, walkable } from './areas';

/** One Kenney city tile = TILE world units (metres). */
export const TILE = 4;

/** x of the wooden fences that close both ends of the street (they cross the road; cyclists carry their bikes over). */
export const END_FENCE_X = STREET_END_X;

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
  /** World z of the tile centre when it is not tz * TILE (pavements beside the widened road). */
  z?: number;
  /** Stretch along world z (the road is wider than one tile, the pavements narrower). */
  sz?: number;
}

/**
 * The road is 6.4 m wide (two 3.2 m lanes, room for the 2.4 m bus) instead of one 4 m tile: the road tile is
 * stretched across, and the pavements on both sides give up the difference (2.8 m left of each).
 */
export const ROAD_HALF = 3.2;
export const ROAD_SZ = (ROAD_HALF * 2) / TILE;
const PAVE_OUTER = 1.5 * TILE;
export const PAVE_SZ = (PAVE_OUTER - ROAD_HALF) / TILE;
export const PAVE_Z = (PAVE_OUTER + ROAD_HALF) / 2;
/**
 * Street lamps (drawn by scene/Sky.tsx StreetLamps, not the Kenney lightpost tile): a post on each kerb every
 * other column, with an arm reaching over the road at LAMP_H, well above the 3 m bus.
 */
export const LAMP_POST_Z = ROAD_HALF - 0.3;
export const LAMP_H = 4.2;
export const LAMP_ARM = 1.2;
/** Road and its two pavements at column tx (shared by the street and its continuation beyond the fences). */
export function streetCross(tx: number): TilePlacement[] {
  return [
    { model: 'pavement', tx, tz: -1, z: -PAVE_Z, sz: PAVE_SZ },
    { model: 'road-straight', tx, tz: 0, rot: ROAD_ROT, sz: ROAD_SZ },
    { model: 'pavement', tx, tz: 1, z: PAVE_Z, sz: PAVE_SZ },
  ];
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
    // road and pavements
    tiles.push(...streetCross(tx));
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
  list.push(...areaFenceBlockers(), ...extraBlockers);
  return list;
}

export const BOUNDS: Aabb = { ...WORLD_BOUNDS };

/** Solid things registered by the area scenes (enclosures, shelves, walls, tables). Read once by LocalPlayer. */
const extraBlockers: Aabb[] = [];
export function registerBlockers(list: Aabb[]) {
  extraBlockers.push(...list);
  blockersVersion.n++;
}
export const blockersVersion = { n: 0 };

export const PLAYER_RADIUS = 0.4;

/** Round obstacle: lamp post, NPC, critter, cyclist or another player. `h` = height (jump over it when higher). */
export interface Circle {
  x: number;
  z: number;
  r: number;
  h: number;
}

/** Street lamp posts (even tx, both kerbs), as round obstacles. */
export function buildLampPosts(): Circle[] {
  const out: Circle[] = [];
  // The street (and its lamp posts) continues to the end fences.
  for (let tx = -42; tx <= 42; tx++) {
    if (tx % 2 !== 0) continue;
    for (const s of [-1, 1]) out.push({ x: tx * TILE, z: s * LAMP_POST_Z, r: 0.2, h: 5 });
  }
  return out;
}

/**
 * Move from (x,z) by (dx,dz), sliding along obstacles and clamping to the world bounds.
 * Axis-separated so the player slides along walls instead of sticking. Circles only block a step that
 * gets *closer* to them, so a critter or player that walks into you never traps you. `y` is the player's
 * height above ground: circles lower than that (cats, dogs) can be jumped over.
 */
export function resolveMove(
  x: number,
  z: number,
  dx: number,
  dz: number,
  blockers: Aabb[],
  circles: Circle[] = [],
  y = 0,
): [number, number] {
  // Glancing contact with a round obstacle: drop the part of the step that points into it, keep the tangential part (slide around).
  for (const c of circles) {
    if (y > c.h) continue;
    const rr = c.r + PLAYER_RADIUS;
    const ex = x + dx - c.x;
    const ez = z + dz - c.z;
    const d = Math.hypot(ex, ez);
    if (d >= rr || d < 1e-6) continue;
    const nxv = ex / d;
    const nzv = ez / d;
    const into = dx * nxv + dz * nzv;
    if (into < 0) {
      dx -= into * nxv;
      dz -= into * nzv;
    }
  }
  let nx = x + dx;
  if (collides(nx, z, blockers) || hitsCircle(nx, z, x, z, circles, y) || (!walkable(nx, z) && walkable(x, z))) nx = x;
  let nz = z + dz;
  if (collides(nx, nz, blockers) || hitsCircle(nx, nz, nx, z, circles, y) || (!walkable(nx, nz) && walkable(nx, z))) nz = z;
  nx = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, nx));
  nz = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, nz));
  return [nx, nz];
}

function hitsCircle(nx: number, nz: number, ox: number, oz: number, circles: Circle[], y: number) {
  for (const c of circles) {
    if (y > c.h) continue;
    const rr = c.r + PLAYER_RADIUS;
    const dNew = (nx - c.x) ** 2 + (nz - c.z) ** 2;
    if (dNew >= rr * rr) continue;
    const dOld = (ox - c.x) ** 2 + (oz - c.z) ** 2;
    if (dNew < dOld) return true;
  }
  return false;
}

function collides(x: number, z: number, blockers: Aabb[]) {
  const r = PLAYER_RADIUS;
  for (const b of blockers) {
    if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
  }
  return false;
}
