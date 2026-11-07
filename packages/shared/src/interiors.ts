/**
 * Interiors: walk-in spaces that live off the street map (hotel corridors and rooms, …), far north of the areas.
 * Players get there by "moving through a door" (teleport); positions inside are synced like anywhere else, so
 * everybody in the same room sees each other. The server clamps positions to WORLD_BOUNDS or INTERIOR_BOUNDS.
 */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export const INTERIOR_BOUNDS: Rect = { minX: -165, maxX: 260, minZ: -1360, maxZ: -100 };
/** Sunny Bay, the seaside reached by train (scene/areas/places/SunnyBay.tsx): far south of the interiors. */
export const SUNNY_BAY: Rect = { minX: -55, maxX: 55, minZ: -560, maxZ: -450 };
/** Maple Hill, the hills reached by train (scene/areas/places/MapleHill.tsx): east of Sunny Bay. The ground rises to
 * the summit, so players there may be up to MAPLE_HILL_TOP metres high (plus a jump). */
export const MAPLE_HILL: Rect = { minX: 152, maxX: 248, minZ: -598, maxZ: -440 };
export const MAPLE_HILL_TOP = 17;
/** Riverside, a village with a market and a water mill (scene/areas/places/Riverside.tsx), south of Sunny Bay. */
export const RIVERSIDE: Rect = { minX: -60, maxX: 60, minZ: -770, maxZ: -660 };
/** Old Town, a clock tower square and a museum (scene/areas/places/OldTown.tsx), south of Riverside. */
export const OLD_TOWN: Rect = { minX: -60, maxX: 60, minZ: -905, maxZ: -800 };
/** Places reached by train that are outdoors (the street's weather applies there). */
export const TRIP_PLACES: Rect[] = [SUNNY_BAY, RIVERSIDE, OLD_TOWN];
export const inRect = (r: Rect, x: number, z: number, m = 0) => x >= r.minX - m && x <= r.maxX + m && z >= r.minZ - m && z <= r.maxZ + m;

/* ------------------------------------------------------------------------------------------- hotel */

/** Guest floors (the lobby is the ground floor in the hotel area); 12 rooms each: 201-212, 301-312. */
export const HOTEL_FLOORS = [2, 3] as const;
export const HOTEL_ROOMS_PER_FLOOR = 12;
/** Corridor centre line z of a floor; the corridor runs along x. */
export const hotelCorridorZ = (floor: number) => -160 - (floor - 2) * 30;
export const HOTEL_CORRIDOR_HALF_W = 1.5;
export const HOTEL_CORRIDOR_X: [number, number] = [-27, 26];
/** Where the lift doors are in each corridor (west end). */
export const hotelLiftX = -25.5;
const ROOM_W = 7;
const ROOM_D = 6;
/** Room n (1-12): odd numbers on the north side of the corridor, even on the south; 6 columns. */
export function hotelRoomInfo(room: number) {
  const floor = Math.floor(room / 100);
  const n = room % 100;
  const col = Math.ceil(n / 2) - 1;
  const north = n % 2 === 1;
  const zc = hotelCorridorZ(floor);
  const cx = -20 + col * 8;
  const near = zc + (north ? -1 : 1) * (HOTEL_CORRIDOR_HALF_W + 0.5);
  const far = near + (north ? -1 : 1) * ROOM_D;
  const rect: Rect = { minX: cx - ROOM_W / 2, maxX: cx + ROOM_W / 2, minZ: Math.min(near, far), maxZ: Math.max(near, far) };
  return {
    floor,
    n,
    north,
    rect,
    /** door: centre of the room's corridor-side wall; `inside` = where you stand after entering */
    door: { x: cx, z: zc + (north ? -1 : 1) * HOTEL_CORRIDOR_HALF_W },
    inside: { x: cx, z: near + (north ? -1 : 1) * 1.1, rot: north ? Math.PI : 0 },
    /** standing in the corridor in front of the door */
    outside: { x: cx, z: zc + (north ? -1 : 1) * 0.6, rot: north ? 0 : Math.PI },
  };
}
export const isHotelRoom = (room: number) => HOTEL_FLOORS.includes(Math.floor(room / 100) as 2 | 3) && room % 100 >= 1 && room % 100 <= HOTEL_ROOMS_PER_FLOOR;
export const ALL_HOTEL_ROOMS: number[] = HOTEL_FLOORS.flatMap((f) => Array.from({ length: HOTEL_ROOMS_PER_FLOOR }, (_, i) => f * 100 + i + 1));
/** Which room a guest gets (stable per player id). */
export function hotelRoomFor(playerId: string): number {
  let h = 2166136261;
  for (let i = 0; i < playerId.length; i++) h = Math.imul(h ^ playerId.charCodeAt(i), 16777619) >>> 0;
  return ALL_HOTEL_ROOMS[h % ALL_HOTEL_ROOMS.length]!;
}
/** The room a position is in (server: who hears a knock), or 0. */
export function hotelRoomAt(x: number, z: number): number {
  for (const r of ALL_HOTEL_ROOMS) if (inRect(hotelRoomInfo(r).rect, x, z)) return r;
  return 0;
}
export const hotelCorridorRect = (floor: number): Rect => {
  const zc = hotelCorridorZ(floor);
  return { minX: HOTEL_CORRIDOR_X[0], maxX: HOTEL_CORRIDOR_X[1], minZ: zc - HOTEL_CORRIDOR_HALF_W, maxZ: zc + HOTEL_CORRIDOR_HALF_W };
};
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

/* ------------------------------------------------------------------------------------------- train */

/** The carriage riders sit in (one coach, off the map; everybody on the same train shares it). Runs along x. */
export const TRAIN_CAR = { x: 70, z: -260, halfLen: 7, halfW: 1.3 } as const;
export const trainCarRect = (m = 0): Rect => ({ minX: TRAIN_CAR.x - TRAIN_CAR.halfLen - m, maxX: TRAIN_CAR.x + TRAIN_CAR.halfLen + m, minZ: TRAIN_CAR.z - TRAIN_CAR.halfW - m, maxZ: TRAIN_CAR.z + TRAIN_CAR.halfW + m });

/* ------------------------------------------------------------------------------------------ clinic */

/** Consulting rooms off the map (one per patient slot), 7 x 6 m; the door side is +z, the doctor's desk at the back. */
export const CLINIC_ROOMS = 8;
export function clinicRoom(i: number) {
  const cx = -140 + (i % 4) * 12;
  const cz = -240 - Math.floor(i / 4) * 12;
  const rect: Rect = { minX: cx - 3.5, maxX: cx + 3.5, minZ: cz - 3, maxZ: cz + 3 };
  return { cx, cz, rect, entry: { x: cx, z: cz + 2.2 } };
}
export function clinicRoomFor(playerId: string): number {
  let h = 2166136261;
  for (let i = 0; i < playerId.length; i++) h = Math.imul(h ^ playerId.charCodeAt(i), 16777619) >>> 0;
  return h % CLINIC_ROOMS;
}
export function clinicRoomAt(x: number, z: number): number {
  for (let i = 0; i < CLINIC_ROOMS; i++) if (inRect(clinicRoom(i).rect, x, z, 0.3)) return i;
  return -1;
}
