import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { inRect } from '@es/shared';
import { localPos } from '../../LocalPlayer';
import { LpmModel, preloadLpm, useLpmParts } from '../../LpmModel';
import { Part, box, chibiMaterial } from '../../chibi/buildChibi';
import { sky } from '../../../world/sky';
import { BENCHES, CLOCK_FACE, EXHIBITS, FOUNTAIN, HOUSES, LANTERNS, MUSEUM, PLATFORM, SHELTER, TOWER, TOWN, exhibitSpot, inMuseum } from '../../../world/oldTown';
import { useOldTown } from '../../../store/oldTown';
import { useTrain } from '../../../store/train';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';

/**
 * Old Town, reached by train (world/oldTown.ts): a cobbled square with a fountain and the clock tower (its hands show
 * the game time, or the time of the clock quiz), townhouses on both sides, and the museum with six exhibits.
 * Props: LPM oldtown_kit (+ fountain, lantern_post).
 */
preloadLpm('oldtown_kit');

function Ground() {
  const geo = useMemo(() => {
    const p = new Part();
    p.add(box(140, 0.2, 3.2), '#8d8577', { p: [0, 0.1, -797.5] });
    for (let x = -70; x < 70; x += 1.2) p.add(box(0.25, 0.1, 2.4), '#5d4a3a', { p: [x, 0.25, -797.5] });
    for (const dz of [-0.75, 0.75]) p.add(box(140, 0.1, 0.08), '#9aa5ab', { p: [0, 0.35, -797.5 + dz] });
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.6, PLATFORM.z1 - PLATFORM.z0 + 1.6), '#c9c3b6', { p: [0, -0.3, (PLATFORM.z0 + PLATFORM.z1) / 2 + 0.8] });
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.02, 0.25), '#f2c94c', { p: [0, 0.01, PLATFORM.z1 + 0.8] });
    // cobbles: a checker of two stone colours over the square and the street to the museum
    for (let x = -22; x < 22; x += 2)
      for (let z = -810; z > -868; z -= 2) p.add(box(1.96, 0.02, 1.96), (Math.round(x / 2) + Math.round(z / 2)) % 2 ? '#b9ad9a' : '#a99d89', { p: [x + 1, 0.01, z - 1] });
    return p.build();
  }, []);
  return (
    <group>
      <mesh position={[0, -0.02, -855]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[220, 150]} />
        <meshStandardMaterial color="#8fae6a" roughness={1} />
      </mesh>
      <mesh geometry={geo} material={chibiMaterial()} receiveShadow />
    </group>
  );
}

/** Clock hands on the tower: the game time, or the quiz time while the clock quiz is on. */
function ClockHands() {
  const hour = useRef<THREE.Group>(null);
  const minute = useRef<THREE.Group>(null);
  useFrame(() => {
    const c = useOldTown.getState().clock;
    const h = c ? c.h + c.m / 60 : sky.hour;
    const m = c ? c.m : (sky.hour % 1) * 60;
    if (hour.current) hour.current.rotation.z = -((h % 12) / 12) * Math.PI * 2;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
  });
  return (
    <group position={[CLOCK_FACE.x, CLOCK_FACE.y, CLOCK_FACE.z]}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => (
        <mesh key={k} position={[Math.sin((k / 12) * Math.PI * 2) * 1.05, Math.cos((k / 12) * Math.PI * 2) * 1.05, 0.01]}>
          <boxGeometry args={[k % 3 === 0 ? 0.1 : 0.06, k % 3 === 0 ? 0.22 : 0.12, 0.02]} />
          <meshBasicMaterial color="#2a2230" />
        </mesh>
      ))}
      <group ref={hour}>
        <mesh position={[0, 0.3, 0.03]}>
          <boxGeometry args={[0.1, 0.6, 0.02]} />
          <meshBasicMaterial color="#2a2230" />
        </mesh>
      </group>
      <group ref={minute}>
        <mesh position={[0, 0.45, 0.05]}>
          <boxGeometry args={[0.06, 0.9, 0.02]} />
          <meshBasicMaterial color="#2a2230" />
        </mesh>
      </group>
    </group>
  );
}

function Props() {
  const kit = useLpmParts('oldtown_kit');
  const m = (n: string) => kit[n]!;
  const mat = chibiMaterial();
  const [inside, setInside] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const i = inMuseum(localPos.x, localPos.z);
    if (i !== inside) setInside(i);
  });
  return (
    <group>
      <mesh geometry={m('SM_OT_Shelter')} material={mat} position={[SHELTER.x, 0, SHELTER.z]} rotation-y={Math.PI} castShadow />
      <Text position={[SHELTER.x, 2.2, SHELTER.z - 1.25]} rotation-y={Math.PI} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle">
        OLD TOWN
      </Text>
      <mesh geometry={m('SM_OT_ClockTower')} material={mat} position={[TOWER.x, 0, TOWER.z]} castShadow receiveShadow />
      <ClockHands />
      <LpmModel slug="fountain" position={[FOUNTAIN.x, 0, FOUNTAIN.z]} scale={1.3} />
      {HOUSES.map((h, i) => (
        <mesh key={i} geometry={m(h.b ? 'SM_OT_HouseB' : 'SM_OT_HouseA')} material={mat} position={[h.x, 0, h.z]} rotation-y={h.rot} castShadow receiveShadow />
      ))}
      {BENCHES.map((b, i) => (
        <mesh key={i} geometry={m('SM_OT_Bench')} material={mat} position={[b.x, 0, b.z]} rotation-y={b.rot} />
      ))}
      {LANTERNS.map(([x, z], i) => (
        <LpmModel key={i} slug="lantern_post" position={[x, 0, z]} scale={1.3} />
      ))}
      <mesh geometry={m('SM_OT_Museum')} material={mat} position={[MUSEUM.x, 0, MUSEUM.z]} castShadow receiveShadow />
      {/* the roof hides while you are inside (the camera looks in from above) */}
      <mesh geometry={m('SM_OT_MuseumRoof')} material={mat} position={[MUSEUM.x, 0, MUSEUM.z]} visible={!inside} castShadow />
      <Text position={[MUSEUM.x, 6.35, MUSEUM.z + MUSEUM.d / 2 + 2.52]} fontSize={0.5} color="#5a4a2a" anchorX="center" anchorY="middle">
        MUSEUM
      </Text>
      {EXHIBITS.map((e) => (
        <group key={e.id} position={[e.x, 0, e.z]}>
          {e.pedestal ? <mesh geometry={m('SM_OT_Pedestal')} material={mat} castShadow /> : null}
          <mesh geometry={m(e.model)} material={mat} position-y={e.pedestal ? 0.9 : 0} rotation-y={e.face * (Math.PI / 2)} scale={e.pedestal ? 1.4 : 1} castShadow />
          <Text position={[e.face * 0.9, 2.0, 0]} rotation-y={e.face * (Math.PI / 2)} fontSize={0.2} color="#3e2a14" outlineWidth={0.01} outlineColor="#fff6e0" anchorX="center" anchorY="middle">
            {e.title}
          </Text>
        </group>
      ))}
    </group>
  );
}

function Usables() {
  const t = useT();
  const riding = useTrain((s) => !!s.ride);
  useUsable(riding ? null : { id: 'ot-train', x: 0, z: PLATFORM.z0 - 0.6, r: 3.5, icon: '🚆', label: t('Train to English Street Central'), priority: true, use: () => useTrain.getState().startReturn('Old Town') });
  useUsable({ id: 'ot-clock', x: TOWER.x, z: TOWER.z + 3.4, r: 2, icon: '🕰️', label: t('What time is it?'), priority: true, use: () => useOldTown.getState().startClock() });
  for (const e of EXHIBITS) {
    const s = exhibitSpot(e);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable({ id: `ot-ex-${e.id}`, x: s.x, z: s.z, r: 1.5, icon: '🏛️', label: `${t('Read')}: ${e.title}`, priority: true, use: () => useOldTown.getState().openExhibit(e.id) });
  }
  return null;
}

export default function OldTown() {
  const [near, setNear] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.5) return;
    acc.current = 0;
    const n = inRect(TOWN, localPos.x, localPos.z, 40);
    if (n !== near) setNear(n);
  });
  if (!near) return null;
  return (
    <group>
      <Ground />
      <Props />
      <Usables />
    </group>
  );
}
