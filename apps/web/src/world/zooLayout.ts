import type { AnimalKind } from '../scene/chibi/buildAnimal';
import type { Aabb } from './layout';
import { registerBlockers } from './layout';
import { benchPair, registerSeats } from './seats';

/**
 * Sunny Hills Zoo (x 50…106, north of the road). Two rows of six enclosures with walkways in front, between
 * and behind them; the entrance path from the gate (x = 78) runs north through a gap in the front row.
 *
 *   z -6     front fence + gate
 *   z -9…-6  front walkway
 *   z -16…-9.5   row A (3 enclosures | entrance path | 3 enclosures)
 *   z -19.5…-16  middle walkway
 *   z -27…-19.5  row B (3 | zookeeper hut | 3)
 */
export type Habitat = 'savanna' | 'grass' | 'water' | 'bamboo' | 'rocks' | 'pond';
export interface Enclosure {
  id: string;
  /** Area item id (zoo.yaml) */
  item: string;
  kind: AnimalKind;
  names: string[];
  habitat: Habitat;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Side the sign faces (the walkway it is read from). */
  signSide: 'south' | 'north';
}

const COLS_A: [number, number][] = [
  [51, 58.5],
  [59.5, 67],
  [68, 75],
  [81, 88],
  [89, 96.5],
  [97.5, 105],
];
const ROW_A: [number, number] = [-16, -9.5];
const ROW_B: [number, number] = [-27, -19.5];

const spec: [string, AnimalKind, string[], Habitat][] = [
  ['lion', 'lion', ['Leo'], 'savanna'],
  ['giraffe', 'giraffe', ['Gina'], 'savanna'],
  ['zebra', 'zebra', ['Zig', 'Zag'], 'savanna'],
  ['penguin', 'penguin', ['Pebble', 'Waddles', 'Flip'], 'water'],
  ['panda', 'panda', ['Bao'], 'bamboo'],
  ['monkey', 'monkey', ['Coco', 'Kiki'], 'grass'],
  ['tiger', 'tiger', ['Raja'], 'grass'],
  ['elephant', 'elephant', ['Ellie'], 'savanna'],
  ['kangaroo', 'kangaroo', ['Skip'], 'grass'],
  ['crocodile', 'crocodile', ['Snappy'], 'pond'],
  ['bear', 'bear', ['Bruno'], 'rocks'],
  ['flamingo', 'flamingo', ['Rosie', 'Coral', 'Blush'], 'pond'],
];

export const ENCLOSURES: Enclosure[] = spec.map(([item, kind, names, habitat], i) => {
  const row = i < 6 ? ROW_A : ROW_B;
  const col = COLS_A[i % 6]!;
  return { id: `zoo-${item}`, item, kind, names, habitat, x0: col[0], x1: col[1], z0: row[0], z1: row[1], signSide: i < 6 ? 'south' : 'south' };
});

/**
 * Petting corner on the park side of the road, opposite the zoo gate: a low fence with a gate facing the
 * road, baby goats, lambs, rabbits and guinea pigs (critters.ts) you can pick up and hug.
 */
export const PETTING = { x0: 84, x1: 100, z0: 7.2, z1: 14.6, gateX: 92, gateW: 2.6 };
/** Hay feeder and the guinea-pig hutch inside the corner. */
export const PETTING_FEEDER = { x: 96.5, z: 13.4 };
export const PETTING_HUTCH: Aabb = { minX: 85, maxX: 87.4, minZ: 12.8, maxZ: 14.3 };

function pettingBlockers(): Aabb[] {
  const t = 0.12;
  const P = PETTING;
  const g0 = P.gateX - P.gateW / 2;
  const g1 = P.gateX + P.gateW / 2;
  return [
    { minX: P.x0, maxX: g0, minZ: P.z0 - t, maxZ: P.z0 + t },
    { minX: g1, maxX: P.x1, minZ: P.z0 - t, maxZ: P.z0 + t },
    { minX: P.x0, maxX: P.x1, minZ: P.z1 - t, maxZ: P.z1 + t },
    { minX: P.x0 - t, maxX: P.x0 + t, minZ: P.z0, maxZ: P.z1 },
    { minX: P.x1 - t, maxX: P.x1 + t, minZ: P.z0, maxZ: P.z1 },
    { minX: PETTING_FEEDER.x - 0.9, maxX: PETTING_FEEDER.x + 0.9, minZ: PETTING_FEEDER.z - 0.4, maxZ: PETTING_FEEDER.z + 0.4 },
    PETTING_HUTCH,
  ];
}
registerBlockers(pettingBlockers());

/** Zookeeper hut in the middle of row B. */
export const HUT: Aabb = { minX: 76, maxX: 80, minZ: -26.5, maxZ: -22.5 };

/** Thin walls on all four sides of every enclosure (players can look over the low fence but not step in). */
function blockers(): Aabb[] {
  const t = 0.15;
  const out: Aabb[] = [HUT];
  for (const e of ENCLOSURES) {
    out.push({ minX: e.x0, maxX: e.x1, minZ: e.z0 - t, maxZ: e.z0 + t });
    out.push({ minX: e.x0, maxX: e.x1, minZ: e.z1 - t, maxZ: e.z1 + t });
    out.push({ minX: e.x0 - t, maxX: e.x0 + t, minZ: e.z0, maxZ: e.z1 });
    out.push({ minX: e.x1 - t, maxX: e.x1 + t, minZ: e.z0, maxZ: e.z1 });
  }
  return out;
}
registerBlockers(blockers());

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A wandering loop inside an enclosure (deterministic per animal). */
export function enclosurePath(e: Enclosure, idx: number, margin = 1.3): [number, number][] {
  const r = rng(e.id.length * 977 + idx * 131 + Math.round(e.x0 * 7));
  const pts: [number, number][] = [];
  for (let i = 0; i < 4; i++) pts.push([e.x0 + margin + r() * (e.x1 - e.x0 - 2 * margin), e.z0 + margin + r() * (e.z1 - e.z0 - 2 * margin)]);
  return pts;
}

/** Feeding time: the first 2 minutes of every 10 (server clock), at the penguin pool. */
export function feedingNow(serverMs: number): boolean {
  return Math.floor(serverMs / 60000) % 10 < 2;
}

// the two benches on the middle walkway (scene/areas/Zoo.tsx)
registerSeats([62, 94].flatMap((x) => benchPair(x, -17.8, 0, 0.45)).map(([x, z, rot]) => ({ x, z, rot })));
