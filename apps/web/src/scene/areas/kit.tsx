import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Part, box, cyl, sphere } from '../chibi/buildChibi';
import { chibiMaterial } from '../chibi/buildChibi';
import { localPos } from '../LocalPlayer';
import { useSettings } from '../../store/settings';
import { areaFrame, type AreaDef } from '../../world/areas';
import { FAIRY, glowGeometry, glowPointsMat, windowMat } from '../nightGlow';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { Part, box, cyl, sphere };

/** A static prop built from primitives into ONE vertex-coloured toon mesh (one draw call). */
export function Merged({ build, deps = [], castShadow = true, onClick }: { build: (p: Part) => void; deps?: unknown[]; castShadow?: boolean; onClick?: (e: { stopPropagation: () => void }) => void }) {
  const [geo, lights, panes] = useMemo(() => {
    const p = new Part();
    build(p);
    const panes = p.panes.length
      ? mergeGeometries(p.panes.map((w) => new THREE.PlaneGeometry(w.w, w.h).rotateY(w.ry ?? 0).translate(...w.p)), false)
      : null;
    return [p.build(), p.lights.length ? glowGeometry(p.lights) : null, panes] as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(
    () => () => {
      geo.dispose();
      lights?.dispose();
      panes?.dispose();
    },
    [geo, lights, panes],
  );
  const mesh = <mesh geometry={geo} material={chibiMaterial()} castShadow={castShadow} receiveShadow onClick={onClick} />;
  if (!lights && !panes) return mesh;
  return (
    <>
      {mesh}
      {lights ? <points geometry={lights} material={glowPointsMat} renderOrder={3} /> : null}
      {panes ? <mesh geometry={panes} material={windowMat} renderOrder={2} /> : null}
    </>
  );
}

/** Flat coloured ground patch slightly above the field (y = 0.01…). */
export function Ground({ x0, x1, z0, z1, color, y = 0.012 }: { x0: number; x1: number; z0: number; z1: number; color: string; y?: number }) {
  return (
    <mesh position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

/** Wooden or metal fence around a rectangle (posts + 2 rails), merged; gaps = [[x0,x1] on the south side]. */
export function fenceRect(p: Part, x0: number, x1: number, z0: number, z1: number, color = '#8a6a44', h = 1, gapsSouth: [number, number][] = [], gapsNorth: [number, number][] = []) {
  const line = (ax: number, az: number, bx: number, bz: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return;
    const n = Math.max(1, Math.round(len / 2));
    const ang = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      p.add(box(0.12, h, 0.12), color, { p: [ax + (bx - ax) * t, h / 2, az + (bz - az) * t] });
    }
    for (const y of [h * 0.45, h * 0.85]) p.add(box(0.06, 0.08, len), color, { p: [(ax + bx) / 2, y, (az + bz) / 2], r: [0, ang, 0] });
  };
  // south side (z1) with gaps
  let x = x0;
  for (const [g0, g1] of [...gapsSouth].sort((a, b) => a[0] - b[0])) {
    line(x, z1, g0, z1);
    x = g1;
  }
  line(x, z1, x1, z1);
  // north side (z0) with gaps
  x = x0;
  for (const [g0, g1] of [...gapsNorth].sort((a, b) => a[0] - b[0])) {
    line(x, z0, g0, z0);
    x = g1;
  }
  line(x, z0, x1, z0);
  line(x0, z0, x0, z1);
  line(x1, z0, x1, z1);
}

/** A tree from primitives (trunk + 3 leafy balls). */
export function tree(p: Part, x: number, z: number, s = 1, leaf = '#5fae4e') {
  p.add(cyl(0.12 * s, 0.16 * s, 1.4 * s, 8), '#7a5536', { p: [x, 0.7 * s, z] });
  p.add(sphere(0.75 * s, 0, Math.PI, 0, Math.PI * 2, 10, 8), leaf, { p: [x, 1.8 * s, z] });
  p.add(sphere(0.55 * s, 0, Math.PI, 0, Math.PI * 2, 10, 8), leaf, { p: [x + 0.45 * s, 1.55 * s, z + 0.2 * s] });
  p.add(sphere(0.5 * s, 0, Math.PI, 0, Math.PI * 2, 10, 8), leaf, { p: [x - 0.4 * s, 1.6 * s, z - 0.25 * s] });
  fairyLights(p, x, z, s);
}

/** A string of twinkling bulbs wound round the three leaf balls of tree() (lit at night, see nightGlow.ts). */
function fairyLights(p: Part, x: number, z: number, s: number) {
  const balls: [number, number, number, number][] = [
    [x, 1.8 * s, z, 0.75 * s],
    [x + 0.45 * s, 1.55 * s, z + 0.2 * s, 0.55 * s],
    [x - 0.4 * s, 1.6 * s, z - 0.25 * s, 0.5 * s],
  ];
  const seed = Math.abs(Math.round(x * 7 + z * 13));
  balls.forEach(([cx, cy, cz, r], b) => {
    const n = b === 0 ? 10 : 6;
    for (let i = 0; i < n; i++) {
      // a spiral from the bottom of the ball to near its top (golden-angle steps)
      const t = (i + 0.5) / n;
      const y = -0.35 + 1.15 * t;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * 2.39996 + seed + b;
      const k = r * 1.04;
      p.lights.push({ p: [cx + Math.cos(a) * ring * k, cy + y * k, cz + Math.sin(a) * ring * k], c: FAIRY[(seed + i * 3 + b) % FAIRY.length]!, s: 0.55 * Math.max(0.8, s), tw: 0.6 });
    }
  });
}

export function rock(p: Part, x: number, z: number, s = 1, color = '#9a9a92') {
  p.add(sphere(0.6 * s, 0, Math.PI, 0, Math.PI * 2, 7, 5), color, { p: [x, 0.25 * s, z], s: [1.3, 0.7, 1] });
}

/** Sign board on a post, text facing +Z (rotate the group to face elsewhere). */
export function Sign({ x, z, text, sub, rot = 0, color = '#2f6b3a', w, y = 1.5 }: { x: number; z: number; text: string; sub?: string; rot?: number; color?: string; w?: number; y?: number }) {
  const width = w ?? Math.max(1.6, text.length * 0.26 + 0.6);
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <mesh position={[0, y / 2, -0.05]}>
        <boxGeometry args={[0.1, y, 0.1]} />
        <meshStandardMaterial color="#6b4e33" />
      </mesh>
      <mesh position={[0, y + 0.1, 0]}>
        <boxGeometry args={[width, sub ? 0.85 : 0.6, 0.06]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Text position={[0, y + (sub ? 0.24 : 0.1), 0.04]} fontSize={0.34} color="#fff" anchorX="center" anchorY="middle">
        {text}
      </Text>
      {sub ? (
        <Text position={[0, y - 0.08, 0.04]} fontSize={0.2} color="#f6f1d8" anchorX="center" anchorY="middle">
          {sub}
        </Text>
      ) : null}
    </group>
  );
}

/**
 * Mounts children only while the local player is within `range` metres of the area (x-wise, and on its side
 * of the river). Checked twice a second.
 */
export function NearArea({ area, range, children }: { area: AreaDef; range?: number; children: React.ReactNode }) {
  const low = useSettings((s) => s.quality) === 'low';
  const r = range ?? (low ? 25 : 42);
  const near = useNear(area.x0 - r, area.x1 + r, area.side === 'north' ? -999 : 8, area.side === 'north' ? 30 : 999);
  return near ? <>{children}</> : null;
}

export function useNear(x0: number, x1: number, z0 = -999, z1 = 999) {
  const test = () => localPos.x > x0 && localPos.x < x1 && localPos.z > z0 && localPos.z < z1;
  const [near, setNear] = useState(test);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.5) return;
    acc.current = 0;
    const n = test();
    if (n !== near) setNear(n);
  });
  return near;
}

/**
 * The local frame of an area as a group: children are written in local coordinates (origin = middle of the
 * front fence, local -z into the yard, see world/areas.ts areaFrame), so one scene works north or south of a road.
 */
export function AreaGroup({ area, children }: { area: AreaDef; children: React.ReactNode }) {
  const f = areaFrame(area);
  return (
    <group position={[f.ox, 0, f.oz]} rotation-y={f.rot}>
      {children}
    </group>
  );
}

/** Instanced copies of one small merged prop (e.g. products on shelves). */
export function InstancedProp({ build, matrices, deps = [], onClick }: { build: (p: Part) => void; matrices: THREE.Matrix4[]; deps?: unknown[]; onClick?: (index: number) => void }) {
  const geo = useMemo(() => {
    const p = new Part();
    build(p);
    return p.build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  const mesh = useMemo(() => new THREE.InstancedMesh(geo, chibiMaterial(), matrices.length), [geo, matrices.length]);
  useLayoutEffect(() => {
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [mesh, matrices]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  return (
    <primitive
      object={mesh}
      onClick={
        onClick
          ? (e: { stopPropagation: () => void; instanceId?: number }) => {
              e.stopPropagation();
              if (e.instanceId !== undefined) onClick(e.instanceId);
            }
          : undefined
      }
    />
  );
}
