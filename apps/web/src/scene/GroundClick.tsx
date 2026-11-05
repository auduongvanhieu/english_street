import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { lastPointer } from '../input/camera';
import { moveTarget, walkTo } from '../input/clickMove';
import { walkable } from '../world/areas';
import { localPos } from './LocalPlayer';
import { useGame } from '../store/game';

/**
 * An invisible ground plane that turns a mouse click on the street into "walk there" (players, animals, shop
 * items… catch their own clicks first and stop them). A ring marks the spot until the player gets there.
 */
export function GroundClick() {
  const ring = useRef<THREE.Mesh>(null);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), []);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (lastPointer.type !== 'mouse' || e.delta > 6 || e.button !== 0) return; // a drag that turned the camera
    if (useGame.getState().panelNpc) return;
    const { x, z } = e.point;
    if (!walkable(x, z)) return;
    walkTo(x, z, localPos);
  };
  useFrame(() => {
    const r = ring.current;
    if (!r) return;
    r.visible = moveTarget.active;
    if (!r.visible) return;
    const t = (performance.now() - moveTarget.at) / 1000;
    r.position.set(moveTarget.x, 0.06, moveTarget.z);
    const s = 0.8 + 0.15 * Math.sin(t * 6);
    r.scale.set(s, s, s);
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 24]} material={hitMat} onClick={onClick}>
        <planeGeometry args={[620, 116]} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
        <ringGeometry args={[0.32, 0.45, 28]} />
        <meshBasicMaterial color="#ffe14d" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}
