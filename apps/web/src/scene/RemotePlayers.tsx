import { useMemo, useRef, useState } from 'react';
import { decodeBus, riderHidden } from '../world/bus';
import { serverNow } from '../net/client';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, type RemotePlayer } from '../store/game';
import { PlayerAvatar } from './PlayerAvatar';
import { parseLook } from '@es/shared';
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
  const look = useMemo(() => parseLook(p.avatar), [p.avatar]);
  // Interpolate toward the last known server position for smooth motion.
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0001, dt);
    // Bus ride / teleport: jump instead of sliding across the whole street.
    if (Math.abs(p.x - g.position.x) + Math.abs(p.z - g.position.z) > 25) g.position.set(p.x, p.y, p.z);
    g.position.x += (p.x - g.position.x) * k;
    g.position.y += (p.y - g.position.y) * Math.min(1, k * 1.6);
    g.position.z += (p.z - g.position.z) * k;
    g.rotation.y += shortestAngle(g.rotation.y, p.rot) * k;
    // inside a bus: not drawn (the bus is)
    const bus = decodeBus(p.bus);
    g.visible = !(bus && riderHidden(bus, serverNow()));
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
      {near ? <PlayerAvatar anim={p.anim} look={look} holding={p.holding} prop={p.prop} /> : null}
      {tag ? <NameTag name={p.name} bubble={p.bubble} badge={badge} tag={look.tag} /> : null}
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
