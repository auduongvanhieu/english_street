import { Billboard, Text } from '@react-three/drei';

export function NameTag({
  name,
  sub,
  bubble,
  y = 2.1,
}: {
  name: string;
  sub?: string;
  bubble?: string;
  y?: number;
}) {
  return (
    <Billboard position={[0, y, 0]}>
      <Text fontSize={0.3} color="#111" anchorX="center" outlineWidth={0.02} outlineColor="#fff">
        {name}
      </Text>
      {sub ? (
        <Text position={[0, -0.3, 0]} fontSize={0.2} color="#444" anchorX="center" outlineWidth={0.015} outlineColor="#fff">
          {sub}
        </Text>
      ) : null}
      {bubble ? (
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.28}
          color="#fff"
          anchorX="center"
          maxWidth={4}
          textAlign="center"
          outlineWidth={0.035}
          outlineColor="#1d4ed8"
        >
          {bubble}
        </Text>
      ) : null}
    </Billboard>
  );
}
