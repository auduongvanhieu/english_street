import { useGame } from '../store/game';
import { localPos } from './LocalPlayer';
import type { Point } from '../world/avoid';

const buf: Point[] = [];
/** Local player (live position) + remote players (last server position): what critters and cyclists steer around. */
export function playerPoints(): Point[] {
  buf.length = 0;
  buf.push({ x: localPos.x, z: localPos.z });
  const s = useGame.getState();
  for (const id in s.players) {
    if (id === s.sessionId) continue;
    const p = s.players[id]!;
    buf.push({ x: p.x, z: p.z });
  }
  return buf;
}
