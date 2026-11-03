import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, type RemotePlayer } from '../store/game';
import { Character } from './Character';
import { localPos } from './LocalPlayer';
import { useSettings } from '../store/settings';
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

/** Beyond this distance a remote player is not drawn at all (the whole street is ~80 m wide). */
const DRAW_RADIUS = { high: 45, low: 28 };
/** Name tags (SDF text) only for players reasonably close. */
const TAG_RADIUS = 22;

function Remote({ p }: { p: RemotePlayer }) {
  const ref = useRef<THREE.Group>(null);
  const selected = useGame((s) => s.selectedPlayer === p.id);
  const select = useGame((s) => s.setSelectedPlayer);
  const mySession = useGame((s) => s.sessionId);
  const [near, setNear] = useState(true);
  const [tag, setTag] = useState(true);
  const acc = useRef(Math.random());
  const quality = useSettings((s) => s.quality);
  // Interpolate toward the last known server position for smooth motion.
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0001, dt);
    g.position.x += (p.x - g.position.x) * k;
    g.position.z += (p.z - g.position.z) * k;
    g.rotation.y += shortestAngle(g.rotation.y, p.rot) * k;
    // Distance culling, checked ~4x/s (staggered so players don't all re-render on the same frame).
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const d = Math.hypot(g.position.x - localPos.x, g.position.z - localPos.z);
    const n = d < DRAW_RADIUS[quality];
    const t = d < TAG_RADIUS;
    if (n !== near) setNear(n);
    if (t !== tag) setTag(t);
  });
  const badge = p.shouting ? 'shout' : p.talkWith ? (p.talkWith === mySession ? 'talk' : 'busy') : undefined;
  return (
    <group
      ref={ref}
      position={[p.x, p.y, p.z]}
      onClick={(e) => {
        e.stopPropagation();
        select(selected ? null : p.id);
      }}
    >
      {near ? <Character anim={p.anim} tint={avatarColor(p.avatar, '#e2a04a')} /> : null}
      {tag ? <NameTag name={p.name} bubble={p.bubble} badge={badge} /> : null}
      {selected ? (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.6, 0.75, 32]} />
          <meshBasicMaterial color="#60a5fa" />
        </mesh>
      ) : null}
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
