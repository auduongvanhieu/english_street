// Dev-only: render every GLB listed in ?m=a,b,c (from /models/_preview/) in a row with its idle clip, for screenshots.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { prepareHuman } from '../src/scene/Human';
import { NPC_LOOK, HUMAN_MODEL_URL } from '../src/scene/npcLook';

const params = new URLSearchParams(location.search);
const names = (params.get('m') ?? '').split(',').filter(Boolean);
const npcs = (params.get('npcs') ?? '').split(',').filter(Boolean);
const items = names.length ? names.map((n) => ({ name: n, url: `${params.get('dir') ?? '/models/_preview'}/${n}.glb` })) : npcs.map((id) => ({ name: id, url: HUMAN_MODEL_URL(NPC_LOOK[id]!.model), look: NPC_LOOK[id] }));
const clipWanted = params.get('clip') ?? 'idle';
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fd3ff');
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
const spacing = Number(params.get('spacing') ?? 1.4);
const total = (items.length - 1) * spacing;
camera.position.set(total / 2, 1.6, Math.max(4, total * 0.9 + 3));
camera.lookAt(total / 2, 0.9, 0);
scene.add(new THREE.HemisphereLight('#ffffff', '#88aa66', 1.2));
const sun = new THREE.DirectionalLight('#fff', 1.6);
sun.position.set(3, 6, 4);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#6b8f4e' }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const mixers: THREE.AnimationMixer[] = [];
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const TARGET = Number(params.get('h') ?? 1.7);
(window as unknown as { __ready: boolean }).__ready = false;
await Promise.all(
  items.map(
    ({ name: n, url, look }, i) =>
      new Promise<void>((res) => {
        loader.load(url, (g) => {
          let obj: THREE.Object3D;
          let h = 1;
          if (look) {
            obj = prepareHuman(g.scene, look);
            obj.position.x = i * spacing;
          } else {
            obj = SkeletonUtils.clone(g.scene);
            obj.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(obj);
            h = box.max.y - box.min.y;
            const s = TARGET / h;
            obj.scale.setScalar(s);
            obj.position.set(i * spacing, -box.min.y * s, 0);
          }
          scene.add(obj);
          const clip = g.animations.find((c) => c.name.toLowerCase().includes(clipWanted)) ?? g.animations[0];
          if (clip) {
            const m = new THREE.AnimationMixer(obj);
            m.clipAction(clip).play();
            mixers.push(m);
          }
          console.log(n, 'h=', h.toFixed(2), 'clips:', g.animations.map((c) => c.name).join('|'));
          res();
        }, undefined, () => res());
      }),
  ),
);
const clock = new THREE.Clock();
function frame() {
  const dt = clock.getDelta();
  mixers.forEach((m) => m.update(dt));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
setTimeout(() => ((window as unknown as { __ready: boolean }).__ready = true), 800);
// Debug: print bone world positions/axes for the first human so accessory offsets can be tuned.
{
  const first = scene.children.find((o) => o.getObjectByName('Head'));
  if (first) {
    first.updateMatrixWorld(true);
    for (const n of ['Hips', 'Chest', 'Neck', 'Head']) {
      const b = first.getObjectByName(n);
      if (!b) continue;
      const p = new THREE.Vector3(); b.getWorldPosition(p);
      const q = new THREE.Quaternion(); b.getWorldQuaternion(q);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q); const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const sc = new THREE.Vector3(); b.getWorldScale(sc);
      console.log(`bone ${n} pos=${p.toArray().map((v) => v.toFixed(2))} up=${up.toArray().map((v) => v.toFixed(2))} fwd=${fwd.toArray().map((v) => v.toFixed(2))} scale=${sc.x.toFixed(3)}`);
    }
  }
}
