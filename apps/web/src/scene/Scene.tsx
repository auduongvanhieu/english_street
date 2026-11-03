import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { KeyboardControls, Sky } from '@react-three/drei';
import { Ground } from './Ground';
import { City } from './City';
import { LocalPlayer, type Controls } from './LocalPlayer';
import { RemotePlayers } from './RemotePlayers';
import { Npcs } from './Npcs';

const KEYMAP: { name: Controls; keys: string[] }[] = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'back', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
];

export function Scene({ playerName }: { playerName: string }) {
  return (
    <KeyboardControls map={KEYMAP}>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [0, 5.5, 12.5], fov: 50 }} dpr={[1, 1.5]}>
        <Sky sunPosition={[50, 40, 20]} />
        <hemisphereLight args={['#dff3ff', '#6b8f4e', 0.6]} />
        <directionalLight
          position={[30, 40, 20]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <Ground />
        <Suspense fallback={null}>
          <City />
          <Npcs />
          <LocalPlayer name={playerName} />
          <RemotePlayers />
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
