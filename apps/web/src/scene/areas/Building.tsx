import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { insideBuilding, type Building } from '../../world/buildings';
import { localPos } from '../LocalPlayer';
import { Ground, Merged, box } from './kit';

const WALL_H = 3.2;

/** Walls, floor and roof of a walk-in building; the roof and front wall disappear while you are inside. */
export function BuildingShell({ b, name, children }: { b: Building; name: string; children?: React.ReactNode }) {
  const [inside, setInside] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const i = insideBuilding(b, localPos.x, localPos.z + 0.6);
    if (i !== inside) setInside(i);
  });
  const w = b.x1 - b.x0;
  const d = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const h = b.doorW / 2;
  return (
    <group>
      <Ground x0={b.x0} x1={b.x1} z0={b.z0} z1={b.z1} color={b.floor} y={0.02} />
      <Merged
        build={(p) => {
          p.add(box(w, WALL_H, 0.3), b.wall, { p: [cx, WALL_H / 2, b.z0] });
          p.add(box(0.3, WALL_H, d), b.wall, { p: [b.x0, WALL_H / 2, cz] });
          p.add(box(0.3, WALL_H, d), b.wall, { p: [b.x1, WALL_H / 2, cz] });
          // skirting stripe in the roof colour
          p.add(box(w, 0.35, 0.32), b.roof, { p: [cx, 0.18, b.z0] });
        }}
        deps={[b.area]}
      />
      {/* front wall: full height from outside, a low kerb while inside so the camera can see in */}
      <Merged
        build={(p) => {
          const hh = inside ? 0.4 : WALL_H;
          for (const [x0, x1] of [
            [b.x0, b.doorX - h],
            [b.doorX + h, b.x1],
          ] as const)
            p.add(box(x1 - x0, hh, 0.3), b.wall, { p: [(x0 + x1) / 2, hh / 2, b.z1] });
          if (!inside) {
            p.add(box(b.doorW + 0.2, WALL_H - 2.6, 0.3), b.wall, { p: [b.doorX, 2.6 + (WALL_H - 2.6) / 2, b.z1] });
            // windows
            for (let x = b.x0 + 3; x < b.x1 - 2; x += 5) if (Math.abs(x - b.doorX) > h + 1.5) p.add(box(2.6, 1.3, 0.05), '#a8d8f0', { p: [x, 1.6, b.z1 + 0.17] });
            // awning over the door
            p.add(box(b.doorW + 1.6, 0.12, 1.4), b.roof, { p: [b.doorX, 2.75, b.z1 + 0.75], r: [0.18, 0, 0] });
          }
        }}
        deps={[b.area, inside]}
      />
      {!inside ? (
        <>
          <Merged build={(p) => p.add(box(w + 0.6, 0.35, d + 0.6), b.roof, { p: [cx, WALL_H + 0.17, cz] })} deps={[b.area]} />
          <Text position={[b.doorX, 3.0, b.z1 + 0.2]} fontSize={0.55} color={b.roof} anchorX="center" anchorY="bottom" outlineWidth={0.04} outlineColor="#ffffff">
            {name}
          </Text>
        </>
      ) : null}
      {children}
    </group>
  );
}
