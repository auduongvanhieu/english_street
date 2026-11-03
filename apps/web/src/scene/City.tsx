import { useMemo } from 'react';
import { Clone, Text, useGLTF } from '@react-three/drei';
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
  const tiles = useMemo(buildTiles, []);
  return (
    <group>
      {tiles.map((t, i) => (
        <Tile key={i} t={t} />
      ))}
      {SHOPS.map((s) => (
        <Shop key={s.id} shop={s} />
      ))}
    </group>
  );
}

function Tile({ t }: { t: TilePlacement }) {
  const { scene } = useGLTF(MODEL_URL(t.model));
  return (
    <Clone
      object={scene}
      position={[t.tx * TILE, TILE_Y, t.tz * TILE]}
      rotation={[0, t.rot ?? 0, 0]}
      scale={TILE}
      castShadow
      receiveShadow
    />
  );
}

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
      {/* Sign board on the front face */}
      <group position={[0, top + 0.5, TILE / 2 + 0.05]}>
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
