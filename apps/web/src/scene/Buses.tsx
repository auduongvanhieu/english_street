import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Part, box, cyl, sphere } from './chibi/buildChibi';
import { chibiMaterial } from './chibi/buildChibi';
import { useGame } from '../store/game';
import { localBusTag } from '../store/bus';
import { serverNow } from '../net/client';
import { BUS_LANE_Z, busPose, decodeBus, tagLive, type BusTag, type StopId } from '../world/bus';

/**
 * The shared buses: one per (stop, slot) that somebody is boarding or arriving with. Every client derives the
 * same motion from the server clock (world/bus.ts), so riders and onlookers see the same bus.
 */
const BODY = '#f4b63f';
const BODY_DARK = '#d9922a';
const GLASS = '#3a5a7a';

let bodyGeo: THREE.BufferGeometry | null = null;
let doorGeo: THREE.BufferGeometry | null = null;
let wheelGeo: THREE.BufferGeometry | null = null;
/** Bus facing −x: length 9 m, front at x = −4.5, door on the +z side near the front. */
function geometries() {
  if (bodyGeo) return { bodyGeo, doorGeo: doorGeo!, wheelGeo: wheelGeo! };
  const p = new Part();
  p.add(box(9, 2.2, 2.4), BODY, { p: [0, 1.55, 0] });
  p.add(cyl(1.2, 1.2, 9, 20, false, 0, Math.PI), BODY, { p: [0, 2.6, 0], r: [0, 0, Math.PI / 2], s: [0.35, 1, 1] }); // rounded roof
  p.add(box(9.05, 0.28, 2.45), BODY_DARK, { p: [0, 0.55, 0] }); // bumper strip
  // side windows (both sides) and windscreen
  for (const z of [1.21, -1.21]) for (let i = 0; i < 4; i++) p.add(box(1.5, 0.95, 0.04), GLASS, { p: [-1.1 + i * 1.7, 2.05, z] });
  p.add(box(0.04, 1.2, 2.0), GLASS, { p: [-4.52, 2.0, 0] });
  p.add(box(0.04, 1.0, 1.6), GLASS, { p: [4.52, 2.05, 0] });
  // headlights + destination board
  for (const z of [-0.8, 0.8]) p.add(sphere(0.16), '#fff6c8', { p: [-4.52, 0.95, z], s: [0.5, 1, 1] });
  p.add(box(0.06, 0.32, 1.5), '#1f2937', { p: [-4.55, 2.82, 0] });
  // door frame on the +z side
  p.add(box(1.25, 2.0, 0.05), '#7a5418', { p: [-2.4, 1.45, 1.22] });
  bodyGeo = p.build();
  const d = new Part();
  d.add(box(0.6, 1.85, 0.06), GLASS, { p: [-0.3, 0, 0] });
  d.add(box(0.6, 1.85, 0.06), GLASS, { p: [0.3, 0, 0] });
  doorGeo = d.build();
  const w = new Part();
  w.add(cyl(0.48, 0.48, 0.35, 18), '#2b2b2b', { r: [Math.PI / 2, 0, 0] });
  w.add(cyl(0.22, 0.22, 0.37, 12), '#9aa3ad', { r: [Math.PI / 2, 0, 0] });
  wheelGeo = w.build();
  return { bodyGeo, doorGeo, wheelGeo };
}

function Bus({ stop, slot }: { stop: StopId; slot: number }) {
  const g = useRef<THREE.Group>(null);
  const doorL = useRef<THREE.Mesh>(null);
  const doorR = useRef<THREE.Mesh>(null);
  const wheels = useRef<THREE.Group>(null);
  const geo = useMemo(geometries, []);
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
  });
  const mat = chibiMaterial();
  return (
    <group ref={g} position={[0, 0, BUS_LANE_Z]}>
      <mesh geometry={geo.bodyGeo} material={mat} castShadow receiveShadow />
      <mesh ref={doorL} geometry={geo.doorGeo} material={mat} position={[-2.72, 1.45, 1.25]} scale={[0.5, 1, 1]} />
      <mesh ref={doorR} geometry={geo.doorGeo} material={mat} position={[-2.08, 1.45, 1.25]} scale={[0.5, 1, 1]} />
      <group ref={wheels}>
        {[-3, 2.8].flatMap((x) => [1.15, -1.15].map((z) => <mesh key={`${x}:${z}`} geometry={geo.wheelGeo} material={mat} position={[x, 0.48, z]} />))}
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
