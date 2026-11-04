import { useMemo } from 'react';
import { ENCLOSURES, HUT, enclosurePath, type Enclosure, type Habitat } from '../../world/zooLayout';
import { FRONT_Z, YARD_MIN_Z, areaById } from '../../world/areas';
import { Animal } from './Animal';
import { Ground, Merged, NearArea, Sign, fenceRect, rock, tree, box, cyl, sphere, type Part } from './kit';

const HABITAT_GROUND: Record<Habitat, string> = {
  savanna: '#d9c27a',
  grass: '#7fbf5a',
  water: '#cfe8f2',
  bamboo: '#8fc76a',
  rocks: '#b8ad94',
  pond: '#9ccf6e',
};

/** Habitat dressing inside one enclosure: trees, rocks, pools, bamboo. */
function dress(p: Part, e: Enclosure) {
  const cx = (e.x0 + e.x1) / 2;
  const cz = (e.z0 + e.z1) / 2;
  const back = e.z0 + 1;
  switch (e.habitat) {
    case 'savanna':
      tree(p, e.x0 + 1.2, back + 0.3, 1.1, '#8fb34a');
      rock(p, e.x1 - 1.5, back + 0.6, 1.1, '#c9a978');
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
      rock(p, e.x1 - 1, back + 0.5, 0.8, '#eef5f8');
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
      rock(p, e.x0 + 1.4, back + 0.6, 1.6);
      rock(p, e.x1 - 1.6, back + 0.8, 1.3);
      p.add(sphere(1.2, 0, Math.PI / 2, 0, Math.PI * 2, 12, 6), '#6f6a60', { p: [cx, 0, back + 0.5], s: [1.2, 1, 0.8] }); // cave
      p.add(sphere(0.6, 0, Math.PI / 2, 0, Math.PI * 2, 10, 5), '#2a2622', { p: [cx, 0, back + 1.25], s: [1, 1, 0.3] });
      break;
    case 'pond':
      p.add(cyl(2.3, 2.3, 0.05, 24), '#4a9ac4', { p: [cx, 0.035, cz], s: [1.1, 1, 0.75] });
      for (const dx of [-1, 1]) p.add(cyl(0.05, 0.05, 0.9, 6), '#6f8f3a', { p: [cx + dx * 2.2, 0.45, cz - 1.3] });
      break;
  }
}

function ZooStatic() {
  return (
    <Merged
      build={(p) => {
        for (const e of ENCLOSURES) {
          fenceRect(p, e.x0, e.x1, e.z0, e.z1, e.habitat === 'water' ? '#d8dde2' : '#8a6a44', 1.05);
          dress(p, e);
        }
        // zookeeper hut
        const hx = (HUT.minX + HUT.maxX) / 2;
        const hz = (HUT.minZ + HUT.maxZ) / 2;
        p.add(box(HUT.maxX - HUT.minX, 2.4, HUT.maxZ - HUT.minZ), '#e9d3a8', { p: [hx, 1.2, hz] });
        p.add(box(HUT.maxX - HUT.minX + 0.6, 0.25, HUT.maxZ - HUT.minZ + 0.6), '#b5552f', { p: [hx, 2.5, hz] });
        p.add(box(1, 1.7, 0.06), '#7a5536', { p: [hx, 0.85, HUT.maxZ + 0.02] });
        // benches + bins along the middle walkway
        for (const x of [62, 94]) {
          p.add(box(1.8, 0.1, 0.5), '#a0703c', { p: [x, 0.45, -17.8] });
          for (const dx of [-0.75, 0.75]) p.add(box(0.1, 0.45, 0.45), '#555', { p: [x + dx, 0.22, -17.8] });
        }
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
        {animals.map((a) => (
          <Animal key={a.key} id={a.key} kind={a.e.kind} name={a.name} word={a.e.item} area="zoo" item={a.e.item} path={a.path} offset={a.offset} speed={a.e.kind === 'crocodile' ? 0.35 : 0.7} pause={a.e.kind === 'crocodile' ? 20 : 7} />
        ))}
      </group>
    </NearArea>
  );
}
