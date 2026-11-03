import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Sky } from '@react-three/drei';
import { Ground } from './Ground';
import { Shops } from './Shops';
import { LocalPlayer, type Controls } from './LocalPlayer';
import { RemotePlayers } from './RemotePlayers';

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
      <Canvas shadows camera={{ position: [0, 6, 13], fov: 50 }} dpr={[1, 1.5]}>
        <Sky sunPosition={[50, 40, 20]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[30, 40, 20]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <Ground />
        <Shops />
        <LocalPlayer name={playerName} />
        <RemotePlayers />
      </Canvas>
    </KeyboardControls>
  );
}
