import { z } from 'zod';
import { inRect, type Rect } from './interiors';

/**
 * "My room": every player's own room off the map. Buy furniture with coins (each piece is a word to learn), place,
 * turn and move it; friends can visit. Models: assets-src/lpm/recipes/home_kit.py (footprints below must match).
 */
export interface Furniture {
  id: string;
  en: string;
  icon: string;
  price: number;
  /** footprint at rotation 0: width (x) and depth (z), metres */
  w: number;
  d: number;
  /** hangs on a wall at this height (picture, clock): placed against the nearest wall */
  wallY?: number;
  /** LPM mesh name in home_kit */
  mesh: string;
  /** a rug lies under things: other pieces may stand on it */
  flat?: boolean;
}
export const FURNITURE: Furniture[] = [
  { id: 'bed', en: 'bed', icon: '🛏️', price: 60, w: 1.4, d: 2.0, mesh: 'SM_HM_Bed' },
  { id: 'sofa', en: 'sofa', icon: '🛋️', price: 50, w: 1.8, d: 0.85, mesh: 'SM_HM_Sofa' },
  { id: 'armchair', en: 'armchair', icon: '💺', price: 30, w: 0.85, d: 0.85, mesh: 'SM_HM_Armchair' },
  { id: 'table', en: 'table', icon: '🪑', price: 25, w: 1.2, d: 0.8, mesh: 'SM_HM_Table' },
  { id: 'chair', en: 'chair', icon: '🪑', price: 10, w: 0.5, d: 0.5, mesh: 'SM_HM_Chair' },
  { id: 'desk', en: 'desk', icon: '🖥️', price: 30, w: 1.2, d: 0.6, mesh: 'SM_HM_Desk' },
  { id: 'lamp', en: 'lamp', icon: '💡', price: 15, w: 0.4, d: 0.4, mesh: 'SM_HM_Lamp' },
  { id: 'bookshelf', en: 'bookshelf', icon: '📚', price: 35, w: 1.0, d: 0.35, mesh: 'SM_HM_Bookshelf' },
  { id: 'plant', en: 'plant', icon: '🪴', price: 10, w: 0.5, d: 0.5, mesh: 'SM_HM_Plant' },
  { id: 'rug', en: 'rug', icon: '🟫', price: 20, w: 2.0, d: 1.4, mesh: 'SM_HM_Rug', flat: true },
  { id: 'tv', en: 'TV', icon: '📺', price: 45, w: 1.2, d: 0.45, mesh: 'SM_HM_TV' },
  { id: 'wardrobe', en: 'wardrobe', icon: '🚪', price: 40, w: 1.2, d: 0.6, mesh: 'SM_HM_Wardrobe' },
  { id: 'clock', en: 'clock', icon: '🕰️', price: 15, w: 0.45, d: 0.1, wallY: 1.7, mesh: 'SM_HM_Clock' },
  { id: 'picture', en: 'picture', icon: '🖼️', price: 15, w: 0.8, d: 0.06, wallY: 1.2, mesh: 'SM_HM_Picture' },
  { id: 'fridge', en: 'fridge', icon: '🧊', price: 40, w: 0.7, d: 0.7, mesh: 'SM_HM_Fridge' },
  { id: 'cooker', en: 'cooker', icon: '🍳', price: 35, w: 0.7, d: 0.65, mesh: 'SM_HM_Cooker' },
];
export const furniture = (id: string) => FURNITURE.find((f) => f.id === id);
/** Most of one kind a player can own. */
export const FURNITURE_MAX = 4;
export const ROOM_MAX_ITEMS = 30;

/** Room size and the slot grid off the map (x -150…-66, z -320…-404). */
export const MY_ROOM = { w: 8, d: 6 };
export const MY_ROOM_SLOTS = 64;
export function myRoom(slot: number) {
  const cx = -150 + (slot % 8) * 12;
  const cz = -320 - Math.floor(slot / 8) * 12;
  const rect: Rect = { minX: cx - MY_ROOM.w / 2, maxX: cx + MY_ROOM.w / 2, minZ: cz - MY_ROOM.d / 2, maxZ: cz + MY_ROOM.d / 2 };
  return { cx, cz, rect, entry: { x: cx, z: cz + MY_ROOM.d / 2 - 0.9 } };
}
export function myRoomSlot(playerId: string): number {
  let h = 2166136261;
  for (let i = 0; i < playerId.length; i++) h = Math.imul(h ^ playerId.charCodeAt(i), 16777619) >>> 0;
  return h % MY_ROOM_SLOTS;
}
export function myRoomAt(x: number, z: number): number {
  for (let i = 0; i < MY_ROOM_SLOTS; i++) if (inRect(myRoom(i).rect, x, z, 0.3)) return i;
  return -1;
}

/** A placed piece: room-local position (metres from the room centre) and rotation (quarter turns). */
export const PlacedSchema = z.object({ id: z.string().max(20), x: z.number().min(-MY_ROOM.w / 2).max(MY_ROOM.w / 2), z: z.number().min(-MY_ROOM.d / 2).max(MY_ROOM.d / 2), r: z.number().int().min(0).max(3) });
export type Placed = z.infer<typeof PlacedSchema>;
export interface RoomState {
  owned: Record<string, number>;
  items: Placed[];
}
/** Footprint of a placed piece as a room-local rectangle. */
export function footprint(p: Placed): Rect {
  const f = furniture(p.id)!;
  const [w, d] = p.r % 2 ? [f.d, f.w] : [f.w, f.d];
  return { minX: p.x - w / 2, maxX: p.x + w / 2, minZ: p.z - d / 2, maxZ: p.z + d / 2 };
}
