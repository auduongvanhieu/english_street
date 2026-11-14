import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import type { NameTagStyle } from '@es/shared';

/** Premium name tags (bought in the character shop): colour and outline. */
const TAG_STYLE: Record<NameTagStyle, { color: string; outline: string; size: number }> = {
  plain: { color: '#111', outline: '#fff', size: 0.3 },
  gold: { color: '#f5c518', outline: '#6b4a00', size: 0.33 },
  ocean: { color: '#38bdf8', outline: '#0c3a5c', size: 0.33 },
  rainbow: { color: '#ff4d4d', outline: '#2a1a40', size: 0.34 },
  // 💎 gem tags (colour moves, see MOVING)
  diamond: { color: '#dff6ff', outline: '#1e4f86', size: 0.35 },
  fire: { color: '#ff7a1a', outline: '#5a0d00', size: 0.35 },
  galaxy: { color: '#b38cff', outline: '#120a33', size: 0.35 },
};
/** Tags whose colour moves: hue from…to (degrees), speed, saturation, lightness. Rainbow goes all the way round. */
const MOVING: Partial<Record<NameTagStyle, { from: number; to: number; speed: number; s: number; l: number }>> = {
  rainbow: { from: 0, to: 360, speed: 90, s: 90, l: 60 },
  diamond: { from: 185, to: 215, speed: 1.6, s: 90, l: 82 },
  fire: { from: 5, to: 45, speed: 3, s: 100, l: 55 },
  galaxy: { from: 235, to: 300, speed: 1.2, s: 85, l: 68 },
};
function MovingText({ tag, children }: { tag: NameTagStyle; children: string }) {
  const ref = useRef<{ color: string | number } | null>(null);
  const m = MOVING[tag]!;
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const tm = clock.elapsedTime;
    // rainbow: round and round; the others swing between their two hues
    const h = m.to - m.from >= 360 ? (tm * m.speed) % 360 : m.from + ((Math.sin(tm * m.speed) + 1) / 2) * (m.to - m.from);
    ref.current.color = `hsl(${Math.round(h)}, ${m.s}%, ${m.l}%)`;
  });
  const st = TAG_STYLE[tag];
  return (
    <Text ref={ref as never} fontSize={st.size} color={st.color} anchorX="center" outlineWidth={0.025} outlineColor={st.outline}>
      {children}
    </Text>
  );
}

/** Animal labels: English word in blue, the pet's own name in orange. */
const WORD_COLOR = '#1d4ed8';
const NAME_COLOR = '#c2410c';

export function NameTag({
  name,
  word,
  sub,
  bubble,
  badge,
  tag = 'plain',
  y = 2.0,
}: {
  /** premium name tag style */
  tag?: NameTagStyle;
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
      ) : MOVING[tag] ? (
        <MovingText tag={tag}>{name}</MovingText>
      ) : (
        <Text fontSize={TAG_STYLE[tag].size} color={TAG_STYLE[tag].color} anchorX="center" outlineWidth={tag === 'plain' ? 0.02 : 0.025} outlineColor={TAG_STYLE[tag].outline}>
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
