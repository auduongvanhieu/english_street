import { Billboard, Text } from '@react-three/drei';

/** Animal labels: English word in blue, the pet's own name in orange. */
const WORD_COLOR = '#1d4ed8';
const NAME_COLOR = '#c2410c';

export function NameTag({
  name,
  word,
  sub,
  bubble,
  badge,
  y = 2.0,
}: {
  name: string;
  /** Animals: the English word, drawn in its own colour before the name ("dog · Luna"). */
  word?: string;
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
      {word ? (
        <>
          <Text position={[-0.1, 0, 0]} fontSize={0.3} color={WORD_COLOR} anchorX="right" outlineWidth={0.02} outlineColor="#fff">
            {word}
          </Text>
          <Text fontSize={0.3} color="#888" anchorX="center" outlineWidth={0.02} outlineColor="#fff">
            ·
          </Text>
          <Text position={[0.1, 0, 0]} fontSize={0.3} color={NAME_COLOR} anchorX="left" outlineWidth={0.02} outlineColor="#fff">
            {name}
          </Text>
        </>
      ) : (
        <Text fontSize={0.3} color="#111" anchorX="center" outlineWidth={0.02} outlineColor="#fff">
          {name}
        </Text>
      )}
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
