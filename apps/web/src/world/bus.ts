import type { AreaId } from '@es/shared';
import { BUS_STOPS } from './areas';

/**
 * Bus rides with a real bus. Buses run in shared "slots" every BUS_SLOT_MS on the server clock: everyone who
 * boards at the same stop in the same slot shares one bus, and every client computes the bus from
 * (phase, stop, slot) alone, so all players see the same bus without the server simulating it.
 * A rider publishes Player.bus = "d:<stop>:<slot>" (boarding) then "a:<stop>:<slot>" (arriving).
 *
 * Timeline, t = seconds after the slot time, at a stop:
 *   -3 … 0   bus drives in from the east and brakes at the stop
 *    0 … 2.6 doors open; riders walk in (boarding) or step out (arriving)
 *  2.6 … 6   bus pulls away to the west and leaves
 */
export type StopId = 'main' | AreaId;
export const BUS_SLOT_MS = 4000;
/** Bus centre line on the road (south lane) and where the door is relative to the centre (bus faces −x). */
export const BUS_LANE_Z = 1.4;
export const DOOR_DX = -2.4;
export const DOOR_Z = BUS_LANE_Z + 1.35;
/** Where riders wait / step off on the pavement. */
export const kerbPoint = (stopX: number) => ({ x: stopX + DOOR_DX, z: 3.9 });
const IN_FROM = 26; // metres east of the stop when it appears
const OUT_TO = 34;
export const T_ARRIVE = -3;
export const T_DOORS_OPEN = 0.3;
export const T_DOORS_CLOSE = 2.3;
export const T_LEAVE = 2.6;
export const T_GONE = 6;

export const stopX = (id: StopId) => BUS_STOPS.find((s) => s.id === id)?.x ?? 0;

/** Slot index of the next bus that leaves at least `leadMs` from now. */
export const nextSlot = (serverNow: number, leadMs = 3200) => Math.ceil((serverNow + leadMs) / BUS_SLOT_MS);
/** Seconds since the slot time. */
export const slotT = (slot: number, serverNow: number) => (serverNow - slot * BUS_SLOT_MS) / 1000;

export interface BusPose {
  x: number;
  z: number;
  /** 0 closed … 1 open */
  door: number;
  visible: boolean;
}
/** Where the bus serving `stop` in `slot` is right now (same for boarding and arriving buses). */
export function busPose(stop: StopId, slot: number, serverNow: number): BusPose {
  const t = slotT(slot, serverNow);
  const sx = stopX(stop);
  let x = sx;
  if (t < 0) x = sx + IN_FROM * (t / T_ARRIVE) ** 2; // braking
  else if (t > T_LEAVE) x = sx - OUT_TO * ((t - T_LEAVE) / (T_GONE - T_LEAVE)) ** 2; // pulling away
  const door = t < T_DOORS_OPEN - 0.3 || t > T_DOORS_CLOSE + 0.3 ? 0 : t < T_DOORS_OPEN ? (t - (T_DOORS_OPEN - 0.3)) / 0.3 : t > T_DOORS_CLOSE ? 1 - (t - T_DOORS_CLOSE) / 0.3 : 1;
  return { x, z: BUS_LANE_Z, door: Math.max(0, Math.min(1, door)), visible: t >= T_ARRIVE - 0.2 && t <= T_GONE };
}

export interface BusTag {
  phase: 'd' | 'a';
  stop: StopId;
  slot: number;
}
const RE = /^([da]):(main|zoo|farm|supermarket|restaurant):(\d{1,12})$/;
export const encodeBus = (b: BusTag) => `${b.phase}:${b.stop}:${b.slot}`;
export function decodeBus(s: string | undefined): BusTag | null {
  const m = s ? RE.exec(s) : null;
  return m ? { phase: m[1] as 'd' | 'a', stop: m[2] as StopId, slot: Number(m[3]) } : null;
}

/** Is a rider with this tag inside the bus right now (hidden from view)? */
export function riderHidden(b: BusTag, serverNow: number): boolean {
  const t = slotT(b.slot, serverNow);
  // boarding: gone once through the door, until the bus has left; arriving: inside until the doors open
  return b.phase === 'd' ? t >= 1.5 && t <= T_GONE + 1 : t >= -20 && t < T_DOORS_OPEN + 0.3;
}
/** Is this tag still worth a bus on screen? (stale tags from a dropped connection expire on their own) */
export const tagLive = (b: BusTag, serverNow: number) => {
  const t = slotT(b.slot, serverNow);
  return t >= T_ARRIVE - 25 && t <= T_GONE;
};

/** Nearest stop to a position. */
export function nearestStop(x: number): StopId {
  let best = BUS_STOPS[0]!;
  for (const s of BUS_STOPS) if (Math.abs(s.x - x) < Math.abs(best.x - x)) best = s;
  return best.id;
}
