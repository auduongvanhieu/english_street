import { END_FENCE_X } from './layout';

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
  /** chibi look of the rider */
  skin: string;
  hair: string;
  hairStyle: 'short' | 'spiky' | 'curly' | 'bob' | 'long' | 'ponytail' | 'buns' | 'bald';
  shorts: string;
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
  { id: 'bike-1', name: 'Sam', shirt: '#e5533d', helmet: '#f5f5f5', frame: '#2b5fb3', skin: '#eec1a0', hair: '#a0682f', hairStyle: 'spiky', shorts: '#24365c', dir: 1, speed: 5.5, period: 58, offset: 0, greeting: 'On your left!', sentence: 'Sam rides his bicycle to work every morning.', word: { en: 'bicycle', vi: 'xe đạp' }, kind: 'cyclist', sound: 'bell' },
  { id: 'bike-2', name: 'Linh', shirt: '#3aa66b', helmet: '#f2c94c', frame: '#e86fa8', skin: '#e0ac80', hair: '#1c1410', hairStyle: 'ponytail', shorts: '#2f3437', dir: -1, speed: 5.0, period: 73, offset: 21, greeting: 'Excuse me!', sentence: 'Linh wears a helmet when she rides.', word: { en: 'helmet', vi: 'mũ bảo hiểm' }, kind: 'cyclist', sound: 'bell' },
  { id: 'bike-3', name: 'Omar', shirt: '#4a90e2', helmet: '#e5533d', frame: '#c9a227', skin: '#8a5634', hair: '#1c1410', hairStyle: 'curly', shorts: '#2f3437', dir: 1, speed: 6.2, period: 91, offset: 47, greeting: 'Morning!', sentence: 'Omar is riding fast in the bike lane.', word: { en: 'lane', vi: 'làn đường' }, kind: 'cyclist', sound: 'bell' },
];

export interface CyclistPose {
  visible: boolean;
  x: number;
  z: number;
  /** Heading (atan2(dx, dz)), same convention as players. */
  rot: number;
  /** Metres ridden this pass (drives wheel and pedal rotation; frozen while the bike is carried). */
  dist: number;
  /** Which pass this is (increments every period) — used to ring the bell once per pass. */
  pass: number;
  /** 0 = riding, 1 = off the bike, holding it up over a fence (eased in between). */
  carry: number;
  /** Walking cycle phase (radians) while carrying. */
  walk: number;
}

/** The road is closed by a fence at each end: stop MARGIN before it, get off, lift the bike over, get back on. */
const MARGIN = 0.9;
const LIFT_S = 0.8;
const WALK_SPEED = 0.8;
const CARRY_S = 2 * LIFT_S + (2 * MARGIN) / WALK_SPEED;

interface Seg {
  mode: 'ride' | 'carry';
  t0: number;
  dur: number;
  s0: number;
  s1: number;
  /** distance ridden before this segment */
  ride0: number;
}
const plans = new Map<string, { segs: Seg[]; total: number }>();
function plan(c: Cyclist) {
  let p = plans.get(c.id);
  if (p) return p;
  const len = RIDE_TO - RIDE_FROM;
  const fences = [-END_FENCE_X, END_FENCE_X].map((fx) => (c.dir > 0 ? fx - RIDE_FROM : RIDE_TO - fx)).sort((a, b) => a - b);
  const segs: Seg[] = [];
  let s = 0;
  let t = 0;
  let ride = 0;
  const rideTo = (s1: number) => {
    const dur = (s1 - s) / c.speed;
    segs.push({ mode: 'ride', t0: t, dur, s0: s, s1, ride0: ride });
    t += dur;
    ride += s1 - s;
    s = s1;
  };
  for (const f of fences) {
    rideTo(f - MARGIN);
    segs.push({ mode: 'carry', t0: t, dur: CARRY_S, s0: s, s1: f + MARGIN, ride0: ride });
    t += CARRY_S;
    s = f + MARGIN;
  }
  rideTo(len);
  p = { segs, total: t };
  plans.set(c.id, p);
  return p;
}

const ease = (u: number) => u * u * (3 - 2 * u);

export function cyclistAt(c: Cyclist, tMs: number): CyclistPose {
  const t = tMs / 1000 + c.offset;
  const pass = Math.floor(t / c.period);
  const phase = t - pass * c.period;
  const { segs, total } = plan(c);
  const z = c.dir > 0 ? LANE : -LANE;
  const rot = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  const toX = (s: number) => (c.dir > 0 ? RIDE_FROM + s : RIDE_TO - s);
  if (phase >= total) return { visible: false, x: toX(RIDE_TO - RIDE_FROM), z, rot, dist: 0, pass, carry: 0, walk: 0 };
  const seg = segs.find((g) => phase < g.t0 + g.dur) ?? segs[segs.length - 1]!;
  const u = phase - seg.t0;
  if (seg.mode === 'ride') {
    const s = seg.s0 + u * c.speed;
    return { visible: true, x: toX(s), z, rot, dist: seg.ride0 + (s - seg.s0), pass, carry: 0, walk: 0 };
  }
  let s = seg.s0;
  let carry = 1;
  let walk = 0;
  if (u < LIFT_S) carry = ease(u / LIFT_S);
  else if (u > seg.dur - LIFT_S) {
    carry = ease((seg.dur - u) / LIFT_S);
    s = seg.s1;
  } else {
    const w = (u - LIFT_S) * WALK_SPEED;
    s = seg.s0 + w;
    walk = (w / 0.55) * Math.PI;
  }
  return { visible: true, x: toX(s), z, rot, dist: seg.ride0, pass, carry, walk };
}
