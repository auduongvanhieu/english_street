import { memo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { KeyboardControls } from '@react-three/drei';
import { Horizon } from './Horizon';
import { Clouds, Rain, SkyController, SkyDome, StreetLamps } from './Sky';
import { GroundClick } from './GroundClick';
import { City } from './City';
import { LocalPlayer, type Controls } from './LocalPlayer';
import { RemotePlayers } from './RemotePlayers';
import { Npcs } from './Npcs';
import { Critters } from './Critters';
import { Cyclists } from './Cyclists';
import { Buses } from './Buses';
import { Flora } from './Flora';
import { PerfProbe } from './PerfProbe';
import { Areas } from './areas/Areas';
import { SunFollow } from './SunFollow';
import { useSettings } from '../store/settings';

const KEYMAP: { name: Controls; keys: string[] }[] = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
];

/** Memoised: HUD state changes in App must never re-render (and re-diff) the whole 3D tree. */
export default memo(function Scene({ playerName }: { playerName: string }) {
  const quality = useSettings((s) => s.quality);
  const low = quality === 'low';
  return (
    <KeyboardControls map={KEYMAP}>
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
        <Clouds low={low} />
        <Rain low={low} />
        <GroundClick />
        <Suspense fallback={null}>
          <City />
          <Npcs />
          <LocalPlayer name={playerName} />
          <RemotePlayers />
        </Suspense>
        {/* Decoration loads after the street itself so the first frame is never held back by flowers. */}
        <Suspense fallback={null}>
          <Horizon />
          <Flora />
          <Critters />
          <Cyclists />
          <Buses />
        </Suspense>
        <Suspense fallback={null}>
          <Areas />
        </Suspense>
        <PerfProbe />
      </Canvas>
    </KeyboardControls>
  );
});
