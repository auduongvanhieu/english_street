import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { GRAVITY, INPUT_RATE_HZ, INTERACT_RADIUS, JUMP_SPEED, WALK_SPEED } from '@es/shared';
import { sendInput } from '../net/client';
import { useVoiceChat } from '../net/voicechat';
import { useProfile } from '../store/profile';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { joystick, jumpInput } from '../input/joystick';
import { hopSound } from '../audio/ambient';
import { cameraOrbit } from '../input/camera';
import { buildBlockers, resolveMove } from '../world/layout';
import { Character } from './Character';
import { NameTag } from './NameTag';

export type Controls = 'forward' | 'back' | 'left' | 'right' | 'run';

/** Live local position (mutable, read by RemotePlayers for distance culling without React churn). */
export const localPos = new THREE.Vector3(0, 0, 4);
const SPAWN = new THREE.Vector3(0, 0, 4);
const dir = new THREE.Vector3();
const camTarget = new THREE.Vector3();

function typingInField() {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

export function LocalPlayer({ name }: { name: string }) {
  const ref = useRef<THREE.Group>(null);
  const [, get] = useKeyboardControls<Controls>();
  const camera = useThree((s) => s.camera);
  const blockers = useMemo(buildBlockers, []);
  const sendAcc = useRef(0);
  const anim = useRef('idle');
  const [animState, setAnimState] = useState('idle');
  const interactAcc = useRef(0);
  const tint = useProfile((s) => s.profile?.avatar.color ?? '#4a90e2');
  const vy = useRef(0);
  const airborne = useRef(false);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const locked = useGame.getState().panelNpc !== null;

    // --- input ---
    let ix = 0;
    let iz = 0;
    let run = false;
    let jump = false;
    if (!locked) {
      if (!typingInField()) {
        const k = get();
        ix = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        iz = (k.back ? 1 : 0) - (k.forward ? 1 : 0);
        run = k.run;
      }
      if (jumpInput.pressed) jump = true;
      if (joystick.active) {
        ix = joystick.x;
        iz = joystick.y;
        run = Math.hypot(ix, iz) > 0.85;
      }
    }
    jumpInput.pressed = false;
    // Input is screen-relative; rotate it by the camera yaw so "up" always means away from the camera.
    const cy = Math.cos(cameraOrbit.yaw);
    const sy = Math.sin(cameraOrbit.yaw);
    dir.set(ix * cy + iz * sy, 0, -ix * sy + iz * cy);
    const mag = Math.min(1, dir.length());

    // --- movement with collision ---
    if (mag > 0.05) {
      dir.normalize();
      const speed = WALK_SPEED * (run ? 2 : 1) * mag;
      const [nx, nz] = resolveMove(g.position.x, g.position.z, dir.x * speed * dt, dir.z * speed * dt, blockers);
      g.position.x = nx;
      g.position.z = nz;
      g.rotation.y = Math.atan2(dir.x, dir.z);
      anim.current = run ? 'run' : 'walk';
    } else {
      anim.current = locked ? 'talk' : 'idle';
    }

    // --- jump: simple vertical ballistics, ground at y = 0 ---
    if (jump && !airborne.current) {
      vy.current = JUMP_SPEED;
      airborne.current = true;
      hopSound(useSettings.getState().ambientVolume);
    }
    if (airborne.current) {
      // Fixed sub-steps so a slow frame (dt 0.2 s on a weak phone) still produces a full arc.
      const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
      const h = dt / steps;
      for (let i = 0; i < steps && airborne.current; i++) {
        vy.current -= GRAVITY * h;
        g.position.y = Math.max(0, g.position.y + vy.current * h);
        if (g.position.y === 0 && vy.current < 0) {
          airborne.current = false;
          vy.current = 0;
        }
      }
      if (airborne.current) anim.current = 'jump';
    }
    // One-shot emote overrides the base animation while it lasts.
    const emote = useGame.getState().emote;
    if (emote && !moving(ix, iz)) anim.current = emote.until > Date.now() ? emote.name : anim.current;
    if (anim.current !== animState) setAnimState(anim.current);

    localPos.copy(g.position);

    // --- third-person camera ---
    const back = cameraOrbit.dist * 0.84;
    camTarget.set(g.position.x + sy * back, cameraOrbit.dist * 0.55, g.position.z + cy * back);
    camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
    camera.lookAt(g.position.x, 1.2 + g.position.y * 0.3, g.position.z);

    // --- network ---
    sendAcc.current += dt;
    if (sendAcc.current >= 1 / INPUT_RATE_HZ) {
      sendAcc.current = 0;
      const vc = useVoiceChat.getState();
      sendInput(g.position.x, g.position.y, g.position.z, g.rotation.y, anim.current, vc.enabled, vc.shouting);
    }

    // --- interaction target (nearest NPC in range), checked ~10x/s ---
    interactAcc.current += dt;
    if (interactAcc.current >= 0.1) {
      interactAcc.current = 0;
      const s = useGame.getState();
      let best: string | null = null;
      let bestD = INTERACT_RADIUS * INTERACT_RADIUS;
      for (const n of s.npcs) {
        const dx = n.position[0] - g.position.x;
        const dz = n.position[2] - g.position.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = n.id;
        }
      }
      if (best !== s.interactTarget) s.setInteractTarget(best);
    }
  });

  return (
    <group ref={ref} position={SPAWN}>
      <Character anim={animState} tint={tint} />
      <NameTag name={name} />
    </group>
  );
}

function moving(ix: number, iz: number) {
  return Math.hypot(ix, iz) > 0.05;
}
