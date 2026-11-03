import { Text } from '@react-three/drei';

/** Placeholder low-poly boxes until the Kenney City Kit GLBs are imported (Phase 1). */
const SHOPS: { id: string; label: string; x: number; color: string }[] = [
  { id: 'cafe', label: 'Café', x: -12, color: '#e07a5f' },
  { id: 'mart', label: 'QuickMart', x: -4, color: '#3d9970' },
  { id: 'info', label: 'Info', x: 4, color: '#f2cc8f' },
  { id: 'post', label: 'Post Office', x: 12, color: '#81b29a' },
  { id: 'clinic', label: 'Clinic', x: 20, color: '#f4f1de' },
  { id: 'bank', label: 'Bank', x: 28, color: '#5c6b9c' },
];

export function Shops() {
  return (
    <group>
      {SHOPS.map((s) => (
        <group key={s.id} position={[s.x, 0, -10]}>
          <mesh position={[0, 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[6, 4, 5]} />
            <meshStandardMaterial color={s.color} />
          </mesh>
          <mesh position={[0, 4.6, 0]} castShadow>
            <coneGeometry args={[4.5, 1.6, 4]} />
            <meshStandardMaterial color="#8d5524" />
          </mesh>
          <Text position={[0, 2.2, 2.6]} fontSize={0.6} color="#111" anchorX="center">
            {s.label}
          </Text>
        </group>
      ))}
    </group>
  );
}
