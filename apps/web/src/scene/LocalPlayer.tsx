import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { INPUT_RATE_HZ, WALK_SPEED } from '@es/shared';
import { sendInput } from '../net/client';
import { PlayerMesh } from './PlayerMesh';

export type Controls = 'forward' | 'back' | 'left' | 'right' | 'run';

const CAM_OFFSET = new THREE.Vector3(0, 6, 9);
const tmpDir = new THREE.Vector3();
const tmpCam = new THREE.Vector3();

export function LocalPlayer({ name }: { name: string }) {
  const ref = useRef<THREE.Group>(null);
  const [, get] = useKeyboardControls<Controls>();
  const camera = useThree((s) => s.camera);
  const lastSend = useRef(0);
  const anim = useRef('idle');

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const { forward, back, left, right, run } = get();
    tmpDir.set((right ? 1 : 0) - (left ? 1 : 0), 0, (back ? 1 : 0) - (forward ? 1 : 0));
    const moving = tmpDir.lengthSq() > 0;
    if (moving) {
      tmpDir.normalize();
      const speed = WALK_SPEED * (run ? 2 : 1);
      g.position.addScaledVector(tmpDir, speed * dt);
      g.rotation.y = Math.atan2(tmpDir.x, tmpDir.z);
      anim.current = run ? 'run' : 'walk';
    } else {
      anim.current = 'idle';
    }

    // Third-person follow camera
    tmpCam.copy(g.position).add(CAM_OFFSET);
    camera.position.lerp(tmpCam, 1 - Math.pow(0.001, dt));
    camera.lookAt(g.position.x, g.position.y + 1, g.position.z);

    // Network send at fixed rate
    lastSend.current += dt;
    if (lastSend.current >= 1 / INPUT_RATE_HZ) {
      lastSend.current = 0;
      sendInput(g.position.x, g.position.z, g.rotation.y, anim.current);
    }
  });

  return (
    <group ref={ref} position={[0, 0, 4]}>
      <PlayerMesh name={name} color="#4a90e2" />
    </group>
  );
}
