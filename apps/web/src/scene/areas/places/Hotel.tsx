import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { insideBuilding } from '../../../world/buildings';
import { AREA, COFFEE_TABLE, DESK, FLAG, FLOORS, FLOOR_H, FRAME, LIFT_X, LOBBY, LOUNGERS, POOL, RECEPTIONIST, SOFAS, TROLLEY } from '../../../world/places/hotel';
import { useArea } from '../../../store/area';
import { localPos } from '../../LocalPlayer';
import { BuildingShell } from '../Building';
import { AreaGroup, Ground, Merged, Sign, box, cyl, sphere, tree, type Part } from '../kit';

const WALL_H = 3.2;
const TOP = WALL_H + FLOORS * FLOOR_H;
const GOLD = '#c0a062';
const openDesk = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  useArea.getState().setPanel(true, 'activity');
};

/** Is the local player inside the lobby? (the upper floors hide too, so the camera can look in) */
function useInLobby() {
  const [inside, setInside] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const [x, z] = FRAME.toLocal(localPos.x, localPos.z);
    const i = insideBuilding(LOBBY, x, z + 0.6);
    if (i !== inside) setInside(i);
  });
  return inside;
}

/** Two upper floors with windows and balconies facing the river, a roof terrace and the big name sign. */
function UpperFloors() {
  const b = LOBBY;
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  return (
    <group>
      <Merged
        build={(p) => {
          for (let f = 0; f < FLOORS; f++) {
            const y0 = WALL_H + 0.35 + f * FLOOR_H;
            p.add(box(w, FLOOR_H, d), f % 2 ? '#fbf3e4' : '#f7ead2', { p: [cx, y0 + FLOOR_H / 2, cz] });
            p.add(box(w + 0.1, 0.14, d + 0.1), GOLD, { p: [cx, y0 + FLOOR_H - 0.05, cz] });
            for (let x = b.x0 + 2.2; x < b.x1 - 1; x += 3.6) {
              // front: window + door to a balcony with a railing and a flower box
              p.add(box(1.6, 1.5, 0.06), '#a8d8f0', { p: [x, y0 + 1.25, b.z1 + 0.03] });
              p.add(box(1.8, 0.1, 0.1), '#ffffff', { p: [x, y0 + 2.05, b.z1 + 0.06] });
              p.add(box(2.4, 0.12, 0.9), '#e6dccb', { p: [x, y0 + 0.08, b.z1 + 0.45] });
              p.add(box(2.4, 0.05, 0.05), '#ffffff', { p: [x, y0 + 0.95, b.z1 + 0.88] });
              for (const dx of [-1.15, -0.4, 0.4, 1.15]) p.add(box(0.05, 0.85, 0.05), '#ffffff', { p: [x + dx, y0 + 0.55, b.z1 + 0.88] });
              p.add(box(1.4, 0.22, 0.22), '#8a5a3a', { p: [x, y0 + 1.05, b.z1 + 0.98] });
              for (const dx of [-0.5, -0.17, 0.17, 0.5]) p.add(sphere(0.12, 0, Math.PI, 0, Math.PI * 2, 6, 4), ['#ff6f91', '#ffd36b', '#ff9671', '#c34a8e'][Math.abs(Math.round(x + dx * 6)) % 4]!, { p: [x + dx, y0 + 1.22, b.z1 + 0.98] });
              // sides and back: plain windows
              p.add(box(1.4, 1.2, 0.06), '#a8d8f0', { p: [x, y0 + 1.3, b.z0 - 0.03] });
            }
            for (const sx of [b.x0, b.x1]) for (let z = b.z0 + 2; z < b.z1 - 1; z += 3.5) p.add(box(0.06, 1.2, 1.4), '#a8d8f0', { p: [sx + (sx === b.x0 ? -0.03 : 0.03), y0 + 1.3, z] });
          }
          // roof slab, parapet and a terrace with parasols and plants
          p.add(box(w + 0.6, 0.3, d + 0.6), '#b08d4f', { p: [cx, TOP + 0.5, cz] });
          for (const [sx, sz, lx, lz] of [
            [cx, b.z0 - 0.2, w + 0.6, 0.2],
            [cx, b.z1 + 0.2, w + 0.6, 0.2],
            [b.x0 - 0.2, cz, 0.2, d + 0.6],
            [b.x1 + 0.2, cz, 0.2, d + 0.6],
          ] as const)
            p.add(box(lx, 0.7, lz), GOLD, { p: [sx, TOP + 0.95, sz] });
          for (const x of [-12, -5, 6]) {
            p.add(cyl(0.04, 0.04, 2.2, 6), '#777', { p: [x, TOP + 1.75, b.z1 - 2.5] });
            p.add(cyl(0.05, 1.3, 0.45, 12), x === -5 ? '#ffffff' : '#2f80ed', { p: [x, TOP + 2.8, b.z1 - 2.5] });
            p.add(cyl(0.45, 0.45, 0.05, 12), '#ffffff', { p: [x, TOP + 1.4, b.z1 - 2.5] });
            p.add(cyl(0.04, 0.04, 0.7, 6), '#ffffff', { p: [x, TOP + 1.05, b.z1 - 2.5] });
          }
          for (const x of [b.x0 + 1, b.x1 - 1]) {
            p.add(cyl(0.35, 0.28, 0.5, 10), '#b5452f', { p: [x, TOP + 0.9, b.z1 - 1] });
            p.add(sphere(0.5, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#4f9a44', { p: [x, TOP + 1.4, b.z1 - 1] });
          }
          // sign frame on the roof edge
          p.add(box(12, 1.3, 0.2), '#7a2e3a', { p: [cx - 2, TOP + 2.0, b.z1 + 0.1] });
          for (const x of [cx - 7, cx + 3]) p.add(box(0.15, 1.2, 0.15), '#555', { p: [x, TOP + 1.2, b.z1 + 0.05] });
        }}
      />
      <Text position={[cx - 2, TOP + 2.12, b.z1 + 0.22]} fontSize={0.78} color="#f6e7b0" anchorX="center" anchorY="middle">
        RIVERSIDE HOTEL
      </Text>
      <Text position={[cx - 2, TOP + 1.55, b.z1 + 0.22]} fontSize={0.3} color="#f2c94c" anchorX="center" anchorY="middle">
        ★ ★ ★
      </Text>
      <Text position={[-5, TOP + 1.65, b.z1 - 1.3]} fontSize={0.32} color="#2f4f6f" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#ffffff">
        River View Terrace
      </Text>
    </group>
  );
}

/** Reception desk with a bell, the key rack, sofas, a luggage trolley, the lift and plants. */
function Lobby() {
  const dx = (DESK.minX + DESK.maxX) / 2;
  const dz = (DESK.minZ + DESK.maxZ) / 2;
  const back = LOBBY.z0 + 0.2;
  return (
    <group>
      <Merged
        build={(p) => {
          // carpet runner from the door, rug under the sofas
          p.add(box(2.4, 0.02, 7.6), '#8d1c2c', { p: [0, 0.035, -14.8] });
          p.add(box(4.6, 0.02, 4.2), '#2f5d8a', { p: [4.5, 0.035, -14.6] });
          // reception desk: wood front, light top, a gold stripe
          p.add(box(DESK.maxX - DESK.minX, 1.05, DESK.maxZ - DESK.minZ), '#6b3a1a', { p: [dx, 0.52, dz] });
          p.add(box(DESK.maxX - DESK.minX + 0.2, 0.06, DESK.maxZ - DESK.minZ + 0.25), '#f1ece2', { p: [dx, 1.08, dz] });
          p.add(box(DESK.maxX - DESK.minX, 0.08, 0.02), GOLD, { p: [dx, 0.8, DESK.maxZ + 0.01] });
          p.add(box(0.5, 0.35, 0.05), '#222', { p: [dx + 1.6, 1.32, dz - 0.15], r: [-0.15, 0.3, 0] }); // screen
          p.add(box(0.08, 0.2, 0.08), '#444', { p: [dx + 1.6, 1.18, dz - 0.2] });
          p.add(box(0.5, 0.03, 0.35), '#ffffff', { p: [dx - 1.6, 1.12, dz + 0.05] }); // register book
          p.add(cyl(0.035, 0.035, 0.12, 6), '#c0392b', { p: [dx - 0.9, 1.16, dz + 0.1] }); // pen pot
          // key rack: board with rows of hooks and coloured tags
          p.add(box(3.2, 1.5, 0.08), '#8a5a3a', { p: [RECEPTIONIST.x, 1.75, back + 0.05] });
          for (let r = 0; r < 4; r++)
            for (let c = 0; c < 8; c++) {
              const x = RECEPTIONIST.x - 1.35 + c * 0.39;
              const y = 2.3 - r * 0.36;
              p.add(box(0.04, 0.04, 0.08), '#e0c060', { p: [x, y, back + 0.13] });
              if ((r * 3 + c) % 5) p.add(box(0.1, 0.18, 0.02), ['#e05f5f', '#2f80ed', '#43a047', '#f2c94c'][(r + c) % 4]!, { p: [x, y - 0.13, back + 0.16] });
            }
          // clocks above the rack
          for (let i = 0; i < 3; i++) {
            p.add(cyl(0.22, 0.22, 0.05, 16), '#ffffff', { p: [RECEPTIONIST.x - 1 + i, 2.95, back + 0.05], r: [Math.PI / 2, 0, 0] });
            p.add(box(0.02, 0.15, 0.02), '#222', { p: [RECEPTIONIST.x - 1 + i, 2.99, back + 0.09], r: [0, 0, i - 1] });
          }
          // lift: frame, two steel doors, buttons
          p.add(box(2.2, 2.6, 0.1), '#b8aa8a', { p: [LIFT_X, 1.3, back + 0.03] });
          for (const s of [-0.45, 0.45]) p.add(box(0.86, 2.2, 0.06), '#c9cfd6', { p: [LIFT_X + s, 1.1, back + 0.1] });
          p.add(box(0.02, 2.2, 0.07), '#6f7780', { p: [LIFT_X, 1.1, back + 0.11] });
          p.add(box(0.16, 0.36, 0.04), '#333', { p: [LIFT_X + 1.35, 1.2, back + 0.08] });
          for (const y of [1.1, 1.3]) p.add(cyl(0.035, 0.035, 0.03, 8), '#ffd36b', { p: [LIFT_X + 1.35, y, back + 0.1], r: [Math.PI / 2, 0, 0] });
          // sofas facing each other + coffee table
          SOFAS.forEach((s, i) => {
            const x = (s.minX + s.maxX) / 2;
            const z = (s.minZ + s.maxZ) / 2;
            const bz = i === 0 ? s.minZ + 0.1 : s.maxZ - 0.1;
            p.add(box(s.maxX - s.minX, 0.42, s.maxZ - s.minZ), '#2f5d8a', { p: [x, 0.21, z] });
            p.add(box(s.maxX - s.minX, 0.6, 0.2), '#24496d', { p: [x, 0.6, bz] });
            for (const ax of [s.minX + 0.1, s.maxX - 0.1]) p.add(box(0.2, 0.55, s.maxZ - s.minZ), '#24496d', { p: [ax, 0.32, z] });
            for (const cx of [x - 0.7, x + 0.7]) p.add(box(0.5, 0.35, 0.12), '#f2c94c', { p: [cx, 0.62, bz + (i === 0 ? 0.18 : -0.18)], r: [i === 0 ? -0.2 : 0.2, 0, 0] });
          });
          const tx = (COFFEE_TABLE.minX + COFFEE_TABLE.maxX) / 2;
          const tz = (COFFEE_TABLE.minZ + COFFEE_TABLE.maxZ) / 2;
          p.add(box(COFFEE_TABLE.maxX - COFFEE_TABLE.minX, 0.06, COFFEE_TABLE.maxZ - COFFEE_TABLE.minZ), '#6b3a1a', { p: [tx, 0.42, tz] });
          p.add(box(0.12, 0.4, 0.12), '#4a2a12', { p: [tx, 0.2, tz] });
          p.add(cyl(0.08, 0.06, 0.18, 8), '#ffffff', { p: [tx - 0.3, 0.54, tz] });
          for (const c of ['#ff6f91', '#ffd36b']) p.add(sphere(0.07, 0, Math.PI, 0, Math.PI * 2, 6, 4), c, { p: [tx - 0.3 + (c === '#ffd36b' ? 0.06 : -0.04), 0.68, tz] });
          // luggage trolley: base, gold frame, suitcases
          const { x: lx, z: lz } = TROLLEY;
          p.add(box(0.9, 0.06, 0.6), '#b8962e', { p: [lx, 0.2, lz] });
          for (const sx of [-0.42, 0.42]) {
            p.add(cyl(0.025, 0.025, 1.6, 6), '#d4af37', { p: [lx + sx, 1.0, lz] });
            for (const sz of [-0.25, 0.25]) p.add(cyl(0.07, 0.07, 0.05, 8), '#222', { p: [lx + sx, 0.08, lz + sz], r: [0, 0, Math.PI / 2] });
          }
          p.add(cyl(0.025, 0.025, 0.9, 6), '#d4af37', { p: [lx, 1.8, lz], r: [0, 0, Math.PI / 2] });
          p.add(box(0.7, 0.5, 0.35), '#e05f5f', { p: [lx, 0.48, lz] });
          p.add(box(0.5, 0.4, 0.3), '#2f80ed', { p: [lx + 0.05, 0.93, lz] });
          p.add(box(0.35, 0.3, 0.22), '#43a047', { p: [lx - 0.05, 1.28, lz] });
          // plants and a chandelier
          for (const [x, z] of [
            [-16, -21.6],
            [12, -21.6],
            [-2.5, -11.8],
            [2.5, -11.8],
            [-16, -11.8],
          ] as const) {
            p.add(cyl(0.3, 0.22, 0.5, 10), '#c0a062', { p: [x, 0.25, z] });
            p.add(sphere(0.45, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#4f9a44', { p: [x, 0.85, z] });
          }
          p.add(cyl(0.01, 0.01, 0.6, 4), '#333', { p: [0, 2.9, -16.5] });
          p.add(cyl(0.6, 0.3, 0.3, 12), '#e0c060', { p: [0, 2.5, -16.5] });
          for (let i = 0; i < 8; i++) p.add(sphere(0.08, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#fff6c8', { p: [Math.cos(i * 0.785) * 0.55, 2.38, -16.5 + Math.sin(i * 0.785) * 0.55] });
        }}
      />
      {/* the bell on the desk: tap it to open the front desk game */}
      <Merged
        onClick={openDesk}
        build={(p) => {
          p.add(cyl(0.14, 0.16, 0.03, 14), '#4a2a12', { p: [dx, 1.13, dz + 0.1] });
          p.add(sphere(0.12, 0, Math.PI / 2, 0, Math.PI * 2, 12, 6), '#e0c060', { p: [dx, 1.14, dz + 0.1] });
          p.add(cyl(0.015, 0.015, 0.06, 6), '#e0c060', { p: [dx, 1.29, dz + 0.1] });
        }}
      />
      <Text position={[dx, 0.62, DESK.maxZ + 0.03]} fontSize={0.26} color="#e0c060" anchorX="center" anchorY="middle" onClick={openDesk}>
        RECEPTION
      </Text>
      <Text position={[LIFT_X, 2.75, back + 0.12]} fontSize={0.24} color="#4a4a4a" anchorX="center" anchorY="middle">
        LIFT ▲▼
      </Text>
      <Text position={[RECEPTIONIST.x - 1.5, 2.75, back + 0.12]} fontSize={0.12} color="#555" anchorX="center">
        LONDON
      </Text>
      <Text position={[RECEPTIONIST.x - 0.5, 2.75, back + 0.12]} fontSize={0.12} color="#555" anchorX="center">
        HANOI
      </Text>
      <Text position={[RECEPTIONIST.x + 0.5, 2.75, back + 0.12]} fontSize={0.12} color="#555" anchorX="center">
        NEW YORK
      </Text>
      <Text position={[-14.5, 2.2, LOBBY.z0 + 0.3]} fontSize={0.22} color="#4a4a4a" anchorX="center" maxWidth={3.4} textAlign="center" lineHeight={1.3}>
        {'Breakfast 6:30 – 10 am\nCheck-in from 2 pm\nCheck-out until 11 am\nWi-Fi: free'}
      </Text>
    </group>
  );
}

function sunLounger(p: Part, x: number, z: number) {
  p.add(box(0.7, 0.12, 1.6), '#ffffff', { p: [x, 0.35, z + 0.1] });
  p.add(box(0.7, 0.1, 0.7), '#ffffff', { p: [x, 0.6, z - 0.8], r: [0.7, 0, 0] });
  p.add(box(0.62, 0.05, 1.5), '#2f80ed', { p: [x, 0.43, z + 0.12] });
  for (const sz of [-0.5, 0.75]) for (const sx of [-0.3, 0.3]) p.add(box(0.05, 0.3, 0.05), '#ccc', { p: [x + sx, 0.15, z + sz] });
}

/** Pool with loungers and parasols, flower boxes, a flag, trees and hedges. */
function Garden() {
  const pw = POOL.maxX - POOL.minX;
  const pd = POOL.maxZ - POOL.minZ;
  const px = (POOL.minX + POOL.maxX) / 2;
  const pz = (POOL.minZ + POOL.maxZ) / 2;
  return (
    <group>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#a9d38a" y={0.006} />
      {/* paths: gate → door, a terrace round the pool */}
      <Ground x0={-1.6} x1={1.6} z0={LOBBY.z1} z1={0} color="#e3d2b0" y={0.012} />
      <Ground x0={14.8} x1={27.2} z0={-20.5} z1={-3.6} color="#ebe3d2" y={0.012} />
      <Merged
        build={(p) => {
          // pool: tiled rim, water, ladder
          p.add(box(pw + 1, 0.2, pd + 1), '#f4f1ea', { p: [px, 0.1, pz] });
          p.add(box(pw, 0.05, pd), '#3fb3e6', { p: [px, 0.19, pz] });
          for (const k of [0.25, 0.5, 0.75]) p.add(box(0.06, 0.02, pd - 0.6), '#7fd6f5', { p: [POOL.minX + pw * k, 0.22, pz] });
          for (const sx of [-0.3, 0.3]) p.add(cyl(0.035, 0.035, 0.9, 6), '#c9cfd6', { p: [px + sx, 0.55, POOL.maxZ + 0.15] });
          // loungers + parasols
          LOUNGERS.forEach((l, i) => {
            sunLounger(p, l.x, l.z);
            if (i % 2 === 0) {
              const x = l.x + 1.5;
              p.add(cyl(0.04, 0.04, 2.3, 6), '#777', { p: [x, 1.15, l.z - 0.3] });
              p.add(cyl(0.05, 1.3, 0.45, 12), i === 0 ? '#e05f5f' : '#f2c94c', { p: [x, 2.35, l.z - 0.3] });
            }
          });
          // towels on the pool edge
          for (const [x, c] of [[18.5, '#ff6f91'], [23.5, '#f2c94c']] as const) p.add(box(0.8, 0.03, 0.5), c, { p: [x, 0.215, POOL.maxZ + 0.25] });
          // flower boxes along the facade
          for (const x of [-15, -11, -7, -3.8, 3.8, 7, 11]) {
            p.add(box(2.2, 0.45, 0.6), '#8a5a3a', { p: [x, 0.22, LOBBY.z1 + 0.6] });
            for (let k = -2; k <= 2; k++) p.add(sphere(0.17, 0, Math.PI, 0, Math.PI * 2, 6, 4), ['#ff6f91', '#ffd36b', '#ff9671', '#c34a8e', '#ffffff'][(k + 5 + Math.round(x)) % 5]!, { p: [x + k * 0.42, 0.55, LOBBY.z1 + 0.6] });
          }
          // flagpole with a gold flag
          p.add(cyl(0.06, 0.08, 6, 8), '#d0d0d0', { p: [FLAG.x, 3, FLAG.z] });
          p.add(sphere(0.12, 0, Math.PI, 0, Math.PI * 2, 8, 6), GOLD, { p: [FLAG.x, 6.05, FLAG.z] });
          p.add(box(1.6, 1, 0.04), GOLD, { p: [FLAG.x + 0.85, 5.4, FLAG.z] });
          p.add(box(0.5, 0.5, 0.05), '#7a2e3a', { p: [FLAG.x + 0.85, 5.4, FLAG.z] });
          // garden: flower beds, a bench, trees, hedges round the sides and back
          for (const [x, z] of [
            [-25, -20],
            [-25, -13],
            [-20, -21.5],
            [26.5, -22],
            [15, -22],
          ] as const)
            tree(p, x, z, 1.1);
          for (const [x, z] of [
            [-22, -9],
            [-25, -6],
          ] as const) {
            p.add(cyl(1.2, 1.3, 0.3, 14), '#7a5536', { p: [x, 0.15, z] });
            for (let i = 0; i < 7; i++) p.add(sphere(0.2, 0, Math.PI, 0, Math.PI * 2, 6, 4), ['#ff6f91', '#ffd36b', '#c34a8e'][i % 3]!, { p: [x + Math.cos(i * 0.9) * 0.7, 0.4, z + Math.sin(i * 0.9) * 0.7] });
          }
          p.add(box(1.8, 0.08, 0.5), '#a0703c', { p: [-19, 0.45, -1.5] });
          p.add(box(1.8, 0.45, 0.08), '#a0703c', { p: [-19, 0.75, -1.75] });
          for (const sx of [-0.8, 0.8]) p.add(box(0.08, 0.45, 0.45), '#555', { p: [-19 + sx, 0.22, -1.5] });
          for (const sx of [-27.6, 27.6]) p.add(box(0.7, 1, 23.2), '#4f8f3e', { p: [sx, 0.5, -11.8] });
          p.add(box(55.9, 1, 0.7), '#4f8f3e', { p: [0, 0.5, -23.2] });
          // lamp posts by the path
          for (const x of [-2.4, 2.4])
            for (const z of [-3, -8]) {
              p.add(cyl(0.05, 0.07, 2, 6), '#333', { p: [x, 1, z] });
              p.add(sphere(0.18, 0, Math.PI, 0, Math.PI * 2, 8, 6), '#fff6c8', { p: [x, 2.1, z] });
            }
        }}
      />
      <Sign x={21} z={-21.2} text="POOL" sub="Open 7 am – 9 pm" color="#2f80ed" />
      <Sign x={-6} z={-1.6} text="Front desk →" sub="Check-in · Bookings" color="#7a2e3a" rot={0} />
    </group>
  );
}

/** Riverside Hotel: a three-storey hotel with a walk-in lobby, a pool garden and a roof terrace looking at the river. */
export default function Hotel() {
  const inside = useInLobby();
  return (
    <AreaGroup area={AREA}>
      <Garden />
      <BuildingShell b={LOBBY} name="Riverside Hotel" frame={FRAME}>
        <Lobby />
      </BuildingShell>
      {!inside ? <UpperFloors /> : null}
    </AreaGroup>
  );
}
