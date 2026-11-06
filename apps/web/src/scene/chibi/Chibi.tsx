import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSettings } from '../../store/settings';
import { CHIBI_SCALE, JOINTS, chibiMaterial, chibiOutline, chibiParts, type ChibiSpec } from './buildChibi';

interface Rig {
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

/**
 * A chibi character with procedural animation (no skeleton, no clips): joints are plain groups rotated every
 * frame toward a pose picked from `anim`. Cheap, and every look animates the same way.
 */
export const Chibi = memo(function Chibi({ spec, anim, hug = false }: { spec: ChibiSpec; anim: string; hug?: boolean }) {
  const parts = useMemo(() => chibiParts(spec), [spec]);
  const quality = useSettings((s) => s.quality);
  const outline = quality === 'high';
  const rig = useRef<Partial<Rig>>({});
  const state = useRef({ t: Math.random() * 10, phase: 0, animT: 0, last: anim });
  const set = (k: keyof Rig) => (g: THREE.Group | null) => {
    if (g) rig.current[k] = g;
  };

  useFrame((_, rawDt) => {
    const r = rig.current as Rig;
    if (!r.hips) return;
    const dt = Math.min(rawDt, 0.1);
    const st = state.current;
    st.t += dt;
    if (st.last !== anim) {
      st.last = anim;
      st.animT = 0;
    }
    st.animT += dt;
    pose(r, anim, st, dt, hug);
  });

  const mat = chibiMaterial();
  const ol = chibiOutline();
  const part = (g: THREE.BufferGeometry) => (
    <>
      <mesh geometry={g} material={mat} castShadow />
      {outline ? <mesh geometry={g} material={ol} /> : null}
    </>
  );
  return (
    <group scale={CHIBI_SCALE}>
      <group ref={set('hips')} position={JOINTS.hips as unknown as THREE.Vector3Tuple}>
        <group ref={set('legL')} position={JOINTS.legL as unknown as THREE.Vector3Tuple}>
          {part(parts.legL)}
        </group>
        <group ref={set('legR')} position={JOINTS.legR as unknown as THREE.Vector3Tuple}>
          {part(parts.legR)}
        </group>
        <group ref={set('torso')}>
          {part(parts.torso)}
          <group ref={set('armL')} position={JOINTS.armL as unknown as THREE.Vector3Tuple}>
            {part(parts.armL)}
          </group>
          <group ref={set('armR')} position={JOINTS.armR as unknown as THREE.Vector3Tuple}>
            {part(parts.armR)}
          </group>
          <group ref={set('head')} position={JOINTS.head as unknown as THREE.Vector3Tuple}>
            {part(parts.head)}
          </group>
        </group>
      </group>
    </group>
  );
});

// ------------------------------------------------------------------------------------------------ poses
interface Pose {
  hipY: number;
  lean: number;
  sway: number;
  twist: number;
  headX: number;
  headY: number;
  headZ: number;
  armLX: number;
  armLZ: number;
  armRX: number;
  armRZ: number;
  legLX: number;
  legRX: number;
}
const rest = (): Pose => ({ hipY: 0, lean: 0, sway: 0, twist: 0, headX: 0, headY: 0, headZ: 0, armLX: 0, armLZ: 0.22, armRX: 0, armRZ: -0.22, legLX: 0, legRX: 0 });
const HIP_Y = JOINTS.hips[1];

function target(anim: string, st: { t: number; phase: number; animT: number }, dt: number): Pose {
  const p = rest();
  const t = st.t;
  switch (anim) {
    case 'walk':
    case 'run': {
      const run = anim === 'run';
      st.phase += dt * (run ? 15 : 10);
      const s = Math.sin(st.phase);
      const amp = run ? 0.95 : 0.6;
      p.legLX = s * amp;
      p.legRX = -s * amp;
      p.armLX = -s * amp * 0.9;
      p.armRX = s * amp * 0.9;
      p.armLZ = run ? 0.35 : 0.25;
      p.armRZ = -p.armLZ;
      p.hipY = Math.abs(Math.cos(st.phase)) * (run ? 0.05 : 0.03);
      p.lean = run ? 0.22 : 0.06;
      p.twist = s * 0.12;
      p.headZ = s * 0.05;
      p.headX = run ? -0.12 : 0;
      break;
    }
    case 'wave': {
      p.armRZ = -2.55 + Math.sin(t * 11) * 0.35;
      p.armRX = -0.2;
      p.headZ = 0.12;
      p.sway = Math.sin(t * 3) * 0.04;
      p.hipY = Math.abs(Math.sin(t * 3)) * 0.01;
      break;
    }
    case 'talk':
    case 'yes': {
      p.headX = Math.sin(t * 7) * 0.14 + 0.05;
      p.armLX = -0.4 + Math.sin(t * 4) * 0.2;
      p.armRX = -0.3 - Math.sin(t * 4.5) * 0.2;
      p.hipY = Math.abs(Math.sin(t * 3.5)) * 0.01;
      break;
    }
    case 'no': {
      p.headY = Math.sin(t * 10) * 0.4;
      p.armLZ = 0.5;
      p.armRZ = -0.5;
      break;
    }
    case 'thumbsup': {
      p.armRX = -1.45;
      p.armRZ = -0.15;
      p.headZ = 0.15;
      p.hipY = Math.abs(Math.sin(t * 4)) * 0.015;
      break;
    }
    case 'dance': {
      const b = t * 8;
      p.hipY = Math.abs(Math.sin(b)) * 0.06;
      p.sway = Math.sin(b / 2) * 0.18;
      p.twist = Math.sin(b / 2) * 0.25;
      p.armLZ = 2.3 + Math.sin(b) * 0.4;
      p.armRZ = -2.3 + Math.sin(b + 1) * 0.4;
      p.headZ = Math.sin(b / 2) * 0.2;
      p.legLX = Math.max(0, Math.sin(b / 2)) * 0.5;
      p.legRX = Math.max(0, -Math.sin(b / 2)) * 0.5;
      break;
    }
    case 'sit': {
      // on a chair: thighs forward, hands resting on the table, a little idle sway
      p.legLX = p.legRX = -1.45;
      p.armLX = p.armRX = -0.95;
      p.armLZ = 0.12;
      p.armRZ = -0.12;
      p.headX = 0.08 + Math.sin(t * 1.3) * 0.03;
      p.headY = Math.sin(t * 0.4) * 0.25 * Math.max(0, Math.sin(t * 0.17));
      break;
    }
    case 'eat': {
      // seated at the table: fork from the plate to the mouth, head dipping to meet it, a happy wiggle
      const k = (Math.sin(t * 4) + 1) / 2;
      p.legLX = p.legRX = -1.45;
      p.armLX = -0.95;
      p.armLZ = 0.12;
      p.armRX = -0.9 - k * 1.25;
      p.armRZ = -0.12 + k * 0.45;
      p.headX = 0.12 + (1 - k) * 0.12;
      p.headZ = Math.sin(t * 2) * 0.05;
      break;
    }
    case 'swim': {
      // front crawl: arms windmill, legs flutter, head up looking ahead
      st.phase += dt * 5;
      const s = Math.sin(st.phase);
      p.lean = 0.55;
      p.armLX = -1.7 + s * 1.5;
      p.armRX = -1.7 - s * 1.5;
      p.armLZ = 0.3;
      p.armRZ = -0.3;
      p.legLX = Math.sin(st.phase * 2.5) * 0.35;
      p.legRX = -p.legLX;
      p.headX = -0.35;
      p.hipY = Math.sin(st.phase * 2) * 0.02;
      break;
    }
    case 'tread': {
      // treading water: arms sculling out to the sides, slow bob
      p.armLZ = 1.0 + Math.sin(t * 3) * 0.25;
      p.armRZ = -p.armLZ;
      p.armLX = p.armRX = -0.3;
      p.legLX = Math.sin(t * 3) * 0.3;
      p.legRX = -p.legLX;
      p.hipY = Math.sin(t * 1.8) * 0.03;
      break;
    }
    case 'jump': {
      p.armLZ = 2.2;
      p.armRZ = -2.2;
      p.legLX = -0.6;
      p.legRX = 0.3;
      p.headX = -0.15;
      break;
    }
    default: {
      // idle: breathing, a slow look around now and then
      p.hipY = Math.sin(t * 2.2) * 0.006;
      p.headZ = Math.sin(t * 0.9) * 0.05;
      p.headY = Math.sin(t * 0.37) * 0.25 * Math.max(0, Math.sin(t * 0.21));
      p.armLZ = 0.22 + Math.sin(t * 2.2) * 0.03;
      p.armRZ = -0.22 - Math.sin(t * 2.2) * 0.03;
    }
  }
  return p;
}

const cur = new WeakMap<Rig, Pose>();
function pose(r: Rig, anim: string, st: { t: number; phase: number; animT: number }, dt: number, hug = false) {
  const goal = target(anim, st, dt);
  if (hug) {
    // arms wrapped around the pet in front of the chest (legs keep walking)
    goal.armLX = goal.armRX = -1.25;
    goal.armLZ = -0.45;
    goal.armRZ = 0.45;
    goal.headX += 0.12;
  }
  let c = cur.get(r);
  if (!c) cur.set(r, (c = { ...goal }));
  const fast = anim === 'walk' || anim === 'run' || anim === 'wave' || anim === 'dance' || anim === 'no' || anim === 'talk' || anim === 'yes';
  const k = 1 - Math.exp(-dt * (fast ? 22 : 9));
  for (const key of Object.keys(goal) as (keyof Pose)[]) c[key] += (goal[key] - c[key]) * k;
  // A little squash on landing / stretch while jumping makes it feel bouncy.
  const squash = anim === 'jump' ? 1.04 : 1;
  r.hips.position.y = HIP_Y + c.hipY;
  r.hips.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  r.torso.rotation.set(c.lean, c.twist, c.sway);
  r.head.rotation.set(c.headX - c.lean * 0.6, c.headY - c.twist * 0.8, c.headZ - c.sway * 0.8);
  r.armL.rotation.set(c.armLX, 0, c.armLZ);
  r.armR.rotation.set(c.armRX, 0, c.armRZ);
  r.legL.rotation.x = c.legLX;
  r.legR.rotation.x = c.legRX;
}
