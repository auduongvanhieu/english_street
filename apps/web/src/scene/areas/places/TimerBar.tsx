import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

/** "2:05" / "45s" left until `end` (ms). */
export function timeLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const W = 1.1;

/**
 * A small progress bar over a plot or a pen that always faces the camera: filled from `from` to `from + ms`
 * (clock = `now()`), with the time left next to an optional icon. Updated every frame without re-rendering React.
 */
export function TimerBar({ from, ms, now, y, icon = '', color = '#43b86a' }: { from: number; ms: number; now: () => number; y: number; icon?: string; color?: string }) {
  const fill = useRef<THREE.Mesh>(null);
  const label = useRef<{ text: string; sync: () => void } | null>(null);
  const last = useRef('');
  useFrame(() => {
    const t = now();
    const k = Math.min(1, Math.max(0, (t - from) / ms));
    if (fill.current) {
      fill.current.scale.x = Math.max(0.001, k);
      fill.current.position.x = (-W / 2) * (1 - k);
    }
    const txt = `${icon}${icon ? ' ' : ''}${timeLeft(from + ms - t)}`;
    if (label.current && txt !== last.current) {
      last.current = txt;
      label.current.text = txt;
      label.current.sync();
    }
  });
  return (
    <Billboard position={[0, y, 0]}>
      <mesh position={[0, 0, -0.005]}>
        <planeGeometry args={[W + 0.08, 0.2]} />
        <meshBasicMaterial color="#1d2b1f" transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh ref={fill}>
        <planeGeometry args={[W, 0.13]} />
        <meshBasicMaterial color={color} depthWrite={false} />
      </mesh>
      <Text ref={label as never} position={[0, 0.26, 0]} fontSize={0.24} color="#ffffff" outlineWidth={0.025} outlineColor="#1d2b1f" anchorX="center" anchorY="middle">
        {' '}
      </Text>
    </Billboard>
  );
}
