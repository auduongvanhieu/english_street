import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { inRect } from '@es/shared';
import { serverNow } from '../../../net/client';
import { localPos } from '../../LocalPlayer';
import { preloadLpm, useLpmParts } from '../../LpmModel';
import { Part, box, chibiMaterial, cyl } from '../../chibi/buildChibi';
import { BAY, CASTLE_SPOT, FINDS, KIOSK, KIOSK_SPOT, PALMS, PLATFORM, ROCKS, SEA_SWIM, SHELTER, SHORE_Z, TOWER, UMBRELLAS } from '../../../world/sunnyBay';
import { flagAt, swimTick, useBeach } from '../../../store/beach';
import { useTrain } from '../../../store/train';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';

/**
 * Sunny Bay, the seaside reached by train (world/sunnyBay.ts): sand, the sea, the station at the top, the lifeguard
 * tower with its flag, the ice-cream kiosk, palms and umbrellas. Props: LPM assets-src/lpm/recipes/beach_kit.py.
 */
preloadLpm('beach_kit');
const FLAG_COL = { green: '#2e9e4f', yellow: '#f2c41d', red: '#d63a2f' };

function Ground() {
  const geo = useMemo(() => {
    const p = new Part();
    // hills on both sides and behind the station
    for (const [x, z, r, h, c] of [
      [-100, -485, 44, 26, '#7cae5a'],
      [100, -490, 44, 24, '#86b863'],
      [-95, -425, 40, 20, '#8fbf6a'],
      [92, -428, 40, 18, '#7cae5a'],
      [0, -398, 45, 14, '#93c26e'],
    ] as [number, number, number, number, string][])
      p.add(cyl(0, r, h, 9), c, { p: [x, h / 2 - 2, z] });
    // the railway behind the platform
    p.add(box(120, 0.2, 3.2), '#8d8577', { p: [0, 0.1, -449] });
    for (let x = -60; x < 60; x += 1.2) p.add(box(0.25, 0.1, 2.4), '#5d4a3a', { p: [x, 0.25, -449] });
    for (const dz of [-0.75, 0.75]) p.add(box(120, 0.1, 0.08), '#9aa5ab', { p: [0, 0.35, -449 + dz] });
    // platform and promenade
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.6, PLATFORM.z1 - PLATFORM.z0), '#c9c3b6', { p: [0, 0.3 - 0.6, (PLATFORM.z0 + PLATFORM.z1) / 2] });
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.02, 0.25), '#f2c94c', { p: [0, 0.01, PLATFORM.z1 - 0.3] });
    p.add(box(BAY.maxX - BAY.minX, 0.02, 6), '#d9cbb0', { p: [0, 0.005, -461] });
    // the sea wall along the promenade
    p.add(box(BAY.maxX - BAY.minX, 0.5, 0.4), '#e8e2d4', { p: [0, 0.25, -464.2] });
    return p.build();
  }, []);
  return (
    <group>
      <mesh position={[0, -0.02, -490]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[220, 120]} />
        <meshStandardMaterial color="#ecd9a8" roughness={1} />
      </mesh>
      {/* wet sand by the water, then the sea */}
      <mesh position={[0, -0.01, SHORE_Z + 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[220, 5]} />
        <meshStandardMaterial color="#cdb47e" roughness={1} />
      </mesh>
      <Sea />
      <mesh geometry={geo} material={chibiMaterial()} receiveShadow />
    </group>
  );
}

function Sea() {
  const foam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (foam.current) foam.current.position.z = SHORE_Z - 0.4 + Math.sin(clock.elapsedTime * 0.8) * 0.5;
  });
  return (
    <group>
      <mesh position={[0, 0.12, SHORE_Z - 120]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[400, 240]} />
        <meshStandardMaterial color="#2f8fd1" roughness={0.25} metalness={0.1} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 0.13, SHORE_Z - 12]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[400, 22]} />
        <meshStandardMaterial color="#5ec4e6" roughness={0.3} transparent opacity={0.7} />
      </mesh>
      <mesh ref={foam} position={[0, 0.14, SHORE_Z - 0.4]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[220, 0.6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function Props() {
  const kit = useLpmParts('beach_kit');
  const castles = useBeach((s) => s.castlesBuilt);
  const flag = useRef<THREE.Mesh>(null);
  const flagMat = useMemo(() => new THREE.MeshStandardMaterial({ color: FLAG_COL.green, side: THREE.DoubleSide }), []);
  const acc = useRef(1);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.25;
    if (acc.current < 1) return;
    acc.current = 0;
    flagMat.color.set(FLAG_COL[flagAt(serverNow())]);
  });
  const m = (name: string) => kit[name]!;
  const mat = chibiMaterial();
  return (
    <group>
      <mesh geometry={m('SM_BC_Shelter')} material={mat} position={[SHELTER.x, 0, SHELTER.z]} rotation-y={Math.PI} castShadow />
      <Text position={[SHELTER.x, 2.2, SHELTER.z - 1.25]} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle">
        SUNNY BAY
      </Text>
      <mesh geometry={m('SM_BC_Kiosk')} material={mat} position={[KIOSK.x, 0, KIOSK.z]} rotation-y={Math.PI} castShadow />
      <Text position={[KIOSK.x, 2.72, KIOSK.z - 1.0]} rotation-y={Math.PI} fontSize={0.22} color="#e65100" anchorX="center" anchorY="middle">
        ICE CREAM · $3
      </Text>
      <group position={[TOWER.x, 0, TOWER.z]} rotation-y={Math.PI}>
        <mesh geometry={m('SM_BC_Tower')} material={mat} castShadow />
        <mesh ref={flag} position={[0.85, 4.15, -0.85]} material={flagMat}>
          <planeGeometry args={[0.7, 0.45]} />
        </mesh>
      </group>
      <Text position={[TOWER.x + 2.6, 1.6, TOWER.z + 1.75]} fontSize={0.2} color="#1d3f8a" anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#ffffff">
        {'🟩 Swim · 🟨 Careful · 🟥 No swimming'}
      </Text>
      {PALMS.map(([x, z, r], i) => (
        <mesh key={`p${i}`} geometry={m('SM_BC_Palm')} material={mat} position={[x, 0, z]} rotation-y={r} castShadow />
      ))}
      {UMBRELLAS.map((u, i) => (
        <group key={`u${i}`} position={[u.x, 0, u.z]}>
          <mesh geometry={m('SM_BC_Umbrella')} material={mat} castShadow />
          <mesh geometry={m('SM_BC_Towel')} material={mat} position={[0.4, 0.01, -0.3]} rotation-y={u.towel} />
          {u.chair ? <mesh geometry={m('SM_BC_Deckchair')} material={mat} position={[1.2, 0, -0.4]} rotation-y={Math.PI} /> : null}
        </group>
      ))}
      {ROCKS.map((r, i) => (
        <mesh key={`r${i}`} geometry={m('SM_BC_Rock')} material={mat} position={[r.x, 0, r.z]} scale={r.s} rotation-y={i} castShadow />
      ))}
      {castles > 0 ? <mesh geometry={m('SM_BC_Castle')} material={mat} position={[CASTLE_SPOT.x, 0, CASTLE_SPOT.z - 1]} /> : null}
    </group>
  );
}

/** Things on the beach hunt list, bobbing where they lie (only those not found yet). */
function Finds() {
  const hunt = useBeach((s) => s.hunt);
  const t = useT();
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current) g.current.children.forEach((c, i) => (c.position.y = 0.6 + Math.sin(clock.elapsedTime * 2 + i) * 0.12));
  });
  const todo = FINDS.filter((f) => hunt && hunt.list.includes(f.id) && !hunt.found.includes(f.id));
  for (const f of FINDS) {
    const on = !!hunt && hunt.list.includes(f.id) && !hunt.found.includes(f.id);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable(on ? { id: `beach-find-${f.id}`, x: f.x, z: f.z, r: 1.6, icon: f.icon, label: `${t('Pick up')}: ${f.en}`, priority: true, use: () => useBeach.getState().find(f.id) } : null);
  }
  return (
    <group ref={g}>
      {todo.map((f) => (
        <Text key={f.id} position={[f.x, 0.6, f.z]} fontSize={0.6} anchorX="center" anchorY="middle">
          {f.icon}
        </Text>
      ))}
    </group>
  );
}

function Usables() {
  const t = useT();
  const riding = useTrain((s) => !!s.ride);
  useUsable(riding ? null : { id: 'beach-train', x: 0, z: PLATFORM.z0 - 0.6, r: 3.5, icon: '🚆', label: t('Train to English Street Central'), priority: true, use: () => useTrain.getState().startReturn() });
  useUsable({ id: 'beach-kiosk', x: KIOSK_SPOT.x, z: KIOSK_SPOT.z, r: 1.8, icon: '🍦', label: t('Buy an ice cream'), priority: true, use: () => useBeach.getState().openKiosk() });
  useUsable({ id: 'beach-hunt', x: TOWER.x + 2.6, z: TOWER.z + 2.2, r: 1.6, icon: '🔎', label: t('Beach hunt (Kai)'), use: () => useBeach.getState().startHunt() });
  useUsable({ id: 'beach-castle', x: CASTLE_SPOT.x, z: CASTLE_SPOT.z, r: 1.6, icon: '🏰', label: t('Build a sandcastle'), use: () => useBeach.getState().startCastle() });
  return null;
}

export default function SunnyBay() {
  const [near, setNear] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.5) return;
    acc.current = 0;
    const n = inRect(BAY, localPos.x, localPos.z, 40);
    if (n !== near) setNear(n);
    if (n) swimTick(inRect(SEA_SWIM, localPos.x, localPos.z));
  });
  if (!near) return null;
  return (
    <group>
      <Ground />
      <Props />
      <Finds />
      <Usables />
    </group>
  );
}
