import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { TRAIN_CAR, inRect, trainCarRect } from '@es/shared';
import { serverNow } from '../../../net/client';
import { localPos } from '../../LocalPlayer';
import { lpmGlassMat, preloadLpm, useLpmParts } from '../../LpmModel';
import { Chibi } from '../../chibi/Chibi';
import { Part, box, chibiMaterial, cyl } from '../../chibi/buildChibi';
import { NPC_CHIBI } from '../../npcLook';
import { rideTick, strandedCheck, useTrain } from '../../../store/train';
import { DIST_ARRIVE, DIST_HOME, RIDE, distAt } from '../../../world/train';

/**
 * Inside the train (off the map at TRAIN_CAR): the carriage (LPM assets-src/lpm/recipes/train_interior.py), the
 * landscape sliding past the windows, the destination platform and home platform gliding in, and the ticket
 * inspector walking down the aisle. Mounted while you ride (or stand in the carriage); runs the ride script.
 */
preloadLpm('train_interior');
const CX = TRAIN_CAR.x;
const CZ = TRAIN_CAR.z;
const TILE = 240;
const GROUND_Y = -0.9;

type Theme = 'country' | 'river' | 'hills' | 'sea' | 'town';
const DEST_THEME: Record<string, Theme> = { Riverside: 'river', 'Maple Hill': 'hills', 'Sunny Bay': 'sea', 'Old Town': 'town' };

const rnd = (k: number) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const cone = (p: Part, x: number, z: number, h: number, c: string) => {
  p.add(cyl(0.12, 0.15, h * 0.35, 5), '#7a5536', { p: [x, GROUND_Y + h * 0.17, z] });
  p.add(cyl(0, h * 0.28, h * 0.75, 6), c, { p: [x, GROUND_Y + h * 0.6, z] });
};
const house = (p: Part, x: number, z: number, wall: string, roof: string, s = 1) => {
  p.add(box(3 * s, 2.4 * s, 3 * s), wall, { p: [x, GROUND_Y + 1.2 * s, z] });
  p.add(cyl(0, 2.3 * s, 1.4 * s, 4), roof, { p: [x, GROUND_Y + 3.1 * s, z], r: [0, Math.PI / 4, 0] });
};

/** One 240 m tile of landscape on both sides of the line (x from -120 to 120 around the carriage). */
function buildTile(theme: Theme): THREE.BufferGeometry {
  const p = new Part();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 46; i++) {
      const k = i * 7 + (side > 0 ? 1000 : 0) + theme.length * 31;
      const x = -TILE / 2 + (i + rnd(k)) * (TILE / 46);
      const z = side * (10 + rnd(k + 1) * 32);
      const r = rnd(k + 2);
      if (theme === 'country') {
        if (r < 0.55) cone(p, x, z, 4 + rnd(k + 3) * 4, r < 0.3 ? '#4e9a45' : '#6cbf4f');
        else if (r < 0.62) house(p, x, z, '#f2e3c6', '#b5533c');
        else if (r < 0.75) p.add(box(10, 0.05, 6), r < 0.7 ? '#e6c35a' : '#9fcf6a', { p: [x, GROUND_Y + 0.03, z] });
      } else if (theme === 'hills') {
        if (r < 0.35) p.add(cyl(0, 10 + rnd(k + 3) * 8, 6 + rnd(k + 4) * 8, 6), r < 0.2 ? '#7cae5a' : '#8fb86a', { p: [x, GROUND_Y + 4, side * (24 + rnd(k + 5) * 20)] });
        else if (r < 0.8) cone(p, x, z, 4 + rnd(k + 3) * 3, ['#d9622b', '#e89b2f', '#c0392b'][Math.floor(rnd(k + 6) * 3)]!);
      } else if (theme === 'town') {
        if (r < 0.6) house(p, x, z, ['#c98a52', '#b5533c', '#e3cfa8', '#9c6b4e'][Math.floor(rnd(k + 3) * 4)]!, '#6b3b2a', 1 + rnd(k + 4) * 0.6);
        else if (r < 0.7) {
          p.add(box(2, 9, 2), '#9c8f80', { p: [x, GROUND_Y + 4.5, z] }); // church tower
          p.add(cyl(0, 1.6, 3, 4), '#6b3b2a', { p: [x, GROUND_Y + 10.5, z], r: [0, Math.PI / 4, 0] });
        }
      } else if (theme === 'river') {
        if (side > 0 && r < 0.2) p.add(box(3, 0.6, 1.4), r < 0.1 ? '#c0392b' : '#f2e3c6', { p: [x, GROUND_Y - 0.2, 14 + rnd(k + 3) * 6] }); // boats
        else if (r < 0.6 && Math.abs(z) > (side > 0 ? 24 : 6)) cone(p, x, z, 5 + rnd(k + 3) * 3, '#5aa36a');
      } else if (theme === 'sea') {
        if (side < 0 && r < 0.4) cone(p, x, z, 6, '#3f9b5a');
        else if (side > 0 && r < 0.12) p.add(box(2.5, 1.2, 1), '#ffffff', { p: [x, GROUND_Y - 0.1, 20 + rnd(k + 3) * 16] }); // sails
        else if (side > 0 && r < 0.3) p.add(cyl(0.05, 0.05, 2.4, 5), '#f6f1e0', { p: [x, GROUND_Y + 1.2, 9] }); // beach umbrellas
      }
    }
    // telegraph poles along the line
    for (let x = -TILE / 2; x < TILE / 2; x += 30) p.add(box(0.15, 6, 0.15), '#6b4a2e', { p: [x, GROUND_Y + 3, side * 5.6] });
  }
  // the other track beside ours: ballast, sleepers and rails sliding past (the clearest sign we are moving)
  p.add(box(TILE, 0.2, 3.2), '#8d8577', { p: [0, GROUND_Y + 0.1, -3.6] });
  for (let x = -TILE / 2; x < TILE / 2; x += 1.2) p.add(box(0.25, 0.12, 2.4), '#5d4a3a', { p: [x, GROUND_Y + 0.26, -3.6] });
  for (const dz of [-0.75, 0.75]) p.add(box(TILE, 0.1, 0.08), '#9aa5ab', { p: [0, GROUND_Y + 0.37, -3.6 + dz] });
  return p.build();
}

/** Flat ground strips for a theme: grass, water or sand on the far side. */
function groundColor(theme: Theme): [string, string | null] {
  if (theme === 'river') return ['#7fbf62', '#5aa9d6'];
  if (theme === 'sea') return ['#e8d8a8', '#3d8fd1'];
  if (theme === 'town') return ['#a9b0a0', null];
  if (theme === 'hills') return ['#9cc36f', null];
  return ['#86c25c', null];
}

function Landscape({ theme, show, dist }: { theme: Theme; show: () => boolean; dist: { d: number } }) {
  const geo = useMemo(() => buildTile(theme), [theme]);
  const g = useRef<THREE.Group>(null);
  const [ground, water] = groundColor(theme);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    const grp = g.current;
    if (!grp) return;
    const target = show() ? 1 : 0;
    const s = grp.scale.y + (target - grp.scale.y) * Math.min(1, dt * 3);
    grp.scale.set(1, Math.max(0.001, s), 1);
    grp.visible = s > 0.01;
    const off = dist.d % TILE;
    grp.children[0]!.position.x = CX - off;
    grp.children[1]!.position.x = CX - off + TILE;
  });
  return (
    <group ref={g}>
      <mesh geometry={geo} material={chibiMaterial()} position-z={CZ} />
      <mesh geometry={geo} material={chibiMaterial()} position-z={CZ} />
      <mesh position={[CX, GROUND_Y, CZ]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2 * TILE, 120]} />
        <meshStandardMaterial color={ground} roughness={1} />
      </mesh>
      {water ? (
        <mesh position={[CX, GROUND_Y + 0.02, CZ + 30]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[2 * TILE, 40]} />
          <meshStandardMaterial color={water} roughness={0.3} />
        </mesh>
      ) : null}
    </group>
  );
}

/** A platform with a canopy and a big name sign, on the +z side; slides in as the train brakes. */
function Platform({ name, at, dist }: { name: string; at: number; dist: { d: number } }) {
  const geo = useMemo(() => {
    const p = new Part();
    p.add(box(60, 0.9, 4), '#b9b4aa', { p: [0, -0.45, 3.4] });
    p.add(box(60, 0.05, 0.3), '#f2c94c', { p: [0, 0.03, 1.6] });
    p.add(box(40, 0.15, 3), '#607d8b', { p: [0, 3.6, 3.6] });
    for (let x = -18; x <= 18; x += 6) p.add(box(0.15, 3.6, 0.15), '#455a64', { p: [x, 1.8, 4.6] });
    for (const x of [-12, 12]) p.add(box(4.2, 1, 0.12), '#1d3f8a', { p: [x, 2.6, 2.4] });
    return p.build();
  }, []);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    const x = at - dist.d;
    g.current.visible = Math.abs(x) < 140;
    g.current.position.x = CX + x;
  });
  return (
    <group ref={g} position={[CX, 0, CZ]} visible={false}>
      <mesh geometry={geo} material={chibiMaterial()} />
      {[-12, 12].map((x) => (
        <Text key={x} position={[x, 2.6, 2.33]} rotation-y={Math.PI} fontSize={0.45} color="#ffffff" anchorX="center" anchorY="middle">
          {name}
        </Text>
      ))}
    </group>
  );
}

function Inspector({ dep }: { dep: number }) {
  const g = useRef<THREE.Group>(null);
  const [anim, setAnim] = useState('idle');
  useFrame(() => {
    if (!g.current) return;
    const t = (serverNow() - dep) / 1000 - (RIDE.inspect - 3);
    g.current.visible = t > 0 && t < 18;
    // walks in from the far end, stops in the middle while checking tickets, walks on
    const x = t < 4 ? -6.5 + t * 1.2 : t < 12 ? -1.7 : -1.7 + (t - 12) * 1.3;
    g.current.position.set(CX + Math.min(6.5, x), 0, CZ);
    const a = t < 4 || t > 12 ? 'walk' : 'idle';
    if (a !== anim) setAnim(a);
  });
  return (
    <group ref={g} rotation-y={Math.PI / 2} visible={false}>
      <Chibi spec={NPC_CHIBI.stationmaster!} anim={anim} />
    </group>
  );
}

function Carriage() {
  const parts = useLpmParts('train_interior');
  const wallN = useRef<THREE.Mesh>(null);
  const wallS = useRef<THREE.Mesh>(null);
  const ceil = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (wallN.current) wallN.current.visible = camera.position.z > CZ - 1.3;
    if (wallS.current) wallS.current.visible = camera.position.z < CZ + 1.3;
    if (ceil.current) ceil.current.visible = camera.position.y < 2.2;
  });
  return (
    <group position={[CX, 0, CZ]}>
      <mesh geometry={parts['SM_TR_Inside']!} material={chibiMaterial()} receiveShadow />
      <mesh ref={ceil} geometry={parts['SM_TR_Ceiling']!} material={chibiMaterial()} />
      <mesh ref={wallN} geometry={parts['SM_TR_WallN']!} material={chibiMaterial()} />
      <mesh ref={wallS} geometry={parts['SM_TR_WallS']!} material={chibiMaterial()} />
      <mesh geometry={parts['SM_TR_Win_glass']!} material={lpmGlassMat} />
      <pointLight position={[0, 2, 0]} intensity={6} distance={12} color="#fff4e0" />
    </group>
  );
}

export default function TrainRide() {
  const ride = useTrain((s) => s.ride);
  const [inside, setInside] = useState(false);
  const acc = useRef(0);
  const dist = useRef({ d: 0 }).current;
  useEffect(() => {
    const id = window.setTimeout(strandedCheck, 4000);
    return () => window.clearTimeout(id);
  }, []);
  useFrame((_, dt) => {
    const r = useTrain.getState().ride;
    dist.d = r ? distAt(Math.max(0, (serverNow() - r.dep) / 1000)) : 0;
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const i = inRect(trainCarRect(1), localPos.x, localPos.z);
    if (i !== inside) setInside(i);
    rideTick();
  });
  if (!ride && !inside) return null;
  const back = !!ride?.returning;
  const dest = ride?.dest ?? 'Riverside';
  // on the way back from Sunny Bay: the sea first, then the countryside, and home is the first stop
  const theme = back ? 'sea' : (DEST_THEME[dest] ?? 'country');
  const away = () => {
    const d = dist.d;
    return back ? d < 200 : d > DIST_ARRIVE - 220 && d < DIST_ARRIVE + 200;
  };
  return (
    <group>
      <Carriage />
      {ride ? (
        <>
          <Landscape theme="country" dist={dist} show={() => !away()} />
          <Landscape theme={theme} dist={dist} show={away} />
          <Platform name={dest} at={DIST_ARRIVE} dist={dist} />
          {back ? null : <Platform name="English Street Central" at={DIST_HOME} dist={dist} />}
          {back ? null : <Inspector dep={ride.dep} />}
        </>
      ) : null}
    </group>
  );
}
