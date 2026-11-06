import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { HOTEL_FLOORS, INTERIOR_BOUNDS, MINIBAR, hotelCorridorRect, hotelCorridorZ, hotelLiftX, hotelRoomAt, hotelRoomInfo, inRect, ordinal } from '@es/shared';
import { localPos } from '../../LocalPlayer';
import { lpmGlassMat, preloadLpm, useLpmParts } from '../../LpmModel';
import { Merged, box, type Part } from '../kit';
import { useUsable } from '../../../world/usables';
import { BATH, ROOM_D, ROOM_PIECES, ROOM_SPOTS, ROOM_W, WALL_H, roomRot, roomToWorld } from '../../../world/places/hotelFloors';
import { useHotel } from '../../../store/hotel';
import { useT } from '../../../i18n';

/**
 * Riverside Hotel guest floors (off the street map): the corridor of the floor you are on, and the room you are in.
 * Walls between the camera and you fade out (cut-away), so the third-person camera can look in from above.
 * Furniture: Blender LPM kit assets-src/lpm/recipes/hotel_kit.py.
 */
preloadLpm('hotel_kit');
const WALL = '#efe3cf';
const WALL_TRIM = '#c0a062';

/** Where the local player is: floor (2/3, 0 = not upstairs) and room (0 = corridor). Checked 4×/s. */
function useWhere() {
  const [where, setWhere] = useState({ floor: 0, room: 0 });
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    let floor = 0;
    let room = 0;
    if (inRect(INTERIOR_BOUNDS, localPos.x, localPos.z)) {
      room = hotelRoomAt(localPos.x, localPos.z);
      if (room) floor = Math.floor(room / 100);
      else for (const f of HOTEL_FLOORS) if (inRect(hotelCorridorRect(f), localPos.x, localPos.z, 0.5)) floor = f;
    }
    if (floor !== where.floor || room !== where.room) setWhere({ floor, room });
  });
  return where;
}

export default function HotelFloors() {
  const { floor, room } = useWhere();
  if (!floor) return null;
  const zc = hotelCorridorZ(floor);
  return (
    <>
      {/* a dark "building" around the floor, hiding the open grass of the world under the interiors */}
      <mesh position={[0, 0.002, zc]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[90, 40]} />
        <meshBasicMaterial color="#25212b" />
      </mesh>
      {room ? <Room room={room} /> : <Corridor floor={floor} />}
    </>
  );
}

/** A wall segment that hides while the camera is on its outer side (cut-away). */
function CutWall({ x0, z0, x1, z1, h = WALL_H, out, color = WALL }: { x0: number; z0: number; x1: number; z1: number; h?: number; out: [number, number]; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const ang = Math.atan2(z1 - z0, x1 - x0);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    ref.current.visible = (camera.position.x - cx) * out[0] + (camera.position.z - cz) * out[1] < 0.3;
  });
  return (
    <group ref={ref} position={[cx, 0, cz]} rotation-y={-ang}>
      <mesh position={[0, h / 2, 0]} receiveShadow>
        <boxGeometry args={[len, h, 0.14]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[len + 0.02, 0.12, 0.17]} />
        <meshStandardMaterial color={WALL_TRIM} roughness={0.7} />
      </mesh>
    </group>
  );
}

/** Floor plane + soft light for an interior rectangle. */
function FloorPlane({ x0, x1, z0, z1, color }: { x0: number; x1: number; z0: number; z1: number; color: string }) {
  return (
    <mesh position={[(x0 + x1) / 2, 0.005, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

/* --------------------------------------------------------------------------------------------- corridor */

function Corridor({ floor }: { floor: number }) {
  const t = useT();
  const kit = useLpmParts('hotel_kit');
  const zc = hotelCorridorZ(floor);
  const c = hotelCorridorRect(floor);
  const rooms = useMemo(() => Array.from({ length: 12 }, (_, i) => floor * 100 + i + 1), [floor]);
  const stay = useHotel((s) => s.stay);
  const open = useHotel((s) => s.open);
  useUsable({ id: 'hotel-lift-up', x: hotelLiftX + 0.6, z: zc, r: 1.5, icon: '🛗', label: t('Take the lift'), use: () => open('lift') });
  return (
    <group>
      <FloorPlane x0={c.minX} x1={c.maxX} z0={c.minZ} z1={c.maxZ} color="#5a2a32" />
      <mesh position={[(c.minX + c.maxX) / 2, 0.01, zc]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[c.maxX - c.minX - 1, 1.4]} />
        <meshStandardMaterial color="#7a2e3a" roughness={1} />
      </mesh>
      <CutWall x0={c.minX} z0={c.minZ} x1={c.maxX} z1={c.minZ} out={[0, -1]} />
      <CutWall x0={c.minX} z0={c.maxZ} x1={c.maxX} z1={c.maxZ} out={[0, 1]} />
      <CutWall x0={c.minX} z0={c.minZ} x1={c.minX} z1={c.maxZ} out={[-1, 0]} />
      <CutWall x0={c.maxX} z0={c.minZ} x1={c.maxX} z1={c.maxZ} out={[1, 0]} />
      <Merged
        deps={[kit, floor]}
        castShadow={false}
        build={(p) => {
          for (const r of rooms) {
            const info = hotelRoomInfo(r);
            // door in the corridor wall, facing the corridor
            p.addColored(kit.SM_HR_Door!, { p: [info.door.x, 0, info.door.z + (info.north ? 0.08 : -0.08)], r: [0, info.north ? 0 : Math.PI, 0] });
            p.addColored(kit.SM_HR_Sconce!, { p: [info.door.x + 1.6, 1.75, info.door.z + (info.north ? 0.12 : -0.12)], r: [0, info.north ? 0 : Math.PI, 0] });
          }
          p.addColored(kit.SM_HR_Lift!, { p: [c.minX + 0.08, 0, zc], r: [0, Math.PI / 2, 0] });
          p.addColored(kit.SM_HR_Plant!, { p: [c.maxX - 0.5, 0, c.minZ + 0.45] });
          p.addColored(kit.SM_HR_Plant!, { p: [-0.5, 0, c.maxZ - 0.45] });
          p.addColored(kit.SM_HR_Cart!, { p: [8, 0, c.minZ + 0.4] });
        }}
      />
      {rooms.map((r) => (
        <DoorSign key={r} room={r} mine={stay?.room === r} />
      ))}
      <Text position={[c.minX + 0.2, 2.42, zc]} rotation-y={Math.PI / 2} fontSize={0.16} color="#f6e7b0" anchorX="center">
        {`${ordinal(floor).toUpperCase()} FLOOR`}
      </Text>
      <pointLight position={[-12, 2.3, zc]} intensity={6} distance={18} decay={1.4} color="#ffe2b0" />
      <pointLight position={[12, 2.3, zc]} intensity={6} distance={18} decay={1.4} color="#ffe2b0" />
    </group>
  );
}

/** Room number over a door, plus the door itself as a usable: open your own room, knock on others. */
function DoorSign({ room, mine }: { room: number; mine: boolean }) {
  const t = useT();
  const info = hotelRoomInfo(room);
  const h = useHotel.getState;
  const z = info.door.z + (info.north ? 0.2 : -0.2);
  useUsable({
    id: `hotel-door-${room}`,
    x: info.outside.x,
    z: info.outside.z,
    r: 0.9,
    icon: mine ? '🔑' : '✊',
    label: mine ? t('Open room {room} (your key card)', { room }) : t('Knock on room {room}', { room }),
    use: () => (mine ? h().openDoor(room) : h().knock(room)),
  });
  return (
    <Text position={[info.door.x, 2.42, z]} rotation-y={info.north ? 0 : Math.PI} fontSize={0.2} color={mine ? '#ffd36b' : '#3a2a22'} anchorX="center" outlineWidth={mine ? 0.01 : 0} outlineColor="#3a2a22">
      {mine ? `★ ${room}` : String(room)}
    </Text>
  );
}

/* --------------------------------------------------------------------------------------------- room */

function Room({ room }: { room: number }) {
  const t = useT();
  const kit = useLpmParts('hotel_kit');
  const info = hotelRoomInfo(room);
  const r = info.rect;
  const rot = roomRot(room);
  const s = useHotel();
  const mine = s.stay?.room === room;
  const at = (k: keyof typeof ROOM_SPOTS) => roomToWorld(room, ROOM_SPOTS[k].x, ROOM_SPOTS[k].z);
  const use = (id: string, k: keyof typeof ROOM_SPOTS, icon: string, label: string, fn: () => void, reach = 1.1) => {
    const [x, z] = at(k);
    return { id: `hotel-${id}`, x, z, r: reach, icon, label, use: fn };
  };
  useUsable(use('leave', 'door', '🚪', t('Leave the room'), () => s.leaveRoom(room)));
  useUsable(use('light', 'light', s.light ? '💡' : '🌑', s.light ? t('Turn the light off') : t('Turn the light on'), () => useHotel.setState({ light: !s.light }), 0.7));
  useUsable(mine ? use('phone', 'phone', '☎️', t('Call reception'), () => s.open('phone')) : null);
  useUsable(mine ? use('minibar', 'minibar', '🧊', t('Open the minibar'), () => s.open('minibar'), 0.9) : null);
  useUsable(use('tv', 'tv', '📺', s.tv ? t('Turn the TV off') : t('Turn the TV on'), () => useHotel.setState({ tv: !s.tv }), 1.0));
  useUsable(use('bed', 'bed', '😴', t('Have a rest'), () => s.setNotice(`😴 ${t('You had a short nap. Good morning!')}`), 1.0));
  useUsable(use('window', 'window', '🪟', t('Look out of the window'), () => s.setNotice(`🪟 ${t('You can see the river and the bridge.')}`), 1.0));
  useUsable(mine ? use('dnd', 'dnd', s.dnd ? '🔔' : '🔕', s.dnd ? t('Take the "Do not disturb" sign off') : t('Hang the "Do not disturb" sign'), () => useHotel.setState({ dnd: !s.dnd }), 0.5) : null);

  const glass = useMemo(() => ROOM_PIECES.filter((p) => kit[p.kit] && p.kit.endsWith('_glass')), [kit]);
  const [tvX, tvZ] = roomToWorld(room, 3.08, -0.7);
  const [labelX, labelZ] = roomToWorld(room, 0, 2.86);
  return (
    <group>
      <FloorPlane x0={r.minX} x1={r.maxX} z0={r.minZ} z1={r.maxZ} color="#c9b48f" />
      <CutWall x0={r.minX} z0={r.minZ} x1={r.maxX} z1={r.minZ} out={[0, -1]} />
      <CutWall x0={r.minX} z0={r.maxZ} x1={r.maxX} z1={r.maxZ} out={[0, 1]} />
      <CutWall x0={r.minX} z0={r.minZ} x1={r.minX} z1={r.maxZ} out={[-1, 0]} />
      <CutWall x0={r.maxX} z0={r.minZ} x1={r.maxX} z1={r.maxZ} out={[1, 0]} />
      <Merged
        deps={[kit, room, s.delivered.join(',')]}
        build={(p) => {
          for (const pc of ROOM_PIECES) {
            const g = kit[pc.kit];
            if (!g || pc.kit.endsWith('_glass')) continue;
            const [x, z] = roomToWorld(room, pc.x, pc.z);
            p.addColored(g, { p: [x, 0, z], r: [0, pc.rot + rot, 0] });
          }
          // door (inside face) and the bathroom partitions
          const [dx, dz] = roomToWorld(room, 0, 2.93);
          p.addColored(kit.SM_HR_Door!, { p: [dx, 0, dz], r: [0, rot + Math.PI, 0] });
          bathWalls(p, room);
          deliveries(p, room, s.delivered);
        }}
      />
      {glass.map((pc) => {
        const [x, z] = roomToWorld(room, pc.x, pc.z);
        return <mesh key={pc.kit} geometry={kit[pc.kit]} material={lpmGlassMat} position={[x, 0, z]} rotation-y={pc.rot + rot} renderOrder={1} />;
      })}
      {s.tv ? (
        <group position={[tvX, 1.18, tvZ]} rotation-y={rot - Math.PI / 2}>
          <mesh>
            <planeGeometry args={[0.92, 0.52]} />
            <meshBasicMaterial color="#1d3f6e" toneMapped={false} />
          </mesh>
          <Text position={[0, 0.12, 0.01]} fontSize={0.075} color="#ffffff" anchorX="center" maxWidth={0.85}>
            RIVER NEWS
          </Text>
          <Text position={[0, -0.06, 0.01]} fontSize={0.05} color="#ffd36b" anchorX="center" maxWidth={0.85} textAlign="center">
            {'Weather: sunny, 30°C. The farm market is open today!'}
          </Text>
        </group>
      ) : null}
      {s.light ? <pointLight position={[(r.minX + r.maxX) / 2, 2.4, (r.minZ + r.maxZ) / 2]} intensity={9} distance={12} decay={1.3} color="#fff0d6" castShadow={false} /> : null}
      <Text position={[labelX, 2.3, labelZ]} rotation-y={rot + Math.PI} fontSize={0.16} color="#7a2e3a" anchorX="center">
        {`ROOM ${room}`}
      </Text>
    </group>
  );
}

/** Bathroom partition walls (white, a bit lower than the room walls). */
function bathWalls(p: Part, room: number) {
  const seg = (x0: number, z0: number, x1: number, z1: number) => {
    const [ax, az] = roomToWorld(room, x0, z0);
    const [bx, bz] = roomToWorld(room, x1, z1);
    const len = Math.hypot(bx - ax, bz - az);
    p.add(box(Math.abs(bx - ax) > 0.01 ? len : 0.1, 2.2, Math.abs(bz - az) > 0.01 ? len : 0.1), '#f4f6f8', { p: [(ax + bx) / 2, 1.1, (az + bz) / 2] });
  };
  seg(BATH.x0, BATH.z0, BATH.x1, BATH.z0);
  seg(BATH.x1, BATH.z0, BATH.x1, BATH.open0);
  seg(BATH.x1, BATH.open1, BATH.x1, BATH.z1);
  // tiled floor
  const [a, b] = roomToWorld(room, (BATH.x0 + BATH.x1) / 2, (BATH.z0 + BATH.z1) / 2);
  p.add(box(BATH.x1 - BATH.x0, 0.02, BATH.z1 - BATH.z0), '#d7e4ea', { p: [a, 0.012, b] });
}

/** What room service brought: towels and a pillow on the bed, water on the desk, a breakfast tray. */
function deliveries(p: Part, room: number, items: (string | undefined)[]) {
  const put = (x: number, z: number, y: number, w: number, h: number, d: number, c: string) => {
    const [wx, wz] = roomToWorld(room, x, z);
    p.add(box(w, h, d), c, { p: [wx, y, wz] });
  };
  if (items.includes('towels')) {
    put(-1.55, -1.4, 0.62, 0.45, 0.08, 0.3, '#ffffff');
    put(-1.55, -1.4, 0.7, 0.42, 0.08, 0.28, '#dfe9ef');
  }
  if (items.includes('pillow')) put(-2.9, -1.0, 0.66, 0.4, 0.15, 0.6, '#ffffff');
  if (items.includes('water')) put(3.2, 1.25, 0.86, 0.08, 0.22, 0.08, '#7cc4f2');
  if (items.includes('breakfast')) {
    put(-1.3, -0.6, 0.6, 0.6, 0.04, 0.4, '#c0a062');
    put(-1.4, -0.6, 0.65, 0.18, 0.06, 0.18, '#f2b33d');
    put(-1.15, -0.55, 0.66, 0.1, 0.1, 0.1, '#ffffff');
  }
}

export const MINIBAR_ITEMS = MINIBAR;
export { ROOM_W, ROOM_D };
