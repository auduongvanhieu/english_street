import * as THREE from 'three';
import { CLOCK_HOUR, sunPosition, vnHour, type WeatherDto, type WeatherKind } from '@es/shared';
import { useSettings, type SkyTime } from '../store/settings';

/** Vietnam hour for each fixed time of day a player can pick in Settings. */
const PICK_HOUR: Record<Exclude<SkyTime, 'system'>, number> = { morning: 8, noon: 12.5, sunset: 17.15, night: 22 };

/**
 * Sky state for this frame: sun and moon from the Vietnam clock (real sun position for the weather's place),
 * colours, light levels and weather effects from the real weather (GET /world → now). Written once per frame
 * by SkyController, read by the lights, the sky dome, clouds, rain, lamps and the river.
 */
export const sky = {
  hour: 12,
  sunDir: new THREE.Vector3(0.3, 0.8, 0.2),
  moonDir: new THREE.Vector3(-0.3, 0.6, 0.2),
  /** direction the main (sun or moon) light comes from */
  lightDir: new THREE.Vector3(0.6, 0.7, 0.4),
  lightColor: new THREE.Color('#fff3df'),
  lightIntensity: 1.6,
  /** 0 night … 1 full day; dusk peaks at sunrise / sunset */
  day: 1,
  dusk: 0,
  /** how much of the sky is grey (0…1), rain strength (0…1), fog strength (0…1) */
  overcast: 0,
  rain: 0,
  fog: 0,
  /** lightning flash 0…1 */
  flash: 0,
  storm: false,
  /** 0…1 moon lit fraction */
  moonLit: 0.5,
  stars: 0,
  /** street lamps 0 off … 1 on */
  lamps: 0,
  windX: 0,
  zenith: new THREE.Color('#4a90d9'),
  horizon: new THREE.Color('#d7e8f4'),
  sunGlow: new THREE.Color('#fff2c8'),
  hemiSky: new THREE.Color('#dff3ff'),
  hemiGround: new THREE.Color('#6b8f4e'),
  hemiIntensity: 0.6,
  cloudColor: new THREE.Color('#ffffff'),
  /** 0…1 how many cloud sprites to show */
  cloudCover: 0.3,
  fogNear: 70,
  fogFar: 150,
  kind: 'clear' as WeatherKind,
};

/** Dev / screenshot hook (window.__es.skyDebug): force an hour (VN) or a weather. */
export const skyDebug: { hour: number | null; kind: WeatherKind | null } = { hour: null, kind: null };

const C = (h: string) => new THREE.Color(h);
const PAL = {
  dayZ: C('#3f86d6'),
  dayH: C('#cfe5f6'),
  greyZ: C('#8e9aa6'),
  greyH: C('#bcc4cb'),
  stormZ: C('#545e68'),
  stormH: C('#79838c'),
  duskZ: C('#3d4f8f'),
  duskH: C('#f6a35e'),
  nightZ: C('#040817'),
  nightH: C('#17223d'),
  nightGreyZ: C('#0b0e15'),
  nightGreyH: C('#1d2129'),
  sunLow: C('#ff9f5a'),
  sunHigh: C('#fff3df'),
  moon: C('#9db3ff'),
};

const KIND: Record<WeatherKind, { over: number; rain: number; fog: number; near: number; far: number }> = {
  clear: { over: 0.03, rain: 0, fog: 0, near: 70, far: 150 },
  partly: { over: 0.25, rain: 0, fog: 0, near: 70, far: 150 },
  cloudy: { over: 0.8, rain: 0, fog: 0, near: 62, far: 145 },
  fog: { over: 0.75, rain: 0, fog: 1, near: 8, far: 60 },
  drizzle: { over: 0.8, rain: 0.3, fog: 0.15, near: 50, far: 135 },
  rain: { over: 0.92, rain: 0.7, fog: 0.3, near: 38, far: 120 },
  storm: { over: 1, rain: 1, fog: 0.4, near: 28, far: 105 },
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const dirFrom = (v: THREE.Vector3, el: number, az: number) => v.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)); // north = −z, east = +x

const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC = 29.530588;
const HO_CHI_MINH = { lat: 10.82, lon: 106.63 };

/** The time the sky shows: real time, or today at a fixed Vietnam hour. */
function skyTime(now: number, w: WeatherDto | null): number {
  const pick = useSettings.getState().skyTime;
  const fixed = skyDebug.hour ?? (pick !== 'system' ? PICK_HOUR[pick] : null) ?? (w && w.clock !== 'live' ? CLOCK_HOUR[w.clock] : null);
  if (fixed === null) return now;
  return now - vnHour(now) * 3_600_000 + fixed * 3_600_000;
}

/** Deterministic lightning: flashes at the same moments for everybody (server clock). */
function lightning(t: number): number {
  const bucket = Math.floor(t / 7);
  const r = Math.abs(Math.sin(bucket * 12.9898) * 43758.5453) % 1;
  if (r > 0.55) return 0;
  const dt = t - (bucket * 7 + r * 5);
  if (dt < 0 || dt > 0.7) return 0;
  return Math.max(0, 1 - dt / 0.12) + (dt > 0.18 && dt < 0.32 ? 0.7 : 0);
}
export const lastFlash = { at: 0 };

let smoothOver = -1;
let smoothRain = 0;
let smoothFog = 0;
let smoothNear = 70;
let smoothFar = 150;

/** Update `sky` for this frame. `dt` in seconds (weather changes ease in over ~20 s). */
export function updateSky(now: number, w: WeatherDto | null, dt: number) {
  const place = w ?? HO_CHI_MINH;
  const t = skyTime(now, w);
  sky.hour = vnHour(t);
  const sun = sunPosition(t, place.lat, place.lon);
  dirFrom(sky.sunDir, sun.elevation, sun.azimuth);
  const age = ((((t - NEW_MOON) / 86_400_000) % SYNODIC) + SYNODIC) % SYNODIC;
  const moon = sunPosition(t - (age / SYNODIC) * 86_400_000, place.lat, place.lon);
  dirFrom(sky.moonDir, moon.elevation, moon.azimuth);
  sky.moonLit = (1 - Math.cos((age / SYNODIC) * Math.PI * 2)) / 2;

  // weather (eased)
  const picked = useSettings.getState().skyWeather;
  const kind: WeatherKind = skyDebug.kind ?? (picked !== 'system' ? picked : null) ?? w?.kind ?? 'partly';
  sky.kind = kind;
  const k = KIND[kind];
  let over = k.over;
  if (kind === 'partly' && w?.live && picked === 'system') over = Math.min(0.6, Math.max(0.15, (w.cloud / 100) * 0.55));
  let rain = k.rain;
  if (w?.live && picked === 'system' && (kind === 'rain' || kind === 'storm')) rain = Math.min(1, 0.55 + w.rainMm / 4);
  const ease = smoothOver < 0 ? 1 : 1 - Math.exp(-dt / 6);
  smoothOver = smoothOver < 0 ? over : smoothOver + (over - smoothOver) * ease;
  smoothRain += (rain - smoothRain) * ease;
  smoothFog += (k.fog - smoothFog) * ease;
  smoothNear += (k.near - smoothNear) * ease;
  smoothFar += (k.far - smoothFar) * ease;
  const o = smoothOver;
  sky.overcast = o;
  sky.rain = smoothRain;
  sky.fog = smoothFog;
  sky.storm = kind === 'storm';
  sky.windX = Math.min(1, (w?.windKmh ?? 8) / 40) * (sky.storm ? 1 : 0.6);
  sky.cloudCover = Math.min(1, kind === 'clear' ? 0.12 : 0.15 + o);

  // light levels
  const s = Math.sin(sun.elevation);
  const day = smooth(-0.15, 0.15, s); // still light in the half hour after sunset
  const dusk = Math.max(0, 1 - Math.abs(s - 0.03) / 0.16) * (1 - o * 0.75);
  sky.day = day;
  sky.dusk = dusk;
  sky.stars = (1 - smooth(-0.12, 0.02, s)) * (1 - o) ** 2;

  // sky colours: night ↔ day, greyed by cloud, warmed at sunrise / sunset
  const z = sky.zenith;
  const h = sky.horizon;
  const greyZ = sky.storm ? PAL.stormZ : PAL.greyZ;
  const greyH = sky.storm ? PAL.stormH : PAL.greyH;
  const tmp = new THREE.Color();
  z.copy(PAL.nightZ).lerp(PAL.nightGreyZ, o);
  z.lerp(tmp.copy(PAL.dayZ).lerp(greyZ, o), day);
  z.lerp(PAL.duskZ, dusk * 0.6);
  h.copy(PAL.nightH).lerp(PAL.nightGreyH, o);
  h.lerp(tmp.copy(PAL.dayH).lerp(greyH, o), day);
  h.lerp(PAL.duskH, dusk * 0.75);
  // fog thickens the haze towards a pale grey (in the day) / murky blue (at night)
  if (sky.fog > 0) h.lerp(tmp.set(0.62 * day + 0.08, 0.66 * day + 0.09, 0.7 * day + 0.12), sky.fog * 0.6);
  sky.flash = sky.storm ? lightning(now / 1000) : 0;
  if (sky.flash > 0) {
    z.lerp(tmp.set(0.75, 0.78, 0.95), sky.flash * 0.6);
    h.lerp(tmp.set(0.85, 0.87, 1), sky.flash * 0.6);
    lastFlash.at = now;
  }
  sky.sunGlow.copy(PAL.sunLow).lerp(PAL.sunHigh, smooth(0.02, 0.4, s));

  // main light: the sun by day, the moon (kept high so the street stays readable) at night
  const sunI = day * (1.75 - 1.15 * o);
  const moonUp = smooth(-0.05, 0.25, Math.sin(moon.elevation));
  const moonI = (1 - day) * (0.85 + 0.3 * sky.moonLit * moonUp) * (1 - 0.5 * o);
  if (sunI >= moonI) {
    sky.lightDir.copy(sky.sunDir);
    if (sky.lightDir.y < 0.12) sky.lightDir.setY(0.12);
    sky.lightColor.copy(sky.sunGlow);
    sky.lightIntensity = sunI;
  } else {
    sky.lightDir.copy(moonUp > 0.2 ? sky.moonDir : sky.lightDir.set(-0.4, 1, 0.3));
    if (sky.lightDir.y < 0.6) sky.lightDir.setY(0.6);
    sky.lightColor.copy(PAL.moon);
    sky.lightIntensity = moonI;
  }
  sky.lightDir.normalize();
  sky.hemiSky.copy(h).lerp(z, 0.4).lerp(tmp.set(1, 1, 1), 0.25 * day);
  if (day < 0.5) sky.hemiSky.lerp(tmp.set(0.35, 0.45, 0.8), (0.5 - day) * 1.2); // moonlit blue, not black
  sky.hemiGround.set('#4b5c58').lerp(tmp.set('#6b8f4e'), day);
  sky.hemiIntensity = 1.2 - 0.55 * day + 0.45 * o * day + sky.flash * 2.5;
  sky.cloudColor.set(1, 1, 1).lerp(tmp.set(0.55, 0.58, 0.62), o * (sky.storm ? 1 : 0.7));
  sky.cloudColor.multiply(tmp.set(0.16, 0.18, 0.26).lerp(new THREE.Color(1, 1, 1), day));
  if (dusk > 0) sky.cloudColor.lerp(tmp.set(1, 0.68, 0.5), dusk * 0.45);
  sky.lamps = Math.max(1 - smooth(-0.04, 0.1, s), sky.storm ? 0.7 : 0, sky.fog * 0.6, o > 0.85 ? (o - 0.85) * 3 : 0);
  sky.fogNear = smoothNear;
  sky.fogFar = smoothFar;
}
