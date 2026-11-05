import { memo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { KeyboardControls, Sky } from '@react-three/drei';
import { HORIZON_COLOR, Horizon } from './Horizon';
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
        <Sky sunPosition={[50, 40, 20]} />
        {/* Fog in the horizon colour: the fields fade out instead of ending at the camera's far plane. */}
        <fog attach="fog" args={[HORIZON_COLOR, 70, 150]} />
        <hemisphereLight args={['#dff3ff', '#6b8f4e', low ? 0.9 : 0.6]} />
        <SunFollow low={low} />
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
