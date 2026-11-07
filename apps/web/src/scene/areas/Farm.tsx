import { FarmJobs } from './AnimalJobs';
import { useMyFarm } from '../../store/myFarm';
import { useUsable } from '../../world/usables';
import { useT } from '../../i18n';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Crop } from '@es/shared';
import { BARN, COOP, FLOWER_GARDEN, GARDEN_PROPS, ORCHARD, PENS, STALL, WINDMILL } from '../../world/farmLayout';
import { FRONT_Z, YARD_MIN_Z, areaById } from '../../world/areas';
import { enclosurePath } from '../../world/zooLayout';
import { Animal } from './Animal';
import { Ground, Merged, NearArea, Sign, box, cyl, fenceRect, sphere, tree } from './kit';
import { Text } from '@react-three/drei';
import { registerBlockers } from '../../world/layout';
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

/** The public flower garden (world/farmLayout.ts FLOWER_GARDEN): paths, beds, flower boxes, bushes, benches. */
preloadLpm('farm_garden');
preloadLpm('zoo_kit');
const GARDEN_PART = { planter: 'SM_FG_Planter', clump: 'SM_FG_Clump', bush: 'SM_FG_Bush', sunflowers: 'SM_FG_Sunflowers' } as const;
function FlowerGarden() {
  const garden = useLpmParts('farm_garden');
  const zoo = useLpmParts('zoo_kit');
  const { x0, x1, z0, z1, cx, cz } = FLOWER_GARDEN;
  return (
    <>
      <Merged
        deps={[garden, zoo]}
        build={(p) => {
          // gravel paths in a cross, stopping at the round bed
          const path = '#d9c49a';
          p.add(box(2, 0.02, cz - 1.5 - z0), path, { p: [cx, 0.035, (z0 + cz - 1.5) / 2] });
          p.add(box(2, 0.02, z1 - cz - 1.5), path, { p: [cx, 0.035, (z1 + cz + 1.5) / 2] });
          p.add(box(cx - 1.5 - x0, 0.02, 1.6), path, { p: [(x0 + cx - 1.5) / 2, 0.036, cz] });
          p.add(box(x1 - cx - 1.5, 0.02, 1.6), path, { p: [(x1 + cx + 1.5) / 2, 0.036, cz] });
          // the round bed: soil with a low stone edge
          p.add(cyl(1.55, 1.55, 0.06, 20), '#c9c2b4', { p: [cx, 0.06, cz] });
          p.add(cyl(1.4, 1.4, 0.1, 20), '#6b4a30', { p: [cx, 0.08, cz] });
          for (const g of GARDEN_PROPS) {
            const geo = g.kind === 'bench' ? zoo.SM_Bench : garden[GARDEN_PART[g.kind]];
            if (geo) p.addColored(geo, { p: [g.x, g.kind === 'sunflowers' || (g.kind === 'clump' && Math.hypot(g.x - cx, g.z - cz) < 1.5) ? 0.12 : 0, g.z], r: [0, g.r, 0], s: [g.s, g.s, g.s] });
          }
        }}
      />
      <Sign x={cx - 2.6} z={z0 + 0.1} text="FLOWER GARDEN" sub="sit down · smell the flowers" color="#2f6b3a" y={1.3} rot={Math.PI} />
    </>
  );
}

/** The plants of one plot as one merged mesh, rebuilt only when the stage or a growth step changes. */
export function Plants({ crop, stage, progress }: { crop: Crop; stage: string; progress: number }) {
  const step = stage === 'growing' ? Math.min(5, Math.floor(progress * 6)) / 5 : 0;
  return <Merged build={(p) => buildPlot(p, crop, stage, step)} deps={[crop, stage, step]} />;
}

/** Floating hint over a plot: a blue water drop (needs watering) or a golden star (ready to harvest). */
export function Marker({ kind, y }: { kind: 'water' | 'ready'; y: number }) {
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

/** The way into "My farm" (your own farm off the map). */
/** The "MY FARM" gate: a wooden arch with a big banner, west of the yard path, turned to face both the path and the farm entrance. */
const MYFARM_GATE = { x: 124.6, z: -11 };
const GATE_ROT = Math.PI / 4;
const gateAt = (lx: number, lz: number) => ({ x: MYFARM_GATE.x + lx * Math.cos(GATE_ROT) + lz * Math.sin(GATE_ROT), z: MYFARM_GATE.z - lx * Math.sin(GATE_ROT) + lz * Math.cos(GATE_ROT) });
registerBlockers([-1, 1].map((s) => gateAt(s * 1.25, 0)).map((p) => ({ minX: p.x - 0.2, maxX: p.x + 0.2, minZ: p.z - 0.2, maxZ: p.z + 0.2 })));

function MyFarmGate() {
  const t = useT();
  useUsable({ id: 'myfarm-enter', ...gateAt(0, 1.2), r: 2.2, icon: '🌾', label: t('Go to my farm'), priority: true, use: () => useMyFarm.getState().enter() });
  const arrow = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const k = clock.elapsedTime;
    if (arrow.current) {
      arrow.current.position.y = 3.75 + Math.sin(k * 3) * 0.15;
      arrow.current.rotation.y = k * 1.5;
    }
    if (ring.current) (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(k * 3) * 0.2;
  });
  return (
    <group position={[MYFARM_GATE.x, 0, MYFARM_GATE.z]} rotation-y={GATE_ROT}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.25, 1.45, 0]}>
          <boxGeometry args={[0.28, 2.9, 0.28]} />
          <meshStandardMaterial color="#7a4a2a" />
        </mesh>
      ))}
      <mesh position={[0, 2.95, 0]}>
        <boxGeometry args={[3.0, 0.2, 0.3]} />
        <meshStandardMaterial color="#7a4a2a" />
      </mesh>
      {/* banner */}
      <mesh position={[0, 2.45, 0.05]}>
        <boxGeometry args={[2.3, 0.75, 0.08]} />
        <meshStandardMaterial color="#f2c41d" emissive="#f2c41d" emissiveIntensity={0.25} />
      </mesh>
      <Text position={[0, 2.53, 0.1]} fontSize={0.42} color="#4a2c14" anchorX="center" anchorY="middle">
        MY FARM
      </Text>
      <Text position={[0, 2.22, 0.1]} fontSize={0.15} color="#4a2c14" anchorX="center" anchorY="middle">
        {'seeds · animals · friends'}
      </Text>
      {/* the closed farm gate between the posts */}
      {[0.35, 0.75, 1.15].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[2.2, 0.12, 0.08]} />
          <meshStandardMaterial color="#c99a5b" />
        </mesh>
      ))}
      <mesh position={[0, 0.75, 0]} rotation-z={Math.atan2(0.8, 2.2)}>
        <boxGeometry args={[2.34, 0.1, 0.07]} />
        <meshStandardMaterial color="#c99a5b" />
      </mesh>
      {/* bobbing arrow over the arch and a glowing ring where you stand */}
      <group ref={arrow} position={[0, 3.75, 0]}>
        <mesh rotation-x={Math.PI}>
          <coneGeometry args={[0.3, 0.55, 4]} />
          <meshStandardMaterial color="#ffd23f" emissive="#ffb000" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <mesh ref={ring} position={[0, 0.04, 1.2]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.75, 1.0, 32]} />
        <meshBasicMaterial color="#ffd23f" transparent opacity={0.5} depthWrite={false} />
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
        <FlowerGarden />
        {PENS.map((p) => (
          <Sign key={p.id} x={(p.x0 + p.x1) / 2 + 2} z={p.z1 + 0.45} text={p.animals.map((a) => a.item.toUpperCase()).filter((v, i, l) => l.indexOf(v) === i).join(' · ')} color="#7a4a2a" y={1.1} />
        ))}
        <MyFarmGate />
        <Sign x={STALL.x} z={STALL.z + 0.9} text="FARM MARKET" color="#c0392b" y={2.9} w={3.2} />
        {animals.map((x) => (
          <Animal key={x.key} id={x.key} kind={x.a.kind} name={x.a.name} word={x.a.item} area="farm" item={x.a.item} path={x.path} offset={x.offset} speed={x.a.kind === 'chicken' ? 0.9 : 0.6} pause={8} />
        ))}
      </group>
    </NearArea>
  );
}
