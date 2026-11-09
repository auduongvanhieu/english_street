import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { localPos } from './LocalPlayer';
import { sky } from '../world/sky';
import { useArea } from '../store/area';

/**
 * The sun (directional light + its shadow box) follows the player along the now 340 m long street, snapped to
 * 4 m steps so the shadow map does not shimmer while walking. Direction, colour and strength come from the
 * sky (world/sky.ts): the real sun by day, the moon at night.
 */
export function SunFollow({ low }: { low: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    scene.add(l.target);
    return () => void scene.remove(l.target);
  }, [scene]);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const x = Math.round(localPos.x / 4) * 4;
    const z = Math.round(localPos.z / 4) * 4 - 4;
    l.color.copy(sky.lightColor);
    l.intensity = sky.lightIntensity;
    l.position.set(x + sky.lightDir.x * 50, sky.lightDir.y * 50, z + sky.lightDir.z * 50);
    // inside an area (one yard, 56 × 24 m) a smaller shadow box: fewer things in the shadow pass, crisper shadows
    const [hw, hd] = useArea.getState().current ? [28, 22] : [45, 30];
    const cam = l.shadow.camera;
    if (cam.right !== hw) {
      Object.assign(cam, { left: -hw, right: hw, top: hd, bottom: -hd });
      cam.updateProjectionMatrix();
    }
    if (l.target.position.x === x && l.target.position.z === z) return;
    l.target.position.set(x, 0, z);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      position={[30, 40, 20]}
      intensity={1.6}
      castShadow={!low}
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.04}
      shadow-camera-left={-45}
      shadow-camera-right={45}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
    />
  );
}
