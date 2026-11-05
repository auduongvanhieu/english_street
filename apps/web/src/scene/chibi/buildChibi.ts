import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { AvatarLook } from '@es/shared';

/**
 * Original chibi characters built from primitives: a big round head, a round body and short limbs, toon shaded.
 * Every body part is merged into ONE geometry with vertex colours (head + hair + hat + face are one mesh), so a
 * character costs 6 draw calls (+6 for the outline on high quality) no matter how many accessories it wears.
 *
 * Units are metres before CHIBI_SCALE. Character faces +Z, its right hand is at -X.
 */
export const CHIBI_SCALE = 1.3;
/** Height of the top of the head (without hats), after scaling — name tags go above this. */
export const CHIBI_HEIGHT = 1.17 * CHIBI_SCALE;

export type ChibiExtra = 'apron' | 'stethoscope' | 'bowtie' | 'badge';
export type ChibiHat = AvatarLook['hat'] | 'paperhat' | 'helmet';
export interface ChibiSpec extends Omit<AvatarLook, 'hat'> {
  hat: ChibiHat;
  /** NPC uniforms. */
  extras?: ChibiExtra[];
  apronColor?: string;
}

export interface ChibiParts {
  head: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  armL: THREE.BufferGeometry;
  armR: THREE.BufferGeometry;
  legL: THREE.BufferGeometry;
  legR: THREE.BufferGeometry;
}

/** Joint positions (parent-relative). Shared by the builder and the animated rig. */
export const JOINTS = {
  hips: [0, 0.2, 0],
  legL: [0.085, 0, 0],
  legR: [-0.085, 0, 0],
  armL: [0.19, 0.33, 0],
  armR: [-0.19, 0.33, 0],
  head: [0, 0.4, 0],
} as const;
/** Head centre in head-joint space. */
const HC = new THREE.Vector3(0, 0.27, 0);
const HEAD_R = 0.3;

export type V3 = [number, number, number];
interface Xf {
  p?: V3;
  r?: V3;
  s?: V3 | number;
}

export class Part {
  private list: THREE.BufferGeometry[] = [];
  /** Night glow sprites to draw with this part (fairy lights in trees…): rendered by Merged through nightGlow.ts. */
  lights: { p: [number, number, number]; c: string; s: number; tw?: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private c = new THREE.Color();
  add(g: THREE.BufferGeometry, color: string, x: Xf = {}) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    geo.deleteAttribute('uv');
    const s = x.s === undefined ? [1, 1, 1] : typeof x.s === 'number' ? [x.s, x.s, x.s] : x.s;
    this.e.set(...(x.r ?? [0, 0, 0]));
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(...(x.p ?? [0, 0, 0])), this.q, new THREE.Vector3(s[0], s[1], s[2]));
    geo.applyMatrix4(this.m);
    this.c.set(color);
    const n = geo.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = this.c.r;
      col[i * 3 + 1] = this.c.g;
      col[i * 3 + 2] = this.c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(geo);
    return this;
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.list, false)!;
    for (const x of this.list) x.dispose();
    g.computeBoundingSphere();
    return g;
  }
}

export const sphere = (r: number, thetaStart = 0, thetaLen = Math.PI, phiStart = 0, phiLen = Math.PI * 2, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h, phiStart, phiLen, thetaStart, thetaLen);
export const cyl = (rt: number, rb: number, h: number, seg = 16, open = false, ts = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl);
export const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 12);
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

export function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  if (f < 1) c.multiplyScalar(f);
  else c.lerp(new THREE.Color('#ffffff'), f - 1);
  return `#${c.getHexString()}`;
}
/** Point on the head sphere (head-joint space) at horizontal offset dx and vertical offset dy from the centre, front side. */
function onFace(dx: number, dy: number, lift = 0, r = HEAD_R): V3 {
  const z = Math.sqrt(Math.max(0, r * r - dx * dx - dy * dy));
  return [HC.x + dx, HC.y + dy, z + lift];
}
/** Rotation that turns a flat +Z-facing decal to follow the head surface at (dx, dy). */
function faceRot(dx: number, dy: number): V3 {
  const z = Math.sqrt(Math.max(0.0001, HEAD_R * HEAD_R - dx * dx - dy * dy));
  return [-Math.atan2(dy, z), Math.atan2(dx, z), 0];
}
/** Put a cone/cylinder on the head sphere at polar angle theta (from the top) and azimuth phi, pointing outward. */
function onScalp(theta: number, phi: number, r: number, lift: number): { p: V3; r: V3 } {
  const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const e = new THREE.Euler().setFromQuaternion(q);
  const p = dir.clone().multiplyScalar(r + lift).add(HC);
  return { p: [p.x, p.y, p.z], r: [e.x, e.y, e.z] };
}

// ------------------------------------------------------------------------------------------------ head
function buildHead(s: ChibiSpec): THREE.BufferGeometry {
  const h = new Part();
  const robot = s.body === 'robot';
  if (robot) {
    const metal = s.top;
    h.add(new RoundedBoxGeometry(0.56, 0.5, 0.5, 4, 0.14), metal, { p: [HC.x, HC.y, HC.z] });
    h.add(new RoundedBoxGeometry(0.42, 0.27, 0.06, 3, 0.05), '#1d2633', { p: [0, HC.y - 0.01, 0.23] });
    for (const x of [-0.09, 0.09]) h.add(sphere(0.045), '#5ff3ff', { p: [x, HC.y + 0.02, 0.265], s: [1, 1.25, 0.4] });
    h.add(box(0.1, 0.018, 0.01), '#5ff3ff', { p: [0, HC.y - 0.075, 0.262] });
    for (const x of [-0.29, 0.29]) h.add(cyl(0.07, 0.07, 0.06, 14), s.bottom, { p: [x, HC.y, 0], r: [0, 0, Math.PI / 2] });
    h.add(cyl(0.012, 0.012, 0.14, 6), '#9aa3ad', { p: [0, HC.y + 0.31, 0] });
    h.add(sphere(0.045), s.hatColor, { p: [0, HC.y + 0.4, 0] });
    for (const x of [-0.17, 0.17]) h.add(sphere(0.035), '#ff8fa3', { p: [x, HC.y - 0.07, 0.255], s: [1, 0.6, 0.3] });
  } else {
    h.add(sphere(HEAD_R, 0, Math.PI, 0, Math.PI * 2, 24, 18), s.skin, { p: [HC.x, HC.y, HC.z] });
    for (const x of [-0.29, 0.29]) h.add(sphere(0.065), s.skin, { p: [x, HC.y - 0.01, 0], s: [0.6, 1, 0.9] });
    // eyes with a highlight, rosy cheeks, smile
    for (const dx of [-0.1, 0.1]) {
      h.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 12, 10), '#1b1420', { p: onFace(dx, -0.01, -0.006), r: faceRot(dx, -0.01), s: [0.045, 0.062, 0.025] });
      h.add(sphere(0.016, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#ffffff', { p: onFace(dx + 0.016, 0.02, 0.012) });
      h.add(sphere(0.008, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#ffffff', { p: onFace(dx - 0.014, -0.03, 0.012) });
    }
    for (const dx of [-0.175, 0.175]) h.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#ff8fa3', { p: onFace(dx, -0.08, -0.004), r: faceRot(dx, -0.08), s: [0.05, 0.03, 0.012] });
    h.add(new THREE.TorusGeometry(0.032, 0.009, 6, 12, Math.PI), '#7a2a35', { p: onFace(0, -0.085, -0.004), r: [faceRot(0, -0.085)[0], 0, Math.PI] });
    addHair(h, s);
  }
  addHat(h, s);
  if (s.glasses !== 'none') addGlasses(h, s.glasses === 'sun', robot);
  return h.build();
}

function addHair(h: Part, s: ChibiSpec) {
  const c = s.hair;
  const dark = shade(c, 0.8);
  let style = s.hairStyle;
  // Spikes and buns would poke through hats: keep the short cut under a hat.
  if (s.hat !== 'none' && (style === 'spiky' || style === 'buns')) style = 'short';
  const at: V3 = [HC.x, HC.y + 0.008, HC.z - 0.008];
  const backHalf = (r: number, thetaEnd: number) => h.add(sphere(r, 0, thetaEnd, Math.PI, Math.PI), c, { p: at });
  const cap = (r: number, thetaEnd: number) => h.add(sphere(r, 0, thetaEnd), c, { p: at });
  // Fringe: three soft bumps over the forehead.
  const fringe = (r: number) => {
    for (const [phi, th] of [[-0.45, 1.05], [0, 1.0], [0.45, 1.05]] as const) {
      const o = onScalp(th, phi, r - 0.045, 0);
      h.add(sphere(0.08, 0, Math.PI, 0, Math.PI * 2, 10, 8), c, { p: o.p, s: [1, 0.7, 0.6] });
    }
  };
  switch (style) {
    case 'bald':
      return;
    case 'short':
      cap(0.318, 1.2);
      backHalf(0.316, 2.1);
      fringe(0.318);
      return;
    case 'spiky':
      cap(0.316, 1.15);
      backHalf(0.314, 2.0);
      for (let i = 0; i < 9; i++) {
        const o = onScalp(i === 0 ? 0 : 0.75, (i / 8) * Math.PI * 2 + 0.3, 0.3, 0.02);
        h.add(new THREE.ConeGeometry(0.075, 0.17, 6), i % 2 ? c : dark, o);
      }
      return;
    case 'curly':
      for (let ring = 0; ring < 4; ring++) {
        const th = ring * 0.42;
        const n = ring === 0 ? 1 : 6 + ring * 3;
        for (let i = 0; i < n; i++) {
          const phi = (i / n) * Math.PI * 2 + ring * 0.4;
          if (ring === 3 && Math.cos(phi) > 0.2) continue; // keep the face free
          const o = onScalp(th, phi, 0.3, -0.01);
          h.add(sphere(0.085, 0, Math.PI, 0, Math.PI * 2, 10, 8), i % 3 ? c : dark, { p: o.p });
        }
      }
      return;
    case 'bob':
      h.add(sphere(0.335, 0, 2.25, Math.PI / 2 + 0.72, Math.PI * 2 - 1.44), c, { p: at });
      cap(0.33, 1.15);
      fringe(0.33);
      return;
    case 'long':
      h.add(sphere(0.34, 0, 2.45, Math.PI / 2 + 0.72, Math.PI * 2 - 1.44), c, { p: at });
      cap(0.335, 1.15);
      fringe(0.335);
      h.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 14, 10), c, { p: [0, HC.y - 0.3, -0.17], s: [0.27, 0.22, 0.12] });
      return;
    case 'ponytail':
      cap(0.318, 1.2);
      backHalf(0.316, 2.0);
      fringe(0.318);
      h.add(sphere(0.05), dark, { p: [0, HC.y + 0.05, -0.33] });
      h.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 12, 10), c, { p: [0, HC.y - 0.07, -0.39], r: [-0.35, 0, 0], s: [0.085, 0.18, 0.085] });
      return;
    case 'buns':
      cap(0.318, 1.2);
      backHalf(0.316, 2.0);
      fringe(0.318);
      for (const x of [-0.21, 0.21]) h.add(sphere(0.11), c, { p: [x, HC.y + 0.22, -0.04] });
      return;
  }
}

function addHat(h: Part, s: ChibiSpec) {
  const c = s.hatColor;
  const big = s.body === 'robot' ? 1.12 : s.hairStyle === 'bob' || s.hairStyle === 'long' || s.hairStyle === 'curly' ? 1.07 : 1;
  const y = HC.y;
  switch (s.hat) {
    case 'none':
      return;
    case 'cap':
      h.add(sphere(0.338 * big, 0, 1.22), c, { p: [0, y + 0.012, -0.005] });
      h.add(cyl(0.2 * big, 0.2 * big, 0.022, 18, false, -Math.PI / 2, Math.PI), shade(c, 0.85), { p: [0, y + 0.13, 0.2 * big], r: [0.22, 0, 0], s: [1, 1, 1.35] });
      h.add(sphere(0.03), shade(c, 0.85), { p: [0, y + 0.35 * big, 0] });
      return;
    case 'beanie':
      h.add(sphere(0.345 * big, 0, 1.2), c, { p: [0, y + 0.02, 0] });
      h.add(cyl(0.32 * big, 0.32 * big, 0.08, 22, true), shade(c, 0.82), { p: [0, y + 0.13, 0] });
      h.add(sphere(0.07), '#f4f4f4', { p: [0, y + 0.38 * big, 0] });
      return;
    case 'sunhat':
      h.add(cyl(0.25 * big, 0.29 * big, 0.16, 20), c, { p: [0, y + 0.3, 0] });
      h.add(cyl(0.29 * big + 0.002, 0.29 * big + 0.002, 0.05, 20, true), shade(c, 0.75), { p: [0, y + 0.25, 0] });
      h.add(cyl(0.55 * big, 0.55 * big, 0.025, 28), c, { p: [0, y + 0.22, 0], r: [0.08, 0, 0] });
      return;
    case 'tophat':
      h.add(cyl(0.19, 0.19, 0.3, 18), c, { p: [0, y + 0.45 * big, 0] });
      h.add(cyl(0.193, 0.193, 0.05, 18, true), '#1a1a1a', { p: [0, y + 0.33 * big, 0] });
      h.add(cyl(0.32, 0.32, 0.022, 22), c, { p: [0, y + 0.31 * big, 0] });
      return;
    case 'crown': {
      const gold = '#f2c41d';
      const top = y + 0.3 * big;
      h.add(cyl(0.21, 0.2, 0.09, 16, true), gold, { p: [0, top, 0] });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        h.add(new THREE.ConeGeometry(0.04, 0.09, 4), gold, { p: [Math.sin(a) * 0.205, top + 0.085, Math.cos(a) * 0.205] });
        h.add(sphere(0.018), i % 2 ? '#e53e5a' : '#3f7fd6', { p: [Math.sin(a) * 0.212, top, Math.cos(a) * 0.212] });
      }
      return;
    }
    case 'helmet': {
      // bike helmet: rounded shell with a light stripe and a little visor
      h.add(sphere(0.35 * big, 0, 1.3, 0, Math.PI * 2, 20, 10), c, { p: [0, y + 0.02, -0.01], s: [1, 0.95, 1.08] });
      h.add(new THREE.TorusGeometry(0.2, 0.025, 6, 20, Math.PI), '#ffffff', { p: [0, y + 0.13, -0.01], r: [0, Math.PI / 2, 0], s: [1, 1.15, 1.05] });
      h.add(cyl(0.16, 0.16, 0.02, 14, false, -Math.PI / 2, Math.PI), shade(c, 0.8), { p: [0, y + 0.12, 0.22], r: [0.3, 0, 0], s: [1, 1, 0.9] });
      return;
    }
    case 'paperhat':
      h.add(cyl(0.24, 0.26, 0.24, 18), '#fafafa', { p: [0, y + 0.36, 0] });
      h.add(sphere(0.26), '#fafafa', { p: [0, y + 0.48, 0], s: [1, 0.45, 1] });
      return;
  }
}

function addGlasses(h: Part, sun: boolean, robot: boolean) {
  const frame = sun ? '#111111' : '#2b2b2b';
  const z = robot ? 0.29 : 0.305;
  const y = HC.y - 0.01;
  for (const x of [-0.1, 0.1]) {
    h.add(new THREE.TorusGeometry(0.062, 0.011, 6, 18), frame, { p: [x, y, z] });
    if (sun) h.add(cyl(0.058, 0.058, 0.008, 18), '#1d2430', { p: [x, y, z - 0.002], r: [Math.PI / 2, 0, 0] });
  }
  h.add(box(0.07, 0.014, 0.014), frame, { p: [0, y + 0.01, z] });
}

// ------------------------------------------------------------------------------------------------ body
function buildTorso(s: ChibiSpec): THREE.BufferGeometry {
  const t = new Part();
  const T = s.top;
  const B = s.bottom;
  const at: V3 = [0, 0.2, 0];
  const body = (from: number, to: number, color: string) => t.add(sphere(0.21, from, to - from, 0, Math.PI * 2, 22, 16), color, { p: at, s: [1, 1.05, 0.88] });
  switch (s.body) {
    case 'tee':
      body(0, 1.9, T);
      body(1.9, Math.PI, B);
      t.add(new THREE.TorusGeometry(0.075, 0.018, 6, 16), shade(T, 0.85), { p: [0, 0.415, 0.02], r: [Math.PI / 2 + 0.2, 0, 0] });
      break;
    case 'hoodie':
      body(0, 2.25, T);
      body(2.25, Math.PI, B);
      t.add(new THREE.TorusGeometry(0.13, 0.055, 8, 18), shade(T, 0.85), { p: [0, 0.41, -0.05], r: [Math.PI / 2 - 0.35, 0, 0] });
      t.add(new RoundedBoxGeometry(0.2, 0.08, 0.03, 2, 0.012), shade(T, 0.88), { p: [0, 0.13, 0.17], r: [0.35, 0, 0] });
      for (const x of [-0.035, 0.035]) t.add(cyl(0.007, 0.007, 0.09, 5), '#f4f4f4', { p: [x, 0.33, 0.185], r: [0.25, 0, 0] });
      break;
    case 'suit':
      body(0, 2.3, T);
      body(2.3, Math.PI, shade(T, 0.85));
      t.add(box(0.12, 0.12, 0.02), '#f7f7f7', { p: [0, 0.37, 0.155], r: [0.45, 0, Math.PI / 4] });
      t.add(box(0.045, 0.14, 0.016), B, { p: [0, 0.27, 0.19], r: [0.25, 0, 0] });
      t.add(box(0.05, 0.035, 0.02), shade(B, 0.85), { p: [0, 0.345, 0.172], r: [0.4, 0, 0] });
      for (const y of [0.2, 0.14]) t.add(sphere(0.012), '#2a2a2a', { p: [0.04, y, 0.185] });
      break;
    case 'girl': // overalls over a shirt
      body(0, 1.75, T);
      body(1.75, Math.PI, B);
      t.add(new RoundedBoxGeometry(0.18, 0.13, 0.03, 2, 0.01), B, { p: [0, 0.26, 0.165], r: [-0.28, 0, 0] });
      for (const x of [-0.07, 0.07]) {
        t.add(box(0.035, 0.18, 0.02), B, { p: [x, 0.36, 0.06], r: [-1.0, 0, 0] });
        t.add(sphere(0.016), '#f2c41d', { p: [x, 0.31, 0.18] });
      }
      t.add(new RoundedBoxGeometry(0.08, 0.06, 0.02, 2, 0.008), shade(B, 0.85), { p: [0, 0.25, 0.185], r: [-0.28, 0, 0] });
      break;
    case 'dress':
      body(0, Math.PI, T);
      t.add(cyl(0.18, 0.3, 0.22, 22), T, { p: [0, 0.04, 0] });
      t.add(cyl(0.302, 0.302, 0.025, 22, true), shade(T, 1.25), { p: [0, -0.06, 0] });
      t.add(cyl(0.205, 0.205, 0.035, 22, true), B, { p: [0, 0.17, 0], s: [1, 1, 0.88] });
      t.add(sphere(0.03), B, { p: [0, 0.175, 0.185] });
      break;
    case 'robot':
      body(0, Math.PI, T);
      t.add(cyl(0.09, 0.09, 0.03, 18), B, { p: [0, 0.26, 0.17], r: [Math.PI / 2 - 0.15, 0, 0] });
      t.add(sphere(0.035), '#5ff3ff', { p: [0, 0.265, 0.19] });
      for (const x of [-0.05, 0.05]) t.add(sphere(0.014), '#ffcf3f', { p: [x, 0.17, 0.19] });
      break;
  }
  for (const e of s.extras ?? []) {
    if (e === 'apron') {
      t.add(new RoundedBoxGeometry(0.3, 0.3, 0.02, 2, 0.01), s.apronColor ?? '#6b4a32', { p: [0, 0.1, 0.19], r: [0.1, 0, 0] });
      t.add(box(0.03, 0.14, 0.01), s.apronColor ?? '#6b4a32', { p: [0, 0.33, 0.185], r: [-0.3, 0, 0] });
    } else if (e === 'stethoscope') {
      t.add(new THREE.TorusGeometry(0.13, 0.012, 6, 24, Math.PI * 1.4), '#2b2b2b', { p: [0, 0.37, 0.03], r: [Math.PI / 2 + 0.35, 0, Math.PI * 0.8] });
      t.add(cyl(0.035, 0.035, 0.015, 14), '#c8c8c8', { p: [0.06, 0.22, 0.19], r: [Math.PI / 2, 0, 0] });
    } else if (e === 'bowtie') {
      for (const x of [-0.035, 0.035]) t.add(new THREE.ConeGeometry(0.03, 0.06, 4), '#b3122e', { p: [x, 0.39, 0.15], r: [0, 0, x < 0 ? -Math.PI / 2 : Math.PI / 2] });
      t.add(sphere(0.016), '#8a0e24', { p: [0, 0.39, 0.155] });
    } else if (e === 'badge') {
      t.add(box(0.07, 0.04, 0.01), '#ffffff', { p: [-0.09, 0.29, 0.18], r: [0.2, 0, 0] });
    }
  }
  if (s.bag === 'backpack' && s.body !== 'robot') {
    const bag = '#c8443a';
    t.add(new RoundedBoxGeometry(0.28, 0.3, 0.13, 3, 0.05), bag, { p: [0, 0.22, -0.22] });
    t.add(new RoundedBoxGeometry(0.2, 0.12, 0.05, 2, 0.02), shade(bag, 0.8), { p: [0, 0.15, -0.3] });
    for (const x of [-0.09, 0.09]) t.add(box(0.035, 0.2, 0.02), '#3a3a3a', { p: [x, 0.33, 0.14], r: [-0.5, 0, 0] });
  }
  return t.build();
}

function buildArm(s: ChibiSpec, side: 1 | -1): THREE.BufferGeometry {
  const a = new Part();
  const robot = s.body === 'robot';
  const sleeve = s.body === 'tee' || s.body === 'girl' ? s.skin : s.top;
  if (robot) {
    a.add(capsule(0.05, 0.1), shade(s.top, 0.9), { p: [0, -0.09, 0] });
    a.add(sphere(0.065), s.bottom, { p: [0, -0.19, 0] });
    return a.build();
  }
  if (s.body === 'tee' || s.body === 'girl') a.add(sphere(0.07, 0, Math.PI / 2 + 0.3), s.top, { p: [0, -0.02, 0] });
  a.add(capsule(0.055, 0.1), sleeve, { p: [0, -0.09, 0] });
  a.add(sphere(0.064), s.skin, { p: [0, -0.19, 0] });
  if (s.body === 'suit') a.add(cyl(0.058, 0.058, 0.025, 12, true), '#f7f7f7', { p: [0, -0.15, 0] });
  void side;
  return a.build();
}

function buildLeg(s: ChibiSpec): THREE.BufferGeometry {
  const l = new Part();
  const robot = s.body === 'robot';
  const leg = robot ? s.bottom : s.body === 'dress' ? s.skin : s.body === 'suit' ? shade(s.top, 0.85) : s.body === 'tee' ? s.skin : s.bottom;
  if (s.body === 'tee') l.add(cyl(0.075, 0.08, 0.06, 12), s.bottom, { p: [0, -0.03, 0] });
  l.add(capsule(0.065, 0.06), leg, { p: [0, -0.075, 0] });
  const shoe = robot ? shade(s.top, 0.8) : s.shoes;
  l.add(sphere(1, 0, Math.PI, 0, Math.PI * 2, 14, 10), shoe, { p: [0, -0.15, 0.025], s: [0.075, 0.05, 0.105] });
  if (!robot) l.add(cyl(0.077, 0.077, 0.012, 14), shade(shoe, 1.5), { p: [0, -0.175, 0.025], s: [1, 1, 1.38] });
  return l.build();
}

const cache = new Map<string, ChibiParts>();
/** Geometry for a look, cached by its JSON (players with the same outfit share buffers). */
export function chibiParts(s: ChibiSpec): ChibiParts {
  const key = JSON.stringify(s);
  let p = cache.get(key);
  if (!p) {
    p = { head: buildHead(s), torso: buildTorso(s), armL: buildArm(s, 1), armR: buildArm(s, -1), legL: buildLeg(s), legR: buildLeg(s) };
    cache.set(key, p);
  }
  return p;
}

// ------------------------------------------------------------------------------------------------ materials
let toon: THREE.MeshToonMaterial | null = null;
let outline: THREE.MeshBasicMaterial | null = null;
/** One toon material for every chibi (colours come from vertex colours). */
export function chibiMaterial(): THREE.MeshToonMaterial {
  if (!toon) {
    const steps = new Uint8Array([110, 190, 255]);
    const grad = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
  }
  return toon;
}
/** Inverted-hull outline: back faces pushed out along the normal, drawn dark. */
export function chibiOutline(): THREE.MeshBasicMaterial {
  if (!outline) {
    outline = new THREE.MeshBasicMaterial({ color: '#2a2230', side: THREE.BackSide });
    outline.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.011;');
    };
  }
  return outline;
}
