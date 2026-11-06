import { PIERS } from '@es/shared';
import { registerFloor } from '../areas';
import { registerBlockers, type Aabb } from '../layout';

/**
 * River piers (walkable decks out over the water) and the boat-hire kiosk at the foot of the north hire pier.
 * Boats and the ferry: @es/shared boats.ts; scene: scene/River.tsx; store: store/boats.ts.
 */
for (const p of Object.values(PIERS)) registerFloor({ minX: p.minX + 0.15, maxX: p.maxX - 0.15, minZ: p.minZ, maxZ: p.maxZ });

/** Boat-hire kiosk: beside the north hire pier, serving window towards the pier (+x). */
export const KIOSK = { x: PIERS.boatN.x - 3.4, z: 15.4, rot: Math.PI / 2 };
/** Where you stand to talk to the boat keeper. */
export const KIOSK_SPOT = { x: KIOSK.x + 1.6, z: KIOSK.z };
const k: Aabb = { minX: KIOSK.x - 0.85, maxX: KIOSK.x + 0.85, minZ: KIOSK.z - 1.15, maxZ: KIOSK.z + 1.15 };
registerBlockers([k]);
