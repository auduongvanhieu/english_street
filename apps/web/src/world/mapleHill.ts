import { MAPLE_HILL, inRect } from '@es/shared';
import { registerBlockers, type Aabb } from './layout';
import { registerSeats } from './seats';

/**
 * Maple Hill (world coordinates, east of Sunny Bay; MAPLE_HILL in @es/shared), reached by train. The station is at
 * the top (north, z ≈ -444), then a flat meadow (the ranger cabin, picnic tables, a lake), a stream with one
 * footbridge, and the hill rising to the summit (15 m) in the south. Players walk on the ground height groundAt().
 *   station z -448 … -441 · meadow z -492 … -448 · stream z ≈ -494 · hill z < -498 · summit (200, -566)
 */
export const HILL = MAPLE_HILL;
export const CX = 200;
export const PLATFORM = { x0: CX - 22, x1: CX + 22, z0: -448, z1: -441 };
export const ARRIVE = { x: CX, z: -451 };
export const SHELTER = { x: CX, z: -443.5 };
export const CABIN = { x: 182, z: -471 };
export const RANGER_BOARD = { x: 190.5, z: -466 };
export const STREAM_Z = -494;
export const BRIDGE = { x: CX, z: STREAM_Z };
export const LAKE = { x: 224, z: -485.5, rx: 11, rz: 8.5 };
export const PICNIC: { x: number; z: number }[] = [
  { x: 170, z: -481 },
  { x: 175, z: -486 },
];
export const CAMP = { x: 174, z: -526 };
export const BIG_ROCK = { x: 226, z: -520 };
export const MAPLE_TREE = { x: CX, z: -540 };
export const SUMMIT = { x: CX, z: -566 };
export const VIEWER = { x: CX + 3.2, z: -562.5 };

/* ------------------------------------------------------------------------------------------- ground height */
const PEAK = 15;
const R = 68;
/** Height of the ground at (x, z): 0 on the street and everywhere else, the hill and the slopes around Maple Hill. */
export function groundAt(x: number, z: number): number {
  if (x < HILL.minX - 70 || x > HILL.maxX + 70 || z > HILL.maxZ + 40 || z < HILL.minZ - 70) return 0;
  const d = Math.hypot(x - SUMMIT.x, z - SUMMIT.z) / R;
  let h = 0;
  if (d < 1) {
    const b = (1 - d * d) * (1 - d * d);
    h = PEAK * b + Math.min(1, b * 4) * 0.7 * Math.sin(x * 0.21) * Math.sin(z * 0.17);
  }
  // the slopes outside the walkable rectangle (side hills and the mountains behind)
  const ex = Math.max(0, HILL.minX - x, x - HILL.maxX);
  const ez = Math.max(0, HILL.minZ - z, z - (HILL.maxZ + 6));
  if (ex + ez > 0) h += 0.5 * Math.pow(ex + ez, 1.25);
  return h;
}

/* ------------------------------------------------------------------------------------------- the trails */
/** Trail segments (for the dirt colour on the ground and keeping trees off them). */
export const TRAILS: [number, number][][] = [
  [[CX, -446], [CX, -470], [CX, -491], [CX, -500], [206, -515], [196, -529], [CX, -540], [204, -552], [CX, -566]],
  [[CX, -458], [186, -470], [172, -482]],
  [[CX, -462], [210, -472], [214, -477]],
  [[CX, -500], [186, -512], [CAMP.x, CAMP.z], [188, -536], [CX, -540]],
  [[CX, -500], [214, -509], [BIG_ROCK.x, BIG_ROCK.z], [214, -531], [CX, -540]],
];
export function trailDist(x: number, z: number): number {
  let best = Infinity;
  for (const line of TRAILS)
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i]!;
      const [bx, bz] = line[i + 1]!;
      const vx = bx - ax;
      const vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
    }
  return best;
}

/** Places on the hike (the ranger's directions name them; signposts point to them). */
export const LANDMARKS: { id: string; en: string; x: number; z: number; r: number }[] = [
  { id: 'bridge', en: 'the bridge', x: BRIDGE.x, z: BRIDGE.z, r: 3.5 },
  { id: 'picnic', en: 'the picnic tables', x: 172.5, z: -483.5, r: 6 },
  { id: 'lake', en: 'the lake', x: 214, z: -477, r: 5 },
  { id: 'campsite', en: 'the campsite', x: CAMP.x, z: CAMP.z, r: 6 },
  { id: 'rock', en: 'the big rock', x: BIG_ROCK.x, z: BIG_ROCK.z, r: 5.5 },
  { id: 'maple', en: 'the big maple tree', x: MAPLE_TREE.x, z: MAPLE_TREE.z, r: 6 },
  { id: 'summit', en: 'the top of the hill', x: SUMMIT.x, z: SUMMIT.z, r: 6 },
];
export const SIGNPOSTS: { x: number; z: number; arms: string[] }[] = [
  { x: CX - 2.4, z: -457, arms: ['← Picnic area', 'Lake →', 'Straight on: Bridge'] },
  { x: CX - 2.4, z: -501, arms: ['← Campsite', 'Big Rock →', 'Straight on: Summit'] },
];

/* ------------------------------------------------------------------------------------------- weather */
export type HillWeather = 'sunny' | 'rainy' | 'cold' | 'foggy';
const WEATHER_MS = 240_000;
const hash = (n: number) => {
  const x = Math.sin(n * 57.31 + 3.7) * 43758.5453;
  return x - Math.floor(x);
};
/** The weather on Maple Hill now (on the shared clock, changes every four minutes). */
export function weatherAt(now: number): HillWeather {
  const h = hash(Math.floor(now / WEATHER_MS));
  return h < 0.4 ? 'sunny' : h < 0.65 ? 'rainy' : h < 0.85 ? 'cold' : 'foggy';
}
/** For the weather chip on Maple Hill: icon and temperature of each weather. */
export const HILL_SKY: Record<HillWeather, { icon: string; tempC: number; word: string; sentence: string }> = {
  sunny: { icon: '☀️', tempC: 24, word: 'sunny', sentence: "It's hot and sunny on Maple Hill." },
  rainy: { icon: '🌧️', tempC: 12, word: 'rainy', sentence: "It's raining on Maple Hill." },
  cold: { icon: '❄️', tempC: 2, word: 'cold', sentence: "It's very cold and windy on Maple Hill." },
  foggy: { icon: '🌫️', tempC: 8, word: 'foggy', sentence: "It's foggy on Maple Hill. You can't see very far." },
};
/** Rain to show for a player at (x, z): null away from Maple Hill (the sky's own weather applies). */
export function hillRain(x: number, z: number, now: number): number | null {
  if (!inRect(HILL, x, z, 30)) return null;
  return weatherAt(now) === 'rainy' ? 0.75 : 0;
}

/* ------------------------------------------------------------------------------------------- trees */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const inLake = (x: number, z: number, m = 0) => ((x - LAKE.x) / (LAKE.rx + m)) ** 2 + ((z - LAKE.z) / (LAKE.rz + m)) ** 2 < 1;
const keepClear = [CABIN, RANGER_BOARD, CAMP, BIG_ROCK, MAPLE_TREE, SUMMIT, ...PICNIC, { x: CX, z: -445 }];
/** Pines: [x, z, scale, rotation]; the ones inside the walkable area are solid. */
export const PINES: [number, number, number, number][] = (() => {
  const out: [number, number, number, number][] = [];
  for (let i = 0; out.length < 230 && i < 4000; i++) {
    const x = HILL.minX - 45 + rnd(i) * (HILL.maxX - HILL.minX + 90);
    const z = HILL.maxZ - 8 - rnd(i + 9999) * (HILL.maxZ - HILL.minZ + 50);
    const inside = inRect(HILL, x, z, 1);
    // the meadow stays open except at its sides
    if (inside && z > -492 && x > 160 && x < 240) continue;
    if (inside && trailDist(x, z) < 3.2) continue;
    if (inLake(x, z, 2) || Math.abs(z - STREAM_Z) < 2.5) continue;
    if (keepClear.some((p) => Math.hypot(p.x - x, p.z - z) < 8)) continue;
    // fewer trees near the summit (a bare top with a view)
    if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < 16) continue;
    out.push([x, z, 0.8 + rnd(i + 5) * 0.6, rnd(i + 7) * 6.28]);
  }
  return out;
})();

/* ------------------------------------------------------------------------------------------- blockers */
const t = 0.3;
const box = (x: number, z: number, hx: number, hz: number): Aabb => ({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
export const BLOCKERS: Aabb[] = [
  // the edges, the station wall at the top
  { minX: HILL.minX - t, maxX: HILL.minX, minZ: HILL.minZ, maxZ: HILL.maxZ },
  { minX: HILL.maxX, maxX: HILL.maxX + t, minZ: HILL.minZ, maxZ: HILL.maxZ },
  { minX: HILL.minX, maxX: HILL.maxX, minZ: PLATFORM.z1, maxZ: PLATFORM.z1 + t },
  { minX: HILL.minX, maxX: HILL.maxX, minZ: HILL.minZ - t, maxZ: HILL.minZ },
  // the stream (one gap for the bridge) and the lake
  { minX: HILL.minX, maxX: BRIDGE.x - 1.05, minZ: STREAM_Z - 1.2, maxZ: STREAM_Z + 1.2 },
  { minX: BRIDGE.x + 1.05, maxX: LAKE.x - LAKE.rx + 1, minZ: STREAM_Z - 1.2, maxZ: STREAM_Z + 1.2 },
  { minX: LAKE.x + LAKE.rx - 1, maxX: HILL.maxX, minZ: STREAM_Z - 1.2, maxZ: STREAM_Z + 1.2 },
  box(LAKE.x, LAKE.z, LAKE.rx * 0.82, LAKE.rz * 0.82),
  box(LAKE.x, LAKE.z, LAKE.rx * 0.95, LAKE.rz * 0.5),
  box(LAKE.x, LAKE.z, LAKE.rx * 0.5, LAKE.rz * 0.95),
  // shelter back wall, cabin, board, big rock, the maple trunk, tent, campfire, cairn, picnic tables
  box(SHELTER.x, SHELTER.z + 1.15, 3.1, 0.15),
  box(CABIN.x, CABIN.z, 3.1, 2.4),
  box(RANGER_BOARD.x, RANGER_BOARD.z, 1.1, 0.15),
  box(BIG_ROCK.x + 0.3, BIG_ROCK.z, 1.9, 1.5),
  box(MAPLE_TREE.x, MAPLE_TREE.z, 0.45, 0.45),
  box(CAMP.x - 3, CAMP.z - 1.5, 1.0, 1.2),
  box(CAMP.x, CAMP.z, 0.7, 0.7),
  box(SUMMIT.x, SUMMIT.z, 0.6, 0.6),
  box(VIEWER.x, VIEWER.z, 0.25, 0.25),
  ...PICNIC.map((p) => box(p.x, p.z, 0.95, 0.4)),
  ...SIGNPOSTS.map((s) => box(s.x, s.z, 0.15, 0.15)),
  ...PINES.filter(([x, z]) => inRect(HILL, x, z, 0.5)).map(([x, z, s]) => box(x, z, 0.3 * s, 0.3 * s)),
];
registerBlockers(BLOCKERS);
registerSeats([
  // the station bench (facing south, -z), the picnic benches, a log by the campfire
  ...[-1, 0, 1].map((k) => ({ x: SHELTER.x + k * 0.9, z: SHELTER.z + 0.55, rot: Math.PI })),
  ...PICNIC.flatMap((p) => [-0.45, 0.45].flatMap((dx) => [{ x: p.x + dx, z: p.z - 0.65, rot: 0 }, { x: p.x + dx, z: p.z + 0.65, rot: Math.PI }])),
]);

/* ------------------------------------------------------------------------------------------- the cable car */
/**
 * A two-cabin cable car (jig-back) from the meadow up to the summit, on the shared clock: cabin 0 waits at the
 * bottom, goes up, waits at the top, comes down; cabin 1 does the same half a period later. Stations and pylon:
 * LPM cablecar_kit (cables at +-1.3 m either side of the line; the station wheel at 4.0 m, the pylon sheaves at 9.0 m;
 * a cabin hangs 3.4 m under its grip; the pylon is drawn CC_PYLON_SCALE times taller).
 */
export const CC_BOTTOM = { x: 237, z: -462 };
export const CC_TOP = { x: 212, z: -556 };
const ccDx = CC_TOP.x - CC_BOTTOM.x;
const ccDz = CC_TOP.z - CC_BOTTOM.z;
export const CC_LEN = Math.hypot(ccDx, ccDz);
/** Station / pylon rotation (their -Z towards the top) and the unit vectors along and across the line. */
export const CC_ROT = Math.atan2(-ccDx, -ccDz);
const along = { x: ccDx / CC_LEN, z: ccDz / CC_LEN };
const across = { x: Math.cos(CC_ROT), z: -Math.sin(CC_ROT) };
export const CC_PYLON = { x: CC_BOTTOM.x + ccDx * 0.5, z: CC_BOTTOM.z + ccDz * 0.5 };
/** The pylon is drawn 1.5x taller than the model (the cabins ride high over the lake). */
export const CC_PYLON_SCALE = 1.5;
/** Stations are sunk so their 0.4 m platform is level with the path. */
export const CC_SINK = -0.35;
export const CC_WAIT = 15;
export const CC_TRAVEL = 35;
export const CC_PERIOD = 2 * (CC_WAIT + CC_TRAVEL);
/** Cable height above sea level at s (0 = bottom station, 1 = top). */
export function cableY(s: number): number {
  const y0 = groundAt(CC_BOTTOM.x, CC_BOTTOM.z) + CC_SINK + 4.0;
  const y1 = groundAt(CC_PYLON.x, CC_PYLON.z) + 9.0 * CC_PYLON_SCALE;
  const y2 = groundAt(CC_TOP.x, CC_TOP.z) + CC_SINK + 4.0;
  return s < 0.5 ? y0 + (y1 - y0) * (s / 0.5) : y1 + (y2 - y1) * ((s - 0.5) / 0.5);
}
/** A point on cable `side` (+1 / -1) at s. */
export function cablePoint(s: number, side: number) {
  return { x: CC_BOTTOM.x + ccDx * s + across.x * 1.3 * side, y: cableY(s), z: CC_BOTTOM.z + ccDz * s + across.z * 1.3 * side };
}
export type CabinState = { s: number; at: 'bottom' | 'top' | null; going: 'up' | 'down' | null; leftIn: number };
/** Where cabin 0 / 1 is at time `ms` (server clock). leftIn = seconds until it leaves the station it waits at. */
export function cabinAt(cabin: number, ms: number): CabinState {
  const t = (((ms / 1000 + cabin * (CC_PERIOD / 2)) % CC_PERIOD) + CC_PERIOD) % CC_PERIOD;
  const ease = (k: number) => k * k * (3 - 2 * k);
  if (t < CC_WAIT) return { s: 0, at: 'bottom', going: null, leftIn: CC_WAIT - t };
  if (t < CC_WAIT + CC_TRAVEL) return { s: ease((t - CC_WAIT) / CC_TRAVEL), at: null, going: 'up', leftIn: 0 };
  if (t < 2 * CC_WAIT + CC_TRAVEL) return { s: 1, at: 'top', going: null, leftIn: 2 * CC_WAIT + CC_TRAVEL - t };
  return { s: 1 - ease((t - 2 * CC_WAIT - CC_TRAVEL) / CC_TRAVEL), at: null, going: 'down', leftIn: 0 };
}
/** Cabin floor position (the grip on cable +1 for cabin 0, -1 for cabin 1). */
export function cabinPose(cabin: number, ms: number) {
  const c = cabinAt(cabin, ms);
  const p = cablePoint(c.s, cabin === 0 ? 1 : -1);
  return { ...c, x: p.x, y: p.y - 3.4 + 0.1, z: p.z };
}
/** Where you stand to get on (the station platform, in front of the cabin) and step off. */
export const ccPlatform = (end: 'bottom' | 'top') => {
  const b = end === 'bottom' ? CC_BOTTOM : CC_TOP;
  const k = end === 'bottom' ? -2.2 : 2.2;
  return { x: b.x + along.x * k, z: b.z + along.z * k };
};
registerBlockers([
  { minX: CC_PYLON.x - 0.8, maxX: CC_PYLON.x + 0.8, minZ: CC_PYLON.z - 0.8, maxZ: CC_PYLON.z + 0.8 },
]);
