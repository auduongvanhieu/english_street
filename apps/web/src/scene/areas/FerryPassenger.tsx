import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type * as THREE from 'three';
import { localPos } from '../LocalPlayer';
import { ferryTick, pierTip, useFerry } from '../../store/ferryman';
import { Chibi } from '../chibi/Chibi';
import { SHOPPER_CHIBI } from '../npcLook';

/** The waiting passenger at a pier (waving, with a name label), or riding with you in the boat (store/ferryman.ts). */
export function FerryPassenger() {
  const job = useFerry((s) => s.job);
  const ride = useRef<THREE.Group>(null);
  const acc = useRef(0);
  const [, tick] = useState(0);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current >= 0.25) {
      acc.current = 0;
      ferryTick();
    }
    if (ride.current) ride.current.position.set(localPos.x, 1.9 + Math.sin(clock.elapsedTime * 3) * 0.05, localPos.z);
    void tick;
  });
  if (!job) return null;
  if (job.phase === 'ride')
    return (
      <group ref={ride}>
        <Text fontSize={0.24} color="#1d3f8a" outlineWidth={0.02} outlineColor="#ffffff" anchorX="center" anchorY="middle">
          {`${job.name} · PASSENGER`}
        </Text>
      </group>
    );
  const p = pierTip(job.from);
  return (
    <group position={[p.x, 0, p.z]}>
      <Chibi spec={SHOPPER_CHIBI[job.name.length % SHOPPER_CHIBI.length]!} anim="wave" />
      <Text position={[0, 2.3, 0]} fontSize={0.28} color="#1d3f8a" outlineWidth={0.02} outlineColor="#ffffff" anchorX="center" anchorY="middle">
        {`${job.name} · PASSENGER`}
      </Text>
    </group>
  );
}
