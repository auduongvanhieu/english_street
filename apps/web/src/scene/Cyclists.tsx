import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CYCLISTS, cyclistAt, type Cyclist } from '../world/cyclists';
import { serverNow } from '../net/client';
import { useGame } from '../store/game';
import { useSettings } from '../store/settings';
import { bellSound } from '../audio/ambient';
import { localPos } from './LocalPlayer';
import { NameTag } from './NameTag';

/**
 * Low-poly cyclists built from primitives (no extra GLB): one merged mesh per rider (frame, saddle, bars,
 * torso, head, helmet, arms — clickable), plus shared InstancedMeshes for all wheels, thighs, shins and
 * cranks whose matrices are recomputed every frame from the server-clock schedule. ~7 draw calls for all
 * three riders; low quality shows one rider.
 */
const WHEEL_R = 0.34;
const CRANK = { x: 0.05, y: 0.42, r: 0.17 };
const HIP = { x: -0.12, y: 1.02 };
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

/** Cylinder along the segment A→B (local Y axis mapped onto the segment). */
function tube(r: number, a: THREE.Vector3, b: THREE.Vector3, hex: string) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 6);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return colored(g, hex);
}

/** Rider + bike (everything that does not move relative to the bike). Local +X is forward. */
function bodyGeometry(c: Cyclist) {
  const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
  const parts: THREE.BufferGeometry[] = [];
  const f = c.frame;
  // frame: rear axle (-0.45,0.34) · crank (0.05,0.42) · seat (−0.05,0.95) · head tube (0.45,0.9) · front axle (0.5,0.34)
  parts.push(tube(0.025, v(-0.45, WHEEL_R), v(CRANK.x, CRANK.y), f)); // chain stay
  parts.push(tube(0.025, v(-0.45, WHEEL_R), v(-0.05, 0.95), f)); // seat stay
  parts.push(tube(0.03, v(CRANK.x, CRANK.y), v(-0.05, 0.95), f)); // seat tube
  parts.push(tube(0.03, v(CRANK.x, CRANK.y), v(0.45, 0.9), f)); // down tube
  parts.push(tube(0.03, v(-0.05, 0.95), v(0.45, 0.9), f)); // top tube
  parts.push(tube(0.025, v(0.45, 0.9), v(0.5, WHEEL_R), f)); // fork
  parts.push(tube(0.02, v(0.42, 1.0), v(0.42, 1.0, -0.22), '#333')); // handlebar
  parts.push(tube(0.02, v(0.42, 1.0), v(0.42, 1.0, 0.22), '#333'));
  parts.push(colored(new THREE.BoxGeometry(0.22, 0.06, 0.14).translate(-0.1, 1.0, 0), '#222')); // saddle
  // rider
  parts.push(colored(new THREE.BoxGeometry(0.28, 0.5, 0.34).translate(0, 0.25, 0).rotateZ(-0.4).translate(-0.05, 1.05, 0), c.shirt)); // torso, pivoting at the hips and leaning over the bars
  parts.push(colored(new THREE.SphereGeometry(0.14, 8, 7).translate(0.2, 1.6, 0), '#f0c8a0')); // head
  parts.push(colored(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0.2, 1.62, 0), c.helmet)); // helmet
  for (const s of [-1, 1]) parts.push(tube(0.04, v(0.1, 1.42, s * 0.17), v(0.42, 1.02, s * 0.2), c.shirt)); // arms to the bars
  return mergeGeometries(parts, false)!;
}

function unitY() {
  return new THREE.Vector3(0, 1, 0);
}

export function Cyclists() {
  const low = useSettings((s) => s.quality) === 'low';
  const riders = useMemo(() => (low ? CYCLISTS.slice(0, 1) : CYCLISTS), [low]);
  const n = riders.length;
  const wheels = useRef<THREE.InstancedMesh>(null);
  const thighs = useRef<THREE.InstancedMesh>(null);
  const shins = useRef<THREE.InstancedMesh>(null);
  const cranks = useRef<THREE.InstancedMesh>(null);
  const bodies = useRef<(THREE.Mesh | null)[]>([]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const rung = useRef<number[]>(riders.map(() => -1));
  const [greet, setGreet] = useState<Record<string, number>>({});
  const select = useGame((s) => s.setSelectedCritter);
  const selected = useGame((s) => s.selectedCritter);
  const volume = useSettings((s) => s.ambientVolume);

  const geos = useMemo(
    () => ({
      body: riders.map(bodyGeometry),
      wheel: (() => {
        const parts: THREE.BufferGeometry[] = [colored(new THREE.TorusGeometry(WHEEL_R, 0.035, 6, 18), '#222')];
        for (let i = 0; i < 4; i++) parts.push(colored(new THREE.CylinderGeometry(0.008, 0.008, WHEEL_R * 2, 3).rotateZ((i * Math.PI) / 4), '#bbb'));
        return mergeGeometries(parts, false)!;
      })(),
      thigh: colored(new THREE.CylinderGeometry(0.06, 0.05, 1, 6), '#3b4a6b'),
      shin: colored(new THREE.CylinderGeometry(0.05, 0.04, 1, 6), '#3b4a6b'),
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

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      world: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      axisY: unitY(),
      axisZ: new THREE.Vector3(0, 0, 1),
    }),
    [],
  );

  /** Instance matrix for a limb cylinder between two local points, in the rider's world frame. */
  function limb(mesh: THREE.InstancedMesh, i: number, a: THREE.Vector3, b: THREE.Vector3, r: number) {
    const len = a.distanceTo(b);
    tmp.q.setFromUnitVectors(tmp.axisY, tmp.b.copy(b).sub(a).normalize());
    tmp.s.set(r, len, r);
    tmp.local.compose(tmp.p.copy(a).add(b).multiplyScalar(0.5), tmp.q, tmp.s);
    mesh.setMatrixAt(i, tmp.m.multiplyMatrices(tmp.world, tmp.local));
  }

  useFrame(() => {
    const now = serverNow();
    const W = wheels.current;
    const T = thighs.current;
    const S = shins.current;
    const C = cranks.current;
    if (!W || !T || !S || !C) return;
    riders.forEach((c, i) => {
      const pose = cyclistAt(c, now);
      const g = groups.current[i];
      const body = bodies.current[i];
      if (!pose.visible) {
        tmp.s.set(0, 0, 0);
        tmp.world.compose(tmp.p.set(0, -5, 0), tmp.q.identity(), tmp.s);
        for (let k = 0; k < 2; k++) {
          W.setMatrixAt(i * 2 + k, tmp.world);
          T.setMatrixAt(i * 2 + k, tmp.world);
          S.setMatrixAt(i * 2 + k, tmp.world);
        }
        C.setMatrixAt(i, tmp.world);
        if (body) body.visible = false;
        if (g) g.visible = false;
        return;
      }
      // Rider frame: +X forward, sitting on the road at (x, 0, z); a tiny lean when pedalling.
      const wobble = Math.sin(pose.dist * 1.7) * 0.025;
      tmp.q.setFromAxisAngle(tmp.axisY, pose.rot - Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), wobble));
      tmp.world.compose(tmp.p.set(pose.x, 0, pose.z), tmp.q, tmp.s.set(1, 1, 1));
      if (body) {
        body.visible = true;
        body.matrix.copy(tmp.world);
        body.matrixAutoUpdate = false;
        body.matrixWorldNeedsUpdate = true;
      }
      if (g) {
        g.visible = true;
        g.position.set(pose.x, 0, pose.z);
      }
      // wheels: spin about Z by distance / radius
      const spin = pose.dist / WHEEL_R;
      for (const [k, wx] of [
        [0, -0.45],
        [1, 0.5],
      ] as const) {
        tmp.local.compose(tmp.p.set(wx, WHEEL_R, 0), tmp.q.setFromAxisAngle(tmp.axisZ, -spin), tmp.s.set(1, 1, 1));
        W.setMatrixAt(i * 2 + k, tmp.m.multiplyMatrices(tmp.world, tmp.local));
      }
      // crank + pedals: one turn per ~2.6 wheel turns
      const ang = -spin / 2.6;
      tmp.local.compose(tmp.p.set(CRANK.x, CRANK.y, 0), tmp.q.setFromAxisAngle(tmp.axisZ, ang), tmp.s.set(1, 1, 1));
      C.setMatrixAt(i, tmp.m.multiplyMatrices(tmp.world, tmp.local));
      // legs: 2-link IK from the hip to each pedal (pedals are opposite each other)
      for (const [k, side] of [
        [0, -1],
        [1, 1],
      ] as const) {
        const pa = ang + (side > 0 ? 0 : Math.PI);
        const px = CRANK.x + Math.cos(pa) * CRANK.r;
        const py = CRANK.y + Math.sin(pa) * CRANK.r;
        const z = side * LEG_SIDE;
        const dx = px - HIP.x;
        const dy = py - HIP.y;
        const d = Math.min(Math.hypot(dx, dy), THIGH + SHIN - 0.01);
        // knee angle from the law of cosines; knee bends forward (+x)
        const cosA = (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d);
        const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)));
        const base = Math.atan2(dy, dx);
        const kx = HIP.x + Math.cos(base + alpha) * THIGH;
        const ky = HIP.y + Math.sin(base + alpha) * THIGH;
        limb(T, i * 2 + k, tmp.a.set(HIP.x, HIP.y, z), tmp.b.set(kx, ky, z), 1);
        limb(S, i * 2 + k, tmp.a.set(kx, ky, z), tmp.b.set(px, py, z), 1);
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
    W.instanceMatrix.needsUpdate = true;
    T.instanceMatrix.needsUpdate = true;
    S.instanceMatrix.needsUpdate = true;
    C.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {riders.map((c, i) => (
        <mesh
          key={c.id}
          ref={(el) => (bodies.current[i] = el)}
          geometry={geos.body[i]}
          castShadow
          frustumCulled={false}
          onClick={(e) => {
            e.stopPropagation();
            select(selected === c.id ? null : c.id);
          }}
        >
          <meshStandardMaterial vertexColors roughness={0.8} />
        </mesh>
      ))}
      {riders.map((c, i) => {
        const bubble = (greet[c.id] ?? 0) > Date.now() ? c.greeting : undefined;
        return (
          <group key={c.id + '-tag'} ref={(el) => (groups.current[i] = el)}>
            {bubble || selected === c.id ? <NameTag name={c.name} sub="cyclist" bubble={bubble} y={2.1} /> : null}
          </group>
        );
      })}
      <instancedMesh ref={wheels} args={[geos.wheel, undefined, n * 2]} frustumCulled={false} castShadow>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={thighs} args={[geos.thigh, undefined, n * 2]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={shins} args={[geos.shin, undefined, n * 2]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={cranks} args={[geos.crank, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
    </group>
  );
}
