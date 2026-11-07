import { FIELD_PLOTS, MAX_FIELDS, MY_FARM, myFarm, type AnimalKind } from '@es/shared';
import type { Aabb } from './layout';

/**
 * "My farm" layout in farm-local metres (x -20…20, z -18…18 around the slot centre, @es/shared myFarm). The gate
 * is in the middle of the north fence (+z, where you come in). Fields on the west (6 plots per field, one row
 * each), animal pens on the east, the barn and the shipping bin at the back.
 */
export const PLOT = 2.4;
export const plotPos = (i: number) => ({ x: -16.5 + (i % FIELD_PLOTS) * 2.8, z: 12 - Math.floor(i / FIELD_PLOTS) * 2.9 });
export const PLOTS_MAX = MAX_FIELDS * FIELD_PLOTS;
export const GATE_W = 4;
export interface Pen {
  kind: AnimalKind;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** where you stand to feed / collect (outside the fence, on the path) */
  spot: { x: number; z: number };
  ground: string;
}
export const PENS: Pen[] = [
  { kind: 'chicken', x0: 3, x1: 10.5, z0: 5, z1: 14, spot: { x: 6.75, z: 3.7 }, ground: '#c8b07a' },
  { kind: 'cow', x0: 11.5, x1: 19, z0: 5, z1: 14, spot: { x: 15.25, z: 3.7 }, ground: '#9cc96b' },
  { kind: 'sheep', x0: 3, x1: 10.5, z0: -15, z1: -6, spot: { x: 6.75, z: -4.7 }, ground: '#a9d27e' },
  { kind: 'pig', x0: 11.5, x1: 19, z0: -15, z1: -6, spot: { x: 15.25, z: -4.7 }, ground: '#8f6a4a' },
];
/** Barn (farm_kit SM_Barn, 16 x 9.5, front facing +z), shipping bin, the shop board and the dog house spot. */
export const BARN = { x: -11, z: -12, w: 16, d: 9.5 };
export const BIN = { x: -1.5, z: -9 };
export const SHOP = { x: 5, z: 16.4 };
export const LOG_BOARD = { x: -5, z: 16.4 };
export const DOG_HOUSE = { x: 1, z: 9 };

/** World position of a farm-local point in slot `slot`. */
export const toWorld = (slot: number, x: number, z: number) => {
  const f = myFarm(slot);
  return { x: f.cx + x, z: f.cz + z };
};

const box = (x: number, z: number, hx: number, hz: number): Aabb => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
/** Solid things of a farm (local coordinates): the fence with its gate, pens, barn, bin, boards. */
export const LOCAL_BLOCKERS: Aabb[] = (() => {
  const W = MY_FARM.w / 2;
  const D = MY_FARM.d / 2;
  const t = 0.25;
  const out: Aabb[] = [
    { minX: -W - t, maxX: -W, minZ: -D, maxZ: D },
    { minX: W, maxX: W + t, minZ: -D, maxZ: D },
    { minX: -W, maxX: W, minZ: -D - t, maxZ: -D },
    // north fence with the gate gap in the middle
    { minX: -W, maxX: -GATE_W / 2, minZ: D, maxZ: D + t },
    { minX: GATE_W / 2, maxX: W, minZ: D, maxZ: D + t },
    box(BARN.x, BARN.z, BARN.w / 2, BARN.d / 2),
    box(BIN.x, BIN.z, 0.7, 0.5),
    box(SHOP.x, SHOP.z, 1.1, 0.15),
    box(LOG_BOARD.x, LOG_BOARD.z, 1.1, 0.15),
  ];
  for (const p of PENS) out.push(box((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, (p.x1 - p.x0) / 2, (p.z1 - p.z0) / 2));
  return out;
})();
export const blockersFor = (slot: number): Aabb[] => {
  const f = myFarm(slot);
  return LOCAL_BLOCKERS.map((b) => ({ minX: b.minX + f.cx, maxX: b.maxX + f.cx, minZ: b.minZ + f.cz, maxZ: b.maxZ + f.cz }));
};
