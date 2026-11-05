import { AREAS, areaFrame, type AreaDef } from './areas';
import { registerBlockers } from './layout';

/**
 * Each area has a hanging guide board just inside its gate (right of the path, seen from the street). Walk up to it
 * and press E / tap "Read guide" to open the area's guide (words, phrases, quiz, activity).
 */
export const BOARD_W = 1.8;
/** Board position in the area's local frame (areas.ts areaFrame: origin mid front fence, −z into the yard). */
export function boardLocal(a: AreaDef): { x: number; z: number } {
  const f = areaFrame(a);
  return { x: f.door + a.doorW / 2 + 2.1, z: -1.1 };
}
/** World point in front of the board (on the path side) where the player reads it. */
export function boardReadPoint(a: AreaDef): [number, number] {
  const b = boardLocal(a);
  return areaFrame(a).toWorld(b.x, b.z - 1.0);
}
export const BOARD_READ_RADIUS = 2.2;

// the two posts are solid
registerBlockers(
  AREAS.flatMap((a) => {
    const b = boardLocal(a);
    const f = areaFrame(a);
    return [-1, 1].map((s) => f.rect({ minX: b.x + (s * BOARD_W) / 2 - 0.15, maxX: b.x + (s * BOARD_W) / 2 + 0.15, minZ: b.z - 0.15, maxZ: b.z + 0.15 }));
  }),
);
