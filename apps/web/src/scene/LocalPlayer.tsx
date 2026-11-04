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
import { buildBlockers, buildLampPosts, resolveMove, type Circle } from '../world/layout';
import { CRITTERS, poseAt } from '../world/critters';
import { CYCLISTS } from '../world/cyclists';
import { serverNow } from '../net/client';
import { livePos } from '../world/avoid';

const CRITTER_SIZE = { cat: { r: 0.28, h: 0.45 }, shiba: { r: 0.4, h: 0.62 }, husky: { r: 0.45, h: 0.72 }, duck: { r: 0.3, h: 0.4 }, duckling: { r: 0.15, h: 0.2 }, rabbit: { r: 0.25, h: 0.45 } } as const;
const NEAR = 4; // only obstacles this close are tested each frame

/** Everything round the player can bump into right now (static posts + NPCs + moving critters, cyclists, players). */
function nearbyCircles(px: number, pz: number, posts: Circle[], out: Circle[]) {
  out.length = 0;
  const near = (x: number, z: number) => Math.abs(x - px) < NEAR && Math.abs(z - pz) < NEAR;
  for (const c of posts) if (near(c.x, c.z)) out.push(c);
  const s = useGame.getState();
  for (const n of s.npcs) if (near(n.position[0], n.position[2])) out.push({ x: n.position[0], z: n.position[2], r: 0.35, h: 1.7 });
  for (const id in s.players) {
    if (id === s.sessionId) continue;
    const p = s.players[id]!;
    if (near(p.x, p.z)) out.push({ x: p.x, z: p.z, r: 0.35, h: 1.6 + p.y });
  }
  const now = serverNow();
  // Critters and cyclists: where they are drawn (after steering around people), falling back to the schedule.
  for (const c of CRITTERS) {
    if (heldCritters.has(c.id)) continue; // in someone's arms
    const q = livePos.get(c.id) ?? poseAt(c, now);
    if (near(q.x, q.z)) out.push({ x: q.x, z: q.z, ...CRITTER_SIZE[c.kind] });
  }
  // Only riders that are actually drawn (low quality shows one) and currently on the road.
  for (const c of CYCLISTS) {
    const q = livePos.get(c.id);
    if (q && near(q.x, q.z)) out.push({ x: q.x, z: q.z, r: 0.55, h: 1.7 });
  }
  return out;
}
import { PlayerAvatar } from './PlayerAvatar';
import { heldCritters, holdable, hugRadius, myHolding } from '../world/hold';
import { avatarLook, AvatarSchema } from '@es/shared';
import { NameTag } from './NameTag';
import { seatTaken, useRestaurant } from '../store/restaurant';
import { TABLES } from '../world/buildings';

export type Controls = 'forward' | 'back' | 'left' | 'right' | 'run';

/** Live local position (mutable, read by RemotePlayers for distance culling without React churn). */
export const localPos = new THREE.Vector3(0, 0, 4);
/** Local player's facing (rotation.y), for things placed in front of them. */
export const localHeading = { y: 0 };
/** Bus rides / "show me" jumps: set pending and the next frame moves the player (and snaps the camera). */
export const teleport = { pending: false, x: 0, z: 0, rot: 0 };
export function teleportTo(x: number, z: number, rot = Math.PI) {
  Object.assign(teleport, { pending: true, x, z, rot });
}
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
  const posts = useMemo(buildLampPosts, []);
  const circles = useRef<Circle[]>([]);
  const sendAcc = useRef(0);
  const anim = useRef('idle');
  const [animState, setAnimState] = useState('idle');
  const interactAcc = useRef(0);
  const avatar = useProfile((s) => s.profile?.avatar);
  const holding = useGame((s) => (s.sessionId && s.players[s.sessionId]?.holding) || '');
  const prop = useGame((s) => (s.sessionId && s.players[s.sessionId]?.prop) || '');
  const look = useMemo(() => avatarLook(avatar ?? AvatarSchema.parse({})), [avatar]);
  const vy = useRef(0);
  const airborne = useRef(false);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const locked = useGame.getState().panelNpc !== null;
    if (teleport.pending) {
      teleport.pending = false;
      g.position.set(teleport.x, 0, teleport.z);
      g.rotation.y = teleport.rot;
      vy.current = 0;
      airborne.current = false;
      const back = cameraOrbit.dist * 0.84;
      camera.position.set(teleport.x + Math.sin(cameraOrbit.yaw) * back, cameraOrbit.dist * 0.55, teleport.z + Math.cos(cameraOrbit.yaw) * back);
    }

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

    // --- sitting on a restaurant chair: stay put until the player moves ---
    const seat = useRestaurant.getState().seat;
    if (seat && (mag > 0.05 || jump)) useRestaurant.getState().stand();
    else if (seat) {
      const s = TABLES[seat.table]?.seats[seat.seat];
      if (s) {
        g.position.set(s.x, 0, s.z);
        g.rotation.y = s.rot;
      }
    }
    const seated = !!useRestaurant.getState().seat;

    // --- movement with collision ---
    if (seated) {
      anim.current = 'sit';
    } else if (mag > 0.05) {
      dir.normalize();
      const speed = WALK_SPEED * (run ? 2 : 1) * mag;
      nearbyCircles(g.position.x, g.position.z, posts, circles.current);
      // Sub-steps of ≤ 0.15 m so a long frame on a slow phone cannot tunnel through a thin lamp post.
      const total = speed * dt;
      const steps = Math.max(1, Math.ceil(total / 0.15));
      for (let i = 0; i < steps; i++) {
        const [nx, nz] = resolveMove(g.position.x, g.position.z, (dir.x * total) / steps, (dir.z * total) / steps, blockers, circles.current, g.position.y);
        g.position.x = nx;
        g.position.z = nz;
      }
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
    if (emote && !moving(ix, iz) && !seated) anim.current = emote.until > Date.now() ? emote.name : anim.current;
    if (anim.current !== animState) setAnimState(anim.current);

    localPos.copy(g.position);
    localHeading.y = g.rotation.y;

    // --- third-person camera ---
    const back = cameraOrbit.dist * 0.84;
    camTarget.set(g.position.x + sy * back, cameraOrbit.dist * 0.55, g.position.z + cy * back);
    camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
    camera.lookAt(g.position.x, 0.95 + g.position.y * 0.3, g.position.z);

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
      // nearest cat/dog within hugging reach (none while already hugging one)
      let hug: string | null = null;
      if (!myHolding()) {
        let hugD = Infinity;
        for (const c of CRITTERS) {
          if (!holdable(c.id) || heldCritters.has(c.id)) continue;
          const q = livePos.get(c.id);
          if (!q) continue;
          const d = Math.hypot(q.x - g.position.x, q.z - g.position.z);
          if (d < hugRadius(c.id) && d < hugD) {
            hugD = d;
            hug = c.id;
          }
        }
      }
      if (hug !== s.nearCritter) s.setNearCritter(hug);
      // nearest free restaurant chair within reach
      let near: { table: number; seat: number } | null = null;
      if (!useRestaurant.getState().seat && g.position.x < -114 && g.position.x > -162 && g.position.z < -9) {
        let best = 1.4;
        for (const t of TABLES)
          t.seats.forEach((st, i) => {
            const d = Math.hypot(st.x - g.position.x, st.z - g.position.z);
            if (d < best && !seatTaken(st.x, st.z)) {
              best = d;
              near = { table: t.id, seat: i };
            }
          });
      }
      useRestaurant.getState().setNear(near);
    }
  });

  return (
    <group ref={ref} position={SPAWN}>
      <PlayerAvatar anim={animState} look={look} holding={holding} prop={prop} />
      <NameTag name={name} />
    </group>
  );
}

function moving(ix: number, iz: number) {
  return Math.hypot(ix, iz) > 0.05;
}
