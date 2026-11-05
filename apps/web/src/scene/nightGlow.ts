import * as THREE from 'three';

/**
 * Shared night-light materials (lanterns, fairy lights, lit windows). NightLights updates them once a frame from
 * sky.lamps, so every user (BuildingShell, the riverside, the trees) fades in at dusk together and costs nothing by day.
 */

let tex: THREE.CanvasTexture | null = null;
/** Soft round glow sprite (white, transparent edges). */
export function glowTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const glowVert = /* glsl */ `
  attribute vec3 color;
  attribute float aSize;
  attribute float aTw;
  uniform float uK;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vA;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float ph = fract(sin(dot(position.xz + position.y, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
    float tw = 1.0 - aTw * 0.5 * (1.0 + sin(uTime * (1.6 + ph * 0.25) + ph * 3.0));
    vA = uK * tw;
    vColor = color;
    gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.1);
    #include <fog_vertex>
  }`;
const glowFrag = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vColor;
  varying float vA;
  #include <fog_pars_fragment>
  void main() {
    float a = texture2D(map, gl_PointCoord).a * vA;
    #ifdef USE_FOG
      a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor = vec4(vColor, a);
  }`;

/** Additive glow sprites with per-point colour, size (m) and twinkle (0 steady … 1 strong). */
export const glowPointsMat = new THREE.ShaderMaterial({
  vertexShader: glowVert,
  fragmentShader: glowFrag,
  fog: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uK: { value: 0 }, uTime: { value: 0 }, uScale: { value: 400 }, map: { value: null } }]),
});

/** Lantern glass and bulbs: grey by day, warm and unlit-bright at night. */
export const bulbMat = new THREE.MeshBasicMaterial({ color: '#9aa0a6', toneMapped: false });
/** Lit windows: warm additive panes laid over the window glass. */
export const windowMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
/** Pools of light on the ground / reflections on the water (glow texture on a flat plane). */
export const poolMat = new THREE.MeshBasicMaterial({ color: '#ffcf70', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
export const reflectMat = new THREE.MeshBasicMaterial({ color: '#ffc768', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });

const OFF = new THREE.Color('#9aa0a6');
const ON = new THREE.Color('#ffe2a0');

/** Called once a frame by NightLights. `k` = sky.lamps (0 day … 1 night), `scale` = drawing-buffer height / 2. */
export function updateNightGlow(k: number, time: number, scale: number) {
  const u = glowPointsMat.uniforms;
  if (!u.map!.value) {
    const t = glowTexture();
    u.map!.value = t;
    poolMat.map = t;
    reflectMat.map = t;
    poolMat.needsUpdate = reflectMat.needsUpdate = true;
  }
  u.uK!.value = k;
  u.uTime!.value = time;
  u.uScale!.value = scale;
  const lit = k > 0.02;
  glowPointsMat.visible = windowMat.visible = poolMat.visible = reflectMat.visible = lit;
  bulbMat.color.copy(OFF).lerp(ON, k);
  windowMat.opacity = k * 0.75;
  poolMat.opacity = k * 0.4;
  // the river shimmers: reflections breathe a little
  reflectMat.opacity = k * (0.5 + 0.1 * Math.sin(time * 1.7));
}

export interface Glow {
  p: [number, number, number];
  c: THREE.ColorRepresentation;
  /** sprite size in metres */
  s: number;
  tw?: number;
}

/** Points geometry for glowPointsMat. */
export function glowGeometry(items: Glow[]) {
  const pos = new Float32Array(items.length * 3);
  const col = new Float32Array(items.length * 3);
  const size = new Float32Array(items.length);
  const tw = new Float32Array(items.length);
  const c = new THREE.Color();
  items.forEach((g, i) => {
    pos.set(g.p, i * 3);
    c.set(g.c);
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = g.s;
    tw[i] = g.tw ?? 0;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aTw', new THREE.BufferAttribute(tw, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Festoon / fairy-light colours: mostly warm white with a few coloured bulbs. */
export const FAIRY = ['#fff0c0', '#fff0c0', '#ffe0a0', '#ff9cc4', '#9cd6ff', '#b8ff9e', '#ffd46b'];
