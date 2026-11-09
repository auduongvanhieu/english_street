import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useArea } from '../store/area';

/**
 * Street-wide instanced meshes (backdrop houses and trees, street lamps) used to draw every instance all the
 * time: their bounding sphere is as big as the street, so the camera frustum never drops them, and ~1M triangles
 * went to the GPU even inside the restaurant. This keeps only the instances that can be seen: within the camera's
 * far plane (smaller inside an area, where the yard fence hides the rest) and not behind the camera. The list is
 * rebuilt only when the camera has moved or turned a little, so most frames cost nothing.
 */
export const FAR = 160; // the scene camera's far plane (Scene.tsx)
const RADIUS_OUT = FAR + 12; // + half a house: nothing that could reach into the view disappears
const RADIUS_IN = 80; // inside an area (yard / building)
const CONE_COS = Math.cos((75 * Math.PI) / 180); // the widest landscape view is ~40° each side
const NEAR_ALWAYS = 30; // close by: always (shadows, things just beside the camera)

export interface InstanceSet {
  /** world x / z of each instance */
  xs: Float32Array;
  zs: Float32Array;
  /** extra reach of an instance (half its size) */
  reach?: number;
  /** small things (flowers, grass tufts) can stop sooner: [outside an area, inside] */
  radius?: [number, number];
  /** meshes drawing these instances, each with the full list of matrices (16 floats per instance) */
  parts: { mesh: THREE.InstancedMesh; all: Float32Array; colors?: Float32Array }[];
}

const fwd = new THREE.Vector3();

export function useNearInstances(get: () => InstanceSet | null) {
  const last = useRef({ x: Infinity, z: Infinity, fx: 0, fz: 0, r: 0, set: null as InstanceSet | null });
  useFrame(({ camera }) => {
    const set = get();
    if (!set) return;
    camera.getWorldDirection(fwd);
    const fl = Math.hypot(fwd.x, fwd.z) || 1;
    const fx = fwd.x / fl;
    const fz = fwd.z / fl;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const inside = !!useArea.getState().current;
    const r = set.radius ? set.radius[inside ? 1 : 0] : inside ? RADIUS_IN : RADIUS_OUT;
    const l = last.current;
    if (l.set === set && l.r === r && Math.hypot(cx - l.x, cz - l.z) < 3 && fx * l.fx + fz * l.fz > 0.995) return;
    Object.assign(l, { x: cx, z: cz, fx, fz, r, set });
    const reach = set.reach ?? 0;
    const keep: number[] = [];
    for (let i = 0; i < set.xs.length; i++) {
      const dx = set.xs[i]! - cx;
      const dz = set.zs[i]! - cz;
      const d = Math.hypot(dx, dz);
      if (d > r + reach) continue;
      if (d > NEAR_ALWAYS + reach && (dx * fx + dz * fz) / d < CONE_COS) continue;
      keep.push(i);
    }
    for (const p of set.parts) {
      const dst = p.mesh.instanceMatrix.array as Float32Array;
      keep.forEach((i, k) => dst.set(p.all.subarray(i * 16, i * 16 + 16), k * 16));
      p.mesh.instanceMatrix.needsUpdate = true;
      p.mesh.instanceMatrix.clearUpdateRanges();
      p.mesh.instanceMatrix.addUpdateRange(0, keep.length * 16);
      if (p.colors && p.mesh.instanceColor) {
        const c = p.mesh.instanceColor.array as Float32Array;
        keep.forEach((i, k) => c.set(p.colors!.subarray(i * 3, i * 3 + 3), k * 3));
        p.mesh.instanceColor.needsUpdate = true;
      }
      p.mesh.count = keep.length;
    }
  });
}

/** Copy of an instanced mesh's matrices (call after they were all set). */
export const snapshot = (m: THREE.InstancedMesh) => (m.instanceMatrix.array as Float32Array).slice();
export const snapshotColors = (m: THREE.InstancedMesh) => (m.instanceColor ? (m.instanceColor.array as Float32Array).slice() : undefined);

const FAR_OUT = 80;
const FAR_IN = 45;
const pos = new THREE.Vector3();
/**
 * Characters (NPCs, street animals, cyclists) are skinned or hand-animated, so their frustum culling is off (it pops).
 * This hides one when it is far from the camera: a few pixels tall out there, but each one is 6–20 draw calls plus
 * its shadow. The position is read from the first child (the part that moves), 4 times a second.
 */
export function FarHide({ out = FAR_OUT, inside = FAR_IN, children }: { out?: number; inside?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const acc = useRef(Math.random() * 0.25);
  useFrame(({ camera }, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const g = ref.current;
    if (!g) return;
    (g.children[0] ?? g).getWorldPosition(pos);
    const r = useArea.getState().current ? inside : out;
    g.visible = Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z) < r;
  });
  return <group ref={ref}>{children}</group>;
}
