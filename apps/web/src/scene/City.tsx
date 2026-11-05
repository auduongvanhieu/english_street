import { useLayoutEffect, useMemo } from 'react';
import { Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  MODEL_HEIGHT,
  MODEL_URL,
  SHOPS,
  SHOP_ROW_TZ,
  TILE,
  buildTiles,
  type ShopDef,
  type TileModel,
  type TilePlacement,
} from '../world/layout';

/** Tiles sit with their top surface at y≈0 (road thickness 0.05 tile). */
const TILE_Y = -0.05 * TILE;

const ALL_MODELS: TileModel[] = [
  'road-straight',
  'road-straight-lightposts',
  'pavement',
  'pavement-fountain',
  'grass',
  'grass-trees',
  'grass-trees-tall',
  'building-small-a',
  'building-small-b',
  'building-small-c',
  'building-small-d',
  'building-garage',
];
ALL_MODELS.forEach((m) => useGLTF.preload(MODEL_URL(m)));

export function City() {
  // Group placements by model: each distinct (model, mesh) pair becomes ONE instanced draw call.
  const byModel = useMemo(() => {
    const map = new Map<TileModel, TilePlacement[]>();
    for (const t of buildTiles()) map.set(t.model, [...(map.get(t.model) ?? []), t]);
    return [...map.entries()];
  }, []);
  return (
    <group>
      {byModel.map(([model, placements]) => (
        <InstancedTiles key={model} model={model} placements={placements} />
      ))}
      {SHOPS.map((s) => (
        <Shop key={s.id} shop={s} />
      ))}
    </group>
  );
}

/** Every mesh inside the GLB, with its transform relative to the GLB root. */
function collectMeshes(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const out: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }[] = [];
  const rootInv = scene.matrixWorld.clone().invert();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    out.push({ geometry: m.geometry, material: m.material as THREE.Material, local: rootInv.clone().multiply(m.matrixWorld) });
  });
  return out;
}

/** Flat tiles (road, pavement, grass) only receive shadows; casting from them costs a shadow-pass draw call for nothing. */
const CASTS_SHADOW = (model: TileModel) => MODEL_HEIGHT[model] > 0.1;

function InstancedTiles({ model, placements }: { model: TileModel; placements: TilePlacement[] }) {
  const { scene } = useGLTF(MODEL_URL(model));
  const castShadow = CASTS_SHADOW(model);
  const meshes = useMemo(() => collectMeshes(scene), [scene]);
  const placementMatrices = useMemo(() => {
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(TILE, TILE, TILE);
    return placements.map((t) =>
      new THREE.Matrix4()
        .makeScale(1, 1, t.sz ?? 1)
        .multiply(new THREE.Matrix4().compose(new THREE.Vector3(), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot ?? 0), s))
        .setPosition(t.tx * TILE, TILE_Y, t.z ?? t.tz * TILE),
    );
  }, [placements]);
  return (
    <>
      {meshes.map((m, i) => (
        <InstancedPart key={i} geometry={m.geometry} material={m.material} local={m.local} placements={placementMatrices} castShadow={castShadow} />
      ))}
    </>
  );
}

function InstancedPart({ geometry, material, local, placements, castShadow }: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4; placements: THREE.Matrix4[]; castShadow: boolean }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(geometry, material, placements.length);
    im.castShadow = castShadow;
    im.receiveShadow = true;
    return im;
  }, [geometry, material, placements.length, castShadow]);
  useLayoutEffect(() => {
    const tmp = new THREE.Matrix4();
    placements.forEach((p, i) => mesh.setMatrixAt(i, tmp.multiplyMatrices(p, local)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [mesh, placements, local]);
  return <primitive object={mesh} />;
}

/** Highest sign position (m): above the ground-floor door, where the street camera always sees it. */
const SIGN_MAX_Y = 3.1;

function Shop({ shop }: { shop: ShopDef }) {
  const { scene } = useGLTF(MODEL_URL(shop.model));
  // Clone with tinted materials so each shop looks distinct while sharing geometry.
  const tinted = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.color.set(shop.tint);
      m.material = mat;
    });
    return c;
  }, [scene, shop.tint]);

  const x = shop.tx * TILE;
  const z = SHOP_ROW_TZ * TILE;
  const top = MODEL_HEIGHT[shop.model] * TILE + TILE_Y;
  return (
    <group position={[x, 0, z]}>
      <primitive object={tinted} position={[0, TILE_Y, 0]} scale={TILE} />
      {/* Sign board on the front face, just above the door: tall buildings would put it out of the camera's view */}
      <group position={[0, Math.min(top + 0.5, SIGN_MAX_Y), TILE / 2 + 0.08]}>
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[Math.max(2.4, shop.label.length * 0.32), 0.8]} />
          <meshStandardMaterial color="#2b2b2b" />
        </mesh>
        <Text fontSize={0.42} color="#fff" anchorX="center" anchorY="middle">
          {shop.label}
        </Text>
      </group>
    </group>
  );
}
