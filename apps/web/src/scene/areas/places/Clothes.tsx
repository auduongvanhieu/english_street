import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { localPos, teleportTo } from '../../LocalPlayer';
import { useFitting } from '../../../store/fitting';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';
import type { Part } from '../../chibi/buildChibi';
import { useArea } from '../../../store/area';
import { useWorld } from '../../../store/world';
import { BENCHES, COUNTER, FITTING, JEANS, MANNEQUINS, MIRROR, RAILS, SHOE_WALL, SHOP, TABLE, WINDOWS, FRAME, AREA } from '../../../world/places/clothes';
import { BuildingShell } from '../Building';
import { AreaGroup, Ground, Merged, box, cyl, sphere, tree } from '../kit';

const SHIRTS = ['#c8443a', '#4a90e2', '#43b86a', '#f3d14a', '#f08a3c', '#8e5bd8', '#f2f2f2', '#ef8fb0', '#2a9d8f', '#8a8f98'];
const DRESSES = ['#ef8fb0', '#8e5bd8', '#f3d14a', '#c8443a', '#2a9d8f', '#4a90e2'];
const JEAN_COLS = ['#4a6488', '#24365c', '#6d8bb5', '#2f3437', '#c2a878'];
const SHOE_COLS = ['#f2f2f2', '#c8443a', '#2f3437', '#6b4a32', '#4a90e2', '#f3d14a', '#43b86a', '#ef8fb0'];
const NO_SALE: string[] = [];

type Click = { stopPropagation: () => void };
const card = (item: string) => (e: Click) => {
  e.stopPropagation();
  useArea.getState().openCard({ area: 'clothes', item });
};
const fittingRoom = (e: Click) => {
  e.stopPropagation();
  useArea.getState().setPanel(true, 'activity');
};

function hanger(p: Part, x: number, z: number, color: string, dress: boolean) {
  p.add(cyl(0.012, 0.012, 0.16, 4), '#9aa5ab', { p: [x, 1.62, z] });
  if (dress) {
    p.add(box(0.07, 0.34, 0.36), color, { p: [x, 1.4, z] });
    p.add(cyl(0.12, 0.34, 0.75, 8), color, { p: [x, 0.88, z], s: [0.35, 1, 1] });
  } else {
    p.add(box(0.07, 0.62, 0.5), color, { p: [x, 1.24, z] });
    for (const s of [-1, 1]) p.add(box(0.06, 0.3, 0.14), color, { p: [x, 1.38, z + s * 0.31], r: [s * 0.5, 0, 0] });
  }
}

/** Rails of shirts and dresses (tap → word card). */
function Rails() {
  return (
    <>
      {RAILS.map((r, ri) => (
        <Merged
          key={ri}
          onClick={card(r.kind === 'dresses' ? 'dress' : ri === 0 ? 't-shirt' : 'hoodie')}
          build={(p) => {
            const cx = (r.x0 + r.x1) / 2;
            p.add(cyl(0.03, 0.03, r.x1 - r.x0 + 0.3, 6), '#c9ccd1', { p: [cx, 1.7, r.z], r: [0, 0, Math.PI / 2] });
            for (const x of [r.x0 - 0.1, r.x1 + 0.1]) {
              p.add(cyl(0.03, 0.03, 1.7, 6), '#c9ccd1', { p: [x, 0.85, r.z] });
              p.add(box(0.08, 0.04, 0.7), '#9aa5ab', { p: [x, 0.02, r.z] });
            }
            const cols = r.kind === 'dresses' ? DRESSES : SHIRTS;
            let i = ri * 3;
            for (let x = r.x0 + 0.2; x <= r.x1 - 0.1; x += 0.24) hanger(p, x, r.z, cols[i++ % cols.length]!, r.kind === 'dresses');
          }}
        />
      ))}
    </>
  );
}

/** Folded jeans on the back shelves, the shoe wall and the display table. */
function Shelves() {
  return (
    <>
      <Merged
        onClick={card('jeans')}
        build={(p) => {
          const w = JEANS.maxX - JEANS.minX;
          const cx = (JEANS.minX + JEANS.maxX) / 2;
          const cz = (JEANS.minZ + JEANS.maxZ) / 2;
          p.add(box(w, 2.2, 0.08), '#e6d3bd', { p: [cx, 1.1, JEANS.minZ + 0.04] });
          for (const y of [0.05, 0.75, 1.45, 2.15]) p.add(box(w, 0.06, 0.8), '#c9a77c', { p: [cx, y, cz] });
          for (const x of [JEANS.minX, JEANS.maxX]) p.add(box(0.06, 2.2, 0.8), '#b48d5f', { p: [x, 1.1, cz] });
          let k = 0;
          for (const y of [0.08, 0.78, 1.48])
            for (let x = JEANS.minX + 0.5; x < JEANS.maxX - 0.3; x += 0.75) {
              const c = JEAN_COLS[k++ % JEAN_COLS.length]!;
              for (let s = 0; s < 3 + (k % 3); s++) p.add(box(0.55, 0.09, 0.45), c, { p: [x, y + 0.08 + s * 0.1, cz + 0.05] });
            }
        }}
      />
      <Merged
        onClick={card('trainers')}
        build={(p) => {
          const w = SHOE_WALL.maxX - SHOE_WALL.minX;
          const cx = (SHOE_WALL.minX + SHOE_WALL.maxX) / 2;
          const cz = (SHOE_WALL.minZ + SHOE_WALL.maxZ) / 2;
          p.add(box(w, 2.4, 0.08), '#f6d5e6', { p: [cx, 1.2, SHOE_WALL.minZ + 0.04] });
          let k = 0;
          for (const y of [0.4, 0.95, 1.5, 2.05]) {
            p.add(box(w, 0.05, 0.5), '#ffffff', { p: [cx, y, cz] });
            for (let x = SHOE_WALL.minX + 0.5; x < SHOE_WALL.maxX - 0.3; x += 0.8) {
              const c = SHOE_COLS[k++ % SHOE_COLS.length]!;
              for (const dx of [-0.11, 0.11]) {
                p.add(box(0.16, 0.12, 0.34), c, { p: [x + dx, y + 0.085, cz + 0.02] });
                p.add(box(0.16, 0.05, 0.36), '#fafafa', { p: [x + dx, y + 0.045, cz + 0.02] });
              }
            }
          }
        }}
      />
      <Merged
        onClick={card('cap')}
        build={(p) => {
          const cx = (TABLE.minX + TABLE.maxX) / 2;
          const cz = (TABLE.minZ + TABLE.maxZ) / 2;
          const w = TABLE.maxX - TABLE.minX;
          const d = TABLE.maxZ - TABLE.minZ;
          p.add(box(w, 0.08, d), '#fff6ee', { p: [cx, 0.86, cz] });
          p.add(box(w - 0.3, 0.8, d - 0.3), '#d16ba5', { p: [cx, 0.42, cz] });
          // folded T-shirts
          SHIRTS.slice(0, 4).forEach((c, i) => {
            for (let s = 0; s < 4; s++) p.add(box(0.5, 0.07, 0.4), c, { p: [TABLE.minX + 0.6 + i * 0.65, 0.94 + s * 0.075, cz - 0.3] });
          });
          // caps, a beanie and a pair of sunglasses
          ['#c8443a', '#4a90e2', '#43b86a'].forEach((c, i) => {
            const x = TABLE.minX + 0.6 + i * 0.7;
            p.add(sphere(0.17, 0, Math.PI / 2, 0, Math.PI * 2, 10, 5), c, { p: [x, 0.9, cz + 0.35] });
            p.add(box(0.22, 0.02, 0.18), c, { p: [x, 0.91, cz + 0.52] });
          });
          p.add(sphere(0.17, 0, Math.PI / 2, 0, Math.PI * 2, 10, 5), '#f3d14a', { p: [TABLE.maxX - 1.6, 0.9, cz + 0.35], s: [1, 1.3, 1] });
          for (const dx of [-0.09, 0.09]) p.add(cyl(0.07, 0.07, 0.02, 10), '#222', { p: [TABLE.maxX - 0.7 + dx, 0.95, cz + 0.4], r: [Math.PI / 2, 0, 0] });
          p.add(box(0.04, 0.02, 0.02), '#222', { p: [TABLE.maxX - 0.7, 0.96, cz + 0.4] });
          // round rug under the table
          p.add(cyl(4.2, 4.2, 0.02, 32), '#f7d6e6', { p: [cx, 0.03, cz] });
        }}
        castShadow={false}
      />
    </>
  );
}

/** Till counter, window mannequins, plants and benches. */
function Furniture() {
  return (
    <Merged
      build={(p) => {
        const cx = (COUNTER.minX + COUNTER.maxX) / 2;
        const cz = (COUNTER.minZ + COUNTER.maxZ) / 2;
        const w = COUNTER.maxX - COUNTER.minX;
        p.add(box(w, 1.0, 1.0), '#d16ba5', { p: [cx, 0.5, cz] });
        p.add(box(w + 0.15, 0.06, 1.15), '#fff6ee', { p: [cx, 1.03, cz] });
        p.add(box(0.5, 0.25, 0.4), '#3b3f45', { p: [COUNTER.minX + 1, 1.18, cz] }); // till
        p.add(box(0.4, 0.3, 0.05), '#22262a', { p: [COUNTER.minX + 1, 1.45, cz - 0.1], r: [-0.3, 0, 0] });
        p.add(box(0.45, 0.32, 0.12), '#f7d6e6', { p: [COUNTER.maxX - 1, 1.22, cz] }); // paper bags
        p.add(box(0.35, 0.3, 0.12), '#fff', { p: [COUNTER.maxX - 1.5, 1.21, cz] });
        // window platforms and mannequins
        for (const b of WINDOWS) p.add(box(b.maxX - b.minX, 0.3, b.maxZ - b.minZ), '#ffffff', { p: [(b.minX + b.maxX) / 2, 0.15, (b.minZ + b.maxZ) / 2] });
        for (const m of MANNEQUINS) {
          const y = 0.3;
          p.add(cyl(0.25, 0.3, 0.05, 12), '#888', { p: [m.x, y + 0.03, m.z] });
          p.add(cyl(0.03, 0.03, 0.5, 6), '#888', { p: [m.x, y + 0.3, m.z] });
          if (m.kind === 'dress') p.add(cyl(0.2, 0.42, 0.9, 12), m.top, { p: [m.x, y + 0.85, m.z] });
          else for (const dx of [-0.1, 0.1]) p.add(cyl(0.08, 0.08, 0.8, 8), m.bottom, { p: [m.x + dx, y + 0.85, m.z] });
          p.add(cyl(0.22, 0.2, 0.6, 12), m.top, { p: [m.x, y + 1.5, m.z], s: [1, 1, 0.7] });
          for (const dx of [-0.27, 0.27]) p.add(cyl(0.06, 0.06, 0.6, 6), m.top, { p: [m.x + dx, y + 1.45, m.z], r: [0, 0, dx > 0 ? 0.15 : -0.15] });
          if (m.kind === 'suit') p.add(box(0.06, 0.35, 0.02), '#c8443a', { p: [m.x, y + 1.55, m.z + 0.15] }); // tie
          p.add(cyl(0.05, 0.05, 0.12, 6), '#e8e1d8', { p: [m.x, y + 1.86, m.z] });
          p.add(sphere(0.15, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#e8e1d8', { p: [m.x, y + 2.03, m.z] });
        }
        // plants inside
        for (const [x, z] of [[-19, -5], [19, -5], [-3.5, -20.3], [11.8, -20.3]] as const) {
          p.add(cyl(0.3, 0.22, 0.5, 10), '#fff', { p: [x, 0.25, z] });
          p.add(sphere(0.45, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#4f9a44', { p: [x, 0.85, z] });
        }
        // a pouf to sit on while friends try things on
        p.add(cyl(0.4, 0.4, 0.45, 14), '#8e5bd8', { p: [10.4, 0.23, -14.6] });
        // outside: benches, trees, planters by the door
        for (const [x, z, r] of BENCHES) {
          p.add(box(0.5, 0.08, 1.7), '#b07a4a', { p: [x, 0.45, z], r: [0, r + Math.PI / 2, 0] });
          p.add(box(0.5, 0.08, 1.7), '#b07a4a', { p: [x + (r > 0 ? -0.25 : 0.25), 0.75, z], r: [0, r + Math.PI / 2, Math.PI / 2] });
          for (const dz of [-0.7, 0.7]) p.add(box(0.4, 0.45, 0.08), '#555', { p: [x, 0.22, z + dz] });
        }
        for (const [x, z] of [[-24, -4], [24, -4], [-24, -20], [24, -20], [-26, -16], [26, -8]] as const) tree(p, x, z, 1.1, '#6dbb5a');
        for (const x of [-3.2, 3.2]) {
          p.add(box(1.2, 0.5, 0.6), '#d16ba5', { p: [x, 0.25, -2.6] });
          for (const dx of [-0.35, 0, 0.35]) p.add(sphere(0.2, 0, Math.PI, 0, Math.PI * 2, 8, 6), ['#ef8fb0', '#f3d14a', '#ffffff'][Math.round(dx * 3 + 1)]!, { p: [x + dx, 0.6, -2.6] });
        }
        // low hedges round the side and back of the yard
        p.add(box(0.6, 0.8, 23.5), '#4f9a44', { p: [-27.7, 0.4, -11.75] });
        p.add(box(0.6, 0.8, 23.5), '#4f9a44', { p: [27.7, 0.4, -11.75] });
        p.add(box(56, 0.8, 0.6), '#4f9a44', { p: [0, 0.4, -23.2] });
      }}
    />
  );
}

/* ------------------------------------------------------------------------------------------ fitting rooms */
const CUBICLES = [
  [FITTING.x0, FITTING.split],
  [FITTING.split, FITTING.x1],
].map(([a, b]) => ({ a: a!, b: b!, cx: (a! + b!) / 2 }));

/**
 * A real mirror (three's Reflector: the scene drawn again from the mirrored camera), only while you stand near it,
 * so the extra render costs nothing elsewhere. Position in the shop's local frame; `rot` turns it about y.
 */
function Mirror({ x, y, z, w, h, rot, near }: { x: number; y: number; z: number; w: number; h: number; rot: number; near: number }) {
  const [on, setOn] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.3) return;
    acc.current = 0;
    const [lx, lz] = FRAME.toLocal(localPos.x, localPos.z);
    const n = Math.hypot(lx - x, lz - z) < near;
    if (n !== on) setOn(n);
  });
  const mirror = useMemo(() => {
    if (!on) return null;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const m = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: Math.round(512 * dpr * (w / h)), textureHeight: Math.round(512 * dpr), color: new THREE.Color('#d9e6ec'), clipBias: 0.003 });
    return m;
  }, [on, w, h]);
  useEffect(() => () => mirror?.dispose(), [mirror]);
  return (
    <group position={[x, y, z]} rotation-y={rot}>
      {mirror ? (
        <primitive object={mirror} />
      ) : (
        <mesh>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial color="#cfe6f2" roughness={0.15} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
}

/** "Try clothes on" at each curtain: step in, face the mirror, the wardrobe card opens (ui/FittingHud.tsx). */
function FittingUsables() {
  const t = useT();
  const room = useFitting((s) => s.room);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.3 || room === null) return;
    acc.current = 0;
    // walked out of the cubicle: done trying
    const [lx, lz] = FRAME.toLocal(localPos.x, localPos.z);
    const c = CUBICLES[room]!;
    if (lx < c.a - 0.3 || lx > c.b + 0.3 || lz < FITTING.z0 - 0.3 || lz > FITTING.z1 + 0.6) useFitting.getState().leave();
  });
  for (const [i, c] of CUBICLES.entries()) {
    const [x, z] = FRAME.toWorld(c.cx, FITTING.z1 + 0.9);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable(
      room === null
        ? {
            id: `fitting-${i}`,
            x,
            z,
            r: 1.4,
            icon: '🪞',
            label: t('Try clothes on'),
            use: () => {
              const [ix, iz] = FRAME.toWorld(c.cx + 0.35, FITTING.z0 + 2.4);
              teleportTo(ix, iz, FRAME.yaw(Math.PI));
              useFitting.getState().enter(i, FRAME.rot);
            },
          }
        : null,
    );
  }
  return null;
}

/** Fitting rooms with curtains and the big mirror: tapping them opens the fitting-room activity. */
function FittingRooms() {
  const h = 2.4;
  const d = FITTING.z1 - FITTING.z0;
  const cz = (FITTING.z0 + FITTING.z1) / 2;
  return (
    <>
      <Merged
        onClick={fittingRoom}
        build={(p) => {
          for (const x of [FITTING.x0, FITTING.split]) p.add(box(0.12, h, d), '#ffffff', { p: [x, h / 2, cz] });
          p.add(box(FITTING.x1 - FITTING.x0, 0.12, 0.12), '#f2c41d', { p: [(FITTING.x0 + FITTING.x1) / 2, h, FITTING.z1] });
          // half-drawn curtains, a stool and a small mirror in each room
          for (const [a, b] of [
            [FITTING.x0, FITTING.split],
            [FITTING.split, FITTING.x1],
          ] as const) {
            const w = b - a;
            for (let i = 0; i < 5; i++) p.add(cyl(0.12, 0.12, h - 0.15, 8), i % 2 ? '#b0508a' : '#c25a98', { p: [a + 0.2 + i * 0.22, (h - 0.15) / 2, FITTING.z1 - 0.05] });
            p.add(cyl(0.25, 0.25, 0.45, 12), '#f7d6e6', { p: [a + w * 0.7, 0.23, FITTING.z0 + 1.2] });
            p.add(box(1.1, 1.95, 0.04), '#f2c41d', { p: [a + w / 2, 1.2, FITTING.z0 + 0.18] }); // mirror frame (glass: Mirror)
          }
          // the big mirror on the right wall
          p.add(box(0.12, 2.5, MIRROR.w + 0.2), '#f2c41d', { p: [MIRROR.x, 1.35, MIRROR.z] });

        }}
      />
      {CUBICLES.map((c, i) => (
        <Mirror key={i} x={c.cx} y={1.2} z={FITTING.z0 + 0.21} w={0.95} h={1.8} rot={0} near={4} />
      ))}
      <Mirror x={MIRROR.x - 0.07} y={1.35} z={MIRROR.z} w={MIRROR.w} h={2.3} rot={-Math.PI / 2} near={7} />
      <FittingUsables />
      <Text position={[(FITTING.x0 + FITTING.x1) / 2, h + 0.35, FITTING.z1 + 0.05]} fontSize={0.32} color="#b0508a" anchorX="center" outlineWidth={0.02} outlineColor="#fff">
        FITTING ROOMS
      </Text>
      <Text position={[MIRROR.x - 0.15, 2.85, MIRROR.z]} rotation-y={-Math.PI / 2} fontSize={0.22} color="#b0508a" anchorX="center" outlineWidth={0.02} outlineColor="#fff">
        🪞 Try it on!
      </Text>
    </>
  );
}

function Signs({ sale }: { sale: boolean }) {
  const label = (x: number, y: number, z: number, text: string, rot = 0, size = 0.3) => (
    <Text key={text} position={[x, y, z]} rotation-y={rot} fontSize={size} color="#b0508a" anchorX="center" outlineWidth={0.02} outlineColor="#ffffff">
      {text}
    </Text>
  );
  return (
    <>
      {label(-14.5, 2.3, -9, 'T-SHIRTS · S M L XL')}
      {label(-14.5, 2.3, -13, 'HOODIES & SHIRTS')}
      {label(-5, 2.3, -17.2, 'DRESSES')}
      {label((JEANS.minX + JEANS.maxX) / 2, 2.55, JEANS.maxZ, 'JEANS & TROUSERS')}
      {label((SHOE_WALL.minX + SHOE_WALL.maxX) / 2, 2.7, SHOE_WALL.maxZ, 'SHOES & TRAINERS')}
      {label(0, 1.25, TABLE.maxZ + 0.02, 'HATS · GLASSES', 0, 0.22)}
      {label((COUNTER.minX + COUNTER.maxX) / 2, 0.6, COUNTER.maxZ + 0.03, 'PAY HERE', 0, 0.36)}
      {sale ? (
        <group position={[5.5, 0, -2.2]} rotation-y={-0.3}>
          <Merged
            build={(p) => {
              for (const s of [-1, 1]) p.add(box(0.9, 1.2, 0.05), '#ffffff', { p: [0, 0.6, s * 0.18], r: [s * 0.25, 0, 0] });
            }}
          />
          <Text position={[0, 0.85, 0.36]} rotation-x={-0.25} fontSize={0.26} color="#d93a4a" anchorX="center">
            SALE
          </Text>
          <Text position={[0, 0.55, 0.43]} rotation-x={-0.25} fontSize={0.14} color="#d93a4a" anchorX="center">
            half price!
          </Text>
        </group>
      ) : null}
    </>
  );
}

/** Style Corner: a bright boutique with rails, shelves, a till and two fitting rooms with a big mirror. */
export default function Clothes() {
  const sale = useWorld((s) => s.cfg?.sale?.clothes ?? NO_SALE);
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#cfe3b0" y={0.006} />
      <Ground x0={-2} x1={2} z0={-4} z1={0} color="#e9d6c4" y={0.012} />
      <BuildingShell b={SHOP} name="Style Corner" frame={FRAME}>
        <Rails />
        <Shelves />
        <FittingRooms />
        <Signs sale={sale.length > 0} />
      </BuildingShell>
      <Furniture />
    </AreaGroup>
  );
}
