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
