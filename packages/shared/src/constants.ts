export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** Colyseus room name for the main street. */
export const STREET_ROOM = 'street';
/** Max players per street instance before a new one is spawned. */
export const STREET_ROOM_MAX_CLIENTS = 50;
/** Client input send rate (Hz). */
export const INPUT_RATE_HZ = 20;
/** Player walk speed (world units / second). */
export const WALK_SPEED = 3;
/** Distance within which chat bubbles / voice are heard. */
export const PROXIMITY_RADIUS = 8;
/** Walkable world bounds (world units). Street runs along X; shops are north (negative Z). */
export const WORLD_BOUNDS = { minX: -41, maxX: 41, minZ: -5.5, maxZ: 13.5 } as const;
/** Distance from an NPC within which the player can start talking. */
export const INTERACT_RADIUS = 2.6;
/** Distance within which a shout (text or voice) is heard. */
export const SHOUT_RADIUS = 24;
/** Minimum time between two shouts from the same player. */
export const SHOUT_COOLDOWN_MS = 5000;
/** A private talk ends automatically when the two players drift further apart than this. */
export const TALK_DROP_RADIUS = PROXIMITY_RADIUS * 2;
