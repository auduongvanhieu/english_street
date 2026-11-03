import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, type RemotePlayer } from '../store/game';
import { Character } from './Character';
import { NameTag } from './NameTag';

export function RemotePlayers() {
  const players = useGame((s) => s.players);
  const me = useGame((s) => s.sessionId);
  return (
    <>
      {Object.values(players)
        .filter((p) => p.id !== me)
        .map((p) => (
          <Remote key={p.id} p={p} />
        ))}
    </>
  );
}

function Remote({ p }: { p: RemotePlayer }) {
  const ref = useRef<THREE.Group>(null);
  // Interpolate toward the last known server position for smooth motion.
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0001, dt);
    g.position.x += (p.x - g.position.x) * k;
    g.position.z += (p.z - g.position.z) * k;
    g.rotation.y += shortestAngle(g.rotation.y, p.rot) * k;
  });
  return (
    <group ref={ref} position={[p.x, p.y, p.z]}>
      <Character anim={p.anim} tint={avatarColor(p.avatar, '#e2a04a')} />
      <NameTag name={p.name} bubble={p.bubble} />
    </group>
  );
}

function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function avatarColor(json: string, fallback: string): string {
  try {
    const c = (JSON.parse(json) as { color?: string }).color;
    return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
  } catch {
    return fallback;
  }
}
