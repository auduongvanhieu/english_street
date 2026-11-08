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
/** Each pen has an open gate (this wide) in the fence on its path side, in the middle: you walk in to feed and collect. */
export const PEN_GATE = 1.8;
/** The pen's gate side: 'z0' for the pens north of the path (gate faces -z), 'z1' for those south of it. */
export const penGateSide = (p: Pen): 'z0' | 'z1' => (p.spot.z < p.z0 ? 'z0' : 'z1');
export const penGateX = (p: Pen): [number, number] => [(p.x0 + p.x1) / 2 - PEN_GATE / 2, (p.x0 + p.x1) / 2 + PEN_GATE / 2];
/** Props inside the pens (scene MyFarm): coop, troughs, hay bale; solid too. */
export const PEN_PROPS = { coop: { x: 8.5, z: 12 }, troughN: { x: 15, z: 13 }, troughS: { x: 15, z: -14 }, hay: { x: 6, z: -13.5 } };
/** Barn (farm_kit SM_Barn, 16 x 9.5, front facing +z), shipping bin, the shop board and the dog house spot. */
export const BARN = { x: -11, z: -12, w: 16, d: 9.5 };
export const BIN = { x: -1.5, z: -9 };
export const SHOP = { x: 5, z: 16.4 };
export const LOG_BOARD = { x: -5, z: 16.4 };
/** The order board (people in the street order farm goods), next to the shop board. */
export const ORDER_BOARD = { x: 7.6, z: 16.4 };
export const DOG_HOUSE = { x: 1, z: 9 };
/** The farm info board in the middle, by the crossroads, facing the gate: level, coins, barn (tap = the info tab). */
export const INFO_BOARD = { x: 3.9, z: 1.8 };

/** Garden decoration (LPM assets-src/lpm/recipes/farm_garden.py): flower boxes, bushes, sunflowers, apple trees outside the fence, flower clumps. */
export type DecorKind = 'planter' | 'clump' | 'bush' | 'sunflowers' | 'tree';
export interface Decor {
  kind: DecorKind;
  x: number;
  z: number;
  /** turn (radians) and size */
  r: number;
  s: number;
}
const rnd = (() => {
  let k = 11;
  return () => ((k = (k * 16807) % 2147483647) - 1) / 2147483646;
})();
export const DECOR: Decor[] = (() => {
  const out: Decor[] = [];
  const put = (kind: DecorKind, x: number, z: number, r = 0, s = 1) => out.push({ kind, x, z, r, s });
  // flower boxes along the north fence, both sides of the gate, and in front of the barn
  for (const x of [-15.5, -10.5, 11, 16]) put('planter', x, 16.9, 0);
  for (const x of [-14.5, -8]) put('planter', x, -3.6, 0);
  // sunflowers by the barn, bushes behind the pens and in the corners
  for (const x of [-18.3, -4]) put('sunflowers', x, -6.4, 0);
  for (const [x, z] of [[5, -16.7], [11, -16.8], [17.5, -16.6], [-19, 16.9], [19, 16.9], [19, -2.5], [-19, -2.6], [-11.5, -3.6]] as const) put('bush', x, z, rnd() * 6, 0.85 + rnd() * 0.3);
  // flower clumps along the path and the fences
  for (const z of [15.5, 13, 6.5, 4, -3.5, -6, -12, -14.5]) {
    if (z < 1.8 || z > 13.5) put('clump', -1.5, z, rnd() * 6, 0.9 + rnd() * 0.3);
    if (z < 8 || z > 14) put('clump', 2.5, z + 0.8, rnd() * 6, 0.9 + rnd() * 0.3);
  }
  for (const x of [-17, -12, -6.5, 7, 14, 18.5]) put('clump', x, 17.4, rnd() * 6, 1);
  for (const z of [10, 5, -9, -13]) put('clump', 19.4, z, rnd() * 6, 1);
  // outside the fence: an orchard ring and wild flowers (the gate side stays open)
  const W = MY_FARM.w / 2;
  const D = MY_FARM.d / 2;
  const ring: [number, number][] = [];
  for (let z = -D + 2; z <= D - 2; z += 6.5) ring.push([-W - 4, z], [W + 4, z]);
  for (let x = -W + 1; x <= W - 1; x += 7) ring.push([x, -D - 4]);
  for (const x of [-W + 1, -W + 8, W - 8, W - 1]) ring.push([x, D + 4.5]);
  for (const [x, z] of ring) put('tree', x + (rnd() - 0.5) * 1.5, z + (rnd() - 0.5) * 1.5, rnd() * 6, 0.85 + rnd() * 0.35);
  for (const [x, z] of [[-W - 2, -10], [W + 2, 6], [-8, -D - 2], [9, -D - 2], [-W - 2, 12], [W + 2, -12], [-12, D + 2], [12, D + 2]] as const) put('bush', x, z, rnd() * 6, 1 + rnd() * 0.3);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * (W + 1.5 + rnd() * 8);
    const z = Math.sin(a) * (D + 1.5 + rnd() * 8);
    if (z > D && Math.abs(x) < 5) continue;
    put('clump', x, z, rnd() * 6, 0.9 + rnd() * 0.5);
  }
  return out;
})();
const DECOR_HALF: Partial<Record<DecorKind, [number, number]>> = { planter: [1.25, 0.4], bush: [0.55, 0.5], sunflowers: [0.5, 0.2], tree: [0.25, 0.25] };

/**
 * The country around the farm (LPM farm_land, scene MyFarmLand): a dirt road from the gate to a lane with stone
 * walls and a mailbox, a pond, wheat fields, a neighbour's house with a meadow, woods and a ring of hills.
 * Farm-local metres; nothing here is walked on (the gate opens onto a small porch, see LOCAL_BLOCKERS).
 */
export type LandKind = 'hill' | 'pine' | 'oak' | 'pond' | 'wheat' | 'house' | 'mailbox' | 'wall';
export interface LandPiece {
  kind: LandKind;
  x: number;
  z: number;
  r: number;
  s: number;
}
export const LAND_HALF = 95;
export const POND = { x: -36, z: 4 };
export const MEADOW = { x0: 34, x1: 58, z0: 40, z1: 60 };
export const LAND: LandPiece[] = (() => {
  let k = 23;
  const rnd = () => ((k = (k * 16807) % 2147483647) - 1) / 2147483646;
  const out: LandPiece[] = [];
  const put = (kind: LandKind, x: number, z: number, r = 0, s = 1) => out.push({ kind, x, z, r, s });
  // the lane north of the farm with stone walls, the mailbox by the farm road
  put('mailbox', 2.6, 22, Math.PI);
  for (let x = -62; x <= 62; x += 4) if (Math.abs(x) > 4) put('wall', x, 31.6, 0);
  // pond west, wheat fields east and south-west, the neighbour's house north-east
  put('pond', POND.x, POND.z, 0.3);
  for (const z of [-12, -5, 2]) put('wheat', 36, z, Math.PI / 2);
  for (const x of [-30, -23]) put('wheat', x, -27, 0);
  put('house', 46, 66, Math.PI);
  put('house', -58, -44, -Math.PI / 2, 0.9);
  // woods: pines and oaks between the farm and the hills, away from the road, pond, fields and meadow
  const free = (x: number, z: number) =>
    Math.hypot(x - POND.x, z - POND.z) > 9 &&
    !(Math.abs(x) < 6 && z > 15) &&
    !(z > 27 && z < 40) &&
    !(x > 29 && x < 43 && z > -17 && z < 7) &&
    !(x > -36 && x < -17 && z > -32 && z < -22) &&
    !(x > MEADOW.x0 - 4 && x < MEADOW.x1 + 4 && z > MEADOW.z0 - 4 && z < 74) &&
    !(x > -66 && x < -50 && z > -52 && z < -36) &&
    Math.abs(x) + Math.abs(z) > 0 && (Math.abs(x) > 30 || Math.abs(z) > 28);
  for (let i = 0; i < 260 && out.filter((p) => p.kind === 'pine' || p.kind === 'oak').length < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 36 + rnd() * 30;
    const x = Math.cos(a) * d * 1.1;
    const z = Math.sin(a) * d;
    if (!free(x, z)) continue;
    put(rnd() < 0.5 ? 'pine' : 'oak', x, z, rnd() * 6, 0.85 + rnd() * 0.5);
  }
  // hills all round (backdrop)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.2;
    put('hill', Math.cos(a) * 82, Math.sin(a) * 76, rnd() * 6, 1.1 + rnd() * 0.8);
  }
  return out;
})();

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
    // a small porch outside the gate (a thief out of the gate got away; nobody wanders off into the country)
    { minX: -GATE_W / 2 - 1.2, maxX: GATE_W / 2 + 1.2, minZ: D + 2.2, maxZ: D + 2.5 },
    { minX: -GATE_W / 2 - 1.5, maxX: -GATE_W / 2 - 1.2, minZ: D, maxZ: D + 2.5 },
    { minX: GATE_W / 2 + 1.2, maxX: GATE_W / 2 + 1.5, minZ: D, maxZ: D + 2.5 },
    box(BARN.x, BARN.z, BARN.w / 2, BARN.d / 2),
    box(BIN.x, BIN.z, 0.7, 0.5),
    box(SHOP.x, SHOP.z, 1.1, 0.15),
    box(LOG_BOARD.x, LOG_BOARD.z, 1.1, 0.15),
    box(ORDER_BOARD.x, ORDER_BOARD.z, 0.85, 0.15),
    box(INFO_BOARD.x, INFO_BOARD.z, 1.4, 0.15),
  ];
  // pen fences (thin walls) with the gate gap; the animals' paths stay inside, players walk in through the gate
  const w = 0.12;
  for (const p of PENS) {
    const [g0, g1] = penGateX(p);
    out.push({ minX: p.x0 - w, maxX: p.x0 + w, minZ: p.z0, maxZ: p.z1 }, { minX: p.x1 - w, maxX: p.x1 + w, minZ: p.z0, maxZ: p.z1 });
    for (const side of ['z0', 'z1'] as const) {
      const z = p[side];
      if (penGateSide(p) === side) out.push({ minX: p.x0, maxX: g0, minZ: z - w, maxZ: z + w }, { minX: g1, maxX: p.x1, minZ: z - w, maxZ: z + w });
      else out.push({ minX: p.x0, maxX: p.x1, minZ: z - w, maxZ: z + w });
    }
  }
  out.push(box(PEN_PROPS.coop.x, PEN_PROPS.coop.z, 1.3, 1.1), box(PEN_PROPS.troughN.x, PEN_PROPS.troughN.z, 0.9, 0.35), box(PEN_PROPS.troughS.x, PEN_PROPS.troughS.z, 0.9, 0.35), box(PEN_PROPS.hay.x, PEN_PROPS.hay.z, 0.6, 0.5));
  for (const d of DECOR) {
    const h = DECOR_HALF[d.kind];
    if (h) out.push(box(d.x, d.z, h[0] * d.s, h[1] * d.s));
  }
  return out;
})();
export const blockersFor = (slot: number): Aabb[] => {
  const f = myFarm(slot);
  return LOCAL_BLOCKERS.map((b) => ({ minX: b.minX + f.cx, maxX: b.maxX + f.cx, minZ: b.minZ + f.cz, maxZ: b.maxZ + f.cz }));
};
