import { FarmJobs } from './AnimalJobs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { decodeGarden, plotStage, type Crop } from '@es/shared';
import { useGame } from '../../store/game';
import { BARN, COOP, ORCHARD, PENS, PLOTS, PLOT_SIZE, STALL, WINDMILL } from '../../world/farmLayout';
import { FRONT_Z, YARD_MIN_Z, areaById } from '../../world/areas';
import { enclosurePath } from '../../world/zooLayout';
import { useFarm } from '../../store/farm';
import { useArea } from '../../store/area';
import { Animal } from './Animal';
import { Ground, Merged, NearArea, Sign, box, cyl, fenceRect, sphere, tree } from './kit';
import { buildPlot } from './crops';
import { preloadLpm, useLpmParts } from '../LpmModel';

/** Farm buildings and props: Blender LPM kit assets-src/lpm/recipes/farm_kit.py, merged into the farm's one mesh. */
preloadLpm('farm_kit');

function FarmStatic() {
  const kit = useLpmParts('farm_kit');
  return (
    <Merged
      deps={[kit]}
      build={(p) => {
        for (const pen of PENS) fenceRect(p, pen.x0, pen.x1, pen.z0, pen.z1, '#8a6a44', 1.05);
        // red barn (gambrel roof, cupola), front at BARN.maxZ; the night panes sit on its windows
        const bx = (BARN.minX + BARN.maxX) / 2;
        const bz = (BARN.minZ + BARN.maxZ) / 2;
        const bw = BARN.maxX - BARN.minX;
        p.addColored(kit.SM_Barn!, { p: [bx, 0, bz] });
        p.panes.push({ p: [bx, 3.55, BARN.maxZ + 0.1], w: 1.3, h: 0.85 });
        for (const d of [-1, 1]) p.panes.push({ p: [bx + d * (bw / 2 - 2.2), 2.0, BARN.maxZ + 0.11], w: 1.25, h: 0.85 });
        p.lights.push({ p: [bx + 2.4, 3.0, BARN.maxZ + 0.3], c: '#ffd27a', s: 1.8, tw: 0.05 });
        // round hay bales next to the barn
        for (const [x, z, r] of [[144, -18.2, 0], [145.3, -18.4, 0.3], [144.6, -17.4, -0.2]] as const) p.addColored(kit.SM_HayBale!, { p: [x, 0, z], r: [0, r, 0] });
        // windmill tower (the sails turn in <Sails>)
        p.addColored(kit.SM_WindmillTower!, { p: [WINDMILL.x, 0, WINDMILL.z] });
        // chicken coop on legs, ramp towards the run
        p.addColored(kit.SM_Coop!, { p: [(COOP.minX + COOP.maxX) / 2, 0, (COOP.minZ + COOP.maxZ) / 2] });
        // water troughs
        p.addColored(kit.SM_Trough!, { p: [120, 0, -18.2] });
        p.addColored(kit.SM_Trough!, { p: [117, 0, -9.4], s: [0.67, 1, 0.83] });
        // garden plots (soil beds with a wooden border)
        for (const pl of PLOTS) {
          p.add(box(PLOT_SIZE, 0.12, PLOT_SIZE), '#6b4a30', { p: [pl.x, 0.06, pl.z] });
          for (const [dx, dz, w, d] of [[0, -PLOT_SIZE / 2, PLOT_SIZE + 0.15, 0.1], [0, PLOT_SIZE / 2, PLOT_SIZE + 0.15, 0.1], [-PLOT_SIZE / 2, 0, 0.1, PLOT_SIZE], [PLOT_SIZE / 2, 0, 0.1, PLOT_SIZE]] as const)
            p.add(box(w, 0.2, d), '#a0703c', { p: [pl.x + dx, 0.1, pl.z + dz] });
          // three raised rows of darker, tilled soil
          for (const dz of [-0.7, 0, 0.7]) p.add(cyl(0.2, 0.2, PLOT_SIZE - 0.25, 8, false, 0, Math.PI), '#4f3422', { p: [pl.x, 0.07, pl.z + dz], r: [0, 0, Math.PI / 2], s: [0.4, 1, 1] });
        }
        // apple orchard
        for (const o of ORCHARD) {
          tree(p, o.x, o.z, 1, '#5fae4e');
          // apples hanging on the outside of the crown, each with a tiny stalk
          for (let i = 0; i < 9; i++) {
            const a = i * 2.39996 + o.x;
            const y = -0.45 + (i % 3) * 0.32;
            const ring = Math.sqrt(1 - y * y) * 0.78;
            const ax = o.x + Math.cos(a) * ring;
            const az = o.z + Math.sin(a) * ring;
            p.add(sphere(0.11, 0, Math.PI, 0, Math.PI * 2, 8, 6), i % 4 === 3 ? '#f2b33d' : '#d93a2b', { p: [ax, 1.8 + y * 0.78, az], s: [1, 0.9, 1] });
            p.add(cyl(0.012, 0.012, 0.07, 4), '#5a3b22', { p: [ax, 1.8 + y * 0.78 + 0.11, az] });
          }
        }
        // market stall: counter faces the pavement (-z), so the kit's front (+z) is turned round
        p.addColored(kit.SM_Stall!, { p: [STALL.x, 0, STALL.z], r: [0, Math.PI, 0] });
      }}
    />
  );
}

/** Windmill sails turning slowly. */
function Sails() {
  const kit = useLpmParts('farm_kit');
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => ref.current && (ref.current.rotation.z += dt * 0.6));
  return (
    <group position={[WINDMILL.x, 5.6, WINDMILL.z + 1.0]}>
      <group ref={ref}>
        <Merged deps={[kit]} build={(p) => p.addColored(kit.SM_WindmillSails!)} />
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
            {st.stage === 'seed' ? <Marker kind="water" y={plot?.crop === 'corn' ? 1.0 : 0.9} /> : null}
            {st.stage === 'ready' ? <Marker kind="ready" y={plot?.crop === 'corn' ? 2.3 : plot?.crop === 'tomato' ? 1.5 : 1.15} /> : null}
          </group>
        );
      })}
    </group>
  );
}

/** The plants of one plot as one merged mesh, rebuilt only when the stage or a growth step changes. */
function Plants({ crop, stage, progress }: { crop: Crop; stage: string; progress: number }) {
  const step = stage === 'growing' ? Math.min(5, Math.floor(progress * 6)) / 5 : 0;
  return <Merged build={(p) => buildPlot(p, crop, stage, step)} deps={[crop, stage, step]} />;
}

/** Floating hint over a plot: a blue water drop (needs watering) or a golden star (ready to harvest). */
function Marker({ kind, y }: { kind: 'water' | 'ready'; y: number }) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    if (kind === 'water') {
      const g = new THREE.SphereGeometry(0.14, 14, 10);
      const tip = new THREE.ConeGeometry(0.1, 0.2, 14, 1, true).translate(0, 0.17, 0);
      return mergeGeometries([g.toNonIndexed(), tip.toNonIndexed()], false)!;
    }
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.1 : 0.24;
      if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }).translate(0, 0, -0.03);
  }, [kind]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.position.y = y + Math.sin(t * 2.2) * 0.08;
    g.rotation.y = t * (kind === 'ready' ? 1.6 : 0.8);
  });
  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={kind === 'water' ? '#3d9bff' : '#ffd23f'} emissive={kind === 'water' ? '#1b5fd1' : '#d99a00'} emissiveIntensity={0.55} roughness={0.25} metalness={0.1} transparent={kind === 'water'} opacity={0.9} />
      </mesh>
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
        <FarmJobs />
        <Ground x0={126} x1={130} z0={-16.8} z1={FRONT_Z} color="#d9c49a" y={0.01} />
        <Ground x0={area.x0 + 0.5} x1={area.x1 - 0.5} z0={-16.6} z1={-14.4} color="#d9c49a" y={0.01} />
        {PENS.map((p) => (
          <Ground key={p.id} x0={p.x0} x1={p.x1} z0={p.z0} z1={p.z1} color={p.ground} y={0.014} />
        ))}
        <Ground x0={110} x1={166} z0={6} z1={15.5} color="#9cc96b" y={0.03} />
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
