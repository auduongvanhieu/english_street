import { TABLES } from './buildings';

/**
 * Mia, the restaurant server who looks after the local player's table (each player sees their own Mia):
 * walks over when you sit down, takes your order to the kitchen, brings the dish, then the bill.
 * The store (store/restaurant.ts) sends her around; Restaurant.tsx moves and draws her.
 */
export const WAITER_HOME = { x: -138, z: -24.5 };
/** Walkway between the two rows of tables. */
const LANE_Z = -17.5;
export const WAITER_SPEED = 3.2;

export interface Waiter {
  x: number;
  z: number;
  rot: number;
  path: { x: number; z: number }[];
  /** what she is carrying: 'dish:<item>', 'bill' or '' */
  carry: string;
  /** turn to face this point once there */
  face: { x: number; z: number } | null;
  onArrive: (() => void) | null;
  bubble: string;
  bubbleUntil: number;
}
export const waiter: Waiter = { x: WAITER_HOME.x, z: WAITER_HOME.z, rot: 0, path: [], carry: '', face: null, onArrive: null, bubble: '', bubbleUntil: 0 };

/** Where she stands to serve a seat: beside the table, in the aisle. */
export function servingSpot(table: number, seat: number) {
  const t = TABLES[table]!;
  const s = t.seats[seat]!;
  return { x: t.x + 1.15, z: s.z, face: { x: s.x, z: s.z } };
}

/** Send her somewhere along the aisles (never through a table). */
export function sendWaiter(to: { x: number; z: number }, opts: { carry?: string; face?: { x: number; z: number } | null; onArrive?: () => void } = {}) {
  const w = waiter;
  w.path = Math.abs(w.x - to.x) < 0.05 ? [to] : [{ x: w.x, z: LANE_Z }, { x: to.x, z: LANE_Z }, to];
  w.carry = opts.carry ?? '';
  w.face = opts.face ?? null;
  w.onArrive = opts.onArrive ?? null;
}

export function waiterHome(carry = '') {
  sendWaiter(WAITER_HOME, { carry, face: { x: WAITER_HOME.x, z: WAITER_HOME.z + 5 } });
}

export function waiterSays(text: string, ms = 4500) {
  waiter.bubble = text;
  waiter.bubbleUntil = Date.now() + ms;
}
