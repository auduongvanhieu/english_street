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
  legs: [V3, V3, V3, V3]; // FL, FR, BL, BR
  /** body centre height when standing (the body group is lowered for naps) */
  height: number;
}

export interface CritterParts {
  rig: CritterRig;
  body: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
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
const DIMS: Record<CritterKind, Dims> = {
  cat: { bodyR: 0.14, bodyS: [0.85, 0.8, 1.2], headR: 0.135, legR: 0.04, legLen: 0.05, hipY: 0.115, legX: 0.065, legZ: 0.09, headAt: [0, 0.24, 0.13], tailAt: [0, 0.2, -0.15] },
  shiba: { bodyR: 0.18, bodyS: [0.85, 0.8, 1.25], headR: 0.17, legR: 0.05, legLen: 0.07, hipY: 0.15, legX: 0.085, legZ: 0.13, headAt: [0, 0.32, 0.18], tailAt: [0, 0.27, -0.2] },
  husky: { bodyR: 0.2, bodyS: [0.88, 0.82, 1.3], headR: 0.185, legR: 0.058, legLen: 0.09, hipY: 0.17, legX: 0.095, legZ: 0.15, headAt: [0, 0.36, 0.21], tailAt: [0, 0.3, -0.23] },
};

/** Big chibi eyes (pupil + highlights), placed on a head sphere of radius r centred at the origin. */
function eyes(p: Part, r: number, dx: number, dy: number, size: number, iris?: string) {
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

function blush(p: Part, r: number, dx: number, dy: number) {
  for (const sx of [-1, 1]) {
    const x = sx * dx;
    const z = Math.sqrt(Math.max(0, r * r - x * x - dy * dy));
    p.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#ff8fa3', { p: [x, dy, z - 0.003], r: [-Math.atan2(dy, z), Math.atan2(x, z), 0], s: [r * 0.16, r * 0.1, r * 0.04] });
  }
}

export function buildCritter(kind: CritterKind, coat: Coat): CritterParts {
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

/** Fur colours per critter (each cat has its own coat). */
export const COATS: Record<string, Coat> = {
  'cat-1': { fur: '#f6efe4', light: '#ffffff', dark: '#e0a46a', iris: undefined }, // Mochi: cream with ginger tips
  'cat-2': { fur: '#2e2b36', light: '#4a4655', dark: '#2e2b36', iris: '#f2d13a' }, // Pepper: black cat, yellow eyes
  'cat-3': { fur: '#f09a4a', light: '#fde3c4', dark: '#c9692a' }, // Ginger: orange tabby
  'dog-1': { fur: '#e58c3a', light: '#fbecd6', dark: '#b5642a' }, // Biscuit: shiba
  'dog-2': { fur: '#6f7782', light: '#f4f4f4', dark: '#4a525c', iris: '#7cc4f2' }, // Luna: husky, blue eyes
};
