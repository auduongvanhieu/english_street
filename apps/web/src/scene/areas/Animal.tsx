import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AreaId } from '@es/shared';
import { useSettings } from '../../store/settings';
import { chibiMaterial, chibiOutline } from '../chibi/buildChibi';
import { ANIMAL_SCALE, animalParts, type AnimalKind, type AnimalParts } from '../chibi/buildAnimal';
import { poseAt, type Critter } from '../../world/critters';
import { serverNow } from '../../net/client';
import { localPos } from '../LocalPlayer';
import { NameTag } from '../NameTag';
import { useArea } from '../../store/area';
import type { Enclosure } from '../../world/zooLayout';
import { CHOMP_MS, preyIn } from '../../world/spots';

interface Rig {
  body?: THREE.Group;
  head?: THREE.Group;
  tail?: THREE.Group;
  legs: THREE.Group[];
}

/** One zoo/farm animal walking a deterministic loop (same server clock as the street pets). Tap → its word card. */
export function Animal({
  id,
  kind,
  name,
  word,
  area,
  item,
  path,
  speed = 0.7,
  pause = 6,
  offset = 0,
  labelRadius = 7,
  pen,
}: {
  id: string;
  kind: AnimalKind;
  name: string;
  word: string;
  area: AreaId;
  item: string;
  path: [number, number][];
  speed?: number;
  pause?: number;
  offset?: number;
  labelRadius?: number;
  /** Lion / tiger: its enclosure, to go for a pet someone drops in there (world/spots.ts). */
  pen?: Enclosure;
}) {
  const parts = animalParts(kind);
  const scale = ANIMAL_SCALE[kind];
  const sched = useMemo(() => ({ id, kind: 'cat', name, path, speed, pause, offset, sentence: '', word: { en: word, vi: '' }, sound: 'meow' }) as Critter, [id, name, path, speed, pause, offset, word]);
  const g = useRef<THREE.Group>(null);
  const rig = useRef<Rig>({ legs: [] });
  const m = useRef({ t: Math.random() * 10, phase: 0, rot: 0, acc: 0, x: NaN, z: NaN, huntId: '', hx: 0, hz: 0 });
  const [close, setClose] = useState(false);
  const openCard = useArea((s) => s.openCard);

  useFrame((_, rawDt) => {
    const grp = g.current;
    if (!grp) return;
    const dt = Math.min(rawDt, 0.1);
    const st = m.current;
    const now = serverNow();
    const p = poseAt(sched, now);
    if (Number.isNaN(st.x)) {
      st.x = p.x;
      st.z = p.z;
    }
    let walking = p.clip === 'walk';
    let heading = p.rot;
    let pace = speed;
    let eat = 0;
    let leap = 0;
    const prey = pen ? preyIn(pen, now) : null;
    const dx = (prey ? prey.x : p.x) - st.x;
    const dz = (prey ? prey.z : p.z) - st.z;
    const dist = Math.hypot(dx, dz);
    if (prey && prey.age < CHOMP_MS) {
      // a pet was dropped in: stalk… then charge at it and pounce (timed, so it lands the pounce on every device)
      if (st.huntId !== prey.id) {
        st.huntId = prey.id;
        st.hx = st.x;
        st.hz = st.z;
      }
      const k = Math.min(1, Math.max(0, (prey.age - 600) / (CHOMP_MS - 900)));
      const ex = prey.x - st.hx;
      const ez = prey.z - st.hz;
      const reach = Math.max(0, 1 - 0.7 / (Math.hypot(ex, ez) || 1));
      const nx = st.hx + ex * k * reach;
      const nz = st.hz + ez * k * reach;
      walking = Math.hypot(nx - st.x, nz - st.z) > 0.001;
      st.x = nx;
      st.z = nz;
      heading = Math.atan2(dx, dz);
      pace = 3;
      leap = Math.max(0, 1 - Math.abs(prey.age - (CHOMP_MS - 250)) / 250);
    } else if (prey) {
      // munching where it caught it
      heading = Math.atan2(dx, dz);
      walking = false;
      eat = 1;
    } else if (dist > 0.4) {
      st.huntId = '';
      // trot back to its usual walk
      const step = Math.min(dist, 2.2 * dt);
      st.x += (dx / dist) * step;
      st.z += (dz / dist) * step;
      heading = Math.atan2(dx, dz);
      walking = true;
    } else {
      st.x = p.x;
      st.z = p.z;
    }
    grp.position.set(st.x, leap * 0.6, st.z);
    let d = heading - st.rot;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    st.rot += d * (1 - Math.exp(-dt * (prey ? 12 : 5)));
    grp.rotation.y = st.rot;
    animate(rig.current, parts, walking, st, dt, pace);
    if (eat && rig.current.head) rig.current.head.rotation.x = 0.45 + Math.abs(Math.sin(st.t * 9)) * 0.25;
    st.acc += dt;
    if (st.acc > 0.4) {
      st.acc = 0;
      const c = Math.hypot(st.x - localPos.x, st.z - localPos.z) < labelRadius;
      if (c !== close) setClose(c);
    }
  });

  const height = (parts.headAt[1] + 0.25) * scale;
  return (
    <group
      ref={g}
      onClick={(e) => {
        e.stopPropagation();
        openCard({ area, item });
      }}
    >
      <AnimalBody parts={parts} scale={scale} rig={rig} />
      {close ? <NameTag word={word} name={name} y={height + 0.35} /> : null}
    </group>
  );
}

function AnimalBody({ parts, scale, rig }: { parts: AnimalParts; scale: number; rig: React.RefObject<Rig> }) {
  const outline = useSettings((s) => s.quality) === 'high';
  const mat = chibiMaterial();
  const ol = chibiOutline();
  const part = (geo: THREE.BufferGeometry) => (
    <>
      <mesh geometry={geo} material={mat} castShadow />
      {outline ? <mesh geometry={geo} material={ol} /> : null}
    </>
  );
  return (
    <group scale={scale}>
      <group ref={(x) => void (x && (rig.current.body = x))}>
        {part(parts.body)}
        <group ref={(x) => void (x && (rig.current.head = x))} position={parts.headAt}>
          {part(parts.head)}
        </group>
        <group ref={(x) => void (x && (rig.current.tail = x))} position={parts.tailAt}>
          {part(parts.tail)}
        </group>
      </group>
      {parts.legs.map((p, i) => {
        const geo = i < parts.frontCount ? parts.legF : parts.legB;
        return geo ? (
          <group key={i} ref={(x) => void (x && (rig.current.legs[i] = x))} position={p}>
            {part(geo)}
          </group>
        ) : null;
      })}
    </group>
  );
}

/** Procedural gaits: diagonal walk, kangaroo/monkey/goat hops, penguin waddle, crocodile crawl, bird strut. */
function animate(r: Rig, parts: AnimalParts, walking: boolean, m: { t: number; phase: number }, dt: number, speed: number) {
  if (!r.body || !r.head || !r.tail) return;
  m.t += dt;
  if (walking) m.phase += dt * (4 + speed * 4);
  const s = Math.sin(m.phase);
  const idle = !walking;
  r.head.rotation.y = idle ? Math.sin(m.t * 0.5) * 0.35 * Math.max(0, Math.sin(m.t * 0.23)) : 0;
  r.head.rotation.x = idle ? Math.sin(m.t * 0.8) * 0.05 : Math.sin(m.phase * 2) * 0.05;
  r.tail.rotation.y = Math.sin(m.t * (idle ? 2 : 6)) * 0.3;
  r.body.position.y = Math.sin(m.t * 2.2) * 0.004;
  r.body.rotation.z = 0;
  r.body.rotation.x = 0;
  switch (parts.gait) {
    case 'hop': {
      const hop = walking ? Math.max(0, Math.sin(m.phase * 0.8)) : 0;
      r.body.position.y += hop * 0.09;
      r.legs.forEach((l, i) => (l.rotation.x = walking ? (i < parts.frontCount ? -0.4 : 0.6) * hop : 0));
      r.legs.forEach((l, i) => (l.position.y = parts.legs[i]![1] + hop * 0.09));
      break;
    }
    case 'waddle': {
      r.body.rotation.z = walking ? s * 0.18 : Math.sin(m.t * 1.3) * 0.03;
      break;
    }
    case 'crawl': {
      const sw = walking ? s * 0.6 : 0;
      r.legs.forEach((l, i) => (l.rotation.x = [sw, -sw, -sw, sw][i] ?? 0));
      r.tail.rotation.y = Math.sin(m.t * (walking ? 5 : 1)) * (walking ? 0.35 : 0.1);
      r.head.rotation.x = idle ? -Math.max(0, Math.sin(m.t * 0.4)) * 0.25 : 0; // jaws "open"
      break;
    }
    case 'strut': {
      const sw = walking ? s * 0.55 : 0;
      r.legs.forEach((l, i) => (l.rotation.x = i === 0 ? sw : -sw));
      // flamingos sometimes stand on one leg
      if (idle && parts.legs.length === 2 && Math.sin(m.t * 0.15) > 0.2) r.legs[1] && (r.legs[1].rotation.x = -1.6);
      r.head.rotation.x += walking ? Math.sin(m.phase * 2) * 0.12 : 0;
      break;
    }
    default: {
      const sw = walking ? s * 0.55 : 0;
      r.legs.forEach((l, i) => (l.rotation.x = [sw, -sw, -sw, sw][i] ?? 0));
      r.body.position.y += walking ? Math.abs(Math.cos(m.phase)) * 0.012 : 0;
    }
  }
}
