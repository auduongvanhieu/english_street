import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { inRect } from '@es/shared';
import { localPos } from '../../LocalPlayer';
import { LpmModel, preloadLpm, useLpmParts } from '../../LpmModel';
import { Part, box, chibiMaterial } from '../../chibi/buildChibi';
import { BENCH, BOAT, BRIDGE, COTTAGES, LIST_BOARD, LOST_BOARD, MILL, MILL_POND, PARASOLS, PLATFORM, POST_BOX, RIVER, SHELTER, SPOTS, STALLS, VILLAGE, WHEEL, WILLOWS, stallFront } from '../../../world/riverside';
import { LOST_THINGS, useRiverside } from '../../../store/riverside';
import { useTrain } from '../../../store/train';
import { useMyFarm } from '../../../store/myFarm';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';

/**
 * Riverside village, reached by train (world/riverside.ts): the market square with five stalls, the river path,
 * the river with a stone bridge, ducks and a rowing boat, and the water mill. Props: LPM riverside_kit (+ willow,
 * river_kit's rowing boat).
 */
preloadLpm('riverside_kit');

function Ground() {
  const geo = useMemo(() => {
    const p = new Part();
    // railway behind the platform, the platform
    p.add(box(140, 0.2, 3.2), '#8d8577', { p: [0, 0.1, -657.5] });
    for (let x = -70; x < 70; x += 1.2) p.add(box(0.25, 0.1, 2.4), '#5d4a3a', { p: [x, 0.25, -657.5] });
    for (const dz of [-0.75, 0.75]) p.add(box(140, 0.1, 0.08), '#9aa5ab', { p: [0, 0.35, -657.5 + dz] });
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.6, PLATFORM.z1 - PLATFORM.z0 + 1.6), '#c9c3b6', { p: [0, -0.3, (PLATFORM.z0 + PLATFORM.z1) / 2 + 0.8] });
    p.add(box(PLATFORM.x1 - PLATFORM.x0, 0.02, 0.25), '#f2c94c', { p: [0, 0.01, PLATFORM.z1 + 0.8] });
    // market square (paving) and the path down to the river
    p.add(box(34, 0.02, 34), '#cdbfa6', { p: [0, 0.01, -690] });
    p.add(box(4, 0.02, 22), '#cdbfa6', { p: [0, 0.01, -718] });
    p.add(box(120, 0.02, 4), '#c4b393', { p: [0, 0.012, RIVER.z1 + 3] });
    // river banks (stone edges)
    for (const z of [RIVER.z1, RIVER.z0]) p.add(box(140, 0.3, 0.5), '#9b9488', { p: [0, 0.05, z] });
    // hills far away
    return p.build();
  }, []);
  return (
    <group>
      <mesh position={[0, -0.02, -715]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[220, 150]} />
        <meshStandardMaterial color="#86b862" roughness={1} />
      </mesh>
      <mesh geometry={geo} material={chibiMaterial()} receiveShadow />
      <Water />
    </group>
  );
}

function Water() {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  return (
    <group>
      <mesh position={[0, 0.03, (RIVER.z0 + RIVER.z1) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[220, RIVER.z1 - RIVER.z0]} />
        <meshStandardMaterial ref={ref} color="#4f9fd6" roughness={0.2} metalness={0.1} />
      </mesh>
      <mesh position={[(MILL_POND.minX + MILL_POND.maxX) / 2, 0.035, (MILL_POND.minZ + MILL_POND.maxZ) / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[MILL_POND.maxX - MILL_POND.minX, MILL_POND.maxZ - MILL_POND.minZ]} />
        <meshStandardMaterial color="#4f9fd6" roughness={0.2} />
      </mesh>
    </group>
  );
}

function Ducks() {
  const kit = useLpmParts('riverside_kit');
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    g.current?.children.forEach((d, i) => {
      const a = t * (0.05 + i * 0.012) + i * 1.7;
      d.position.set(Math.sin(a) * (30 + i * 4), 0.04 + Math.sin(t * 2 + i) * 0.02, (RIVER.z0 + RIVER.z1) / 2 + Math.sin(a * 2.3 + i) * 3);
      d.rotation.y = Math.cos(a) > 0 ? Math.PI / 2 : -Math.PI / 2;
    });
  });
  return (
    <group ref={g}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={kit['SM_RS_Duck']!} material={chibiMaterial()} scale={1.4} />
      ))}
    </group>
  );
}

function Props() {
  const kit = useLpmParts('riverside_kit');
  const river = useLpmParts('river_kit');
  const m = (n: string) => kit[n]!;
  const mat = chibiMaterial();
  const wheel = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.x -= dt * 0.6;
  });
  return (
    <group>
      <mesh geometry={m('SM_RS_Shelter')} material={mat} position={[SHELTER.x, 0, SHELTER.z]} rotation-y={Math.PI} castShadow />
      <Text position={[SHELTER.x, 2.2, SHELTER.z - 1.25]} rotation-y={Math.PI} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle">
        RIVERSIDE
      </Text>
      {STALLS.map((s) => (
        <group key={s.id} position={[s.x, 0, s.z]} rotation-y={s.rot}>
          <mesh geometry={m(s.green ? 'SM_RS_StallGreen' : 'SM_RS_StallRed')} material={mat} castShadow />
          <Text position={[0, 2.75, 1.09]} fontSize={0.24} color="#4a2f14" anchorX="center" anchorY="middle">
            {s.name}
          </Text>
          <mesh geometry={m('SM_RS_Crates')} material={mat} position={[1.9, 0, 0.3]} />
        </group>
      ))}
      <mesh geometry={m('SM_RS_Mill')} material={mat} position={[MILL.x, 0, MILL.z]} castShadow receiveShadow />
      <Text position={[MILL.x, 3.6, MILL.z + 2.56]} fontSize={0.3} color="#5a3a1a" anchorX="center" anchorY="middle">
        THE OLD MILL
      </Text>
      <mesh ref={wheel} geometry={m('SM_RS_Wheel')} material={mat} position={[WHEEL.x, WHEEL.y, WHEEL.z]} castShadow />
      <mesh geometry={m('SM_RS_Bridge')} material={mat} position={[BRIDGE.x, 0, BRIDGE.z]} castShadow receiveShadow />
      <mesh geometry={m('SM_RS_Bench')} material={mat} position={[BENCH.x, 0, BENCH.z]} rotation-y={Math.PI} />
      <mesh geometry={m('SM_RS_PostBox')} material={mat} position={[POST_BOX.x, 0, POST_BOX.z]} castShadow />
      {PARASOLS.map(([x, z], i) => (
        <mesh key={i} geometry={m('SM_RS_Parasol')} material={mat} position={[x, 0, z]} castShadow />
      ))}
      {COTTAGES.map((c, i) => (
        <mesh key={i} geometry={m('SM_RS_Cottage')} material={mat} position={[c.x, 0, c.z]} rotation-y={c.rot} castShadow receiveShadow />
      ))}
      {river['SM_RV_Rowboat'] ? <mesh geometry={river['SM_RV_Rowboat']} material={mat} position={[BOAT.x, 0.05, BOAT.z]} rotation-y={Math.PI / 2} /> : null}
      {WILLOWS.map(([x, z], i) => (
        <LpmModel key={i} slug="willow" position={[x, 0, z]} scale={2.2} rotation-y={i} />
      ))}
      <Board x={LIST_BOARD.x} z={LIST_BOARD.z} text={"RUBY'S MARKET\n📝 Get a shopping list"} />
      <Board x={0} z={-687.8} text={'FARMERS WELCOME\n🧺 Sell your produce here'} />
      <Board x={LOST_BOARD.x} z={LOST_BOARD.z} text={'LOST! 😢\nCan you help Lily?'} />
    </group>
  );
}

function Board({ x, z, text }: { x: number; z: number; text: string }) {
  return (
    <group position={[x, 0, z]}>
      {[-0.6, 0.6].map((dx) => (
        <mesh key={dx} position={[dx, 0.8, 0]}>
          <boxGeometry args={[0.08, 1.6, 0.08]} />
          <meshStandardMaterial color="#6e4a26" />
        </mesh>
      ))}
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[1.5, 0.75, 0.06]} />
        <meshStandardMaterial color="#f3e3c3" />
      </mesh>
      <Text position={[0, 1.45, 0.04]} fontSize={0.15} lineHeight={1.3} color="#3e2a14" anchorX="center" anchorY="middle" textAlign="center">
        {text}
      </Text>
    </group>
  );
}

/** The thing Lily lost, shown once found (at its spot) for a moment. */
function Found() {
  const lost = useRiverside((s) => s.lost);
  if (!lost || lost.round === 0) return null;
  const prev = lost.order[lost.round - 1]!;
  const s = SPOTS.find((x) => x.id === prev.spot)!;
  return (
    <Text position={[s.x, 0.8, s.z]} fontSize={0.6} anchorX="center" anchorY="middle">
      {LOST_THINGS[prev.thing]!.icon}
    </Text>
  );
}

function Usables() {
  const t = useT();
  const riding = useTrain((s) => !!s.ride);
  const searching = useRiverside((s) => !!s.lost && !s.lost.done);
  useUsable(riding ? null : { id: 'riv-train', x: 0, z: PLATFORM.z0 - 0.6, r: 3.5, icon: '🚆', label: t('Train to English Street Central'), priority: true, use: () => useTrain.getState().startReturn('Riverside') });
  useUsable({ id: 'riv-list', x: LIST_BOARD.x, z: LIST_BOARD.z + 1.1, r: 1.6, icon: '📝', label: t('Get a shopping list'), priority: true, use: () => useRiverside.getState().takeList() });
  // the farmers' market: sell what your own farm grew (better prices than the farm's bin)
  useUsable({
    id: 'riv-farmsell',
    x: 0,
    z: -686.6,
    r: 1.8,
    icon: '🧺',
    label: t('Sell my farm produce here (+20%)'),
    priority: true,
    use: async () => {
      const f = useMyFarm.getState();
      await f.load();
      await f.act({ action: 'sell', market: true });
    },
  });
  useUsable({ id: 'riv-lost', x: LOST_BOARD.x, z: LOST_BOARD.z + 1.1, r: 1.6, icon: '🧒', label: t('Help Lily'), priority: true, use: () => useRiverside.getState().startLost() });
  for (const s of STALLS) {
    const f = stallFront(s);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable({ id: `riv-stall-${s.id}`, x: f.x, z: f.z, r: 1.8, icon: '🛒', label: `${t('Buy')}: ${s.name}`, priority: true, use: () => useRiverside.getState().openStall(s.id) });
  }
  for (const s of SPOTS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable(searching ? { id: `riv-spot-${s.id}`, x: s.x, z: s.z, r: 1.6, icon: '🔍', label: `${t('Look here')}: ${s.en}`, priority: true, use: () => useRiverside.getState().look(s.id) } : null);
  }
  return null;
}

export default function Riverside() {
  const [near, setNear] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.5) return;
    acc.current = 0;
    const n = inRect(VILLAGE, localPos.x, localPos.z, 40);
    if (n !== near) setNear(n);
  });
  if (!near) return null;
  return (
    <group>
      <Ground />
      <Props />
      <Ducks />
      <Found />
      <Usables />
    </group>
  );
}
