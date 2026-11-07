import { lazy, memo, Suspense, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Horizon } from './Horizon';
import { NightLights } from './NightLights';
import { InteriorLights } from './InteriorLights';
import { Clouds, Rain, SkyController, SkyDome, StreetLamps } from './Sky';
import { GroundClick } from './GroundClick';
import { City } from './City';
import { LocalPlayer, localPos } from './LocalPlayer';
import { RemotePlayers } from './RemotePlayers';
import { Npcs } from './Npcs';
import { TutorialArrow } from './TutorialArrow';

const River = lazy(() => import('./River'));
import { Critters } from './Critters';
import { Cyclists } from './Cyclists';
import { Buses } from './Buses';
import { Wildlife } from './Wildlife';
import { Flora } from './Flora';
import { PerfProbe } from './PerfProbe';
import { Areas } from './areas/Areas';
import { SunFollow } from './SunFollow';
import { useSettings } from '../store/settings';

/** Movement keys: see input/keys.ts (robust against Vietnamese input methods). */

/** Street decoration, hidden on the places far off the map (Sunny Bay, Maple Hill): the instanced trees and flowers
 * have bounding spheres as big as the street, so the frustum alone does not drop them from there. */
function StreetDecor({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = localPos.z > -420;
  });
  return <group ref={ref}>{children}</group>;
}

/** Memoised: HUD state changes in App must never re-render (and re-diff) the whole 3D tree. */
export default memo(function Scene({ playerName }: { playerName: string }) {
  const quality = useSettings((s) => s.quality);
  const low = quality === 'low';
  return (
    <>
      <Canvas
        key={quality} // shadow map settings are fixed at renderer creation
        shadows={low ? false : { type: THREE.PCFShadowMap }}
        camera={{ position: [0, 5.5, 12.5], fov: 50, far: 160 }}
        dpr={low ? 1 : [1, 1.5]}
        gl={{ antialias: !low, powerPreference: low ? 'default' : 'high-performance' }}
      >
        {/* Sky, fog and lights follow the Vietnam clock and the real weather (world/sky.ts); the fog has the
            horizon colour so the fields fade out instead of ending at the camera's far plane. */}
        <SkyController low={low} />
        <SkyDome />
        <SunFollow low={low} />
        <StreetLamps low={low} />
        {!low && <InteriorLights />}
        <Clouds low={low} />
        <Rain low={low} />
        <GroundClick />
        <Suspense fallback={null}>
          <City />
          <Npcs />
          <TutorialArrow />
          <LocalPlayer name={playerName} />
          <RemotePlayers />
        </Suspense>
        {/* Decoration loads after the street itself so the first frame is never held back by flowers. */}
        <Suspense fallback={null}>
          <StreetDecor>
          <Horizon />
          <River />
          <NightLights low={low} />
          <Flora />
          <Critters />
          <Cyclists />
          <Buses />
          <Wildlife low={low} />
          </StreetDecor>
        </Suspense>
        <Suspense fallback={null}>
          <Areas />
        </Suspense>
        <PerfProbe />
      </Canvas>
    </>
  );
});
