import { useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';

export const CHARACTER_URL = '/models/characters/RobotExpressive.glb';
const TARGET_HEIGHT = 1.7;

/** Game animation name -> clip name inside RobotExpressive.glb */
const CLIP: Record<string, string> = {
  idle: 'Idle',
  walk: 'Walking',
  run: 'Running',
  wave: 'Wave',
  talk: 'Yes',
  dance: 'Dance',
  thumbsup: 'ThumbsUp',
  yes: 'Yes',
  no: 'No',
  jump: 'Jump',
};
/** Clips that play once and hold their last frame instead of looping. */
const ONCE = new Set(['Jump']);

export function Character({ anim, tint }: { anim: string; tint?: string }) {
  const { scene, animations } = useGLTF(CHARACTER_URL);

  // Skinned meshes must be cloned with SkeletonUtils so each instance gets its own skeleton.
  const model = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(box.max.y - box.min.y, 0.001);
    const s = TARGET_HEIGHT / h;
    c.scale.setScalar(s);
    c.position.y = -box.min.y * s;
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false; // skinned bounds are unreliable; avoid popping
      const mat = m.material as THREE.MeshStandardMaterial;
      if (tint && mat?.name === 'Main') {
        const copy = mat.clone();
        copy.color.set(tint);
        m.material = copy;
      }
    });
    return c;
  }, [scene, tint]);

  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const next = actions[CLIP[anim] ?? 'Idle'];
    if (!next || next === current.current) return;
    current.current?.fadeOut(0.2);
    if (ONCE.has(next.getClip().name)) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    next.reset().fadeIn(0.1).play();
    current.current = next;
  }, [anim, actions]);

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(CHARACTER_URL);
