import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FOOTBALL, goalOf, type Team } from '@es/shared';
import { ballState, sendSport } from '../../../net/client';
import { useGame } from '../../../store/game';
import { useSports } from '../../../store/sports';
import { localPos } from '../../LocalPlayer';
import { useLpmParts } from '../../LpmModel';
import { chibiMaterial } from '../../chibi/buildChibi';
import { registerUsable, unregisterUsable, useNearUsable, useUsable, type Usable } from '../../../world/usables';
import { BENCHES } from '../../../world/places/sports';
import { t } from '../../../i18n';

/**
 * The live football (server physics, see game-server rooms/football.ts): the ball, the "Kick" action that follows
 * it, the two team benches and a coloured ring under every player on a team. World coordinates.
 */
const R = FOOTBALL.ballR;
const TEAM_COLOR: Record<Team, string> = { red: '#e05a47', blue: '#2f80ed' };


function kickNow() {
  const b = ballState;
  const team = useSports.getState().team;
  const px = localPos.x;
  const pz = localPos.z;
  let dir = Math.atan2(b.x - px, b.z - pz);
  let power = 0.55;
  if (team) {
    const gx = goalOf(team);
    const gz = FOOTBALL.goalZ + (Math.random() - 0.5) * 2.6; // not every shot is on target
    const d = Math.hypot(gx - b.x, gz - b.z);
    dir = Math.atan2(gx - b.x, gz - b.z);
    // close: a shot (harder the further out); far: a long ball up the pitch
    power = d < 16 ? Math.min(1, 0.35 + d / 20) : 0.6;
  }
  sendSport({ op: 'kick', dir, power });
}

function Ball() {
  const parts = useLpmParts('sports_kit');
  const ref = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const pos = useRef(new THREE.Vector3(ballState.x, ballState.y, ballState.z));
  const geo = useMemo(() => parts['SM_SP_Football']!.clone().translate(0, -R, 0), [parts]);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame((_, dt) => {
    const g = ref.current;
    const m = spin.current;
    if (!g || !m) return;
    const b = ballState;
    if (b.y < -5) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const p = pos.current;
    const jump = Math.hypot(b.x - p.x, b.z - p.z) > 6; // reset to the centre spot: snap
    const k = jump ? 1 : Math.min(1, dt * 14);
    const ox = p.x;
    const oz = p.z;
    p.x += (b.x - p.x) * k;
    p.y += (b.y - p.y) * k;
    p.z += (b.z - p.z) * k;
    g.position.set(p.x, 0, p.z);
    m.position.y = Math.max(R, p.y);
    // roll: turn about the axis across the motion by distance / radius
    const dx = p.x - ox;
    const dz = p.z - oz;
    const d = Math.hypot(dx, dz);
    if (d > 1e-4 && !jump) {
      axis.set(dz / d, 0, -dx / d);
      q.setFromAxisAngle(axis, d / R);
      m.quaternion.premultiply(q);
    }
    if (shadow.current) shadow.current.scale.setScalar(1 - Math.min(0.6, (p.y - R) * 0.25));
  });
  return (
    <group ref={ref}>
      <mesh ref={spin} geometry={geo} material={chibiMaterial()} castShadow />
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position-y={0.025}>
        <circleGeometry args={[R * 1.1, 12]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** "Kick" follows the ball: one usable whose position is moved every frame. */
function KickAction() {
  const u = useMemo<Usable>(() => ({ id: 'football-kick', x: 0, z: -1e4, r: FOOTBALL.kickReach + 0.15, icon: '⚽', label: t('Kick the ball'), use: kickNow }), []);
  useEffect(() => {
    registerUsable(u);
    return () => {
      unregisterUsable(u.id);
      if (useNearUsable.getState().near?.id === u.id) useNearUsable.setState({ near: null });
    };
  }, [u]);
  useFrame(() => {
    u.x = ballState.x;
    u.z = ballState.z;
  });
  return null;
}

function TeamBench({ team }: { team: Team }) {
  const mine = useSports((s) => s.team);
  const [x, z] = team === 'red' ? BENCHES.red : BENCHES.blue;
  useUsable({
    id: `football-team-${team}`,
    x,
    z,
    r: 1.6,
    icon: team === 'red' ? '🔴' : '🔵',
    label: mine === team ? t('Leave the team') : team === 'red' ? t('Join the red team') : t('Join the blue team'),
    use: () => useSports.getState().setTeam(useSports.getState().team === team ? '' : team),
  });
  return null;
}

const ringGeo = new THREE.RingGeometry(0.42, 0.55, 20).rotateX(-Math.PI / 2);
const ringMat: Record<Team, THREE.MeshBasicMaterial> = {
  red: new THREE.MeshBasicMaterial({ color: TEAM_COLOR.red, transparent: true, opacity: 0.85, depthWrite: false }),
  blue: new THREE.MeshBasicMaterial({ color: TEAM_COLOR.blue, transparent: true, opacity: 0.85, depthWrite: false }),
};

/** A coloured ring on the ground under everyone on a team (me included). */
function TeamRings() {
  const me = useSports((s) => s.team);
  const others = useGame((s) => Object.values(s.players).filter((p) => p.team === 'red' || p.team === 'blue').map((p) => `${p.id}:${p.team}`).join(','));
  const sid = useGame((s) => s.sessionId);
  const list = useMemo(() => (others ? others.split(',').map((x) => x.split(':') as [string, Team]) : []).filter(([id]) => id !== sid), [others, sid]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const mine = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const players = useGame.getState().players;
    list.forEach(([id], i) => {
      const m = refs.current[i];
      const p = players[id];
      if (m && p) m.position.set(p.x, 0.03, p.z);
    });
    mine.current?.position.set(localPos.x, 0.03, localPos.z);
  });
  return (
    <group>
      {me ? <mesh ref={mine} geometry={ringGeo} material={ringMat[me]} renderOrder={2} /> : null}
      {list.map(([id, team], i) => (
        <mesh key={id} ref={(m) => void (refs.current[i] = m)} geometry={ringGeo} material={ringMat[team]} renderOrder={2} />
      ))}
    </group>
  );
}

export default function Football() {
  return (
    <group>
      <Ball />
      <KickAction />
      <TeamBench team="red" />
      <TeamBench team="blue" />
      <TeamRings />
    </group>
  );
}
