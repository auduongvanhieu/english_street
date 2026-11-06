import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store/game';
import { useTutorial } from '../store/tutorial';
import { currentStep, guideTarget, useJourney } from '../store/journey';
import { MAIN_STEPS, stepById } from '@es/shared';

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
