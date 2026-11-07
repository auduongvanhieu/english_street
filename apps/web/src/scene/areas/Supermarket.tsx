import { useEffect, useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { CHECKOUTS, SHELVES, SUPERMARKET, type Shelf } from '../../world/buildings';
import { FRONT_Z, areaById } from '../../world/areas';
import { useArea } from '../../store/area';
import { useShopping } from '../../store/shopping';
import { BuildingShell } from './Building';
import { Ground, InstancedProp, Merged, NearArea, box, cyl } from './kit';
import { PRODUCTS_BY_CATEGORY, productShape } from './products';
import { useUsable, type Usable } from '../../world/usables';
import { useT } from '../../i18n';
import { Scanner } from './Trolley';

const CATEGORY_LABEL: Record<string, string> = {
  'fruit-veg': 'FRUIT & VEG',
  bakery: 'BAKERY',
  snacks: 'SNACKS & RICE',
  dairy: 'DAIRY & EGGS',
  drinks: 'DRINKS',
  household: 'HOUSEHOLD',
  'meat-fish': 'MEAT & FISH',
  frozen: 'FROZEN',
};
const SHELF_COLOR: Record<Shelf['type'], string> = { shelf: '#dfe6ea', fridge: '#cfe8f7', stand: '#c98a52' };

/** Slots for each product on a shelf: product i of n gets a stretch of the shelf, both faces, 2 levels. */
function slots(s: Shelf) {
  const ids = PRODUCTS_BY_CATEGORY[s.category] ?? [];
  const len = s.x1 - s.x0;
  const out: { id: string; matrices: THREE.Matrix4[] }[] = [];
  const levels = s.type === 'stand' ? [0.75] : s.type === 'fridge' ? [0.55, 1.05, 1.55] : [0.5, 1.0, 1.5];
  const faces = s.type === 'fridge' ? [1] : [-1, 1];
  ids.forEach((id, i) => {
    const m: THREE.Matrix4[] = [];
    const a = s.x0 + (len * i) / ids.length + 0.35;
    const b = s.x0 + (len * (i + 1)) / ids.length - 0.35;
    for (const face of faces)
      for (const y of levels)
        for (let x = a; x <= b; x += 0.38) m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, s.z + face * (s.type === 'fridge' ? 0.15 : 0.3)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), face > 0 ? 0 : Math.PI), new THREE.Vector3(1.4, 1.4, 1.4)));
    out.push({ id, matrices: m });
  });
  return out;
}

function Shelves() {
  return (
    <Merged
      build={(p) => {
        for (const s of SHELVES) {
          const cx = (s.x0 + s.x1) / 2;
          const w = s.x1 - s.x0;
          if (s.type === 'stand') {
            p.add(box(w, 0.7, 1.1), SHELF_COLOR.stand, { p: [cx, 0.35, s.z] });
            continue;
          }
          const depth = s.type === 'fridge' ? 0.9 : 1.0;
          p.add(box(w, 0.12, depth), SHELF_COLOR[s.type], { p: [cx, 0.06, s.z] });
          p.add(box(w, 2.0, 0.08), s.type === 'fridge' ? '#9cc7e0' : '#b9c4ca', { p: [cx, 1.0, s.type === 'fridge' ? s.z - 0.4 : s.z] });
          for (const y of [0.45, 0.95, 1.45]) p.add(box(w, 0.04, depth), SHELF_COLOR[s.type], { p: [cx, y, s.z] });
          for (const x of [s.x0, s.x1]) p.add(box(0.06, 2.0, depth), '#9aa5ab', { p: [x, 1.0, s.z] });
        }
        for (const c of CHECKOUTS) {
          const cx = (c.minX + c.maxX) / 2;
          p.add(box(c.maxX - c.minX, 0.9, c.maxZ - c.minZ), '#2a9d8f', { p: [cx, 0.45, (c.minZ + c.maxZ) / 2] });
          p.add(box(c.maxX - c.minX - 0.3, 0.04, 0.6), '#333', { p: [cx, 0.92, (c.minZ + c.maxZ) / 2] });
          p.add(box(0.4, 0.3, 0.3), '#444', { p: [c.minX + 0.6, 1.1, (c.minZ + c.maxZ) / 2] }); // till
        }
        // shopping trolleys by the door
        for (const x of [-83, -82.2, -81.4]) {
          p.add(box(0.55, 0.45, 0.8), '#c0c8cc', { p: [x, 0.7, -10] });
          for (const dz of [-0.3, 0.3]) p.add(cyl(0.06, 0.06, 0.05, 8), '#333', { p: [x, 0.08, -10 + dz], r: [0, 0, Math.PI / 2] });
        }
      }}
    />
  );
}

/** Where you stand to take each product: the aisle in front of its stretch of shelf (both faces of a gondola). */
export const PICK_SPOTS = SHELVES.flatMap((s) => {
  const ids = PRODUCTS_BY_CATEGORY[s.category] ?? [];
  const len = s.x1 - s.x0;
  const half = s.type === 'fridge' ? 0.5 : 0.55;
  const faces = s.type === 'fridge' ? [1] : [-1, 1];
  return ids.flatMap((id, i) =>
    faces.map((f) => ({ id, x: s.x0 + (len * (i + 0.5)) / ids.length, z: s.z + f * (half + 0.55), r: Math.max(1.0, Math.min(1.6, len / ids.length / 2)) })),
  );
});
/** Trolley bay by the door and the customer side of each checkout. */
export const TROLLEY_BAY = { x: -82.2, z: -10.9 };
export const TILLS = CHECKOUTS.map((c) => ({ x: (c.minX + c.maxX) / 2, z: c.maxZ + 0.9 }));

function PickSpot({ spot }: { spot: (typeof PICK_SPOTS)[number] }) {
  const t = useT();
  const item = useArea((s) => s.content.supermarket?.items.find((i) => i.id === spot.id));
  const hasList = useShopping((s) => s.list.length > 0);
  const u: Usable = {
    id: `market-pick-${spot.id}-${spot.z}`,
    x: spot.x,
    z: spot.z,
    r: spot.r,
    icon: item?.icon ?? '🛒',
    label: hasList ? `${t('Take')}: ${item?.en ?? spot.id}` : `${t('Look')}: ${item?.en ?? spot.id}`,
    use: () => {
      if (hasList) useShopping.getState().pick(spot.id);
      else useArea.getState().openCard({ area: 'supermarket', item: spot.id });
    },
  };
  useUsable(u);
  return null;
}

function MarketUsables() {
  const t = useT();
  const trolley = useShopping((s) => s.trolley);
  const items = useShopping((s) => Object.keys(s.cart).length);
  useEffect(() => {
    void useArea.getState().load('supermarket');
  }, []);
  useUsable({
    id: 'market-trolley',
    ...TROLLEY_BAY,
    r: 1.6,
    icon: '🛒',
    label: trolley ? t('Return the trolley') : t('Take a trolley'),
    use: () => (trolley ? useShopping.getState().returnTrolley() : useShopping.getState().takeTrolley()),
  });
  useUsable({
    id: 'market-till-0',
    ...TILLS[0]!,
    r: 1.7,
    icon: '💳',
    label: t('Pay at the checkout'),
    priority: true,
    disabled: items ? undefined : t('Your trolley is empty'),
    use: () => useShopping.getState().openTill(),
  });
  useUsable({
    id: 'market-till-1',
    ...TILLS[1]!,
    r: 1.7,
    icon: '💳',
    label: t('Pay at the checkout'),
    priority: true,
    disabled: items ? undefined : t('Your trolley is empty'),
    use: () => useShopping.getState().openTill(),
  });
  return (
    <>
      {PICK_SPOTS.map((sp) => (
        <PickSpot key={`${sp.id}${sp.z}`} spot={sp} />
      ))}
    </>
  );
}

export function Supermarket() {
  const area = areaById('supermarket');
  const openCard = useArea((s) => s.openCard);
  const pick = useShopping((s) => s.pick);
  const products = useMemo(() => SHELVES.flatMap((s) => slots(s)), []);
  return (
    <NearArea area={area}>
      <group>
        <Ground x0={area.x0} x1={area.x1} z0={-29.5} z1={FRONT_Z} color="#b9bec4" y={0.006} />
        <BuildingShell b={SUPERMARKET} name="FreshWay Supermarket">
          <Shelves />
          {products.map((pr) => (
            <InstancedProp
              key={pr.id}
              build={(p) => productShape(p, pr.id)}
              deps={[pr.id]}
              matrices={pr.matrices}
              onClick={() => {
                openCard({ area: 'supermarket', item: pr.id });
                pick(pr.id);
              }}
            />
          ))}
          {SHELVES.map((s) => (
            <group key={s.category} position={[(s.x0 + s.x1) / 2, s.type === 'fridge' ? 2.45 : 2.55, s.z + (s.type === 'fridge' ? 0.1 : 0)]}>
              <mesh>
                <boxGeometry args={[3.4, 0.55, 0.05]} />
                <meshStandardMaterial color="#2a9d8f" />
              </mesh>
              {[1, -1].map((f) => (
                <Text key={f} position={[0, 0, f * 0.035]} rotation-y={f > 0 ? 0 : Math.PI} fontSize={0.3} color="#fff" anchorX="center" anchorY="middle">
                  {CATEGORY_LABEL[s.category]}
                </Text>
              ))}
            </group>
          ))}
          <Text position={[-91, 1.9, -11.7]} fontSize={0.3} color="#2a9d8f" anchorX="center">
            CHECKOUT
          </Text>
          {CHECKOUTS.map((c) => (
            <Scanner key={c.minX} position={[(c.minX + c.maxX) / 2 + 0.6, 0.94, (c.minZ + c.maxZ) / 2]} />
          ))}
          <Text position={[TROLLEY_BAY.x, 1.35, -10.2]} fontSize={0.22} color="#2a9d8f" anchorX="center">
            TROLLEYS
          </Text>
          <MarketUsables />
        </BuildingShell>
      </group>
    </NearArea>
  );
}
