import { INTERIOR_BOUNDS, MAPLE_HILL, MY_FARMS_AREA, OLD_TOWN, RIVERSIDE, SUNNY_BAY, inRect } from '@es/shared';
import { walkable } from './areas';

/** Where the game puts a player back (the place they left last time, from the API), or null for the usual spawn. */
export function restoreSpot(p: { x?: unknown; z?: unknown; rot?: unknown } | null | undefined): { x: number; z: number; rot: number } | null {
  if (!p || typeof p.x !== 'number' || typeof p.z !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return null;
  const rot = typeof p.rot === 'number' && Number.isFinite(p.rot) ? p.rot : Math.PI;
  const { x, z } = p;
  // someone's own farm: the farm slot is handed out again on entering, so back to the MY FARM gate
  if (inRect(MY_FARMS_AREA, x, z)) return { x: 127.5, z: -11, rot: Math.PI };
  // the places reached by train are outdoors: straight back there
  if ([SUNNY_BAY, MAPLE_HILL, RIVERSIDE, OLD_TOWN].some((r) => inRect(r, x, z))) return { x, z, rot };
  // rooms, the train and the bus need a stay or a ride that is over now: the usual spawn
  if (inRect(INTERIOR_BOUNDS, x, z)) return null;
  // the street: only where you can stand
  return walkable(x, z) ? { x, z, rot } : null;
}
