import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';

/**
 * Hospital layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z from the
 * front fence (0) into the yard (-23.5). LOCAL_BLOCKERS are turned into world blockers below.
 *
 *   front (z 0 … -8): path from the gate to the door, garden with benches (west), ambulance bay (east)
 *   building (z -8 … -21): reception + waiting room (west), pharmacy counter and shelves (east)
 */
export const AREA = areaById('hospital');
export const FRAME = areaFrame(AREA);

export const HOSPITAL: Building = { area: 'hospital', x0: -20, x1: 20, z0: -21, z1: -8, doorX: 0, doorW: 3.2, wall: '#fbfbf8', roof: '#26a69a', floor: '#eef3f2' };
export const RECEPTION: Aabb = { minX: -15, maxX: -9, minZ: -12.4, maxZ: -11.6 };
/** Rows of waiting-room chairs (facing +z). */
export const CHAIR_ROWS = [-15.2, -17.6].map((z) => ({ x0: -17.5, x1: -7.5, z }));
export const PHARMACY_COUNTER: Aabb = { minX: 5, maxX: 17, minZ: -16.4, maxZ: -15.6 };
/** Shelves of medicine boxes on the back wall behind the counter. */
export const SHELF = { x0: 5.5, x1: 19.5, z: -20.5 };
export const PHARMACIST = { x: 11, z: -17.8 };
export const AMBULANCE = { x: 15, z: -4.2, len: 5.4, w: 2.3 };
export const GARDEN_BENCHES = [
  { x: -18, z: -3 },
  { x: -11, z: -3 },
];
export const GARDEN_TREES: [number, number][] = [
  [-24.5, -3],
  [-24.5, -10],
  [-24.5, -17],
  [24.5, -10],
  [24.5, -17],
  [-14.5, -6.2],
  [-6, -2],
];

export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(HOSPITAL),
  RECEPTION,
  ...CHAIR_ROWS.map((r) => ({ minX: r.x0, maxX: r.x1, minZ: r.z - 0.35, maxZ: r.z + 0.35 })),
  PHARMACY_COUNTER,
  // pharmacy side wall: nobody walks behind the counter
  { minX: 4.8, maxX: 5.2, minZ: HOSPITAL.z0, maxZ: PHARMACY_COUNTER.maxZ },
  { minX: SHELF.x0, maxX: SHELF.x1, minZ: HOSPITAL.z0, maxZ: SHELF.z + 0.4 },
  { minX: AMBULANCE.x - AMBULANCE.len / 2, maxX: AMBULANCE.x + AMBULANCE.len / 2, minZ: AMBULANCE.z - AMBULANCE.w / 2, maxZ: AMBULANCE.z + AMBULANCE.w / 2 },
  ...GARDEN_BENCHES.map((b) => ({ minX: b.x - 1, maxX: b.x + 1, minZ: b.z - 0.3, maxZ: b.z + 0.3 })),
  ...GARDEN_TREES.map(([x, z]) => ({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 })),
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));
