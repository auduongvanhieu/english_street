/**
 * Dev-only audit page (http://localhost:5173/dev/animals.html?view=side|front|back|top): every zoo/farm animal and
 * every critter assembled exactly like the game does (body, head at the head joint, tail at the tail joint, legs at
 * the hips), on a see-through ground at y = 0, so floating parts and bodies sunk into the ground are easy to spot.
 * Not part of the production build (vite builds index.html only).
 */
import * as THREE from 'three';
import { ANIMAL_SCALE, animalParts, type AnimalKind } from '../src/scene/chibi/buildAnimal';
import { COATS, buildCritter } from '../src/scene/chibi/buildCritter';
import { chibiMaterial, chibiOutline } from '../src/scene/chibi/buildChibi';

const ANIMALS: AnimalKind[] = ['lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'panda', 'kangaroo', 'penguin', 'crocodile', 'bear', 'flamingo', 'cow', 'pig', 'sheep', 'goat', 'horse', 'chicken', 'donkey'];
const CRITTERS = ['cat', 'shiba', 'husky', 'duck', 'duckling', 'rabbit', 'kid', 'lamb', 'guineapig'] as const;

const view = new URLSearchParams(location.search).get('view') ?? 'side';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e9eef2');
scene.add(new THREE.HemisphereLight('#ffffff', '#8a9aa0', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 2);
sun.position.set(3, 6, 4);
scene.add(sun);

const mat = chibiMaterial();
const ol = chibiOutline();
const mesh = (g: THREE.BufferGeometry) => {
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, mat), new THREE.Mesh(g, ol));
  return grp;
};
const at = (o: THREE.Object3D, p: readonly number[]) => (o.position.set(p[0]!, p[1]!, p[2]!), o);

const COLS = 7;
const items: { label: string; root: THREE.Group }[] = [];
const add = (label: string, root: THREE.Group, scale: number) => {
  root.scale.setScalar(scale);
  items.push({ label, root });
};

for (const kind of ANIMALS) {
  const p = animalParts(kind);
  const root = new THREE.Group();
  const body = mesh(p.body);
  body.add(at(mesh(p.head), p.headAt), at(mesh(p.tail), p.tailAt));
  root.add(body);
  p.legs.forEach((hip, k) => {
    const g = k < p.frontCount ? p.legF : p.legB;
    if (g) root.add(at(mesh(g), hip));
  });
  add(kind, root, ANIMAL_SCALE[kind] * 0.5);
}
const CSCALE: Record<string, number> = { cat: 1.25, shiba: 1.2, husky: 1.2, duck: 2.0, duckling: 1.1, rabbit: 1.9, kid: 1.7, lamb: 1.7, guineapig: 2.0 };
for (const kind of CRITTERS) {
  const coat = Object.values(COATS)[0]!;
  const p = buildCritter(kind, coat);
  const root = new THREE.Group();
  const body = mesh(p.body);
  body.add(at(mesh(p.head), p.rig.head), at(mesh(p.tail), p.rig.tail));
  root.add(body);
  for (const hip of p.rig.legs) if (p.leg) root.add(at(mesh(p.leg), hip));
  add(kind, root, CSCALE[kind]! * 0.8);
}

// see-through ground at y = 0: whatever is below it shows through tinted
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: '#7fb069', transparent: true, opacity: 0.6, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// one cell per animal: the animal turned for the view, an orthographic camera slightly above ground level
const turn: Record<string, number> = { side: Math.PI / 2, front: 0, back: Math.PI, quarter: Math.PI / 4, rear: (Math.PI * 5) / 4 };
const rows = Math.ceil(items.length / COLS);
const W = innerWidth;
const H = innerHeight;
const cw = Math.floor(W / COLS);
const ch = Math.floor(H / rows);
const half = 0.85;
const cam = new THREE.OrthographicCamera(-half * (cw / ch), half * (cw / ch), half, -half, 0.1, 50);
cam.position.set(0, 1.2, 10);
cam.lookAt(0, 0.62, 0);
renderer.setScissorTest(true);
renderer.setClearColor('#e9eef2');
items.forEach((it, k) => {
  const x = (k % COLS) * cw;
  const y = H - (Math.floor(k / COLS) + 1) * ch;
  it.root.rotation.y = turn[view] ?? turn.side!;
  scene.add(it.root);
  renderer.setViewport(x, y, cw, ch);
  renderer.setScissor(x, y, cw, ch);
  renderer.render(scene, cam);
  scene.remove(it.root);
  const tag = document.createElement('div');
  tag.textContent = it.label;
  Object.assign(tag.style, { position: 'absolute', left: `${x + 6}px`, top: `${H - y - ch + 4}px`, fontWeight: 'bold', color: '#123' });
  document.body.appendChild(tag);
});
(window as unknown as { __done: boolean }).__done = true;
