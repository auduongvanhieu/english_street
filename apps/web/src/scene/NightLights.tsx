import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { serverNow } from '../net/client';
import { sky } from '../world/sky';
import { MODEL_URL, SHOPS, SHOP_ROW_TZ, TILE, buildTiles, type TileModel } from '../world/layout';
import { BRIDGE_X, SOUTH_END_X, STREET_END_X } from '../world/areas';
import { Part, box, chibiMaterial } from './chibi/buildChibi';
import { RIVER_FAR_Z, RIVER_NEAR_Z, TILE_Y, backdropPlacements } from './Horizon';
import { FAIRY, bulbMat, glowGeometry, glowPointsMat, poolMat, reflectMat, updateNightGlow, type Glow } from './nightGlow';

/**
 * Extra night lighting (all fades in with sky.lamps, nothing is a real light): lanterns and festoon strings along
 * both river banks with their reflections on the water, lights on the bridge railings, fairy lights in the trees
 * and wall lanterns at the shop doors. Lit windows of the area buildings live in BuildingShell.
 */

const LANTERN_H = 2.05;
/** Lantern posts stand on the sandy rims, just outside the walkable bank. */
const BANKS = [
  { z: RIVER_NEAR_Z - 0.4, half: STREET_END_X - 4, walk: -1 },
  { z: RIVER_FAR_Z + 0.4, half: SOUTH_END_X - 2, walk: 1 },
];
const LANTERN_STEP = 8;

function lanternPosts() {
  const out: [number, number, number][] = []; // x, z, side towards the water (+1 = +z)
  for (const b of BANKS)
    for (let x = -b.half; x <= b.half; x += LANTERN_STEP) {
      if (Math.abs(Math.abs(x) - BRIDGE_X) < 3) continue; // keep the bridge feet clear
      out.push([x, b.z, -b.walk]);
    }
  return out;
}

let postGeo: THREE.BufferGeometry | null = null;
function lanternPostGeometry() {
  if (postGeo) return postGeo;
  const p = new Part();
  p.add(box(0.34, 0.2, 0.34), '#4b5260', { p: [0, 0.1, 0] });
  p.add(box(0.1, LANTERN_H - 0.2, 0.1), '#2f3540', { p: [0, (LANTERN_H - 0.2) / 2, 0] });
  p.add(box(0.4, 0.07, 0.4), '#2f3540', { p: [0, LANTERN_H + 0.2, 0] });
  p.add(box(0.2, 0.08, 0.2), '#2f3540', { p: [0, LANTERN_H + 0.27, 0] });
  postGeo = p.build();
  return postGeo;
}

/** Crown vertices of a tree tile (tile-local, metres before the tile scale): where the fairy lights hang. */
function crownPoints(scene: THREE.Object3D, n: number) {
  scene.updateMatrixWorld(true);
  const rootInv = scene.matrixWorld.clone().invert();
  const pts: THREE.Vector3[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const local = rootInv.clone().multiply(m.matrixWorld);
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(local));
  });
  const top = Math.max(...pts.map((p) => p.y));
  const seen = new Set<string>();
  const crown = pts.filter((p) => {
    if (p.y < top * 0.38) return false;
    const k = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // deterministic spread: every k-th vertex
  const step = Math.max(1, Math.floor(crown.length / n));
  return crown.filter((_, i) => i % step === 0).slice(0, n);
}

/** Every tree tile near where people walk: the street, its continuation, the south-bank park. */
function treeTiles(low: boolean) {
  const out: { model: TileModel; m: THREE.Matrix4 }[] = [];
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const isTree = (m: TileModel) => m === 'grass-trees' || m === 'grass-trees-tall';
  for (const t of buildTiles())
    if (isTree(t.model)) out.push({ model: t.model, m: new THREE.Matrix4().compose(new THREE.Vector3(t.tx * TILE, TILE_Y, t.z ?? t.tz * TILE), q.setFromAxisAngle(up, t.rot ?? 0), new THREE.Vector3(TILE, TILE, TILE)) });
  for (const p of backdropPlacements(low)) {
    if (!isTree(p.model) || p.z < -14 || p.z > 80 || Math.abs(p.x) > STREET_END_X + 6) continue;
    out.push({ model: p.model, m: new THREE.Matrix4().compose(new THREE.Vector3(p.x, TILE_Y, p.z), q.setFromAxisAngle(up, p.rot), new THREE.Vector3(TILE, TILE * p.scaleY, TILE)) });
  }
  return out;
}

export function NightLights({ low }: { low: boolean }) {
  const small = useGLTF(MODEL_URL('grass-trees')).scene;
  const tall = useGLTF(MODEL_URL('grass-trees-tall')).scene;
  const posts = useMemo(lanternPosts, []);

  const glows = useMemo(() => {
    const g: Glow[] = [];
    // riverside lanterns + a festoon string sagging between neighbours
    posts.forEach(([x, z]) => g.push({ p: [x, LANTERN_H, z], c: '#ffd27a', s: 2.4, tw: 0.08 }));
    for (const b of BANKS) {
      const xs = posts.filter((p) => p[1] === b.z).map((p) => p[0]);
      for (let i = 0; i + 1 < xs.length; i++) {
        const [a, c] = [xs[i]!, xs[i + 1]!];
        if (c - a > LANTERN_STEP + 0.1) continue; // no string across a bridge foot
        for (let t = 0.08; t < 0.95; t += 0.09) {
          const y = LANTERN_H + 0.1 - 0.45 * (1 - (2 * t - 1) ** 2);
          g.push({ p: [a + (c - a) * t, y, b.z], c: FAIRY[(i * 11 + Math.round(t * 100)) % FAIRY.length]!, s: 0.6, tw: 0.35 });
        }
      }
    }
    // bridge railings: a little light on every other post
    for (const bx of [-BRIDGE_X, BRIDGE_X]) {
      const w = RIVER_FAR_Z - RIVER_NEAR_Z + 4;
      const mid = (RIVER_FAR_Z + RIVER_NEAR_Z) / 2;
      let k = 0;
      for (let i = -w / 2 + 1; i < w / 2; i += 2.2, k++)
        if (k % 2 === 0) for (const sx of [-1.45, 1.45]) g.push({ p: [bx + sx, 0.95, mid + i], c: '#ffe3a6', s: 1.1, tw: 0.1 });
    }
    // fairy lights in the trees
    const per = low ? 8 : 16;
    const crowns = { 'grass-trees': crownPoints(small, per), 'grass-trees-tall': crownPoints(tall, per) } as Record<string, THREE.Vector3[]>;
    const v = new THREE.Vector3();
    treeTiles(low).forEach(({ model, m }, ti) =>
      crowns[model]!.forEach((c, i) => g.push({ p: v.copy(c).applyMatrix4(m).toArray() as [number, number, number], c: FAIRY[(ti * 7 + i * 3) % FAIRY.length]!, s: 0.55, tw: 0.6 })),
    );
    // shop doors: a wall lantern each side
    for (const s of SHOPS) for (const dx of [-1.25, 1.25]) g.push({ p: [s.tx * TILE + dx, 2.0, SHOP_ROW_TZ * TILE + TILE / 2 + 0.25], c: '#ffd27a', s: 1.8, tw: 0.05 });
    return glowGeometry(g);
  }, [posts, small, tall, low]);

  const postRef = useRef<THREE.InstancedMesh>(null);
  const bulbRef = useRef<THREE.InstancedMesh>(null);
  const poolRef = useRef<THREE.InstancedMesh>(null);
  const reflRef = useRef<THREE.InstancedMesh>(null);
  const shopLamps = SHOPS.length * 2;
  const pools = posts.length + SHOPS.length;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const none = new THREE.Quaternion();
    posts.forEach(([x, z, water], i) => {
      postRef.current?.setMatrixAt(i, m.makeTranslation(x, 0, z));
      bulbRef.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, LANTERN_H, z), none, new THREE.Vector3(0.3, 0.36, 0.3)));
      poolRef.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.035, z - water * 1.2), flat, new THREE.Vector3(4.2, 4.2, 1)));
      // a long shimmering streak on the water, stretching from the lantern towards the far bank
      reflRef.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, -0.27, z + water * 3.2), flat, new THREE.Vector3(1.3, 5.5, 1)));
    });
    SHOPS.forEach((s, j) => {
      const fz = SHOP_ROW_TZ * TILE + TILE / 2;
      [-1.25, 1.25].forEach((dx, k) => bulbRef.current?.setMatrixAt(posts.length + j * 2 + k, m.compose(new THREE.Vector3(s.tx * TILE + dx, 2.0, fz + 0.18), none, new THREE.Vector3(0.22, 0.3, 0.2))));
      poolRef.current?.setMatrixAt(posts.length + j, m.compose(new THREE.Vector3(s.tx * TILE, 0.035, fz + 1.4), flat, new THREE.Vector3(4.6, 3.4, 1)));
    });
    for (const im of [postRef.current, bulbRef.current, poolRef.current, reflRef.current]) {
      if (!im) continue;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }, [posts]);

  useFrame(({ gl }) => {
    const h = gl.domElement.height;
    updateNightGlow(sky.lamps, (serverNow() / 1000) % 3600, h / 2);
  });

  return (
    <group>
      <instancedMesh ref={postRef} args={[lanternPostGeometry(), chibiMaterial(), posts.length]} castShadow={!low} receiveShadow frustumCulled={false} />
      <instancedMesh ref={bulbRef} args={[undefined, bulbMat, posts.length + shopLamps]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={poolRef} args={[undefined, poolMat, pools]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
      <instancedMesh ref={reflRef} args={[undefined, reflectMat, posts.length]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
      <points geometry={glows} material={glowPointsMat} frustumCulled={false} renderOrder={3} />
    </group>
  );
}
