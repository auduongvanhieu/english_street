import { Billboard, Text } from '@react-three/drei';

export function NameTag({
  name,
  sub,
  bubble,
  badge,
  y = 2.0,
}: {
  name: string;
  sub?: string;
  bubble?: string;
  /** Status dot next to the name: 'shout' (red) while shouting, 'talk' (green) in a private talk with me, 'busy' (grey) talking to someone else. */
  badge?: 'shout' | 'talk' | 'busy';
  y?: number;
}) {
  // The troika font has no emoji glyphs, so the server's shout marker is turned into styling here.
  const shout = !!bubble && bubble.startsWith('📢');
  const text = shout ? bubble!.slice(2).trim() : bubble;
  return (
    <Billboard position={[0, y, 0]}>
      {badge ? (
        <mesh position={[name.length * 0.09 + 0.25, 0.1, 0]}>
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial color={badge === 'shout' ? '#ef4444' : badge === 'talk' ? '#22c55e' : '#9ca3af'} />
        </mesh>
      ) : null}
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
          position={[0, shout ? 0.6 : 0.5, 0]}
          fontSize={shout ? 0.4 : 0.28}
          color="#fff"
          anchorX="center"
          maxWidth={shout ? 6 : 4}
          textAlign="center"
          outlineWidth={shout ? 0.05 : 0.035}
          outlineColor={shout ? '#b91c1c' : '#1d4ed8'}
        >
          {text}
        </Text>
      ) : null}
    </Billboard>
  );
}
