import { useMemo } from 'react';
import { myFarm } from '@es/shared';
import { preloadLpm, useLpmParts } from '../../LpmModel';
import { Merged, box, fenceRect } from '../kit';
import { Animal } from '../Animal';
import { enclosurePath } from '../../../world/zooLayout';
import { LAND, LAND_HALF, MEADOW } from '../../../world/myFarmLayout';

/**
 * The country around "My farm": road and lane, stone walls, mailbox, pond, wheat fields, the neighbour's houses
 * and meadow, woods and a ring of hills (LPM assets-src/lpm/recipes/farm_land.py, layout world/myFarmLayout.ts LAND).
 * All in one merged mesh, drawn in the farm's local frame; horses and a cow graze in the neighbour's meadow.
 */
preloadLpm('farm_land');
const PART = { hill: 'SM_FL_Hill', pine: 'SM_FL_Pine', oak: 'SM_FL_Oak', pond: 'SM_FL_Pond', wheat: 'SM_FL_Wheat', house: 'SM_FL_House', mailbox: 'SM_FL_Mailbox', wall: 'SM_FL_Wall' } as const;

export function MyFarmLand({ slot }: { slot: number }) {
  const land = useLpmParts('farm_land');
  const f = myFarm(slot);
  const grazers = useMemo(() => {
    const e = { id: `meadow-${slot}`, item: 'horse', kind: 'horse', names: [], habitat: 'grass', x0: f.cx + MEADOW.x0, x1: f.cx + MEADOW.x1, z0: f.cz + MEADOW.z0, z1: f.cz + MEADOW.z1, signSide: 'south' } as Parameters<typeof enclosurePath>[0];
    return (['horse', 'horse', 'cow'] as const).map((kind, i) => ({ kind, path: enclosurePath(e, i, 2), key: `meadow-${slot}-${i}` }));
  }, [slot, f.cx, f.cz]);
  return (
    <>
      <group position={[f.cx, 0, f.cz]}>
        {/* the wide grass, under the farm's own ground */}
        <mesh position={[0, -0.02, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[LAND_HALF * 2, LAND_HALF * 2]} />
          <meshStandardMaterial color="#9fcd72" roughness={1} />
        </mesh>
        <Merged
          deps={[land]}
          castShadow={false}
          build={(p) => {
            // the farm road from the gate to the lane, and the lane
            p.add(box(3, 0.02, 15), '#c9a46b', { p: [0, 0.008, 25.8] });
            p.add(box(LAND_HALF * 2 - 10, 0.02, 3.4), '#c9a46b', { p: [0, 0.009, 34.6] });
            // the neighbour's meadow
            p.add(box(MEADOW.x1 - MEADOW.x0, 0.02, MEADOW.z1 - MEADOW.z0), '#8fc45f', { p: [(MEADOW.x0 + MEADOW.x1) / 2, 0.01, (MEADOW.z0 + MEADOW.z1) / 2] });
            fenceRect(p, MEADOW.x0, MEADOW.x1, MEADOW.z0, MEADOW.z1, '#8a6a44', 1.0);
            for (const l of LAND) {
              const g = land[PART[l.kind]];
              if (g) p.addColored(g, { p: [l.x, 0, l.z], r: [0, l.r, 0], s: [l.s, l.s, l.s] });
            }
          }}
        />
      </group>
      {grazers.map((g, i) => (
        <Animal key={g.key} id={g.key} kind={g.kind} name={g.kind === 'cow' ? 'Buttercup' : i ? 'Star' : 'Ginger'} word={g.kind} area="farm" item={g.kind} path={g.path} offset={i * 11} speed={0.5} pause={10} />
      ))}
    </>
  );
}
