import { useMemo, useRef, useState } from 'react';
import { busStep, joinRide, matchArrival, useBus } from '../store/bus';
import { decodeBus } from '../world/bus';
import { useFrame, useThree } from '@react-three/fiber';
import { getControls, installKeys } from '../input/keys';
import { pickUsable, useNearUsable } from '../world/usables';

installKeys();
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
import { useFitting } from '../store/fitting';
import { moveTarget } from '../input/clickMove';
import { buildBlockers, buildLampPosts, resolveMove, type Circle } from '../world/layout';
import { CRITTERS, poseAt } from '../world/critters';
import { CYCLISTS } from '../world/cyclists';
import { serverNow } from '../net/client';
import { livePos } from '../world/avoid';
import { spotState } from '../world/spots';

const CRITTER_SIZE = { cat: { r: 0.28, h: 0.45 }, shiba: { r: 0.4, h: 0.62 }, husky: { r: 0.45, h: 0.72 }, duck: { r: 0.3, h: 0.4 }, duckling: { r: 0.15, h: 0.2 }, rabbit: { r: 0.25, h: 0.45 }, kid: { r: 0.32, h: 0.75 }, lamb: { r: 0.32, h: 0.75 }, guineapig: { r: 0.2, h: 0.3 } } as const;
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
    if (spotState(c.id, now) === 'eaten') continue;
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
import { useSeat } from '../store/seat';
import { boatStep, boatTeleported } from '../store/boats';
import { useFollow } from '../store/follow';
import { walkTo } from '../input/clickMove';
import { nearestSeat } from '../world/seats';
import { POOL_WORLD } from '../world/places/hotel';
import { SEA_SWIM } from '../world/sunnyBay';
import { HILL, groundAt } from '../world/mapleHill';

/** Height of the ground under (x, z): 0 everywhere but on Maple Hill. */
const floorAt = (x: number, z: number) => (x > HILL.minX - 2 && x < HILL.maxX + 2 && z > HILL.minZ - 2 && z < HILL.maxZ + 2 ? groundAt(x, z) : 0);

export type { Controls } from '../input/keys';

/** Breath for running (a farm-dog chase): seconds of running left while `on`. */
export const breath = { on: false, left: 0, max: 1 };
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

/**
 * Third-person camera behind the player. With tilt (looking at the sky) it drops to head height and looks up.
 */
function placeCamera(camera: THREE.Camera, p: THREE.Vector3, dt: number, snap: boolean) {
  cameraOrbit.tilt += (cameraOrbit.tiltTarget - cameraOrbit.tilt) * (1 - Math.pow(0.02, dt));
  const k = cameraOrbit.tilt;
  const back = cameraOrbit.dist * 0.84 * (1 - 0.35 * k);
  // on a slope the camera follows the ground (and stays above the ground behind the player)
  const base = floorAt(p.x, p.z);
  const cx = p.x + Math.sin(cameraOrbit.yaw) * back;
  const cz = p.z + Math.cos(cameraOrbit.yaw) * back;
  const camY = cameraOrbit.dist * 0.55 * (1 - 0.8 * k) + 0.9 * k + base;
  camTarget.set(cx, base ? Math.max(camY, floorAt(cx, cz) + 1.2) : camY, cz);
  if (snap) camera.position.copy(camTarget);
  else camera.position.lerp(camTarget, 1 - Math.pow(0.001, dt));
  camera.lookAt(p.x, 0.95 + base + (p.y - base) * 0.3 + k * 3, p.z);
}
const dir = new THREE.Vector3();
const camTarget = new THREE.Vector3();

function typingInField() {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

export function LocalPlayer({ name }: { name: string }) {
  const ref = useRef<THREE.Group>(null);
  const get = getControls;
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
  const trying = useFitting((s) => s.look);
  const saved = useMemo(() => avatarLook(avatar ?? AvatarSchema.parse({})), [avatar]);
  // in a fitting room you wear what you are trying on
  const look = trying ?? saved;
  const vy = useRef(0);
  const airborne = useRef(false);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const locked = useGame.getState().panelNpc !== null;
    if (teleport.pending) {
      teleport.pending = false;
      // moved away (map, bus, test hook): no longer on the chair
      const gs = useSeat.getState().seat;
      if (gs && Math.hypot(teleport.x - gs.x, teleport.z - gs.z) > 0.3) useSeat.setState({ seat: null });
      boatTeleported(teleport.x, teleport.z);
      g.position.set(teleport.x, 0, teleport.z);
      g.rotation.y = teleport.rot;
      vy.current = 0;
      airborne.current = false;
      moveTarget.active = false;
      placeCamera(camera, g.position, dt, true);
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
    let mag = Math.min(1, dir.length());
    const keyMag = mag;
    let clickLeft = Infinity; // distance left to the clicked spot (never step past it)
    // --- following another player: keep walking after them (keys / joystick / a panel stop it) ---
    const fol = useFollow.getState().target;
    const riding = !!useBus.getState().ride;
    if (fol) {
      const tp = useGame.getState().players[fol.id];
      // they are getting on a bus: catch the same one; on the bus: get off with them
      const tag = tp ? decodeBus(tp.bus) : null;
      if (tag && !riding && keyMag <= 0.05 && !locked) {
        const j = joinRide(tag, g.position);
        if (j) {
          moveTarget.active = false;
          if (j.teleport) teleportTo(j.teleport.x, j.teleport.z);
        }
      } else if (tag && riding) matchArrival(tag);
      if (riding || useBus.getState().ride) {
        // the bus script moves us
      } else if (!tp || keyMag > 0.05 || locked) {
        useFollow.getState().stop();
        moveTarget.active = false;
      } else {
        const d = Math.hypot(tp.x - g.position.x, tp.z - g.position.z);
        if (d > 90) {
          useFollow.getState().stop();
          moveTarget.active = false;
        } else if (d > (moveTarget.active ? 1.8 : 3)) {
          if (!moveTarget.active) walkTo(tp.x, tp.z, g.position);
          moveTarget.x = tp.x;
          moveTarget.z = tp.z;
          moveTarget.run = d > 6;
        } else moveTarget.active = false;
      }
    }
    // --- click-to-move (mouse): walk to the clicked spot until there, blocked, or the keys take over ---
    if (moveTarget.active) {
      if (mag > 0.05 || locked) moveTarget.active = false;
      else {
        const dx = moveTarget.x - g.position.x;
        const dz = moveTarget.z - g.position.z;
        const d = Math.hypot(dx, dz);
        // (the first frame only starts walking: a long frame on a slow device must not count as "stuck")
        if (moveTarget.started) moveTarget.check -= dt;
        moveTarget.started = true;
        if (moveTarget.check <= 0) {
          // no real progress in the last half second: something is in the way
          if (moveTarget.lastDist - d < 0.25) moveTarget.active = false;
          moveTarget.lastDist = d;
          moveTarget.check = 0.5;
        }
        if (d < 0.2) moveTarget.active = false;
        if (moveTarget.active) {
          dir.set(dx / d, 0, dz / d);
          mag = 1;
          clickLeft = d;
          run = moveTarget.run && d > 2;
        }
      }
    }

    // --- bus ride: a short script moves the player (walk to the door, ride inside, step off) ---
    const ride = busStep(g, dt, keyMag > 0.05 || jump);
    if (ride) {
      if (useSeat.getState().seat) useSeat.setState({ seat: null });
      if (useRestaurant.getState().seat) useRestaurant.getState().stand();
      g.visible = !ride.hidden;
      anim.current = ride.anim;
      if (anim.current !== animState) setAnimState(anim.current);
      localPos.copy(g.position);
      localHeading.y = g.rotation.y;
      moveTarget.active = false;
      placeCamera(camera, g.position, dt, !!ride.snap);
      sendAcc.current += dt;
      if (sendAcc.current >= 1 / INPUT_RATE_HZ) {
        sendAcc.current = 0;
        const vc = useVoiceChat.getState();
        sendInput(g.position.x, 0, g.position.z, g.rotation.y, anim.current, vc.enabled, vc.shouting);
      }
      return;
    }
    if (!g.visible) g.visible = true;

    // --- in a rowing boat / pedalo / on the ferry: the boat carries the player (WASD / joystick steer it) ---
    const boat = boatStep(dt, ix, iz);
    if (boat) {
      if (useSeat.getState().seat) useSeat.setState({ seat: null });
      g.position.set(boat.x, boat.y, boat.z);
      g.rotation.y = boat.rot;
      vy.current = 0;
      airborne.current = false;
      anim.current = boat.anim;
      if (anim.current !== animState) setAnimState(anim.current);
      localPos.copy(g.position);
      localHeading.y = g.rotation.y;
      moveTarget.active = false;
      placeCamera(camera, g.position, dt, false);
      // usables still work from the boat ("Get out" at a pier)
      interactAcc.current += dt;
      if (interactAcc.current >= 0.1) {
        interactAcc.current = 0;
        const use = pickUsable(g.position.x, g.position.z);
        const near = useNearUsable.getState().near;
        if (use?.id !== near?.id || use?.label !== near?.label) useNearUsable.setState({ near: use });
      }
      sendAcc.current += dt;
      if (sendAcc.current >= 1 / INPUT_RATE_HZ) {
        sendAcc.current = 0;
        const vc = useVoiceChat.getState();
        sendInput(g.position.x, boat.y, g.position.z, g.rotation.y, anim.current, vc.enabled, vc.shouting);
      }
      return;
    }

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
    // --- sitting on any other chair / bench / sofa (world/seats.ts) ---
    const gseat = useSeat.getState().seat;
    if (gseat && (mag > 0.05 || jump)) useSeat.getState().stand();
    else if (gseat) {
      g.position.set(gseat.x, gseat.y ?? 0, gseat.z);
      g.rotation.y = gseat.rot;
    }
    const seated = !!useRestaurant.getState().seat || !!useSeat.getState().seat;
    // --- in the hotel pool: swim (slower, body in the water) ---
    const P = POOL_WORLD;
    const S = SEA_SWIM;
    const swimming =
      !seated &&
      ((g.position.x > P.minX + 0.25 && g.position.x < P.maxX - 0.25 && g.position.z > P.minZ + 0.25 && g.position.z < P.maxZ - 0.25) ||
        // the sea at Sunny Bay
        (g.position.x > S.minX && g.position.x < S.maxX && g.position.z > S.minZ && g.position.z < S.maxZ));

    // --- movement with collision ---
    if (seated) {
      anim.current = useRestaurant.getState().seat && useRestaurant.getState().step === 'eating' ? 'eat' : 'sit';
    } else if (mag > 0.05) {
      dir.normalize();
      // running away from a farm dog: only while you have breath (store/myFarm.ts)
      if (breath.on) {
        if (run) breath.left = Math.max(0, breath.left - dt);
        if (breath.left <= 0) run = false;
      }
      const speed = WALK_SPEED * (run ? 2 : 1) * mag * (swimming ? 0.6 : 1);
      nearbyCircles(g.position.x, g.position.z, posts, circles.current);
      // Sub-steps of ≤ 0.15 m so a long frame on a slow phone cannot tunnel through a thin lamp post.
      const total = Math.min(speed * dt, clickLeft);
      const steps = Math.max(1, Math.ceil(total / 0.15));
      for (let i = 0; i < steps; i++) {
        const [nx, nz] = resolveMove(g.position.x, g.position.z, (dir.x * total) / steps, (dir.z * total) / steps, blockers, circles.current, g.position.y);
        g.position.x = nx;
        g.position.z = nz;
      }
      g.rotation.y = Math.atan2(dir.x, dir.z);
      anim.current = swimming ? 'swim' : run ? 'run' : 'walk';
    } else {
      anim.current = swimming ? 'tread' : locked ? 'talk' : 'idle';
    }

    // --- on Maple Hill the ground has height: stand on it ---
    const floorY = floorAt(g.position.x, g.position.z);
    const onHill = g.position.x > HILL.minX - 2 && g.position.x < HILL.maxX + 2 && g.position.z > HILL.minZ - 2 && g.position.z < HILL.maxZ + 2;
    if (onHill && !airborne.current && !seated) g.position.y = floorY;
    // --- jump: simple vertical ballistics, ground at y = 0 (or the hill) ---
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
        g.position.y = Math.max(floorY, g.position.y + vy.current * h);
        if (g.position.y === floorY && vy.current < 0) {
          airborne.current = false;
          vy.current = 0;
        }
      }
      if (airborne.current) anim.current = 'jump';
    }
    // One-shot emote overrides the base animation while it lasts.
    const emote = useGame.getState().emote;
    if (emote && mag <= 0.05 && !seated && !swimming) anim.current = emote.until > Date.now() ? emote.name : anim.current;
    if (anim.current !== animState) setAnimState(anim.current);

    localPos.copy(g.position);
    localHeading.y = g.rotation.y;

    // --- third-person camera ---
    placeCamera(camera, g.position, dt, false);

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
      // nearest usable thing (doors, lift, phone, ball, boat…) when no NPC is in reach (priority usables win anyway)
      const any = pickUsable(g.position.x, g.position.z);
      if (any?.priority) best = null;
      if (best !== s.interactTarget) s.setInteractTarget(best);
      const use = best ? null : any;
      if (use?.id !== useNearUsable.getState().near?.id || use?.label !== useNearUsable.getState().near?.label || use?.disabled !== useNearUsable.getState().near?.disabled) useNearUsable.setState({ near: use });
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
      // nearest free chair / bench anywhere else
      const free = !near && !useRestaurant.getState().seat && !useSeat.getState().seat;
      useSeat.getState().setNear(free ? nearestSeat(g.position.x, g.position.z, (st) => !seatTaken(st.x, st.z)) : null);
    }
  });

  return (
    <group ref={ref} position={SPAWN}>
      <PlayerAvatar anim={animState} look={look} holding={holding} prop={prop} />
      <NameTag name={name} tag={look.tag} />
    </group>
  );
}
