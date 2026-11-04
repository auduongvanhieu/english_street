import { useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { HUMAN_MODEL_URL, type Accessory, type Hat, type NpcLook } from './npcLook';

const TARGET_HEIGHT = 1.72;
/** Game animation → clip name in the Quaternius character GLBs (pruned by scripts/build-models.mjs). */
const CLIP: Record<string, string> = { idle: 'Idle', walk: 'Walk', run: 'Run', wave: 'Wave', talk: 'Interact', dance: 'Wave', thumbsup: 'Wave', yes: 'Idle_Neutral', no: 'Idle_Neutral', jump: 'Idle_Neutral' };

/**
 * A Quaternius human (NPC) with per-instance outfit colours and bone-attached accessories.
 * Materials are cloned once per look so recolouring one NPC never changes another.
 */
export function Human({ look, anim }: { look: NpcLook; anim: string }) {
  const { scene, animations } = useGLTF(HUMAN_MODEL_URL(look.model), false, true);
  const model = useMemo(() => prepareHuman(scene, look), [scene, look]);

  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, group);
  const current = useRef<THREE.AnimationAction | null>(null);
  useEffect(() => {
    const next = actions[CLIP[anim] ?? 'Idle'] ?? actions.Idle;
    if (!next || next === current.current) return;
    current.current?.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    current.current = next;
  }, [anim, actions]);

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

/** Clone the loaded GLB scene, scale it to TARGET_HEIGHT, recolour materials and attach accessories (pure three.js). */
export function prepareHuman(scene: THREE.Object3D, look: NpcLook): THREE.Object3D {
  const c = SkeletonUtils.clone(scene);
  c.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(c);
  const h = Math.max(box.max.y - box.min.y, 0.001);
  const s = TARGET_HEIGHT / h;
  c.scale.setScalar(s);
  c.position.y = -box.min.y * s;
  const cloned = new Map<THREE.Material, THREE.Material>();
  c.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false; // skinned bounds are unreliable; avoid popping
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mat) => {
      const color = look.colors[mat.name];
      if (!color) return mat;
      let copy = cloned.get(mat);
      if (!copy) {
        copy = (mat as THREE.MeshStandardMaterial).clone();
        (copy as THREE.MeshStandardMaterial).color.set(color);
        cloned.set(mat, copy);
      }
      return copy;
    });
    m.material = Array.isArray(m.material) ? next : next[0]!;
  });
  c.updateMatrixWorld(true);
  attachAccessories(c, look);
  return c;
}

export function preloadHuman(model: NpcLook['model']) {
  useGLTF.preload(HUMAN_MODEL_URL(model), false, true);
}

// ---------------------------------------------------------------- accessories (simple primitives on bones)
const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

const tmpScale = new THREE.Vector3();
/** Parent `obj` to a bone, compensating the bone's world scale so the primitives keep their metre-ish size. */
function attach(bone: THREE.Object3D, obj: THREE.Object3D, debug?: string) {
  bone.getWorldScale(tmpScale);
  obj.scale.setScalar(1 / Math.max(tmpScale.x, 1e-6));
  if (debug) obj.name = debug;
  bone.add(obj);
}

function attachAccessories(root: THREE.Object3D, look: NpcLook) {
  const head = root.getObjectByName('Head');
  const neck = root.getObjectByName('Neck') ?? head;
  const chest = root.getObjectByName('Chest') ?? root.getObjectByName('Spine') ?? neck;
  if (look.hat && head) attach(head, makeHat(look.hat, look.hatColor ?? '#333'), 'hat');
  for (const a of look.accessories ?? []) {
    const obj = makeAccessory(a);
    if (!obj) continue;
    if (a === 'stethoscope' && neck) attach(neck, obj, a);
    else if (a === 'bowtie' && neck) attach(neck, obj, a);
    else if (a === 'badge' && chest) attach(chest, obj, a);
    else if (a === 'apron' && chest) attach(chest, obj, a);
    else if ((a === 'glasses' || a === 'sunglasses') && head) attach(head, obj, a);
    else if (a === 'backpack' && chest) attach(chest, obj, a);
  }
}

/** Bone space of these rigs: +Y up the bone, +Z forward (the model faces +Z). Units are model units (~1.86 m tall). */
function makeHat(kind: Hat, color: string): THREE.Object3D {
  const g = new THREE.Group();
  const m = mat(color);
  if (kind === 'cap') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m);
    crown.position.y = 0.16;
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), m);
    peak.position.set(0, 0.16, 0.17);
    g.add(crown, peak);
  } else if (kind === 'brim') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.09, 16), m);
    crown.position.y = 0.2;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.015, 20), m);
    brim.position.y = 0.16;
    g.add(crown, brim);
  } else if (kind === 'beanie') {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), m);
    crown.scale.y = 1.15;
    crown.position.y = 0.13;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 16), m);
    band.position.y = 0.14;
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat('#f4f4f4'));
    pom.position.y = 0.31;
    g.add(crown, band, pom);
  } else if (kind === 'tophat') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 16), m);
    crown.position.y = 0.3;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.035, 16), mat('#1a1a1a'));
    band.position.y = 0.21;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 20), m);
    brim.position.y = 0.19;
    g.add(crown, band, brim);
  } else if (kind === 'crown') {
    const gold = new THREE.MeshStandardMaterial({ color: '#f2c41d', metalness: 0.6, roughness: 0.35 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 14, 1, true), gold);
    ring.position.y = 0.24;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4), gold);
      spike.position.set(Math.sin(a) * 0.115, 0.3, Math.cos(a) * 0.115);
      g.add(spike);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), mat(color));
    gem.position.set(0, 0.24, 0.125);
    g.add(gem);
  } else {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 12), m);
    hat.position.y = 0.24;
    g.add(hat);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** Eye height / face depth in head-bone space (tuned on the Quaternius heads). */
const GLASSES_Y = 0.1;
const GLASSES_Z = 0.15;

function makeAccessory(kind: Accessory): THREE.Object3D | null {
  const g = new THREE.Group();
  if (kind === 'stethoscope') {
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 24, Math.PI * 1.3), mat('#2b2b2b'));
    tube.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI / 2 - 0.65);
    tube.position.set(0, -0.02, 0.06);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16), mat('#c8c8c8'));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0.09, -0.3, 0.12);
    g.add(tube, disc);
  } else if (kind === 'bowtie') {
    const m = mat('#b3122e');
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.02), m);
    const r = l.clone();
    l.position.set(-0.04, 0.01, 0.11);
    r.position.set(0.04, 0.01, 0.11);
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.022), m);
    knot.position.set(0, 0.01, 0.112);
    g.add(l, r, knot);
  } else if (kind === 'badge') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.01), mat('#ffffff'));
    b.position.set(-0.08, 0.1, 0.16);
    g.add(b);
  } else if (kind === 'glasses' || kind === 'sunglasses') {
    const sun = kind === 'sunglasses';
    const frame = mat(sun ? '#111111' : '#2b2b2b');
    const lensMat = sun ? new THREE.MeshStandardMaterial({ color: '#101820', roughness: 0.2, metalness: 0.4 }) : null;
    for (const x of [-0.05, 0.05]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 6, 16), frame);
      rim.position.set(x, GLASSES_Y, GLASSES_Z);
      g.add(rim);
      if (lensMat) {
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.032, 16), lensMat);
        lens.position.set(x, GLASSES_Y, GLASSES_Z + 0.001);
        g.add(lens);
      }
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.008, 0.008), frame);
    bridge.position.set(0, GLASSES_Y + 0.006, GLASSES_Z);
    g.add(bridge);
    for (const x of [-0.083, 0.083]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.12), frame);
      arm.position.set(x, GLASSES_Y, GLASSES_Z - 0.06);
      g.add(arm);
    }
  } else if (kind === 'backpack') {
    const m = mat('#c8443a');
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.14), m);
    body.position.set(0, -0.08, -0.2);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.05), mat('#a3332b'));
    pocket.position.set(0, -0.16, -0.29);
    g.add(body, pocket);
    for (const x of [-0.09, 0.09]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.02), mat('#3a3a3a'));
      strap.position.set(x, 0.04, 0.15);
      g.add(strap);
    }
  } else if (kind === 'apron') {
    // Hangs from the chest bone down to the knees, slightly in front of the body.
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.015), mat('#3d2b1f'));
    a.position.set(0, -0.42, 0.13);
    g.add(a);
  }
  return g;
}
