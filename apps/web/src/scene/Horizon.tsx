import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { END_FENCE_X, MODEL_URL, TILE, streetCross, type TileModel } from '../world/layout';
import { AREAS, GATE_X } from '../world/areas';

/** Inside an area's yard footprint (its own scene draws the ground there). */
const inYard = (x: number, z: number) => z < -4 && z > -33 && AREAS.some((a) => x > a.x0 - 2 && x < a.x1 + 2);
/** South park rows of the farm are its fields. */
const inFarmField = (x: number, z: number) => z > 5 && z < 16 && x > 110 && x < 166;
/** The zoo's petting corner (zooLayout.ts PETTING): plain grass tiles there, no trees. */
const inPetting = (x: number, z: number) => z > 5 && z < 16 && x > 81 && x < 103;
import { serverNow } from '../net/client';
import { sky } from '../world/sky';
import { useSettings } from '../store/settings';

/**
 * Everything beyond the playable street so the horizon is never a flat green plane:
 *  - north: two rows of backdrop houses (instanced Kenney buildings, per-instance tint) with trees between
 *  - south: a river with an animated (cheap, no reflection) water shader, boats and two footbridges (ducks: Critters)
 *  - all around: endless fields (procedural strips + hedges in the ground shader), fences, hay bales, tree clusters
 *  - sky: distance fog matching the sky colour and a few drifting cloud sprites
 * Layout is seeded, so every client sees the same landscape. Low quality drops the animated water, clouds and boats.
 */

/** Must match the fog colour (Scene.tsx) so the fields really fade into the sky. */
export const HORIZON_COLOR = '#d7e8f4';
const STREET_HALF_X = 11 * TILE; // tiles tx -10..10 (+ half a tile)
const STREET_MIN_Z = -3.5 * TILE;
const STREET_MAX_Z = 3.5 * TILE;
/** River along X on the south side. */
const RIVER_NEAR_Z = 4.5 * TILE; // 18
const RIVER_FAR_Z = 9.5 * TILE; // 38
const WATER_Y = -0.3;
const GROUND_Y = -0.25;
const TILE_Y = -0.05 * TILE;
/** Beyond the end fences the riverside road runs on (between fields and the river) to here, lost in the fog. */
const ROAD_END_X = 85 * TILE;
/** Outside the end fences: no houses, just the road, its pavements, the river bank and open fields. */
const outsideFence = (x: number) => Math.abs(x) > END_FENCE_X + 2;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function Horizon() {
  const low = useSettings((s) => s.quality) === 'low';
  return (
    <group>
      <Fields />
      <Backdrop low={low} />
      <River low={low} />
    </group>
  );
}

/* ----------------------------------------------------------------------------------------------- fields */

/** Two big planes (north of the river and south of it) whose shader paints field strips, furrows and hedges. */
function Fields() {
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#78b85f', roughness: 1 });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          // Keep the plain lawn under and right around the street; paint farmland beyond it.
          // Inside the end fences: lawn around the street. Beyond them the lawn is only the river banks of the
          // riverside road (fields start at the field fence north of its pavement).
          float inside = step(abs(vWp.x), ${(END_FENCE_X + 2).toFixed(1)}) * step(${(STREET_MIN_Z - 10).toFixed(1)}, vWp.z);
          float outside = step(${(END_FENCE_X + 2).toFixed(1)}, abs(vWp.x)) * step(${(STREET_MIN_Z + 7.6).toFixed(1)}, vWp.z);
          float nearStreet = max(inside, outside) * step(abs(vWp.x), ${(ROAD_END_X + 40).toFixed(1)}) * step(vWp.z, ${(RIVER_FAR_Z + 8).toFixed(1)});
          float band = mod(floor(vWp.z / 9.0) + floor(vWp.x / 26.0) * 2.0, 3.0);
          vec3 f1 = vec3(0.50, 0.72, 0.35);
          vec3 f2 = vec3(0.70, 0.78, 0.38);
          vec3 f3 = vec3(0.80, 0.70, 0.38);
          vec3 field = band < 0.5 ? f1 : (band < 1.5 ? f2 : f3);
          float furrow = 0.92 + 0.08 * step(0.5, fract(vWp.x / 1.6 + vWp.z * 0.05));
          float edgeZ = smoothstep(0.0, 0.5, abs(fract(vWp.z / 9.0 + 0.5) - 0.5) * 9.0);
          float edgeX = smoothstep(0.0, 0.5, abs(fract(vWp.x / 26.0 + 0.5) - 0.5) * 26.0);
          vec3 hedge = vec3(0.24, 0.42, 0.20);
          vec3 farm = mix(hedge, field * furrow, min(edgeZ, edgeX));
          diffuseColor.rgb = mix(farm, diffuseColor.rgb, nearStreet);
        }`,
      );
    };
    return m;
  }, []);
  const SIZE = 900;
  return (
    <group>
      {/* north plane: from far away up to the river's near bank */}
      <mesh rotation-x={-Math.PI / 2} position={[0, GROUND_Y, (RIVER_NEAR_Z - SIZE) / 2]} material={material} receiveShadow>
        <planeGeometry args={[SIZE, SIZE - RIVER_NEAR_Z]} />
      </mesh>
      {/* south plane: beyond the far bank */}
      <mesh rotation-x={-Math.PI / 2} position={[0, GROUND_Y, (RIVER_FAR_Z + SIZE) / 2]} material={material} receiveShadow>
        <planeGeometry args={[SIZE, SIZE - RIVER_FAR_Z]} />
      </mesh>
      <Fences />
      <HayBales />
    </group>
  );
}

/** Wooden fences along the field edges at both ends of the street and along the far river bank. */
function Fences() {
  const { posts, rails } = useMemo(() => {
    const posts: THREE.Matrix4[] = [];
    const rails: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const line = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.5));
      const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        posts.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GROUND_Y + 0.55, z), q, new THREE.Vector3(1, 1, 1)));
        if (i < n) {
          const mx = x0 + (x1 - x0) * (i + 0.5) / n;
          const mz = z0 + (z1 - z0) * (i + 0.5) / n;
          for (const y of [0.45, 0.85]) rails.push(new THREE.Matrix4().compose(new THREE.Vector3(mx, GROUND_Y + y, mz), along ? q : yaw, new THREE.Vector3(len / n, 1, 1)));
        }
      }
    };
    // both ends of the street (x = ±170), from behind the area yards to the river
    for (const sx of [-1, 1]) line(sx * END_FENCE_X, -32, sx * END_FENCE_X, RIVER_NEAR_Z - 1);
    // the old ends (x = ±46) are gates now: fence only north of the pavement and on the river bank side
    for (const sx of [-1, 1]) {
      line(sx * GATE_X, STREET_MIN_Z - 2, sx * GATE_X, -6.2);
      line(sx * GATE_X, 6.2, sx * GATE_X, RIVER_NEAR_Z - 1);
    }
    // outside the end fences: a field fence along the north pavement of the riverside road
    for (const sx of [-1, 1]) line(sx * (END_FENCE_X + 0.5), STREET_MIN_Z + 7.6, sx * ROAD_END_X, STREET_MIN_Z + 7.6);
    // far bank
    line(-ROAD_END_X, RIVER_FAR_Z + 2, ROAD_END_X, RIVER_FAR_Z + 2);
    return { posts, rails };
  }, []);
  return (
    <group>
      <Instanced matrices={posts} color="#8a6a44">
        <boxGeometry args={[0.18, 1.1, 0.18]} />
      </Instanced>
      <Instanced matrices={rails} color="#a07c50">
        <boxGeometry args={[1, 0.1, 0.08]} />
      </Instanced>
    </group>
  );
}

/** Round hay bales lying in the fields (never near the street or the river). */
function HayBales() {
  const matrices = useMemo(() => {
    const r = rng(23);
    const out: THREE.Matrix4[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 60; i++) {
      const x = (r() - 0.5) * 320;
      const z = (r() - 0.5) * 320;
      if (Math.abs(x) < 39 * TILE + 10 && z > STREET_MIN_Z - 12 && z < RIVER_FAR_Z + 10) continue;
      if (z > RIVER_NEAR_Z - 3 && z < RIVER_FAR_Z + 3) continue;
      if (z > STREET_MIN_Z + 4 && z < RIVER_NEAR_Z) continue; // the riverside road beyond the end fences
      const rot = new THREE.Quaternion().setFromAxisAngle(up, r() * Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
      out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GROUND_Y + 0.7, z), rot, new THREE.Vector3(1, 1, 1)));
    }
    return out;
  }, []);
  return (
    <Instanced matrices={matrices} color="#d9b45a">
      <cylinderGeometry args={[0.7, 0.7, 1.2, 10]} />
    </Instanced>
  );
}

/* ----------------------------------------------------------------------------------------------- backdrop */

/** Per-instance colour *multipliers* (>1 brightens): the Kenney palette is saturated, so plain pastel tints came out dark. */
const TINTS: [number, number, number][] = [
  [1.55, 1.45, 1.3],
  [1.35, 1.5, 1.6],
  [1.6, 1.55, 1.3],
  [1.4, 1.6, 1.4],
  [1.6, 1.35, 1.35],
  [1.5, 1.4, 1.6],
  [1.65, 1.5, 1.25],
  [1.35, 1.6, 1.6],
];
/** Mostly the friendly house variants; the dark grey ones only now and then. */
const HOUSE_WEIGHTS: [TileModel, number][] = [
  ['building-small-a', 3],
  ['building-small-b', 3],
  ['building-small-c', 2],
  ['building-small-d', 0.5],
  ['building-garage', 0.7],
];
function pickHouse(r: () => number): TileModel {
  let t = r() * HOUSE_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  for (const [m, w] of HOUSE_WEIGHTS) if ((t -= w) < 0) return m;
  return 'building-small-a';
}
HOUSE_WEIGHTS.forEach(([m]) => useGLTF.preload(MODEL_URL(m)));
useGLTF.preload(MODEL_URL('grass-trees-tall'));
useGLTF.preload(MODEL_URL('grass'));
(['pavement', 'road-straight', 'grass-trees'] as TileModel[]).forEach((m) => useGLTF.preload(MODEL_URL(m)));

interface Placement {
  model: TileModel;
  x: number;
  z: number;
  rot: number;
  scaleY: number;
  /** Stretch along world z (road / pavements). */
  sz?: number;
  tint?: [number, number, number];
}

/** Houses behind the shops (two staggered rows), a grass bank along the river, tree clusters on the far bank and the ends. */
function backdropPlacements(low: boolean): Placement[] {
  const r = rng(41);
  const out: Placement[] = [];
  // The street continues beyond the end fences with the very same tiles (road, lamp posts, pavements, park
  // rows), so inside and outside the fence look like one street running to the horizon.
  const ext = ROAD_END_X / TILE;
  const push = (p: Placement) => {
    if (inYard(p.x, p.z) || inFarmField(p.x, p.z)) return;
    out.push(inPetting(p.x, p.z) && p.model.startsWith('grass') ? { ...p, model: 'grass' } : p);
  };
  for (let tx = -ext; tx <= ext; tx++) {
    if (outsideFence(tx * TILE)) {
      // the riverside road: pavements, lamp posts every other tile, a grass bank down to the river
      for (const t of streetCross(tx)) push({ model: t.model, x: tx * TILE, z: t.z ?? 0, rot: t.rot ?? 0, scaleY: 1, sz: t.sz });
      push({ model: Math.abs(tx) % 5 === 0 ? 'grass-trees' : 'grass', x: tx * TILE, z: 2 * TILE, rot: 0, scaleY: 1 });
      push({ model: 'grass', x: tx * TILE, z: 3 * TILE, rot: 0, scaleY: 1 });
      push({ model: Math.abs(tx) % 7 === 3 ? 'grass-trees-tall' : 'grass', x: tx * TILE, z: 4 * TILE, rot: 0, scaleY: 1 });
      continue;
    }
    if (Math.abs(tx) > 10) {
      const grassy = (k: number) => (k === 0 ? 'grass-trees-tall' : k === 1 ? 'grass-trees' : 'grass') as TileModel;
      push({ model: grassy(Math.abs(tx) % 3), x: tx * TILE, z: -3 * TILE, rot: 0, scaleY: 1 });
      push({ model: Math.abs(tx) % 2 === 0 ? 'grass-trees' : 'grass', x: tx * TILE, z: -2 * TILE, rot: 0, scaleY: 1 });
      for (const t of streetCross(tx)) push({ model: t.model, x: tx * TILE, z: t.z ?? 0, rot: t.rot ?? 0, scaleY: 1, sz: t.sz });
      push({ model: Math.abs(tx) % 2 === 0 ? 'grass-trees' : 'grass', x: tx * TILE, z: 2 * TILE, rot: 0, scaleY: 1 });
      push({ model: Math.abs(tx) % 3 === 1 ? 'grass-trees-tall' : 'grass', x: tx * TILE, z: 3 * TILE, rot: 0, scaleY: 1 });
    }
    if (low && Math.abs(tx) > 32) continue;
    // row A (tz -6) and row B (tz -9): houses with gardens/trees in between; row B a little taller on average
    for (const [tz, base, spread] of [
      [-6, 0.85, 0.35],
      [-9, 1.0, 0.5],
    ] as const) {
      const house = r() < 0.65;
      if (house) push({ model: pickHouse(r), x: tx * TILE + (r() - 0.5) * 1.2, z: tz * TILE, rot: 0, scaleY: base + r() * spread, tint: TINTS[Math.floor(r() * TINTS.length)] });
      else push({ model: r() < 0.6 ? 'grass-trees-tall' : 'grass', x: tx * TILE, z: tz * TILE, rot: Math.floor(r() * 4) * (Math.PI / 2), scaleY: 1 });
    }
    // gardens between and behind the rows
    for (const tz of [-4, -5, -7, -8, -10]) push({ model: r() < 0.45 ? 'grass-trees-tall' : 'grass', x: tx * TILE, z: tz * TILE, rot: Math.floor(r() * 4) * (Math.PI / 2), scaleY: 1 });
    // river bank row (tz 4): grass with a few trees
    push({ model: r() < 0.3 ? 'grass-trees-tall' : 'grass', x: tx * TILE, z: 4 * TILE, rot: Math.floor(r() * 4) * (Math.PI / 2), scaleY: 1 });
  }
  // far bank and the two ends: scattered tree clusters
  const clusters = low ? 30 : 70;
  for (let i = 0; i < clusters; i++) {
    const x = (r() - 0.5) * (ROAD_END_X * 2 - 40);
    const z = RIVER_FAR_Z + 6 + r() * 70;
    out.push({ model: 'grass-trees-tall', x, z, rot: r() * Math.PI * 2, scaleY: 0.9 + r() * 0.6 });
  }
  return out;
}

function Backdrop({ low }: { low: boolean }) {
  const byModel = useMemo(() => {
    const map = new Map<TileModel, Placement[]>();
    for (const p of backdropPlacements(low)) map.set(p.model, [...(map.get(p.model) ?? []), p]);
    return [...map.entries()];
  }, [low]);
  return (
    <group>
      {byModel.map(([model, placements]) => (
        <InstancedModel key={model} model={model} placements={placements} />
      ))}
    </group>
  );
}

/** One InstancedMesh per mesh inside the GLB (Kenney tiles have exactly one), with optional per-instance tint. */
function InstancedModel({ model, placements }: { model: TileModel; placements: Placement[] }) {
  const { scene } = useGLTF(MODEL_URL(model));
  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const rootInv = scene.matrixWorld.clone().invert();
    const out: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 }[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) out.push({ geometry: m.geometry, material: m.material as THREE.Material, local: rootInv.clone().multiply(m.matrixWorld) });
    });
    return out;
  }, [scene]);
  return (
    <>
      {meshes.map((m, i) => (
        <InstancedPart key={i} {...m} placements={placements} />
      ))}
    </>
  );
}

function InstancedPart({ geometry, material, local, placements }: { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4; placements: Placement[] }) {
  const mesh = useMemo(() => {
    // three only multiplies instanceColor into the fragment when vertexColors is on (a missing colour attribute reads as white),
    // so the GLB material is cloned with that flag rather than shared with the street tiles.
    const mat = material.clone();
    mat.vertexColors = true;
    // …and a missing `color` attribute reads as black (not white) on standard materials, so give the shared geometry one.
    if (!geometry.getAttribute('color')) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
    const im = new THREE.InstancedMesh(geometry, mat, placements.length);
    im.castShadow = false; // outside the shadow camera anyway
    im.receiveShadow = true;
    return im;
  }, [geometry, material, placements.length]);
  useLayoutEffect(() => {
    const tmp = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const white = new THREE.Color('#ffffff');
    placements.forEach((p, i) => {
      const m = new THREE.Matrix4()
        .makeScale(1, 1, p.sz ?? 1)
        .multiply(new THREE.Matrix4().compose(new THREE.Vector3(), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot), new THREE.Vector3(TILE, TILE * p.scaleY, TILE)))
        .setPosition(p.x, TILE_Y, p.z);
      mesh.setMatrixAt(i, tmp.multiplyMatrices(m, local));
      mesh.setColorAt(i, p.tint ? new THREE.Color(p.tint[0], p.tint[1], p.tint[2]) : white);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [mesh, placements, local]);
  return <primitive object={mesh} />;
}

/** Instanced primitive with one flat colour. */
function Instanced({ matrices, color, children }: { matrices: THREE.Matrix4[]; color: string; children: React.ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }, [matrices]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]} receiveShadow frustumCulled={false}>
      {children}
      <meshStandardMaterial color={color} roughness={0.9} />
    </instancedMesh>
  );
}

/* ----------------------------------------------------------------------------------------------- river */

const waterVert = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  uniform float uTime;
  varying vec3 vWp;
  void main() {
    vec3 p = position;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    // gentle long swell so the surface is not a dead-flat plane
    wp.y += sin(wp.x * 0.35 + uTime * 0.8) * 0.04 + sin(wp.z * 0.5 - uTime * 0.6) * 0.03;
    vWp = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const waterFrag = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform float uLight;
  uniform float uSpec;
  varying vec3 vWp;
  void main() {
    // analytic normal from two small ripple waves
    float a1 = vWp.x * 1.7 + vWp.z * 0.9 + uTime * 1.6;
    float a2 = vWp.x * -1.1 + vWp.z * 2.3 - uTime * 1.1;
    float dx = cos(a1) * 1.7 * 0.05 + cos(a2) * -1.1 * 0.04;
    float dz = cos(a1) * 0.9 * 0.05 + cos(a2) * 2.3 * 0.04;
    vec3 n = normalize(vec3(-dx, 1.0, -dz));
    vec3 v = normalize(cameraPosition - vWp);
    float fres = pow(1.0 - max(dot(v, n), 0.0), 3.0);
    vec3 col = mix(uDeep, uShallow, 0.35 + 0.3 * sin(a1 * 0.5) * sin(a2 * 0.5)) * uLight;
    col = mix(col, uSky, fres * 0.7);
    float spec = pow(max(dot(reflect(-normalize(uSun), n), v), 0.0), 90.0);
    col += spec * 0.8 * uSpec;
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }`;

function River({ low }: { low: boolean }) {
  const length = ROAD_END_X * 2 + 260;
  const width = RIVER_FAR_Z - RIVER_NEAR_Z;
  const mid = (RIVER_FAR_Z + RIVER_NEAR_Z) / 2;
  const mat = useMemo(() => {
    if (low) return new THREE.MeshStandardMaterial({ color: '#4f9fd6', roughness: 0.35, metalness: 0.1 });
    return new THREE.ShaderMaterial({
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color('#2f78b8') },
          uShallow: { value: new THREE.Color('#5fb4e0') },
          uSky: { value: new THREE.Color(HORIZON_COLOR) },
          uSun: { value: new THREE.Vector3(30, 40, 20) },
          uLight: { value: 1 },
          uSpec: { value: 1 },
        },
      ]),
    });
  }, [low]);
  const rims = useMemo(() => mergeGeometries([new THREE.BoxGeometry(length, 0.08, 1.4).translate(0, 0, RIVER_NEAR_Z), new THREE.BoxGeometry(length, 0.08, 1.4).translate(0, 0, RIVER_FAR_Z)], false)!, []);
  useFrame(() => {
    if (mat instanceof THREE.ShaderMaterial) {
      const u = mat.uniforms;
      u.uTime!.value = (serverNow() / 1000) % 3600;
      // the water follows the sky: darker at night and under cloud, the sun (or moon) glints on it
      (u.uSky!.value as THREE.Color).copy(sky.horizon);
      (u.uSun!.value as THREE.Vector3).copy(sky.lightDir);
      u.uLight!.value = 0.12 + 0.88 * sky.day * (1 - 0.35 * sky.overcast);
      u.uSpec!.value = Math.min(1, sky.lightIntensity) * (1 - sky.overcast * 0.8);
    }
  });
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, mid]} material={mat}>
        <planeGeometry args={[length, width, low ? 1 : 48, low ? 1 : 12]} />
      </mesh>
      {/* sandy rims on both banks (one merged mesh) */}
      <mesh geometry={rims} position={[0, GROUND_Y - 0.02, 0]} receiveShadow>
        <meshStandardMaterial color="#d8c58f" roughness={1} />
      </mesh>
      <Bridge x={-STREET_HALF_X - 6} />
      <Bridge x={STREET_HALF_X + 6} />
      {!low && (
        <>
          <Boat seed={1} baseX={-30} speed={1.1} sail="#f4f4f4" hull="#b23a3a" />
          <Boat seed={2} baseX={40} speed={-0.8} sail="#ffe08a" hull="#2f5f9e" />
        </>
      )}
    </group>
  );
}

/** Add a flat colour attribute so several primitives can merge into one draw call. */
function colored(g: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function Bridge({ x }: { x: number }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const w = RIVER_FAR_Z - RIVER_NEAR_Z + 4;
    parts.push(colored(new THREE.BoxGeometry(2.4, 0.25, w), '#9c7a52'));
    for (const sx of [-1.1, 1.1]) {
      parts.push(colored(new THREE.BoxGeometry(0.12, 0.08, w).translate(sx, 0.9, 0), '#7a5a38'));
      for (let i = -w / 2 + 1; i < w / 2; i += 2.2) parts.push(colored(new THREE.BoxGeometry(0.12, 0.9, 0.12).translate(sx, 0.45, i), '#7a5a38'));
    }
    return mergeGeometries(parts, false)!;
  }, []);
  return (
    <mesh geometry={geo} position={[x, GROUND_Y + 0.35, (RIVER_FAR_Z + RIVER_NEAR_Z) / 2]}>
      <meshStandardMaterial vertexColors roughness={0.9} />
    </mesh>
  );
}

function Boat({ seed, baseX, speed, sail, hull }: { seed: number; baseX: number; speed: number; sail: string; hull: string }) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(colored(new THREE.BoxGeometry(3.2, 0.7, 1.3), hull));
    parts.push(colored(new THREE.ConeGeometry(0.65, 1.2, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4).translate(0, 0, -2.2).scale(1, 0.55, 1).translate(0, 0, 0), hull)); // bow
    parts.push(colored(new THREE.BoxGeometry(1.2, 0.5, 0.9).translate(-0.4, 0.6, 0), '#e9dcc2')); // cabin
    parts.push(colored(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6).translate(0.6, 1.9, 0), '#5a4631')); // mast
    parts.push(colored(new THREE.PlaneGeometry(1.6, 2.2).translate(0.6 - 0.8, 2.2, 0.02), sail)); // sail
    return mergeGeometries(parts, false)!;
  }, [hull, sail]);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = serverNow() / 1000 + seed * 100;
    const span = 180;
    const x = ((((baseX + t * speed) % span) + span) % span) - span / 2;
    g.position.set(x, WATER_Y + 0.2 + Math.sin(t * 1.3) * 0.05, (RIVER_FAR_Z + RIVER_NEAR_Z) / 2 + Math.sin(t * 0.2 + seed) * 4);
    g.rotation.set(Math.sin(t * 1.1) * 0.03, speed > 0 ? Math.PI : 0, Math.sin(t * 0.9) * 0.04);
  });
  return (
    <group ref={ref}>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------------------------------------- clouds */

export function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const puff = (x: number, y: number, r: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  puff(40, 36, 26);
  puff(64, 28, 30);
  puff(90, 38, 24);
  puff(64, 44, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
