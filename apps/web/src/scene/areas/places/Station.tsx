import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { vnHour } from '@es/shared';
import { serverNow } from '../../../net/client';
import { useArea } from '../../../store/area';
import { useTrain } from '../../../store/train';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';
import { chibiMaterial } from '../../chibi/buildChibi';
import {
  AREA,
  BENCHES,
  BOARD,
  CLOCK,
  COUNTER,
  FRAME,
  PLATFORM1,
  PLATFORM2,
  STATION,
  TICKET_MACHINE,
  TRACK_Z,
  TUNNEL_X,
  boardRows,
  currentSlots,
  service,
  trainPose,
} from '../../../world/places/station';
import { BuildingShell } from '../Building';
import { AreaGroup, Ground, Merged, Part, box, cyl, sphere, tree } from '../kit';

const openActivity = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  useArea.getState().setPanel(true, 'activity');
};

const CAR_LEN = 5.6;
const CAR_GAP = 0.2;
const CAR_OFFSETS = [-(CAR_LEN + CAR_GAP), 0, CAR_LEN + CAR_GAP];

/** One carriage (front = true: the driver's cab with a sloped nose at +x). Doors are drawn separately. */
function carriage(p: Part, front: boolean, back: boolean) {
  const L = CAR_LEN;
  const body = '#eef2f4';
  p.add(box(L, 2.3, 2.4), body, { p: [0, 1.75, 0] });
  p.add(box(L + 0.02, 0.32, 2.42), '#c62828', { p: [0, 1.15, 0] }); // red stripe
  p.add(box(L - 0.2, 0.2, 2.2), '#9aa5ab', { p: [0, 3.0, 0] }); // roof
  p.add(box(L - 0.4, 0.5, 2.0), '#37474f', { p: [0, 0.48, 0] }); // underframe
  for (const x of [-L / 2 + 0.9, L / 2 - 0.9]) for (const z of [-0.85, 0.85]) p.add(cyl(0.34, 0.34, 0.2, 12), '#263238', { p: [x, 0.36, z], r: [Math.PI / 2, 0, 0] });
  // windows on both sides, between the doors
  for (const side of [-1, 1]) {
    for (const x of [-1.95, -0.65, 0.65, 1.95]) if (!(front && x > 1.5)) p.add(box(0.95, 0.7, 0.04), '#2b3a55', { p: [x, 2.05, side * 1.21] });
    for (const x of [-1.3, 1.3]) p.add(box(0.95, 1.75, 0.03), '#1d2633', { p: [x, 1.45, side * 1.205] }); // doorways (dark, behind the doors)
  }
  if (front) {
    p.add(box(0.9, 1.6, 2.3), body, { p: [L / 2 + 0.45, 1.4, 0] });
    p.add(box(0.9, 0.9, 2.2), '#2b3a55', { p: [L / 2 + 0.35, 2.3, 0], r: [0, 0, -0.55] }); // windscreen
    p.add(box(0.08, 0.32, 2.32), '#c62828', { p: [L / 2 + 0.9, 1.15, 0] });
    for (const z of [-0.7, 0.7]) p.add(sphere(0.12), '#fff6c2', { p: [L / 2 + 0.92, 0.95, z] });
  }
  if (back) for (const z of [-0.7, 0.7]) p.add(sphere(0.1), '#ff5252', { p: [-L / 2 - 0.02, 0.95, z] });
}

/** Sliding door panels of one carriage (both sides), moved together as one mesh. */
function doors(p: Part) {
  for (const side of [-1, 1]) for (const x of [-1.3, 1.3]) p.add(box(0.95, 1.75, 0.05), '#c62828', { p: [x, 1.45, side * 1.24] });
}

function useGeo(build: (p: Part) => void) {
  return useMemo(() => {
    const p = new Part();
    build(p);
    return p.build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** The shared-clock train: slides out of the west tunnel, stops with doors open, leaves through the east tunnel. */
function Train() {
  const geoFront = useGeo((p) => carriage(p, true, false));
  const geoMid = useGeo((p) => carriage(p, false, false));
  const geoBack = useGeo((p) => carriage(p, false, true));
  const geoDoors = useGeo(doors);
  const group = useRef<THREE.Group>(null);
  const cars = useRef<(THREE.Group | null)[]>([]);
  const doorRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const now = serverNow();
    const pose = currentSlots(now)
      .map((s) => trainPose(s, now))
      .find((p) => p.visible);
    g.visible = !!pose;
    if (!pose) return;
    g.position.set(pose.x, 0, pose.z);
    CAR_OFFSETS.forEach((off, i) => {
      const c = cars.current[i];
      // hidden once it is wholly inside a tunnel
      if (c) c.visible = Math.abs(pose.x + off) - CAR_LEN / 2 < TUNNEL_X;
      const d = doorRefs.current[i];
      if (d) d.position.x = pose.door * 0.5;
    });
  });
  const geos = [geoBack, geoMid, geoFront];
  return (
    <group ref={group} visible={false}>
      {CAR_OFFSETS.map((off, i) => (
        <group key={i} position={[off, 0, 0]} ref={(r) => void (cars.current[i] = r)}>
          <mesh geometry={geos[i]} material={chibiMaterial()} castShadow />
          <mesh geometry={geoDoors} material={chibiMaterial()} ref={(r) => void (doorRefs.current[i] = r)} />
        </group>
      ))}
    </group>
  );
}

/** Departures board in the forecourt: the next trains of the shared timetable, updated every second. */
function DeparturesBoard() {
  const [rows, setRows] = useState(() => boardRows(serverNow()));
  const [clock, setClock] = useState('');
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1) return;
    acc.current = 0;
    const now = serverNow();
    const r = boardRows(now);
    const h = vnHour(now);
    const c = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    if (c !== clock) setClock(c);
    if (JSON.stringify(r) !== JSON.stringify(rows)) setRows(r);
  });
  const { x, z, w, h } = BOARD;
  const top = 1.2 + h;
  const col = (cx: number, text: string, color: string, anchor: 'left' | 'center' = 'left') => (
    <Text position={[cx, top - 0.62, 0.15]} fontSize={0.25} lineHeight={1.45} color={color} anchorX={anchor} anchorY="top">
      {text}
    </Text>
  );
  return (
    <group position={[x, 0, z]} onClick={openActivity}>
      <Merged
        build={(p) => {
          for (const dx of [-w / 2 + 0.3, w / 2 - 0.3]) p.add(box(0.18, 1.3, 0.18), '#455a64', { p: [dx, 0.65, 0] });
          p.add(box(w + 0.24, h + 0.24, 0.2), '#37474f', { p: [0, 1.2 + h / 2, 0] });
          p.add(box(w, h, 0.05), '#10161c', { p: [0, 1.2 + h / 2, 0.1] });
          p.add(box(w, 0.02, 0.02), '#f2c94c', { p: [0, top - 0.5, 0.13] });
        }}
      />
      <Text position={[-w / 2 + 0.2, top - 0.25, 0.15]} fontSize={0.28} color="#f2c94c" anchorX="left" anchorY="middle">
        DEPARTURES
      </Text>
      <Text position={[w / 2 - 0.2, top - 0.25, 0.15]} fontSize={0.28} color="#ffffff" anchorX="right" anchorY="middle">
        {clock}
      </Text>
      {col(-w / 2 + 0.2, rows.map((r) => r.time).join('\n'), '#f2c94c')}
      {col(-w / 2 + 1.25, rows.map((r) => r.dest).join('\n'), '#ffffff')}
      {col(0.1, rows.map((r) => `Plat ${r.platform}`).join('\n'), '#9ad0ff')}
      {col(1.15, rows.map((r) => r.status).join('\n'), '#ffb74d')}
    </group>
  );
}

/** Station clock on a post: real Vietnam time from the shared clock. */
function StationClock() {
  const hour = useRef<THREE.Group>(null);
  const min = useRef<THREE.Group>(null);
  useFrame(() => {
    const h = vnHour(serverNow());
    if (hour.current) hour.current.rotation.z = -((h % 12) / 12) * Math.PI * 2;
    if (min.current) min.current.rotation.z = -(h % 1) * Math.PI * 2;
  });
  return (
    <group position={[CLOCK.x, 3.3, CLOCK.z]}>
      <Merged
        build={(p) => {
          p.add(cyl(0.09, 0.12, 3.3, 10), '#37474f', { p: [0, -1.65, 0] });
          p.add(cyl(0.62, 0.62, 0.24, 24), '#37474f', { r: [Math.PI / 2, 0, 0] });
          p.add(cyl(0.54, 0.54, 0.26, 24), '#fbfaf3', { r: [Math.PI / 2, 0, 0] });
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            p.add(box(0.05, i % 3 ? 0.07 : 0.14, 0.02), '#263238', { p: [Math.sin(a) * 0.45, Math.cos(a) * 0.45, 0.14], r: [0, 0, -a] });
          }
        }}
      />
      <group ref={hour} position={[0, 0, 0.15]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.06, 0.3, 0.02]} />
          <meshBasicMaterial color="#263238" />
        </mesh>
      </group>
      <group ref={min} position={[0, 0, 0.16]}>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.04, 0.42, 0.02]} />
          <meshBasicMaterial color="#c62828" />
        </mesh>
      </group>
    </group>
  );
}

/** Tracks, platforms, canopy, tunnels, footbridge, railing, benches, trolleys, hedges and trees. */
function Yard() {
  return (
    <Merged
      build={(p) => {
        // rails and sleepers on both tracks
        for (const tz of TRACK_Z) {
          for (let x = -27.5; x <= 27.5; x += 0.9) p.add(box(0.28, 0.08, 2.0), '#6d4c41', { p: [x, 0.05, tz] });
          for (const dz of [-0.72, 0.72]) p.add(box(56, 0.12, 0.1), '#90a4ae', { p: [0, 0.14, tz + dz] });
        }
        // platform edges (white kerb + yellow safety line) and the railing between platform 1 and the tracks
        p.add(box(56, 0.3, 0.4), '#e0e0e0', { p: [0, 0.15, PLATFORM1.z0 + 0.2] });
        p.add(box(56, 0.31, 0.4), '#e0e0e0', { p: [0, 0.15, PLATFORM2.z1 - 0.2] });
        p.add(box(56, 0.02, 0.18), '#f2c94c', { p: [0, 0.02, PLATFORM1.z0 + 0.75] });
        for (let x = -24; x <= 24; x += 2) p.add(box(0.06, 0.9, 0.06), '#546e7a', { p: [x, 0.45, PLATFORM1.z0 + 0.3] });
        p.add(box(48, 0.06, 0.06), '#546e7a', { p: [0, 0.9, PLATFORM1.z0 + 0.3] });
        for (const x of [-1, 12]) p.add(box(0.12, 2.5, 0.12), '#455a64', { p: [x, 1.25, -13.1] }); // platform sign posts
        // canopy over platform 2 (none over platform 1: it would hide the player from the camera)
        for (let x = -18; x <= 18; x += 6) p.add(cyl(0.1, 0.1, 3.2, 8), '#455a64', { p: [x, 1.6, -22.4] });
        p.add(box(40, 0.18, 2.6), '#607d8b', { p: [0, 3.25, -22.5], r: [-0.06, 0, 0] });
        for (let x = -16; x <= 16; x += 8) {
          p.add(box(1.8, 0.1, 0.5), '#8d6e63', { p: [x, 0.45, -22.9] });
          p.add(box(1.8, 0.45, 0.08), '#8d6e63', { p: [x, 0.7, -23.15] });
        }
        // tunnels at both ends (the train is hidden inside)
        for (const s of [-1, 1]) {
          const cx = s * (TUNNEL_X + 2.75);
          p.add(box(5.5, 5.2, 7.6), '#8d8f7a', { p: [cx, 2.6, -18.6] });
          p.add(box(5.6, 0.6, 7.8), '#6f7a52', { p: [cx, 5.3, -18.6] });
          for (const tz of TRACK_Z) {
            p.add(box(0.05, 3.4, 2.9), '#111418', { p: [s * (TUNNEL_X - 0.01), 1.7, tz] });
            p.add(cyl(1.45, 1.45, 0.05, 16, false, 0, Math.PI), '#111418', { p: [s * (TUNNEL_X - 0.01), 3.4, tz], r: [0, 0, Math.PI / 2] });
          }
          p.add(box(0.3, 0.5, 7.8), '#a1887f', { p: [s * (TUNNEL_X - 0.1), 5.0, -18.6] });
        }
        // footbridge over the tracks (east end), stairs down to both platforms
        const fx = 21;
        p.add(box(2.0, 0.25, 9.2), '#78909c', { p: [fx, 4.6, -18.4] });
        for (const s of [-1, 1]) p.add(box(0.08, 1.0, 9.2), '#b0bec5', { p: [fx + s * 0.95, 5.2, -18.4] });
        for (let i = 0; i < 8; i++) {
          p.add(box(1.8, 0.2, 0.5), '#90a4ae', { p: [fx + 1.9, 0.3 + i * 0.55, -12.9 - i * 0.32] });
        }
        p.add(box(0.15, 4.6, 0.15), '#546e7a', { p: [fx, 2.3, -14.6] });
        p.add(box(0.15, 4.6, 0.15), '#546e7a', { p: [fx, 2.3, -22.2] });
        p.add(box(2.0, 0.25, 1.6), '#78909c', { p: [fx + 1.9, 4.6, -14.6] });
        // benches (forecourt + platform 1)
        for (const b of BENCHES) {
          p.add(box(2, 0.1, 0.5), '#8d6e63', { p: [b.x, 0.45, b.z] });
          p.add(box(2, 0.45, 0.08), '#8d6e63', { p: [b.x, 0.72, b.z - 0.25] });
          for (const dx of [-0.85, 0.85]) p.add(box(0.08, 0.45, 0.45), '#455a64', { p: [b.x + dx, 0.22, b.z] });
        }
        // luggage trolleys by the building
        for (const [x, z] of [[-5.2, -9.8], [-4.2, -10.2], [-3.2, -10.6]] as const) {
          p.add(box(0.7, 0.06, 1.1), '#90a4ae', { p: [x, 0.35, z] });
          p.add(box(0.7, 0.8, 0.06), '#90a4ae', { p: [x, 0.75, z - 0.55] });
          p.add(box(0.5, 0.45, 0.7), ['#d84315', '#1e88e5', '#7cb342'][Math.round(-x) % 3]!, { p: [x, 0.6, z + 0.05] });
          for (const dz of [-0.4, 0.4]) p.add(cyl(0.1, 0.1, 0.6, 8), '#263238', { p: [x, 0.12, z + dz], r: [0, 0, Math.PI / 2] });
        }
        // ticket machine outside the door
        // (drawn here; the click target is a separate invisible box)
        p.add(box(0.8, 1.7, 0.6), '#1e88e5', { p: [TICKET_MACHINE.x, 0.85, TICKET_MACHINE.z] });
        p.add(box(0.55, 0.45, 0.04), '#cfe8ff', { p: [TICKET_MACHINE.x, 1.25, TICKET_MACHINE.z + 0.31] });
        p.add(box(0.3, 0.08, 0.06), '#263238', { p: [TICKET_MACHINE.x, 0.75, TICKET_MACHINE.z + 0.31] });
        // low hedges along the sides
        for (const s of [-1, 1]) p.add(box(0.7, 0.8, 15), '#4f8f3a', { p: [s * 27.5, 0.4, -7.9] });
        for (const [x, z] of [[24.5, -2.5], [-24.5, -2.0], [24.5, -10.5]] as const) tree(p, x, z, 1.1);
        // flower tubs by the door
        for (const x of [-19.6, -14.4]) {
          p.add(cyl(0.35, 0.28, 0.5, 10), '#607d8b', { p: [x, 0.25, -3.4] });
          p.add(sphere(0.38), '#e57373', { p: [x, 0.65, -3.4] });
        }
      }}
    />
  );
}

/** Ticket office: counter with glass, booth, benches, signs to the toilets and the lost property office. */
function Interior() {
  const cx = (COUNTER.minX + COUNTER.maxX) / 2;
  const cw = COUNTER.maxX - COUNTER.minX;
  return (
    <>
      <Merged
        build={(p) => {
          p.add(box(cw, 0.8, 0.6), '#78909c', { p: [cx, 0.4, (COUNTER.minZ + COUNTER.maxZ) / 2] });
          p.add(box(cw, 0.06, 0.7), '#cfd8dc', { p: [cx, 0.83, (COUNTER.minZ + COUNTER.maxZ) / 2] });
          // open window above the counter: thin frames only, so the stationmaster stays visible
          for (let x = COUNTER.minX + 0.05; x <= COUNTER.maxX; x += 2.5) p.add(box(0.06, 1.5, 0.06), '#607d8b', { p: [x, 1.6, COUNTER.minZ + 0.1] });
          p.add(box(cw, 0.9, 0.12), '#607d8b', { p: [cx, 2.75, COUNTER.minZ + 0.1] });
          for (const x of [COUNTER.minX, COUNTER.maxX]) p.add(box(0.2, 3.2, STATION.z0 * -1 + COUNTER.maxZ), '#cfd8dc', { p: [x, 1.6, (STATION.z0 + COUNTER.maxZ) / 2] });
          // waiting benches by the front wall
          for (const x of [-25, -22.6]) {
            p.add(box(2, 0.1, 0.5), '#8d6e63', { p: [x, 0.45, -5.0] });
            p.add(box(2, 0.45, 0.08), '#8d6e63', { p: [x, 0.72, -4.75] });
          }
          // doors to the toilets (west wall) and the lost property office (east of the booth)
          p.add(box(0.06, 2.1, 1.1), '#5c6bc0', { p: [STATION.x0 + 0.17, 1.05, -7.5] });
          p.add(box(1.1, 2.1, 0.06), '#8d6e63', { p: [-9.5, 1.05, STATION.z0 + 0.17] });
          // timetable poster
          p.add(box(1.4, 1.0, 0.04), '#fff8e1', { p: [-25, 1.7, STATION.z0 + 0.17] });
        }}
      />
      <Text position={[cx, 2.75, COUNTER.minZ + 0.17]} fontSize={0.38} color="#ffffff" anchorX="center" anchorY="middle">
        TICKETS · INFORMATION
      </Text>
      <Text position={[STATION.x0 + 0.21, 2.4, -7.5]} rotation-y={Math.PI / 2} fontSize={0.28} color="#3949ab" anchorX="center">
        🚻 TOILETS
      </Text>
      <Text position={[-9.5, 2.4, STATION.z0 + 0.21]} fontSize={0.24} color="#5d4037" anchorX="center">
        LOST PROPERTY
      </Text>
      <Text position={[-25, 1.95, STATION.z0 + 0.2]} fontSize={0.14} color="#37474f" anchorX="center" anchorY="top" lineHeight={1.3}>
        {'TIMETABLE\nRiverside  25 min\nMaple Hill  40 min\nOld Town  55 min\nSunny Bay  1 h 15'}
      </Text>
    </>
  );
}

/** Ticket machine and the doors of a train standing at the platform (open doors = "Board the train"). */
function TrainUsables() {
  const t = useT();
  const riding = useTrain((s) => !!s.ride);
  const ticket = useTrain((s) => s.ticket);
  const [open, setOpen] = useState<number | null>(null);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const now = serverNow();
    const slot = currentSlots(now).find((sl) => {
      const p = trainPose(sl, now);
      return p.visible && p.door > 0.4;
    });
    const v = slot ?? null;
    if (v !== open) setOpen(v);
  });
  const [mx, mz] = FRAME.toWorld(TICKET_MACHINE.x, TICKET_MACHINE.z + 0.9);
  useUsable({ id: 'station-ticket-machine', x: mx, z: mz, r: 1.5, icon: '🎫', label: ticket ? `${t('Ticket')}: ${ticket.dest} (${ticket.type})` : t('Buy a ticket'), use: () => useTrain.getState().openMachine() });
  const s = open !== null ? service(open) : null;
  const doors = [-5.8, 0, 5.8].map((x) => FRAME.toWorld(x, PLATFORM1.z0 + 0.7));
  for (const [i, [x, z]] of doors.entries())
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable(
      s && open !== null && !riding
        ? { id: `station-board-${i}`, x, z, r: 2.4, icon: '🚆', label: `${t('Board the train')} → ${s.dest}`, priority: true, use: () => useTrain.getState().board(open) }
        : null,
    );
  return null;
}

export default function Station() {
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#b9d98f" y={0.006} />
      <Ground x0={-27.5} x1={27.5} z0={PLATFORM1.z0} z1={-0.3} color="#cfc9bd" y={0.01} />
      <Ground x0={-28} x1={28} z0={PLATFORM2.z1} z1={PLATFORM1.z0} color="#8d8577" y={0.011} />
      <Ground x0={-28} x1={28} z0={PLATFORM2.z0} z1={PLATFORM2.z1} color="#cfc9bd" y={0.011} />
      <Ground x0={-1.6} x1={1.6} z0={-4} z1={0} color="#b8b0a2" y={0.013} />
      <BuildingShell b={STATION} name="Central Station" frame={FRAME}>
        <Interior />
      </BuildingShell>
      <Yard />
      <Train />
      <DeparturesBoard />
      <StationClock />
      <TrainUsables />
      <mesh position={[TICKET_MACHINE.x, 0.85, TICKET_MACHINE.z]} onClick={(e) => (e.stopPropagation(), useTrain.getState().openMachine())} visible={false}>
        <boxGeometry args={[0.9, 1.8, 0.7]} />
        <meshBasicMaterial />
      </mesh>
      <Text position={[TICKET_MACHINE.x, 1.85, TICKET_MACHINE.z + 0.31]} fontSize={0.16} color="#ffffff" anchorX="center">
        TICKETS
      </Text>
      {/* platform signs and the footbridge */}
      {[
        [-1, -13.0, 'Platform 1'],
        [12, -13.0, 'Platform 1'],
      ].map(([x, z, s], i) => (
        <group key={i} position={[x as number, 2.7, z as number]}>
          <mesh>
            <boxGeometry args={[2.4, 0.5, 0.06]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          <Text position={[0, 0, 0.04]} fontSize={0.28} color="#fff" anchorX="center" anchorY="middle">
            {s as string}
          </Text>
        </group>
      ))}
      <Text position={[0, 2.6, -22.0]} fontSize={0.4} color="#1e3a8a" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#ffffff">
        Platform 2
      </Text>
      <Text position={[21, 5.3, -13.7]} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#1e3a8a">
        Footbridge → Platform 2
      </Text>
    </AreaGroup>
  );
}
