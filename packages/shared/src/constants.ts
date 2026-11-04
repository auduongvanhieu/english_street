export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Colyseus room name for the main street. */
export const STREET_ROOM = 'street';
/** Max players per street instance before a new one is spawned. */
export const STREET_ROOM_MAX_CLIENTS = 100;
/** Zone (room) names and private codes, validated on both sides. */
export const ZONE_NAME_MIN = 3;
export const ZONE_NAME_MAX = 24;
export const ZONE_CODE_RE = /^[A-Za-z0-9]{4,8}$/;
export const MAIN_ZONE_NAME = 'Main Street';
/** Jump physics (client-simulated, server clamps y to MAX_JUMP_Y). */
export const JUMP_SPEED = 6.2;
export const GRAVITY = 22;
export const MAX_JUMP_Y = 3;
/** Client input send rate (Hz). */
export const INPUT_RATE_HZ = 20;
/** Player walk speed (world units / second). */
export const WALK_SPEED = 3;
/** Distance within which chat bubbles / voice are heard. */
export const PROXIMITY_RADIUS = 8;
/** Walkable world bounds (world units). Street runs along X; shops are north (negative Z). */
/** maxZ reaches the river's grass bank (water starts at z = 18) so you can pick up a duck. */
/**
 * Outer box of everything walkable: the street runs to the end fences at x = ±170 and the themed areas
 * (zoo, farm, supermarket, restaurant) reach north to z = -30. The exact walkable shape (street corridor +
 * area yards) is checked client-side in apps/web/src/world/areas.ts; the server only clamps to this box.
 */
export const WORLD_BOUNDS = { minX: -169.5, maxX: 169.5, minZ: -29.5, maxZ: 17.2 } as const;
/** Distance from an NPC within which the player can start talking. */
export const INTERACT_RADIUS = 2.6;
/** Distance within which a shout (text or voice) is heard. */
export const SHOUT_RADIUS = 24;
/** Minimum time between two shouts from the same player. */
export const SHOUT_COOLDOWN_MS = 5000;
/** A private talk ends automatically when the two players drift further apart than this. */
export const TALK_DROP_RADIUS = PROXIMITY_RADIUS * 2;
