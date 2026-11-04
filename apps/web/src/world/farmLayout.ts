import type { AnimalKind } from '../scene/chibi/buildAnimal';
import { registerBlockers, type Aabb } from './layout';

/**
 * Green Valley Farm (x 110…166). North yard: paddock (cows, horse, donkey), pig pen, sheep & goat pen,
 * chicken run with a coop, red barn and a windmill. South of the road: the learner's six garden plots,
 * an apple orchard and the market stall.
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

/** The learner's garden: 2 rows × 3 plots of 2.4 m, south of the road (z 8…13). */
export const PLOTS: { x: number; z: number }[] = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 116 + (i % 3) * 3.4, z: i < 3 ? 9 : 12.6 }));
export const PLOT_SIZE = 2.4;
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
  return out;
}
registerBlockers(pens());

export { CROPS, GROW_MS, type Crop } from '@es/shared';
