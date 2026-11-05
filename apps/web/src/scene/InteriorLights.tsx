import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sky } from '../world/sky';

/**
 * Two real point lights that light the room the player is in at night. Always mounted (a changing light count
 * makes three recompile every material); BuildingShell calls interior.set() while the player is inside.
 */
export const interior = {
  x: 0,
  z: 0,
  half: 0,
  alongX: true,
  at: -1,
  set(x: number, z: number, half: number, alongX: boolean) {
    this.x = x;
    this.z = z;
    this.half = half;
    this.alongX = alongX;
    this.at = performance.now();
  },
};

export function InteriorLights() {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  useFrame(() => {
    // BuildingShell refreshes this 5× a second while inside; stale = outside
    const inside = performance.now() - interior.at < 600;
    const k = inside ? Math.max(sky.lamps, 0.25 * (1 - sky.day)) : 0;
    lights.current.forEach((l, i) => {
      if (!l) return;
      const off = (i === 0 ? -0.5 : 0.5) * interior.half;
      l.position.set(interior.x + (interior.alongX ? off : 0), 2.7, interior.z + (interior.alongX ? 0 : off));
      l.distance = Math.max(9, interior.half * 1.6);
      l.intensity = k * 6;
    });
  });
  return (
    <>
      {[0, 1].map((i) => (
        <pointLight key={i} ref={(el) => (lights.current[i] = el)} color="#ffe2b0" intensity={0} distance={10} decay={1.2} />
      ))}
    </>
  );
}
