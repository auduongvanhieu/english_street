import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CYCLISTS, cyclistAt, type Cyclist } from '../world/cyclists';
import { serverNow } from '../net/client';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { bellSound } from '../audio/ambient';
import { localPos } from './LocalPlayer';
import { END_FENCE_X } from '../world/layout';
import { NameTag } from './NameTag';

/**
 * Low-poly cyclists built from primitives (no extra GLB). Per rider: one merged bike mesh and one merged
 * upper-body mesh (both clickable). Wheels, cranks, thighs, shins and arms are shared InstancedMeshes posed
 * every frame from the server-clock schedule (2-link IK for legs). At the fences that close both ends of the
 * road the rider gets off, steps beside the bike, lifts it over the fence while walking, and gets back on
 * (`pose.carry` blends riding ↔ carrying). Low quality shows one rider.
 */
const WHEEL_R = 0.34;
const CRANK = { x: 0.05, y: 0.42, r: 0.17 };
const SEAT_HIP = new THREE.Vector3(-0.12, 1.02, 0);
/** Standing beside the bike (rider on the local -z side) while carrying it. */
const STAND_HIP = new THREE.Vector3(0.0, 0.92, -0.55);
const LIFT_H = 0.75; // fence top is ~0.65 m above the road
const THIGH = 0.44;
const SHIN = 0.44;
const LEG_SIDE = 0.17;
const BELL_RADIUS = 6;
const GREET_MS = 2500;

function colored(g: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Cylinder along the segment A→B. */
function tube(r: number, a: THREE.Vector3, b: THREE.Vector3, hex: string) {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return colored(g, hex);
}

const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

/** Bike only, local +X forward, wheels on y = 0. */
function bikeGeometry(c: Cyclist) {
  const f = c.frame;
  const parts = [
    tube(0.025, v(-0.45, WHEEL_R), v(CRANK.x, CRANK.y), f), // chain stay
    tube(0.025, v(-0.45, WHEEL_R), v(-0.05, 0.95), f), // seat stay
    tube(0.03, v(CRANK.x, CRANK.y), v(-0.05, 0.95), f), // seat tube
    tube(0.03, v(CRANK.x, CRANK.y), v(0.45, 0.9), f), // down tube
    tube(0.03, v(-0.05, 0.95), v(0.45, 0.9), f), // top tube
    tube(0.025, v(0.45, 0.9), v(0.5, WHEEL_R), f), // fork
    tube(0.02, v(0.42, 1.0, -0.22), v(0.42, 1.0, 0.22), '#333'), // handlebar
    colored(new THREE.BoxGeometry(0.22, 0.06, 0.14).translate(-0.1, 1.0, 0), '#222'), // saddle
  ];
  return mergeGeometries(parts, false)!;
}

/** Upper body with the hip joint at the origin, upright (lean is applied per frame). */
function riderGeometry(c: Cyclist) {
  const parts = [
    colored(new THREE.BoxGeometry(0.26, 0.5, 0.34).translate(0.02, 0.25, 0), c.shirt),
    colored(new THREE.SphereGeometry(0.13, 8, 7).translate(0.04, 0.66, 0), '#f0c8a0'),
    colored(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0.04, 0.68, 0), c.helmet),
  ];
  return mergeGeometries(parts, false)!;
}

export function Cyclists() {
  const low = useSettings((s) => s.quality) === 'low';
  const riders = useMemo(() => (low ? CYCLISTS.slice(0, 1) : CYCLISTS), [low]);
  const n = riders.length;
  const wheels = useRef<THREE.InstancedMesh>(null);
  const thighs = useRef<THREE.InstancedMesh>(null);
  const shins = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const cranks = useRef<THREE.InstancedMesh>(null);
  const bikes = useRef<(THREE.Mesh | null)[]>([]);
  const bodies = useRef<(THREE.Mesh | null)[]>([]);
  const tags = useRef<(THREE.Group | null)[]>([]);
  const rung = useRef<number[]>(riders.map(() => -1));
  const [greet, setGreet] = useState<Record<string, number>>({});
  const select = useGame((s) => s.setSelectedCritter);
  const selected = useGame((s) => s.selectedCritter);
  const volume = useSettings((s) => s.ambientVolume);

  const geos = useMemo(
    () => ({
      bike: riders.map(bikeGeometry),
      rider: riders.map(riderGeometry),
      wheel: (() => {
        const parts: THREE.BufferGeometry[] = [colored(new THREE.TorusGeometry(WHEEL_R, 0.035, 6, 18), '#222')];
        for (let i = 0; i < 4; i++) parts.push(colored(new THREE.CylinderGeometry(0.008, 0.008, WHEEL_R * 2, 3).rotateZ((i * Math.PI) / 4), '#bbb'));
        return mergeGeometries(parts, false)!;
      })(),
      thigh: colored(new THREE.CylinderGeometry(0.06, 0.05, 1, 6), '#3b4a6b'),
      shin: colored(new THREE.CylinderGeometry(0.05, 0.04, 1, 6), '#3b4a6b'),
      arm: colored(new THREE.CylinderGeometry(0.04, 0.035, 1, 6), '#ffffff'), // tinted per rider via instanceColor
      crank: (() => {
        const parts: THREE.BufferGeometry[] = [];
        for (const s of [-1, 1]) {
          parts.push(colored(new THREE.BoxGeometry(CRANK.r, 0.03, 0.03).translate((s * CRANK.r) / 2, 0, s * (LEG_SIDE - 0.04)), '#444'));
          parts.push(colored(new THREE.BoxGeometry(0.1, 0.02, 0.07).translate(s * CRANK.r, 0, s * LEG_SIDE), '#222'));
        }
        return mergeGeometries(parts, false)!;
      })(),
    }),
    [riders],
  );
  useEffect(() => () => Object.values(geos).flat().forEach((g) => g.dispose()), [geos]);
  useLayoutEffect(() => {
    const a = arms.current;
    if (!a) return;
    riders.forEach((c, i) => {
      a.setColorAt(i * 2, new THREE.Color(c.shirt));
      a.setColorAt(i * 2 + 1, new THREE.Color(c.shirt));
    });
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
  }, [riders]);

  const t = useMemo(
    () => ({
      world: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      bikeLocal: new THREE.Matrix4(),
      out: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      hip: new THREE.Vector3(),
      legHip: new THREE.Vector3(),
      shoulder: new THREE.Vector3(),
      hand: new THREE.Vector3(),
      hand2: new THREE.Vector3(),
      foot: new THREE.Vector3(),
      foot2: new THREE.Vector3(),
      knee: new THREE.Vector3(),
      one: new THREE.Vector3(1, 1, 1),
      X: new THREE.Vector3(1, 0, 0),
      Y: new THREE.Vector3(0, 1, 0),
      Z: new THREE.Vector3(0, 0, 1),
      hidden: new THREE.Matrix4().makeScale(0, 0, 0),
    }),
    [],
  );

  /** Instance matrix for a unit-length cylinder stretched from a to b (both in the cyclist frame). */
  function limb(mesh: THREE.InstancedMesh, i: number, a: THREE.Vector3, b: THREE.Vector3) {
    t.dir.subVectors(b, a);
    const len = t.dir.length();
    t.q.setFromUnitVectors(t.Y, t.dir.divideScalar(Math.max(len, 1e-4)));
    t.local.compose(t.p.addVectors(a, b).multiplyScalar(0.5), t.q, t.s.set(1, len, 1));
    mesh.setMatrixAt(i, t.out.multiplyMatrices(t.world, t.local));
  }

  /** Knee for a 2-link leg hip→foot, bending forward (+x); z interpolated. */
  function knee(hip: THREE.Vector3, foot: THREE.Vector3, out: THREE.Vector3) {
    const dx = foot.x - hip.x;
    const dy = foot.y - hip.y;
    const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.01);
    const cosA = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * Math.max(d, 1e-4));
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)));
    const base = Math.atan2(dy, dx);
    return out.set(hip.x + Math.cos(base + alpha) * THIGH, hip.y + Math.sin(base + alpha) * THIGH, (hip.z + foot.z) / 2);
  }

  useFrame(() => {
    const now = serverNow();
    const W = wheels.current;
    const T = thighs.current;
    const S = shins.current;
    const A = arms.current;
    const C = cranks.current;
    if (!W || !T || !S || !A || !C) return;
    riders.forEach((c, i) => {
      const pose = cyclistAt(c, now);
      const bike = bikes.current[i];
      const body = bodies.current[i];
      const tag = tags.current[i];
      if (!pose.visible) {
        for (const m of [W, T, S, A]) {
          m.setMatrixAt(i * 2, t.hidden);
          m.setMatrixAt(i * 2 + 1, t.hidden);
        }
        C.setMatrixAt(i, t.hidden);
        if (bike) bike.visible = false;
        if (body) body.visible = false;
        if (tag) tag.visible = false;
        return;
      }
      const k = pose.carry;
      const ly = k * LIFT_H;
      // Cyclist frame: +X forward, at road level; a little wobble while pedalling.
      const wobble = Math.sin(pose.dist * 1.7) * 0.025 * (1 - k);
      t.q.setFromAxisAngle(t.Y, pose.rot - Math.PI / 2).multiply(t.q2.setFromAxisAngle(t.X, wobble));
      t.world.compose(t.p.set(pose.x, 0, pose.z), t.q, t.one);

      // bike (lifted while carried, tilted nose-up a touch)
      const bikeLocal = t.bikeLocal.compose(t.p.set(0, ly, 0), t.q.setFromAxisAngle(t.Z, k * 0.12), t.one);
      if (bike) {
        bike.visible = true;
        bike.matrix.multiplyMatrices(t.world, bikeLocal);
        bike.matrixWorldNeedsUpdate = true;
      }
      const spin = pose.dist / WHEEL_R;
      for (const [w, wx] of [
        [0, -0.45],
        [1, 0.5],
      ] as const) {
        t.out.compose(t.p.set(wx, WHEEL_R, 0), t.q.setFromAxisAngle(t.Z, -spin), t.one);
        W.setMatrixAt(i * 2 + w, t.out.premultiply(bikeLocal).premultiply(t.world));
      }
      const ang = -spin / 2.6;
      t.out.compose(t.p.set(CRANK.x, CRANK.y, 0), t.q.setFromAxisAngle(t.Z, ang), t.one);
      C.setMatrixAt(i, t.out.premultiply(bikeLocal).premultiply(t.world));

      // fence position along the cyclist's forward axis (nearest end fence)
      const fx = Math.sign(pose.x) * END_FENCE_X;
      const fenceAhead = c.dir * (fx - pose.x);
      // body: hip slides from the saddle to standing beside the bike; lean eases from racing to upright
      t.hip.lerpVectors(SEAT_HIP, STAND_HIP, k);
      const lean = -0.4 + 0.32 * k;
      if (body) {
        body.visible = true;
        t.local.compose(t.hip, t.q.setFromAxisAngle(t.Z, lean), t.one);
        body.matrix.multiplyMatrices(t.world, t.local);
        body.matrixWorldNeedsUpdate = true;
      }
      // the bike's own points (bars, saddle) in the cyclist frame, after the lift/tilt
      const onBike = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(x, y, z).applyMatrix4(bikeLocal);

      for (const [j, side] of [
        [0, -1],
        [1, 1],
      ] as const) {
        // arms: riding → hands on the bars; carrying → near hand on the bars, far hand under the saddle
        t.shoulder.set(0.02, 0.45, side * 0.17).applyAxisAngle(t.Z, lean).add(t.hip);
        onBike(0.42, 1.0, side * 0.2, t.hand);
        if (side > 0) onBike(0.42, 1.0, -0.2, t.hand2);
        else onBike(-0.1, 0.97, -0.05, t.hand2);
        t.hand.lerp(t.hand2, k);
        limb(A, i * 2 + j, t.shoulder, t.hand);

        // legs: riding → feet on the pedals; carrying → walking on the road beside the bike
        const pa = ang + (side > 0 ? 0 : Math.PI);
        onBike(CRANK.x + Math.cos(pa) * CRANK.r, CRANK.y + Math.sin(pa) * CRANK.r, side * LEG_SIDE, t.foot);
        const step = pose.walk + (side > 0 ? 0 : Math.PI);
        t.foot2.set(t.hip.x + Math.sin(step) * 0.22, 0.06 + Math.max(0, Math.cos(step)) * 0.1, STAND_HIP.z + side * 0.11);
        // stepping over the rails: a foot near the fence line is lifted above the top rail
        const bump = Math.max(0, 1 - Math.abs(t.foot2.x - fenceAhead) / 0.4);
        t.foot2.y += bump * 0.68;
        t.foot.lerp(t.foot2, k);
        t.legHip.set(t.hip.x, t.hip.y - 0.02, THREE.MathUtils.lerp(side * LEG_SIDE, STAND_HIP.z + side * 0.11, k));
        knee(t.legHip, t.foot, t.knee);
        limb(T, i * 2 + j, t.legHip, t.knee);
        limb(S, i * 2 + j, t.knee, t.foot);
      }
      if (tag) {
        tag.visible = true;
        tag.position.set(pose.x, 0, pose.z);
      }

      // bell + greeting once per pass when passing close to the local player
      const dist = Math.hypot(pose.x - localPos.x, pose.z - localPos.z);
      if (dist < BELL_RADIUS && rung.current[i] !== pose.pass) {
        rung.current[i] = pose.pass;
        bellSound(Math.max(0.25, volume));
        setGreet((s) => ({ ...s, [c.id]: Date.now() + GREET_MS }));
        setTimeout(() => setGreet((s) => ({ ...s, [c.id]: 0 })), GREET_MS + 50);
      }
    });
    for (const m of [W, T, S, A, C]) m.instanceMatrix.needsUpdate = true;
  });

  const click = (id: string) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    select(selected === id ? null : id);
  };

  return (
    <group>
      {riders.map((c, i) => (
        <group key={c.id}>
          <mesh ref={(el) => (bikes.current[i] = el)} geometry={geos.bike[i]} matrixAutoUpdate={false} castShadow frustumCulled={false} onClick={click(c.id)}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
          <mesh ref={(el) => (bodies.current[i] = el)} geometry={geos.rider[i]} matrixAutoUpdate={false} castShadow frustumCulled={false} onClick={click(c.id)}>
            <meshStandardMaterial vertexColors roughness={0.8} />
          </mesh>
          <group ref={(el) => (tags.current[i] = el)}>
            {(greet[c.id] ?? 0) > Date.now() || selected === c.id ? <NameTag name={c.name} sub="cyclist" bubble={(greet[c.id] ?? 0) > Date.now() ? c.greeting : undefined} y={2.1} /> : null}
          </group>
        </group>
      ))}
      <instancedMesh ref={wheels} args={[geos.wheel, undefined, n * 2]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={thighs} args={[geos.thigh, undefined, n * 2]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={shins} args={[geos.shin, undefined, n * 2]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={arms} args={[geos.arm, undefined, n * 2]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={cranks} args={[geos.crank, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
