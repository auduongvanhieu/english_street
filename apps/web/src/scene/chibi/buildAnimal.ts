import * as THREE from 'three';
import { Part, box, capsule, cyl, shade, sphere, type V3 } from './buildChibi';
import { blush, eyes } from './buildCritter';

/**
 * Zoo and farm animals in the same chibi style as the street pets: a round body, a big round head with shiny
 * eyes, stubby legs, toon shaded. Each animal is merged per joint (body, head, tail, front leg, back leg) so it
 * costs 6–7 draw calls. Built in "unit" size (about a dog) and scaled per kind by the renderer (ANIMAL_SCALE).
 * Faces +Z; origin on the ground under the body centre.
 */
export type AnimalKind =
  | 'lion' | 'tiger' | 'elephant' | 'giraffe' | 'zebra' | 'monkey' | 'panda' | 'kangaroo' | 'penguin' | 'crocodile' | 'bear' | 'flamingo'
  | 'cow' | 'pig' | 'sheep' | 'goat' | 'horse' | 'chicken' | 'donkey';

/** How it moves (Animals.tsx picks the gait). */
export type Gait = 'walk' | 'hop' | 'waddle' | 'crawl' | 'strut';

export interface AnimalParts {
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  legF: THREE.BufferGeometry | null;
  legB: THREE.BufferGeometry | null;
  /** joint positions */
  headAt: V3;
  tailAt: V3;
  /** front legs then back legs (2 or 4 entries; hips) */
  legs: V3[];
  frontCount: number;
  hipY: number;
  gait: Gait;
}

export const ANIMAL_SCALE: Record<AnimalKind, number> = {
  lion: 2.3, tiger: 2.3, elephant: 3.6, giraffe: 2.6, zebra: 2.5, monkey: 1.9, panda: 2.5, kangaroo: 2.4, penguin: 1.9, crocodile: 2.4, bear: 2.7, flamingo: 2.2,
  cow: 2.6, pig: 2.0, sheep: 2.0, goat: 1.9, horse: 2.6, chicken: 1.5, donkey: 2.3,
};

interface Q {
  bodyR: number;
  bodyS: V3;
  headR: number;
  headAt: V3;
  hipY: number;
  legR: number;
  legX: number;
  legZ: number;
  tailAt: V3;
  fur: string;
  light: string;
  leg?: string;
  hoof?: string;
  eye?: { dx: number; dy: number; size: number; iris?: string };
  noBlush?: boolean;
}

interface Built {
  body: Part;
  head: Part;
  tail: Part;
  legF: Part;
  legB: Part;
  q: Q;
  bodyY: number;
}

/** Common quadruped: body ellipsoid + belly, head sphere + eyes, 4 capsule legs with paws/hooves. */
function quad(q: Q): Built {
  const bodyY = q.hipY + q.bodyR * 0.5;
  const body = new Part();
  body.add(sphere(q.bodyR, 0, Math.PI, 0, Math.PI * 2, 20, 14), q.fur, { p: [0, bodyY, 0], s: q.bodyS });
  body.add(sphere(q.bodyR * 0.78, 0, Math.PI, 0, Math.PI * 2, 14, 10), q.light, { p: [0, bodyY - q.bodyR * 0.22, q.bodyR * 0.3], s: [0.75, 0.72, q.bodyS[2] * 0.85] });
  const head = new Part();
  head.add(sphere(q.headR, 0, Math.PI, 0, Math.PI * 2, 22, 16), q.fur);
  const e = q.eye ?? { dx: 0.4, dy: 0.1, size: 0.19 };
  eyes(head, q.headR, q.headR * e.dx, q.headR * e.dy, q.headR * e.size, e.iris);
  if (!q.noBlush) blush(head, q.headR, q.headR * 0.64, -q.headR * 0.2);
  const tail = new Part();
  const leg = (front: boolean) => {
    const p = new Part();
    const len = q.hipY;
    p.add(capsule(q.legR, Math.max(0.01, len - q.legR * 2)), q.leg ?? q.fur, { p: [0, -len / 2, 0] });
    p.add(sphere(q.legR * 1.12, 0, Math.PI, 0, Math.PI * 2, 10, 8), q.hoof ?? q.light, { p: [0, -len + q.legR * 0.6, q.legR * 0.3], s: [1, 0.7, 1.15] });
    void front;
    return p;
  };
  return { body, head, tail, legF: leg(true), legB: leg(false), q, bodyY };
}

function finish(b: Built, gait: Gait = 'walk', opts: { legs?: V3[]; frontCount?: number; noLegs?: boolean } = {}): AnimalParts {
  const q = b.q;
  const legs: V3[] = opts.legs ?? [
    [q.legX, q.hipY, q.legZ],
    [-q.legX, q.hipY, q.legZ],
    [q.legX, q.hipY, -q.legZ],
    [-q.legX, q.hipY, -q.legZ],
  ];
  return {
    body: b.body.build(),
    head: b.head.build(),
    tail: b.tail.build(),
    legF: opts.noLegs ? null : b.legF.build(),
    legB: opts.noLegs ? null : b.legB.build(),
    headAt: q.headAt,
    tailAt: q.tailAt,
    legs: opts.noLegs ? [] : legs,
    frontCount: opts.frontCount ?? 2,
    hipY: q.hipY,
    gait,
  };
}

const roundEars = (h: Part, r: number, c: string, inner: string, spread = 0.62, y = 0.72, size = 0.3) => {
  for (const sx of [-1, 1]) {
    h.add(sphere(r * size, 0, Math.PI, 0, Math.PI * 2, 12, 10), c, { p: [sx * r * spread, r * y, -r * 0.1], s: [1, 1, 0.55] });
    h.add(sphere(r * size * 0.6, 0, Math.PI, 0, Math.PI * 2, 10, 8), inner, { p: [sx * r * spread, r * y, -r * 0.02], s: [1, 1, 0.4] });
  }
};
const muzzle = (h: Part, r: number, c: string, nose: string, z = 0.72, y = -0.32, s: V3 = [1.1, 0.78, 0.8]) => {
  h.add(sphere(r * 0.42, 0, Math.PI, 0, Math.PI * 2, 14, 10), c, { p: [0, r * y, r * z], s });
  h.add(sphere(r * 0.11), nose, { p: [0, r * (y + 0.16), r * (z + 0.38)], s: [1.4, 0.9, 0.9] });
};
const stripe = (p: Part, color: string, at: V3, r: number, rot: V3, arc = Math.PI * 0.6, t = 0.018) =>
  p.add(new THREE.TorusGeometry(r, t, 5, 16, arc), color, { p: at, r: rot });
const tailTuft = (t: Part, fur: string, tip: string, len = 0.22, ang = -0.5) => {
  t.add(capsule(0.025, len), fur, { p: [0, Math.cos(ang) * len * 0.5 * 0, -len * 0.5], r: [Math.PI / 2 + ang, 0, 0] });
  t.add(sphere(0.045), tip, { p: [0, -Math.sin(ang) * len, -len * 0.95] });
};

const builders: Record<AnimalKind, () => AnimalParts> = {
  lion() {
    const b = quad({ bodyR: 0.19, bodyS: [0.85, 0.82, 1.3], headR: 0.17, headAt: [0, 0.38, 0.22], hipY: 0.17, legR: 0.055, legX: 0.09, legZ: 0.14, tailAt: [0, 0.3, -0.25], fur: '#e8b05c', light: '#f6dcae' });
    const r = 0.17;
    // mane: a ring of fluffy spheres behind the face
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.head.add(sphere(r * 0.42, 0, Math.PI, 0, Math.PI * 2, 10, 8), i % 2 ? '#b8652a' : '#c97a32', { p: [Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, -r * 0.25] });
    }
    b.head.add(sphere(r * 1.05, 0, Math.PI, 0, Math.PI * 2, 16, 12), '#c97a32', { p: [0, 0, -r * 0.35], s: [1, 1, 0.6] });
    roundEars(b.head, r, '#e8b05c', '#c98a4a', 0.62, 0.78, 0.26);
    muzzle(b.head, r, '#f6dcae', '#6b3b2a');
    tailTuft(b.tail, '#e8b05c', '#b8652a');
    return finish(b);
  },
  tiger() {
    const b = quad({ bodyR: 0.19, bodyS: [0.85, 0.8, 1.35], headR: 0.17, headAt: [0, 0.37, 0.23], hipY: 0.16, legR: 0.055, legX: 0.09, legZ: 0.15, tailAt: [0, 0.29, -0.26], fur: '#f08a2c', light: '#fff4e4' });
    const r = 0.17;
    const bodyY = b.bodyY;
    for (const z of [-0.14, -0.06, 0.02, 0.1]) stripe(b.body, '#2a1f1f', [0, bodyY + 0.01, z], 0.16, [0, Math.PI / 2, Math.PI * 0.2]);
    for (const sx of [-1, 1]) for (const y of [0.35, 0.55]) b.head.add(box(r * 0.35, 0.02, 0.02), '#2a1f1f', { p: [sx * r * 0.82, r * (y - 0.2), r * 0.5], r: [0, -sx * 0.9, sx * 0.3] });
    b.head.add(box(0.025, r * 0.35, 0.02), '#2a1f1f', { p: [0, r * 0.75, r * 0.62], r: [0.7, 0, 0] });
    roundEars(b.head, r, '#f08a2c', '#fff4e4', 0.62, 0.76, 0.26);
    muzzle(b.head, r, '#fff4e4', '#e07a8a');
    b.tail.add(capsule(0.03, 0.26), '#f08a2c', { p: [0, 0.06, -0.12], r: [-0.9, 0, 0] });
    for (const t of [0.08, 0.16]) b.tail.add(new THREE.TorusGeometry(0.032, 0.012, 5, 10), '#2a1f1f', { p: [0, 0.04 + t * 0.45, -0.05 - t * 0.9], r: [Math.PI / 2 - 0.9, 0, 0] });
    return finish(b);
  },
  elephant() {
    const b = quad({ bodyR: 0.24, bodyS: [0.95, 0.9, 1.2], headR: 0.21, headAt: [0, 0.48, 0.26], hipY: 0.2, legR: 0.08, legX: 0.12, legZ: 0.14, tailAt: [0, 0.4, -0.28], fur: '#9aa3ad', light: '#b9c0c8', hoof: '#e8e2d6', eye: { dx: 0.42, dy: 0.18, size: 0.16 } });
    const r = 0.21;
    for (const sx of [-1, 1]) {
      b.head.add(sphere(r * 0.75, 0, Math.PI, 0, Math.PI * 2, 14, 10), '#8d96a1', { p: [sx * r * 1.0, r * 0.1, -r * 0.2], s: [0.3, 1.1, 0.95], r: [0, -sx * 0.4, 0] });
      b.head.add(sphere(r * 0.55, 0, Math.PI, 0, Math.PI * 2, 12, 8), '#e8b5bd', { p: [sx * r * 1.04, r * 0.1, -r * 0.12], s: [0.2, 1.05, 0.9], r: [0, -sx * 0.4, 0] });
      b.head.add(new THREE.ConeGeometry(r * 0.09, r * 0.45, 8), '#f7f2e6', { p: [sx * r * 0.32, -r * 0.62, r * 0.78], r: [1.9, 0, sx * 0.2] });
    }
    // trunk: tapering segments curling down and forward
    let y = -r * 0.25;
    let z = r * 0.9;
    for (let i = 0; i < 5; i++) {
      const rr = r * (0.24 - i * 0.03);
      b.head.add(sphere(rr, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#9aa3ad', { p: [0, y, z] });
      y -= r * 0.22;
      z += r * (0.12 - i * 0.03);
    }
    b.tail.add(capsule(0.02, 0.14), '#8d96a1', { p: [0, -0.06, -0.02], r: [0.3, 0, 0] });
    return finish(b);
  },
  giraffe() {
    const b = quad({ bodyR: 0.18, bodyS: [0.82, 0.8, 1.2], headR: 0.13, headAt: [0, 0.98, 0.38], hipY: 0.32, legR: 0.045, legX: 0.08, legZ: 0.13, tailAt: [0, 0.48, -0.22], fur: '#f2c35c', light: '#fbe6b4', hoof: '#5a3d2a' });
    const bodyY = b.bodyY;
    // long neck from the shoulders to the head
    b.body.add(capsule(0.06, 0.5), '#f2c35c', { p: [0, bodyY + 0.28, 0.24], r: [0.45, 0, 0] });
    b.body.add(box(0.025, 0.55, 0.05), '#a0612e', { p: [0, bodyY + 0.3, 0.2], r: [0.45, 0, 0] });
    // spots
    const spots: V3[] = [[0.12, 0.05, 0.05], [-0.12, 0.03, -0.06], [0.1, -0.04, -0.12], [-0.1, 0.08, 0.1], [0, 0.14, -0.02], [0.13, 0.02, 0.15], [-0.13, -0.02, 0.17]];
    for (const [x, yy, zz] of spots) b.body.add(sphere(0.045, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#b36a2e', { p: [x, bodyY + yy, zz], s: [Math.abs(x) > 0.1 ? 0.3 : 1, 1, 1] });
    for (const [x, yy] of [[0.055, 0.2], [-0.055, 0.32], [0.05, 0.46], [-0.05, 0.6]] as const) b.body.add(sphere(0.03, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#b36a2e', { p: [x, bodyY + yy, 0.24 + yy * 0.48], s: [0.4, 1, 1] });
    const r = 0.13;
    for (const sx of [-1, 1]) {
      b.head.add(cyl(0.012, 0.014, r * 0.6, 6), '#c98a4a', { p: [sx * r * 0.3, r * 1.0, -r * 0.1] });
      b.head.add(sphere(0.022), '#5a3d2a', { p: [sx * r * 0.3, r * 1.32, -r * 0.1] });
      b.head.add(sphere(r * 0.25, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f2c35c', { p: [sx * r * 0.85, r * 0.45, -r * 0.2], s: [1.4, 0.6, 0.6] });
    }
    muzzle(b.head, r, '#fbe6b4', '#8a5a3a', 0.78, -0.3, [1.0, 0.85, 1.1]);
    tailTuft(b.tail, '#f2c35c', '#5a3d2a', 0.18, -1.2);
    return finish(b);
  },
  zebra() {
    const b = quad({ bodyR: 0.18, bodyS: [0.8, 0.82, 1.3], headR: 0.14, headAt: [0, 0.48, 0.24], hipY: 0.22, legR: 0.045, legX: 0.08, legZ: 0.14, tailAt: [0, 0.38, -0.24], fur: '#f7f7f7', light: '#ffffff', hoof: '#2a2a2a' });
    const bodyY = b.bodyY;
    for (const z of [-0.16, -0.08, 0, 0.08, 0.16]) stripe(b.body, '#1f1f24', [0, bodyY + 0.02, z], 0.15, [0, Math.PI / 2, Math.PI * 0.2], Math.PI * 0.6, 0.02);
    b.body.add(capsule(0.06, 0.12), '#f7f7f7', { p: [0, bodyY + 0.13, 0.18], r: [0.6, 0, 0] });
    const r = 0.14;
    b.head.add(box(0.03, r * 0.9, r * 1.0), '#1f1f24', { p: [0, r * 0.75, -r * 0.4], r: [-0.3, 0, 0] });
    for (const y of [0.25, 0.5]) stripe(b.head, '#1f1f24', [0, r * y, r * 0.1], r * 0.98, [Math.PI / 2, 0, 0], Math.PI * 0.5, 0.012);
    muzzle(b.head, r, '#2b2b30', '#111111', 0.8, -0.3, [1.0, 0.85, 1.1]);
    for (const sx of [-1, 1]) b.head.add(new THREE.ConeGeometry(r * 0.22, r * 0.55, 6), '#f7f7f7', { p: [sx * r * 0.45, r * 0.95, -r * 0.1], r: [0, 0, -sx * 0.25] });
    tailTuft(b.tail, '#f7f7f7', '#1f1f24', 0.2, -1.1);
    return finish(b);
  },
  monkey() {
    const b = quad({ bodyR: 0.16, bodyS: [0.9, 1.0, 0.9], headR: 0.16, headAt: [0, 0.42, 0.1], hipY: 0.13, legR: 0.04, legX: 0.08, legZ: 0.08, tailAt: [0, 0.18, -0.14], fur: '#8a5a3a', light: '#e6c4a0' });
    const r = 0.16;
    b.head.add(sphere(r * 0.72, 0, Math.PI, 0, Math.PI * 2, 14, 10), '#f1d4b3', { p: [0, -r * 0.05, r * 0.45], s: [1.15, 0.95, 0.7] });
    roundEars(b.head, r, '#8a5a3a', '#f1d4b3', 0.95, 0.15, 0.3);
    b.head.add(new THREE.TorusGeometry(r * 0.15, r * 0.03, 5, 10, Math.PI), '#5a2a25', { p: [0, -r * 0.35, r * 0.88], r: [-0.3, 0, Math.PI] });
    // long curly tail
    b.tail.add(new THREE.TorusGeometry(0.12, 0.022, 6, 16, Math.PI * 1.4), '#8a5a3a', { p: [0, 0.1, -0.08], r: [0, Math.PI / 2, 0.4] });
    return finish(b, 'hop');
  },
  panda() {
    const b = quad({ bodyR: 0.21, bodyS: [0.95, 0.9, 1.1], headR: 0.19, headAt: [0, 0.38, 0.18], hipY: 0.13, legR: 0.07, legX: 0.11, legZ: 0.11, tailAt: [0, 0.22, -0.22], fur: '#f7f7f2', light: '#ffffff', leg: '#26252b', hoof: '#26252b', eye: { dx: 0.38, dy: 0.08, size: 0.17 } });
    const r = 0.19;
    b.body.add(new THREE.TorusGeometry(0.15, 0.06, 8, 18), '#26252b', { p: [0, b.bodyY + 0.07, 0.04], r: [Math.PI / 2 - 0.2, 0, 0], s: [1.1, 1, 0.8] });
    for (const sx of [-1, 1]) b.head.add(sphere(r * 0.24, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#26252b', { p: [sx * r * 0.38, r * 0.06, r * 0.86], s: [1, 1.3, 0.4], r: [0, sx * 0.4, sx * -0.4] });
    roundEars(b.head, r, '#26252b', '#26252b', 0.62, 0.74, 0.28);
    muzzle(b.head, r, '#ffffff', '#26252b');
    b.tail.add(sphere(0.05), '#f7f7f2');
    // eyes again on top of the patches (the base eyes are hidden under them)
    eyes(b.head, r * 1.01, r * 0.38, r * 0.08, r * 0.13);
    return finish(b);
  },
  kangaroo() {
    const b = quad({ bodyR: 0.17, bodyS: [0.85, 1.25, 0.95], headR: 0.14, headAt: [0, 0.62, 0.12], hipY: 0.16, legR: 0.05, legX: 0.09, legZ: 0.04, tailAt: [0, 0.18, -0.12], fur: '#c98a52', light: '#f2d8b4' });
    const r = 0.14;
    b.body.add(sphere(0.07, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#e6c49a', { p: [0, b.bodyY - 0.02, 0.14], s: [1, 0.8, 0.5] }); // pouch
    b.body.add(sphere(0.045), '#c98a52', { p: [0, b.bodyY + 0.03, 0.17] }); // joey peeking out
    for (const sx of [-1, 1]) {
      b.head.add(new THREE.ConeGeometry(r * 0.25, r * 0.85, 8), '#c98a52', { p: [sx * r * 0.42, r * 1.05, -r * 0.1], r: [0, 0, -sx * 0.2], s: [1, 1, 0.55] });
      b.body.add(capsule(0.025, 0.08), '#c98a52', { p: [sx * 0.08, b.bodyY + 0.12, 0.12], r: [-0.9, 0, 0] }); // little arms
    }
    muzzle(b.head, r, '#f2d8b4', '#3a2a22', 0.78, -0.25, [0.9, 0.8, 1.1]);
    b.tail.add(capsule(0.05, 0.32), '#c98a52', { p: [0, -0.08, -0.16], r: [-1.9, 0, 0] });
    return finish(b, 'hop', { legs: [[0.09, 0.16, 0.04], [-0.09, 0.16, 0.04]], frontCount: 0 });
  },
  penguin() {
    const b = quad({ bodyR: 0.17, bodyS: [0.9, 1.35, 0.85], headR: 0.14, headAt: [0, 0.48, 0.0], hipY: 0.04, legR: 0.03, legX: 0.06, legZ: 0.02, tailAt: [0, 0.08, -0.12], fur: '#2a2c36', light: '#ffffff', eye: { dx: 0.36, dy: 0.12, size: 0.2 } });
    const r = 0.14;
    b.body.add(sphere(0.15, 0, Math.PI, 0, Math.PI * 2, 14, 10), '#ffffff', { p: [0, b.bodyY - 0.01, 0.05], s: [0.85, 1.25, 0.8] });
    for (const sx of [-1, 1]) {
      b.body.add(sphere(0.07, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#2a2c36', { p: [sx * 0.16, b.bodyY, 0], s: [0.3, 1.4, 0.7], r: [0, 0, sx * 0.25] });
      b.body.add(sphere(0.05, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f59a2e', { p: [sx * 0.06, 0.02, 0.07], s: [1, 0.35, 1.5] });
    }
    b.head.add(sphere(r * 0.75, 0, Math.PI, 0, Math.PI * 2, 12, 10), '#ffffff', { p: [0, -r * 0.1, r * 0.4], s: [1.1, 0.9, 0.7] });
    b.head.add(new THREE.ConeGeometry(r * 0.16, r * 0.4, 8), '#f59a2e', { p: [0, -r * 0.18, r * 1.05], r: [Math.PI / 2, 0, 0] });
    eyes(b.head, r * 1.01, r * 0.36, r * 0.12, r * 0.18);
    b.tail.add(new THREE.ConeGeometry(0.05, 0.08, 6), '#2a2c36', { r: [-2, 0, 0] });
    return finish(b, 'waddle', { noLegs: true });
  },
  crocodile() {
    const b = quad({ bodyR: 0.15, bodyS: [1.0, 0.55, 1.9], headR: 0.11, headAt: [0, 0.16, 0.34], hipY: 0.06, legR: 0.035, legX: 0.14, legZ: 0.15, tailAt: [0, 0.12, -0.3], fur: '#4f8a3a', light: '#c9d98a', eye: { dx: 0.4, dy: 0.55, size: 0.24 }, noBlush: true });
    const r = 0.11;
    for (let i = -3; i <= 3; i++) b.body.add(new THREE.ConeGeometry(0.025, 0.05, 4), '#3a6b2a', { p: [0, b.bodyY + 0.075, i * 0.06] });
    b.head.add(box(r * 1.5, r * 0.55, r * 2.6), '#4f8a3a', { p: [0, -r * 0.25, r * 1.4] });
    b.head.add(box(r * 1.42, r * 0.2, r * 2.5), '#c9d98a', { p: [0, -r * 0.55, r * 1.4] });
    for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) b.head.add(new THREE.ConeGeometry(0.012, 0.035, 4), '#ffffff', { p: [sx * r * 0.65, -r * 0.48, r * (0.5 + i * 0.35)], r: [Math.PI, 0, 0] });
    b.tail.add(new THREE.ConeGeometry(0.1, 0.55, 8), '#4f8a3a', { p: [0, -0.04, -0.27], r: [-Math.PI / 2, 0, 0], s: [1, 1, 0.5] });
    return finish(b, 'crawl');
  },
  bear() {
    const b = quad({ bodyR: 0.22, bodyS: [0.95, 0.88, 1.2], headR: 0.18, headAt: [0, 0.4, 0.24], hipY: 0.15, legR: 0.07, legX: 0.11, legZ: 0.14, tailAt: [0, 0.28, -0.27], fur: '#8a5a36', light: '#b88a5c' });
    const r = 0.18;
    roundEars(b.head, r, '#8a5a36', '#c49a70', 0.64, 0.76, 0.3);
    muzzle(b.head, r, '#d8b48a', '#2a1a14');
    b.tail.add(sphere(0.05), '#8a5a36');
    return finish(b);
  },
  flamingo() {
    const b = quad({ bodyR: 0.14, bodyS: [0.85, 0.8, 1.25], headR: 0.09, headAt: [0, 0.9, 0.18], hipY: 0.44, legR: 0.015, legX: 0.04, legZ: 0, tailAt: [0, 0.5, -0.16], fur: '#f58fb0', light: '#f9b8cc', leg: '#e0708f', hoof: '#e0708f', eye: { dx: 0.4, dy: 0.15, size: 0.22 } });
    const bodyY = b.bodyY;
    for (const sx of [-1, 1]) b.body.add(sphere(0.09, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#e9779c', { p: [sx * 0.1, bodyY + 0.02, -0.02], s: [0.35, 0.7, 1.3] });
    // S-shaped neck
    b.body.add(capsule(0.028, 0.16), '#f58fb0', { p: [0, bodyY + 0.12, 0.12], r: [-0.4, 0, 0] });
    b.body.add(capsule(0.026, 0.16), '#f58fb0', { p: [0, bodyY + 0.28, 0.12], r: [0.5, 0, 0] });
    const r = 0.09;
    b.head.add(box(r * 0.5, r * 0.5, r * 1.2), '#ffffff', { p: [0, -r * 0.25, r * 1.1], r: [0.5, 0, 0] });
    b.head.add(box(r * 0.45, r * 0.4, r * 0.6), '#2a2a2a', { p: [0, -r * 0.75, r * 1.45], r: [1.0, 0, 0] });
    b.tail.add(new THREE.ConeGeometry(0.06, 0.1, 6), '#e9779c', { r: [-2.1, 0, 0] });
    return finish(b, 'strut', { legs: [[0.04, 0.44, 0], [-0.04, 0.44, 0]], frontCount: 0 });
  },
  cow() {
    const b = quad({ bodyR: 0.2, bodyS: [0.88, 0.85, 1.35], headR: 0.16, headAt: [0, 0.42, 0.27], hipY: 0.2, legR: 0.05, legX: 0.1, legZ: 0.16, tailAt: [0, 0.38, -0.28], fur: '#fafafa', light: '#ffffff', hoof: '#3a3030' });
    const bodyY = b.bodyY;
    for (const [x, y, z, s] of [[0.13, 0.04, 0.05, 1], [-0.13, 0.02, -0.08, 1.2], [0.05, 0.13, -0.12, 0.9], [-0.1, 0.1, 0.14, 0.8]] as const) b.body.add(sphere(0.06 * s, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#2b2b30', { p: [x, bodyY + y, z], s: [Math.abs(x) > 0.1 ? 0.35 : 1, 1, 1.2] });
    b.body.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#f4a6b4', { p: [0, bodyY - 0.15, -0.08], s: [1, 0.6, 1] }); // udder
    const r = 0.16;
    b.head.add(sphere(r * 0.4, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#2b2b30', { p: [r * 0.4, r * 0.4, r * 0.65], s: [1, 1, 0.4] });
    muzzle(b.head, r, '#f4b6c0', '#c8707e', 0.78, -0.38, [1.25, 0.85, 0.8]);
    for (const sx of [-1, 1]) {
      b.head.add(new THREE.ConeGeometry(r * 0.1, r * 0.4, 8), '#f2e6c8', { p: [sx * r * 0.55, r * 0.92, -r * 0.05], r: [0, 0, -sx * 0.6] });
      b.head.add(sphere(r * 0.24, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#fafafa', { p: [sx * r * 0.95, r * 0.42, -r * 0.1], s: [1.4, 0.6, 0.7] });
    }
    tailTuft(b.tail, '#fafafa', '#2b2b30', 0.2, -1.2);
    return finish(b);
  },
  pig() {
    const b = quad({ bodyR: 0.19, bodyS: [0.9, 0.85, 1.25], headR: 0.16, headAt: [0, 0.3, 0.24], hipY: 0.1, legR: 0.045, legX: 0.09, legZ: 0.13, tailAt: [0, 0.26, -0.25], fur: '#f7b2c0', light: '#fbc6d1', hoof: '#d9849a' });
    const r = 0.16;
    b.head.add(cyl(r * 0.36, r * 0.38, r * 0.3, 14), '#f49aac', { p: [0, -r * 0.18, r * 0.96], r: [Math.PI / 2, 0, 0] });
    for (const sx of [-1, 1]) {
      b.head.add(sphere(r * 0.07), '#b85a72', { p: [sx * r * 0.12, -r * 0.18, r * 1.12] });
      b.head.add(new THREE.ConeGeometry(r * 0.28, r * 0.42, 4), '#f49aac', { p: [sx * r * 0.55, r * 0.85, 0], r: [0.4, Math.PI / 4, -sx * 0.4] });
    }
    b.tail.add(new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI * 1.7), '#f49aac', { p: [0, 0.02, -0.02], r: [0, Math.PI / 2, 0] });
    return finish(b);
  },
  sheep() {
    const b = quad({ bodyR: 0.19, bodyS: [0.9, 0.85, 1.15], headR: 0.13, headAt: [0, 0.36, 0.22], hipY: 0.14, legR: 0.035, legX: 0.09, legZ: 0.11, tailAt: [0, 0.3, -0.22], fur: '#f4f1ea', light: '#ffffff', leg: '#2e2a2a', hoof: '#2e2a2a', eye: { dx: 0.4, dy: 0.12, size: 0.2 } });
    const bodyY = b.bodyY;
    // fluffy wool: a cloud of spheres
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      b.body.add(sphere(0.08, 0, Math.PI, 0, Math.PI * 2, 10, 8), i % 2 ? '#fbf8f2' : '#efeae0', { p: [Math.cos(a) * 0.14, bodyY + Math.sin(a * 2) * 0.05 + 0.06, Math.sin(a) * 0.18] });
    }
    const r = 0.13;
    b.head.add(sphere(r * 1.0, 0, Math.PI, 0, Math.PI * 2, 14, 10), '#3a3232', { p: [0, -r * 0.05, r * 0.05], s: [0.92, 1, 0.98] });
    eyes(b.head, r * 1.02, r * 0.4, r * 0.12, r * 0.2);
    for (let i = 0; i < 5; i++) b.head.add(sphere(r * 0.32, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#fbf8f2', { p: [(i - 2) * r * 0.28, r * 0.85, -r * 0.05] });
    for (const sx of [-1, 1]) b.head.add(sphere(r * 0.25, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#3a3232', { p: [sx * r * 0.95, r * 0.3, -r * 0.05], s: [1.5, 0.6, 0.8] });
    b.tail.add(sphere(0.05), '#fbf8f2');
    return finish(b);
  },
  goat() {
    const b = quad({ bodyR: 0.16, bodyS: [0.82, 0.82, 1.25], headR: 0.13, headAt: [0, 0.4, 0.2], hipY: 0.17, legR: 0.035, legX: 0.075, legZ: 0.12, tailAt: [0, 0.32, -0.21], fur: '#f2ece2', light: '#ffffff', hoof: '#4a4040' });
    b.body.add(sphere(0.07, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#a07850', { p: [0.06, b.bodyY + 0.1, -0.04], s: [1.3, 0.5, 1.5] });
    const r = 0.13;
    muzzle(b.head, r, '#e8dccb', '#6a4a4a', 0.75, -0.3, [0.9, 0.8, 1.1]);
    b.head.add(new THREE.ConeGeometry(r * 0.16, r * 0.5, 6), '#d8ccb8', { p: [0, -r * 0.85, r * 0.75], r: [Math.PI - 0.3, 0, 0] }); // beard
    for (const sx of [-1, 1]) {
      b.head.add(new THREE.TorusGeometry(r * 0.38, r * 0.07, 6, 10, Math.PI * 0.8), '#8a7a6a', { p: [sx * r * 0.35, r * 0.85, -r * 0.3], r: [0, Math.PI / 2, 0.6] });
      b.head.add(sphere(r * 0.25, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f2ece2', { p: [sx * r * 0.95, r * 0.25, -r * 0.05], s: [1.5, 0.55, 0.7] });
    }
    b.tail.add(new THREE.ConeGeometry(0.025, 0.07, 6), '#f2ece2', { p: [0, 0.03, -0.01], r: [-0.6, 0, 0] });
    return finish(b, 'hop');
  },
  horse() {
    const b = quad({ bodyR: 0.19, bodyS: [0.82, 0.85, 1.4], headR: 0.14, headAt: [0, 0.6, 0.3], hipY: 0.25, legR: 0.048, legX: 0.085, legZ: 0.16, tailAt: [0, 0.42, -0.27], fur: '#a0612e', light: '#c98a52', hoof: '#2a2020' });
    const bodyY = b.bodyY;
    b.body.add(capsule(0.075, 0.16), '#a0612e', { p: [0, bodyY + 0.16, 0.2], r: [0.55, 0, 0] });
    b.body.add(box(0.04, 0.28, 0.08), '#3a2418', { p: [0, bodyY + 0.2, 0.15], r: [0.55, 0, 0] });
    const r = 0.14;
    muzzle(b.head, r, '#c98a52', '#3a2418', 0.85, -0.3, [0.95, 0.85, 1.25]);
    b.head.add(sphere(r * 0.3, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#3a2418', { p: [0, r * 0.75, r * 0.4], s: [1, 0.6, 1] });
    for (const sx of [-1, 1]) b.head.add(new THREE.ConeGeometry(r * 0.2, r * 0.5, 6), '#a0612e', { p: [sx * r * 0.42, r * 0.95, -r * 0.1], r: [0, 0, -sx * 0.25] });
    b.tail.add(capsule(0.045, 0.22), '#3a2418', { p: [0, -0.1, -0.06], r: [0.35, 0, 0] });
    return finish(b);
  },
  donkey() {
    const b = quad({ bodyR: 0.18, bodyS: [0.82, 0.85, 1.3], headR: 0.14, headAt: [0, 0.5, 0.26], hipY: 0.2, legR: 0.045, legX: 0.08, legZ: 0.14, tailAt: [0, 0.36, -0.25], fur: '#9a948e', light: '#e6e0da', hoof: '#2a2424' });
    b.body.add(capsule(0.065, 0.1), '#9a948e', { p: [0, b.bodyY + 0.12, 0.18], r: [0.6, 0, 0] });
    const r = 0.14;
    muzzle(b.head, r, '#e6e0da', '#3a3434', 0.82, -0.32, [1.0, 0.85, 1.2]);
    for (const sx of [-1, 1]) {
      b.head.add(new THREE.ConeGeometry(r * 0.24, r * 1.3, 8), '#9a948e', { p: [sx * r * 0.42, r * 1.3, -r * 0.1], r: [0, 0, -sx * 0.3], s: [1, 1, 0.5] });
      b.head.add(new THREE.ConeGeometry(r * 0.1, r * 0.35, 6), '#2a2424', { p: [sx * r * 0.62, r * 1.9, -r * 0.1], r: [0, 0, -sx * 0.3] });
    }
    tailTuft(b.tail, '#9a948e', '#2a2424', 0.2, -1.2);
    return finish(b);
  },
  chicken() {
    const b = quad({ bodyR: 0.14, bodyS: [0.85, 0.85, 1.05], headR: 0.1, headAt: [0, 0.36, 0.1], hipY: 0.1, legR: 0.014, legX: 0.045, legZ: 0, tailAt: [0, 0.24, -0.13], fur: '#fbfaf5', light: '#ffffff', leg: '#f2a02e', hoof: '#f2a02e', eye: { dx: 0.42, dy: 0.15, size: 0.2 } });
    for (const sx of [-1, 1]) b.body.add(sphere(0.08, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#ece8de', { p: [sx * 0.11, b.bodyY + 0.02, -0.01], s: [0.35, 0.7, 1.2] });
    const r = 0.1;
    b.head.add(new THREE.ConeGeometry(r * 0.25, r * 0.45, 6), '#f2a02e', { p: [0, -r * 0.1, r * 1.05], r: [Math.PI / 2, 0, 0] });
    for (let i = -1; i <= 1; i++) b.head.add(sphere(r * 0.2), '#e0393b', { p: [0, r * (1.0 + (i === 0 ? 0.12 : 0)), i * r * 0.22] });
    b.head.add(sphere(r * 0.14, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#e0393b', { p: [0, -r * 0.42, r * 0.85], s: [0.8, 1.3, 0.8] });
    for (let i = 0; i < 3; i++) b.tail.add(sphere(0.05, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f4f0e4', { p: [0, 0.04 + i * 0.03, -0.02 - i * 0.015], s: [0.5, 1.4, 1] });
    return finish(b, 'strut', { legs: [[0.045, 0.1, 0], [-0.045, 0.1, 0]], frontCount: 0 });
  },
};

const cache = new Map<AnimalKind, AnimalParts>();
/** Built once per kind and shared by every instance (geometry is read-only). */
export function animalParts(kind: AnimalKind): AnimalParts {
  let p = cache.get(kind);
  if (!p) cache.set(kind, (p = builders[kind]()));
  return p;
}
void shade;
