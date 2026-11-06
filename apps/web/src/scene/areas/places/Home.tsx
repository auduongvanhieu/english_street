import { useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { insideBuilding } from '../../../world/buildings';
import { AREA, BENCH, FLOWER_BEDS, FRAME, FURNITURE, HOUSE, INNER_H, INNER_WALLS, KENNEL, MID_Z, ROOMS, SHED, TREES, WASHING_LINE } from '../../../world/places/home';
import { localPos } from '../../LocalPlayer';
import { useArea } from '../../../store/area';
import { AreaGroup, Ground, Merged, box, cyl, sphere, tree, type Part } from '../kit';

const WALL_H = 3.0;
const H = HOUSE;
const W = H.x1 - H.x0;
const D = H.z1 - H.z0;
const CX = (H.x0 + H.x1) / 2;
const CZ = (H.z0 + H.z1) / 2;
const lo = (r = 1) => [8, 6].map((n) => Math.max(4, Math.round(n * r))) as [number, number];
const ball = (p: Part, r: number, color: string, at: [number, number, number], s?: [number, number, number]) => p.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, ...lo()), color, { p: at, s });

/** Is the local player inside the house? (roof and front wall hide, like BuildingShell). */
function useInside() {
  const [inside, setInside] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const [x, z] = FRAME.toLocal(localPos.x, localPos.z);
    const i = insideBuilding(H, x, z + 0.6);
    if (i !== inside) setInside(i);
  });
  return inside;
}

/** Floors, back and side walls, low inner walls with skirting. */
function shell(p: Part) {
  for (const r of ROOMS) p.add(box(r.x1 - r.x0, 0.04, r.z1 - r.z0), r.floor, { p: [(r.x0 + r.x1) / 2, 0.02, (r.z0 + r.z1) / 2] });
  // rugs
  p.add(box(3.2, 0.02, 2.2), '#c96f6f', { p: [-11.5, 0.05, -12.9] });
  p.add(box(2.2, 0.02, 1.4), '#f2c94c', { p: [-10.8, 0.05, -18.4] });
  p.add(box(1.4, 0.02, 0.8), '#7fb8d6', { p: [-1.6, 0.05, -20.3] });
  p.add(box(W, WALL_H, 0.3), H.wall, { p: [CX, WALL_H / 2, H.z0] });
  p.add(box(0.3, WALL_H, D), H.wall, { p: [H.x0, WALL_H / 2, CZ] });
  p.add(box(0.3, WALL_H, D), H.wall, { p: [H.x1, WALL_H / 2, CZ] });
  p.add(box(W, 0.3, 0.32), '#a5583f', { p: [CX, 0.15, H.z0] });
  // back-wall paint per room (a stripe of colour so the rooms read from above)
  for (const r of ROOMS.filter((r) => r.z0 === H.z0)) p.add(box(r.x1 - r.x0 - 0.2, 1.6, 0.04), r.id === 'bathroom' ? '#bfe3ea' : r.id === 'bedroom' ? '#cfe0f5' : '#f6dcc0', { p: [(r.x0 + r.x1) / 2, 1.2, H.z0 + 0.17] });
  for (const w of INNER_WALLS) {
    const sx = w.maxX - w.minX;
    const sz = w.maxZ - w.minZ;
    p.add(box(sx, INNER_H, sz), '#fbf5ea', { p: [(w.minX + w.maxX) / 2, INNER_H / 2, (w.minZ + w.maxZ) / 2] });
    p.add(box(sx + 0.04, 0.08, sz + 0.04), '#c48a5a', { p: [(w.minX + w.maxX) / 2, INNER_H, (w.minZ + w.maxZ) / 2] });
  }
  // windows in the back wall
  for (const x of [-10, 0, 10]) {
    p.add(box(1.8, 1.3, 0.06), '#a8d8f0', { p: [x, 1.7, H.z0 + 0.2] });
    p.add(box(1.95, 0.1, 0.12), '#ffffff', { p: [x, 1.0, H.z0 + 0.2] });
  }
}

/** Front wall with windows and an open door (a kerb while you are inside), the gable roof and the chimney. */
function front(p: Part, inside: boolean) {
  const h = H.doorW / 2;
  const hh = inside ? 0.4 : WALL_H;
  for (const [a, b] of [
    [H.x0, H.doorX - h],
    [H.doorX + h, H.x1],
  ] as const)
    p.add(box(b - a, hh, 0.3), H.wall, { p: [(a + b) / 2, hh / 2, H.z1] });
  if (inside) return;
  p.add(box(W, 0.3, 0.32), '#a5583f', { p: [CX, 0.15, H.z1] });
  p.add(box(H.doorW + 0.2, WALL_H - 2.4, 0.3), H.wall, { p: [H.doorX, 2.4 + (WALL_H - 2.4) / 2, H.z1] });
  // door frame and the door, swung open
  for (const s of [-1, 1]) p.add(box(0.12, 2.4, 0.36), '#ffffff', { p: [H.doorX + s * h, 1.2, H.z1] });
  p.add(box(0.08, 2.3, 1.1), '#2f7d6d', { p: [H.doorX - h + 0.06, 1.15, H.z1 - 0.55] });
  ball(p, 0.05, '#f2c94c', [H.doorX - h + 0.12, 1.1, H.z1 - 0.95]);
  // windows with white frames, sills and shutters
  for (const x of [-11, -5.5, 5.5, 11]) {
    p.add(box(1.8, 1.3, 0.05), '#a8d8f0', { p: [x, 1.65, H.z1 + 0.17] });
    p.panes.push({ p: [x, 1.65, H.z1 + 0.2], w: 1.75, h: 1.25 });
    p.add(box(1.95, 0.08, 0.1), '#ffffff', { p: [x, 2.33, H.z1 + 0.18] });
    p.add(box(0.06, 1.3, 0.08), '#ffffff', { p: [x, 1.65, H.z1 + 0.19] });
    p.add(box(2.1, 0.1, 0.3), '#ffffff', { p: [x, 0.96, H.z1 + 0.25] });
    for (const s of [-1, 1]) p.add(box(0.45, 1.35, 0.06), '#2f7d6d', { p: [x + s * 1.15, 1.65, H.z1 + 0.18] });
    // window box with flowers
    p.add(box(1.6, 0.25, 0.3), '#8b5a2b', { p: [x, 0.8, H.z1 + 0.32] });
    for (let i = 0; i < 4; i++) ball(p, 0.12, ['#e85d75', '#f2c94c', '#ffffff', '#b07ad6'][i]!, [x - 0.6 + i * 0.4, 1.0, H.z1 + 0.32]);
  }
  // porch roof over the door
  p.add(box(H.doorW + 1.4, 0.12, 1.3), '#c4553a', { p: [H.doorX, 2.7, H.z1 + 0.65], r: [0.25, 0, 0] });
  for (const s of [-1, 1]) p.add(cyl(0.06, 0.06, 2.5, 6), '#ffffff', { p: [H.doorX + s * (h + 0.5), 1.25, H.z1 + 1.15] });
  // gable roof: two slopes along x, stepped gable ends, chimney
  const a = 0.52;
  const over = 0.6;
  const run = D / 2 + over;
  const len = run / Math.cos(a);
  const rise = (D / 2) * Math.tan(a);
  for (const s of [-1, 1]) {
    const zc = CZ + s * (run / 2 - over / 2 + over / 2);
    const yc = WALL_H + rise - (run / 2) * Math.tan(a);
    p.add(box(W + 1, 0.22, len), s > 0 ? '#c4553a' : '#b04a33', { p: [CX, yc + 0.1, zc], r: [s * a, 0, 0] });
  }
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const wz = D * (1 - t);
    for (const x of [H.x0, H.x1]) p.add(box(0.3, rise / 6 + 0.01, wz), H.wall, { p: [x, WALL_H + rise * t, CZ] });
  }
  p.add(box(1.0, 2.4, 1.0), '#a5583f', { p: [8, WALL_H + rise, CZ - 2] });
  p.add(box(1.2, 0.2, 1.2), '#7a3b2a', { p: [8, WALL_H + rise + 1.2, CZ - 2] });
}

/** Everything inside: living room, kitchen, bedroom, bathroom, dining room. */
function interior(p: Part) {
  // ---- living room: sofa, coffee table, armchair, TV, bookcase, floor lamp, plant, clock
  p.add(box(3.2, 0.45, 1.0), '#5b8def', { p: [-11.5, 0.3, -14.7] });
  p.add(box(3.2, 0.7, 0.3), '#4a76c9', { p: [-11.5, 0.75, -15.1] });
  for (const s of [-1, 1]) p.add(box(0.3, 0.6, 1.0), '#4a76c9', { p: [-11.5 + s * 1.55, 0.45, -14.7] });
  for (const x of [-12.3, -10.7]) p.add(box(0.6, 0.4, 0.15), '#f2c94c', { p: [x, 0.75, -14.9], r: [-0.2, 0, 0] });
  p.add(box(1.6, 0.08, 0.8), '#8b5a2b', { p: [-11.5, 0.45, -12.6] });
  for (const dx of [-0.7, 0.7]) for (const dz of [-0.32, 0.32]) p.add(box(0.07, 0.42, 0.07), '#6b4226', { p: [-11.5 + dx, 0.21, -12.6 + dz] });
  p.add(cyl(0.18, 0.15, 0.15, 10), '#ffffff', { p: [-11.2, 0.56, -12.6] }); // fruit bowl
  ball(p, 0.08, '#e05f5f', [-11.25, 0.66, -12.6]);
  ball(p, 0.08, '#8bc34a', [-11.1, 0.66, -12.55]);
  // armchair
  p.add(box(1.0, 0.45, 1.0), '#e08a5d', { p: [-7.4, 0.3, -13.9] });
  p.add(box(1.0, 0.7, 0.25), '#c9714a', { p: [-7.4, 0.75, -14.3] });
  for (const s of [-1, 1]) p.add(box(0.2, 0.55, 1.0), '#c9714a', { p: [-7.4 + s * 0.45, 0.45, -13.9] });
  // TV on a stand against the left wall
  p.add(box(0.6, 0.55, 2.0), '#6b4226', { p: [-15.5, 0.28, -12.2] });
  p.add(box(0.08, 0.9, 1.6), '#222222', { p: [-15.6, 1.05, -12.2] });
  p.add(box(0.02, 0.78, 1.45), '#3b6ea8', { p: [-15.54, 1.05, -12.2] });
  // bookcase with books
  p.add(box(1.8, 1.3, 0.45), '#8b5a2b', { p: [-5.2, 0.65, -15.15] });
  for (const y of [0.35, 0.8, 1.2]) for (let i = 0; i < 7; i++) p.add(box(0.16, 0.32, 0.3), ['#e05f5f', '#5b8def', '#f2c94c', '#8bc34a', '#b07ad6'][(i + Math.round(y * 10)) % 5]!, { p: [-5.95 + i * 0.22, y + 0.02, -15.05] });
  // floor lamp
  p.add(cyl(0.2, 0.2, 0.05, 10), '#444', { p: [-14.8, 0.03, -14.9] });
  p.add(cyl(0.03, 0.03, 1.5, 6), '#444', { p: [-14.8, 0.78, -14.9] });
  p.add(cyl(0.18, 0.32, 0.35, 12), '#fbe7a1', { p: [-14.8, 1.6, -14.9] });
  // plant by the door
  p.add(cyl(0.25, 0.18, 0.4, 10), '#c4553a', { p: [3.2, 0.2, -9.7] });
  ball(p, 0.4, '#4f9a44', [3.2, 0.75, -9.7]);
  // clock on the wall above the sofa (tap it: "My day")
  p.add(cyl(0.32, 0.32, 0.06, 16), '#ffffff', { p: [-11.5, 1.8, MID_Z - 0.12], r: [Math.PI / 2, 0, 0] });
  p.add(cyl(0.36, 0.36, 0.04, 16), '#c4553a', { p: [-11.5, 1.8, MID_Z - 0.1], r: [Math.PI / 2, 0, 0] });
  p.add(box(0.03, 0.22, 0.02), '#222', { p: [-11.5, 1.88, MID_Z - 0.17] });
  p.add(box(0.16, 0.03, 0.02), '#222', { p: [-11.43, 1.8, MID_Z - 0.17] });
  // keys on a hook by the door
  p.add(box(0.4, 0.06, 0.06), '#8b5a2b', { p: [-1.6, 1.5, -9.2] });
  p.add(box(0.06, 0.14, 0.02), '#f2c94c', { p: [-1.7, 1.4, -9.25] });
  p.add(box(0.06, 0.14, 0.02), '#c0c0c0', { p: [-1.5, 1.4, -9.25] });

  // ---- kitchen: counter along the right wall, fridge, cooker, sink, cupboards, a little table
  p.add(box(1.0, 2.0, 1.2), '#e8f1f5', { p: [15.35, 1.0, -14.75] });
  p.add(box(0.04, 0.9, 0.06), '#999', { p: [14.83, 1.3, -14.3] });
  p.add(box(0.9, 0.9, 4.6), '#f6efe2', { p: [15.4, 0.45, -11.3] });
  p.add(box(0.95, 0.06, 4.7), '#8b5a2b', { p: [15.4, 0.92, -11.3] });
  p.add(box(0.7, 0.04, 0.9), '#333', { p: [15.4, 0.96, -12.9] }); // hob
  for (const dz of [-0.22, 0.22]) p.add(cyl(0.13, 0.13, 0.02, 12), '#555', { p: [15.35, 0.99, -12.9 + dz] });
  p.add(cyl(0.18, 0.16, 0.2, 12), '#c4553a', { p: [15.35, 1.08, -13.1] }); // pan
  p.add(box(0.6, 0.06, 0.8), '#b9c4ca', { p: [15.4, 0.94, -11.3] }); // sink
  p.add(cyl(0.03, 0.03, 0.35, 6), '#b9c4ca', { p: [15.75, 1.1, -11.3] });
  for (const z of [-12.6, -11.3, -10.0]) p.add(box(0.6, 0.7, 1.15), '#f2c94c', { p: [15.55, 2.1, z] }); // wall cupboards
  for (const z of [-12.9, -11.3, -9.85]) p.add(box(0.02, 0.7, 0.04), '#888', { p: [14.94, 0.45, z] });
  p.add(box(1.6, 0.06, 1.0), '#ffffff', { p: [9, 0.75, -12.7] });
  p.add(cyl(0.06, 0.08, 0.72, 8), '#8b5a2b', { p: [9, 0.37, -12.7] });
  p.add(cyl(0.07, 0.06, 0.12, 10), '#e05f5f', { p: [8.5, 0.84, -12.8] }); // cup
  p.add(cyl(0.12, 0.07, 0.1, 10), '#5b8def', { p: [9.3, 0.83, -12.6] }); // bowl
  for (const x of [8.3, 9.7]) {
    p.add(box(0.45, 0.06, 0.45), '#c48a5a', { p: [x, 0.45, -13.5] });
    p.add(cyl(0.04, 0.04, 0.45, 6), '#8b5a2b', { p: [x, 0.22, -13.5] });
  }

  // ---- bedroom: bed with teddy, bedside table, desk + lamp + chair, wardrobe, ball under the bed
  p.add(box(2.0, 0.4, 2.8), '#8b5a2b', { p: [-13.6, 0.35, -20.6] });
  p.add(box(1.9, 0.18, 2.7), '#ffffff', { p: [-13.6, 0.64, -20.6] });
  p.add(box(1.95, 0.12, 1.8), '#e85d75', { p: [-13.6, 0.76, -20.1] }); // duvet
  p.add(box(1.1, 0.16, 0.45), '#ffffff', { p: [-13.6, 0.8, -21.6] });
  p.add(box(2.0, 1.1, 0.12), '#8b5a2b', { p: [-13.6, 0.75, -22.0] });
  ball(p, 0.14, '#c98a52', [-13.6, 1.0, -21.3]); // teddy
  ball(p, 0.11, '#c98a52', [-13.6, 1.22, -21.3]);
  for (const s of [-1, 1]) ball(p, 0.045, '#c98a52', [-13.6 + s * 0.08, 1.31, -21.3]);
  ball(p, 0.13, '#ffffff', [-12.8, 0.13, -19.6]); // football under the bed
  p.add(box(0.5, 0.55, 0.45), '#c48a5a', { p: [-12.2, 0.28, -21.6] });
  p.add(box(1.9, 0.06, 0.8), '#c48a5a', { p: [-7.2, 0.75, -21.5] });
  for (const dx of [-0.85, 0.85]) p.add(box(0.06, 0.72, 0.7), '#a06a40', { p: [-7.2 + dx, 0.37, -21.5] });
  p.add(cyl(0.1, 0.12, 0.04, 8), '#333', { p: [-6.6, 0.8, -21.6] });
  p.add(cyl(0.02, 0.02, 0.35, 6), '#333', { p: [-6.6, 0.98, -21.6] });
  p.add(cyl(0.08, 0.16, 0.16, 10), '#5b8def', { p: [-6.6, 1.18, -21.6] });
  p.add(box(0.5, 0.04, 0.35), '#f6f1d8', { p: [-7.5, 0.8, -21.4] }); // open book
  p.add(box(0.45, 0.06, 0.45), '#5b8def', { p: [-7.4, 0.45, -20.7] });
  p.add(box(0.45, 0.5, 0.06), '#5b8def', { p: [-7.4, 0.72, -20.5] });
  p.add(cyl(0.04, 0.04, 0.45, 6), '#333', { p: [-7.4, 0.22, -20.7] });
  p.add(box(0.8, 2.1, 1.8), '#b07ad6', { p: [-15.5, 1.05, -16.9] });
  p.add(box(0.02, 1.9, 0.02), '#7a4ca8', { p: [-15.09, 1.05, -16.9] });
  for (const dz of [-0.15, 0.15]) ball(p, 0.04, '#f2c94c', [-15.08, 1.05, -16.9 + dz]);
  // toy box
  p.add(box(0.9, 0.5, 0.6), '#f2c94c', { p: [-9.6, 0.25, -16.0] });
  ball(p, 0.12, '#e05f5f', [-9.8, 0.55, -16.0]);
  p.add(box(0.18, 0.18, 0.18), '#5b8def', { p: [-9.4, 0.58, -16.0] });

  // ---- bathroom: bath, toilet, sink with mirror, towel
  p.add(box(2.6, 0.6, 1.1), '#ffffff', { p: [-1.6, 0.3, -21.35] });
  p.add(box(2.3, 0.05, 0.85), '#8fd3e8', { p: [-1.6, 0.55, -21.35] });
  ball(p, 0.08, '#f2c94c', [-1.0, 0.62, -21.3]); // rubber duck
  p.add(box(0.5, 0.42, 0.6), '#ffffff', { p: [2.9, 0.21, -21.3] });
  p.add(cyl(0.24, 0.2, 0.12, 12), '#ffffff', { p: [2.9, 0.47, -21.25] });
  p.add(box(0.5, 0.55, 0.2), '#ffffff', { p: [2.9, 0.65, -21.75] });
  p.add(box(0.6, 0.1, 0.8), '#ffffff', { p: [3.6, 0.85, -18.6] });
  p.add(cyl(0.08, 0.1, 0.8, 8), '#ffffff', { p: [3.6, 0.4, -18.6] });
  p.add(box(0.04, 0.8, 0.7), '#cfeef8', { p: [3.88, 1.6, -18.6] }); // mirror
  p.add(box(0.05, 0.9, 0.8), '#c0c0c0', { p: [3.9, 1.6, -18.6] });
  p.add(cyl(0.05, 0.04, 0.12, 8), '#5b8def', { p: [3.55, 0.96, -18.2] }); // toothbrush cup
  p.add(box(0.12, 0.05, 0.08), '#f6c0d0', { p: [3.55, 0.92, -19.0] }); // soap
  p.add(box(0.06, 0.9, 0.7), '#5bb8a8', { p: [-3.85, 1.0, -17.4] }); // towel
  // ---- dining room: table, four chairs, sideboard, picture
  p.add(box(2.6, 0.08, 1.4), '#a0622d', { p: [10, 0.75, -19] });
  for (const dx of [-1.15, 1.15]) for (const dz of [-0.6, 0.6]) p.add(box(0.08, 0.72, 0.08), '#7a4a22', { p: [10 + dx, 0.36, -19 + dz] });
  p.add(cyl(0.12, 0.08, 0.25, 10), '#ffffff', { p: [10, 0.9, -19] });
  for (let i = 0; i < 3; i++) ball(p, 0.08, ['#e85d75', '#f2c94c', '#b07ad6'][i]!, [9.93 + i * 0.07, 1.08, -19]);
  for (const x of [9.4, 10.6])
    for (const s of [-1, 1]) {
      p.add(box(0.45, 0.06, 0.45), '#c48a5a', { p: [x, 0.45, -19 + s * 1.05] });
      p.add(box(0.45, 0.55, 0.06), '#a0622d', { p: [x, 0.75, -19 + s * 1.27] });
      for (const dx of [-0.18, 0.18]) p.add(box(0.05, 0.45, 0.05), '#7a4a22', { p: [x + dx, 0.22, -19 + s * 1.05] });
    }
  p.add(box(2.4, 0.8, 0.5), '#8b5a2b', { p: [13.6, 0.4, -21.55] });
  p.add(box(1.4, 0.9, 0.05), '#f6dcc0', { p: [13.6, 1.8, -21.8] });
  p.add(box(1.2, 0.7, 0.03), '#7fb8d6', { p: [13.6, 1.8, -21.76] });
  ball(p, 0.18, '#f2c94c', [13.9, 1.95, -21.73], [1, 1, 0.2]);
}

/** Front garden: path, flower beds, washing line, shed, kennel, bench, hedges, trees, letterbox. */
function garden(p: Part) {
  // hedges round the sides and the back
  for (const s of [-1, 1]) p.add(box(0.8, 1.0, 23.2), '#4f8f3f', { p: [s * 27.6, 0.5, -11.8] });
  p.add(box(56, 1.0, 0.8), '#4f8f3f', { p: [0, 0.5, -23.3] });
  // flower beds with a brick edge
  FLOWER_BEDS.forEach((b, k) => {
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    p.add(box(b.maxX - b.minX, 0.25, b.maxZ - b.minZ), '#b5552f', { p: [cx, 0.12, cz] });
    p.add(box(b.maxX - b.minX - 0.2, 0.06, b.maxZ - b.minZ - 0.2), '#6b4a2e', { p: [cx, 0.26, cz] });
    for (let i = 0; i < 8; i++) {
      const x = b.minX + 0.45 + (i % 4) * 1.15;
      const z = cz + (i < 4 ? -0.4 : 0.4);
      p.add(cyl(0.02, 0.02, 0.4, 4), '#3f7f3a', { p: [x, 0.45, z] });
      ball(p, 0.16, ['#e85d75', '#f2c94c', '#ffffff', '#b07ad6', '#ff8a3d'][(i + k * 2) % 5]!, [x, 0.68, z]);
    }
  });
  // washing line with clothes
  const L = WASHING_LINE;
  for (const x of [L.x0, L.x1]) p.add(cyl(0.06, 0.06, 2.2, 6), '#c0c0c0', { p: [x, 1.1, L.z] });
  p.add(box(L.x1 - L.x0, 0.02, 0.02), '#ffffff', { p: [(L.x0 + L.x1) / 2, 2.1, L.z] });
  const clothes: [number, number, number, string][] = [
    [18.6, 0.8, 0.7, '#5b8def'],
    [19.8, 0.6, 0.9, '#ffffff'],
    [21, 0.9, 0.5, '#e85d75'],
    [22.3, 0.5, 0.6, '#f2c94c'],
    [23.4, 0.9, 0.8, '#8bc34a'],
    [24.6, 0.3, 0.4, '#b07ad6'],
  ];
  for (const [x, w, h, c] of clothes) p.add(box(w, h, 0.04), c, { p: [x, 2.08 - h / 2, L.z] });
  p.add(box(0.8, 0.4, 0.55), '#d9b38c', { p: [19, 0.2, L.z + 1.3] }); // laundry basket
  // shed
  const S = SHED;
  const sx = (S.minX + S.maxX) / 2;
  const sz = (S.minZ + S.maxZ) / 2;
  p.add(box(S.maxX - S.minX, 2.2, S.maxZ - S.minZ), '#8bb8a8', { p: [sx, 1.1, sz] });
  for (const s of [-1, 1]) p.add(box(S.maxX - S.minX + 0.4, 0.12, 2.5), '#7a4a2a', { p: [sx, 2.45, sz + s * 1.05], r: [s * 0.4, 0, 0] });
  p.add(box(1.0, 1.8, 0.05), '#5f8a7a', { p: [sx, 0.9, S.maxZ + 0.03] });
  p.add(box(0.8, 0.6, 0.05), '#a8d8f0', { p: [sx + 1.5, 1.3, S.maxZ + 0.03] });
  // kennel
  const K = KENNEL;
  const kx = (K.minX + K.maxX) / 2;
  const kz = (K.minZ + K.maxZ) / 2;
  p.add(box(1.4, 0.9, 1.2), '#c98a52', { p: [kx, 0.45, kz] });
  for (const s of [-1, 1]) p.add(box(1.6, 0.08, 0.9), '#b5452f', { p: [kx, 1.08, kz + s * 0.33], r: [s * 0.6, 0, 0] });
  p.add(box(0.5, 0.55, 0.05), '#3a2a22', { p: [kx, 0.3, K.maxZ + 0.01] });
  p.add(cyl(0.22, 0.18, 0.1, 12), '#e05f5f', { p: [kx + 1.0, 0.05, K.maxZ + 0.4] });
  // bench
  p.add(box(2.4, 0.1, 0.6), '#a0703c', { p: [(BENCH.minX + BENCH.maxX) / 2, 0.45, -6] });
  p.add(box(2.4, 0.5, 0.08), '#a0703c', { p: [(BENCH.minX + BENCH.maxX) / 2, 0.8, -6.3] });
  for (const dx of [-1, 1]) p.add(box(0.1, 0.45, 0.5), '#555', { p: [(BENCH.minX + BENCH.maxX) / 2 + dx, 0.22, -6] });
  // letterbox by the gate
  p.add(cyl(0.05, 0.05, 1.1, 6), '#555', { p: [2.6, 0.55, -0.8] });
  p.add(box(0.35, 0.3, 0.5), '#e05f5f', { p: [2.6, 1.2, -0.8] });
  // stepping-stone path from the gate to the door
  for (let z = -1; z > H.z1; z -= 1.1) p.add(cyl(0.55, 0.55, 0.05, 10), '#e6dccb', { p: [0, 0.03, z], s: [1.3, 1, 0.8] });
  for (const [x, z, s] of TREES) tree(p, x, z, s);
  // a little vegetable patch behind the shed
  for (let i = 0; i < 4; i++) p.add(box(3, 0.15, 0.4), '#6b4a2e', { p: [-23.2, 0.08, -14 + i * 0.8] });
  for (let i = 0; i < 12; i++) ball(p, 0.13, '#5fae4e', [-24.4 + (i % 3) * 1.2, 0.2, -14 + Math.floor(i / 3) * 0.8]);
}

/** Tap a piece of furniture: open its word card; tap the clock: the "My day" activity. */
function onTap(e: ThreeEvent<MouseEvent>) {
  e.stopPropagation();
  const [x, z] = FRAME.toLocal(e.point.x, e.point.z);
  let best = FURNITURE[0]!;
  let bd = Infinity;
  for (const f of FURNITURE) {
    const d = Math.hypot(Math.max(0, Math.abs(x - f.x) - f.w / 2), Math.max(0, Math.abs(z - f.z) - f.d / 2));
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  if (bd > 1.2) return;
  if (best.item === 'clock') useArea.getState().setPanel(true, 'activity');
  else useArea.getState().openCard({ area: 'home', item: best.item });
}

export default function Home() {
  const inside = useInside();
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#a9d67f" y={0.006} />
      <Ground x0={-1.6} x1={1.6} z0={H.z1} z1={0} color="#cdbf9f" y={0.01} />
      <Merged build={shell} />
      <Merged build={(p) => front(p, inside)} deps={[inside]} />
      <Merged build={interior} onClick={onTap as never} />
      <Merged build={garden} onClick={onTap as never} />
      {inside
        ? ROOMS.map((r) => (
            <Text key={r.id} position={[(r.x0 + r.x1) / 2, 0.06, r.z1 - 0.7]} rotation-x={-Math.PI / 2} fontSize={0.42} color="#7a4a2a" anchorX="center" anchorY="middle" fillOpacity={0.7}>
              {r.label}
            </Text>
          ))
        : null}
    </AreaGroup>
  );
}
