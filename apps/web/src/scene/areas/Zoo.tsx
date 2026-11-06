import { useMemo } from 'react';
import type * as THREE from 'three';
import { ENCLOSURES, HUT, PETTING, PETTING_FEEDER, PETTING_HUTCH, enclosurePath, type Enclosure, type Habitat } from '../../world/zooLayout';
import { FRONT_Z, YARD_MIN_Z, areaById } from '../../world/areas';
import { Animal } from './Animal';
import { Ground, Merged, NearArea, Sign, fenceRect, tree, box, cyl, sphere, type Part } from './kit';
import { preloadLpm, useLpmParts } from '../LpmModel';

/** Hut, bench, rocks, cave, feeder, hutch: Blender LPM kit assets-src/lpm/recipes/zoo_kit.py (merged into the zoo mesh). */
preloadLpm('zoo_kit');
type Kit = Record<string, THREE.BufferGeometry>;
/** A faceted boulder cluster, tinted per habitat (s = size, the rotation varies with the position). */
const rock = (p: Part, kit: Kit, x: number, z: number, s = 1, color = '#9a9a92') => p.addColored(kit.SM_Rock!, { p: [x, 0, z], s, r: [0, (x * 1.7 + z) % (Math.PI * 2), 0] }, color);

const HABITAT_GROUND: Record<Habitat, string> = {
  savanna: '#d9c27a',
  grass: '#7fbf5a',
  water: '#cfe8f2',
  bamboo: '#8fc76a',
  rocks: '#b8ad94',
  pond: '#9ccf6e',
};

/** Habitat dressing inside one enclosure: trees, rocks, pools, bamboo. */
function dress(p: Part, e: Enclosure, kit: Kit) {
  const cx = (e.x0 + e.x1) / 2;
  const cz = (e.z0 + e.z1) / 2;
  const back = e.z0 + 1;
  switch (e.habitat) {
    case 'savanna':
      tree(p, e.x0 + 1.2, back + 0.3, 1.1, '#8fb34a');
      rock(p, kit, e.x1 - 1.5, back + 0.6, 1.1, '#c9a978');
      break;
    case 'grass':
      tree(p, e.x0 + 1.2, back + 0.4, 1.2);
      tree(p, e.x1 - 1.3, back + 0.2, 0.9, '#4f9a44');
      if (e.kind === 'monkey') {
        // climbing frame
        for (const dx of [-1.2, 1.2]) p.add(cyl(0.08, 0.08, 2.6, 8), '#8a6a44', { p: [cx + dx, 1.3, cz - 1] });
        p.add(cyl(0.07, 0.07, 2.6, 8), '#8a6a44', { p: [cx, 2.5, cz - 1], r: [0, 0, Math.PI / 2] });
        p.add(box(1.4, 0.08, 0.05), '#b0743c', { p: [cx, 1.4, cz - 1] });
      }
      break;
    case 'water':
      // pool with an ice-white rim
      p.add(cyl(2.2, 2.2, 0.05, 24), '#5ab0dc', { p: [cx, 0.035, cz - 0.5] });
      p.add(cyl(2.35, 2.35, 0.04, 24), '#ffffff', { p: [cx, 0.02, cz - 0.5] });
      rock(p, kit, e.x1 - 1, back + 0.5, 0.8, '#eef5f8');
      break;
    case 'bamboo':
      for (let i = 0; i < 9; i++) {
        const x = e.x0 + 0.6 + (i % 3) * 0.35 + (i > 4 ? e.x1 - e.x0 - 2 : 0);
        const z = back + Math.floor(i / 3) * 0.4;
        p.add(cyl(0.06, 0.06, 2.6, 6), '#6fae3c', { p: [x, 1.3, z] });
        p.add(sphere(0.25, 0, Math.PI, 0, Math.PI * 2, 6, 4), '#4f9a44', { p: [x + 0.15, 2.4, z], s: [1.5, 0.5, 0.8] });
      }
      break;
    case 'rocks':
      rock(p, kit, e.x0 + 1.4, back + 0.6, 1.6);
      rock(p, kit, e.x1 - 1.6, back + 0.8, 1.3);
      p.addColored(kit.SM_Cave!, { p: [cx, 0, back + 0.6] }, '#8a8478'); // cave, mouth facing the visitors
      break;
    case 'pond':
      p.add(cyl(2.3, 2.3, 0.05, 24), '#4a9ac4', { p: [cx, 0.035, cz], s: [1.1, 1, 0.75] });
      for (const dx of [-1, 1]) p.add(cyl(0.05, 0.05, 0.9, 6), '#6f8f3a', { p: [cx + dx * 2.2, 0.45, cz - 1.3] });
      break;
  }
}

function ZooStatic() {
  const kit = useLpmParts('zoo_kit');
  return (
    <Merged
      deps={[kit]}
      build={(p) => {
        for (const e of ENCLOSURES) {
          fenceRect(p, e.x0, e.x1, e.z0, e.z1, e.habitat === 'water' ? '#d8dde2' : '#8a6a44', 1.05);
          dress(p, e, kit);
        }
        // zookeeper hut
        const hx = (HUT.minX + HUT.maxX) / 2;
        const hz = (HUT.minZ + HUT.maxZ) / 2;
        p.addColored(kit.SM_ZooHut!, { p: [hx, 0, hz] });
        for (const d of [-1, 1]) p.panes.push({ p: [hx + d * 1.3, 1.4, HUT.maxZ + 0.07], w: 0.85, h: 0.65 });
        p.lights.push({ p: [hx + 0.75, 2.0, HUT.maxZ + 0.25], c: '#ffd27a', s: 1.5, tw: 0.05 });
        // benches + bins along the middle walkway
        for (const x of [62, 94]) p.addColored(kit.SM_Bench!, { p: [x, 0, -17.8] });
        // petting corner across the road: low white fence with a gate, hay feeder, guinea-pig hutch, straw bales
        const P = PETTING;
        fenceRect(p, P.x0, P.x1, P.z0, P.z1, '#f4efe4', 0.75, [], [[P.gateX - P.gateW / 2, P.gateX + P.gateW / 2]]);
        p.addColored(kit.SM_Feeder!, { p: [PETTING_FEEDER.x, 0, PETTING_FEEDER.z] });
        const H = PETTING_HUTCH;
        const px = (H.minX + H.maxX) / 2;
        const hz2 = (H.minZ + H.maxZ) / 2;
        p.addColored(kit.SM_Hutch!, { p: [px, 0, hz2], r: [0, Math.PI, 0] }); // opening on its -z side, like before
        for (const [x, z] of [[98.6, 8.4], [85.6, 8.2]] as const) p.add(cyl(0.45, 0.45, 0.6, 10), '#e8c860', { p: [x, 0.3, z], r: [0, 0, Math.PI / 2] });
        tree(p, 101.5, 15.6, 0.8);
        // trees in the corners of the yard
        for (const [x, z] of [[52, -28.5], [104, -28.5], [52, -7.6], [104, -7.6]] as const) tree(p, x, z, 0.9);
      }}
    />
  );
}

export function Zoo() {
  const area = areaById('zoo');
  const animals = useMemo(
    () =>
      ENCLOSURES.flatMap((e) =>
        e.names.map((name, i) => ({ key: `${e.id}-${i}`, e, name, path: enclosurePath(e, i, e.kind === 'elephant' || e.kind === 'giraffe' ? 2 : 1.3), offset: i * 7.3 })),
      ),
    [],
  );
  return (
    <NearArea area={area}>
      <group>
        <Ground x0={area.x0} x1={area.x1} z0={YARD_MIN_Z - 0.5} z1={FRONT_Z} color="#9dcf72" y={0.006} />
        {/* walkways */}
        <Ground x0={area.x0 + 0.5} x1={area.x1 - 0.5} z0={-9.3} z1={FRONT_Z} color="#e6d6b0" y={0.01} />
        <Ground x0={area.x0 + 0.5} x1={area.x1 - 0.5} z0={-19.3} z1={-16.2} color="#e6d6b0" y={0.01} />
        <Ground x0={75.2} x1={80.8} z0={-19.3} z1={-9.3} color="#e6d6b0" y={0.01} />
        <Ground x0={area.x0 + 0.5} x1={area.x1 - 0.5} z0={YARD_MIN_Z} z1={-27.2} color="#e6d6b0" y={0.01} />
        {ENCLOSURES.map((e) => (
          <Ground key={e.id} x0={e.x0} x1={e.x1} z0={e.z0} z1={e.z1} color={HABITAT_GROUND[e.habitat]} y={0.016} />
        ))}
        <ZooStatic />
        {ENCLOSURES.map((e) => (
          <Sign key={e.id} x={(e.x0 + e.x1) / 2 + 2.2} z={e.z1 + 0.45} text={e.item.toUpperCase()} sub={e.names.join(' · ')} color="#2f6b3a" y={1.1} />
        ))}
        <Sign x={78} z={(HUT.maxZ) + 0.6} text="ZOOKEEPER" color="#b5552f" y={1.6} w={2.6} />
        <Ground x0={PETTING.x0} x1={PETTING.x1} z0={PETTING.z0} z1={PETTING.z1} color="#c9dc8a" y={0.02} />
        <Sign x={PETTING.gateX + 4} z={PETTING.z0 + 0.35} text="PETTING CORNER" sub="Be gentle!" color="#c2185b" y={1.2} />
        {animals.map((a) => (
          <Animal key={a.key} id={a.key} kind={a.e.kind} name={a.name} word={a.e.item} area="zoo" item={a.e.item} path={a.path} offset={a.offset} speed={a.e.kind === 'crocodile' ? 0.35 : 0.7} pause={a.e.kind === 'crocodile' ? 20 : 7} pen={a.e.kind === 'lion' || a.e.kind === 'tiger' ? a.e : undefined} />
        ))}
      </group>
    </NearArea>
  );
}
