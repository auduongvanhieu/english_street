import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { areaFrame, type AreaDef } from '../../world/areas';
import { BOARD_READ_RADIUS, BOARD_W, boardLocal, boardReadPoint } from '../../world/guideBoards';
import { useArea } from '../../store/area';
import { localPos } from '../LocalPlayer';
import { bulbMat, glowGeometry, glowPointsMat } from '../nightGlow';
import { Merged, box, cyl } from './kit';

const POST_H = 2.7;
const BOARD_H = 1.15;
const BOARD_Y = 1.55;

/** The area's guide board: a sign hanging from a little wooden gallows, lit by a lamp at night. Tap it to read. */
export function GuideBoard({ a }: { a: AreaDef }) {
  const f = areaFrame(a);
  const b = boardLocal(a);
  const halo = useMemo(() => glowGeometry([{ p: [0, POST_H + 0.02, 0.35], c: '#ffd27a', s: 1.6, tw: 0.05 }]), []);
  const open = () => useArea.getState().setPanel(true);
  return (
    <group position={[f.ox, 0, f.oz]} rotation-y={f.rot}>
      {/* the board faces the path into the yard (+z = towards the gate, local) turned a little towards the door */}
      <group position={[b.x, 0, b.z]} rotation-y={-0.35}>
        <Merged
          build={(p) => {
            for (const s of [-1, 1]) p.add(box(0.14, POST_H, 0.14), '#6b4e33', { p: [(s * BOARD_W) / 2, POST_H / 2, 0] });
            p.add(box(BOARD_W + 0.4, 0.14, 0.16), '#6b4e33', { p: [0, POST_H, 0] });
            // chains
            for (const s of [-1, 1]) p.add(cyl(0.015, 0.015, POST_H - BOARD_Y - BOARD_H / 2, 4), '#3a3a3a', { p: [(s * BOARD_W) / 2.6, (POST_H + BOARD_Y + BOARD_H / 2) / 2, 0] });
            // board with a coloured frame
            p.add(box(BOARD_W, BOARD_H, 0.08), a.color, { p: [0, BOARD_Y, 0] });
            p.add(box(BOARD_W - 0.16, BOARD_H - 0.16, 0.1), '#2f4a3a', { p: [0, BOARD_Y, 0] });
            // lamp arm
            p.add(box(0.06, 0.06, 0.35), '#3a3a3a', { p: [0, POST_H + 0.05, 0.18] });
          }}
          deps={[a.id]}
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        />
        <mesh material={bulbMat} position={[0, POST_H - 0.05, 0.35]}>
          <boxGeometry args={[0.22, 0.12, 0.16]} />
        </mesh>
        <points geometry={halo} material={glowPointsMat} renderOrder={3} />
        {[1, -1].map((side) => (
          <group key={side} rotation-y={side > 0 ? 0 : Math.PI}>
            <Text position={[0, BOARD_Y + 0.27, 0.065]} fontSize={0.24} color="#fff6d8" anchorX="center" anchorY="middle" maxWidth={BOARD_W - 0.25}>
              GUIDE
            </Text>
            <Text position={[0, BOARD_Y - 0.02, 0.065]} fontSize={0.13} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={BOARD_W - 0.25}>
              {a.name}
            </Text>
            <Text position={[0, BOARD_Y - 0.28, 0.065]} fontSize={0.11} color="#cfe8d6" anchorX="center" anchorY="middle" maxWidth={BOARD_W - 0.25}>
              Words · Phrases · Quiz
            </Text>
          </group>
        ))}
      </group>
      <BoardWatcher a={a} />
    </group>
  );
}

/** Flags useArea.nearBoard while the player stands in front of this board. */
function BoardWatcher({ a }: { a: AreaDef }) {
  const [rx, rz] = useMemo(() => boardReadPoint(a), [a]);
  const acc = useRef(0);
  const was = useRef(false);
  useEffect(
    () => () => {
      if (was.current) useArea.getState().setNearBoard(false);
    },
    [],
  );
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const near = Math.hypot(localPos.x - rx, localPos.z - rz) < BOARD_READ_RADIUS;
    if (near !== was.current) {
      was.current = near;
      useArea.getState().setNearBoard(near);
    }
  });
  return null;
}
