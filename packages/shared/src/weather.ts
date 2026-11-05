import { z } from 'zod';

/**
 * Sky and weather in the street follow the real weather and the Vietnam clock. The API asks Open-Meteo
 * (free, no key) for the place set in the admin site every 10 minutes; everyone sees the same sky.
 */
export const WEATHER_KINDS = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'storm'] as const;
export type WeatherKind = (typeof WEATHER_KINDS)[number];
export const CLOCK_MODES = ['live', 'morning', 'noon', 'dusk', 'night'] as const;
export type ClockMode = (typeof CLOCK_MODES)[number];

export const WeatherConfigSchema = z.object({
  /** Place whose weather the street shows. */
  place: z.string().trim().min(1).max(60).default('Ho Chi Minh City'),
  lat: z.number().min(-90).max(90).default(10.82),
  lon: z.number().min(-180).max(180).default(106.63),
  /** 'live' = real weather; otherwise this weather all the time (events, tests). */
  mode: z.enum(['live', ...WEATHER_KINDS]).default('live'),
  /** 'live' = Vietnam time of day; otherwise a fixed time of day. */
  clock: z.enum(CLOCK_MODES).default('live'),
});
export type WeatherConfig = z.infer<typeof WeatherConfigSchema>;

export interface WeatherDto {
  kind: WeatherKind;
  /** WMO weather code (-1 when not live). */
  code: number;
  tempC: number | null;
  humidity: number | null;
  /** 0…100 */
  cloud: number;
  /** mm in the last 15 minutes */
  rainMm: number;
  windKmh: number;
  place: string;
  lat: number;
  lon: number;
  clock: ClockMode;
  live: boolean;
  updatedAt: string;
}

/** WMO code → what the street shows. */
export function wmoKind(code: number, cloud = 50): WeatherKind {
  if (code >= 95) return 'storm';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 57) || code === 80) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 81 && code <= 82) || (code >= 71 && code <= 77) || code >= 85) return 'rain';
  if (code === 3) return 'cloudy';
  if (code === 1 || code === 2) return cloud > 85 ? 'cloudy' : 'partly';
  return cloud > 60 ? 'partly' : 'clear';
}

/** English words for the HUD (learning content, not translated). */
export const WEATHER_WORD: Record<WeatherKind, { icon: string; word: string; sentence: string }> = {
  clear: { icon: '☀️', word: 'sunny', sentence: "It's sunny today." },
  partly: { icon: '⛅', word: 'partly cloudy', sentence: "It's partly cloudy." },
  cloudy: { icon: '☁️', word: 'cloudy', sentence: "It's cloudy today." },
  fog: { icon: '🌫️', word: 'foggy', sentence: "It's foggy. I can't see very far." },
  drizzle: { icon: '🌦️', word: 'drizzling', sentence: "It's drizzling. Take an umbrella!" },
  rain: { icon: '🌧️', word: 'rainy', sentence: "It's raining. Don't forget your umbrella!" },
  storm: { icon: '⛈️', word: 'stormy', sentence: "There's a thunderstorm. Stay inside!" },
};
export const NIGHT_WORD = { icon: '🌙', word: 'clear night', sentence: "It's a clear night. Look at the stars!" };

/** Vietnam is UTC+7 all year. Hours since local midnight (0…24). */
export const vnHour = (ms: number) => (((ms / 3_600_000 + 7) % 24) + 24) % 24;

/** Fixed clock modes → hour of day. */
export const CLOCK_HOUR: Record<Exclude<ClockMode, 'live'>, number> = { morning: 8, noon: 12.5, dusk: 17.9, night: 22 };

/**
 * Sun position (NOAA-style approximation, good to a fraction of a degree) for a UTC time and place.
 * elevation: radians above the horizon; azimuth: radians clockwise from north.
 */
export function sunPosition(ms: number, lat: number, lon: number): { elevation: number; azimuth: number } {
  const rad = Math.PI / 180;
  const d = ms / 86_400_000 + 2440587.5 - 2451545.0; // days since J2000
  const g = (357.529 + 0.98560028 * d) * rad; // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad; // ecliptic longitude
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * rad - ra);
  const phi = lat * rad;
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
  const elevation = Math.asin(sinEl);
  const azimuth = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { elevation, azimuth: (azimuth + 2 * Math.PI) % (2 * Math.PI) };
}
