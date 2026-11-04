/**
 * Cyclists ride along the road now and then. Like the critters, each one follows a deterministic
 * schedule evaluated against the shared server clock, so every client sees the same rider at the
 * same spot and the server does nothing at all.
 */
export interface Cyclist {
  id: string;
  name: string;
  /** Shirt / helmet / bike frame colours. */
  shirt: string;
  helmet: string;
  frame: string;
  /** +1 rides toward +x (uses the south lane), -1 toward -x (north lane). */
  dir: 1 | -1;
  /** m/s */
  speed: number;
  /** Seconds between two passes. */
  period: number;
  /** Seconds, so the three riders are not in lock-step. */
  offset: number;
  /** What they call out when passing a player, and the learning line when tapped. */
  greeting: string;
  sentence: string;
  word: { en: string; vi: string };
  /** For CritterCard. */
  kind: 'cyclist';
  sound: 'bell';
}

/** Ride from one end of the backdrop to the other (well past the playable street on both sides). */
export const RIDE_FROM = -75;
export const RIDE_TO = 75;
const LANE = 1.15;

export const CYCLISTS: Cyclist[] = [
  { id: 'bike-1', name: 'Sam', shirt: '#e5533d', helmet: '#f5f5f5', frame: '#2b5fb3', dir: 1, speed: 5.5, period: 58, offset: 0, greeting: 'On your left!', sentence: 'Sam rides his bicycle to work every morning.', word: { en: 'bicycle', vi: 'xe đạp' }, kind: 'cyclist', sound: 'bell' },
  { id: 'bike-2', name: 'Linh', shirt: '#3aa66b', helmet: '#f2c94c', frame: '#333333', dir: -1, speed: 5.0, period: 73, offset: 21, greeting: 'Excuse me!', sentence: 'Linh wears a helmet when she rides.', word: { en: 'helmet', vi: 'mũ bảo hiểm' }, kind: 'cyclist', sound: 'bell' },
  { id: 'bike-3', name: 'Omar', shirt: '#4a90e2', helmet: '#e5533d', frame: '#c9a227', dir: 1, speed: 6.2, period: 91, offset: 47, greeting: 'Morning!', sentence: 'Omar is riding fast in the bike lane.', word: { en: 'lane', vi: 'làn đường' }, kind: 'cyclist', sound: 'bell' },
];

export interface CyclistPose {
  visible: boolean;
  x: number;
  z: number;
  /** Heading (atan2(dx, dz)), same convention as players. */
  rot: number;
  /** Metres travelled this pass (drives wheel and pedal rotation). */
  dist: number;
  /** Which pass this is (increments every period) — used to ring the bell once per pass. */
  pass: number;
}

export function cyclistAt(c: Cyclist, tMs: number): CyclistPose {
  const t = tMs / 1000 + c.offset;
  const pass = Math.floor(t / c.period);
  const phase = t - pass * c.period;
  const rideTime = (RIDE_TO - RIDE_FROM) / c.speed;
  const dist = phase * c.speed;
  const visible = phase < rideTime;
  const x = c.dir > 0 ? RIDE_FROM + dist : RIDE_TO - dist;
  return { visible, x, z: c.dir > 0 ? LANE : -LANE, rot: c.dir > 0 ? Math.PI / 2 : -Math.PI / 2, dist, pass };
}
