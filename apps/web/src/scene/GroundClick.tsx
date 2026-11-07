import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { lastPointer } from '../input/camera';
import { moveTarget, walkTo } from '../input/clickMove';
import { INTERIOR_BOUNDS, MAPLE_HILL, inRect } from '@es/shared';
import { walkable } from '../world/areas';
import { floorAt, localPos } from './LocalPlayer';
import { useGame } from '../store/game';
import { decorTap, useMyFarm } from '../store/myFarm';

/**
 * An invisible ground plane (following the player) that turns a mouse click on the ground into "walk there" (players, animals, shop
 * items… catch their own clicks first and stop them). A ring marks the spot until the player gets there.
 */
export function GroundClick() {
  const ring = useRef<THREE.Mesh>(null);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), []);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // decorating your farm: a tap (any pointer) puts the item down or takes one away
    if (useMyFarm.getState().decorating !== null && e.delta <= 6) {
      decorTap(e.point.x, e.point.z);
      return;
    }
    if (lastPointer.type !== 'mouse' || e.delta > 6 || e.button !== 0) return; // a drag that turned the camera
    if (useGame.getState().panelNpc) return;
    // on hills the ground mesh is above this plane: use the first thing the ray hit (the hillside under the cursor)
    const hit = inRect(MAPLE_HILL, e.point.x, e.point.z, 10) ? (e.intersections[0]?.point ?? e.point) : e.point;
    const { x, z } = hit;
    // the street keeps its walkable map; farms, rooms and the train places rely on the player's own colliders
    if (!walkable(x, z) && !inRect(INTERIOR_BOUNDS, x, z)) return;
    walkTo(x, z, localPos);
  };
  const plane = useRef<THREE.Mesh>(null);
  useFrame(() => {
    // the click plane follows the player (the street, the farms and the train places are far apart)
    if (plane.current) plane.current.position.set(Math.round(localPos.x / 20) * 20, 0.02, Math.round(localPos.z / 20) * 20);
    const r = ring.current;
    if (!r) return;
    r.visible = moveTarget.active;
    if (!r.visible) return;
    const t = (performance.now() - moveTarget.at) / 1000;
    r.position.set(moveTarget.x, floorAt(moveTarget.x, moveTarget.z) + 0.06, moveTarget.z);
    const s = 0.8 + 0.15 * Math.sin(t * 6);
    r.scale.set(s, s, s);
  });
  return (
    <group>
      <mesh ref={plane} rotation-x={-Math.PI / 2} position={[0, 0.02, 24]} material={hitMat} onClick={onClick}>
        <planeGeometry args={[400, 400]} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
        <ringGeometry args={[0.32, 0.45, 28]} />
        <meshBasicMaterial color="#ffe14d" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}
