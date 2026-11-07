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
import { END_FENCE_X } from '../world/layout';
import { livePos } from '../world/avoid';
import { playerPoints } from './players';

/** Swerve: pass people at least this far to the side; react to people up to SEE_AHEAD m in front. */
const PASS_GAP = 1.35;
const SEE_AHEAD = 7;
const MAX_SWERVE = 2.6;
import { NameTag } from './NameTag';
import { CHIBI_SCALE, JOINTS, chibiMaterial, chibiOutline, chibiParts, type ChibiParts, type ChibiSpec } from './chibi/buildChibi';

/**
 * Cyclists in the chibi style: a chibi rider (same builder as the players, wearing a bike helmet) on a small,
 * chunky cartoon bike. Per rider: one merged bike mesh and a jointed chibi rig; wheels and cranks are shared
 * InstancedMeshes. Everything is posed every frame from the server-clock schedule. At the fences that close
 * both ends of the road the rider hops off, walks beside the bike holding it up over the fence (with a little
 * jump over the rail), and gets back on (`pose.carry` blends riding ↔ carrying). Low quality shows one rider.
 */
/** Bike size relative to the old adult bike (chibi riders are short). */
const BS = 0.66;
const WHEEL_R = 0.34 * BS;
const CRANK = { x: 0.05 * BS, y: 0.42 * BS, r: 0.17 * BS };
const SADDLE = { x: -0.1 * BS, y: 1.0 * BS };
const BARS = { x: 0.42 * BS, y: 1.0 * BS };
/** Rig root (feet level) when seated / standing beside the bike while carrying it (bike frame). */
const SEAT_ROOT = new THREE.Vector3(SADDLE.x - 0.02, SADDLE.y + 0.03 - JOINTS.hips[1] * CHIBI_SCALE, 0);
const STAND_ROOT = new THREE.Vector3(0.05, 0, -0.5);
const LIFT_H = 0.75; // fence top is ~0.65 m above the road
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

/** Bike only, local +X forward, wheels on y = 0 (built at adult size, then scaled by BS). */
function bikeGeometry(c: Cyclist) {
  const f = c.frame;
  const W = 0.34;
  const parts = [
    tube(0.04, v(-0.45, W), v(0.05, 0.42), f), // chain stay
    tube(0.04, v(-0.45, W), v(-0.05, 0.95), f), // seat stay
    tube(0.05, v(0.05, 0.42), v(-0.05, 0.95), f), // seat tube
    tube(0.05, v(0.05, 0.42), v(0.45, 0.9), f), // down tube
    tube(0.05, v(-0.05, 0.95), v(0.45, 0.9), f), // top tube
    tube(0.04, v(0.45, 0.9), v(0.5, W), f), // fork
    tube(0.035, v(0.42, 1.0, -0.28), v(0.42, 1.0, 0.28), '#333'), // handlebar
    colored(new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.8, 1).translate(0.42, 1.0, 0.3), '#222'), // grips
    colored(new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.8, 1).translate(0.42, 1.0, -0.3), '#222'),
    colored(new THREE.SphereGeometry(0.13, 10, 6).scale(1.3, 0.45, 1).translate(-0.1, 1.0, 0), '#2a2a2a'), // saddle
    colored(new THREE.BoxGeometry(0.28, 0.2, 0.34).translate(0.68, 0.98, 0), '#c9a26b'), // front basket
    colored(new THREE.TorusGeometry(0.3, 0.03, 4, 12, Math.PI).rotateX(Math.PI / 2).translate(-0.45, W + 0.02, 0), f), // rear mudguard
    colored(new THREE.SphereGeometry(0.05, 8, 6).translate(0.6, 1.02, 0), '#fff3a0'), // lamp
  ];
  return mergeGeometries(parts, false)!.scale(BS, BS, BS);
}

function riderSpec(c: Cyclist): ChibiSpec {
  return { body: 'tee', skin: c.skin, hair: c.hair, hairStyle: c.hairStyle, top: c.shirt, bottom: c.shorts, shoes: '#f2f2f2', hat: 'helmet', hatColor: c.helmet, glasses: 'none', bag: 'none', tag: 'plain', pet: 'none' };
}

interface RiderRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

export function Cyclists() {
  const low = useSettings((s) => s.quality) === 'low';
  const riders = useMemo(() => (low ? CYCLISTS.slice(0, 1) : CYCLISTS), [low]);
  const n = riders.length;
  const wheels = useRef<THREE.InstancedMesh>(null);
  const cranks = useRef<THREE.InstancedMesh>(null);
  const bikes = useRef<(THREE.Mesh | null)[]>([]);
  const rigs = useRef<Partial<RiderRig>[]>(riders.map(() => ({})));
  const outline = useSettings((s) => s.quality) === 'high';
  const tags = useRef<(THREE.Group | null)[]>([]);
  const rung = useRef<number[]>(riders.map(() => -1));
  const swerve = useRef<number[]>(riders.map(() => 0));
  const [greet, setGreet] = useState<Record<string, number>>({});
  const select = useGame((s) => s.setSelectedCritter);
  const selected = useGame((s) => s.selectedCritter);
  const volume = useSettings((s) => s.ambientVolume);

  const geos = useMemo(
    () => ({
      bike: riders.map(bikeGeometry),
      wheel: (() => {
        const parts: THREE.BufferGeometry[] = [colored(new THREE.TorusGeometry(0.34, 0.06, 8, 20), '#2a2a2a')];
        parts.push(colored(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10).rotateX(Math.PI / 2), '#d8d8d8'));
        for (let i = 0; i < 3; i++) parts.push(colored(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 4).rotateZ((i * Math.PI) / 3), '#cfcfcf'));
        return mergeGeometries(parts, false)!.scale(BS, BS, BS);
      })(),
      crank: (() => {
        const parts: THREE.BufferGeometry[] = [];
        for (const s of [-1, 1]) {
          parts.push(colored(new THREE.BoxGeometry(0.17, 0.04, 0.04).translate((s * 0.17) / 2, 0, s * 0.13), '#444'));
          parts.push(colored(new THREE.BoxGeometry(0.12, 0.03, 0.1).translate(s * 0.17, 0, s * 0.17), '#222'));
        }
        parts.push(colored(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12).rotateX(Math.PI / 2).translate(0, 0, 0.1), '#888'));
        return mergeGeometries(parts, false)!.scale(BS, BS, BS);
      })(),
      rider: riders.map((c) => chibiParts(riderSpec(c))),
    }),
    [riders],
  );
  useEffect(() => () => [...geos.bike, geos.wheel, geos.crank].forEach((g) => g.dispose()), [geos]);
  useEffect(() => () => riders.forEach((c) => livePos.delete(c.id)), [riders]);

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

  /** Chibi rider: seated pedalling ↔ standing beside the lifted bike, walking (k = carry blend). */
  function poseRider(r: RiderRig, pose: { walk: number; carry: number }, k: number, crank: number, fenceAhead: number) {
    t.p.lerpVectors(SEAT_ROOT, STAND_ROOT, k);
    // hop over the rail when the rider's own x reaches the fence line
    const hop = Math.max(0, 1 - Math.abs(t.p.x - fenceAhead) / 0.5) * k;
    t.p.y += Math.sin(hop * Math.PI * 0.5) * 0.7;
    // rig faces +Z; the cyclist frame faces +X
    t.local.compose(t.p, t.q.setFromAxisAngle(t.Y, Math.PI / 2), t.one);
    r.root.visible = true;
    r.root.matrix.multiplyMatrices(t.world, t.local);
    r.root.matrixWorldNeedsUpdate = true;
    const ride = 1 - k;
    const walk = Math.sin(pose.walk);
    // legs: pedalling circles while riding, walking steps while carrying (tucked while hopping)
    const pedal = (side: number) => -1.05 + Math.sin(crank + side * Math.PI) * 0.45;
    r.legL.rotation.x = pedal(0) * ride + (walk * 0.55 - hop * 0.8) * k;
    r.legR.rotation.x = pedal(1) * ride + (-walk * 0.55 - hop * 0.5) * k;
    r.hips.position.y = JOINTS.hips[1] + Math.abs(Math.cos(pose.walk)) * 0.02 * k;
    // torso leans to the bars while riding
    r.torso.rotation.set(0.32 * ride + 0.05 * k, 0, Math.sin(crank) * 0.04 * ride);
    r.head.rotation.set(-0.3 * ride, 0, 0);
    // arms: both reach for the bars; carrying, the right arm holds the bike up beside, the left steadies the front
    r.armL.rotation.set(-1.15 * ride + -2.2 * k, 0, 0.12 * ride + 0.2 * k);
    r.armR.rotation.set(-1.15 * ride + -0.6 * k, 0, -0.12 * ride - 2.0 * k);
  }

  useFrame((_, dt) => {
    const now = serverNow();
    const people = playerPoints();
    const W = wheels.current;
    const C = cranks.current;
    if (!W || !C) return;
    riders.forEach((c, i) => {
      const pose = cyclistAt(c, now);
      const bike = bikes.current[i];
      const rig = rigs.current[i] as RiderRig | undefined;
      const tag = tags.current[i];
      if (!pose.visible) {
        W.setMatrixAt(i * 2, t.hidden);
        W.setMatrixAt(i * 2 + 1, t.hidden);
        C.setMatrixAt(i, t.hidden);
        livePos.delete(c.id);
        if (bike) bike.visible = false;
        if (rig?.root) rig.root.visible = false;
        if (tag) tag.visible = false;
        return;
      }
      // Swerve around people on the road ahead: pick the side away from the person, strongest for the closest one.
      let want = 0;
      let weight = 0;
      for (const p of people) {
        const ahead = c.dir * (p.x - pose.x);
        if (ahead < -1.2 || ahead > SEE_AHEAD) continue;
        const dz = p.z - pose.z;
        if (Math.abs(dz) >= PASS_GAP) continue;
        const w = ahead < 3 ? 1 : 1 - (ahead - 3) / (SEE_AHEAD - 3);
        // go to the side with more road (towards the centre line when the person is on our lane edge)
        const side = Math.abs(dz) < 0.05 ? -Math.sign(pose.z) : -Math.sign(dz);
        const target = THREE.MathUtils.clamp(p.z + side * PASS_GAP - pose.z, -MAX_SWERVE, MAX_SWERVE);
        if (w > weight) {
          weight = w;
          want = target * w;
        }
      }
      const prev = swerve.current[i]!;
      const cur = prev + (want - prev) * (1 - Math.pow(0.05, dt));
      swerve.current[i] = cur;
      pose.z += cur;
      // steer into the swerve a little
      pose.rot -= c.dir * THREE.MathUtils.clamp((want - cur) * 0.35, -0.3, 0.3);
      livePos.set(c.id, { x: pose.x, z: pose.z });
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
        [0, -0.45 * BS],
        [1, 0.5 * BS],
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
      if (rig?.root) poseRider(rig, pose, k, ang, fenceAhead);
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
    for (const m of [W, C]) m.instanceMatrix.needsUpdate = true;
  });

  const click = (id: string) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    select(selected === id ? null : id);
  };

  return (
    <group>
      {riders.map((c, i) => (
        <group key={c.id}>
          <mesh ref={(el) => (bikes.current[i] = el)} geometry={geos.bike[i]} material={chibiMaterial()} matrixAutoUpdate={false} castShadow frustumCulled={false} onClick={click(c.id)} />
          <RiderBody parts={geos.rider[i]!} rig={(rigs.current[i] ??= {})} outline={outline} onClick={click(c.id)} />
          <group ref={(el) => (tags.current[i] = el)}>
            {(greet[c.id] ?? 0) > Date.now() || selected === c.id ? <NameTag name={c.name} sub="cyclist" bubble={(greet[c.id] ?? 0) > Date.now() ? c.greeting : undefined} y={2.05} /> : null}
          </group>
        </group>
      ))}
      <instancedMesh ref={wheels} args={[geos.wheel, chibiMaterial(), n * 2]} frustumCulled={false} castShadow />
      <instancedMesh ref={cranks} args={[geos.crank, chibiMaterial(), n]} frustumCulled={false} />
    </group>
  );
}

/** The rider's chibi body as a jointed rig (root matrix is set by the frame loop). */
function RiderBody({ parts, rig, outline, onClick }: { parts: ChibiParts; rig: Partial<RiderRig>; outline: boolean; onClick: (e: { stopPropagation: () => void }) => void }) {
  const mat = chibiMaterial();
  const ol = chibiOutline();
  const part = (g: THREE.BufferGeometry) => (
    <>
      <mesh geometry={g} material={mat} castShadow frustumCulled={false} />
      {outline ? <mesh geometry={g} material={ol} frustumCulled={false} /> : null}
    </>
  );
  const ref = (k: keyof RiderRig) => (g: THREE.Group | null) => void (g && (rig[k] = g));
  return (
    <group ref={ref('root')} matrixAutoUpdate={false} visible={false} onClick={onClick}>
      <group scale={CHIBI_SCALE}>
        <group ref={ref('hips')} position={[...JOINTS.hips]}>
          <group ref={ref('legL')} position={[...JOINTS.legL]}>
            {part(parts.legL)}
          </group>
          <group ref={ref('legR')} position={[...JOINTS.legR]}>
            {part(parts.legR)}
          </group>
          <group ref={ref('torso')}>
            {part(parts.torso)}
            <group ref={ref('armL')} position={[...JOINTS.armL]}>
              {part(parts.armL)}
            </group>
            <group ref={ref('armR')} position={[...JOINTS.armR]}>
              {part(parts.armR)}
            </group>
            <group ref={ref('head')} position={[...JOINTS.head]}>
              {part(parts.head)}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
