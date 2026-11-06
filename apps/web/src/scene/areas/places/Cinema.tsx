import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { serverNow } from '../../../net/client';
import { CARTOON_H, CARTOON_W, drawCartoon } from './cartoon';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { insideBuilding } from '../../../world/buildings';
import { localPos } from '../../LocalPlayer';
import {
  AREA,
  BOOKSHELVES,
  BOX_OFFICE,
  BUILDING,
  FRAME,
  LIB_DESK,
  PARTITION,
  READING_TABLES,
  SCREEN,
  SCREEN_ROOM,
  SEAT_ROWS,
  SEAT_XS,
  SNACK_BAR,
} from '../../../world/places/cinema';
import { FILMS } from '../../../ui/area/activities/cinemaData';
import { openCinema } from '../../../store/cinema';
import { BuildingShell } from '../Building';
import { AreaGroup, Ground, Merged, box, cyl, sphere, tree, type Part } from '../kit';

const WALL_H = 3.2;
const BOOK_COLORS = [
  '#c0392b',
  '#2e86c1',
  '#f1c40f',
  '#27ae60',
  '#8e44ad',
  '#e67e22',
  '#16a085',
  '#d35400',
  '#34495e',
  '#e84393',
];
/** Deterministic pseudo-random 0…1 from a number (same shelves every load). */
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const sr = SCREEN_ROOM;

/** Screen room walls, seats, snack bar, carpet details: the non-clickable part of the cinema. */
function cinemaShell(p: Part) {
  const wall = '#6a4fa3';
  // right wall of the screen room (the front wall is screenFront)
  p.add(box(0.3, WALL_H, sr.z1 - sr.z0), wall, { p: [sr.x1, WALL_H / 2, (sr.z0 + sr.z1) / 2] });
  // dark floor inside the screen room
  p.add(box(sr.x1 - sr.x0 - 0.3, 0.02, sr.z1 - sr.z0 - 0.3), '#241a33', {
    p: [(sr.x0 + sr.x1) / 2, 0.035, (sr.z0 + sr.z1) / 2],
  });
  // screen frame and stage
  const sx = (SCREEN.x0 + SCREEN.x1) / 2;
  p.add(box(SCREEN.x1 - SCREEN.x0 + 0.5, SCREEN.y1 - SCREEN.y0 + 0.4, 0.12), '#111', {
    p: [sx, (SCREEN.y0 + SCREEN.y1) / 2, SCREEN.z - 0.06],
  });
  p.add(box(SCREEN.x1 - SCREEN.x0 + 2, 0.4, 1.0), '#3b2b55', { p: [sx, 0.2, SCREEN.z + 0.4] });
  for (const s of [-1, 1])
    p.add(box(0.9, WALL_H - 0.2, 0.25), '#9c1c2c', {
      p: [sx + s * ((SCREEN.x1 - SCREEN.x0) / 2 + 0.6), (WALL_H - 0.2) / 2, SCREEN.z + 0.1],
    });
  // red seats facing the screen (-z), backs towards +z
  for (const z of SEAT_ROWS)
    for (const x of SEAT_XS) {
      p.add(box(0.8, 0.18, 0.6), '#c62828', { p: [x, 0.42, z] });
      p.add(box(0.8, 0.75, 0.14), '#b71c1c', { p: [x, 0.75, z + 0.3], r: [-0.12, 0, 0] });
      p.add(box(0.08, 0.6, 0.6), '#2b2b2b', { p: [x + 0.43, 0.3, z] });
    }
  // snack bar: counter, popcorn machine, drinks dispenser, cups
  const sb = SNACK_BAR;
  const sbx = (sb.minX + sb.maxX) / 2;
  const sbz = (sb.minZ + sb.maxZ) / 2;
  p.add(box(sb.maxX - sb.minX, 1.0, sb.maxZ - sb.minZ), '#d84343', { p: [sbx, 0.5, sbz] });
  p.add(box(sb.maxX - sb.minX + 0.15, 0.06, sb.maxZ - sb.minZ + 0.15), '#f5f5f5', {
    p: [sbx, 1.03, sbz],
  });
  for (let x = sb.minX + 0.3; x < sb.maxX; x += 0.5)
    p.add(box(0.25, 0.9, 0.02), '#ffffff', { p: [x, 0.5, sb.maxZ + 0.01] }); // stripes
  // popcorn machine (red base, glass box, yellow popcorn)
  p.add(box(0.9, 0.3, 0.6), '#b71c1c', { p: [sb.minX + 0.8, 1.2, sbz] });
  p.add(box(0.9, 0.8, 0.6), '#d9f2ff', { p: [sb.minX + 0.8, 1.75, sbz] });
  p.add(box(0.8, 0.35, 0.5), '#ffe066', { p: [sb.minX + 0.8, 1.55, sbz] });
  p.add(box(0.95, 0.15, 0.65), '#b71c1c', { p: [sb.minX + 0.8, 2.22, sbz] });
  // drinks dispenser and stacks of cups / popcorn boxes
  p.add(box(0.7, 0.9, 0.5), '#455a64', { p: [sb.maxX - 0.7, 1.5, sbz - 0.05] });
  for (const dx of [-0.2, 0, 0.2])
    p.add(cyl(0.05, 0.05, 0.12, 8), ['#e53935', '#fdd835', '#fb8c00'][Math.round(dx * 5 + 1)]!, {
      p: [sb.maxX - 0.7 + dx, 1.62, sbz + 0.27],
    });
  for (let i = 0; i < 3; i++)
    p.add(cyl(0.12, 0.09, 0.28, 10), i % 2 ? '#ffffff' : '#e53935', {
      p: [sbx + 0.3 + i * 0.3, 1.2, sbz],
    });
  // foyer: purple carpet runner, rope barriers in front of the box office, benches in the back lobby
  p.add(box(3, 0.02, 7), '#7b2d8b', { p: [0, 0.032, -7.5] });
  for (const x of [-11.5, -9.5, -7.5]) {
    p.add(cyl(0.06, 0.08, 0.95, 8), '#e5b83b', { p: [x, 0.47, -7.4] });
    p.add(sphere(0.09), '#e5b83b', { p: [x, 0.98, -7.4] });
  }
  for (const x of [-10.5, -8.5])
    p.add(cyl(0.035, 0.035, 2, 6), '#b71c1c', { p: [x, 0.8, -7.4], r: [0, 0, Math.PI / 2] });
  for (const z of [-15.5, -19.5]) {
    p.add(box(0.6, 0.45, 2.4), '#5e35b1', { p: [-3.8, 0.23, z] });
    p.add(box(0.15, 0.5, 2.4), '#4527a0', { p: [-4.15, 0.65, z] });
  }
  // big plants
  for (const [x, z] of [
    [-24, -5],
    [-4.3, -12.3],
    [4, -12.3],
  ] as const) {
    p.add(cyl(0.3, 0.22, 0.55, 10), '#e5b83b', { p: [x, 0.28, z] });
    p.add(sphere(0.5, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#3f8f4a', { p: [x, 0.95, z] });
  }
  // poster frames on the screen-room front wall (titles are Text)
  for (let i = 0; i < POSTERS.length; i++) {
    const f = POSTERS[i]!;
    if (!f.rot) continue; // the ones on the screen room's front wall are in screenFront
    const r: [number, number, number] = [0, f.rot, 0];
    const n = f.rot ? [1, 0] : [0, 1]; // wall normal (x, z)
    p.add(box(1.5, 2.0, 0.06), '#e5b83b', { p: [f.x, 1.85, f.z], r });
    p.add(box(1.36, 1.86, 0.05), FILMS[i]!.color, {
      p: [f.x + n[0]! * 0.02, 1.85, f.z + n[1]! * 0.02],
      r,
    });
  }
}

/** Front wall of the screen room (doorway in the middle); a low kerb while you are in there, so you see the screen. */
function screenFront(p: Part, low: boolean) {
  const hd = sr.doorW / 2;
  const h = low ? 0.4 : WALL_H;
  for (const [x0, x1] of [
    [sr.x0, sr.doorX - hd],
    [sr.doorX + hd, sr.x1],
  ] as const)
    p.add(box(x1 - x0, h, 0.3), '#6a4fa3', { p: [(x0 + x1) / 2, h / 2, sr.z1] });
  if (low) return;
  p.add(box(sr.doorW + 0.3, WALL_H - 2.5, 0.3), '#6a4fa3', {
    p: [sr.doorX, 2.5 + (WALL_H - 2.5) / 2, sr.z1],
  });
  // gold trim along the foyer side and red curtains at the doorway
  p.add(box(sr.x1 - sr.x0, 0.12, 0.34), '#e5b83b', { p: [(sr.x0 + sr.x1) / 2, 2.45, sr.z1] });
  for (const s of [-1, 1])
    p.add(box(0.35, 2.5, 0.2), '#b71c1c', { p: [sr.doorX + s * (hd - 0.1), 1.25, sr.z1 + 0.2] });
  // shelf with snacks behind the snack bar, box office sign board, posters
  const sb = SNACK_BAR;
  p.add(box(sb.maxX - sb.minX, 0.06, 0.4), '#8d6e63', {
    p: [(sb.minX + sb.maxX) / 2, 1.4, sr.z1 + 0.35],
  });
  for (let i = 0; i < 8; i++)
    p.add(box(0.3, 0.38, 0.2), BOOK_COLORS[i % BOOK_COLORS.length]!, {
      p: [sb.minX + 0.4 + i * 0.55, 1.62, sr.z1 + 0.35],
    });
  p.add(box(3.6, 0.6, 0.06), '#e5b83b', {
    p: [(BOX_OFFICE.minX + BOX_OFFICE.maxX) / 2, 2.75, sr.z1 + 0.2],
  });
  POSTERS.forEach((f, i) => {
    if (f.rot) return;
    p.add(box(1.5, 2.0, 0.06), '#e5b83b', { p: [f.x, 1.85, f.z] });
    p.add(box(1.36, 1.86, 0.05), FILMS[i]!.color, { p: [f.x, 1.85, f.z + 0.02] });
  });
}

/** Film posters (one per film): beside the box office and on the screen-room wall in the back lobby. */
const POSTERS = [
  { x: -13.65, z: sr.z1 + 0.18, rot: 0 },
  { x: -6.0, z: sr.z1 + 0.18, rot: 0 },
  { x: sr.x1 + 0.18, z: -15.4, rot: Math.PI / 2 },
  { x: sr.x1 + 0.18, z: -17.6, rot: Math.PI / 2 },
  { x: sr.x1 + 0.18, z: -19.8, rot: Math.PI / 2 },
  { x: sr.x1 + 0.18, z: -21.0, rot: Math.PI / 2 },
].slice(0, 5);

function boxOffice(p: Part) {
  const b = BOX_OFFICE;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  p.add(box(b.maxX - b.minX, 0.86, b.maxZ - b.minZ), '#4a2f86', { p: [cx, 0.43, cz] });
  p.add(box(b.maxX - b.minX + 0.2, 0.07, b.maxZ - b.minZ + 0.25), '#e5b83b', { p: [cx, 0.89, cz] });
  for (const dx of [-1.8, 0, 1.8])
    p.add(box(0.05, 0.9, 0.04), '#e5b83b', { p: [cx + dx, 0.43, b.maxZ + 0.01] });
  // glass screen with a speaking hole, till and a ticket roll
  for (const dx of [-2.6, 2.6])
    p.add(box(0.08, 0.5, 0.08), '#e5b83b', { p: [cx + dx, 1.17, cz - 0.2] });
  p.add(box(b.maxX - b.minX, 0.08, 0.1), '#e5b83b', { p: [cx, 1.44, cz - 0.2] });
  p.add(box(0.45, 0.3, 0.35), '#333', { p: [cx + 1.2, 1.07, cz - 0.05] });
  p.add(cyl(0.12, 0.12, 0.2, 12), '#ffcc80', { p: [cx - 1.4, 1.02, cz], r: [0, 0, Math.PI / 2] });
}

/** Library: wood floor, bookshelves full of books, reading tables with lamps, the librarian's desk. */
function libraryShelves(p: Part) {
  let n = 0;
  for (const s of BOOKSHELVES) {
    const alongX = s.along === 'x';
    const len = alongX ? s.maxX - s.minX : s.maxZ - s.minZ;
    const dep = alongX ? s.maxZ - s.minZ : s.maxX - s.minX;
    const cx = (s.minX + s.maxX) / 2;
    const cz = (s.minZ + s.maxZ) / 2;
    const free = s.minZ > -21 && alongX; // free-standing: books on both faces
    const H = free ? 1.7 : 2.3;
    const bx = (w: number, h: number, d: number) => (alongX ? box(w, h, d) : box(d, h, w));
    p.add(bx(len, H, 0.06), '#7a5536', { p: [cx, H / 2, cz] });
    for (const e of [-1, 1])
      p.add(bx(0.08, H, dep), '#6b4a2e', {
        p: alongX ? [cx + (e * len) / 2, H / 2, cz] : [cx, H / 2, cz + (e * len) / 2],
      });
    const levels = free ? [0.08, 0.6, 1.12] : [0.08, 0.6, 1.12, 1.64];
    for (const y of [...levels, H]) p.add(bx(len, 0.05, dep), '#8d6340', { p: [cx, y, cz] });
    const faces = free ? [-1, 1] : [alongX ? 1 : -1];
    for (const f of faces)
      for (const y of levels)
        for (let t = 0.12; t < len - 0.1; t += 0.16) {
          n++;
          if (rnd(n) < 0.12) continue;
          const h = 0.32 + rnd(n + 0.5) * 0.14;
          const off = f * dep * 0.25;
          const pos: [number, number, number] = alongX
            ? [s.minX + t, y + 0.03 + h / 2, cz + off]
            : [cx + off, y + 0.03 + h / 2, s.minZ + t];
          p.add(
            bx(0.13, h, dep * 0.42),
            BOOK_COLORS[Math.floor(rnd(n + 0.25) * BOOK_COLORS.length)]!,
            { p: pos, r: [0, 0, rnd(n + 0.75) < 0.08 ? 0.25 : 0] },
          );
        }
  }
}

function libraryFurniture(p: Part) {
  // the partition wall (library side wood panelling)
  p.add(box(0.3, WALL_H, PARTITION.z1 - PARTITION.z0), '#d7c4a5', {
    p: [PARTITION.x, WALL_H / 2, (PARTITION.z0 + PARTITION.z1) / 2],
  });
  p.add(box(0.32, 0.8, PARTITION.z1 - PARTITION.z0), '#8d6340', {
    p: [PARTITION.x, 0.4, (PARTITION.z0 + PARTITION.z1) / 2],
  });
  // reading tables, chairs and green lamps
  for (const t of READING_TABLES) {
    p.add(box(2.6, 0.08, 1.2), '#9c6b3f', { p: [t.x, 0.76, t.z] });
    for (const dx of [-1.15, 1.15])
      for (const dz of [-0.5, 0.5])
        p.add(box(0.08, 0.74, 0.08), '#6b4a2e', { p: [t.x + dx, 0.37, t.z + dz] });
    for (const dx of [-0.65, 0.65])
      for (const s of [-1, 1]) {
        const cz = t.z + s * 0.95;
        p.add(box(0.5, 0.06, 0.5), '#7a5536', { p: [t.x + dx, 0.46, cz] });
        p.add(box(0.5, 0.55, 0.06), '#6b4a2e', { p: [t.x + dx, 0.75, cz + s * 0.24] });
        for (const ex of [-0.2, 0.2])
          for (const ez of [-0.2, 0.2])
            p.add(box(0.05, 0.46, 0.05), '#5a3d25', { p: [t.x + dx + ex, 0.23, cz + ez] });
      }
    for (const dx of [-0.7, 0.7]) {
      p.add(cyl(0.02, 0.02, 0.35, 6), '#c9a227', { p: [t.x + dx, 0.97, t.z] });
      p.add(cyl(0.08, 0.2, 0.14, 12, false, 0, Math.PI * 2), '#1e7d4f', {
        p: [t.x + dx, 1.17, t.z],
        r: [0, 0, 0],
      });
      p.add(sphere(0.06), '#fff3b0', { p: [t.x + dx, 1.1, t.z] });
    }
    // open books on the tables
    p.add(box(0.42, 0.03, 0.3), '#fafafa', { p: [t.x - 0.3, 0.815, t.z + 0.25], r: [0, 0.3, 0] });
    p.add(box(0.3, 0.12, 0.22), '#c0392b', { p: [t.x + 0.4, 0.86, t.z - 0.2] });
  }
  // round rug in the reading corner
  p.add(cyl(3.2, 3.2, 0.02, 32), '#b5674a', { p: [17, 0.03, -9] });
  p.add(cyl(2.6, 2.6, 0.022, 32), '#e2b07a', { p: [17, 0.031, -9] });
  // desk: a counter with books, a computer and a return box
  const d = LIB_DESK;
  const cx = (d.minX + d.maxX) / 2;
  const cz = (d.minZ + d.maxZ) / 2;
  p.add(box(d.maxX - d.minX, 0.86, d.maxZ - d.minZ), '#a1764a', { p: [cx, 0.43, cz] });
  p.add(box(d.maxX - d.minX + 0.15, 0.06, d.maxZ - d.minZ + 0.2), '#6b4a2e', { p: [cx, 0.89, cz] });
  p.add(box(0.5, 0.35, 0.05), '#263238', { p: [cx + 1.0, 1.18, cz - 0.15] });
  p.add(box(0.1, 0.15, 0.1), '#263238', { p: [cx + 1.0, 0.97, cz - 0.15] });
  for (let i = 0; i < 4; i++)
    p.add(box(0.35, 0.08, 0.26), BOOK_COLORS[(i * 3) % BOOK_COLORS.length]!, {
      p: [cx - 1.1, 0.96 + i * 0.08, cz],
      r: [0, i * 0.2, 0],
    });
  p.add(box(0.8, 0.8, 0.6), '#2e7d32', { p: [d.minX - 0.7, 0.4, cz + 0.4] }); // returns box
  p.add(box(0.5, 0.05, 0.2), '#111', { p: [d.minX - 0.7, 0.65, cz + 0.71] });
  // globe and a reading armchair
  p.add(cyl(0.05, 0.25, 0.8, 8), '#6b4a2e', { p: [23, 0.4, -5.5] });
  p.add(sphere(0.3, 0, Math.PI, 0, Math.PI * 2, 14, 10), '#3a8ad6', { p: [23, 1.05, -5.5] });
  p.add(box(1.0, 0.45, 0.9), '#7b1f2c', { p: [7, 0.23, -20] });
  p.add(box(1.0, 0.7, 0.2), '#7b1f2c', { p: [7, 0.7, -20.4] });
}

/** Outside: paving, a red carpet to the door, trees, poster cases and a marquee of light bulbs. */
const OUT_POSTERS = [
  [-6.5, 0],
  [6.5, 2],
] as const;
function outside(p: Part) {
  for (const [x, z] of [
    [-26.6, -21],
    [26.6, -21],
    [-26.6, -13],
    [26.6, -13],
    [-26.6, -5],
    [26.6, -5],
  ] as const)
    tree(p, x, z, 0.95);
  // benches on the forecourt
  for (const x of [-14, 14]) {
    p.add(box(2, 0.1, 0.5), '#8d6340', { p: [x, 0.45, -2] });
    for (const dx of [-0.8, 0.8]) p.add(box(0.1, 0.45, 0.45), '#444', { p: [x + dx, 0.22, -2] });
  }
}

/** Marquee with light bulbs above the door (hidden with the front wall while you are inside). */
function marquee(p: Part) {
  p.add(box(6.5, 1.0, 0.3), '#2b1d4a', { p: [0, 3.4, -3.55] });
  for (let x = -3.1; x <= 3.1; x += 0.4)
    for (const y of [2.98, 3.82])
      p.add(sphere(0.06, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#fff1a8', { p: [x, y, -3.4] });
  // poster cases beside the door
  for (const [x, i] of OUT_POSTERS) {
    p.add(box(1.7, 2.3, 0.2), '#e5b83b', { p: [x, 1.4, -3.75] });
    p.add(box(1.5, 2.1, 0.05), FILMS[i]!.color, { p: [x, 1.4, -3.63] });
  }
}

function PosterTitle({
  x,
  z,
  film,
  w = 1.3,
  rot = 0,
}: {
  x: number;
  z: number;
  film: (typeof FILMS)[number];
  w?: number;
  rot?: number;
}) {
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <Text
        position={[0, 2.3, 0]}
        maxWidth={w}
        fontSize={0.2}
        lineHeight={1.05}
        color={film.ink}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
      >
        {film.title.toUpperCase()}
      </Text>
      <Text
        position={[0, 1.25, 0]}
        maxWidth={w}
        fontSize={0.11}
        color={film.ink}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
      >
        {`${film.genre}\n${film.times.join(' · ')}`}
      </Text>
    </group>
  );
}

/** Star Cinema & Library: walk-in building, cinema foyer and screen room on the left, library on the right. */
export default function Cinema() {
  // same test as BuildingShell: outside props in front of the door hide with the front wall
  const [inside, setInside] = useState(false);
  const [inScreen, setInScreen] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const [x, z] = FRAME.toLocal(localPos.x, localPos.z);
    const i = insideBuilding(BUILDING, x, z + 0.6);
    if (i !== inside) setInside(i);
    const sc = x > sr.x0 && x < sr.x1 && z > sr.z0 && z < sr.z1 + 0.3;
    if (sc !== inScreen) setInScreen(sc);
  });
  const tickets = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    openCinema('tickets');
  };
  const books = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    openCinema('books');
  };
  const bo = BOX_OFFICE;
  const sb = SNACK_BAR;
  const sx = (SCREEN.x0 + SCREEN.x1) / 2;
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#cfc8dc" y={0.006} />
      <Ground x0={-1.4} x1={1.4} z0={-4} z1={0} color="#b3262f" y={0.014} />
      <Merged build={outside} />
      {!inside ? (
        <>
          <Merged build={marquee} />
          <Text
            position={[0, 3.4, -3.38]}
            fontSize={0.42}
            color="#ffe27a"
            anchorX="center"
            anchorY="middle"
          >
            NOW SHOWING
          </Text>
          {OUT_POSTERS.map(([x, i]) => (
            <PosterTitle key={x} x={x} z={-3.58} film={FILMS[i]!} w={1.4} />
          ))}
        </>
      ) : null}
      <BuildingShell b={BUILDING} name="Star Cinema & Library" frame={FRAME}>
        <Ground
          x0={PARTITION.x}
          x1={BUILDING.x1}
          z0={BUILDING.z0}
          z1={BUILDING.z1}
          color="#c89b6a"
          y={0.025}
        />
        <Merged build={cinemaShell} />
        <Merged build={(p) => screenFront(p, inScreen)} deps={[inScreen]} />
        <Merged build={boxOffice} onClick={tickets} />
        <Merged build={libraryFurniture} onClick={books} />
        <Merged build={libraryShelves} onClick={books} castShadow={false} />
        {/* the screen plays a short cartoon while you are in the building; click = buy tickets */}
        <CartoonScreen playing={inside} onClick={tickets} />
        {POSTERS.map((f, i) =>
          inScreen && !f.rot ? null : (
            <PosterTitle
              key={i}
              x={f.x + (f.rot ? 0.06 : 0)}
              z={f.z + (f.rot ? 0 : 0.06)}
              rot={f.rot}
              film={FILMS[i]!}
            />
          ),
        )}
        <Text
          visible={!inScreen}
          position={[(bo.minX + bo.maxX) / 2, 2.75, sr.z1 + 0.25]}
          fontSize={0.36}
          color="#2b1d4a"
          anchorX="center"
          anchorY="middle"
        >
          BOX OFFICE
        </Text>
        <Text
          position={[(bo.minX + bo.maxX) / 2, 0.5, bo.maxZ + 0.04]}
          fontSize={0.17}
          color="#ffe27a"
          anchorX="center"
          anchorY="middle"
        >
          {'Adult $9 · Child $6'}
        </Text>
        <Text
          visible={!inScreen}
          position={[(sb.minX + sb.maxX) / 2, 2.85, sr.z1 + 0.2]}
          fontSize={0.36}
          color="#b71c1c"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#fff"
        >
          SNACKS
        </Text>
        <Text
          visible={!inScreen}
          position={[(sb.minX + sb.maxX) / 2, 2.45, sr.z1 + 0.2]}
          fontSize={0.15}
          color="#2b1d4a"
          anchorX="center"
          anchorY="middle"
        >
          {'Popcorn S $4 / L $6 · Nachos $5 · Drink $3 · Ice cream $4'}
        </Text>
        <Text
          visible={!inScreen}
          position={[sr.doorX, 2.85, sr.z1 + 0.2]}
          fontSize={0.3}
          color="#ffe27a"
          anchorX="center"
          anchorY="middle"
        >
          SCREEN 1
        </Text>
        {/* library signs, readable from the foyer and from inside */}
        <Text
          position={[PARTITION.x - 0.2, 2.6, -14]}
          rotation-y={-Math.PI / 2}
          fontSize={0.4}
          color="#5e35b1"
          anchorX="center"
          anchorY="middle"
        >
          {'LIBRARY →'}
        </Text>
        <Text
          position={[PARTITION.x - 0.2, 2.15, -14]}
          rotation-y={-Math.PI / 2}
          fontSize={0.18}
          color="#6b4a2e"
          anchorX="center"
          anchorY="middle"
        >
          {'Borrow up to 5 books for 3 weeks'}
        </Text>
        <Text
          position={[15, 2.65, BUILDING.z0 + 0.95]}
          fontSize={0.36}
          color="#6b4a2e"
          anchorX="center"
          anchorY="middle"
        >
          {'STAR LIBRARY · Quiet, please'}
        </Text>
        <Text
          position={[(LIB_DESK.minX + LIB_DESK.maxX) / 2, 0.6, LIB_DESK.maxZ + 0.04]}
          fontSize={0.16}
          color="#fff8e1"
          anchorX="center"
          anchorY="middle"
        >
          {'Borrow & return'}
        </Text>
      </BuildingShell>
    </AreaGroup>
  );
}

/** The cinema screen: a canvas cartoon (cartoon.ts), redrawn ~15 times a second while someone can see it. */
function CartoonScreen({ playing, onClick }: { playing: boolean; onClick: (e: { stopPropagation: () => void }) => void }) {
  const { tex, ctx } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CARTOON_W;
    canvas.height = CARTOON_H;
    const ctx = canvas.getContext('2d')!;
    drawCartoon(ctx, 1);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { tex, ctx };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const acc = useRef(1);
  useFrame((_, dt) => {
    if (!playing) return;
    acc.current += dt;
    if (acc.current < 1 / 15) return;
    acc.current = 0;
    drawCartoon(ctx, serverNow() / 1000);
    tex.needsUpdate = true;
  });
  return (
    <mesh position={[(SCREEN.x0 + SCREEN.x1) / 2, (SCREEN.y0 + SCREEN.y1) / 2, SCREEN.z + 0.03]} onClick={onClick}>
      <planeGeometry args={[SCREEN.x1 - SCREEN.x0, SCREEN.y1 - SCREEN.y0]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
