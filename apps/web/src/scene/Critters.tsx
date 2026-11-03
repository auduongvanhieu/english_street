import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { CRITTERS, poseAt, type Critter, type CritterKind } from '../world/critters';
import { serverNow } from '../net/client';
import { useGame } from '../store/game';
import { localPos } from './LocalPlayer';
import { NameTag } from './NameTag';

const URL = (k: CritterKind) => `/models/critters/${k}.glb`;
const HEIGHT: Record<CritterKind, number> = { cat: 0.45, shiba: 0.62, husky: 0.72 };
/** game clip → model clip (cat and dogs use different Quaternius rigs) */
const CLIPS: Record<CritterKind, Record<string, string>> = {
  cat: { walk: 'Walk', idle: 'Idle', nap: 'Idle_Eating', react: 'Idle_Eating' },
  shiba: { walk: 'Walk', idle: 'Idle', nap: 'Idle_2_HeadLow', react: 'Idle_2' },
  husky: { walk: 'Walk', idle: 'Idle', nap: 'Idle_2_HeadLow', react: 'Idle_2' },
};
/** Critters beyond this distance are not animated/drawn (they are tiny anyway). */
const DRAW_RADIUS = 36;
(['cat', 'shiba', 'husky'] as CritterKind[]).forEach((k) => useGLTF.preload(URL(k), false, true));

export function Critters() {
  return (
    <>
      {CRITTERS.map((c) => (
        <CritterView key={c.id} c={c} />
      ))}
    </>
  );
}

function CritterView({ c }: { c: Critter }) {
  const { scene, animations } = useGLTF(URL(c.kind), false, true);
  const model = useMemo(() => {
    const m = SkeletonUtils.clone(scene);
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    const s = HEIGHT[c.kind] / Math.max(box.max.y - box.min.y, 0.001);
    m.scale.setScalar(s);
    m.position.y = -box.min.y * s;
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
    return m;
  }, [scene, c.kind]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<string>('');
  const [near, setNear] = useState(true);
  const reactUntil = useRef(0);
  const selected = useGame((s) => s.selectedCritter === c.id);
  const select = useGame((s) => s.setSelectedCritter);
  const acc = useRef(0);

  function play(name: string) {
    const clip = CLIPS[c.kind][name] ?? CLIPS[c.kind].idle!;
    if (clip === current.current) return;
    const next = actions[clip];
    if (!next) return;
    const prev = current.current ? actions[current.current] : null;
    prev?.fadeOut(0.3);
    next.reset().fadeIn(0.3).play();
    current.current = clip;
  }

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const reacting = reactUntil.current > Date.now();
    const pose = poseAt(c, serverNow());
    if (!reacting) {
      // Ease toward the scheduled pose so joining mid-walk never snaps.
      const k = 1 - Math.pow(0.001, dt);
      g.position.x += (pose.x - g.position.x) * k;
      g.position.z += (pose.z - g.position.z) * k;
      g.rotation.y += shortestAngle(g.rotation.y, pose.rot) * k;
      play(pose.clip === 'walk' ? 'walk' : pose.pauseT > 0.25 ? 'nap' : 'idle');
    } else {
      // Face the player while reacting.
      g.rotation.y += shortestAngle(g.rotation.y, Math.atan2(localPos.x - g.position.x, localPos.z - g.position.z)) * 0.1;
      play('react');
    }
    acc.current += dt;
    if (acc.current > 0.3) {
      acc.current = 0;
      const n = Math.hypot(g.position.x - localPos.x, g.position.z - localPos.z) < DRAW_RADIUS;
      if (n !== near) setNear(n);
    }
  });
  useEffect(() => {
    if (selected) reactUntil.current = Date.now() + 4000;
  }, [selected]);

  const p0 = poseAt(c, serverNow());
  return (
    <group
      ref={group}
      position={[p0.x, 0, p0.z]}
      rotation={[0, p0.rot, 0]}
      onClick={(e) => {
        e.stopPropagation();
        select(selected ? null : c.id);
      }}
    >
      {near ? <primitive object={model} /> : null}
      {near && selected ? <NameTag name={c.name} sub={c.kind === 'cat' ? 'cat' : 'dog'} y={HEIGHT[c.kind] + 0.5} /> : null}
    </group>
  );
}

function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
