import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { serverNow } from '../../../net/client';
import { localPos } from '../../LocalPlayer';
import { classTick } from '../../../store/classroom';
import { classPhase, nextLesson } from '../../../world/lessons';
import { Text } from '@react-three/drei';
import { AREA, BENCHES, BIKE_RACK, BOARD, BOOKCASES, COURT, DESK_COLS, DESK_ROWS, FLAG, FRAME, HOOP, HOPSCOTCH, LIB_X, PARTITION, READING_TABLE, SCHOOL, SPOTS, SWINGS, TEACHER_DESK, TREES } from '../../../world/places/school';
import { useArea } from '../../../store/area';
import { BuildingShell } from '../Building';
import { AreaGroup, Ground, Merged, box, cyl, sphere, tree, type Part } from '../kit';

const S = SCHOOL;
const ball = (p: Part, r: number, color: string, at: [number, number, number], s?: [number, number, number]) => p.add(sphere(r, 0, Math.PI, 0, Math.PI * 2, 8, 6), color, { p: at, s });
const BOOK_COLORS = ['#e05f5f', '#5b8def', '#f2c94c', '#8bc34a', '#b07ad6', '#ff8a3d'];

function books(p: Part, x0: number, x1: number, z: number, y: number, alongZ = false) {
  for (let i = 0, x = x0; x < x1 - 0.12; i++, x += 0.17) {
    const h = 0.26 + ((i * 7) % 5) * 0.025;
    p.add(box(alongZ ? 0.26 : 0.13, h, alongZ ? 0.13 : 0.26), BOOK_COLORS[(i * 5) % BOOK_COLORS.length]!, { p: alongZ ? [z, y + h / 2, x] : [x, y + h / 2, z] });
  }
}

/** Classroom (desks, board, teacher's desk, posters) and the library corner. */
function interior(p: Part) {
  // pupils' desks with chairs, a book and a pencil case on each
  DESK_COLS.forEach((x, ci) =>
    DESK_ROWS.forEach((z, ri) => {
      p.add(box(1.2, 0.06, 0.6), '#d9a066', { p: [x, 0.72, z] });
      for (const dx of [-0.52, 0.52]) p.add(box(0.06, 0.7, 0.5), '#8a8f98', { p: [x + dx, 0.36, z] });
      p.add(box(0.42, 0.04, 0.3), BOOK_COLORS[(ci + ri) % BOOK_COLORS.length]!, { p: [x - 0.2, 0.77, z] });
      p.add(box(0.3, 0.07, 0.1), '#444', { p: [x + 0.3, 0.78, z - 0.12] });
      // chair behind the desk (pupils face the board, -z)
      p.add(box(0.42, 0.05, 0.42), ['#e05f5f', '#5b8def', '#8bc34a', '#f2c94c'][ci]!, { p: [x, 0.44, z + 0.6] });
      p.add(box(0.42, 0.45, 0.05), ['#e05f5f', '#5b8def', '#8bc34a', '#f2c94c'][ci]!, { p: [x, 0.7, z + 0.82] });
      for (const dx of [-0.17, 0.17]) for (const dz of [0.43, 0.77]) p.add(box(0.04, 0.44, 0.04), '#666', { p: [x + dx, 0.22, z + dz] });
    }),
  );
  // teacher's desk with books, an apple and a globe
  const T = TEACHER_DESK;
  const tx = (T.minX + T.maxX) / 2;
  const tz = (T.minZ + T.maxZ) / 2;
  p.add(box(T.maxX - T.minX, 0.75, T.maxZ - T.minZ), '#8b5a2b', { p: [tx, 0.38, tz] });
  p.add(box(T.maxX - T.minX + 0.1, 0.06, T.maxZ - T.minZ + 0.1), '#a0703c', { p: [tx, 0.78, tz] });
  for (let i = 0; i < 3; i++) p.add(box(0.5, 0.08, 0.35), BOOK_COLORS[i]!, { p: [tx - 0.5, 0.86 + i * 0.08, tz] });
  ball(p, 0.08, '#e05f5f', [tx + 0.2, 0.89, tz + 0.1]);
  p.add(cyl(0.04, 0.08, 0.1, 8), '#555', { p: [tx + 0.7, 0.86, tz] });
  ball(p, 0.18, '#4a90c9', [tx + 0.7, 1.08, tz]);
  ball(p, 0.1, '#6fbf5a', [tx + 0.76, 1.12, tz + 0.1], [1, 0.7, 0.7]);
  // board: frame, green board, chalk tray (text is drawn on top)
  p.add(box(BOARD.w + 0.25, BOARD.h + 0.25, 0.06), '#a0703c', { p: [BOARD.x, BOARD.y, S.z0 + 0.17] });
  p.add(box(BOARD.w, BOARD.h, 0.04), '#2f6b4f', { p: [BOARD.x, BOARD.y, S.z0 + 0.21] });
  p.add(box(BOARD.w, 0.06, 0.16), '#a0703c', { p: [BOARD.x, BOARD.y - BOARD.h / 2 - 0.05, S.z0 + 0.28] });
  // clock above the board
  p.add(cyl(0.3, 0.3, 0.05, 16), '#ffffff', { p: [BOARD.x, 3.0, S.z0 + 0.18], r: [Math.PI / 2, 0, 0] });
  p.add(box(0.03, 0.2, 0.02), '#222', { p: [BOARD.x, 3.07, S.z0 + 0.22] });
  p.add(box(0.15, 0.03, 0.02), '#222', { p: [BOARD.x + 0.06, 3.0, S.z0 + 0.22] });
  // alphabet strip above the windows of the back wall and posters
  for (let i = 0; i < 10; i++) p.add(box(0.5, 0.5, 0.03), BOOK_COLORS[i % BOOK_COLORS.length]!, { p: [-25 + i * 0.6, 2.7, S.z0 + 0.17] });
  p.add(box(0.03, 1.4, 2.0), '#ffffff', { p: [S.x0 + 0.17, 1.7, -16.5] }); // timetable poster frame
  p.add(box(0.03, 1.2, 1.8), '#fff6c8', { p: [S.x0 + 0.19, 1.7, -16.5] });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) p.add(box(0.02, 0.22, 0.3), BOOK_COLORS[(r * 2 + c) % BOOK_COLORS.length]!, { p: [S.x0 + 0.21, 2.1 - r * 0.27, -17.2 + c * 0.35] });
  // coat hooks with schoolbags by the door
  p.add(box(0.06, 0.08, 3), '#8b5a2b', { p: [S.x0 + 0.2, 1.5, -12] });
  for (let i = 0; i < 4; i++) p.add(box(0.25, 0.45, 0.4), BOOK_COLORS[(i + 2) % BOOK_COLORS.length]!, { p: [S.x0 + 0.32, 1.2, -13.1 + i * 0.7] });
  // globe on a cupboard in the corner
  p.add(box(1.2, 0.9, 0.5), '#a0703c', { p: [-9.2, 0.45, S.z0 + 0.4] });
  ball(p, 0.28, '#4a90c9', [-9.2, 1.22, S.z0 + 0.4]);
  p.add(cyl(0.05, 0.12, 0.15, 8), '#555', { p: [-9.2, 0.95, S.z0 + 0.4] });
  // plants
  for (const [x, z] of [[-25.3, -22.2], [-7.7, -10.6]] as const) {
    p.add(cyl(0.25, 0.18, 0.4, 10), '#c4553a', { p: [x, 0.2, z] });
    ball(p, 0.4, '#4f9a44', [x, 0.72, z]);
  }
  // partition (low wall) between classroom and library
  for (const w of PARTITION) p.add(box(w.maxX - w.minX, 1.3, w.maxZ - w.minZ), '#f6e6c4', { p: [(w.minX + w.maxX) / 2, 0.65, (w.minZ + w.maxZ) / 2] });
  // ---- library corner: bookcases full of books, reading table, beanbags, rug
  BOOKCASES.forEach((b) => {
    const along = b.maxZ - b.minZ > b.maxX - b.minX;
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    p.add(box(b.maxX - b.minX, 2.0, b.maxZ - b.minZ), '#8b5a2b', { p: [cx, 1.0, cz] });
    for (const y of [0.12, 0.62, 1.12, 1.62]) {
      p.add(box(b.maxX - b.minX - 0.04, 0.05, b.maxZ - b.minZ + 0.02), '#a0703c', { p: [cx, y, cz] });
      if (along) books(p, b.minZ + 0.1, b.maxZ - 0.1, b.minX + 0.05, y + 0.03, true);
      else books(p, b.minX + 0.1, b.maxX - 0.1, b.maxZ + 0.02, y + 0.03);
    }
  });
  const R = READING_TABLE;
  const rx = (R.minX + R.maxX) / 2;
  const rz = (R.minZ + R.maxZ) / 2;
  p.add(cyl(1.3, 1.3, 0.02, 24), '#7fb8d6', { p: [rx, 0.03, rz + 0.3], s: [1.6, 1, 1.4] });
  p.add(box(R.maxX - R.minX, 0.06, R.maxZ - R.minZ), '#d9a066', { p: [rx, 0.66, rz] });
  for (const dx of [-1.2, 1.2]) for (const dz of [-0.55, 0.55]) p.add(box(0.06, 0.64, 0.06), '#8b5a2b', { p: [rx + dx, 0.32, rz + dz] });
  p.add(box(0.5, 0.06, 0.36), '#5b8def', { p: [rx - 0.4, 0.71, rz], r: [0, 0.3, 0] });
  p.add(box(0.5, 0.06, 0.36), '#e05f5f', { p: [rx + 0.5, 0.71, rz + 0.1], r: [0, -0.2, 0] });
  for (const dx of [-0.8, 0.8]) for (const s of [-1, 1]) p.add(cyl(0.2, 0.2, 0.42, 10), '#f2c94c', { p: [rx + dx, 0.21, rz + s * 1.05] });
  ball(p, 0.5, '#b07ad6', [-5.4, 0.3, -12.4], [1, 0.6, 1]);
  ball(p, 0.5, '#ff8a3d', [-0.2, 0.3, -12.2], [1, 0.6, 1]);
}

/** Playground, forecourt, flag pole, bike rack, hedges, trees. */
function outside(p: Part) {
  for (const s of [-1, 1]) p.add(box(0.8, 1.0, 23.2), '#4f8f3f', { p: [s * 27.6, 0.5, -11.8] });
  p.add(box(56, 1.0, 0.8), '#4f8f3f', { p: [0, 0.5, -23.3] });
  // court lines
  const C = COURT;
  const ccx = (C.minX + C.maxX) / 2;
  const ccz = (C.minZ + C.maxZ) / 2;
  for (const z of [C.minZ + 0.3, C.maxZ - 0.1]) p.add(box(C.maxX - C.minX - 0.4, 0.02, 0.1), '#ffffff', { p: [ccx, 0.035, z] });
  for (const x of [C.minX + 0.2, C.maxX - 0.2]) p.add(box(0.1, 0.02, C.maxZ - C.minZ - 0.3), '#ffffff', { p: [x, 0.035, ccz] });
  p.add(cyl(1.8, 1.8, 0.02, 24, true), '#ffffff', { p: [HOOP.x, 0.035, C.minZ + 0.3], s: [1, 1, 1] });
  p.add(cyl(1.0, 1.0, 0.02, 20), '#ffffff', { p: [ccx, 0.03, C.maxZ - 0.1] });
  p.add(cyl(0.94, 0.94, 0.025, 20), '#d98c5f', { p: [ccx, 0.032, C.maxZ - 0.1] });
  // basketball hoop
  p.add(cyl(0.08, 0.1, 3.2, 8), '#555', { p: [HOOP.x, 1.6, HOOP.z] });
  p.add(box(0.1, 0.1, 0.7), '#555', { p: [HOOP.x, 3.1, HOOP.z + 0.35] });
  p.add(box(1.4, 0.9, 0.06), '#ffffff', { p: [HOOP.x, 3.3, HOOP.z + 0.7] });
  p.add(box(0.5, 0.4, 0.07), '#e05f5f', { p: [HOOP.x, 3.15, HOOP.z + 0.71] });
  p.add(cyl(0.25, 0.25, 0.04, 16, true), '#ff6d00', { p: [HOOP.x, 2.95, HOOP.z + 0.98] });
  ball(p, 0.13, '#ff8a3d', [HOOP.x + 2, 0.13, HOOP.z + 4]);
  // swings
  const W = SWINGS;
  for (const x of [W.x0, W.x1]) for (const s of [-1, 1]) p.add(cyl(0.06, 0.06, 2.6, 6), '#e05f5f', { p: [x, 1.25, W.z + s * 0.45], r: [s * 0.2, 0, 0] });
  p.add(cyl(0.06, 0.06, W.x1 - W.x0, 6), '#e05f5f', { p: [(W.x0 + W.x1) / 2, 2.5, W.z], r: [0, 0, Math.PI / 2] });
  for (const x of [W.x0 + 1.2, W.x1 - 1.2]) {
    for (const dx of [-0.25, 0.25]) p.add(cyl(0.015, 0.015, 1.9, 4), '#888', { p: [x + dx, 1.55, W.z] });
    p.add(box(0.6, 0.06, 0.3), '#f2c94c', { p: [x, 0.6, W.z] });
  }
  // hopscotch squares
  const H = HOPSCOTCH;
  const cells: [number, number][] = [[0, 0], [0, 1], [-0.5, 2], [0.5, 2], [0, 3], [-0.5, 4], [0.5, 4], [0, 5]];
  cells.forEach(([dx, k], i) => {
    p.add(box(0.86, 0.02, 0.86), '#ffffff', { p: [H.x + dx * 0.9, 0.03, H.z0 + 4.5 - k * H.step] });
    p.add(box(0.76, 0.025, 0.76), BOOK_COLORS[i % BOOK_COLORS.length]!, { p: [H.x + dx * 0.9, 0.035, H.z0 + 4.5 - k * H.step] });
  });
  // flag pole with a maple-leaf flag
  p.add(cyl(0.3, 0.4, 0.3, 10), '#bbb', { p: [FLAG.x, 0.15, FLAG.z] });
  p.add(cyl(0.05, 0.05, 6, 6), '#ddd', { p: [FLAG.x, 3, FLAG.z] });
  ball(p, 0.09, '#f2c94c', [FLAG.x, 6.05, FLAG.z]);
  p.add(box(1.8, 1.1, 0.03), '#5b8def', { p: [FLAG.x + 0.95, 5.35, FLAG.z] });
  ball(p, 0.3, '#e05f5f', [FLAG.x + 0.95, 5.35, FLAG.z], [1, 1, 0.15]);
  // benches
  for (const b of BENCHES) {
    const bx = (b.minX + b.maxX) / 2;
    const bz = (b.minZ + b.maxZ) / 2;
    p.add(box(2.4, 0.1, 0.6), '#a0703c', { p: [bx, 0.45, bz] });
    for (const dx of [-1, 1]) p.add(box(0.1, 0.45, 0.5), '#555', { p: [bx + dx, 0.22, bz] });
  }
  // bike rack with two bikes
  const B = BIKE_RACK;
  for (let x = B.minX + 0.4; x < B.maxX; x += 0.8) p.add(cyl(0.03, 0.03, 0.8, 6, false), '#888', { p: [x, 0.4, (B.minZ + B.maxZ) / 2] });
  p.add(box(B.maxX - B.minX, 0.05, 0.05), '#888', { p: [(B.minX + B.maxX) / 2, 0.8, (B.minZ + B.maxZ) / 2] });
  for (const [x, c] of [[-23.2, '#e05f5f'], [-21.6, '#5b8def']] as const) {
    for (const dz of [-0.45, 0.45]) p.add(cyl(0.32, 0.32, 0.05, 14), '#333', { p: [x, 0.34, -6 + dz], r: [0, 0, Math.PI / 2] });
    p.add(box(0.06, 0.06, 0.9), c, { p: [x, 0.55, -6] });
    p.add(box(0.06, 0.4, 0.06), c, { p: [x, 0.6, -6.3] });
    p.add(box(0.3, 0.05, 0.05), '#333', { p: [x, 0.8, -5.7] });
  }
  for (const [x, z, s] of TREES) tree(p, x, z, s);
}

/** Tap something with a word card; the board and the timetable poster open the activity. */
function onTap(e: ThreeEvent<MouseEvent>) {
  e.stopPropagation();
  const [x, z] = FRAME.toLocal(e.point.x, e.point.z);
  let best = SPOTS[0]!;
  let bd = Infinity;
  for (const s of SPOTS) {
    const d = Math.hypot(x - s.x, z - s.z) - s.r;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  if (bd > 0.6) return;
  if (best.item === 'board' || best.item === 'timetable') useArea.getState().setPanel(true, 'activity');
  else useArea.getState().openCard({ area: 'school', item: best.item });
}

/* ------------------------------------------------------------------------------------------ the timed class */
const BW = 1024;
const BH = Math.round((BW * BOARD.h) / BOARD.w);

function drawBoard(c: CanvasRenderingContext2D, now: number, day: string) {
  const p = classPhase(now);
  c.fillStyle = '#2f6b4f';
  c.fillRect(0, 0, BW, BH);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const chalk = (t: string, x: number, y: number, size: number, color = '#f6f1d8', weight = 'bold') => {
    c.font = `${weight} ${size}px "Comic Sans MS", "Trebuchet MS", sans-serif`;
    c.fillStyle = color;
    c.fillText(t, x, y, BW - 60);
  };
  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  c.font = '22px sans-serif';
  c.fillStyle = 'rgba(246,241,216,0.6)';
  c.textAlign = 'left';
  c.fillText(day, 24, 26);
  c.textAlign = 'right';
  c.fillText(p.phase === 'break' ? `Next lesson in ${clock(p.left)}` : `Lesson: ${p.lesson.title}`, BW - 24, 26);
  c.textAlign = 'center';
  if (p.phase === 'bell') {
    chalk('🔔 Good morning, class!', BW / 2, BH * 0.4, 64);
    chalk(`Today: ${p.lesson.title}`, BW / 2, BH * 0.68, 50, '#ffe27a');
  } else if (p.phase === 'slide') {
    const sl = p.lesson.slides[p.slide]!;
    c.font = '120px serif';
    c.fillText(sl.pic, BW * 0.17, BH * 0.52);
    c.textAlign = 'left';
    chalk(sl.word, BW * 0.32, BH * 0.38, 70, '#ffe27a');
    chalk(sl.say, BW * 0.32, BH * 0.66, 38, '#f6f1d8', 'normal');
    c.textAlign = 'center';
    chalk(`${p.slide + 1} / ${p.lesson.slides.length}`, BW / 2, BH - 22, 22, 'rgba(246,241,216,0.6)', 'normal');
  } else if (p.phase === 'quiz') {
    const q = p.lesson.quiz[p.q]!;
    chalk(`Question ${p.q + 1}: ${q.q}`, BW / 2, BH * 0.26, 46);
    q.options.forEach((o, i) => chalk(`${'ABC'[i]}. ${o}`, BW / 2, BH * (0.5 + i * 0.16), 38, '#ffe27a', 'normal'));
    chalk(`✋ Put up your hand! (${Math.ceil(p.left)})`, BW / 2, BH - 22, 22, 'rgba(246,241,216,0.7)', 'normal');
  } else {
    chalk('Break time! 🍎', BW / 2, BH * 0.38, 62);
    chalk(`Next lesson: ${nextLesson(p.n).title} in ${clock(p.left)}`, BW / 2, BH * 0.66, 40, '#ffe27a', 'normal');
  }
}

/** The green board runs the timed class (world/lessons.ts) and the classroom watcher (store/classroom.ts). */
function ClassBoard({ day }: { day: string }) {
  const { tex, ctx } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = BW;
    canvas.height = BH;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { tex, ctx };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const now = serverNow();
    drawBoard(ctx, now, day);
    tex.needsUpdate = true;
    const [x, z] = FRAME.toLocal(localPos.x, localPos.z);
    classTick(x > S.x0 && x < LIB_X && z > S.z0 && z < S.z1, now);
  });
  useEffect(() => () => classTick(false, serverNow()), []);
  return (
    <mesh position={[BOARD.x, BOARD.y, S.z0 + 0.235]}>
      <planeGeometry args={[BOARD.w, BOARD.h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export default function School() {
  const day = useMemo(() => new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }), []);
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#a9d67f" y={0.006} />
      <Ground x0={-27.2} x1={4} z0={S.z1} z1={0} color="#d6cfc0" y={0.01} />
      <Ground x0={4} x1={27.2} z0={-23} z1={0} color="#c4c9cf" y={0.009} />
      <Ground x0={COURT.minX} x1={COURT.maxX} z0={COURT.minZ} z1={COURT.maxZ} color="#d98c5f" y={0.014} />
      <Ground x0={LIB_X} x1={S.x1} z0={S.z0} z1={S.z1} color="#c9dcef" y={0.024} />
      <BuildingShell b={S} name="Maple School" frame={FRAME}>
        <Merged build={interior} onClick={onTap as never} />
        <ClassBoard day={`Today is ${day}.`} />
        <Text position={[(LIB_X + S.x1) / 2, 2.55, S.z0 + 0.4]} fontSize={0.4} color="#5b8def" anchorX="center">
          LIBRARY
        </Text>
        <Text position={[S.x0 + 0.24, 2.6, -16.5]} rotation-y={Math.PI / 2} fontSize={0.2} color="#2f5fb3" anchorX="center">
          TIMETABLE
        </Text>
      </BuildingShell>
      <Merged build={outside} onClick={onTap as never} />
      <Text position={[16 + 0.0, 0.05, HOPSCOTCH.z0 + 5.4]} rotation-x={-Math.PI / 2} fontSize={0.35} color="#ffffff" anchorX="center">
        HOPSCOTCH
      </Text>
    </AreaGroup>
  );
}
