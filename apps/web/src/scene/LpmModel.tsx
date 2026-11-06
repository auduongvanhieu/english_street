import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { chibiMaterial } from './chibi/buildChibi';

/**
 * Low-poly assets built in Blender with the blender-lpm-skill (recipes in assets-src/lpm, see docs/3d-art-direction.md).
 * Each GLB carries flat normals and one vertex colour per face, so it is drawn with the same toon material as every
 * code-built prop. Meshes named "*_glass" / "*_water" get the shared glass / water material instead.
 */
export type LpmSlug = 'bus_shelter' | 'fountain' | 'street_lamp' | 'lantern_post' | 'bird' | 'boat' | 'willow' | 'grass_tuft' | 'farm_kit' | 'zoo_kit' | 'bus_interior';
export const LPM_URL = (slug: LpmSlug) => `/models/lpm/${slug}.glb`;

export const lpmGlassMat = new THREE.MeshStandardMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.32, roughness: 0.15, metalness: 0, depthWrite: false });

export const lpmWaterMat = new THREE.MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.42, roughness: 0.1, metalness: 0, depthWrite: false });

type Kind = 'solid' | 'glass' | 'water';
const KIND_MAT = { glass: lpmGlassMat, water: lpmWaterMat } as const;
interface Piece {
  name: string;
  geometry: THREE.BufferGeometry;
  kind: Kind;
}

/** The GLB's meshes baked into model space (cached per slug, shared by every instance). */
const cache = new Map<string, Piece[]>();
function pieces(slug: LpmSlug, scene: THREE.Object3D): Piece[] {
  let out = cache.get(slug);
  if (!out) {
    out = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      out!.push({ name: m.name, geometry: m.geometry.clone().applyMatrix4(m.matrixWorld), kind: m.name.endsWith('_glass') ? 'glass' : m.name.endsWith('_water') ? 'water' : 'solid' });
    });
    cache.set(slug, out);
  }
  return out;
}

export function LpmModel({ slug, castShadow = true, ...group }: { slug: LpmSlug; castShadow?: boolean } & ThreeElements['group']) {
  const { scene } = useGLTF(LPM_URL(slug));
  const list = useMemo(() => pieces(slug, scene), [slug, scene]);
  return (
    <group {...group}>
      {list.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={p.kind === 'solid' ? chibiMaterial() : KIND_MAT[p.kind]} castShadow={castShadow && p.kind === 'solid'} receiveShadow={p.kind === 'solid'} renderOrder={p.kind === 'solid' ? 0 : 1} />
      ))}
    </group>
  );
}

/** The solid (toon, vertex-coloured) part of an LPM asset as one geometry - for InstancedMesh props. */
export function useLpmGeometry(slug: LpmSlug): THREE.BufferGeometry {
  const { scene } = useGLTF(LPM_URL(slug));
  return useMemo(() => {
    const solid = pieces(slug, scene).filter((p) => p.kind === 'solid');
    return solid.length === 1 ? solid[0]!.geometry : mergeGeometries(solid.map((p) => p.geometry), false);
  }, [slug, scene]);
}

/** Every mesh of a multi-part LPM asset by object name (e.g. 'SM_Bird_wing_dark'), for parts the game animates. */
export function useLpmParts(slug: LpmSlug): Record<string, THREE.BufferGeometry> {
  const { scene } = useGLTF(LPM_URL(slug));
  return useMemo(() => Object.fromEntries(pieces(slug, scene).map((p) => [p.name, p.geometry])), [slug, scene]);
}

export const preloadLpm = (slug: LpmSlug) => useGLTF.preload(LPM_URL(slug));
