import { Text } from '@react-three/drei';
import { BAR, RESTAURANT, TABLES, TABLE_R } from '../../world/buildings';
import { FRONT_Z, areaById } from '../../world/areas';
import { BuildingShell } from './Building';
import { Ground, Merged, NearArea, box, cyl, sphere, tree } from './kit';

/** Tables with chairs, a bar with an open kitchen, plants and hanging lamps. */
function Interior() {
  return (
    <Merged
      build={(p) => {
        for (const t of TABLES) {
          p.add(box(TABLE_R * 2, 0.06, 0.9), '#ffffff', { p: [t.x, 0.76, t.z] }); // tablecloth
          p.add(box(TABLE_R * 2 + 0.05, 0.22, 0.95), '#f4f0e8', { p: [t.x, 0.64, t.z] });
          p.add(cyl(0.06, 0.08, 0.7, 8), '#6b4e33', { p: [t.x, 0.35, t.z] });
          p.add(cyl(0.04, 0.05, 0.14, 8), '#e0b84f', { p: [t.x, 0.86, t.z] }); // candle holder
          p.add(sphere(0.035), '#ffd36b', { p: [t.x, 0.96, t.z] });
          for (const s of t.seats) {
            const back = s.rot === 0 ? -1 : 1; // chair back away from the table
            p.add(box(0.5, 0.06, 0.5), '#a0522d', { p: [s.x, 0.45, s.z] });
            p.add(box(0.5, 0.6, 0.06), '#8b4513', { p: [s.x, 0.75, s.z + back * 0.24] });
            for (const dx of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) p.add(box(0.05, 0.45, 0.05), '#6b3a1a', { p: [s.x + dx, 0.22, s.z + dz] });
          }
        }
        // bar counter with stools, shelves of bottles and the open kitchen behind
        const bx = (BAR.minX + BAR.maxX) / 2;
        p.add(box(BAR.maxX - BAR.minX, 1.05, BAR.maxZ - BAR.minZ), '#6b3a1a', { p: [bx, 0.52, (BAR.minZ + BAR.maxZ) / 2] });
        p.add(box(BAR.maxX - BAR.minX + 0.2, 0.06, BAR.maxZ - BAR.minZ + 0.2), '#2b2b2b', { p: [bx, 1.07, (BAR.minZ + BAR.maxZ) / 2] });
        for (let x = BAR.minX + 1; x < BAR.maxX; x += 1.6) for (let k = 0; k < 2; k++) p.add(cyl(0.05, 0.05, 0.25, 8), ['#2f7d4f', '#8a2b2b', '#c9a227'][Math.abs(Math.floor(x + k)) % 3]!, { p: [x + k * 0.3, 1.88, -28.0] });
        p.add(box(BAR.maxX - BAR.minX, 0.05, 0.4), '#8b5a2b', { p: [bx, 1.75, -28.05] });
        // stove + pots in the kitchen
        p.add(box(4, 0.9, 0.8), '#b0b8bf', { p: [-144, 0.45, -27.7] });
        for (const x of [-145.2, -143.8]) p.add(cyl(0.28, 0.25, 0.3, 12), '#555b61', { p: [x, 1.05, -27.7] });
        // plants in the corners and by the door
        for (const [x, z] of [[-158.6, -27], [-117.4, -27], [-158.6, -10.4], [-117.4, -10.4], [-140.6, -10.2], [-135.4, -10.2]] as const) {
          p.add(cyl(0.3, 0.22, 0.5, 10), '#b5452f', { p: [x, 0.25, z] });
          p.add(sphere(0.45, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#4f9a44', { p: [x, 0.85, z] });
        }
        // hanging lamps over the tables
        for (const t of TABLES) {
          p.add(cyl(0.01, 0.01, 1.0, 4), '#333', { p: [t.x, 2.7, t.z] });
          p.add(cyl(0.08, 0.28, 0.22, 12), '#f2c94c', { p: [t.x, 2.1, t.z] });
        }
        // terrace outside: two tables under parasols
        for (const x of [-150, -126]) {
          p.add(cyl(0.5, 0.5, 0.05, 14), '#ffffff', { p: [x, 0.75, -7.3] });
          p.add(cyl(0.04, 0.04, 2.4, 6), '#777', { p: [x, 1.2, -7.3] });
          p.add(cyl(0.05, 1.3, 0.5, 12), '#e05f5f', { p: [x, 2.45, -7.3] });
        }
      }}
    />
  );
}

export function Restaurant() {
  const area = areaById('restaurant');
  return (
    <NearArea area={area}>
      <group>
        <Ground x0={area.x0} x1={area.x1} z0={-29.5} z1={FRONT_Z} color="#a7cf7a" y={0.006} />
        <Ground x0={RESTAURANT.doorX - 2} x1={RESTAURANT.doorX + 2} z0={RESTAURANT.z1} z1={FRONT_Z} color="#d9c4a0" y={0.012} />
        <Merged build={(p) => [[-163, -26], [-113, -26], [-163, -12], [-113, -12]].forEach(([x, z]) => tree(p, x!, z!, 1))} />
        <BuildingShell b={RESTAURANT} name="The Grand Garden Restaurant">
          <Interior />
          <Text position={[(BAR.minX + BAR.maxX) / 2, 2.55, -28.2]} fontSize={0.45} color="#b5452f" anchorX="center">
            KITCHEN
          </Text>
        </BuildingShell>
      </group>
    </NearArea>
  );
}
