import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { insideBuilding, type Building } from '../../world/buildings';
import type { AreaFrame } from '../../world/areas';
import { localPos } from '../LocalPlayer';
import { Ground, Merged, box } from './kit';
import { bulbMat, glowGeometry, glowPointsMat, poolMat, windowMat } from '../nightGlow';
import { interior } from '../InteriorLights';

const WALL_H = 3.2;

/**
 * Walls, floor and roof of a walk-in building; the roof and front wall disappear while you are inside.
 * With `frame`, `b` is in that area's local coordinates (render it inside <AreaGroup>).
 */
export function BuildingShell({ b, name, frame, children }: { b: Building; name: string; frame?: AreaFrame; children?: React.ReactNode }) {
  const [inside, setInside] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const [x, z] = frame ? frame.toLocal(localPos.x, localPos.z) : [localPos.x, localPos.z];
    const i = insideBuilding(b, x, z + 0.6);
    if (i !== inside) setInside(i);
    if (i) {
      // tell the interior lights (scene/InteriorLights.tsx) where we are, in world coordinates
      const [wx, wz] = frame ? frame.toWorld((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) : [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
      const alongX = b.x1 - b.x0 >= b.z1 - b.z0;
      // a turned frame (south bank) swaps nothing: rotation by π keeps the axes
      interior.set(wx, wz, (alongX ? b.x1 - b.x0 : b.z1 - b.z0) / 2, alongX);
    }
  });
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const h = b.doorW / 2;
  return (
    <group>
      <Ground x0={b.x0} x1={b.x1} z0={b.z0} z1={b.z1} color={b.floor} y={0.02} />
      <Merged
        build={(p) => {
          p.add(box(w, WALL_H, 0.3), b.wall, { p: [cx, WALL_H / 2, b.z0] });
          p.add(box(0.3, WALL_H, d), b.wall, { p: [b.x0, WALL_H / 2, cz] });
          p.add(box(0.3, WALL_H, d), b.wall, { p: [b.x1, WALL_H / 2, cz] });
          // skirting stripe in the roof colour
          p.add(box(w, 0.35, 0.32), b.roof, { p: [cx, 0.18, b.z0] });
        }}
        deps={[b.area]}
      />
      {/* front wall: full height from outside, a low kerb while inside so the camera can see in */}
      <Merged
        build={(p) => {
          const hh = inside ? 0.4 : WALL_H;
          for (const [x0, x1] of [
            [b.x0, b.doorX - h],
            [b.doorX + h, b.x1],
          ] as const)
            p.add(box(x1 - x0, hh, 0.3), b.wall, { p: [(x0 + x1) / 2, hh / 2, b.z1] });
          if (!inside) {
            p.add(box(b.doorW + 0.2, WALL_H - 2.6, 0.3), b.wall, { p: [b.doorX, 2.6 + (WALL_H - 2.6) / 2, b.z1] });
            // windows
            for (let x = b.x0 + 3; x < b.x1 - 2; x += 5) if (Math.abs(x - b.doorX) > h + 1.5) p.add(box(2.6, 1.3, 0.05), '#a8d8f0', { p: [x, 1.6, b.z1 + 0.17] });
            // awning over the door
            p.add(box(b.doorW + 1.6, 0.12, 1.4), b.roof, { p: [b.doorX, 2.75, b.z1 + 0.75], r: [0.18, 0, 0] });
          }
        }}
        deps={[b.area, inside]}
      />
      {!inside ? (
        <>
          <Merged build={(p) => p.add(box(w + 0.6, 0.35, d + 0.6), b.roof, { p: [cx, WALL_H + 0.17, cz] })} deps={[b.area]} />
          <Text position={[b.doorX, 3.0, b.z1 + 0.36]} fontSize={0.55} color={b.roof} anchorX="center" anchorY="bottom" outlineWidth={0.04} outlineColor="#ffffff">
            {name}
          </Text>
        </>
      ) : null}
      <NightFront b={b} inside={inside} />
      {inside ? <CeilingLamps b={b} /> : null}
      {children}
    </group>
  );
}

/** Window x positions on the front wall (same rule as the glass panes above). */
function windowXs(b: Building) {
  const out: number[] = [];
  for (let x = b.x0 + 3; x < b.x1 - 2; x += 5) if (Math.abs(x - b.doorX) > b.doorW / 2 + 1.5) out.push(x);
  return out;
}

/** At night: warm lit windows, a lantern each side of the door and a pool of light on the step (nightGlow.ts). */
function NightFront({ b, inside }: { b: Building; inside: boolean }) {
  const { windows, lamps, halos } = useMemo(() => {
    const h = b.doorW / 2;
    const win = windowXs(b).map((x) => new THREE.PlaneGeometry(2.5, 1.2).translate(x, 1.6, b.z1 + 0.2));
    const sides = [b.doorX - h - 0.45, b.doorX + h + 0.45];
    const lampGeo = mergeGeometries(sides.map((x) => new THREE.BoxGeometry(0.22, 0.32, 0.2).translate(x, 2.15, b.z1 + 0.25)), false)!;
    return {
      windows: win.length ? mergeGeometries(win, false)! : null,
      lamps: lampGeo,
      halos: glowGeometry(sides.map((x) => ({ p: [x, 2.15, b.z1 + 0.35] as [number, number, number], c: '#ffd27a', s: 1.8, tw: 0.05 }))),
    };
  }, [b]);
  return (
    <group>
      {windows && !inside ? <mesh geometry={windows} material={windowMat} renderOrder={2} /> : null}
      <mesh geometry={lamps} material={bulbMat} />
      <points geometry={halos} material={glowPointsMat} renderOrder={3} />
      <mesh material={poolMat} rotation-x={-Math.PI / 2} position={[b.doorX, 0.04, b.z1 + 1.6]} renderOrder={2}>
        <planeGeometry args={[b.doorW + 3.5, 3.2]} />
      </mesh>
    </group>
  );
}

/** Warm pools of lamp light on the floor while inside (the lamps themselves are not drawn: the camera looks down through the missing roof). */
function CeilingLamps({ b }: { b: Building }) {
  const pools = useMemo(() => {
    const spots: [number, number][] = [];
    const nx = Math.max(1, Math.round((b.x1 - b.x0) / 6));
    const nz = Math.max(1, Math.round((b.z1 - b.z0) / 6));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) spots.push([b.x0 + ((i + 0.5) * (b.x1 - b.x0)) / nx, b.z0 + ((j + 0.5) * (b.z1 - b.z0)) / nz]);
    const sx = Math.min(5.5, (b.x1 - b.x0) / nx);
    const sz = Math.min(5.5, (b.z1 - b.z0) / nz);
    return mergeGeometries(spots.map(([x, z]) => new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2).translate(x, 0.045, z)), false)!;
  }, [b]);
  return (
    <mesh geometry={pools} material={poolMat} renderOrder={2} />
  );
}
