import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { clinicRoom, clinicRoomAt } from '@es/shared';
import { localPos } from '../../LocalPlayer';
import { lpmGlassMat, preloadLpm, useLpmParts } from '../../LpmModel';
import { Chibi } from '../../chibi/Chibi';
import { chibiMaterial } from '../../chibi/buildChibi';
import { NPC_CHIBI } from '../../npcLook';
import { clinicTick, roomName, useClinic } from '../../../store/clinic';
import { ROOM_CABINET, ROOM_CHAIR, ROOM_COUCH, ROOM_DESK, ROOM_DOCTOR } from '../../../world/clinic';
import { useVoice } from '../../../store/voice';

/**
 * The doctor's consulting rooms (off the map, world/clinic.ts): drawn only while you are in one. Walls between the
 * camera and you hide (cut-away). Furniture: LPM assets-src/lpm/recipes/clinic_kit.py.
 */
preloadLpm('clinic_kit');
const WALL_H = 2.8;

function Wall({ x, z, w, d, out }: { x: number; z: number; w: number; d: number; out: [number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = (camera.position.x - x) * out[0] + (camera.position.z - z) * out[1] < 0.3;
  });
  return (
    <mesh ref={ref} position={[x, WALL_H / 2, z]}>
      <boxGeometry args={[w, WALL_H, d]} />
      <meshStandardMaterial color="#e0f2f1" roughness={0.9} />
    </mesh>
  );
}

function Doctor() {
  const speaking = useVoice((s) => s.speakingNpc === 'doctor');
  return <Chibi spec={NPC_CHIBI.doctor ?? NPC_CHIBI.stationmaster!} anim={speaking ? 'talk' : 'idle'} />;
}

function Room({ i }: { i: number }) {
  const kit = useLpmParts('clinic_kit');
  const r = clinicRoom(i);
  const { minX, maxX, minZ, maxZ } = r.rect;
  const at = (o: { dx: number; dz: number }): [number, number, number] => [r.cx + o.dx, 0, r.cz + o.dz];
  return (
    <group>
      {/* a dark "building" around, hiding the open world below the interiors */}
      <mesh position={[r.cx, -0.01, r.cz]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial color="#25212b" />
      </mesh>
      <mesh position={[r.cx, 0.005, r.cz]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[maxX - minX, maxZ - minZ]} />
        <meshStandardMaterial color="#cfe3e8" roughness={1} />
      </mesh>
      <Wall x={r.cx} z={minZ} w={maxX - minX} d={0.15} out={[0, -1]} />
      <Wall x={r.cx} z={maxZ} w={maxX - minX} d={0.15} out={[0, 1]} />
      <Wall x={minX} z={r.cz} w={0.15} d={maxZ - minZ} out={[-1, 0]} />
      <Wall x={maxX} z={r.cz} w={0.15} d={maxZ - minZ} out={[1, 0]} />
      <mesh geometry={kit['SM_CL_Desk']!} material={chibiMaterial()} position={at(ROOM_DESK)} castShadow />
      <mesh geometry={kit['SM_CL_Chair']!} material={chibiMaterial()} position={at(ROOM_CHAIR)} rotation-y={Math.PI} />
      <mesh geometry={kit['SM_CL_Couch']!} material={chibiMaterial()} position={at(ROOM_COUCH)} rotation-y={Math.PI / 2} castShadow />
      <group position={at(ROOM_CABINET)} rotation-y={-Math.PI / 2}>
        <mesh geometry={kit['SM_CL_Cabinet']!} material={chibiMaterial()} castShadow />
        <mesh geometry={kit['SM_CL_Cabinet_glass']!} material={lpmGlassMat} />
      </group>
      <mesh geometry={kit['SM_CL_Lightbox']!} material={chibiMaterial()} position={[r.cx - 2.2, 0, minZ + 0.1]} />
      <Text position={[r.cx - 2.2, 1.45, minZ + 0.14]} fontSize={0.3} anchorX="center" anchorY="middle">
        🦴
      </Text>
      <mesh geometry={kit['SM_CL_Scale']!} material={chibiMaterial()} position={[r.cx + 2.6, 0, minZ + 0.45]} />
      <group position={at(ROOM_DOCTOR)} rotation-y={0}>
        <Doctor />
      </group>
      <Text position={[r.cx + 1.2, 2.3, minZ + 0.1]} fontSize={0.22} color="#00897b" anchorX="center" anchorY="middle">
        {roomName(i)}
      </Text>
      <Text position={[r.cx + 1.2, 1.95, minZ + 0.1]} fontSize={0.16} color="#455a64" anchorX="center" anchorY="middle">
        Dr. Chen · General Practice
      </Text>
      <pointLight position={[r.cx, 2.4, r.cz]} intensity={5} distance={10} color="#ffffff" />
    </group>
  );
}

export default function Clinic() {
  const [room, setRoom] = useState(-1);
  const acc = useRef(0);
  const stage = useClinic((s) => s.stage);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const i = clinicRoomAt(localPos.x, localPos.z);
    if (i !== room) setRoom(i);
    if (i >= 0) clinicTick();
  });
  if (room < 0) return null;
  void stage;
  return <Room i={room} />;
}
