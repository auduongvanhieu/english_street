import { Suspense, lazy, useRef, type ComponentType, type LazyExoticComponent } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AreaId } from '@es/shared';
import { AREAS, BRIDGE_X, BUS_STOPS, SOUTH_MIN_Z, areaAt, areaById, areaFrame, frontZ, type AreaDef } from '../../world/areas';
// Blockers of every area register when these load: they must not wait for the (lazy) scenes.
import '../../world/zooLayout';
import '../../world/farmLayout';
import '../../world/buildings';
import '../../world/places';
import '../../world/guideBoards';
import { GuideBoard } from './GuideBoard';
import { localPos } from '../LocalPlayer';
import { useArea } from '../../store/area';
import { useGame } from '../../store/game';
import { Merged, NearArea, Sign, box, cyl, sphere } from './kit';
import { LpmModel, preloadLpm } from '../LpmModel';
import { windowMat } from '../nightGlow';

preloadLpm('bus_shelter');
const HotelFloors = lazy(() => import('./places/HotelFloors'));
const TrainRide = lazy(() => import('./places/TrainRide'));
const Clinic = lazy(() => import('./places/Clinic'));
const MyRoom = lazy(() => import('./places/MyRoom'));
const SunnyBay = lazy(() => import('./places/SunnyBay'));
const MapleHill = lazy(() => import('./places/MapleHill'));
const Riverside = lazy(() => import('./places/Riverside'));
const OldTown = lazy(() => import('./places/OldTown'));
/** Both faces of the shelter's advert light box (poster faces at x = 1.245 / 1.115, centre y 1.15, z -0.04). */
const AD_GLOW = mergeGeometries([
  new THREE.PlaneGeometry(0.7, 1.3).rotateY(Math.PI / 2).translate(1.247, 1.15, -0.04),
  new THREE.PlaneGeometry(0.7, 1.3).rotateY(-Math.PI / 2).translate(1.113, 1.15, -0.04),
]);

/** Each area scene is its own chunk, loaded the first time the player comes near (NearArea), dropped when far. */
const named = <K extends string>(p: Promise<Record<K, ComponentType>>, k: K) => p.then((m) => ({ default: m[k] }));
const SCENES: Record<AreaId, LazyExoticComponent<ComponentType>> = {
  zoo: lazy(() => named(import('./Zoo'), 'Zoo')),
  farm: lazy(() => named(import('./Farm'), 'Farm')),
  supermarket: lazy(() => named(import('./Supermarket'), 'Supermarket')),
  restaurant: lazy(() => named(import('./Restaurant'), 'Restaurant')),
  home: lazy(() => import('./places/Home')),
  school: lazy(() => import('./places/School')),
  clothes: lazy(() => import('./places/Clothes')),
  cinema: lazy(() => import('./places/Cinema')),
  station: lazy(() => import('./places/Station')),
  hospital: lazy(() => import('./places/Hospital')),
  hotel: lazy(() => import('./places/Hotel')),
  sports: lazy(() => import('./places/Sports')),
};

const gateLabel = (ids: AreaId[], dir: -1 | 1) => (dir < 0 ? '← ' : '') + ids.map((id) => areaById(id).name).join(' · ') + (dir > 0 ? ' →' : '');

/** Everything of the extended streets: welcome gates, bus stops, area gates, signposts and the areas. */
export function Areas() {
  return (
    <group>
      <AreaWatcher />
      {/* hotel guest floors live off the map (interiors); drawn only while you are up there */}
      <Suspense fallback={null}>
        <HotelFloors />
      </Suspense>
      <Suspense fallback={null}>
        <TrainRide />
      </Suspense>
      <Suspense fallback={null}>
        <Clinic />
      </Suspense>
      <Suspense fallback={null}>
        <MyRoom />
      </Suspense>
      <Suspense fallback={null}>
        <SunnyBay />
      </Suspense>
      <Suspense fallback={null}>
        <MapleHill />
      </Suspense>
      <Suspense fallback={null}>
        <Riverside />
      </Suspense>
      <Suspense fallback={null}>
        <OldTown />
      </Suspense>
      <StreetGate x={-46} label={gateLabel(['supermarket', 'restaurant'], -1)} />
      <StreetGate x={46} label={gateLabel(['zoo', 'farm'], 1)} />
      <StreetGate x={-170} label={gateLabel(['clothes', 'cinema'], -1)} />
      <StreetGate x={170} label={gateLabel(['school', 'home'], 1)} />
      {/* signposts at both ends of each bridge */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Sign x={s * (BRIDGE_X + 1.9)} z={15.6} text="Bridge → South Bank" sub={s < 0 ? `${areaById('station').name} · ${areaById('hotel').name}` : `${areaById('sports').name} · ${areaById('hospital').name}`} color="#2f6b8a" />
          <Sign x={s * (BRIDGE_X + 1.9)} z={SOUTH_MIN_Z + 1.4} rot={Math.PI} text="Bridge → Main Street" color="#2f6b8a" />
        </group>
      ))}
      {AREAS.map((a) => (
        <AreaGate key={a.id} a={a} />
      ))}
      {AREAS.map((a) => (
        <NearArea key={a.id} area={a}>
          <GuideBoard a={a} />
        </NearArea>
      ))}
      {BUS_STOPS.map((s) => (
        <BusStop key={s.id} x={s.x} z={s.z} />
      ))}
      {AREAS.map((a) => {
        const Scene = SCENES[a.id];
        return (
          <NearArea key={a.id} area={a}>
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </NearArea>
        );
      })}
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
  const f = areaFrame(a);
  // fence ends relative to the door, in the gate's own (possibly turned) frame
  const left = -f.half - f.door;
  const right = f.half - f.door;
  return (
    <group position={[a.doorX, 0, frontZ(a)]} rotation-y={f.rot}>
      <Merged
        build={(p) => {
          for (const sx of [-1, 1]) p.add(box(0.4, 6.2, 0.4), a.color, { p: [(sx * w) / 2, 3.1, 0] });
          p.add(box(w + 0.8, 0.8, 0.3), a.color, { p: [0, 5.9, 0] });
          // front fence of the yard (gap in the middle)
          const half = a.doorW / 2;
          for (const [x0, x1] of [
            [left, -half],
            [half, right],
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
    // turned so the open side and the sign face the road (−z); the bench is a seat (world/seats.ts)
    <group
      position={[x + 3, 0, z]}
      rotation-y={Math.PI}
      onClick={(e) => {
        e.stopPropagation();
        open('bus');
      }}
    >
      {/* Blender LPM asset: assets-src/lpm/recipes/bus_shelter.py (bench seat 0.5 m, sign disc at (1.85, 2.55, 0.5)) */}
      <LpmModel slug="bus_shelter" />
      {/* the advert light box glows at night */}
      <mesh geometry={AD_GLOW} material={windowMat} renderOrder={2} />
      {[0.54, 0.46].map((tz, i) => (
        <Text key={tz} position={[1.85, 2.55, tz]} rotation-y={i ? Math.PI : 0} fontSize={0.3} color="#fff" anchorX="center" anchorY="middle">
          BUS
        </Text>
      ))}
    </group>
  );
}
