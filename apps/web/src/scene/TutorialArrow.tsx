import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store/game';
import { useTutorial } from '../store/tutorial';
import { currentStep, guideTarget, useJourney } from '../store/journey';
import { MAIN_STEPS, stepById } from '@es/shared';
import { useBus } from '../store/bus';
import { localPos } from './LocalPlayer';

/**
 * A bouncing yellow arrow: over the NPC of the tutorial's "talk" step, else over where the journey wants you
 * (the step you asked "Take me there" for, or the current chapter's person).
 */
export function TutorialArrow() {
  const target = useTutorial((s) => (s.step === 'talk' ? s.target : null));
  const tutorial = useTutorial((s) => !!s.step);
  const guiding = useJourney((s) => s.guiding);
  const view = useJourney((s) => s.view);
  const step = guiding ? stepById(guiding) : currentStep(view);
  const journeyNpc = !tutorial && step?.guide && 'npc' in step.guide && (guiding || MAIN_STEPS.includes(step)) ? step.guide.npc : null;
  const npc = useGame((s) => (target || journeyNpc ? s.npcs.find((n) => n.id === (target ?? journeyNpc)) : undefined));
  const spot = !tutorial && !npc && guiding && step ? guideTarget(step.guide) : null;
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = performance.now() / 1000;
    g.position.y = 3.3 + Math.sin(t * 4) * 0.2;
    g.rotation.y = t * 1.5;
  });
  if (!npc && !spot) return null;
  return (
    <group position={npc ? [npc.position[0], 0, npc.position[2]] : [spot!.x, -1.2, spot!.z]}>
      <group ref={ref}>
        <mesh rotation-x={Math.PI}>
          <coneGeometry args={[0.35, 0.6, 4]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.2, 0.55, 0.2]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>
    </group>
  );
}

const DOTS = 44;
const GAP = 1.5;
/**
 * "Take me there", the walking part: yellow dots on the ground from the player to the target (through the area's
 * gate), drifting forward. Hidden while riding the bus. On arrival the dots go and an NPC's panel opens.
 */
export function GuideTrail() {
  const walk = useJourney((s) => s.walk);
  const riding = useBus((s) => !!s.ride);
  const ref = useRef<THREE.InstancedMesh>(null);
  const o = useRef(new THREE.Object3D());
  const via = useRef<{ x: number; z: number } | null>(null);
  // a new walk: start with its gate
  const last = useRef<typeof walk>(null);
  if (walk !== last.current) {
    last.current = walk;
    via.current = walk?.via ?? null;
  }
  useFrame(() => {
    const m = ref.current;
    const w = useJourney.getState().walk;
    if (!m || !w) return;
    const px = localPos.x;
    const pz = localPos.z;
    // reached the gate: straight to the target
    if (via.current && Math.hypot(via.current.x - px, via.current.z - pz) < 2.5) via.current = null;
    if (Math.hypot(w.x - px, w.z - pz) < 2.2) {
      useJourney.getState().stopWalk();
      via.current = null;
      if (w.npc) useGame.getState().openPanel(w.npc);
      return;
    }
    const pts: [number, number][] = [[px, pz], ...(via.current ? [[via.current.x, via.current.z] as [number, number]] : []), [w.x, w.z]];
    const shift = ((performance.now() / 1000) * 1.2) % GAP;
    let seg = 0;
    let along = 1.2 + shift;
    let used = 0;
    for (let i = 0; i < DOTS; i++) {
      let placed = false;
      while (seg < pts.length - 1) {
        const [ax, az] = pts[seg]!;
        const [bx, bz] = pts[seg + 1]!;
        const len = Math.hypot(bx - ax, bz - az);
        if (along <= len) {
          const k = along / len;
          o.current.position.set(ax + (bx - ax) * k, 0.06, az + (bz - az) * k);
          const s = i > DOTS - 6 ? (DOTS - i) / 6 : 1;
          o.current.scale.set(s, 1, s);
          o.current.updateMatrix();
          m.setMatrixAt(i, o.current.matrix);
          along += GAP;
          placed = true;
          used = i + 1;
          break;
        }
        along -= len;
        seg += 1;
      }
      if (!placed) break;
    }
    m.count = used;
    m.instanceMatrix.needsUpdate = true;
  });
  if (!walk || riding) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DOTS]} frustumCulled={false} renderOrder={3}>
      <cylinderGeometry args={[0.16, 0.16, 0.04, 12]} />
      <meshBasicMaterial color="#facc15" transparent opacity={0.9} depthWrite={false} />
    </instancedMesh>
  );
}
