import { useMemo } from 'react';
import { Part, box, chibiMaterial } from '../chibi/buildChibi';
import { preloadLpm, useLpmParts } from '../LpmModel';

/**
 * The shopping trolley a player pushes in the supermarket (prop "cart:n"): Blender LPM asset
 * assets-src/lpm/recipes/market_kit.py (pivot under the handle, basket forwards along +z, floor at y 0.52),
 * with n little boxes of shopping stacked in the basket.
 */
preloadLpm('market_kit');
const COLORS = ['#e5533d', '#f2c94c', '#7cc45a', '#3b82f6', '#f08a2c', '#ffffff', '#b07cc6', '#d39a52'];

function goods(n: number) {
  const p = new Part();
  for (let i = 0; i < Math.min(n, 24); i++) {
    const layer = Math.floor(i / 12);
    const k = i % 12;
    const col = k % 3;
    const row = Math.floor(k / 3);
    const h = 0.1 + ((i * 37) % 5) * 0.025;
    // heaped: the first layer already peeks over the rim (0.95) so others can see what is in it
    p.add(box(0.13, h, 0.13), COLORS[i % COLORS.length]!, { p: [-0.15 + col * 0.15, 0.82 + layer * 0.16 + h / 2, 0.22 + row * 0.16], r: [0, ((i * 53) % 7) * 0.08, 0] });
  }
  return p.build();
}

export function Trolley({ n }: { n: number }) {
  const parts = useLpmParts('market_kit');
  const load = useMemo(() => (n > 0 ? goods(n) : null), [n]);
  return (
    <group position={[0, 0, 0.3]} scale={0.85}>
      <mesh geometry={parts['SM_MK_Trolley']!} material={chibiMaterial()} castShadow />
      {load ? <mesh geometry={load} material={chibiMaterial()} /> : null}
    </group>
  );
}

/** The till scanner on a checkout belt. */
export function Scanner(props: { position: [number, number, number] }) {
  const parts = useLpmParts('market_kit');
  return <mesh geometry={parts['SM_MK_Scanner']!} material={chibiMaterial()} position={props.position} />;
}
