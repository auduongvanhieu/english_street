import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Text } from '@react-three/drei';
import { Part, box, cyl } from './chibi/buildChibi';
import { chibiMaterial } from './chibi/buildChibi';
import { useGame } from '../store/game';
import { localBusTag } from '../store/bus';
import { serverNow } from '../net/client';
import { busPose, decodeBus, tagLive, type BusTag, type StopId } from '../world/bus';
import { preloadLpm, useLpmParts } from './LpmModel';

preloadLpm('bus_interior');

/**
 * The shared buses: one per (stop, slot) that somebody is boarding or arriving with. Every client derives the
 * same motion from the server clock (world/bus.ts), so riders and onlookers see the same bus.
 */
const BODY = '#f6b93b';
const BODY_DARK = '#c98a1e';
const ROOF = '#f4f1ea';
const STRIPE = '#1f9e8f';
const GLASS = '#26425a';
const GLASS_LIGHT = '#3d6a8c';
const TRIM = '#3a3f47';
/** Front axle behind the front door (like a real city bus), rear axle near the back. */
const AXLES = [-0.95, 2.85];
const rbox = (x: number, y: number, z: number, r = 0.12) => new RoundedBoxGeometry(x, y, z, 3, r);

let bodyGeo: THREE.BufferGeometry | null = null;
let doorGeo: THREE.BufferGeometry | null = null;
let wheelGeo: THREE.BufferGeometry | null = null;
/**
 * City bus facing −x: 9 m long, 2.4 m wide, ~3 m tall. Rounded yellow body with a teal stripe, one long band of
 * tinted windows, a cream roof with an air-con box, LED destination board, headlights, tail lights, mirrors.
 * The door is on the +z side near the front (x = DOOR_DX).
 */
function geometries() {
  if (bodyGeo) return { bodyGeo, doorGeo: doorGeo!, wheelGeo: wheelGeo! };
  const p = new Part();
  // body, window band, roof
  p.add(rbox(9, 1.15, 2.4, 0.2), BODY, { p: [0, 0.93, 0] });
  p.add(rbox(8.92, 1.02, 2.34, 0.14), GLASS, { p: [0, 1.96, 0] });
  p.add(rbox(9, 0.42, 2.4, 0.2), ROOF, { p: [0, 2.64, 0] });
  p.add(rbox(2.4, 0.3, 1.5, 0.12), '#d5dade', { p: [1.5, 2.95, 0] }); // air conditioning
  p.add(rbox(9.06, 0.3, 2.44, 0.12), TRIM, { p: [0, 0.4, 0] }); // skirt
  // window pillars (body colour) and the stripe, both sides
  for (const z of [1.175, -1.175]) {
    for (const x of [-0.9, 0.7, 2.3, 3.8]) p.add(box(0.16, 1.02, 0.04), BODY, { p: [x, 1.96, z] });
    p.add(box(8.3, 0.16, 0.03), STRIPE, { p: [0.25, 1.22, z * 1.025] });
    p.add(box(8.3, 0.05, 0.03), '#ffffff', { p: [0.25, 1.33, z * 1.025] });
  }
  // wheel arches
  for (const x of AXLES) p.add(rbox(1.3, 0.72, 2.46, 0.14), '#22252a', { p: [x, 0.58, 0] });
  // front: windscreen, corner pillars, LED board, grille, headlights, indicators, bumper
  p.add(box(0.05, 1.05, 2.06), GLASS_LIGHT, { p: [-4.49, 1.95, 0] });
  for (const z of [1.1, -1.1]) p.add(box(0.12, 1.05, 0.16), BODY, { p: [-4.46, 1.96, z] });
  p.add(box(0.06, 0.32, 1.7), '#121417', { p: [-4.52, 2.64, 0] });
  p.add(box(0.06, 0.32, 0.12), '#ffb020', { p: [-4.53, 2.64, -0.72] }); // route number cell
  p.add(rbox(0.06, 0.28, 1.1, 0.03), TRIM, { p: [-4.52, 0.86, 0] });
  for (const z of [0.82, -0.82]) {
    p.add(rbox(0.08, 0.24, 0.46, 0.06), '#fff6cf', { p: [-4.52, 0.88, z] });
    p.add(rbox(0.08, 0.12, 0.18, 0.04), '#ff9a1f', { p: [-4.52, 0.62, z * 1.2] });
  }
  p.add(rbox(0.28, 0.3, 2.42, 0.1), TRIM, { p: [-4.46, 0.42, 0] });
  // mirrors on short arms
  for (const s of [1, -1]) {
    p.add(box(0.06, 0.06, 0.32), TRIM, { p: [-4.45, 2.15, s * 1.32] });
    p.add(rbox(0.1, 0.42, 0.16, 0.04), '#1b1d21', { p: [-4.58, 1.95, s * 1.5] });
  }
  // rear: window, tail lights, bumper
  p.add(box(0.05, 0.85, 1.9), GLASS_LIGHT, { p: [4.49, 2.0, 0] });
  for (const z of [0.85, -0.85]) p.add(rbox(0.08, 0.36, 0.26, 0.05), '#e23b3b', { p: [4.52, 0.95, z] });
  p.add(rbox(0.28, 0.3, 2.42, 0.1), TRIM, { p: [4.46, 0.42, 0] });
  // door opening on the +z side
  p.add(box(1.34, 2.02, 0.03), TRIM, { p: [-2.4, 1.42, 1.215] });
  bodyGeo = p.build();
  // the two door leaves (each mesh is scaled to half width in Bus): glass in a dark frame
  const d = new Part();
  for (const x of [-0.3, 0.3]) {
    d.add(box(0.6, 1.86, 0.05), TRIM, { p: [x, 0, 0] });
    d.add(box(0.46, 0.75, 0.06), GLASS_LIGHT, { p: [x, 0.42, 0] });
    d.add(box(0.46, 0.65, 0.06), GLASS_LIGHT, { p: [x, -0.4, 0] });
  }
  doorGeo = d.build();
  const w = new Part();
  w.add(cyl(0.48, 0.48, 0.34, 20), '#262626', { r: [Math.PI / 2, 0, 0] });
  w.add(cyl(0.27, 0.27, 0.36, 14), '#b8c0c8', { r: [Math.PI / 2, 0, 0] });
  w.add(cyl(0.09, 0.09, 0.38, 8), '#5a6068', { r: [Math.PI / 2, 0, 0] });
  wheelGeo = w.build();
  return { bodyGeo, doorGeo, wheelGeo };
}

function Bus({ stop, slot }: { stop: StopId; slot: number }) {
  const g = useRef<THREE.Group>(null);
  const doorL = useRef<THREE.Mesh>(null);
  const doorR = useRef<THREE.Mesh>(null);
  const wheels = useRef<THREE.Group>(null);
  const interior = useRef<THREE.Mesh>(null);
  const geo = useMemo(geometries, []);
  // seats, floor, poles, ceiling, driver: Blender LPM asset assets-src/lpm/recipes/bus_interior.py
  const inside = useLpmParts('bus_interior').SM_BusInterior!;
  const lastX = useRef<number | null>(null);
  useFrame(() => {
    const p = busPose(stop, slot, serverNow());
    const grp = g.current;
    if (!grp) return;
    grp.visible = p.visible;
    grp.position.set(p.x, 0, p.z);
    // doors fold apart; wheels roll with the distance driven
    if (doorL.current) doorL.current.position.x = -2.4 - 0.32 - p.door * 0.4;
    if (doorR.current) doorR.current.position.x = -2.4 + 0.32 + p.door * 0.4;
    if (lastX.current !== null && wheels.current) {
      const dx = p.x - lastX.current;
      for (const w of wheels.current.children) w.rotation.z -= dx / 0.48;
    }
    lastX.current = p.x;
    // the interior is only drawn for the player riding this bus (the windows are opaque from outside)
    if (interior.current) {
      const mine = decodeBus(localBusTag());
      interior.current.visible = !!mine && mine.stop === stop && mine.slot === slot;
    }
  });
  const mat = chibiMaterial();
  return (
    <group ref={g}>
      <mesh geometry={geo.bodyGeo} material={mat} castShadow receiveShadow />
      <mesh ref={interior} geometry={inside} material={mat} visible={false} />
      <mesh ref={doorL} geometry={geo.doorGeo} material={mat} position={[-2.72, 1.45, 1.25]} scale={[0.5, 1, 1]} />
      <mesh ref={doorR} geometry={geo.doorGeo} material={mat} position={[-2.08, 1.45, 1.25]} scale={[0.5, 1, 1]} />
      <Text position={[-4.56, 2.64, 0.12]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.17} color="#ffb020" anchorX="center" anchorY="middle">
        ENGLISH STREET
      </Text>
      <Text position={[-4.56, 2.64, -0.72]} rotation={[0, -Math.PI / 2, 0]} fontSize={0.22} color="#121417" anchorX="center" anchorY="middle">
        1
      </Text>
      <group ref={wheels}>
        {AXLES.flatMap((x) => [1.06, -1.06].map((z) => <mesh key={`${x}:${z}`} geometry={geo.wheelGeo} material={mat} position={[x, 0.48, z]} />))}
      </group>
    </group>
  );
}

/** Every bus somebody is riding right now (checked 4×/s; each bus animates itself every frame). */
export function Buses() {
  const [keys, setKeys] = useState<string[]>([]);
  const acc = useRef(1);
  // A bus stays on screen until it has driven off, even after its last rider stepped off (their tag is gone).
  const seen = useRef(new Map<string, BusTag>());
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const now = serverNow();
    const tags = [localBusTag(), ...Object.values(useGame.getState().players).map((p) => p.bus)];
    for (const s of tags) {
      const b = decodeBus(s);
      if (b && tagLive(b, now)) seen.current.set(`${b.stop}:${b.slot}`, b);
    }
    for (const [k, b] of seen.current) if (!tagLive(b, now)) seen.current.delete(k);
    const next = [...seen.current.keys()].sort();
    if (next.join('|') !== keys.join('|')) setKeys(next);
  });
  return (
    <>
      {keys.map((k) => {
        const [stop, slot] = k.split(':');
        return <Bus key={k} stop={stop as StopId} slot={Number(slot)} />;
      })}
    </>
  );
}
