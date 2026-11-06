import { ALL_HOTEL_ROOMS, HOTEL_CORRIDOR_HALF_W, HOTEL_CORRIDOR_X, HOTEL_FLOORS, hotelCorridorRect, hotelCorridorZ, hotelLiftX, hotelRoomInfo } from '@es/shared';
import { registerFloor } from '../areas';
import { registerBlockers, type Aabb } from '../layout';
import { FRAME, LIFT_X, LOBBY } from './hotel';

/**
 * Riverside Hotel guest floors (2 and 3), off the street map (see @es/shared interiors.ts): a corridor per floor
 * with the lift at the west end and 12 rooms. This file registers the floors you can walk on, the walls and the
 * furniture as blockers, and the furniture layout the scene draws (scene/areas/places/HotelFloors.tsx).
 *
 * Room frame: origin at the room centre, x across (−3.5 … 3.5), z from the window wall (−3) to the door wall (+3).
 * North rooms are drawn as is; south rooms are turned half way round (their door faces −z).
 */
export interface Piece {
  kit: string;
  x: number;
  z: number;
  /** rotation-y; the kit pieces face +z */
  rot: number;
  /** footprint blocked for walking (w along x, d along z, before rotation); none = walk through (rug) */
  block?: [number, number];
}
export const ROOM_W = 7;
export const ROOM_D = 6;
export const WALL_H = 2.6;
/** Bathroom corner (local): x −3.5 … −1.4, z 0.9 … 3, opening on its east wall between z 1.6 and 2.6. */
export const BATH = { x0: -3.5, x1: -1.4, z0: 0.9, z1: 3, open0: 1.6, open1: 2.6 };
export const ROOM_PIECES: Piece[] = [
  { kit: 'SM_HR_Rug', x: -1.6, z: -1.0, rot: 0 },
  { kit: 'SM_HR_Bed', x: -2.35, z: -1.0, rot: 0, block: [2.1, 1.7] },
  { kit: 'SM_HR_Nightstand', x: -3.15, z: -2.25, rot: Math.PI / 2, block: [0.5, 0.5] },
  { kit: 'SM_HR_NightstandPhone', x: -3.15, z: 0.25, rot: Math.PI / 2, block: [0.5, 0.5] },
  { kit: 'SM_HR_Window', x: 0.6, z: -2.93, rot: 0 },
  { kit: 'SM_HR_Window_glass', x: 0.6, z: -2.93, rot: 0 },
  { kit: 'SM_HR_Armchair', x: 2.6, z: -2.2, rot: -Math.PI / 4, block: [0.8, 0.8] },
  { kit: 'SM_HR_TvCabinet', x: 3.2, z: -0.7, rot: -Math.PI / 2, block: [1.4, 0.5] },
  { kit: 'SM_HR_Desk', x: 3.2, z: 1.0, rot: -Math.PI / 2, block: [1.2, 0.55] },
  { kit: 'SM_HR_Chair', x: 2.5, z: 1.0, rot: Math.PI / 2 },
  { kit: 'SM_HR_Minibar', x: 3.2, z: 2.25, rot: -Math.PI / 2, block: [0.5, 0.5] },
  { kit: 'SM_HR_Wardrobe', x: -0.85, z: 2.65, rot: Math.PI, block: [1.1, 0.6] },
  { kit: 'SM_HR_LuggageRack', x: 1.6, z: 2.65, rot: Math.PI, block: [0.8, 0.5] },
  { kit: 'SM_HR_Shower', x: -3.0, z: 1.4, rot: 0, block: [0.9, 0.9] },
  { kit: 'SM_HR_Shower_glass', x: -3.0, z: 1.4, rot: 0 },
  { kit: 'SM_HR_Toilet', x: -2.0, z: 2.65, rot: Math.PI, block: [0.45, 0.6] },
  { kit: 'SM_HR_Sink', x: -3.2, z: 2.5, rot: Math.PI / 2, block: [0.45, 0.7] },
];
/** Things you can use in a room (local positions; HotelFloors.tsx registers them for the room you are in). */
export const ROOM_SPOTS = {
  door: { x: 0, z: 2.5 },
  dnd: { x: -0.9, z: 2.2 },
  light: { x: 0.9, z: 2.7 },
  phone: { x: -2.6, z: 0.35 },
  minibar: { x: 2.6, z: 2.25 },
  tv: { x: 2.4, z: -0.7 },
  bed: { x: -1.0, z: -1.0 },
  window: { x: 0.6, z: -2.3 },
  bath: { x: -2.2, z: 1.9 },
};

/** Local room point -> world, for a room (north rooms as is, south rooms turned by π). */
export function roomToWorld(room: number, x: number, z: number): [number, number] {
  const info = hotelRoomInfo(room);
  const cx = (info.rect.minX + info.rect.maxX) / 2;
  const cz = (info.rect.minZ + info.rect.maxZ) / 2;
  return info.north ? [cx + x, cz + z] : [cx - x, cz - z];
}
export const roomRot = (room: number) => (hotelRoomInfo(room).north ? 0 : Math.PI);

/** Where you arrive on a floor (in front of the lift) and in the lobby. */
export const hotelFloorSpot = (floor: number) => ({ x: hotelLiftX + 1.6, z: hotelCorridorZ(floor), rot: -Math.PI / 2 });
export const lobbyLiftSpot = () => {
  const [x, z] = FRAME.toWorld(LIFT_X, LOBBY.z0 + 1.4);
  return { x, z, rot: FRAME.rot === 0 ? 0 : Math.PI };
};

function rotRect(cx: number, cz: number, w: number, d: number, rot: number): Aabb {
  const turned = Math.abs(Math.sin(rot)) > 0.7;
  const hw = (turned ? d : w) / 2;
  const hd = (turned ? w : d) / 2;
  return { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd };
}

// ---- walkable floors + blockers ------------------------------------------------------------------------------
const T = 0.15;
const blockers: Aabb[] = [];
for (const f of HOTEL_FLOORS) {
  const c = hotelCorridorRect(f);
  registerFloor(c);
  // corridor walls (the doors are "teleports", so the walls are solid) and end walls
  blockers.push({ minX: c.minX, maxX: c.maxX, minZ: c.minZ - T, maxZ: c.minZ + T }, { minX: c.minX, maxX: c.maxX, minZ: c.maxZ - T, maxZ: c.maxZ + T });
  blockers.push({ minX: c.minX - T, maxX: c.minX + T, minZ: c.minZ, maxZ: c.maxZ }, { minX: c.maxX - T, maxX: c.maxX + T, minZ: c.minZ, maxZ: c.maxZ });
}
for (const room of ALL_HOTEL_ROOMS) {
  const r = hotelRoomInfo(room).rect;
  registerFloor(r);
  blockers.push({ minX: r.minX, maxX: r.maxX, minZ: r.minZ - T, maxZ: r.minZ + T }, { minX: r.minX, maxX: r.maxX, minZ: r.maxZ - T, maxZ: r.maxZ + T });
  blockers.push({ minX: r.minX - T, maxX: r.minX + T, minZ: r.minZ, maxZ: r.maxZ }, { minX: r.maxX - T, maxX: r.maxX + T, minZ: r.minZ, maxZ: r.maxZ });
  for (const p of ROOM_PIECES) {
    if (!p.block) continue;
    const [x, z] = roomToWorld(room, p.x, p.z);
    blockers.push(rotRect(x, z, p.block[0], p.block[1], p.rot));
  }
  // bathroom partition walls (north wall of the bathroom, and its east wall with the opening)
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const [ax, az] = roomToWorld(room, x0, z0);
    const [bx, bz] = roomToWorld(room, x1, z1);
    blockers.push({ minX: Math.min(ax, bx) - 0.06, maxX: Math.max(ax, bx) + 0.06, minZ: Math.min(az, bz) - 0.06, maxZ: Math.max(az, bz) + 0.06 });
  };
  wall(BATH.x0, BATH.z0, BATH.x1, BATH.z0);
  wall(BATH.x1, BATH.z0, BATH.x1, BATH.open0);
  wall(BATH.x1, BATH.open1, BATH.x1, BATH.z1);
}
registerBlockers(blockers);

export const CORRIDOR_DOOR_HALF = HOTEL_CORRIDOR_HALF_W;
export const CORRIDOR_X = HOTEL_CORRIDOR_X;
