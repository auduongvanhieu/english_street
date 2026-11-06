import * as THREE from 'three';
import type { Crop } from '@es/shared';
import { Part, cyl, sphere } from '../chibi/buildChibi';

/**
 * Low-poly crop plants for the farm garden, built into one merged Part per plot.
 * `g` is the growth 0…1 (seed → fully grown); `ready` adds the fruit/vegetable.
 */
type V = [number, number, number];

const m = new THREE.Matrix4();
const tmp = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function rng(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A flat oval leaf from `base`, pointing out at `yaw` and tilted up by `pitch`; returns its tip. */
function leaf(p: Part, color: string, base: V, yaw: number, pitch: number, len: number, wid: number, thick = 0.014, roll = 0): V {
  const g = sphere(1, 0, Math.PI, 0, Math.PI * 2, 7, 5);
  g.applyMatrix4(m.makeScale(wid / 2, thick, len / 2));
  g.applyMatrix4(m.makeTranslation(0, 0, len / 2));
  m.makeTranslation(...base).multiply(tmp.makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(-pitch)).multiply(new THREE.Matrix4().makeRotationZ(roll));
  g.applyMatrix4(m);
  p.add(g, color);
  const c = Math.cos(pitch) * len;
  return [base[0] + Math.sin(yaw) * c, base[1] + Math.sin(pitch) * len, base[2] + Math.cos(yaw) * c];
}

/** A thin stalk between two points. */
function stem(p: Part, color: string, a: V, b: V, r: number, r2 = r, seg = 5) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  if (len < 1e-3) return;
  const g = cyl(r2, r, len, seg);
  g.translate(0, len / 2, 0);
  g.applyMatrix4(m.makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())));
  g.translate(...a);
  p.add(g, color);
}

function ball(p: Part, color: string, at: V, r: number, s: V = [1, 1, 1], seg = 8) {
  p.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, seg, Math.max(4, seg - 2)), color, { p: at, s });
}

/** Little five-petal flower facing up. */
function flower(p: Part, at: V, petal: string, heart = '#f6d04d', r = 0.035) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ball(p, petal, [at[0] + Math.cos(a) * r, at[1], at[2] + Math.sin(a) * r], r * 0.75, [1, 0.45, 1], 5);
  }
  ball(p, heart, [at[0], at[1] + 0.008, at[2]], r * 0.55, [1, 0.7, 1], 5);
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ---------- the six crops (one plant at the origin of `o`) ---------- */

function carrot(p: Part, o: V, g: number, ready: boolean, r: () => number) {
  const n = 5 + Math.round(g * 4);
  const len = 0.12 + 0.38 * g;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const pitch = 1.05 - r() * 0.35;
    const tip: V = [o[0] + Math.sin(a) * Math.cos(pitch) * len, o[1] + Math.sin(pitch) * len, o[2] + Math.cos(a) * Math.cos(pitch) * len];
    stem(p, '#5c9e3c', [o[0], o[1], o[2]], tip, 0.008);
    // feathery fronds: little leaflets along the stalk
    for (let k = 1; k <= 3; k++) {
      const t = 0.35 + k * 0.2;
      const at: V = [lerp(o[0], tip[0], t), lerp(o[1], tip[1], t), lerp(o[2], tip[2], t)];
      for (const side of [-1, 1]) leaf(p, k % 2 ? '#4f9a36' : '#68b648', at, a + side * 0.9, pitch * 0.4, 0.07 + 0.05 * g, 0.045);
    }
    ball(p, '#74c04f', tip, 0.03 + 0.02 * g, [1, 0.6, 1], 6);
  }
  if (ready) {
    // orange shoulder of the root peeking out of the soil
    const c = new THREE.ConeGeometry(0.07, 0.3, 8);
    c.rotateX(Math.PI);
    p.add(c, '#f0802a', { p: [o[0], o[1] - 0.09, o[2]] });
    p.add(cyl(0.07, 0.07, 0.02, 8), '#f59a45', { p: [o[0], o[1] + 0.065, o[2]] });
  }
}

function corn(p: Part, o: V, g: number, ready: boolean, r: () => number) {
  const h = 0.25 + 1.45 * g;
  stem(p, '#6fa83e', o, [o[0], o[1] + h, o[2]], 0.035 + 0.015 * g, 0.022);
  const nLeaves = 2 + Math.round(g * 5);
  for (let i = 0; i < nLeaves; i++) {
    const y = o[1] + h * (0.12 + (0.8 * i) / Math.max(1, nLeaves));
    const a = i * 2.4 + r() * 0.4;
    const L = (0.25 + 0.35 * g) * (1 - i * 0.06);
    // arching blade: rises then droops
    const mid = leaf(p, i % 2 ? '#6db544' : '#5ea83a', [o[0], y, o[2]], a, 0.75, L * 0.55, 0.09, 0.012);
    leaf(p, i % 2 ? '#7cc24f' : '#69b146', mid, a, -0.35, L * 0.6, 0.08, 0.012);
  }
  const top: V = [o[0], o[1] + h, o[2]];
  if (g > 0.65) {
    // tassel
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      stem(p, '#d9b35a', top, [top[0] + Math.sin(a) * 0.09, top[1] + 0.16, top[2] + Math.cos(a) * 0.09], 0.008);
    }
  }
  if (ready) {
    for (const [k, a] of [[0.5, 0.6], [0.62, 3.6]] as const) {
      const base: V = [o[0], o[1] + h * k, o[2]];
      const dir: V = [Math.sin(a) * 0.12, 0.2, Math.cos(a) * 0.12];
      const c: V = [base[0] + dir[0] * 0.6, base[1] + dir[1] * 0.6, base[2] + dir[2] * 0.6];
      const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...dir).normalize());
      const e = new THREE.Euler().setFromQuaternion(q);
      p.add(sphere(0.055, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#f4cf3a', { p: c, r: [e.x, e.y, e.z], s: [1, 2.6, 1] });
      // husk leaves round the cob
      for (const side of [-1, 1]) leaf(p, '#9cc75a', base, a + side * 0.35, 1.0, 0.24, 0.07, 0.012);
      ball(p, '#a0522d', [c[0] + dir[0] * 0.75, c[1] + dir[1] * 0.75, c[2] + dir[2] * 0.75], 0.025, [1, 1, 1], 5);
    }
  }
}

function tomato(p: Part, o: V, g: number, ready: boolean, r: () => number) {
  // bamboo stake from the start
  stem(p, '#b88a52', [o[0] + 0.1, o[1], o[2]], [o[0] + 0.1, o[1] + 1.05, o[2]], 0.018);
  const h = 0.18 + 0.75 * g;
  stem(p, '#4f8a33', o, [o[0] + 0.06, o[1] + h, o[2]], 0.022, 0.014);
  const clusters = 3 + Math.round(g * 5);
  for (let i = 0; i < clusters; i++) {
    const t = (i + 0.5) / clusters;
    const a = i * 2.2 + r();
    const rad = 0.08 + 0.1 * g * (1 - t * 0.4);
    const at: V = [o[0] + 0.04 + Math.sin(a) * rad, o[1] + h * t, o[2] + Math.cos(a) * rad];
    for (let k = 0; k < 3; k++) leaf(p, (i + k) % 2 ? '#3f8a35' : '#55a142', at, a + (k - 1) * 0.7, 0.25 - k * 0.1, 0.12 + 0.06 * g, 0.08, 0.014, 0.3);
  }
  if (g > 0.5 || ready) {
    const n = ready ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const a = i * 2.5 + 1;
      const at: V = [o[0] + 0.04 + Math.sin(a) * 0.15, o[1] + h * (0.3 + 0.12 * (i % 4)), o[2] + Math.cos(a) * 0.15];
      const rr = ready ? 0.06 + r() * 0.015 : 0.035;
      ball(p, ready ? (i % 3 === 2 ? '#f07a3a' : '#e23d2e') : '#8cc256', at, rr, [1, 0.85, 1], 9);
      const star = new THREE.ConeGeometry(rr * 0.6, 0.02, 5);
      p.add(star, '#3d7a2a', { p: [at[0], at[1] + rr * 0.85, at[2]] });
    }
  }
}

function potato(p: Part, o: V, g: number, ready: boolean, r: () => number) {
  const n = 4 + Math.round(g * 5);
  const leafC = ready ? ['#8aa84a', '#9cb456'] : ['#4f9a3a', '#64ae48'];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const base: V = [o[0], o[1] + 0.02, o[2]];
    const tip = leaf(p, leafC[i % 2]!, base, a, 0.8, 0.1 + 0.2 * g, 0.03, 0.012);
    // compound leaf: pairs of round leaflets
    for (let k = 0; k < 2; k++) leaf(p, leafC[(i + k) % 2]!, tip, a + (k ? 0.8 : -0.8), 0.15, 0.09 + 0.05 * g, 0.075, 0.014);
    leaf(p, leafC[(i + 1) % 2]!, tip, a, 0.3, 0.1 + 0.05 * g, 0.08, 0.014);
  }
  if (g > 0.6 && !ready) for (let i = 0; i < 3; i++) flower(p, [o[0] + Math.sin(i * 2.1) * 0.08, o[1] + 0.22 + g * 0.18, o[2] + Math.cos(i * 2.1) * 0.08], '#efe7f7', '#f2c230', 0.028);
  if (ready) {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4;
      ball(p, i === 1 ? '#c69a62' : '#b98a55', [o[0] + Math.sin(a) * 0.2, o[1] + 0.02, o[2] + Math.cos(a) * 0.2], 0.07, [1.25, 0.8, 1], 7);
    }
  }
}

function pumpkin(p: Part, o: V, g: number, ready: boolean, r: () => number) {
  // creeping vine with big round leaves lying low
  const n = 3 + Math.round(g * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const reach = 0.15 + 0.35 * g;
    const end: V = [o[0] + Math.sin(a) * reach, o[1] + 0.03, o[2] + Math.cos(a) * reach];
    stem(p, '#5e9a36', [o[0], o[1] + 0.02, o[2]], end, 0.014);
    leaf(p, i % 2 ? '#4f9a3a' : '#62ad45', [end[0], end[1] + 0.03, end[2]], a + 0.4, 0.45, 0.16 + 0.14 * g, 0.2 + 0.14 * g, 0.016, 0.25);
    if (g > 0.45 && !ready && i % 2 === 0) {
      const f = new THREE.ConeGeometry(0.05, 0.1, 6, 1, true);
      f.rotateX(Math.PI);
      p.add(f, '#f6b733', { p: [end[0], end[1] + 0.1, end[2]] });
    }
  }
  if (ready || g > 0.7) {
    const s = ready ? 1 : 0.4;
    const c: V = [o[0], o[1] + 0.2 * s, o[2]];
    // ribbed body: a ring of squashed lobes round the middle
    const col = ready ? '#f08a24' : '#8fbf4a';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ball(p, i % 2 ? col : ready ? '#e57a1c' : '#82b442', [c[0] + Math.sin(a) * 0.13 * s, c[1], c[2] + Math.cos(a) * 0.13 * s], 0.15 * s, [0.75, 1, 0.75], 8);
    }
    ball(p, col, c, 0.2 * s, [1, 0.95, 1], 10);
    stem(p, '#6b7a2e', [c[0], c[1] + 0.17 * s, c[2]], [c[0] + 0.03, c[1] + 0.28 * s, c[2]], 0.025 * s + 0.005, 0.018 * s + 0.004);
  }
}

function strawberry(p: Part, o: V, g: number, ready: boolean, r: () => number) {
  // straw mulch under the plant
  p.add(cyl(0.2, 0.22, 0.02, 10), '#b89a55', { p: [o[0], o[1] + 0.005, o[2]] });
  const n = 3 + Math.round(g * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4;
    const tip = leaf(p, '#4b8f34', [o[0], o[1] + 0.02, o[2]], a, 0.9, 0.08 + 0.1 * g, 0.012, 0.01);
    // three serrated leaflets
    for (const d of [-0.7, 0, 0.7]) leaf(p, d ? '#3f8a30' : '#55a13c', tip, a + d, 0.1, 0.07 + 0.04 * g, 0.065, 0.014);
  }
  if (g > 0.45 && !ready) for (let i = 0; i < 2; i++) flower(p, [o[0] + Math.sin(i * 3 + 1) * 0.12, o[1] + 0.13 + 0.05 * g, o[2] + Math.cos(i * 3 + 1) * 0.12], '#ffffff');
  if (ready) {
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.5;
      const at: V = [o[0] + Math.sin(a) * 0.2, o[1] + 0.07, o[2] + Math.cos(a) * 0.2];
      const berry = new THREE.ConeGeometry(0.045, 0.09, 8);
      berry.rotateX(Math.PI);
      p.add(berry, '#e0263c', { p: at });
      ball(p, '#e0263c', [at[0], at[1] + 0.03, at[2]], 0.045, [1, 0.6, 1], 7);
      p.add(new THREE.ConeGeometry(0.045, 0.02, 5), '#3d8a2a', { p: [at[0], at[1] + 0.06, at[2]] });
    }
  }
}

const BUILD: Record<Crop, typeof carrot> = { carrot, corn, tomato, potato, pumpkin, strawberry };

/** Where the plants of one plot stand (plot-local, metres): big pumpkins get four spots, the rest nine. */
function spots(crop: Crop): [number, number][] {
  if (crop === 'pumpkin') return [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]];
  const out: [number, number][] = [];
  for (const x of [-0.7, 0, 0.7]) for (const z of [-0.7, 0, 0.7]) out.push([x, z]);
  return out;
}

/** All plants of one plot into `p`. Planted but not watered yet: little mounds with a sprout. */
export function buildPlot(p: Part, crop: Crop, stage: string, progress: number) {
  const ready = stage === 'ready';
  const g = stage === 'seed' ? 0 : ready ? 1 : 0.12 + 0.8 * progress;
  spots(crop).forEach(([x, z], i) => {
    const r = rng(i * 31 + crop.length * 7 + 1);
    const o: V = [x + (r() - 0.5) * 0.08, 0.14, z + (r() - 0.5) * 0.08];
    if (stage === 'seed') {
      ball(p, '#5a3a22', [o[0], o[1], o[2]], 0.13, [1, 0.35, 1], 7);
      for (const s of [-1, 1]) leaf(p, '#7cc25a', [o[0], o[1] + 0.03, o[2]], r() * 6 + (s > 0 ? Math.PI : 0), 0.5, 0.06, 0.04);
      return;
    }
    BUILD[crop](p, o, g, ready, r);
  });
}
