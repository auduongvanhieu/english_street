import { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { MODEL_URL, TILE, type TileModel } from '../world/layout';
import { Part, chibiMaterial, cyl } from './chibi/buildChibi';
import { useSettings } from '../store/settings';
import { nightWindows } from './nightGlow';
import { preloadLpm, useLpmGeometry } from './LpmModel';

preloadLpm('willow');

/**
 * Our own trees for the two Kenney "grass with trees" tiles (the stock cone pines looked stiff): a grass tile
 * plus low-poly broadleaf trees, a weeping willow (Blender LPM model), flowering and plain bushes, all in one
 * vertex-coloured mesh.
 * The result looks like a loaded GLB scene, so the street (City), the backdrop (Horizon) and the night fairy
 * lights (NightLights, crown vertices) use it unchanged.
 */
export const isTreeTile = (m: TileModel) => m === 'grass-trees' || m === 'grass-trees-tall' || m === 'grass-willow';

const cache = new Map<string, THREE.Object3D>();

/** The scene of a tile model: the GLB, or for tree tiles our grass + trees. */
export function useTileScene(model: TileModel): THREE.Object3D {
  const tree = isTreeTile(model);
  const base = useGLTF(MODEL_URL(tree ? 'grass' : model)).scene;
  const low = useSettings((s) => s.quality) === 'low';
  const willowModel = useLpmGeometry('willow');
  return useMemo(() => {
    if (!tree) {
      if (model.startsWith('building-')) nightWindows(base);
      return base;
    }
    const key = `${model}:${low}`;
    let g = cache.get(key);
    if (!g) {
      g = new THREE.Group();
      g.add(base.clone());
      const mesh = new THREE.Mesh(buildTrees(model, low, willowModel), chibiMaterial());
      mesh.castShadow = true;
      g.add(mesh);
      g.updateMatrixWorld(true);
      cache.set(key, g);
    }
    return g;
  }, [tree, model, base, low, willowModel]);
}

/* ------------------------------------------------------------------ builders (metres; scaled to tile units) */

type V = [number, number, number];
const GROUND = 0.24; // top of the grass tile
/** Leafy blob: smooth for big crowns, plain faceted for small ones and in low quality (fewer triangles). */
let lowDetail = false;
const blob = (r: number) => new THREE.IcosahedronGeometry(r, !lowDetail && r >= 0.45 ? 1 : 0);

function rng(seed: number) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646;
}

/** A trunk between two points, tapering. */
function trunk(p: Part, a: V, b: V, r0: number, r1: number, color = '#7a5236') {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = cyl(r1, r0, len, len < 0.5 ? 3 : 6, true);
  g.translate(0, len / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
  g.translate(...a);
  p.add(g, color);
}

/** Broadleaf tree with a cloud-like crown of overlapping blobs and a lighter top. */
function roundTree(p: Part, x: number, z: number, s: number, r: () => number, leaves = ['#3f8a3a', '#4f9c40', '#66b34b']) {
  const top: V = [x + 0.08 * s, GROUND + 1.45 * s, z];
  trunk(p, [x, GROUND, z], top, 0.2 * s, 0.12 * s);
  trunk(p, [x + 0.04 * s, GROUND + 1.0 * s, z], [x + 0.5 * s, GROUND + 1.6 * s, z + 0.2 * s], 0.08 * s, 0.05 * s);
  trunk(p, [x + 0.02 * s, GROUND + 1.1 * s, z], [x - 0.45 * s, GROUND + 1.7 * s, z - 0.2 * s], 0.08 * s, 0.05 * s);
  const cy = GROUND + 2.05 * s;
  p.add(blob(0.85 * s), leaves[1]!, { p: [x, cy, z], s: [1, 0.85, 1] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r() * 0.6;
    p.add(blob((0.55 + r() * 0.12) * s), leaves[i % 2 ? 0 : 1]!, { p: [x + Math.cos(a) * 0.62 * s, cy - 0.25 * s + r() * 0.2 * s, z + Math.sin(a) * 0.62 * s], s: [1, 0.85, 1] });
  }
  p.add(blob(0.5 * s), leaves[2]!, { p: [x - 0.1 * s, cy + 0.55 * s, z + 0.1 * s], s: [1, 0.8, 1] });
}

/** Weeping willow: Blender LPM asset assets-src/lpm/recipes/willow.py (pivot at the trunk foot, metres). */
let willowGeo: THREE.BufferGeometry | null = null;
function willow(p: Part, x: number, z: number, s: number) {
  if (willowGeo) p.addColored(willowGeo, { p: [x, GROUND, z], s });
}

/** Tall tree with an oval crown (like a linden), stacked blobs narrowing to the top. */
function tallTree(p: Part, x: number, z: number, s: number, r: () => number) {
  trunk(p, [x, GROUND, z], [x, GROUND + 1.6 * s, z], 0.2 * s, 0.11 * s);
  const leaves = ['#3d8540', '#4c9846', '#5fae50'];
  const layers: [number, number, number][] = [[1.95, 0.8, 4], [2.6, 0.68, 3], [3.2, 0.48, 2]];
  layers.forEach(([y, rr, n], k) => {
    p.add(blob(rr * s), leaves[k]!, { p: [x, GROUND + y * s, z], s: [1, 1.05, 1] });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k + r() * 0.4;
      p.add(blob(rr * 0.62 * s), leaves[(k + i) % 2]!, { p: [x + Math.cos(a) * rr * 0.75 * s, GROUND + (y - 0.12) * s, z + Math.sin(a) * rr * 0.75 * s] });
    }
  });
}

/** Low bush; with `flowers` it is dotted with blossoms. */
function bush(p: Part, x: number, z: number, s: number, r: () => number, flowers?: string[]) {
  const parts: [V, number][] = [
    [[x, GROUND + 0.32 * s, z], 0.42 * s],
    [[x + 0.38 * s, GROUND + 0.25 * s, z + 0.12 * s], 0.32 * s],
    [[x - 0.32 * s, GROUND + 0.24 * s, z - 0.1 * s], 0.3 * s],
  ];
  parts.forEach(([c, rr], i) => p.add(blob(rr), i ? '#4a9440' : '#5aa848', { p: c, s: [1, 0.8, 1] }));
  if (!flowers) return;
  for (let i = 0; i < 9; i++) {
    const [c, rr] = parts[i % 3]!;
    const u = r() * Math.PI * 2;
    const v = r() * 1.2;
    const at: V = [c[0] + Math.cos(u) * Math.cos(v) * rr * 0.92, c[1] + Math.sin(v) * rr * 0.8, c[2] + Math.sin(u) * Math.cos(v) * rr * 0.92];
    p.add(new THREE.IcosahedronGeometry(0.07 * s, 0), flowers[i % flowers.length]!, { p: at });
  }
}

/** A few wild flowers in the grass. */
function meadow(p: Part, pts: [number, number][], colors: string[]) {
  pts.forEach(([x, z], i) => {
    trunk(p, [x, GROUND, z], [x, GROUND + 0.16, z], 0.012, 0.01, '#4f8a33');
    p.add(new THREE.IcosahedronGeometry(0.05, 0), colors[i % colors.length]!, { p: [x, GROUND + 0.18, z] });
  });
}

export function buildTrees(model: TileModel, low = false, willowModel?: THREE.BufferGeometry): THREE.BufferGeometry {
  lowDetail = low;
  willowGeo = willowModel ?? null;
  const p = new Part();
  if (model === 'grass-trees') {
    const r = rng(7);
    roundTree(p, -0.55, -0.35, 1, r);
    bush(p, 1.15, 0.95, 1, r, ['#f7a8c4', '#ffffff', '#f48fb1']);
    bush(p, -1.35, 1.25, 0.75, r);
    meadow(p, [[0.6, -1.3], [0.8, -1.1], [-1.6, -1.4], [1.5, -0.3]], ['#ffd54f', '#ffffff', '#ce93d8']);
  } else if (model === 'grass-willow') {
    const r = rng(19);
    willow(p, 0.15, -0.1, 1.05);
    bush(p, -1.4, 1.25, 0.8, r, ['#fff176', '#ffffff']);
    meadow(p, [[1.4, 1.3], [1.6, 1.0], [-1.5, -1.5]], ['#ffd54f', '#90caf9', '#ffffff']);
  } else {
    const r = rng(31);
    tallTree(p, 0.3, -0.2, 1, r);
    bush(p, -1.3, 1.2, 0.85, r, ['#ffffff', '#ffb3c7']);
    meadow(p, [[1.3, 1.4], [-1.5, -1.3]], ['#ffd54f', '#ce93d8']);
  }
  const g = p.build();
  g.scale(1 / TILE, 1 / TILE, 1 / TILE);
  g.computeBoundingSphere();
  return g;
}
