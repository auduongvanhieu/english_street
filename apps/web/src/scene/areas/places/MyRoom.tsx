import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { MY_ROOM, furniture, myRoom, myRoomAt, myRoomSlot, type Placed } from '@es/shared';
import { localHeading, localPos } from '../../LocalPlayer';
import { preloadLpm, useLpmParts } from '../../LpmModel';
import { chibiMaterial } from '../../chibi/buildChibi';
import { getPlayerId } from '../../../net/player';
import { ghostTick, useMyRoom } from '../../../store/myRoom';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';

/**
 * "My room" (off the map, @es/shared home.ts): walls that hide on the camera's side, a wooden floor, the furniture
 * (LPM assets-src/lpm/recipes/home_kit.py) and the piece you are carrying as a see-through ghost.
 */
preloadLpm('home_kit');
const WALL_H = 2.8;
const ghostOk = new THREE.MeshStandardMaterial({ color: '#7be38f', transparent: true, opacity: 0.55, depthWrite: false });
const ghostBad = new THREE.MeshStandardMaterial({ color: '#ff6b6b', transparent: true, opacity: 0.55, depthWrite: false });

function Wall({ x, z, w, d, out, color = '#f3e6d0' }: { x: number; z: number; w: number; d: number; out: [number, number]; color?: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = (camera.position.x - x) * out[0] + (camera.position.z - z) * out[1] < 0.3;
  });
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[w, WALL_H, d]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w + 0.02, 0.12, d + 0.03]} />
        <meshStandardMaterial color="#b88a5a" />
      </mesh>
    </group>
  );
}

function Piece({ p, cx, cz, ghost }: { p: Placed; cx: number; cz: number; ghost?: 'ok' | 'bad' }) {
  const kit = useLpmParts('home_kit');
  const f = furniture(p.id);
  if (!f) return null;
  const geo = kit[f.mesh];
  if (!geo) return null;
  return <mesh geometry={geo} material={ghost === 'ok' ? ghostOk : ghost === 'bad' ? ghostBad : chibiMaterial()} position={[cx + p.x, f.wallY ? f.wallY - (f.id === 'picture' ? 0.3 : 0) : 0.002, cz + p.z]} rotation-y={(p.r * Math.PI) / 2} castShadow={!ghost} />;
}

function PieceUsable({ i, p, cx, cz }: { i: number; p: Placed; cx: number; cz: number }) {
  const t = useT();
  const f = furniture(p.id)!;
  useUsable({ id: `myroom-piece-${i}-${p.id}`, x: cx + p.x, z: cz + p.z, r: Math.max(1.1, Math.max(f.w, f.d) / 2 + 0.6), icon: f.icon, label: `${t('Move')}: ${f.en}`, use: () => useMyRoom.getState().pickUp(i) });
  return null;
}

function Room({ slot }: { slot: number }) {
  const t = useT();
  const items = useMyRoom((s) => s.items);
  const ghost = useMyRoom((s) => s.ghost);
  const owner = useMyRoom((s) => s.owner);
  const ownerName = useMyRoom((s) => s.ownerName);
  const mine = owner === getPlayerId();
  const r = myRoom(slot);
  const { minX, maxX, minZ, maxZ } = r.rect;
  useFrame(() => ghostTick(localHeading.y));
  useUsable({ id: 'myroom-door', x: r.entry.x, z: maxZ - 0.4, r: 1.2, icon: '🚪', label: t('Go out'), use: () => useMyRoom.getState().leave() });
  const floor = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#c99a66' : '#d4a873';
      g.fillRect(0, i * 32, 256, 32);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(MY_ROOM.w / 2, MY_ROOM.d / 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  return (
    <group>
      <mesh position={[r.cx, -0.01, r.cz]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial color="#25212b" />
      </mesh>
      <mesh position={[r.cx, 0.004, r.cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <meshStandardMaterial map={floor} roughness={0.9} />
      </mesh>
      <Wall x={r.cx} z={minZ} w={maxX - minX} d={0.15} out={[0, -1]} />
      <Wall x={r.cx} z={maxZ} w={maxX - minX} d={0.15} out={[0, 1]} />
      <Wall x={minX} z={r.cz} w={0.15} d={maxZ - minZ} out={[-1, 0]} color="#e9dcc6" />
      <Wall x={maxX} z={r.cz} w={0.15} d={maxZ - minZ} out={[1, 0]} color="#e9dcc6" />
      {/* a window on the back wall and the door */}
      <mesh position={[r.cx + 2, 1.5, minZ + 0.09]}>
        <planeGeometry args={[1.6, 1.1]} />
        <meshBasicMaterial color="#9ad0f5" />
      </mesh>
      <mesh position={[r.entry.x, 1.05, maxZ - 0.09]} rotation-y={Math.PI}>
        <planeGeometry args={[1.0, 2.1]} />
        <meshStandardMaterial color="#8d5a3b" />
      </mesh>
      <Text position={[r.cx - 1.5, 2.45, minZ + 0.1]} fontSize={0.22} color="#8d5a3b" anchorX="center" anchorY="middle">
        {mine ? 'My room' : `${ownerName}'s room`}
      </Text>
      {items.map((p, i) => (
        <Piece key={`${i}-${p.id}`} p={p} cx={r.cx} cz={r.cz} />
      ))}
      {mine && !ghost ? items.map((p, i) => <PieceUsable key={`u${i}-${p.id}`} i={i} p={p} cx={r.cx} cz={r.cz} />) : null}
      {ghost ? <Piece p={{ id: ghost.id, x: ghost.x, z: ghost.z, r: ghost.r }} cx={r.cx} cz={r.cz} ghost={ghost.ok ? 'ok' : 'bad'} /> : null}
      <pointLight position={[r.cx, 2.4, r.cz]} intensity={6} distance={12} color="#fff1dc" />
    </group>
  );
}

export default function MyRoom() {
  const [slot, setSlot] = useState(-1);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const s = myRoomAt(localPos.x, localPos.z);
    if (s !== slot) {
      setSlot(s);
      // standing in a room with no room open (after a reload): your own room loads, anyone else's sends you out
      const st = useMyRoom.getState();
      if (s >= 0 && !st.owner) {
        if (s === myRoomSlot(getPlayerId())) void st.enter();
        else st.leave();
      }
    }
  });
  if (slot < 0) return null;
  return <Room slot={slot} />;
}
