import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store/game';
import { useTutorial } from '../store/tutorial';

/** Tutorial "talk" step: a bouncing yellow arrow over the NPC to walk to. */
export function TutorialArrow() {
  const target = useTutorial((s) => (s.step === 'talk' ? s.target : null));
  const npc = useGame((s) => (target ? s.npcs.find((n) => n.id === target) : undefined));
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = performance.now() / 1000;
    g.position.y = 3.3 + Math.sin(t * 4) * 0.2;
    g.rotation.y = t * 1.5;
  });
  if (!npc) return null;
  return (
    <group position={[npc.position[0], 0, npc.position[2]]}>
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
