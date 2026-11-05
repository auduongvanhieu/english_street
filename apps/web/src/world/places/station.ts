import { vnHour } from '@es/shared';
import { areaById, areaFrame } from '../areas';
import { walls, type Building } from '../buildings';
import { registerBlockers, type Aabb } from '../layout';
import { benchPair, frameSeats, registerSeats } from '../seats';

/**
 * Station layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z from the
 * front fence (0) into the yard (-23.5). LOCAL_BLOCKERS are turned into world blockers below.
 *
 *   z  0 … -4     forecourt (gate at x 0): clock, departures board, benches, trolleys
 *   z -4 … -12    station building (west, ticket office inside) | open forecourt (east)
 *   z -12 … -15.6 platform 1 (walkable)
 *   z -15.6 … -23.5 track 1, track 2 and platform 2 (behind a railing, not walkable); tunnels at both ends
 */
export const AREA = areaById('station');
export const FRAME = areaFrame(AREA);

export const STATION: Building = { area: 'station', x0: -27, x1: -7, z0: -12, z1: -4, doorX: -17, doorW: 3, wall: '#eef1f3', roof: '#607d8b', floor: '#e9e3d6' };
/** Ticket office counter (the stationmaster stands behind it) and its booth walls. */
export const COUNTER: Aabb = { minX: -22, maxX: -12, minZ: -9.6, maxZ: -9.0 };
export const BOOTH_Z0 = STATION.z0;
export const STATIONMASTER = { x: -17, z: -10.7 };
/** Departures board in the forecourt, facing the gate. */
export const BOARD = { x: 6, z: -7, w: 6, h: 2.6 };
export const CLOCK = { x: -3, z: -2.4 };
/** Platform 1 (walkable), the tracks (z centres) and platform 2 at the back. */
export const PLATFORM1 = { z0: -15.6, z1: -12 };
export const TRACK_Z = [-16.6, -20.4] as const;
export const PLATFORM2 = { z0: -23.5, z1: -21.4 };
/** Tunnel mouths: the train is hidden beyond |x| > TUNNEL_X. */
export const TUNNEL_X = 25;
export const BENCHES = [
  { x: 12, z: -2.6 },
  { x: 17, z: -2.6 },
  { x: 2, z: -13.3 },
  { x: 10, z: -13.3 },
  { x: 18, z: -13.3 },
];
export const TICKET_MACHINE = { x: -4.5, z: -6.2 };

export const LOCAL_BLOCKERS: Aabb[] = [
  ...walls(STATION),
  COUNTER,
  // booth side walls
  { minX: -22.2, maxX: -21.9, minZ: BOOTH_Z0, maxZ: COUNTER.maxZ },
  { minX: -12.1, maxX: -11.8, minZ: BOOTH_Z0, maxZ: COUNTER.maxZ },
  // railing along the platform edge: tracks and platform 2 are out of bounds
  { minX: -28, maxX: 28, minZ: -23.5, maxZ: PLATFORM1.z0 },
  { minX: BOARD.x - BOARD.w / 2, maxX: BOARD.x + BOARD.w / 2, minZ: BOARD.z - 0.25, maxZ: BOARD.z + 0.25 },
  { minX: CLOCK.x - 0.25, maxX: CLOCK.x + 0.25, minZ: CLOCK.z - 0.25, maxZ: CLOCK.z + 0.25 },
  { minX: TICKET_MACHINE.x - 0.45, maxX: TICKET_MACHINE.x + 0.45, minZ: TICKET_MACHINE.z - 0.35, maxZ: TICKET_MACHINE.z + 0.35 },
  ...BENCHES.map((b) => ({ minX: b.x - 1, maxX: b.x + 1, minZ: b.z - 0.3, maxZ: b.z + 0.3 })),
];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));

/* ------------------------------------------------------------------------------------------------------------
 * Trains on a shared clock: one train per TRAIN_SLOT_MS, computed from the server time alone (like the buses),
 * so everybody sees the same train and the same departures board.
 *   t = seconds after the slot start (+ delay):  5 … 17 slides in and brakes, 17 … 45 doors open, 45 … 57 leaves
 * ---------------------------------------------------------------------------------------------------------- */
export const TRAIN_SLOT_MS = 180_000;
const T_IN = 5;
const T_STOP = 17;
const T_DEPART = 45;
const T_GONE = 57;
const RUN = 52; // metres from the stop to beyond a tunnel mouth
export const DESTINATIONS = ['Riverside', 'Maple Hill', 'Sunny Bay', 'Old Town'] as const;
/** Minutes from here to each destination (arrival times on the board). */
export const JOURNEY_MIN: Record<(typeof DESTINATIONS)[number], number> = { Riverside: 25, 'Maple Hill': 40, 'Sunny Bay': 75, 'Old Town': 55 };

const hash = (n: number, k: number) => {
  const x = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
export interface TrainService {
  slot: number;
  dest: (typeof DESTINATIONS)[number];
  platform: 1 | 2;
  /** Delay in minutes (0 = on time), -1 = cancelled. */
  delay: number;
  /** Scheduled departure (ms, server clock). */
  dep: number;
}
export function service(slot: number): TrainService {
  const h = hash(slot, 1);
  return {
    slot,
    dest: DESTINATIONS[Math.floor(hash(slot, 2) * DESTINATIONS.length)]!,
    platform: hash(slot, 3) < 0.5 ? 1 : 2,
    delay: h < 0.1 ? -1 : h < 0.2 ? 1 : h < 0.3 ? 2 : 0,
    dep: slot * TRAIN_SLOT_MS + T_DEPART * 1000,
  };
}
export const fmtTime = (ms: number) => {
  const h = vnHour(ms);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60 + 1e-6);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export interface TrainPose {
  visible: boolean;
  /** Centre of the train along local x. */
  x: number;
  z: number;
  /** 0 closed … 1 open */
  door: number;
}
/** Where the train of `slot` is now (invisible when cancelled or not in the station). */
export function trainPose(slot: number, now: number): TrainPose {
  const s = service(slot);
  const t = (now - slot * TRAIN_SLOT_MS) / 1000 - Math.max(0, s.delay) * 60;
  const z = s.platform === 1 ? TRACK_Z[0] : TRACK_Z[1];
  if (s.delay < 0 || t < T_IN || t > T_GONE) return { visible: false, x: 0, z, door: 0 };
  let x = 0;
  if (t < T_STOP) x = -RUN * ((T_STOP - t) / (T_STOP - T_IN)) ** 2;
  else if (t > T_DEPART) x = RUN * ((t - T_DEPART) / (T_GONE - T_DEPART)) ** 2;
  const door = Math.max(0, Math.min(1, Math.min(t - T_STOP, T_DEPART - 1 - t)));
  return { visible: true, x, z, door };
}
/** Slot whose train may be in the station now (it can be the previous one when delayed). */
export const currentSlots = (now: number) => {
  const s = Math.floor(now / TRAIN_SLOT_MS);
  return [s - 1, s];
};

export interface BoardRow {
  time: string;
  dest: string;
  platform: number;
  status: string;
}
/** The next departures (not yet gone) for the board. */
export function boardRows(now: number, n = 5): BoardRow[] {
  const rows: BoardRow[] = [];
  for (let slot = Math.floor(now / TRAIN_SLOT_MS) - 1; rows.length < n; slot++) {
    const s = service(slot);
    const t = (now - slot * TRAIN_SLOT_MS) / 1000 - Math.max(0, s.delay) * 60;
    if (t > T_DEPART + 2) continue; // gone
    const status = s.delay < 0 ? 'Cancelled' : t >= T_STOP ? 'Boarding' : t >= T_IN ? 'Arriving' : s.delay > 0 ? `Delayed ${s.delay} min` : 'On time';
    rows.push({ time: fmtTime(s.dep), dest: s.dest, platform: s.platform, status });
  }
  return rows;
}

// seats: forecourt and platform benches (facing +z), waiting-room benches inside (facing the front wall… away from it)
registerSeats(
  frameSeats(FRAME, [
    ...BENCHES.flatMap((b) => benchPair(b.x, b.z, 0)),
    ...benchPair(-25, -5.05, Math.PI, 0.5),
    ...benchPair(-22.6, -5.05, Math.PI, 0.5),
  ]),
);
