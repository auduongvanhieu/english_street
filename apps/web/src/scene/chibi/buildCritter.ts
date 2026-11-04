import * as THREE from 'three';
import type { CritterKind } from '../../world/critters';
import { Part, box, capsule, cyl, shade, sphere, type V3 } from './buildChibi';

/**
 * Chibi cats and dogs in the same style as the characters: round body, big round head, big shiny eyes,
 * short stubby legs, toon shaded. Parts are merged per joint (body, head, tail, 4 legs) so each animal is
 * 7 draw calls; `Critters.tsx` animates them procedurally. Animal faces +Z.
 */
export interface Coat {
  /** main fur */
  fur: string;
  /** muzzle / belly / paws */
  light: string;
  /** ear tips, tail tip, stripes */
  dark: string;
  /** iris ring colour (shows on dark fur) */
  iris?: string;
}

export interface CritterRig {
  /** joint positions (body space) */
  head: V3;
  tail: V3;
  legs: V3[]; // FL, FR, BL, BR (empty for ducks)
  /** body centre height when standing (the body group is lowered for naps) */
  height: number;
}

export interface CritterParts {
  rig: CritterRig;
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  /** null for animals without visible legs (ducks on the water) */
  leg: THREE.BufferGeometry | null;
}

interface Dims {
  bodyR: number;
  bodyS: V3;
  headR: number;
  legR: number;
  legLen: number;
  hipY: number;
  legX: number;
  legZ: number;
  headAt: V3;
  tailAt: V3;
}
const DIMS: Record<'cat' | 'shiba' | 'husky', Dims> = {
  cat: { bodyR: 0.14, bodyS: [0.85, 0.8, 1.2], headR: 0.135, legR: 0.04, legLen: 0.05, hipY: 0.115, legX: 0.065, legZ: 0.09, headAt: [0, 0.24, 0.13], tailAt: [0, 0.2, -0.15] },
  shiba: { bodyR: 0.18, bodyS: [0.85, 0.8, 1.25], headR: 0.17, legR: 0.05, legLen: 0.07, hipY: 0.15, legX: 0.085, legZ: 0.13, headAt: [0, 0.32, 0.18], tailAt: [0, 0.27, -0.2] },
  husky: { bodyR: 0.2, bodyS: [0.88, 0.82, 1.3], headR: 0.185, legR: 0.058, legLen: 0.09, hipY: 0.17, legX: 0.095, legZ: 0.15, headAt: [0, 0.36, 0.21], tailAt: [0, 0.3, -0.23] },
};

/** Big chibi eyes (pupil + highlights), placed on a head sphere of radius r centred at the origin. */
export function eyes(p: Part, r: number, dx: number, dy: number, size: number, iris?: string) {
  for (const sx of [-1, 1]) {
    const x = sx * dx;
    const z = Math.sqrt(Math.max(0, r * r - x * x - dy * dy));
    const rot: V3 = [-Math.atan2(dy, z), Math.atan2(x, z), 0];
    if (iris) p.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 12, 10), iris, { p: [x, dy, z - 0.004], r: rot, s: [size * 1.25, size * 1.4, size * 0.5] });
    p.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 12, 10), '#1b1420', { p: [x, dy, z - 0.002], r: rot, s: [size, size * 1.15, size * 0.55] });
    p.add(sphere(size * 0.36, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#ffffff', { p: [x + size * 0.35, dy + size * 0.45, z + size * 0.35] });
    p.add(sphere(size * 0.17, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#ffffff', { p: [x - size * 0.3, dy - size * 0.45, z + size * 0.35] });
  }
}

export function blush(p: Part, r: number, dx: number, dy: number) {
  for (const sx of [-1, 1]) {
    const x = sx * dx;
    const z = Math.sqrt(Math.max(0, r * r - x * x - dy * dy));
    p.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#ff8fa3', { p: [x, dy, z - 0.003], r: [-Math.atan2(dy, z), Math.atan2(x, z), 0], s: [r * 0.16, r * 0.1, r * 0.04] });
  }
}

export function buildCritter(kind: CritterKind, coat: Coat): CritterParts {
  if (kind === 'duck' || kind === 'duckling') return buildDuck(coat);
  if (kind === 'rabbit') return buildRabbit(coat);
  if (kind === 'kid' || kind === 'lamb') return buildKid(coat, kind === 'lamb');
  if (kind === 'guineapig') return buildGuineaPig(coat);
  const d = DIMS[kind];
  const cat = kind === 'cat';
  const bodyY = d.hipY + d.bodyR * 0.55;

  // ---- body (with belly patch); the body group's origin is on the ground under the body centre
  const body = new Part();
  body.add(sphere(d.bodyR, 0, Math.PI, 0, Math.PI * 2, 20, 14), coat.fur, { p: [0, bodyY, 0], s: d.bodyS });
  body.add(sphere(d.bodyR * 0.8, 0, Math.PI, 0, Math.PI * 2, 14, 10), coat.light, { p: [0, bodyY - d.bodyR * 0.2, d.bodyR * 0.35], s: [0.75, 0.75, 1] });
  if (kind === 'cat' && coat.dark !== coat.fur) {
    // a few tabby stripes over the back
    for (const z of [-0.06, 0, 0.06]) body.add(new THREE.TorusGeometry(d.bodyR * 0.86, 0.012, 5, 18, Math.PI * 0.7), coat.dark, { p: [0, bodyY + 0.005, z], r: [0, Math.PI / 2, Math.PI * 0.15], s: [1, 0.95, 1] });
  }
  if (kind !== 'cat') {
    // collar with a little tag
    body.add(new THREE.TorusGeometry(d.headR * 0.62, 0.016, 6, 18), kind === 'shiba' ? '#c8443a' : '#3f7fd6', { p: [0, d.headAt[1] - d.headR * 0.62, d.headAt[2] - 0.03], r: [Math.PI / 2 - 0.5, 0, 0] });
    body.add(sphere(0.022), '#f2c41d', { p: [0, d.headAt[1] - d.headR * 0.95, d.headAt[2] + d.headR * 0.18] });
  }

  // ---- head (built around its own centre, then the joint sits at headAt)
  const r = d.headR;
  const head = new Part();
  head.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, 22, 16), coat.fur, { s: cat ? [1.08, 0.95, 1] : [1, 0.98, 1] });
  if (cat) {
    // ears: triangles with pink insides; little muzzle, pink nose, "w" mouth, whiskers
    for (const sx of [-1, 1]) {
      head.add(new THREE.ConeGeometry(r * 0.38, r * 0.75, 4), coat.fur, { p: [sx * r * 0.55, r * 0.8, -r * 0.05], r: [0, Math.PI / 4, -sx * 0.35] });
      head.add(new THREE.ConeGeometry(r * 0.24, r * 0.5, 4), '#ffb3c1', { p: [sx * r * 0.53, r * 0.78, r * 0.06], r: [0, Math.PI / 4, -sx * 0.35] });
      head.add(new THREE.ConeGeometry(r * 0.12, r * 0.18, 4), coat.dark, { p: [sx * r * 0.7, r * 1.12, -r * 0.05], r: [0, Math.PI / 4, -sx * 0.35] });
      for (const dy of [-0.32, -0.42]) head.add(box(r * 0.55, 0.004, 0.004), '#3a2e33', { p: [sx * r * 0.88, dy * r, r * 0.62], r: [0, -sx * 0.4, sx * (dy + 0.37) * 1.8] });
    }
    head.add(sphere(r * 0.38, 0, Math.PI, 0, Math.PI * 2, 12, 10), coat.light, { p: [0, -r * 0.35, r * 0.72], s: [1.15, 0.75, 0.6] });
    head.add(sphere(r * 0.09), '#ff8fa3', { p: [0, -r * 0.2, r * 0.97], s: [1.3, 0.8, 0.8] });
    for (const sx of [-1, 1]) head.add(new THREE.TorusGeometry(r * 0.09, r * 0.025, 5, 10, Math.PI), '#5a2a35', { p: [sx * r * 0.09, -r * 0.36, r * 0.93], r: [-0.4, 0, Math.PI] });
    eyes(head, r, r * 0.38, r * 0.05, r * 0.2, coat.iris);
    blush(head, r, r * 0.62, -r * 0.3);
  } else {
    const shiba = kind === 'shiba';
    // muzzle + nose + tongue
    head.add(sphere(r * 0.48, 0, Math.PI, 0, Math.PI * 2, 14, 10), coat.light, { p: [0, -r * 0.35, r * 0.7], s: [1.05, 0.78, 0.95] });
    head.add(sphere(r * 0.12), '#1b1420', { p: [0, -r * 0.17, r * 1.13], s: [1.3, 0.9, 0.9] });
    head.add(capsule(r * 0.09, r * 0.08), '#ff7f96', { p: [0, -r * 0.62, r * 0.98], r: [0.5, 0, 0] });
    head.add(new THREE.TorusGeometry(r * 0.12, r * 0.025, 5, 10, Math.PI), '#3a1e25', { p: [0, -r * 0.42, r * 1.06], r: [-0.3, 0, Math.PI] });
    // light cheeks / husky face mask
    for (const sx of [-1, 1]) {
      head.add(sphere(r * 0.38, 0, Math.PI, 0, Math.PI * 2, 10, 8), coat.light, { p: [sx * r * 0.48, -r * 0.18, r * 0.58], s: [1, 0.9, 0.7] });
      if (!shiba) head.add(sphere(r * 0.13), coat.light, { p: [sx * r * 0.36, r * 0.42, r * 0.84] });
      // pointy ears for both breeds (shiba: rounder and fur-coloured inside, husky: taller)
      const h = shiba ? 0.62 : 0.78;
      head.add(new THREE.ConeGeometry(r * 0.33, r * h, 4), coat.fur, { p: [sx * r * 0.55, r * 0.82, -r * 0.08], r: [0, Math.PI / 4, -sx * 0.3] });
      head.add(new THREE.ConeGeometry(r * 0.2, r * h * 0.65, 4), shiba ? coat.light : '#ffd6de', { p: [sx * r * 0.53, r * 0.79, r * 0.04], r: [0, Math.PI / 4, -sx * 0.3] });
    }
    eyes(head, r, r * 0.4, r * 0.12, r * 0.19, coat.iris);
    blush(head, r, r * 0.66, -r * 0.18);
  }

  // ---- tail (pivot at the base; points backwards and up)
  const tail = new Part();
  if (cat) {
    tail.add(capsule(0.028, 0.2), coat.fur, { p: [0, 0.1, -0.05], r: [-0.45, 0, 0] });
    tail.add(sphere(0.031), coat.dark, { p: [0, 0.205, -0.1] });
  } else if (kind === 'shiba') {
    tail.add(new THREE.TorusGeometry(0.07, 0.04, 8, 16, Math.PI * 1.5), coat.fur, { p: [0, 0.07, -0.02], r: [0, Math.PI / 2, 0] });
  } else {
    tail.add(capsule(0.055, 0.17), coat.fur, { p: [0, 0.1, -0.07], r: [-0.7, 0, 0] });
    tail.add(sphere(0.058), coat.light, { p: [0, 0.2, -0.15] });
  }

  // ---- leg (pivot at the hip, paw on the ground)
  const leg = new Part();
  const len = d.hipY;
  leg.add(capsule(d.legR, Math.max(0.01, len - d.legR * 2)), coat.fur, { p: [0, -len / 2, 0] });
  leg.add(sphere(d.legR * 1.15, 0, Math.PI, 0, Math.PI * 2, 10, 8), coat.light, { p: [0, -len + d.legR * 0.7, d.legR * 0.35], s: [1, 0.75, 1.2] });

  const L: [V3, V3, V3, V3] = [
    [d.legX, d.hipY, d.legZ],
    [-d.legX, d.hipY, d.legZ],
    [d.legX, d.hipY, -d.legZ],
    [-d.legX, d.hipY, -d.legZ],
  ];
  void cyl;
  void shade;
  return { rig: { head: d.headAt, tail: d.tailAt, legs: L, height: bodyY }, body: body.build(), head: head.build(), tail: tail.build(), leg: leg.build() };
}

/** A round duck floating on the water (origin = water line). Ducklings use the same shape, scaled down. */
function buildDuck(coat: Coat): CritterParts {
  const body = new Part();
  body.add(sphere(0.17, 0, Math.PI, 0, Math.PI * 2, 20, 14), coat.fur, { p: [0, 0.06, 0], s: [0.95, 0.75, 1.25] });
  for (const sx of [-1, 1]) body.add(sphere(0.1, 0, Math.PI, 0, Math.PI * 2, 12, 8), coat.dark, { p: [sx * 0.14, 0.1, -0.03], s: [0.35, 0.6, 1.1], r: [0.2, 0, sx * 0.2] });
  body.add(capsule(0.06, 0.08), coat.fur, { p: [0, 0.17, 0.1], r: [0.35, 0, 0] });
  const tail = new Part();
  tail.add(new THREE.ConeGeometry(0.07, 0.13, 8), coat.dark, { p: [0, 0.03, -0.04], r: [-1.05, 0, 0], s: [1.3, 1, 0.6] });
  const r = 0.115;
  const head = new Part();
  head.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, 18, 14), coat.light);
  head.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 12, 8), '#f59a2e', { p: [0, -0.025, r * 0.95], s: [0.065, 0.026, 0.075] });
  head.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 12, 8), '#e5841f', { p: [0, -0.045, r * 0.9], s: [0.055, 0.018, 0.06] });
  eyes(head, r, r * 0.42, r * 0.18, r * 0.2, coat.iris);
  blush(head, r, r * 0.66, -r * 0.12);
  head.add(sphere(0.025), coat.dark, { p: [0, r * 0.98, -0.01], s: [0.6, 1.2, 1] }); // little tuft
  return { rig: { head: [0, 0.27, 0.15], tail: [0, 0.08, -0.2], legs: [], height: 0.06 }, body: body.build(), head: head.build(), tail: tail.build(), leg: null };
}

/** A chubby rabbit with long ears, a cotton tail and big back feet. */
function buildRabbit(coat: Coat): CritterParts {
  const body = new Part();
  body.add(sphere(0.15, 0, Math.PI, 0, Math.PI * 2, 20, 14), coat.fur, { p: [0, 0.16, -0.02], s: [0.9, 0.88, 1.1] });
  body.add(sphere(0.11, 0, Math.PI, 0, Math.PI * 2, 14, 10), coat.light, { p: [0, 0.13, 0.06], s: [0.8, 0.85, 0.9] });
  const r = 0.13;
  const head = new Part();
  head.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, 20, 14), coat.fur, { s: [1.05, 0.95, 1] });
  for (const sx of [-1, 1]) {
    head.add(capsule(0.036, 0.17), coat.fur, { p: [sx * 0.05, r + 0.08, -0.02], r: [-0.15, 0, -sx * 0.18] });
    head.add(capsule(0.02, 0.14), '#ffb3c1', { p: [sx * 0.052, r + 0.08, 0.012], r: [-0.15, 0, -sx * 0.18] });
    head.add(sphere(r * 0.33, 0, Math.PI, 0, Math.PI * 2, 10, 8), coat.light, { p: [sx * r * 0.22, -r * 0.38, r * 0.8], s: [1, 0.8, 0.7] });
  }
  head.add(sphere(r * 0.1), '#ff8fa3', { p: [0, -r * 0.2, r * 0.98], s: [1.3, 0.8, 0.8] });
  head.add(box(r * 0.2, r * 0.16, 0.01), '#ffffff', { p: [0, -r * 0.55, r * 0.92] });
  eyes(head, r, r * 0.4, r * 0.08, r * 0.2, coat.iris);
  blush(head, r, r * 0.64, -r * 0.28);
  const tail = new Part();
  tail.add(sphere(0.055, 0, Math.PI, 0, Math.PI * 2, 12, 10), '#ffffff');
  const leg = new Part();
  leg.add(capsule(0.032, 0.03), coat.fur, { p: [0, -0.04, 0] });
  leg.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 10, 8), coat.light, { p: [0, -0.07, 0.02], s: [0.04, 0.025, 0.07] });
  return {
    rig: { head: [0, 0.3, 0.12], tail: [0, 0.16, -0.18], legs: [[0.055, 0.08, 0.07], [-0.055, 0.08, 0.07], [0.085, 0.08, -0.07], [-0.085, 0.08, -0.07]], height: 0.16 },
    body: body.build(),
    head: head.build(),
    tail: tail.build(),
    leg: leg.build(),
  };
}

/**
 * Petting-corner babies on long wobbly legs: a goat kid (floppy ears, horn nubs, little beard) or a lamb
 * (woolly puffs on the body and head, dark face and legs when the coat says so).
 */
function buildKid(coat: Coat, lamb: boolean): CritterParts {
  const hip = 0.2;
  const bodyY = hip + 0.1;
  const body = new Part();
  body.add(sphere(0.15, 0, Math.PI, 0, Math.PI * 2, 20, 14), coat.fur, { p: [0, bodyY, 0], s: [0.85, 0.8, 1.25] });
  if (lamb) {
    // wool: a ring of puffs over the back and sides
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      body.add(sphere(0.075, 0, Math.PI, 0, Math.PI * 2, 8, 6), coat.fur, { p: [Math.cos(a) * 0.1, bodyY + 0.05 + Math.abs(Math.sin(a)) * 0.03, Math.sin(a) * 0.14] });
    }
  } else body.add(sphere(0.12, 0, Math.PI, 0, Math.PI * 2, 14, 10), coat.light, { p: [0, bodyY - 0.04, 0.04], s: [0.75, 0.7, 1] });
  const r = 0.13;
  const face = lamb ? coat.dark : coat.fur;
  const head = new Part();
  head.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, 20, 14), face, { s: [0.95, 1, 1.05] });
  head.add(sphere(r * 0.5, 0, Math.PI, 0, Math.PI * 2, 12, 10), coat.light, { p: [0, -r * 0.4, r * 0.72], s: [1.05, 0.8, 0.9] });
  head.add(sphere(r * 0.08), '#3a2a2e', { p: [0, -r * 0.25, r * 1.12], s: [1.6, 0.8, 0.8] });
  for (const sx of [-1, 1]) {
    // floppy ears sticking out sideways
    head.add(capsule(r * 0.16, r * 0.45), face, { p: [sx * r * 0.95, r * 0.2, -r * 0.05], r: [0, 0, sx * 1.9] });
    head.add(capsule(r * 0.09, r * 0.35), '#ffc4cf', { p: [sx * r * 0.97, r * 0.17, r * 0.06], r: [0, 0, sx * 1.9] });
    if (!lamb) head.add(new THREE.ConeGeometry(r * 0.12, r * 0.3, 6), '#e8dcc0', { p: [sx * r * 0.32, r * 0.95, -r * 0.1], r: [-0.3, 0, -sx * 0.2] });
  }
  if (lamb) for (const [x, z] of [[0, 0], [-0.04, -0.03], [0.04, -0.03]] as const) head.add(sphere(r * 0.32, 0, Math.PI, 0, Math.PI * 2, 8, 6), coat.light, { p: [x, r * 0.85, z] });
  else head.add(new THREE.ConeGeometry(r * 0.12, r * 0.35, 6), coat.light, { p: [0, -r * 0.95, r * 0.6], r: [Math.PI, 0, 0] });
  eyes(head, r, r * 0.4, r * 0.1, r * 0.2, coat.iris);
  blush(head, r, r * 0.66, -r * 0.2);
  const tail = new Part();
  if (lamb) tail.add(sphere(0.05, 0, Math.PI, 0, Math.PI * 2, 8, 6), coat.fur, { p: [0, 0.01, -0.03] });
  else tail.add(new THREE.ConeGeometry(0.03, 0.09, 6), coat.fur, { p: [0, 0.04, -0.01], r: [-0.5, 0, 0] });
  const leg = new Part();
  leg.add(capsule(0.032, hip - 0.06), lamb ? coat.dark : coat.fur, { p: [0, -hip / 2, 0] });
  leg.add(cyl(0.036, 0.04, 0.035, 8), '#3a2a2e', { p: [0, -hip + 0.017, 0] });
  return {
    rig: { head: [0, bodyY + 0.14, 0.17], tail: [0, bodyY + 0.03, -0.18], legs: [[0.07, hip, 0.1], [-0.07, hip, 0.1], [0.07, hip, -0.1], [-0.07, hip, -0.1]], height: bodyY },
    body: body.build(),
    head: head.build(),
    tail: tail.build(),
    leg: leg.build(),
  };
}

/** A round guinea pig: one fluffy loaf with patches, tiny feet, no tail to speak of. */
function buildGuineaPig(coat: Coat): CritterParts {
  const body = new Part();
  body.add(sphere(0.12, 0, Math.PI, 0, Math.PI * 2, 18, 12), coat.fur, { p: [0, 0.09, 0], s: [0.9, 0.75, 1.3] });
  body.add(sphere(0.07, 0, Math.PI, 0, Math.PI * 2, 10, 8), coat.dark, { p: [0.04, 0.13, -0.05], s: [1, 0.6, 1.2] });
  body.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 10, 8), coat.light, { p: [-0.05, 0.12, 0.04], s: [1, 0.6, 1] });
  const r = 0.09;
  const head = new Part();
  head.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, 16, 12), coat.fur, { s: [1, 0.9, 1.05] });
  head.add(sphere(r * 0.45, 0, Math.PI, 0, Math.PI * 2, 10, 8), coat.light, { p: [0, -r * 0.35, r * 0.75], s: [1.1, 0.8, 0.8] });
  head.add(sphere(r * 0.1), '#ff8fa3', { p: [0, -r * 0.15, r * 1.02], s: [1.3, 0.8, 0.8] });
  for (const sx of [-1, 1]) head.add(sphere(r * 0.28, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#e8a0a8', { p: [sx * r * 0.7, r * 0.6, -r * 0.1], s: [1, 0.7, 0.35], r: [0, sx * 0.6, 0] });
  eyes(head, r, r * 0.45, r * 0.12, r * 0.22, coat.iris);
  blush(head, r, r * 0.68, -r * 0.25);
  const tail = new Part();
  tail.add(sphere(0.02), coat.fur);
  const leg = new Part();
  leg.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f0b8b8', { p: [0, -0.025, 0.01], s: [0.022, 0.015, 0.03] });
  return {
    rig: { head: [0, 0.13, 0.15], tail: [0, 0.08, -0.15], legs: [[0.06, 0.04, 0.08], [-0.06, 0.04, 0.08], [0.06, 0.04, -0.08], [-0.06, 0.04, -0.08]], height: 0.09 },
    body: body.build(),
    head: head.build(),
    tail: tail.build(),
    leg: leg.build(),
  };
}

/** Fur colours per critter (each cat has its own coat). */
export const COATS: Record<string, Coat> = {
  'cat-1': { fur: '#f6efe4', light: '#ffffff', dark: '#e0a46a', iris: undefined }, // Mochi: cream with ginger tips
  'cat-2': { fur: '#2e2b36', light: '#4a4655', dark: '#2e2b36', iris: '#f2d13a' }, // Pepper: black cat, yellow eyes
  'cat-3': { fur: '#f09a4a', light: '#fde3c4', dark: '#c9692a' }, // Ginger: orange tabby
  'dog-1': { fur: '#e58c3a', light: '#fbecd6', dark: '#b5642a' }, // Biscuit: shiba
  'dog-2': { fur: '#6f7782', light: '#f4f4f4', dark: '#4a525c', iris: '#7cc4f2' }, // Luna: husky, blue eyes
  'duck-1': { fur: '#fbfbf3', light: '#ffffff', dark: '#e6dfcc' }, // Daisy: white duck
  'duck-2': { fur: '#a8784a', light: '#2f7d4f', dark: '#6b4a32' }, // Hazel: brown body, green head
  'rabbit-1': { fur: '#b89c84', light: '#f2e6d8', dark: '#8a705c' },
  'rabbit-2': { fur: '#fafafa', light: '#ffffff', dark: '#e0e0e0', iris: '#ff8fa3' },
  'rabbit-3': { fur: '#d6b48a', light: '#fbf0de', dark: '#a8835a' },
  'rabbit-4': { fur: '#8a6248', light: '#e9d6c0', dark: '#5f412e' },
  'rabbit-5': { fur: '#fafafa', light: '#ffffff', dark: '#e0e0e0', iris: '#ff8fa3' },
  'rabbit-6': { fur: '#c98a52', light: '#fbefe0', dark: '#9a6438' },
  // petting corner
  'kid-1': { fur: '#f4f0e8', light: '#ffffff', dark: '#c9b9a0' },
  'kid-2': { fur: '#8a5a3a', light: '#f2e2cc', dark: '#5a3a26' },
  'lamb-1': { fur: '#fbf7ef', light: '#ffffff', dark: '#f2e6d6' },
  'lamb-2': { fur: '#f6f1e6', light: '#ffffff', dark: '#3a3036' },
  'guineapig-1': { fur: '#d9a066', light: '#fff5e6', dark: '#6b4a32' },
  'guineapig-2': { fur: '#fafafa', light: '#ffffff', dark: '#3b2f2f' },
  'rabbit-7': { fur: '#9a9a9a', light: '#f0f0f0', dark: '#6a6a6a' },
  'rabbit-8': { fur: '#fafafa', light: '#ffffff', dark: '#e0e0e0', iris: '#ff8fa3' },
};
/** Coat for an id (ducklings are all fluffy yellow). */
export function coatFor(id: string): Coat {
  if (id.startsWith('duckling')) return { fur: '#ffd84a', light: '#ffe27a', dark: '#f2c41d' };
  return COATS[id] ?? COATS['cat-1']!;
}
