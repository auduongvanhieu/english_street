import { chibiMaterial } from '../chibi/buildChibi';
import { preloadLpm, useLpmParts } from '../LpmModel';

/** Cinema snacks held in front of the chest (prop "snack:<kind>"), from assets-src/lpm/recipes/cinema_kit.py. */
preloadLpm('cinema_kit');
const MESH: Record<string, string> = { popcorn: 'SM_CN_Popcorn', nachos: 'SM_CN_Nachos', drink: 'SM_CN_Drink', icecream: 'SM_CN_IceCream' };

export function Snack({ kind, sit }: { kind: string; sit?: boolean }) {
  const parts = useLpmParts('cinema_kit');
  const geo = parts[MESH[kind] ?? ''];
  if (!geo) return null;
  return <mesh geometry={geo} material={chibiMaterial()} position={sit ? [0.12, 0.72, 0.28] : [0.12, 0.62, 0.26]} scale={1.5} />;
}
