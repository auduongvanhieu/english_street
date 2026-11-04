import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { AREAS, BUS_STOPS, FRONT_Z, GATE_X, areaAt, type AreaDef } from '../../world/areas';
import { localPos } from '../LocalPlayer';
import { useArea } from '../../store/area';
import { useGame } from '../../store/game';
import { Merged, box, cyl, sphere } from './kit';
import { Zoo } from './Zoo';
import { Farm } from './Farm';
import { Supermarket } from './Supermarket';
import { Restaurant } from './Restaurant';

/** Everything of the extended street: the two welcome gates, bus stops, area gates and the four areas. */
export function Areas() {
  return (
    <group>
      <AreaWatcher />
      <StreetGate x={-GATE_X} label="← FreshWay Supermarket · Grand Garden Restaurant" />
      <StreetGate x={GATE_X} label="Sunny Hills Zoo · Green Valley Farm →" />
      {AREAS.map((a) => (
        <AreaGate key={a.id} a={a} />
      ))}
      {BUS_STOPS.map((s) => (
        <BusStop key={s.id} x={s.x} z={s.z} />
      ))}
      <Zoo />
      <Farm />
      <Supermarket />
      <Restaurant />
    </group>
  );
}

/** Tracks which area the local player is in (with a little hysteresis at the edges). */
function AreaWatcher() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const s = useArea.getState();
    const inside = areaAt(localPos.x, localPos.z, s.current ? 0.6 : 0);
    if (inside !== s.current) s.setCurrent(inside);
  });
  return null;
}

/** Arch over the road where the old end fences were. */
function StreetGate({ x, label }: { x: number; label: string }) {
  return (
    <group position={[x, 0, 0]}>
      <Merged
        build={(p) => {
          for (const z of [-6.3, 6.3]) {
            p.add(cyl(0.22, 0.26, 6.4, 10), '#8a6a44', { p: [0, 3.2, z] });
            p.add(sphere(0.32, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#f2c94c', { p: [0, 6.55, z] });
          }
          p.add(box(0.3, 0.9, 13), '#3f7f4f', { p: [0, 6.0, 0] });
          for (let i = -5; i <= 5; i++) p.add(sphere(0.18, 0, Math.PI, 0, Math.PI * 2, 8, 6), ['#ff7b7b', '#ffd36b', '#7fd0ff', '#b98cff'][(i + 8) % 4]!, { p: [0, 5.45, i * 1.1] });
        }}
      />
      {[1, -1].map((side) => (
        <Text key={side} position={[side * 0.17, 6.0, 0]} rotation-y={(side * Math.PI) / 2} fontSize={0.42} color="#fff" anchorX="center" anchorY="middle" maxWidth={12.5}>
          {label}
        </Text>
      ))}
    </group>
  );
}

/** Colourful arch over the gap in an area's front fence, with its name. */
function AreaGate({ a }: { a: AreaDef }) {
  const w = a.doorW + 0.8;
  return (
    <group position={[a.doorX, 0, FRONT_Z]}>
      <Merged
        build={(p) => {
          for (const sx of [-1, 1]) p.add(box(0.4, 6.2, 0.4), a.color, { p: [(sx * w) / 2, 3.1, 0] });
          p.add(box(w + 0.8, 0.8, 0.3), a.color, { p: [0, 5.9, 0] });
          // front fence of the yard (gap in the middle)
          const half = a.doorW / 2;
          for (const [x0, x1] of [
            [a.x0 - a.doorX, -half],
            [half, a.x1 - a.doorX],
          ] as const) {
            const len = x1 - x0;
            const n = Math.max(1, Math.round(len / 2));
            for (let i = 0; i <= n; i++) p.add(box(0.12, 1.1, 0.12), '#7a5a3a', { p: [x0 + (len * i) / n, 0.55, 0] });
            for (const y of [0.5, 0.95]) p.add(box(len, 0.08, 0.06), '#9a7a50', { p: [(x0 + x1) / 2, y, 0] });
          }
        }}
        deps={[a.id]}
      />
      <Text position={[0, 5.9, 0.17]} fontSize={0.42} color="#fff" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#00000055">
        {`${a.name}`}
      </Text>
    </group>
  );
}

/** Bus stop shelter on the south pavement; tapping it opens the bus menu. */
function BusStop({ x, z }: { x: number; z: number }) {
  const open = useGame((s) => s.setUiPanel);
  return (
    <group
      position={[x + 3, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        open('bus');
      }}
    >
      <Merged
        build={(p) => {
          for (const dx of [-1.1, 1.1]) p.add(box(0.1, 2.3, 0.1), '#596273', { p: [dx, 1.15, 0.5] });
          p.add(box(2.5, 0.1, 1.3), '#2f80ed', { p: [0, 2.35, 0.1] });
          p.add(box(2.4, 1.6, 0.05), '#cfe6ff', { p: [0, 1.25, -0.45] });
          p.add(box(1.8, 0.08, 0.4), '#a0703c', { p: [0, 0.5, -0.2] });
          p.add(cyl(0.05, 0.05, 2.6, 8), '#596273', { p: [1.6, 1.3, 0.5] });
          p.add(cyl(0.32, 0.32, 0.06, 16), '#2f80ed', { p: [1.6, 2.55, 0.5], r: [Math.PI / 2, 0, 0] });
        }}
      />
      <Text position={[1.6, 2.55, 0.54]} fontSize={0.3} color="#fff" anchorX="center" anchorY="middle">
        BUS
      </Text>
    </group>
  );
}
