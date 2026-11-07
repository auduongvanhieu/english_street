/**
 * River boats: rowing boats and duck pedalos you hire at the north pier (x = −30), and the ferry that crosses on a
 * timetable between the north ferry pier (x = 26) and the south one (x = 6). World coordinates; the river runs
 * along x between z 18 (north bank) and z 38 (south bank), water surface at y −0.3.
 *
 * Hired boats are synced by the game server (the driver steers, the server checks the moves); the ferry needs no
 * server state: every client computes its position from the shared clock (ferryPose).
 */
export const RIVER_Z = { north: 18, south: 38 } as const;
export const WATER_Y = -0.3;
/** Where hired boats may go: between the two footbridges (x = ±50), clear of both banks. */
export const BOAT_AREA = { minX: -47.5, maxX: 47.5, minZ: 19.0, maxZ: 37.0 } as const;
export const BOAT_MAX_SPEED = 2.6;

export interface Pier {
  id: string;
  x: number;
  /** walkable deck rectangle */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** tip of the pier (the water end), and which way the water is (+1 = +z) */
  tipZ: number;
  out: 1 | -1;
}
const pier = (id: string, x: number, bankZ: number, len: number, out: 1 | -1): Pier => {
  const tipZ = bankZ + out * len;
  return { id, x, minX: x - 1.2, maxX: x + 1.2, minZ: Math.min(bankZ, tipZ), maxZ: Math.max(bankZ, tipZ), tipZ, out };
};
/** Boat-hire piers (north 17 → 22, south 39.5 → 34.5) and the ferry piers (3.8 m into the water). */
export const PIERS = {
  boatN: pier('boatN', -30, 17, 5, 1),
  boatS: pier('boatS', -30, 39.5, 5, -1),
  ferryN: pier('ferryN', 26, 17, 4, 1),
  ferryS: pier('ferryS', 6, 39.5, 4, -1),
} as const;

export type BoatKind = 'row' | 'duck';
export type BoatSeat = 'driver' | 'passenger';
/** The hire fleet and where each boat is moored (alongside a hire pier, bow to the water). */
export const BOAT_FLEET: { id: string; kind: BoatKind; home: { x: number; z: number; rot: number } }[] = [
  { id: 'row1', kind: 'row', home: { x: -32.2, z: 20.2, rot: 0 } },
  { id: 'duck1', kind: 'duck', home: { x: -27.7, z: 20.4, rot: 0 } },
  { id: 'row2', kind: 'row', home: { x: -32.2, z: 35.8, rot: Math.PI } },
  { id: 'duck2', kind: 'duck', home: { x: -27.7, z: 35.6, rot: Math.PI } },
];
/** Seats in the boat's own frame (x across, z forward), and the seat height above the waterline. */
export const BOAT_SEATS: Record<BoatKind, Record<BoatSeat, { x: number; z: number; y: number }>> = {
  row: { driver: { x: 0, z: 0.1, y: 0.24 }, passenger: { x: 0, z: -0.85, y: 0.24 } },
  duck: { driver: { x: -0.32, z: -0.15, y: 0.31 }, passenger: { x: 0.32, z: -0.15, y: 0.31 } },
};
/** Hiring: coins per hire and how long it lasts (the first hire is free). */
export const BOAT_HIRE = { coins: 3, minutes: 10 } as const;
/** A taxi: straight to an area, no waiting for the bus (premium, coins). */
export const TAXI_PRICE = 5;

export type BoatSend = { op: 'board'; id: string; seat: BoatSeat } | { op: 'move'; x: number; z: number; rot: number } | { op: 'leave' };
export type BoatEvent = { op: 'denied'; reason: 'taken' | 'far' | 'busy' };

// ---- ferry ---------------------------------------------------------------------------------------------------
/** Timetable (seconds in a 110 s cycle): at the north pier 0–30, crossing 30–55, at the south pier 55–85, back 85–110. */
export const FERRY = { cycle: 110, dockN: 30, cross: 25, dockS: 30, deckY: 0.47, half: 4.2 } as const;
const P0 = { x: PIERS.ferryN.x, z: PIERS.ferryN.tipZ + FERRY.half + 0.1 };
const P3 = { x: PIERS.ferryS.x, z: PIERS.ferryS.tipZ - FERRY.half - 0.1 };
const P1 = { x: P0.x, z: P0.z + 4 };
const P2 = { x: P3.x, z: P3.z - 4 };
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};
const ease = (t: number) => t * t * (3 - 2 * t);
export type FerryStage = 'north' | 'toSouth' | 'south' | 'toNorth';
/** The ferry at a moment (ms on the shared clock): position, heading, stage and seconds until it leaves the pier. */
export function ferryPose(nowMs: number): { x: number; z: number; rot: number; stage: FerryStage; leavesIn: number } {
  const c = FERRY;
  const s = (((nowMs / 1000) % c.cycle) + c.cycle) % c.cycle;
  const at = (t: number) => {
    const x = bez(P0.x, P1.x, P2.x, P3.x, t);
    const z = bez(P0.z, P1.z, P2.z, P3.z, t);
    const dx = bez(P0.x, P1.x, P2.x, P3.x, Math.min(1, t + 0.01)) - bez(P0.x, P1.x, P2.x, P3.x, Math.max(0, t - 0.01));
    const dz = bez(P0.z, P1.z, P2.z, P3.z, Math.min(1, t + 0.01)) - bez(P0.z, P1.z, P2.z, P3.z, Math.max(0, t - 0.01));
    return { x, z, rot: Math.atan2(dx, dz) };
  };
  if (s < c.dockN) return { ...at(0), stage: 'north', leavesIn: c.dockN - s };
  if (s < c.dockN + c.cross) return { ...at(ease((s - c.dockN) / c.cross)), stage: 'toSouth', leavesIn: 0 };
  if (s < c.dockN + c.cross + c.dockS) return { ...at(1), stage: 'south', leavesIn: c.dockN + c.cross + c.dockS - s };
  // back again: a double-ended ferry, it runs the same path in reverse without turning round
  return { ...at(1 - ease((s - c.dockN - c.cross - c.dockS) / c.cross)), stage: 'toNorth', leavesIn: 0 };
}
