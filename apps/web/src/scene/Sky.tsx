import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { serverNow } from '../net/client';
import { useWorld } from '../store/world';
import { sky, updateSky } from '../world/sky';
import { TILE } from '../world/layout';
import { LAMP_ARM, LAMP_H, LAMP_POST_Z, LAMP_ROADS } from '../world/layout';
import { Part, box, chibiMaterial } from './chibi/buildChibi';
import { cloudTexture } from './Horizon';
import { localPos } from './LocalPlayer';
import { ambientBirds } from '../audio/ambient';

/**
 * Sky, day / night and weather (world/sky.ts): a sky dome with sun, moon and stars, clouds whose number and
 * colour follow the real cloud cover, rain and lightning, and street lamps that light up at dusk.
 */
export function SkyController({ low }: { low: boolean }) {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  useEffect(() => {
    scene.fog = new THREE.Fog(sky.horizon.clone(), sky.fogNear, sky.fogFar);
    scene.background = sky.horizon.clone();
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);
  useFrame((_, dt) => {
    updateSky(serverNow(), useWorld.getState().cfg?.now ?? null, Math.min(dt, 0.5));
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.color.copy(sky.horizon);
      fog.near = sky.fogNear;
      fog.far = sky.fogFar;
    }
    if (scene.background instanceof THREE.Color) scene.background.copy(sky.horizon);
    const h = hemi.current;
    if (h) {
      h.color.copy(sky.hemiSky);
      h.groundColor.copy(sky.hemiGround);
      h.intensity = sky.hemiIntensity * (low ? 1.4 : 1);
    }
    ambientBirds.on = sky.day > 0.5 && sky.rain < 0.2;
  });
  return <hemisphereLight ref={hemi} args={['#dff3ff', '#6b8f4e', 0.6]} />;
}

/* ------------------------------------------------------------------------------------------- dome */

const domeVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const domeFrag = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunGlow;
  uniform float uSunVis;
  uniform vec3 uMoonDir;
  uniform float uMoonVis;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));
    // sun: wide glow + disc
    float cs = dot(d, uSunDir);
    col += uSunGlow * (pow(max(cs, 0.0), 24.0) * 0.35 + pow(max(cs, 0.0), 300.0) * 0.6) * uSunVis;
    col = mix(col, vec3(1.0, 0.98, 0.9), smoothstep(0.99935, 0.9996, cs) * uSunVis * step(-0.02, d.y));
    // stars (twinkling), only above the horizon haze
    if (uStars > 0.01) {
      vec3 p = d * 220.0;
      vec3 cell = floor(p);
      float r = hash(cell);
      float on = step(0.9935, r);
      float dist = length(fract(p) - 0.5);
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 4.0) + r * 60.0);
      col += vec3(0.9, 0.93, 1.0) * on * smoothstep(0.32, 0.0, dist) * tw * uStars * smoothstep(0.05, 0.3, d.y);
    }
    // moon with its phase: light the moon ball from the real sun direction
    float cm = dot(d, uMoonDir);
    float R = 0.03;
    if (uMoonVis > 0.01 && cm > cos(R)) {
      vec3 q = (d - uMoonDir * cm) / sin(R);
      float qq = dot(q, q);
      vec3 n = normalize(q + uMoonDir * sqrt(max(0.0, 1.0 - qq)));
      float lit = smoothstep(-0.08, 0.12, dot(n, uSunDir));
      vec3 mc = mix(vec3(0.07, 0.08, 0.11), vec3(0.96, 0.94, 0.86), lit);
      float edge = smoothstep(1.0, 0.86, qq);
      col = mix(col, mc + col * 0.25, edge * uMoonVis);
    }
    if (uMoonVis > 0.01) col += vec3(0.6, 0.65, 0.8) * pow(max(cm, 0.0), 400.0) * 0.25 * uMoonVis;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function SkyDome() {
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVert,
        fragmentShader: domeFrag,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uZenith: { value: sky.zenith },
          uHorizon: { value: sky.horizon },
          uSunDir: { value: sky.sunDir },
          uSunGlow: { value: sky.sunGlow },
          uSunVis: { value: 1 },
          uMoonDir: { value: sky.moonDir },
          uMoonVis: { value: 0 },
          uStars: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [],
  );
  useFrame(() => {
    mesh.current?.position.copy(camera.position);
    const u = mat.uniforms;
    u.uSunVis!.value = 1 - sky.overcast * 0.85;
    u.uMoonVis!.value = (1 - sky.day * 0.85) * (1 - sky.overcast * 0.9) * THREE.MathUtils.smoothstep(sky.moonDir.y, -0.02, 0.05);
    u.uStars!.value = sky.stars;
    u.uTime!.value = (serverNow() / 1000) % 3600;
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[140, 32, 16]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------------------------------- clouds */

/** Cloud sprites around the camera; how many and how grey follow the weather. */
export function Clouds({ low }: { low: boolean }) {
  const camera = useThree((s) => s.camera);
  const tex = useMemo(cloudTexture, []);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.95 }), [tex]);
  const MAX = low ? 8 : 20;
  const sprites = useMemo(() => {
    let s = 5;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    return Array.from({ length: MAX }, () => ({ x: r() * 300, y: 30 + r() * 16, z: -100 + r() * 190, w: 26 + r() * 26, speed: 0.4 + r() * 0.5 }));
  }, [MAX]);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(() => {
    const t = serverNow() / 1000;
    const shown = Math.round(sky.cloudCover * MAX);
    mat.color.copy(sky.cloudColor);
    mat.opacity = 0.75 + sky.overcast * 0.25;
    const wind = 1 + sky.windX * 3;
    sprites.forEach((s, i) => {
      const sp = refs.current[i];
      if (!sp) return;
      sp.visible = i < shown;
      if (!sp.visible) return;
      // wrap within ±150 m of the camera so the sky is never empty at the far ends of the street
      const x = s.x + t * s.speed * wind - camera.position.x;
      sp.position.set(camera.position.x + ((((x % 300) + 300) % 300) - 150), s.y - sky.overcast * 6, s.z);
      const k = 1 + sky.overcast * 0.6;
      sp.scale.set(s.w * k, s.w * 0.5 * k, 1);
    });
  });
  return (
    <group>
      {sprites.map((s, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} material={mat} position={[s.x, s.y, s.z]} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------------------------------- rain */

const rainVert = /* glsl */ `
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uWind;
  attribute vec3 aSeed;
  attribute float aEnd;
  varying float vA;
  const vec3 BOX = vec3(40.0, 16.0, 40.0);
  void main() {
    float speed = 15.0 + aSeed.z * 5.0;
    float y = mod(aSeed.y * BOX.y - uTime * speed, BOX.y);
    float x = uCam.x + mod(aSeed.x * BOX.x - uCam.x, BOX.x) - BOX.x * 0.5;
    float z = uCam.z + mod(fract(aSeed.x * 7.31 + aSeed.z * 3.17) * BOX.z - uCam.z, BOX.z) - BOX.z * 0.5;
    vec3 p = vec3(x + uWind * y * 0.25, y, z);
    p += vec3(uWind * 0.18, 0.7, 0.0) * aEnd;
    vA = mix(0.15, 1.0, aEnd);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const rainFrag = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vA;
  void main() { gl_FragColor = vec4(uColor, uOpacity * vA); }`;

export function Rain({ low }: { low: boolean }) {
  const camera = useThree((s) => s.camera);
  const N = low ? 700 : 2200;
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 2 * 3);
    const seed = new Float32Array(N * 2 * 3);
    const end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const s = [Math.random(), Math.random(), Math.random()];
      for (const e of [0, 1]) {
        seed.set(s, (i * 2 + e) * 3);
        end[i * 2 + e] = e;
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: rainVert,
      fragmentShader: rainFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWind: { value: 0 }, uOpacity: { value: 0.5 }, uColor: { value: new THREE.Color('#c7d3e6') } },
    });
    return { geo: g, mat: m };
  }, [N]);
  const lines = useRef<THREE.LineSegments>(null);
  useFrame(() => {
    const l = lines.current;
    if (!l) return;
    l.visible = sky.rain > 0.02;
    if (!l.visible) return;
    geo.setDrawRange(0, Math.ceil(N * Math.min(1, sky.rain)) * 2);
    mat.uniforms.uCam!.value.copy(camera.position);
    mat.uniforms.uTime!.value = (serverNow() / 1000) % 1000;
    mat.uniforms.uWind!.value = -sky.windX;
    mat.uniforms.uOpacity!.value = 0.35 + 0.25 * sky.day;
    (mat.uniforms.uColor!.value as THREE.Color).setRGB(0.55 + 0.25 * sky.day, 0.6 + 0.25 * sky.day, 0.72 + 0.2 * sky.day);
  });
  return <lineSegments ref={lines} geometry={geo} material={mat} frustumCulled={false} renderOrder={5} />;
}

/* ------------------------------------------------------------------------------------------- lamps */

/** Lamp heads: every even column, both kerbs, at the end of the arm over the road (world/layout.ts). */
const LAMP_Y = LAMP_H - 0.14;
const LAMP_Z = LAMP_POST_Z - LAMP_ARM;
/** [x, z of the head, road centre z] for every lamp. */
function lampSpots() {
  const out: [number, number, number][] = [];
  for (const { road, txMax } of LAMP_ROADS) for (let tx = -txMax; tx <= txMax; tx++) if (tx % 2 === 0) for (const s of [-1, 1]) out.push([tx * TILE, road + s * LAMP_Z, road]);
  return out;
}

/** One lamp post at the origin, its arm reaching towards −z (over the road for a post on the +z kerb). */
let postGeo: THREE.BufferGeometry | null = null;
function lampPostGeometry() {
  if (postGeo) return postGeo;
  const p = new Part();
  p.add(box(0.42, 0.36, 0.42), '#5d6573', { p: [0, 0.18, 0] });
  p.add(box(0.18, LAMP_H, 0.18), '#7b8494', { p: [0, LAMP_H / 2, 0] });
  p.add(box(0.22, 0.22, 0.22), '#7b8494', { p: [0, LAMP_H, 0] });
  p.add(box(0.14, 0.14, LAMP_ARM), '#7b8494', { p: [0, LAMP_H, -LAMP_ARM / 2] });
  p.add(box(0.44, 0.18, 0.56), '#4b5260', { p: [0, LAMP_H - 0.02, -LAMP_ARM] });
  postGeo = p.build();
  return postGeo;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bulbs, halos and pools of light under every street lamp; a few real lights near the player on high quality. */
export function StreetLamps({ low }: { low: boolean }) {
  const spots = useMemo(lampSpots, []);
  const tex = useMemo(glowTexture, []);
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffe6a8', toneMapped: false }), []);
  const haloMat = useMemo(() => new THREE.PointsMaterial({ map: tex, color: '#ffd27a', size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }), [tex]);
  const poolMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, color: '#ffcf70', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }), [tex]);
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const posts = useRef<THREE.InstancedMesh>(null);
  const postGeometry = useMemo(lampPostGeometry, []);
  const pools = useRef<THREE.InstancedMesh>(null);
  const haloGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(spots.flatMap(([x, z]) => [x, LAMP_Y - 0.05, z])), 3));
    return g;
  }, [spots]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const none = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    spots.forEach(([x, z, road], i) => {
      const side = Math.sign(z - road);
      posts.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, road + side * LAMP_POST_Z), side > 0 ? none : turn, one));
      bulbs.current?.setMatrixAt(i, m.makeTranslation(x, LAMP_Y, z));
      // the pool sits a little towards the road centre, under the lamp arm
      pools.current?.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.03, road + (z - road) * 0.8), q, new THREE.Vector3(5, 5, 1)));
    });
    for (const im of [bulbs.current, pools.current, posts.current]) {
      if (!im) continue;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
  }, [spots]);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const off = useMemo(() => new THREE.Color('#9aa0a6'), []);
  const on = useMemo(() => new THREE.Color('#ffe6a8'), []);
  useFrame(() => {
    const k = sky.lamps;
    bulbMat.color.copy(off).lerp(on, k);
    haloMat.opacity = k * 0.9;
    poolMat.opacity = k * 0.45;
    if (pools.current) pools.current.visible = k > 0.02;
    // real point lights at the lamps nearest the player
    if (!low) {
      const base = Math.round(localPos.x / (2 * TILE)) * 2 * TILE;
      const road = localPos.z > 30 ? LAMP_ROADS[1]!.road : 0;
      const rz = localPos.z - road;
      const near: [number, number][] = [
        [base, LAMP_Z],
        [base, -LAMP_Z],
        [base + (localPos.x > base ? 8 : -8), Math.sign(rz || 1) * LAMP_Z],
      ];
      lights.current.forEach((l, i) => {
        if (!l) return;
        // just under the lamp head, towards the road, so the post itself is not floodlit
        l.position.set(near[i]![0], LAMP_Y - 0.45, road + near[i]![1] * 0.85);
        l.distance = 12;
        l.intensity = k * 4;
      });
    }
  });
  return (
    <group>
      <instancedMesh ref={posts} args={[postGeometry, chibiMaterial(), spots.length]} castShadow={!low} receiveShadow frustumCulled={false} />
      <instancedMesh ref={bulbs} args={[undefined, bulbMat, spots.length]} frustumCulled={false}>
        <boxGeometry args={[0.32, 0.08, 0.2]} />
      </instancedMesh>
      <points geometry={haloGeo} material={haloMat} frustumCulled={false} />
      <instancedMesh ref={pools} args={[undefined, poolMat, spots.length]} frustumCulled={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
      {!low && [0, 1, 2].map((i) => <pointLight key={i} ref={(el) => (lights.current[i] = el)} color="#ffcf80" intensity={0} distance={9} decay={1.6} />)}
    </group>
  );
}
