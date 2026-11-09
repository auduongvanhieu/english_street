import { useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SHOPS, SHOP_ROW_TZ, TILE, buildTiles } from '../world/layout';
import { useSettings } from '../store/settings';
import { chibiMaterial } from './chibi/buildChibi';
import { LPM_URL } from './LpmModel';
import { snapshot, useNearInstances, type InstanceSet } from './nearInstances';

/**
 * Flowers and grass tufts scattered over the grass tiles, one InstancedMesh per source mesh
 * (9 draw calls total). Placement is seeded, so every client sees the same meadow.
 */
const FLOWERS = '/models/flora/flowers.glb';
/** Grass tufts: Blender LPM asset assets-src/lpm/recipes/grass_tuft.py (2 variants, toon material). */
const GRASS = LPM_URL('grass_tuft');
useGLTF.preload(FLOWERS, false, true);
useGLTF.preload(GRASS, false, true);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Spot {
  x: number;
  z: number;
  rot: number;
  scale: number;
}

/** Candidate spots on grass tiles, avoiding the shop fronts, the fountain and the NPC standing line. */
function spots(perTile: number, seed: number): Spot[] {
  const r = rng(seed);
  const shopTx = new Set(SHOPS.map((s) => s.tx));
  const out: Spot[] = [];
  for (const t of buildTiles()) {
    if (!t.model.startsWith('grass')) continue;
    if (t.tz === SHOP_ROW_TZ && shopTx.has(t.tx)) continue;
    for (let i = 0; i < perTile; i++) {
      const x = t.tx * TILE + (r() - 0.5) * (TILE - 0.6);
      const z = t.tz * TILE + (r() - 0.5) * (TILE - 0.6);
      if (t.tz === SHOP_ROW_TZ && z > SHOP_ROW_TZ * TILE + 1.2) continue; // keep the path to the shops clear
      if (Math.hypot(x, z - 2 * TILE) < 2.2) continue; // fountain
      out.push({ x, z, rot: r() * Math.PI * 2, scale: 0.8 + r() * 0.5 });
    }
  }
  return out;
}

export function Flora() {
  const quality = useSettings((s) => s.quality);
  const low = quality === 'low';
  const flowerSpots = useMemo(() => spots(low ? 2 : 5, 7), [low]);
  const grassSpots = useMemo(() => spots(low ? 3 : 8, 11), [low]);
  return (
    <group>
      <Scatter url={FLOWERS} spots={flowerSpots} unit={0.55} />
      <Scatter url={GRASS} spots={grassSpots} unit={0.42} material={chibiMaterial()} />
    </group>
  );
}

/** Distribute `spots` round-robin across the meshes inside the GLB; each mesh becomes one InstancedMesh. */
function Scatter({ url, spots, unit, material }: { url: string; spots: Spot[]; unit: number; material?: THREE.Material }) {
  const { scene } = useGLTF(url, false, true);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const list: { geometry: THREE.BufferGeometry; material: THREE.Material; size: number }[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!;
      list.push({ geometry: m.geometry, material: material ?? (m.material as THREE.Material), size: Math.max(b.max.y - b.min.y, 0.01) });
    });
    return list;
  }, [scene, material]);
  return (
    <>
      {parts.map((p, i) => (
        <Instanced key={i} part={p} spots={spots.filter((_, j) => j % parts.length === i)} unit={unit} />
      ))}
    </>
  );
}

function Instanced({ part, spots, unit }: { part: { geometry: THREE.BufferGeometry; material: THREE.Material; size: number }; spots: Spot[]; unit: number }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(part.geometry, part.material, Math.max(1, spots.length));
    im.castShadow = false; // tiny clumps: shadows cost a full extra pass for nothing visible
    im.receiveShadow = true;
    im.frustumCulled = false; // only the clumps near the camera are drawn (useNearInstances)
    return im;
  }, [part, spots.length]);
  const set = useRef<InstanceSet | null>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const base = unit / part.size;
    spots.forEach((s, i) => {
      const k = base * s.scale;
      mesh.setMatrixAt(i, m.compose(v.set(s.x, 0, s.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot), sc.set(k, k, k)));
    });
    mesh.count = spots.length;
    mesh.instanceMatrix.needsUpdate = true;
    // a few pixels each beyond ~70 m (and in the fog): draw the ones near the camera only
    set.current = { xs: Float32Array.from(spots, (s) => s.x), zs: Float32Array.from(spots, (s) => s.z), radius: [70, 45], parts: [{ mesh, all: snapshot(mesh) }] };
  }, [mesh, spots, unit, part.size]);
  useNearInstances(() => set.current);
  return <primitive object={mesh} />;
}
