import type { AnimalKind } from '../scene/chibi/buildAnimal';
import { registerBlockers, type Aabb } from './layout';
import { registerSeats } from './seats';

/**
 * Green Valley Farm (x 110…166). North yard: paddock (cows, horse, donkey), pig pen, sheep & goat pen,
 * chicken run with a coop, red barn and a windmill. South of the road: a public flower garden, an apple orchard
 * and the market stall.
 */
export interface Pen {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  animals: { kind: AnimalKind; item: string; name: string }[];
  ground: string;
}

export const PENS: Pen[] = [
  {
    id: 'paddock', x0: 112, x1: 140, z0: -28, z1: -17, ground: '#86c25a',
    animals: [
      { kind: 'cow', item: 'cow', name: 'Daisy' },
      { kind: 'cow', item: 'cow', name: 'Bella' },
      { kind: 'horse', item: 'horse', name: 'Thunder' },
      { kind: 'donkey', item: 'donkey', name: 'Dusty' },
    ],
  },
  { id: 'pigs', x0: 112, x1: 123, z0: -14, z1: -8.5, ground: '#9a7a52', animals: [{ kind: 'pig', item: 'pig', name: 'Peggy' }, { kind: 'pig', item: 'pig', name: 'Truffle' }] },
  { id: 'sheep', x0: 131, x1: 143, z0: -14, z1: -8.5, ground: '#93c866', animals: [{ kind: 'sheep', item: 'sheep', name: 'Woolly' }, { kind: 'sheep', item: 'sheep', name: 'Cloud' }, { kind: 'goat', item: 'goat', name: 'Billy' }] },
  { id: 'chickens', x0: 146, x1: 157, z0: -14, z1: -8.5, ground: '#d8c08a', animals: [{ kind: 'chicken', item: 'chicken', name: 'Henny' }, { kind: 'chicken', item: 'chicken', name: 'Penny' }, { kind: 'chicken', item: 'chicken', name: 'Ruby' }] },
];

export const BARN: Aabb = { minX: 146, maxX: 162, minZ: -28.5, maxZ: -19 };
export const WINDMILL = { x: 162.5, z: -11 };
export const COOP: Aabb = { minX: 153.5, maxX: 156.5, minZ: -13.5, maxZ: -11 };

/**
 * Public flower garden south of the road (where the old garden plots were; everyone's crops now grow in "My farm"):
 * gravel paths in a cross, sunflowers in a round bed in the middle, four flower boxes, bushes in the corners and
 * four benches along the east-west path. Props: LPM farm_garden (+ the zoo kit bench).
 */
export const FLOWER_GARDEN = { x0: 112.5, x1: 129.5, z0: 6.5, z1: 15.3, cx: 121, cz: 11 };
export type GardenProp = { kind: 'planter' | 'clump' | 'bush' | 'sunflowers' | 'bench'; x: number; z: number; r: number; s: number };
export const GARDEN_PROPS: GardenProp[] = (() => {
  const { cx, cz } = FLOWER_GARDEN;
  const out: GardenProp[] = [];
  const put = (kind: GardenProp['kind'], x: number, z: number, r = 0, s = 1) => out.push({ kind, x, z, r, s });
  // the round bed: sunflowers in the middle, a ring of flower clumps
  put('sunflowers', cx, cz, 0, 1.1);
  for (let i = 0; i < 10; i++) put('clump', cx + Math.cos((i / 10) * Math.PI * 2) * 1.25, cz + Math.sin((i / 10) * Math.PI * 2) * 1.25, i * 1.3, 0.9 + (i % 3) * 0.1);
  // flower boxes in the four quarters, bushes in the corners
  for (const [x, z] of [[116, 8.4], [126, 8.4], [116, 13.8], [126, 13.8]] as const) put('planter', x, z);
  for (const [x, z] of [[113.3, 7.4], [128.7, 7.4], [113.3, 14.6], [128.7, 14.6]] as const) put('bush', x, z, x + z, 1.1);
  // wild flowers round the boxes
  for (const [x, z] of [[113.6, 9.4], [118.7, 7.3], [123.3, 7.4], [128.6, 9.3], [113.5, 12.8], [118.6, 14.8], [123.4, 14.7], [128.5, 12.9], [119, 9.2], [123, 12.9]] as const) put('clump', x, z, x * 0.7, 1.1);
  // benches on both sides of the east-west path, facing it
  for (const x of [116.5, 125.5]) {
    put('bench', x, 9.7, 0);
    put('bench', x, 12.3, Math.PI);
  }
  return out;
})();
const GARDEN_HALF: Partial<Record<GardenProp['kind'], [number, number]>> = { planter: [1.25, 0.4], bush: [0.6, 0.55], bench: [0.95, 0.3] };
export const ORCHARD: { x: number; z: number }[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: 146 + (i % 4) * 4.4, z: i < 4 ? 8.6 : 13 }));
/** Market stall on the field side, by the pavement. */
export const STALL = { x: 134, z: 8.2 };

function pens(): Aabb[] {
  const t = 0.15;
  const out: Aabb[] = [BARN, COOP, { minX: WINDMILL.x - 1.2, maxX: WINDMILL.x + 1.2, minZ: WINDMILL.z - 1.2, maxZ: WINDMILL.z + 1.2 }, { minX: STALL.x - 1.6, maxX: STALL.x + 1.6, minZ: STALL.z - 0.5, maxZ: STALL.z + 0.5 }];
  for (const p of PENS) {
    out.push({ minX: p.x0, maxX: p.x1, minZ: p.z0 - t, maxZ: p.z0 + t }, { minX: p.x0, maxX: p.x1, minZ: p.z1 - t, maxZ: p.z1 + t });
    out.push({ minX: p.x0 - t, maxX: p.x0 + t, minZ: p.z0, maxZ: p.z1 }, { minX: p.x1 - t, maxX: p.x1 + t, minZ: p.z0, maxZ: p.z1 });
  }
  for (const o of ORCHARD) out.push({ minX: o.x - 0.3, maxX: o.x + 0.3, minZ: o.z - 0.3, maxZ: o.z + 0.3 });
  for (const g of GARDEN_PROPS) {
    const h = GARDEN_HALF[g.kind];
    if (h) out.push({ minX: g.x - h[0], maxX: g.x + h[0], minZ: g.z - h[1], maxZ: g.z + h[1] });
  }
  // the round bed in the middle
  out.push({ minX: FLOWER_GARDEN.cx - 1.2, maxX: FLOWER_GARDEN.cx + 1.2, minZ: FLOWER_GARDEN.cz - 1.2, maxZ: FLOWER_GARDEN.cz + 1.2 });
  return out;
}
registerBlockers(pens());

export { CROPS, GROW_MS, type Crop } from '@es/shared';

// the garden benches: two seats each, facing the path
registerSeats(GARDEN_PROPS.filter((g) => g.kind === 'bench').flatMap((g) => [-0.45, 0.45].map((d) => ({ x: g.x + d, z: g.z, rot: g.r }))));
