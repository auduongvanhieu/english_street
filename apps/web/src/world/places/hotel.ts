import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';
import { benchPair, frameSeats, registerSeats } from '../seats';

/**
 * Riverside Hotel layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z from
 * the front fence (0) into the yard (-23.5). The hotel faces the road (and the river behind it); the lobby is a
 * walk-in building, the upper floors are drawn on top. Pool garden on the +x side, flower garden on the -x side.
 */
export const AREA = areaById('hotel');
export const FRAME = areaFrame(AREA);

/** Lobby (ground floor), walk-in. */
export const LOBBY: Building = { area: 'hotel', x0: -17, x1: 13, z0: -22.5, z1: -11, doorX: 0, doorW: 3, wall: '#f5ead6', roof: '#c0a062', floor: '#d8c7a8' };
/** Upper floors above the lobby. */
export const FLOORS = 2;
export const FLOOR_H = 2.8;
/** Reception desk against the back-left, the receptionist behind it. */
export const DESK: Aabb = { minX: -12, maxX: -5, minZ: -20.1, maxZ: -19.4 };
export const RECEPTIONIST = { x: -8.5, z: -21.1 };
/** Lift doors in the back wall. */
export const LIFT_X = 7;
/** Sofa corner: two sofas facing a coffee table. */
export const SOFAS: Aabb[] = [
  { minX: 3, maxX: 6, minZ: -16.6, maxZ: -15.8 },
  { minX: 3, maxX: 6, minZ: -13.4, maxZ: -12.6 },
];
export const COFFEE_TABLE: Aabb = { minX: 3.8, maxX: 5.2, minZ: -14.8, maxZ: -14.2 };
export const TROLLEY = { x: -4, z: -13 };
/** Pool in the garden. */
export const POOL: Aabb = { minX: 17, maxX: 25, minZ: -19, maxZ: -10 };
export const LOUNGERS = [
  { x: 16, z: -6 },
  { x: 19, z: -6 },
  { x: 22, z: -6 },
  { x: 25, z: -6 },
];
export const FLAG = { x: -22, z: -4 };

export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(LOBBY),
  DESK,
  ...SOFAS,
  COFFEE_TABLE,
  { minX: TROLLEY.x - 0.45, maxX: TROLLEY.x + 0.45, minZ: TROLLEY.z - 0.3, maxZ: TROLLEY.z + 0.3 },
  ...LOUNGERS.map((l) => ({ minX: l.x - 0.4, maxX: l.x + 0.4, minZ: l.z - 1, maxZ: l.z + 1 })),
  { minX: FLAG.x - 0.15, maxX: FLAG.x + 0.15, minZ: FLAG.z - 0.15, maxZ: FLAG.z + 0.15 },
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));

// seats: lobby sofas (facing each other), sun loungers, the garden bench
registerSeats(
  frameSeats(FRAME, [
    [3.8, -16.1, 0],
    [5.2, -16.1, 0],
    [3.8, -12.9, Math.PI],
    [5.2, -12.9, Math.PI],
    ...LOUNGERS.map((l): [number, number, number] => [l.x, l.z + 0.2, 0]),
    ...benchPair(-19, -1.5, 0),
  ]),
);

/** The pool in world coordinates: walk in and you swim (scene/LocalPlayer.tsx). */
export const POOL_WORLD = FRAME.rect(POOL);
