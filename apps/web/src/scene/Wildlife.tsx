import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Part, box, chibiMaterial, cyl, sphere } from './chibi/buildChibi';
import { localPos } from './LocalPlayer';
import { preloadLpm, useLpmParts } from './LpmModel';
import { RIVER_FAR_Z, RIVER_NEAR_Z } from './Horizon';
import { BRIDGE_X } from '../world/areas';
import { sky } from '../world/sky';

/**
 * Life around the street, purely for the eye (each player sees their own): fish leaping out of the river
 * with a splash, and little flocks of birds flapping across the sky in daylight.
 */
export function Wildlife({ low }: { low: boolean }) {
  return (
    <>
      <Fish count={low ? 3 : 6} />
      <Birds flocks={low ? 2 : 4} />
    </>
  );
}

// ------------------------------------------------------------------------------------------------ fish
const WATER_Y = -0.3;
const JUMP_S = 1.0;

function fishGeometry(color: string, belly: string) {
  const p = new Part();
  // body along +z, head forward
  p.add(sphere(0.12, 0, Math.PI, 0, Math.PI * 2, 12, 8), color, { s: [0.75, 0.9, 2.2] });
  p.add(sphere(0.1, 0, Math.PI, 0, Math.PI * 2, 10, 6), belly, { p: [0, -0.035, 0.02], s: [0.7, 0.6, 2] });
  // tail fin: two flat wedges in a V
  for (const s of [-1, 1]) p.add(box(0.02, 0.16, 0.14), color, { p: [0, s * 0.07, -0.3], r: [s * 0.6, 0, 0] });
  // dorsal fin
  p.add(box(0.015, 0.08, 0.12), color, { p: [0, 0.11, -0.02], r: [-0.4, 0, 0] });
  // eyes
  for (const s of [-1, 1]) p.add(sphere(0.022, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#1a1a1a', { p: [s * 0.075, 0.03, 0.17] });
  return p.build();
}

interface Leap {
  active: boolean;
  start: number;
  x: number;
  z: number;
  dir: number;
  height: number;
  splashedIn: boolean;
}

function Fish({ count }: { count: number }) {
  const geos = useMemo(() => [fishGeometry('#8fa7b8', '#e8eef2'), fishGeometry('#e0823a', '#f6d7b0'), fishGeometry('#6f8a5a', '#d9e0c2')], []);
  const fish = useRef<(THREE.Mesh | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const leaps = useRef<Leap[]>(Array.from({ length: count }, () => ({ active: false, start: 0, x: 0, z: 0, dir: 1, height: 1, splashedIn: false })));
  /** two splash rings per fish: out of the water, back in */
  const ringT = useRef<{ t: number; x: number; z: number }[]>(Array.from({ length: count * 2 }, () => ({ t: -1, x: 0, z: 0 })));
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.75, 1, 24).rotateX(-Math.PI / 2), []);
  const clock = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = (clock.current += dt);
    // only near the river (bank, bridges, south bank)
    const nearRiver = localPos.z > RIVER_NEAR_Z - 45 && localPos.z < RIVER_FAR_Z + 45;
    leaps.current.forEach((l, i) => {
      const m = fish.current[i];
      if (!m) return;
      if (!l.active) {
        m.visible = false;
        // a new leap now and then, somewhere in front of the player along the river
        if (nearRiver && Math.random() < dt * 0.35) {
          let x = localPos.x + (Math.random() - 0.5) * 50;
          if (Math.abs(Math.abs(x) - BRIDGE_X) < 5) x += 10; // not under a bridge
          Object.assign(l, { active: true, start: now, x, z: RIVER_NEAR_Z + 2 + Math.random() * (RIVER_FAR_Z - RIVER_NEAR_Z - 4), dir: Math.random() < 0.5 ? -1 : 1, height: 0.7 + Math.random() * 0.7, splashedIn: false });
          splash(ringT.current[i * 2]!, l.x - l.dir * 0.8, l.z);
          m.geometry = geos[Math.floor(Math.random() * geos.length)]!;
        }
        return;
      }
      const u = (now - l.start) / JUMP_S;
      if (u >= 1) {
        l.active = false;
        m.visible = false;
        return;
      }
      if (u > 0.92 && !l.splashedIn) {
        l.splashedIn = true;
        splash(ringT.current[i * 2 + 1]!, l.x + l.dir * 0.8, l.z);
      }
      // arc: up and over, nose following the curve, a wiggle of the whole body
      const x = l.x + l.dir * (u - 0.5) * 1.6;
      const y = WATER_Y + 4 * l.height * u * (1 - u) - 0.1;
      const slope = (4 * l.height * (1 - 2 * u)) / 1.6;
      m.visible = true;
      m.position.set(x, y, l.z);
      m.rotation.set(-Math.atan(slope), (l.dir * Math.PI) / 2, Math.sin(now * 25) * 0.15, 'YXZ');
    });
    ringT.current.forEach((r, i) => {
      const m = rings.current[i];
      if (!m) return;
      if (r.t < 0) {
        m.visible = false;
        return;
      }
      r.t += dt;
      const k = r.t / 0.9;
      if (k >= 1) {
        r.t = -1;
        m.visible = false;
        return;
      }
      m.visible = true;
      m.position.set(r.x, WATER_Y + 0.02, r.z);
      m.scale.setScalar(0.25 + k * 1.1);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
    });
  });

  return (
    <group>
      {leaps.current.map((_, i) => (
        <mesh key={i} ref={(m) => void (fish.current[i] = m)} geometry={geos[i % geos.length]} material={chibiMaterial()} visible={false} scale={1.6} />
      ))}
      {ringT.current.map((_, i) => (
        // each ring its own material so they fade independently
        <mesh key={i} ref={(m) => void (rings.current[i] = m)} geometry={ringGeo} material={ringMat.clone()} visible={false} renderOrder={2} />
      ))}
    </group>
  );
}

function splash(r: { t: number; x: number; z: number }, x: number, z: number) {
  r.t = 0;
  r.x = x;
  r.z = z;
}

// ------------------------------------------------------------------------------------------------ birds
const FLOCK = 6;

/** Body + wing of each kind (dark pigeon, white gull, brown sparrow): Blender LPM asset assets-src/lpm/recipes/bird.py.
 *  The wing's pivot is the shoulder, reaching along +x with its leading edge towards +z (the flight direction). */
const BIRD_KINDS = ['dark', 'white', 'brown'] as const;
preloadLpm('bird');

interface Flock {
  start: number;
  dur: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  kind: number;
}

function newFlock(now: number, delay: number): Flock {
  // fly across the sky over the player, from one side to the other
  const a = Math.random() * Math.PI * 2;
  const r = 75;
  const h = 10 + Math.random() * 8;
  const side = (Math.random() - 0.5) * 36;
  const cx = localPos.x + Math.cos(a + Math.PI / 2) * side;
  const cz = localPos.z + Math.sin(a + Math.PI / 2) * side;
  const from = new THREE.Vector3(cx + Math.cos(a) * r, h, cz + Math.sin(a) * r);
  const to = new THREE.Vector3(cx - Math.cos(a) * r, h + (Math.random() - 0.5) * 6, cz - Math.sin(a) * r);
  return { start: now + delay, dur: (2 * r) / (6 + Math.random() * 4), from, to, kind: Math.floor(Math.random() * 3) };
}

function Birds({ flocks }: { flocks: number }) {
  const parts = useLpmParts('bird');
  const kinds = useMemo(() => BIRD_KINDS.map((k) => ({ body: parts[`SM_Bird_body_${k}`]!, wing: parts[`SM_Bird_wing_${k}`]! })), [parts]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const wings = useRef<(THREE.Group | null)[]>([]);
  const bodies = useRef<(THREE.Mesh | null)[]>([]);
  const wingMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const clock = useRef(0);
  const state = useRef<Flock[]>(Array.from({ length: flocks }, (_, i) => newFlock(0, i * 4 - 6)));
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = (clock.current += dt);
    const out = sky.day < 0.35 || sky.rain > 0.5; // roosting at night and in heavy rain
    state.current.forEach((f, fi) => {
      const g = groups.current[fi];
      if (!g) return;
      const u = (now - f.start) / f.dur;
      if (u >= 1) {
        state.current[fi] = newFlock(now, 3 + Math.random() * 12);
        const k = state.current[fi]!.kind;
        for (let b = 0; b < FLOCK; b++) {
          const body = bodies.current[fi * FLOCK + b];
          if (body) body.geometry = kinds[k]!.body;
          for (const s of [0, 1]) {
            const w = wingMeshes.current[(fi * FLOCK + b) * 2 + s];
            if (w) w.geometry = kinds[k]!.wing;
          }
        }
        g.visible = false;
        return;
      }
      g.visible = u >= 0 && !out;
      if (!g.visible) return;
      tmp.lerpVectors(f.from, f.to, u);
      g.position.copy(tmp);
      g.position.y += Math.sin(now * 0.7 + fi) * 0.8;
      g.rotation.y = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z);
      for (let b = 0; b < FLOCK; b++) {
        const i = fi * FLOCK + b;
        // flap in bursts, then glide with wings out
        const t = now * 1.3 + b * 0.37 + fi;
        const gliding = Math.sin(t * 0.8) > 0.55;
        const flap = gliding ? 0.08 : Math.sin(now * 14 + b * 1.7) * 0.75;
        for (const s of [0, 1]) {
          const w = wings.current[i * 2 + s];
          if (w) w.rotation.z = flap; // the left wing group is turned around, so the same angle mirrors
        }
      }
    });
  });

  return (
    <group>
      {state.current.map((f, fi) => (
        <group key={fi} ref={(g) => void (groups.current[fi] = g)} visible={false}>
          {Array.from({ length: FLOCK }, (_, b) => {
            // a loose V: leader in front, the others behind on alternate sides
            const row = Math.ceil(b / 2);
            const side = b % 2 ? 1 : -1;
            const i = fi * FLOCK + b;
            const k = kinds[f.kind]!;
            return (
              <group key={b} position={[side * row * 1.4 + Math.sin(b * 3.1) * 0.3, Math.sin(b * 1.9) * 0.4, -row * 1.6]} scale={2.6}>
                <mesh ref={(m) => void (bodies.current[i] = m)} geometry={k.body} material={chibiMaterial()} />
                {[0, 1].map((s) => (
                  <group key={s} ref={(g) => void (wings.current[i * 2 + s] = g)} position={[s ? -0.06 : 0.06, 0.03, 0.04]} rotation-y={s ? Math.PI : 0}>
                    {/* the left wing group is turned around; flip z back so its leading edge still faces forward */}
                    <mesh ref={(m) => void (wingMeshes.current[i * 2 + s] = m)} geometry={k.wing} material={chibiMaterial()} scale={[1, 1, s ? -1 : 1]} />
                  </group>
                ))}
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}
