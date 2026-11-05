import { wmoKind, type WeatherConfig, type WeatherDto } from '@es/shared';
import { loadWorld } from '@es/quests';

/**
 * Real weather for the street: Open-Meteo (free, no key), fetched at most every 10 minutes for the place set
 * in the admin site. A failed fetch keeps the last good answer; the admin can also force a weather.
 */
const TTL = 10 * 60_000;
let cache: { key: string; at: number; dto: WeatherDto } | null = null;
let inflight: Promise<void> | null = null;

async function fetchLive(cfg: WeatherConfig, key: string) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}` +
    '&current=temperature_2m,relative_humidity_2m,weather_code,cloud_cover,precipitation,wind_speed_10m&timezone=UTC';
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = (await res.json()) as { current?: Record<string, number> };
  const c = j.current;
  if (!c) throw new Error('open-meteo: no current');
  const code = Number(c.weather_code ?? 0);
  const cloud = Number(c.cloud_cover ?? 0);
  cache = {
    key,
    at: Date.now(),
    dto: {
      kind: wmoKind(code, cloud),
      code,
      tempC: c.temperature_2m ?? null,
      humidity: c.relative_humidity_2m ?? null,
      cloud,
      rainMm: Number(c.precipitation ?? 0),
      windKmh: Number(c.wind_speed_10m ?? 0),
      place: cfg.place,
      lat: cfg.lat,
      lon: cfg.lon,
      clock: cfg.clock,
      live: true,
      updatedAt: new Date().toISOString(),
    },
  };
}

const FIXED_CLOUD: Record<string, number> = { clear: 5, partly: 45, cloudy: 95, fog: 100, drizzle: 85, rain: 100, storm: 100 };

/** Weather to show now. Never throws; null only before the first successful fetch. */
export async function currentWeather(): Promise<WeatherDto | null> {
  const cfg = loadWorld().weather;
  if (cfg.mode !== 'live') {
    const kind = cfg.mode;
    return {
      kind,
      code: -1,
      tempC: cache?.dto.tempC ?? null,
      humidity: cache?.dto.humidity ?? null,
      cloud: FIXED_CLOUD[kind] ?? 50,
      rainMm: kind === 'storm' ? 3 : kind === 'rain' ? 1.5 : kind === 'drizzle' ? 0.2 : 0,
      windKmh: kind === 'storm' ? 35 : 8,
      place: cfg.place,
      lat: cfg.lat,
      lon: cfg.lon,
      clock: cfg.clock,
      live: false,
      updatedAt: new Date().toISOString(),
    };
  }
  const key = `${cfg.lat},${cfg.lon}`;
  const fresh = cache && cache.key === key && Date.now() - cache.at < TTL;
  if (!fresh && !inflight) {
    inflight = fetchLive(cfg, key)
      .catch((e) => {
        // keep serving the last answer; try again in a minute
        if (cache) cache.at = Date.now() - TTL + 60_000;
        console.warn('[weather]', (e as Error).message);
      })
      .finally(() => (inflight = null));
  }
  // first call waits for the fetch; later ones answer from the cache straight away
  if (!cache || cache.key !== key) await inflight?.catch(() => undefined);
  if (!cache || cache.key !== key) return null;
  return { ...cache.dto, place: cfg.place, clock: cfg.clock };
}
