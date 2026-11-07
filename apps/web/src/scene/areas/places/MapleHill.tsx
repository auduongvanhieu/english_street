import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { inRect } from '@es/shared';
import { serverNow } from '../../../net/client';
import { localPos } from '../../LocalPlayer';
import { lastPointer } from '../../../input/camera';
import { walkTo } from '../../../input/clickMove';
import { preloadLpm, useLpmParts } from '../../LpmModel';
import { Part, box, chibiMaterial, cyl } from '../../chibi/buildChibi';
import {
  BIG_ROCK,
  BRIDGE,
  CABIN,
  CAMP,
  CX,
  HILL,
  LAKE,
  MAPLE_TREE,
  PICNIC,
  PINES,
  PLATFORM,
  RANGER_BOARD,
  SHELTER,
  SIGNPOSTS,
  STREAM_Z,
  SUMMIT,
  VIEWER,
  groundAt,
  trailDist,
  weatherAt,
} from '../../../world/mapleHill';
import { FORECAST, hikeTick, useHill } from '../../../store/hill';
import { useTrain } from '../../../store/train';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';
import CableCar from './CableCar';

/**
 * Maple Hill, the hills reached by train (world/mapleHill.ts): a meadow with the ranger cabin and a lake, a stream
 * with a footbridge, and the hill with its trails, the campsite, the big rock, the red maple and the summit.
 * The ground has real height (groundAt); props sit on it. Props: LPM assets-src/lpm/recipes/mountain_kit.py.
 */
preloadLpm('mountain_kit');
/** The trail-map board by the station (start a hike). */
const TRAIL_MAP = { x: CX + 6, z: -456 };

const G0 = { x0: HILL.minX - 70, x1: HILL.maxX + 70, z0: HILL.minZ - 60, z1: HILL.maxZ + 36 };
function Terrain() {
  const geo = useMemo(() => {
    const step = 2.5;
    const nx = Math.round((G0.x1 - G0.x0) / step);
    const nz = Math.round((G0.z1 - G0.z0) / step);
    const g = new THREE.PlaneGeometry(G0.x1 - G0.x0, G0.z1 - G0.z0, nx, nz).rotateX(-Math.PI / 2).translate((G0.x0 + G0.x1) / 2, 0, (G0.z0 + G0.z1) / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grass = [new THREE.Color('#7fae55'), new THREE.Color('#8dbb5e'), new THREE.Color('#739f4c')];
    const dirt = new THREE.Color('#b8925e');
    const rock = new THREE.Color('#8f8a80');
    const snow = new THREE.Color('#f1f4f6');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = groundAt(x, z);
      pos.setY(i, h);
      c.copy(grass[(Math.floor(x * 0.37) + Math.floor(z * 0.29)) % 3 === 0 ? 1 : Math.abs(Math.floor(x * 0.21 + z * 0.13)) % 2 === 0 ? 0 : 2]!);
      if (inRect(HILL, x, z, 1) && trailDist(x, z) < 1.5) c.copy(dirt);
      else if (h > 24) c.lerp(snow, Math.min(1, (h - 24) / 6));
      else if (h > 12 && !inRect(HILL, x, z)) c.lerp(rock, 0.6);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (lastPointer.type !== 'mouse' || e.delta > 6 || e.button !== 0) return;
    if (!inRect(HILL, e.point.x, e.point.z)) return;
    e.stopPropagation();
    walkTo(e.point.x, e.point.z, localPos);
  };
  return (
    <mesh geometry={geo} receiveShadow onClick={onClick}>
      <meshStandardMaterial vertexColors flatShading roughness={1} />
    </mesh>
  );
}

/** Station, the stream, the lake and the far mountains (one merged mesh). */
function Static() {
  const geo = useMemo(() => {
    const p = new Part();
    // the railway behind the platform
    p.add(box(140, 0.2, 3.2), '#8d8577', { p: [CX, 0.1, -437.5] });
    for (let x = CX - 70; x < CX + 70; x += 1.2) p.add(box(0.25, 0.1, 2.4), '#5d4a3a', { p: [x, 0.25, -437.5] });
    for (const dz of [-0.75, 0.75]) p.add(box(140, 0.1, 0.08), '#9aa5ab', { p: [CX, 0.35, -437.5 + dz] });
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.6, PLATFORM.z1 - PLATFORM.z0 + 1.6), '#c9c3b6', { p: [CX, -0.3, (PLATFORM.z0 + PLATFORM.z1) / 2 + 0.8] });
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.02, 0.25), '#f2c94c', { p: [CX, 0.01, PLATFORM.z1 + 0.8] });
    // far mountains behind the hill, with snow on top
    for (const [x, z, r, h] of [
      [130, -690, 70, 60],
      [215, -710, 80, 75],
      [300, -680, 70, 55],
      [60, -620, 50, 40],
      [345, -600, 55, 45],
    ] as [number, number, number, number][]) {
      p.add(cyl(0, r, h, 7), '#7d8f9c', { p: [x, h / 2 - 4, z] });
      p.add(cyl(0, r * 0.32, h * 0.32, 7), '#f1f4f6', { p: [x, h - 4 - h * 0.16 + 0.3, z] });
    }
    return p.build();
  }, []);
  const water = useMemo(() => {
    const p = new Part();
    p.add(box(HILL.maxX - HILL.minX + 20, 0.02, 2.4), '#4fa3e0', { p: [(HILL.minX + HILL.maxX) / 2, 0.06, STREAM_Z] });
    p.add(cyl(1, 1, 0.02, 24), '#4f9fd6', { p: [LAKE.x, 0.07, LAKE.z], s: [LAKE.rx, 1, LAKE.rz] });
    p.add(cyl(1, 1, 0.02, 24), '#86c2e8', { p: [LAKE.x, 0.075, LAKE.z], s: [LAKE.rx * 0.55, 1, LAKE.rz * 0.5] });
    return p.build();
  }, []);
  return (
    <group>
      <mesh geometry={geo} material={chibiMaterial()} receiveShadow />
      <mesh geometry={water}>
        <meshStandardMaterial vertexColors roughness={0.2} metalness={0.1} />
      </mesh>
    </group>
  );
}

function Pines() {
  const kit = useLpmParts('mountain_kit');
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    PINES.forEach(([x, z, s, r], i) => {
      o.position.set(x, groundAt(x, z) - 0.1, z);
      o.rotation.set(0, r, 0);
      o.scale.setScalar(s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [kit]);
  return <instancedMesh ref={ref} args={[kit['SM_MH_Pine']!, chibiMaterial(), PINES.length]} castShadow receiveShadow />;
}

const at = (x: number, z: number, dy = 0): [number, number, number] => [x, groundAt(x, z) + dy, z];

function Props() {
  const kit = useLpmParts('mountain_kit');
  const m = (name: string) => kit[name]!;
  const mat = chibiMaterial();
  const flame = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const f = flame.current;
    if (f) f.scale.set(1, 0.85 + Math.sin(clock.elapsedTime * 11) * 0.12 + Math.sin(clock.elapsedTime * 7.3) * 0.08, 1);
  });
  return (
    <group>
      <mesh geometry={m('SM_MH_Shelter')} material={mat} position={[SHELTER.x, 0, SHELTER.z]} rotation-y={Math.PI} castShadow />
      <Text position={[SHELTER.x, 2.2, SHELTER.z - 1.25]} rotation-y={Math.PI} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle">
        MAPLE HILL
      </Text>
      <mesh geometry={m('SM_MH_Cabin')} material={mat} position={at(CABIN.x, CABIN.z)} castShadow receiveShadow />
      <Text position={[CABIN.x, 3.05, CABIN.z + 3.72]} fontSize={0.26} color="#fff3d6" anchorX="center" anchorY="middle">
        RANGER STATION
      </Text>
      <mesh geometry={m('SM_MH_Board')} material={mat} position={at(RANGER_BOARD.x, RANGER_BOARD.z)} castShadow />
      <Forecast />
      <mesh geometry={m('SM_MH_Board')} material={mat} position={at(TRAIL_MAP.x, TRAIL_MAP.z)} castShadow />
      <Text position={[TRAIL_MAP.x, 1.82, TRAIL_MAP.z + 0.08]} fontSize={0.2} color="#3e2a14" anchorX="center" anchorY="middle">
        {'HIKING TRAILS\n🥾 Ask Rosa for directions'}
      </Text>
      <mesh geometry={m('SM_MH_Bridge')} material={mat} position={[BRIDGE.x, 0, BRIDGE.z]} castShadow receiveShadow />
      {PICNIC.map((p, i) => (
        <mesh key={i} geometry={m('SM_MH_Picnic')} material={mat} position={at(p.x, p.z)} castShadow />
      ))}
      <mesh geometry={m('SM_MH_Tent')} material={mat} position={at(CAMP.x - 3, CAMP.z - 1.5)} rotation-y={0.4} castShadow />
      <mesh geometry={m('SM_MH_Campfire')} material={mat} position={at(CAMP.x, CAMP.z)} />
      <mesh ref={flame} position={at(CAMP.x, CAMP.z, 0.15)}>
        <coneGeometry args={[0.32, 0.7, 6]} />
        <meshBasicMaterial color="#ff9a2e" transparent opacity={0.85} />
      </mesh>
      <mesh geometry={m('SM_MH_BigRock')} material={mat} position={at(BIG_ROCK.x, BIG_ROCK.z, -0.2)} castShadow />
      <mesh geometry={m('SM_MH_Maple')} material={mat} position={at(MAPLE_TREE.x, MAPLE_TREE.z, -0.1)} castShadow />
      <mesh geometry={m('SM_MH_Cairn')} material={mat} position={at(SUMMIT.x, SUMMIT.z, -0.05)} castShadow />
      <mesh geometry={m('SM_MH_Viewer')} material={mat} position={at(VIEWER.x, VIEWER.z)} castShadow />
      <Label x={CAMP.x + 2.5} z={CAMP.z + 2.5} text="Campsite" />
      <Label x={BIG_ROCK.x - 2.6} z={BIG_ROCK.z + 2.2} text="Big Rock" />
      <Label x={213} z={-475} text="Maple Lake" />
      <Label x={SUMMIT.x - 1.6} z={SUMMIT.z + 1.4} text="Summit · 455 m" />
      {SIGNPOSTS.map((s, i) => (
        <Signpost key={i} {...s} />
      ))}
    </group>
  );
}

/** A small wooden name sign on a post. */
function Label({ x, z, text }: { x: number; z: number; text: string }) {
  const y = groundAt(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.08, 1.2, 0.08]} />
        <meshStandardMaterial color="#6e4a26" />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[1.5, 0.36, 0.06]} />
        <meshStandardMaterial color="#a0703c" />
      </mesh>
      <Text position={[0, 1.25, 0.035]} fontSize={0.16} color="#fff6e0" anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  );
}

function Signpost({ x, z, arms }: { x: number; z: number; arms: string[] }) {
  const y = groundAt(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.12, 2.4, 0.12]} />
        <meshStandardMaterial color="#6e4a26" />
      </mesh>
      {arms.map((a, i) => (
        <group key={a} position={[0, 2.15 - i * 0.42, 0.08]}>
          <mesh>
            <boxGeometry args={[1.9, 0.32, 0.05]} />
            <meshStandardMaterial color={i === 2 ? '#2f6f73' : '#a0703c'} />
          </mesh>
          <Text position={[0, 0, 0.03]} fontSize={0.17} color="#ffffff" anchorX="center" anchorY="middle">
            {a}
          </Text>
        </group>
      ))}
    </group>
  );
}

/** The forecast on the ranger's board (changes with the shared clock). */
function Forecast() {
  const [w, setW] = useState(() => weatherAt(serverNow()));
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 3) return;
    acc.current = 0;
    const n = weatherAt(serverNow());
    if (n !== w) setW(n);
  });
  const f = FORECAST[w];
  const y = groundAt(RANGER_BOARD.x, RANGER_BOARD.z);
  return (
    <Text position={[RANGER_BOARD.x, y + 1.5, RANGER_BOARD.z + 0.08]} maxWidth={1.75} fontSize={0.15} lineHeight={1.25} color="#3e2a14" anchorX="center" anchorY="middle" textAlign="center">
      {`WEATHER TODAY ${f.icon}\n${f.text}\n🎒 Pack your backpack!`}
    </Text>
  );
}

function Usables() {
  const t = useT();
  const riding = useTrain((s) => !!s.ride);
  useUsable(riding ? null : { id: 'hill-train', x: CX, z: PLATFORM.z0 - 0.6, r: 3.5, icon: '🚆', label: t('Train to English Street Central'), priority: true, use: () => useTrain.getState().startReturn('Maple Hill') });
  useUsable({ id: 'hill-hike', x: TRAIL_MAP.x, z: TRAIL_MAP.z + 1.2, r: 1.8, icon: '🥾', label: t('Go on a hike'), priority: true, use: () => useHill.getState().startHike() });
  useUsable({ id: 'hill-pack', x: RANGER_BOARD.x, z: RANGER_BOARD.z + 1.2, r: 1.6, icon: '🎒', label: t('Pack your backpack'), priority: true, use: () => useHill.getState().openPack() });
  useUsable({ id: 'hill-viewer', x: VIEWER.x, z: VIEWER.z + 1.1, r: 1.6, icon: '🔭', label: t('Look for animals'), priority: true, use: () => useHill.getState().startAnimals() });
  return null;
}

export default function MapleHill() {
  const [near, setNear] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.3) return;
    acc.current = 0;
    const n = inRect(HILL, localPos.x, localPos.z, 40);
    if (n !== near) setNear(n);
    if (n) hikeTick(localPos.x, localPos.z);
  });
  if (!near) return null;
  return (
    <group>
      <Terrain />
      <Static />
      <Pines />
      <Props />
      <Usables />
      <CableCar />
    </group>
  );
}
