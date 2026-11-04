import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CRITTERS, DUCK_Y, poseAt, type Critter, type CritterKind } from '../world/critters';
import { serverNow } from '../net/client';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { localHeading, localPos } from './LocalPlayer';
import { NameTag } from './NameTag';
import { livePos, pushAway, sidestep } from '../world/avoid';
import { playerPoints } from './players';
import { heldCritters, holderOf } from '../world/hold';
import { buildCritter, coatFor, type CritterParts } from './chibi/buildCritter';
import { chibiMaterial, chibiOutline } from './chibi/buildChibi';

/** Critter keeps this far from players' centres (player radius 0.4 + its own size + a little room). */
const AVOID: Record<CritterKind, number> = { cat: 1.0, shiba: 1.15, husky: 1.2, duck: 0.6, duckling: 0.4, rabbit: 1.0, kid: 1.05, lamb: 1.05, guineapig: 0.8 };
/** Chibi animals are drawn a bit bigger than life so their faces read from the street camera. */
const SCALE: Record<CritterKind, number> = { cat: 1.25, shiba: 1.2, husky: 1.2, duck: 2.0, duckling: 1.1, rabbit: 1.9, kid: 1.7, lamb: 1.7, guineapig: 2.0 };
const HEIGHT: Record<CritterKind, number> = { cat: 0.6, shiba: 0.75, husky: 0.85, duck: 0.8, duckling: 0.4, rabbit: 1.0, kid: 1.0, lamb: 1.0, guineapig: 0.5 };
const BASE_Y: Partial<Record<CritterKind, number>> = { duck: DUCK_Y, duckling: DUCK_Y };
/** English word shown with the critter's name when you are close ("dog - Luna"). */
const KIND_WORD: Record<CritterKind, string> = { cat: 'cat', shiba: 'dog', husky: 'dog', duck: 'duck', duckling: 'duckling', rabbit: 'rabbit', kid: 'baby goat', lamb: 'lamb', guineapig: 'guinea pig' };
const LABEL_RADIUS = 4;
/** After being put down a critter stays put this long before heading back to its route. */
const STAY_MS = 20000;
/** Water starts here (Horizon.tsx RIVER_NEAR_Z). */
const RIVER_EDGE_Z = 18;
/** Critters beyond this distance are not animated/drawn (they are tiny anyway); river and meadow animals are seen from further. */
const DRAW_RADIUS: Record<CritterKind, number> = { cat: 36, shiba: 36, husky: 36, duck: 60, duckling: 50, rabbit: 70, kid: 40, lamb: 40, guineapig: 30 };

export function Critters() {
  return (
    <>
      {CRITTERS.map((c) => (
        <CritterView key={c.id} c={c} />
      ))}
    </>
  );
}

function CritterView({ c }: { c: Critter }) {
  const parts = useMemo(() => buildCritter(c.kind, coatFor(c.id)), [c.kind, c.id]);
  useEffect(() => () => Object.values(parts).forEach((g) => (g as THREE.BufferGeometry | null)?.dispose?.()), [parts]);
  const group = useRef<THREE.Group>(null);
  const rig = useRef<RigRefs>({ legs: [] });
  const motion = useRef({ t: Math.random() * 10, phase: 0, nap: 0, react: 0, hop: 0 });
  const [near, setNear] = useState(true);
  /** Player within LABEL_RADIUS: show "dog - Luna" above it. */
  const [close, setClose] = useState(false);
  const reactUntil = useRef(0);
  const selected = useGame((s) => s.selectedCritter === c.id);
  const select = useGame((s) => s.setSelectedCritter);
  const acc = useRef(0);
  const off = useRef(new THREE.Vector2());
  /** Put down somewhere: stay there a while, then walk (not glide) back to the scheduled route. */
  const drop = useRef<{ until: number } | null>(null);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    let state: 'walk' | 'idle' | 'nap' | 'react' = 'idle';
    // In someone's arms: the holder's avatar draws it (PlayerAvatar → HeldCritter); here it just follows the holder
    // so that, once put down, it walks back to its schedule from where it was dropped.
    const holder = holderOf(c.id);
    if (holder) {
      heldCritters.add(c.id);
      const s = useGame.getState();
      const mine = holder === s.sessionId;
      const hp = mine ? localPos : s.players[holder];
      if (hp) {
        // keep it just in front of the holder, so it is put down there (not under their feet)
        const rot = mine ? localHeading.y : s.players[holder]!.rot;
        g.position.x = hp.x + Math.sin(rot) * 0.75;
        g.position.z = hp.z + Math.cos(rot) * 0.75;
        g.rotation.y = rot + Math.PI; // looking back at them
      }
      g.visible = false;
      livePos.delete(c.id);
      return;
    }
    if (heldCritters.delete(c.id)) {
      g.visible = true;
      reactUntil.current = Date.now() + 1500; // a happy wag after being put down
      // ducks hurry straight back to the river; the others sit a while where they were put down
      drop.current = { until: Date.now() + (c.kind === 'duck' || c.kind === 'duckling' ? 1200 : STAY_MS) };
    }
    // ducks float on the river but stand on the grass when carried ashore
    const water = (c.kind === 'duck' || c.kind === 'duckling') && g.position.z > RIVER_EDGE_Z;
    const baseY = c.kind === 'duck' || c.kind === 'duckling' ? (water ? DUCK_Y : 0.08) : 0;
    g.position.y += (baseY - g.position.y) * Math.min(1, dt * 6);
    const reacting = reactUntil.current > Date.now();
    const pose = poseAt(c, serverNow());
    // Step around players standing on the route (each client computes the same detour from the same player positions).
    // Walking: side-step off the path around people; resting: just shuffle away from anyone standing on it.
    const push = pose.clip === 'walk' ? sidestep(pose.x, pose.z, pose.rot, playerPoints(), AVOID[c.kind]) : pushAway(pose.x, pose.z, playerPoints(), AVOID[c.kind], 1.6, Math.cos(pose.rot), -Math.sin(pose.rot));
    const ko = 1 - Math.pow(0.002, dt);
    off.current.x += (push.x - off.current.x) * ko;
    off.current.y += (push.z - off.current.y) * ko;
    if (drop.current && !reacting) {
      const d = drop.current;
      if (Date.now() < d.until) {
        state = 'idle'; // stays where it was put down
      } else {
        // walk/hop/paddle back to where its schedule is now, at its own pace
        const mx = pose.x + off.current.x - g.position.x;
        const mz = pose.z + off.current.y - g.position.z;
        const dist = Math.hypot(mx, mz);
        if (dist < 0.3) drop.current = null;
        else {
          const pace = water || (c.kind !== 'duck' && c.kind !== 'duckling') ? c.speed * 1.15 : 1.9; // waddle-run on land
          const step = Math.min(dist, pace * dt);
          g.position.x += (mx / dist) * step;
          g.position.z += (mz / dist) * step;
          g.rotation.y += shortestAngle(g.rotation.y, Math.atan2(mx, mz)) * (1 - Math.pow(0.002, dt));
          state = 'walk';
        }
      }
    } else if (!reacting) {
      // Ease toward the scheduled pose so joining mid-walk never snaps.
      const k = 1 - Math.pow(0.001, dt);
      const tx = pose.x + off.current.x;
      const tz = pose.z + off.current.y;
      const mx = tx - g.position.x;
      const mz = tz - g.position.z;
      g.position.x += mx * k;
      g.position.z += mz * k;
      // face where it is actually going while detouring
      const heading = pose.clip === 'walk' && Math.hypot(mx, mz) > 0.02 ? Math.atan2(mx, mz) : pose.rot;
      g.rotation.y += shortestAngle(g.rotation.y, heading) * k;
      state = pose.clip === 'walk' ? 'walk' : pose.pauseT > 0.25 ? 'nap' : 'idle';
    } else {
      // Face the player while reacting.
      g.rotation.y += shortestAngle(g.rotation.y, Math.atan2(localPos.x - g.position.x, localPos.z - g.position.z)) * 0.1;
      state = 'react';
    }
    livePos.set(c.id, { x: g.position.x, z: g.position.z });
    if (near) animate(rig.current, parts, c.kind, state, motion.current, dt, c.speed, !water);
    acc.current += dt;
    if (acc.current > 0.3) {
      acc.current = 0;
      const dist = Math.hypot(g.position.x - localPos.x, g.position.z - localPos.z);
      const n = dist < DRAW_RADIUS[c.kind];
      if (n !== near) setNear(n);
      const cl = dist < LABEL_RADIUS && g.visible;
      if (cl !== close) setClose(cl);
    }
  });
  useEffect(() => {
    if (selected) reactUntil.current = Date.now() + 4000;
  }, [selected]);

  const p0 = poseAt(c, serverNow());
  return (
    <group
      ref={group}
      position={[p0.x, BASE_Y[c.kind] ?? 0, p0.z]}
      rotation={[0, p0.rot, 0]}
      onClick={(e) => {
        e.stopPropagation();
        select(selected ? null : c.id);
      }}
    >
      {near ? <CritterBody parts={parts} rig={rig} scale={SCALE[c.kind]} /> : null}
      {near && (selected || close) ? <NameTag name={`${KIND_WORD[c.kind]} - ${c.name}`} y={HEIGHT[c.kind] + 0.5} /> : null}
    </group>
  );
}

function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ------------------------------------------------------------------------------------------------ chibi body + motion
interface RigRefs {
  body?: THREE.Group;
  head?: THREE.Group;
  tail?: THREE.Group;
  legs: THREE.Group[];
}

function CritterBody({ parts, rig, scale }: { parts: CritterParts; rig: React.RefObject<RigRefs>; scale: number }) {
  const outline = useSettings((s) => s.quality) === 'high';
  const mat = chibiMaterial();
  const ol = chibiOutline();
  const part = (g: THREE.BufferGeometry) => (
    <>
      <mesh geometry={g} material={mat} castShadow />
      {outline ? <mesh geometry={g} material={ol} /> : null}
    </>
  );
  const r = parts.rig;
  return (
    <group scale={scale}>
      <group ref={(g) => void (g && (rig.current.body = g))}>
        {part(parts.body)}
        <group ref={(g) => void (g && (rig.current.head = g))} position={r.head}>
          {part(parts.head)}
        </group>
        <group ref={(g) => void (g && (rig.current.tail = g))} position={r.tail}>
          {part(parts.tail)}
        </group>
      </group>
      {parts.leg && r.legs.map((p, i) => (
        <group key={i} ref={(g) => void (g && (rig.current.legs[i] = g))} position={p}>
          {part(parts.leg!)}
        </group>
      ))}
    </group>
  );
}

/** Procedural gait: diagonal leg pairs, body bob, wagging tail; naps lie down with the head low; react = head tilt + happy wag (+ a hop for dogs). */
function animate(r: RigRefs, parts: CritterParts, kind: CritterKind, state: 'walk' | 'idle' | 'nap' | 'react', m: { t: number; phase: number; nap: number; react: number; hop: number }, dt: number, speed: number, land = false) {
  if (!r.body || !r.head || !r.tail) return;
  if (kind === 'duck' || kind === 'duckling') return animateDuck(r, parts, state, m, dt, land);
  if (r.legs.length < 4) return;
  if (kind === 'rabbit') return animateRabbit(r, parts, state, m, dt, speed);
  const d = Math.min(dt, 0.1);
  m.t += d;
  const k = 1 - Math.exp(-d * 6);
  m.nap += ((state === 'nap' ? 1 : 0) - m.nap) * k;
  m.react += ((state === 'react' ? 1 : 0) - m.react) * k;
  const walking = state === 'walk';
  if (walking) m.phase += d * (5 + speed * 4);
  const swing = walking ? Math.sin(m.phase) * 0.7 : 0;
  const dog = parts.rig.legs[0]![0] > 0.07;
  m.hop = state === 'react' && dog ? Math.abs(Math.sin(m.t * 6)) * 0.04 : m.hop * (1 - k);
  const lie = m.nap;
  const hip = parts.rig.legs[0]![1];
  // body: bob while walking, lowered to the ground for naps, tiny breathing
  r.body.position.y = (walking ? Math.abs(Math.cos(m.phase)) * 0.015 : 0) - lie * hip * 0.8 + m.hop + Math.sin(m.t * 2.4) * 0.004;
  r.body.rotation.x = walking ? Math.sin(m.phase * 2) * 0.03 : 0;
  // legs: walking swings diagonal pairs; lying folds them forward/back under the body
  const legRot = [swing, -swing, -swing, swing];
  r.legs.forEach((g, i) => {
    const fold = i < 2 ? -1.35 : 1.35;
    g.rotation.x = legRot[i]! * (1 - lie) + fold * lie;
    g.position.y = parts.rig.legs[i]![1] - lie * hip * 0.8 + m.hop;
  });
  // head: looks around when idle, bobs while walking, rests low when napping, tilts when you tap it
  r.head.rotation.x = (walking ? Math.sin(m.phase * 2) * 0.06 : 0) + lie * 0.35 - m.react * 0.15;
  r.head.rotation.y = state === 'idle' ? Math.sin(m.t * 0.6) * 0.5 * Math.max(0, Math.sin(m.t * 0.23)) : 0;
  r.head.rotation.z = m.react * Math.sin(m.t * 2) * 0.3;
  r.head.position.y = parts.rig.head[1] - lie * 0.05;
  // tail: wag speed by mood; curled down when sleeping
  const wag = state === 'react' ? 16 : walking ? 9 : 3;
  r.tail.rotation.y = Math.sin(m.t * wag) * (state === 'react' ? 0.6 : 0.35) * (1 - lie);
  r.tail.rotation.x = lie * 0.9;
}

/** Floating: bob and roll on the water, head bobbing while paddling, a dip under now and then, tail wiggle. */
function animateDuck(r: RigRefs, parts: CritterParts, state: string, m: { t: number; phase: number; react: number }, dt: number, land = false) {
  const d = Math.min(dt, 0.1);
  m.t += d;
  const waddle = land && state === 'walk';
  m.phase += d * (waddle ? 14 : 5);
  m.react += ((state === 'react' ? 1 : 0) - m.react) * (1 - Math.exp(-d * 6));
  if (waddle) {
    // hurrying back to the water: rock side to side with little bounces
    r.body!.position.y = Math.abs(Math.sin(m.phase)) * 0.03;
    r.body!.rotation.z = Math.sin(m.phase) * 0.22;
    r.body!.rotation.x = 0.12;
    r.head!.rotation.x = -0.1 + Math.sin(m.phase * 2) * 0.08;
    r.head!.rotation.z = 0;
    r.tail!.rotation.y = Math.sin(m.phase) * 0.5;
    return;
  }
  r.body!.position.y = Math.sin(m.t * 2.1) * 0.012;
  r.body!.rotation.z = Math.sin(m.t * 1.3) * 0.05;
  r.body!.rotation.x = Math.sin(m.t * 1.7) * 0.03;
  // dip the head under for ~1.4 s every ~11 s (not while you are looking at it)
  const cyc = (m.t + parts.rig.head[2] * 37) % 11;
  const dip = state === 'react' ? 0 : cyc < 1.4 ? Math.sin((cyc / 1.4) * Math.PI) : 0;
  r.head!.rotation.x = Math.sin(m.phase) * 0.12 + dip * 1.5 - m.react * 0.35;
  r.head!.position.z = parts.rig.head[2] + Math.sin(m.phase) * 0.012;
  r.head!.rotation.z = m.react * Math.sin(m.t * 3) * 0.25;
  r.tail!.rotation.y = Math.sin(m.t * (state === 'react' ? 18 : 6)) * (state === 'react' ? 0.5 : 0.2);
}

/** Hops in little arcs (back legs push, front legs reach), nose/ear twitch when sitting, flops down for naps. */
function animateRabbit(r: RigRefs, parts: CritterParts, state: string, m: { t: number; phase: number; nap: number; react: number; hop: number }, dt: number, speed: number) {
  const d = Math.min(dt, 0.1);
  m.t += d;
  const k = 1 - Math.exp(-d * 8);
  m.nap += ((state === 'nap' ? 1 : 0) - m.nap) * k;
  m.react += ((state === 'react' ? 1 : 0) - m.react) * k;
  const walking = state === 'walk';
  if (walking) m.phase += d * (4 + speed * 2.5);
  const air = walking ? Math.max(0, Math.sin(m.phase)) : state === 'react' ? Math.max(0, Math.sin(m.t * 7)) * 0.5 : 0;
  m.hop = air * 0.11;
  const lie = m.nap;
  r.body!.position.y = m.hop - lie * 0.04 + Math.sin(m.t * 3) * 0.003;
  r.body!.rotation.x = walking ? -Math.cos(m.phase) * 0.18 : 0;
  r.legs.forEach((g, i) => {
    const front = i < 2;
    g.position.y = parts.rig.legs[i]![1] + m.hop - lie * 0.04;
    g.rotation.x = walking ? (front ? -air * 0.9 : air * 1.0) : lie * (front ? -1.2 : 1.2);
  });
  // ears/nose twitch: quick head jitters while sitting
  const twitch = !walking && Math.sin(m.t * 1.3) > 0.85 ? Math.sin(m.t * 40) * 0.05 : 0;
  r.head!.rotation.x = twitch + lie * 0.3 - m.react * 0.2;
  r.head!.rotation.y = state === 'idle' ? Math.sin(m.t * 0.5) * 0.4 * Math.max(0, Math.sin(m.t * 0.19)) : 0;
  r.head!.rotation.z = m.react * Math.sin(m.t * 2.5) * 0.3;
  r.tail!.rotation.y = Math.sin(m.t * 9) * 0.15;
}

// ------------------------------------------------------------------------------------------------ hugged critter
/** Size in the arms relative to the street size (big ducks and rabbits are drawn large to read from afar). */
const HOLD_SCALE: Record<CritterKind, number> = { cat: 0.85, shiba: 0.75, husky: 0.75, rabbit: 0.6, duck: 0.55, duckling: 0.9, kid: 0.55, lamb: 0.55, guineapig: 0.7 };
/** A cat or dog cradled sideways in a player's arms (child of the player's avatar group, player space in metres). */
export function HeldCritter({ id }: { id: string }) {
  const c = CRITTERS.find((x) => x.id === id);
  const parts = useMemo(() => (c ? buildCritter(c.kind, coatFor(c.id)) : null), [c]);
  useEffect(() => () => void (parts && Object.values(parts).forEach((g) => (g as THREE.BufferGeometry | null)?.dispose?.())), [parts]);
  const rig = useRef<RigRefs>({ legs: [] });
  const m = useRef({ t: 0 });
  useFrame((_, dt) => {
    const r = rig.current;
    if (!r.body || !r.head || !r.tail) return;
    const t = (m.current.t += Math.min(dt, 0.1));
    // happy in your arms: legs dangle and paddle a little, tail wags, head looks at you / around, a slow purr-sway
    r.body.rotation.z = Math.sin(t * 2) * 0.05;
    r.legs.forEach((g, i) => (g.rotation.x = (i < 2 ? -0.5 : 0.7) + Math.sin(t * 5 + i) * 0.15));
    r.tail.rotation.y = Math.sin(t * 14) * 0.55;
    r.head.rotation.y = -0.9 + Math.sin(t * 0.8) * 0.35;
    r.head.rotation.z = Math.sin(t * 1.6) * 0.2;
    r.head.rotation.x = -0.15;
  });
  if (!c || !parts) return null;
  const sc = SCALE[c.kind] * HOLD_SCALE[c.kind];
  // cradled sideways against the chest: body centre at hand height, just in front of the round torso
  return (
    <group position={[0.05, 0.68 - parts.rig.height * sc, 0.36]} rotation={[0, Math.PI / 2, 0]}>
      <CritterBody parts={parts} rig={rig} scale={sc} />
    </group>
  );
}
