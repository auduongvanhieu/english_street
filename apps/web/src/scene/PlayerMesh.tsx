import { Billboard, Text } from '@react-three/drei';

/** Capsule placeholder until animated GLB characters are added (Phase 1). */
export function PlayerMesh({ name, color, bubble }: { name: string; color: string; bubble?: string }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.35, 1, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* nose to show facing direction */}
      <mesh position={[0, 1.3, 0.35]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <Billboard position={[0, 2.1, 0]}>
        <Text fontSize={0.3} color="#111" anchorX="center" outlineWidth={0.02} outlineColor="#fff">
          {name}
        </Text>
        {bubble ? (
          <Text position={[0, 0.5, 0]} fontSize={0.28} color="#fff" anchorX="center" maxWidth={4}
            outlineWidth={0.03} outlineColor="#1d4ed8">
            {bubble}
          </Text>
        ) : null}
      </Billboard>
    </group>
  );
}
