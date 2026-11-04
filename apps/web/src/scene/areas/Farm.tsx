import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { decodeGarden, plotStage, type Crop } from '@es/shared';
import { useGame } from '../../store/game';
import { BARN, COOP, ORCHARD, PENS, PLOTS, PLOT_SIZE, STALL, WINDMILL } from '../../world/farmLayout';
import { FRONT_Z, YARD_MIN_Z, areaById } from '../../world/areas';
import { enclosurePath } from '../../world/zooLayout';
import { useFarm } from '../../store/farm';
import { useArea } from '../../store/area';
import { Animal } from './Animal';
import { Ground, Merged, NearArea, Sign, box, cyl, fenceRect, sphere, tree } from './kit';

const CROP_COLOR: Record<Crop, [string, string]> = {
  carrot: ['#5fae4e', '#f08a2c'],
  corn: ['#7cbf4a', '#f2d14a'],
  tomato: ['#4f9a44', '#e5533d'],
  potato: ['#6aa84f', '#c9a06a'],
  pumpkin: ['#5f9e3e', '#f08a2c'],
  strawberry: ['#4f9a44', '#e23b4e'],
};

function FarmStatic() {
  return (
    <Merged
      build={(p) => {
        for (const pen of PENS) fenceRect(p, pen.x0, pen.x1, pen.z0, pen.z1, '#8a6a44', 1.05);
        // red barn with a white-trimmed roof and big door
        const bx = (BARN.minX + BARN.maxX) / 2;
        const bz = (BARN.minZ + BARN.maxZ) / 2;
        const bw = BARN.maxX - BARN.minX;
        const bd = BARN.maxZ - BARN.minZ;
        p.add(box(bw, 4.2, bd), '#c0392b', { p: [bx, 2.1, bz] });
        for (const sx of [-1, 1]) p.add(box(bw * 0.56, 0.25, bd + 0.6), '#5a3b30', { p: [bx + (sx * bw) / 4.2, 5.0, bz], r: [0, 0, -sx * 0.5] });
        p.add(box(bw + 0.1, 0.2, 0.2), '#ffffff', { p: [bx, 4.2, BARN.maxZ + 0.02] });
        p.add(box(4, 3.2, 0.08), '#8c2a20', { p: [bx, 1.6, BARN.maxZ + 0.03] });
        for (const d of [-1, 1]) p.add(box(0.15, 4.4, 0.1), '#ffffff', { p: [bx + d * 1.4, 1.6, BARN.maxZ + 0.06], r: [0, 0, d * 0.6] });
        // hay bales next to the barn
        for (const [x, z] of [[144, -18.2], [145.3, -18.4], [144.6, -17.6]] as const) p.add(cyl(0.55, 0.55, 0.9, 10), '#e0b84f', { p: [x, 0.55, z], r: [0, 0, Math.PI / 2] });
        // windmill tower
        p.add(cyl(0.7, 1.2, 6, 8), '#efe6d2', { p: [WINDMILL.x, 3, WINDMILL.z] });
        p.add(new THREE.ConeGeometry(1.0, 1.4, 8), '#7a3b2e', { p: [WINDMILL.x, 6.7, WINDMILL.z] });
        // chicken coop
        const cx = (COOP.minX + COOP.maxX) / 2;
        const cz = (COOP.minZ + COOP.maxZ) / 2;
        p.add(box(COOP.maxX - COOP.minX, 1.5, COOP.maxZ - COOP.minZ), '#e9c46a', { p: [cx, 1.05, cz] });
        for (const sx of [-1, 1]) p.add(cyl(0.08, 0.08, 0.3, 6), '#7a5536', { p: [cx + sx, 0.15, cz] });
        p.add(box(COOP.maxX - COOP.minX + 0.4, 0.15, COOP.maxZ - COOP.minZ + 0.4), '#9c4a2e', { p: [cx, 1.85, cz] });
        // troughs
        p.add(box(2.4, 0.4, 0.6), '#7a5536', { p: [120, 0.2, -18.2] });
        p.add(box(1.6, 0.35, 0.5), '#7a5536', { p: [117, 0.18, -9.4] });
        // garden plots (soil beds with a wooden border)
        for (const pl of PLOTS) {
          p.add(box(PLOT_SIZE, 0.12, PLOT_SIZE), '#6b4a30', { p: [pl.x, 0.06, pl.z] });
          for (const [dx, dz, w, d] of [[0, -PLOT_SIZE / 2, PLOT_SIZE + 0.15, 0.1], [0, PLOT_SIZE / 2, PLOT_SIZE + 0.15, 0.1], [-PLOT_SIZE / 2, 0, 0.1, PLOT_SIZE], [PLOT_SIZE / 2, 0, 0.1, PLOT_SIZE]] as const)
            p.add(box(w, 0.2, d), '#a0703c', { p: [pl.x + dx, 0.1, pl.z + dz] });
        }
        // apple orchard
        for (const o of ORCHARD) {
          tree(p, o.x, o.z, 1, '#5fae4e');
          for (let i = 0; i < 5; i++) p.add(sphere(0.12, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#e5533d', { p: [o.x + Math.cos(i * 1.3) * 0.6, 1.5 + (i % 2) * 0.4, o.z + Math.sin(i * 1.3) * 0.6] });
        }
        // market stall
        p.add(box(3.2, 0.9, 1), '#a0703c', { p: [STALL.x, 0.45, STALL.z] });
        for (const sx of [-1.5, 1.5]) p.add(box(0.1, 2.4, 0.1), '#7a5536', { p: [STALL.x + sx, 1.2, STALL.z - 0.4] });
        for (let i = 0; i < 6; i++) p.add(box(0.55, 0.12, 1.4), i % 2 ? '#ffffff' : '#e5533d', { p: [STALL.x - 1.4 + i * 0.56, 2.45, STALL.z + 0.1], r: [0.25, 0, 0] });
        for (let i = 0; i < 4; i++) p.add(box(0.6, 0.25, 0.5), '#c98a52', { p: [STALL.x - 1.1 + i * 0.73, 1.0, STALL.z] });
        for (const [i, c] of [[0, '#f08a2c'], [1, '#e5533d'], [2, '#f2d14a'], [3, '#e23b4e']] as const)
          for (let k = 0; k < 4; k++) p.add(sphere(0.09, 0, Math.PI, 0, Math.PI * 2, 6, 4), c, { p: [STALL.x - 1.25 + i * 0.73 + (k % 2) * 0.18, 1.2, STALL.z - 0.1 + Math.floor(k / 2) * 0.18] });
      }}
    />
  );
}

/** Windmill sails turning slowly. */
function Sails() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => ref.current && (ref.current.rotation.z += dt * 0.6));
  return (
    <group position={[WINDMILL.x, 5.6, WINDMILL.z + 1.0]}>
      <group ref={ref}>
        <Merged
          build={(p) => {
            p.add(cyl(0.18, 0.18, 0.3, 10), '#5a3b30', { r: [Math.PI / 2, 0, 0] });
            for (let i = 0; i < 4; i++) {
              const a = (i * Math.PI) / 2;
              p.add(box(0.5, 2.4, 0.05), '#f6f1e4', { p: [Math.cos(a + Math.PI / 2) * 1.35, Math.sin(a + Math.PI / 2) * 1.35, 0], r: [0, 0, a] });
            }
          }}
        />
      </group>
    </group>
  );
}

/** The learner's six garden plots with their current crop (stage from the server state). */
function Garden() {
  const farm = useFarm((s) => s.farm);
  const skew = useFarm((s) => s.skew);
  const load = useFarm((s) => s.load);
  const setPlot = useFarm((s) => s.setPlot);
  const openPanel = useArea((s) => s.setPanel);
  const visiting = useFarm((s) => s.visiting);
  const visited = useGame((s) => (visiting ? s.players[visiting]?.garden ?? '' : ''));
  const plots = useMemo(() => (visiting && visited ? decodeGarden(visited) : null), [visiting, visited]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);
  // re-render every few seconds so growth shows
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const now = Date.now() + skew;
  return (
    <group>
      {PLOTS.map((pl, i) => {
        const plot = plots ? plots[i] : farm.plots[i];
        const st = plotStage(plot, now);
        return (
          <group
            key={i}
            position={[pl.x, 0, pl.z]}
            onClick={(e) => {
              e.stopPropagation();
              if (plots) return; // someone else's garden: look, don't touch
              setPlot(i);
              openPanel(true, 'farm');
            }}
          >
            {/* invisible hit box over the bed */}
            <mesh position={[0, 0.3, 0]} visible={false}>
              <boxGeometry args={[PLOT_SIZE, 0.6, PLOT_SIZE]} />
            </mesh>
            {plot?.crop ? <Plants crop={plot.crop} stage={st.stage} progress={st.progress} /> : null}
            {st.stage === 'seed' ? (
              <mesh position={[0, 0.9, 0]}>
                <sphereGeometry args={[0.16, 10, 8]} />
                <meshBasicMaterial color="#4aa3ff" />
              </mesh>
            ) : null}
            {st.stage === 'ready' ? (
              <mesh position={[0, 1.4, 0]}>
                <octahedronGeometry args={[0.22]} />
                <meshBasicMaterial color="#ffd23f" />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function Plants({ crop, stage, progress }: { crop: Crop; stage: string; progress: number }) {
  const [leaf, fruit] = CROP_COLOR[crop];
  const k = stage === 'seed' ? 0.15 : stage === 'ready' ? 1 : 0.3 + progress * 0.6;
  return (
    <group>
      {[-0.6, 0, 0.6].flatMap((dx) =>
        [-0.6, 0, 0.6].map((dz) => (
          <group key={`${dx}${dz}`} position={[dx, 0.12, dz]} scale={k}>
            <mesh position={[0, crop === 'corn' ? 0.7 : 0.25, 0]}>
              <coneGeometry args={[crop === 'corn' ? 0.12 : 0.22, crop === 'corn' ? 1.4 : 0.5, 6]} />
              <meshToonMaterial color={leaf} />
            </mesh>
            {stage === 'ready' ? (
              <mesh position={[0.12, crop === 'corn' ? 0.8 : crop === 'carrot' || crop === 'potato' ? 0.05 : 0.35, 0.05]}>
                <sphereGeometry args={[crop === 'pumpkin' ? 0.3 : 0.13, 10, 8]} />
                <meshToonMaterial color={fruit} />
              </mesh>
            ) : null}
          </group>
        )),
      )}
    </group>
  );
}

export function Farm() {
  const area = areaById('farm');
  const animals = useMemo(
    () =>
      PENS.flatMap((pen) =>
        pen.animals.map((a, i) => ({
          key: `farm-${pen.id}-${i}`,
          a,
          path: enclosurePath({ id: `farm-${pen.id}`, item: a.item, kind: a.kind, names: [], habitat: 'grass', x0: pen.x0, x1: pen.x1, z0: pen.z0, z1: pen.z1, signSide: 'south' }, i, 1.2),
          offset: i * 9.1,
        })),
      ),
    [],
  );
  return (
    <NearArea area={area}>
      <group>
        <Ground x0={area.x0} x1={area.x1} z0={YARD_MIN_Z - 0.5} z1={FRONT_Z} color="#a8d27a" y={0.006} />
        <Ground x0={126} x1={130} z0={-16.8} z1={FRONT_Z} color="#d9c49a" y={0.01} />
        <Ground x0={area.x0 + 0.5} x1={area.x1 - 0.5} z0={-16.6} z1={-14.4} color="#d9c49a" y={0.01} />
        {PENS.map((p) => (
          <Ground key={p.id} x0={p.x0} x1={p.x1} z0={p.z0} z1={p.z1} color={p.ground} y={0.014} />
        ))}
        <Ground x0={112} x1={164} z0={6.5} z1={15.5} color="#9cc96b" y={0.03} />
        <FarmStatic />
        <Sails />
        <Garden />
        {PENS.map((p) => (
          <Sign key={p.id} x={(p.x0 + p.x1) / 2 + 2} z={p.z1 + 0.45} text={p.animals.map((a) => a.item.toUpperCase()).filter((v, i, l) => l.indexOf(v) === i).join(' · ')} color="#7a4a2a" y={1.1} />
        ))}
        <Sign x={124} z={14.9} text="MY GARDEN" color="#7a4a2a" y={1.1} />
        <Sign x={STALL.x} z={STALL.z + 0.9} text="FARM MARKET" color="#c0392b" y={2.9} w={3.2} />
        {animals.map((x) => (
          <Animal key={x.key} id={x.key} kind={x.a.kind} name={x.a.name} word={x.a.item} area="farm" item={x.a.item} path={x.path} offset={x.offset} speed={x.a.kind === 'chicken' ? 0.9 : 0.6} pause={8} />
        ))}
      </group>
    </NearArea>
  );
}
