import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { BOAT_AREA, PIERS, WATER_Y, ferryPose, type BoatKind } from '@es/shared';
import { boatStates, getRoom, serverNow } from '../net/client';
import { boatSay, pierDistance, rowing, useBoats } from '../store/boats';
import { useLpmParts } from './LpmModel';
import { chibiMaterial } from './chibi/buildChibi';
import { localPos } from './LocalPlayer';
import { registerUsable, unregisterUsable, useNearUsable, useUsable, type Usable } from '../world/usables';
import { KIOSK, KIOSK_SPOT } from '../world/places/river';
import { FISH_SPOTS, useFishing } from '../store/fishing';
import { t } from '../i18n';

/**
 * The river you can use: two hire piers with rowing boats and duck pedalos (synced by the game server), the boat-hire
 * kiosk, buoys round the boating area, and the ferry between the ferry piers on its timetable (shared clock).
 * LPM asset: assets-src/lpm/recipes/river_kit.py. Logic: store/boats.ts.
 */
const mat = () => chibiMaterial();

/** A usable whose position follows something every frame (registered once, moved in place). */
function useMovingUsable(make: () => Usable | null, deps: unknown[], follow: (u: Usable) => void) {
  const u = useMemo(make, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!u) return;
    registerUsable(u);
    return () => {
      unregisterUsable(u.id);
      if (useNearUsable.getState().near?.id === u.id) useNearUsable.setState({ near: null });
    };
  }, [u]);
  useFrame(() => {
    if (u) follow(u);
  });
}

function Piers() {
  const parts = useLpmParts('river_kit');
  return (
    <group>
      {Object.values(PIERS).map((p) => {
        const bankZ = p.out > 0 ? p.minZ : p.maxZ;
        const len = p.maxZ - p.minZ;
        // the asset is 5 m long towards three +z; shorter piers are squashed a little, south piers turned round
        return <mesh key={p.id} geometry={parts['SM_RV_Pier']!} material={mat()} position={[p.x, 0.0, bankZ]} rotation-y={p.out > 0 ? 0 : Math.PI} scale={[1, 1, len / 5]} receiveShadow castShadow />;
      })}
      {/* buoys at the corners of the boating area */}
      {[BOAT_AREA.minX, BOAT_AREA.maxX].flatMap((x) => [20.5, 35.5].map((z) => <mesh key={`${x}:${z}`} geometry={parts['SM_RV_Buoy']!} material={mat()} position={[x, WATER_Y, z]} />))}
    </group>
  );
}

function Kiosk() {
  const parts = useLpmParts('river_kit');
  useUsable({ id: 'boat-kiosk', x: KIOSK_SPOT.x, z: KIOSK_SPOT.z, r: 1.6, icon: '🚣', label: t('Talk to the boat keeper'), use: () => useBoats.getState().open('hire') });
  return (
    <group position={[KIOSK.x, 0, KIOSK.z]} rotation-y={KIOSK.rot}>
      <mesh geometry={parts['SM_RV_Kiosk']!} material={mat()} castShadow receiveShadow />
      <Text position={[0, 2.47, 0.87]} fontSize={0.22} color="#ffffff" anchorX="center" anchorY="middle">
        BOAT HIRE
      </Text>
      <Text position={[0, 1.75, 0.82]} fontSize={0.12} color="#2a2230" anchorX="center" anchorY="middle" maxWidth={1.8} textAlign="center">
        {'Rowing boats & duck boats\n3 coins / 10 minutes'}
      </Text>
    </group>
  );
}

const OAR_LOCK = { x: 0.62, y: 0.36, z: 0.1 };

/** One hired boat: follows the server pose (my own boat: the local prediction), bobs, rows. */
function HireBoat({ id }: { id: string }) {
  const parts = useLpmParts('river_kit');
  const ref = useRef<THREE.Group>(null);
  const oarL = useRef<THREE.Mesh>(null);
  const oarR = useRef<THREE.Mesh>(null);
  const wake = useRef<THREE.Mesh>(null);
  const pos = useRef({ x: 0, z: 0, rot: 0, init: false, px: 0, pz: 0, speed: 0, phase: 0 });
  const kind: BoatKind = boatStates.get(id)?.kind === 'duck' ? 'duck' : 'row';
  useFrame((_, dt) => {
    const g = ref.current;
    const b = boatStates.get(id);
    if (!g || !b) return;
    const p = pos.current;
    const mine = b.driver && b.driver === getRoom()?.sessionId;
    if (!p.init || mine || Math.hypot(b.x - p.x, b.z - p.z) > 5) {
      Object.assign(p, { x: b.x, z: b.z, rot: b.rot, init: true });
    } else {
      const k = Math.min(1, dt * 8);
      p.x += (b.x - p.x) * k;
      p.z += (b.z - p.z) * k;
      let dr = b.rot - p.rot;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      p.rot += dr * k;
    }
    const sp = Math.hypot(p.x - p.px, p.z - p.pz) / Math.max(dt, 1e-3);
    p.px = p.x;
    p.pz = p.z;
    p.speed += (sp - p.speed) * Math.min(1, dt * 4);
    const time = performance.now() / 1000;
    g.position.set(p.x, WATER_Y + Math.sin(time * 1.7 + p.x) * 0.025, p.z);
    g.rotation.set(Math.sin(time * 1.3 + p.z) * 0.02, p.rot, Math.sin(time * 1.1 + p.x) * 0.025);
    // oars: a stroke cycle while moving (my boat: from my input)
    if (oarL.current && oarR.current) {
      const power = mine ? rowing.power : Math.min(1, p.speed / 1.5);
      p.phase = mine ? rowing.phase : p.phase + dt * 2.2 * (power > 0.08 ? 1 : 0);
      const a = power > 0.05 ? Math.sin(p.phase * Math.PI * 2) * 0.6 * Math.min(1, power * 2) : 0;
      const dip = power > 0.05 ? Math.cos(p.phase * Math.PI * 2) * 0.12 : 0;
      // blades below the oarlocks (the right oar is mirrored, so its tilt has the other sign)
      oarR.current.rotation.set(0, a, 0.32 - dip);
      oarL.current.rotation.set(0, -a, -0.32 + dip);
    }
    if (wake.current) {
      const s = Math.min(1, p.speed / 1.5);
      wake.current.visible = s > 0.1;
      wake.current.scale.setScalar(0.8 + 0.4 * ((time * 1.5) % 1));
      (wake.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * s * (1 - ((time * 1.5) % 1));
    }
  });
  return (
    <group ref={ref}>
      <mesh geometry={parts[kind === 'duck' ? 'SM_RV_DuckBoat' : 'SM_RV_Rowboat']!} material={mat()} castShadow />
      {kind === 'row' ? (
        <>
          <mesh ref={oarR} geometry={parts['SM_RV_Oar']!} material={mat()} position={[-OAR_LOCK.x, OAR_LOCK.y, OAR_LOCK.z]} scale={[-1, 1, 1]} />
          <mesh ref={oarL} geometry={parts['SM_RV_Oar']!} material={mat()} position={[OAR_LOCK.x, OAR_LOCK.y, OAR_LOCK.z]} />
        </>
      ) : null}
      <mesh ref={wake} rotation-x={-Math.PI / 2} position={[0, 0.03, -1.5]}>
        <ringGeometry args={[0.5, 0.75, 20]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** "Row this boat" / "Get in as a passenger" for the boat nearest to you (when you are on foot). */
function BoardAction({ id }: { id: string }) {
  const seat = useBoats((s) => s.seats[id]);
  const mine = useBoats((s) => s.mine);
  const ferry = useBoats((s) => s.ferry);
  const hired = useBoats((s) => s.until > Date.now());
  const kind = boatStates.get(id)?.kind === 'duck' ? 'duck' : 'row';
  const label = !seat || mine || ferry ? null : !seat.driver ? (kind === 'duck' ? t('Pedal this duck boat') : t('Row this boat')) : !seat.passenger ? t('Get in as a passenger') : null;
  useMovingUsable(
    () =>
      label
        ? {
            id: `boat-${id}`,
            x: 0,
            z: -1e4,
            r: 2.6,
            icon: kind === 'duck' ? '🦆' : '🚣',
            label,
            disabled: !seat?.driver && !hired ? t('Hire a boat at the kiosk first') : undefined,
            use: () => useBoats.getState().board(id, seat?.driver ? 'passenger' : 'driver'),
          }
        : null,
    [label, hired, id],
    (u) => {
      const b = boatStates.get(id);
      if (!b) return;
      u.x = b.x;
      u.z = b.z;
    },
  );
  return null;
}

/** In a boat next to a pier: "Get out". */
function LeaveAction() {
  const mine = useBoats((s) => s.mine);
  useMovingUsable(
    () => (mine ? { id: 'boat-leave', x: 0, z: -1e4, r: 0.8, icon: '🛟', label: t('Get out of the boat'), use: () => useBoats.getState().leave() } : null),
    [mine?.id],
    (u) => {
      // only offered close to a pier deck
      const near = pierDistance(localPos.x, localPos.z) < 2.4;
      u.x = near ? localPos.x : 0;
      u.z = near ? localPos.z : -1e4;
    },
  );
  return null;
}

/** The ferry, its timetable boards on both ferry piers and the "Board the ferry" action. */
function Ferry() {
  const parts = useLpmParts('river_kit');
  const ref = useRef<THREE.Group>(null);
  const said = useRef('');
  const [clock, setClock] = useState({ stage: 'north', leavesIn: 0 });
  const riding = useBoats((s) => !!s.ferry);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const f = ferryPose(serverNow());
    const time = performance.now() / 1000;
    g.position.set(f.x, WATER_Y + Math.sin(time * 1.2) * 0.03, f.z);
    g.rotation.set(Math.sin(time * 0.9) * 0.012, f.rot, Math.sin(time * 1.1) * 0.015);
    const sec = Math.ceil(f.leavesIn);
    if (sec !== clock.leavesIn || f.stage !== clock.stage) setClock({ stage: f.stage, leavesIn: sec });
    // announcements for people waiting at the pier (or already on board)
    const dock = f.stage === 'north' ? PIERS.ferryN : f.stage === 'south' ? PIERS.ferryS : null;
    if (dock && (riding || Math.hypot(localPos.x - dock.x, localPos.z - dock.tipZ) < 18)) {
      const key = `${f.stage}:${sec <= 10 ? 10 : sec <= 25 ? 25 : 0}`;
      if ((sec === 25 || sec === 10) && said.current !== key) {
        said.current = key;
        boatSay(`The ferry to the ${f.stage === 'north' ? 'south' : 'north'} bank leaves in ${sec} seconds.`);
      }
    }
  });
  const docked = clock.stage === 'north' || clock.stage === 'south';
  const dock = clock.stage === 'north' ? PIERS.ferryN : PIERS.ferryS;
  useUsable(
    docked && !riding
      ? { id: 'ferry-board', x: dock.x, z: dock.tipZ - dock.out * 0.9, r: 2, icon: '⛴️', label: t('Board the ferry ({s} s)', { s: clock.leavesIn }), use: () => useBoats.getState().boardFerry() }
      : null,
  );
  return (
    <>
      <group ref={ref}>
        <mesh geometry={parts['SM_RV_Ferry']!} material={mat()} castShadow receiveShadow />
      </group>
      {[PIERS.ferryN, PIERS.ferryS].map((p) => {
        const here = (p === PIERS.ferryN && clock.stage === 'north') || (p === PIERS.ferryS && clock.stage === 'south');
        const bankZ = p.out > 0 ? p.minZ : p.maxZ;
        const txt = here ? `Leaves in ${Math.floor(clock.leavesIn / 60)}:${String(clock.leavesIn % 60).padStart(2, '0')}` : 'Ferry on its way';
        return (
          <group key={p.id} position={[p.x + 1.7, 0, bankZ - p.out * 0.6]} rotation-y={p.out > 0 ? Math.PI : 0}>
            <mesh position={[0, 0.8, 0]}>
              <boxGeometry args={[0.08, 1.6, 0.08]} />
              <meshStandardMaterial color="#3d4452" />
            </mesh>
            <mesh position={[0, 1.75, 0]}>
              <boxGeometry args={[1.3, 0.7, 0.06]} />
              <meshStandardMaterial color="#1f5fb8" />
            </mesh>
            <Text position={[0, 1.9, 0.04]} fontSize={0.16} color="#ffffff" anchorX="center" anchorY="middle">
              {`FERRY · ${p === PIERS.ferryN ? 'to South Bank' : 'to North Bank'}`}
            </Text>
            <Text position={[0, 1.62, 0.04]} fontSize={0.15} color="#f6c945" anchorX="center" anchorY="middle">
              {txt}
            </Text>
          </group>
        );
      })}
    </>
  );
}

/** Fishing at the end of the hire piers: the action, and a float bobbing on the water (it dips on a bite). */
function FishingSpot({ spot }: { spot: (typeof FISH_SPOTS)[number] }) {
  const mineHere = useFishing((s) => s.spot === spot.id);
  const phase = useFishing((s) => (s.spot === spot.id ? s.phase : 'idle'));
  const boat = useBoats((s) => !!s.mine || !!s.ferry);
  const float = useRef<THREE.Mesh>(null);
  const fishing = mineHere && (phase === 'waiting' || phase === 'bite');
  useUsable(
    boat
      ? null
      : {
          id: `fish-${spot.id}`,
          x: spot.x,
          z: spot.z,
          r: 1.0,
          icon: fishing ? '🎣' : '🐟',
          label: fishing ? t('Pull!') : t('Go fishing'),
          use: () => (fishing ? useFishing.getState().reel() : useFishing.getState().cast(spot.id)),
        },
  );
  useFrame(() => {
    const m = float.current;
    if (!m) return;
    m.visible = fishing;
    if (!fishing) return;
    const time = performance.now() / 1000;
    m.position.set(spot.x + Math.sin(time * 0.7) * 0.1, WATER_Y + 0.04 + (phase === 'bite' ? -0.09 + Math.sin(time * 18) * 0.05 : Math.sin(time * 2.2) * 0.02), spot.bobZ);
    // walked away from the spot: stop fishing
    if (Math.hypot(localPos.x - spot.x, localPos.z - spot.z) > 3) useFishing.getState().stop();
  });
  return (
    <mesh ref={float} visible={false}>
      <sphereGeometry args={[0.07, 8, 6]} />
      <meshStandardMaterial color="#e05a47" />
    </mesh>
  );
}

export default function River() {
  const ids = useBoats((s) => Object.keys(s.seats).sort().join(','));
  const list = ids ? ids.split(',') : [];
  return (
    <group>
      <Piers />
      <Kiosk />
      {list.map((id) => (
        <group key={id}>
          <HireBoat id={id} />
          <BoardAction id={id} />
        </group>
      ))}
      <LeaveAction />
      <Ferry />
      {FISH_SPOTS.map((f) => (
        <FishingSpot key={f.id} spot={f} />
      ))}
    </group>
  );
}

