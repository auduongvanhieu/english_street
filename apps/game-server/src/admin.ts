// Link to the API for moderation and the admin site: live settings, account status (ban / mute),
// the online list, kicks, notices and the heat map. Calls carry the shared internal key.
import { internalKey } from '@es/shared/token';
import { setProfanityWords } from '@es/shared';

// read lazily: .env is loaded by index.ts after the imports ran
const apiUrl = () => process.env.API_INTERNAL_URL || `http://127.0.0.1:${process.env.API_PORT ?? 4000}`;
export const myKey = () => internalKey(process.env.AUTH_SECRET ?? 'dev-secret-change-me');

async function api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl()}${path}`, {
      ...init,
      headers: { 'x-internal-key': myKey(), ...(init.body ? { 'content-type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(2000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null; // API down: fail open (players keep playing)
  }
}

// ---------------------------------------------------------------- live settings
export const live = { maxGuestsPerIp: Math.max(1, Number(process.env.MAX_GUESTS_PER_IP) || 6) };
async function pullSettings() {
  const s = await api<{ maxGuestsPerIp: number; extraBannedWords: string[]; allowedWords: string[] }>('/internal/settings');
  if (!s) return;
  live.maxGuestsPerIp = Math.max(1, s.maxGuestsPerIp);
  setProfanityWords(s.extraBannedWords ?? [], s.allowedWords ?? []);
}

// ---------------------------------------------------------------- account status
export interface Status {
  banned: boolean;
  until: string | null;
  reason: string;
  mutedUntil: number;
  tokenVersion: number;
}
const statusCache = new Map<string, { at: number; s: Status | null }>();
export async function accountStatus(id: string): Promise<Status | null> {
  if (!id) return null;
  const hit = statusCache.get(id);
  if (hit && Date.now() - hit.at < 30_000) return hit.s;
  const s = await api<Status>(`/internal/user/${encodeURIComponent(id)}`);
  statusCache.set(id, { at: Date.now(), s });
  if (statusCache.size > 5000) statusCache.delete(statusCache.keys().next().value!);
  return s;
}
/** Mutes pushed by the API (player id → until ms), on top of the status read at join. */
export const mutes = new Map<string, number>();
export const isMuted = (id: string) => (mutes.get(id) ?? 0) > Date.now();
export function forget(id: string) {
  statusCache.delete(id);
}

// ---------------------------------------------------------------- heat map
/** Player positions every 30 s, counted per 4 m cell and hour; sent to the API every 5 minutes. */
const heat = new Map<string, number>();
export function sampleHeat(x: number, z: number) {
  const hour = new Date();
  hour.setUTCMinutes(0, 0, 0);
  const k = `${hour.toISOString()}|${Math.floor(x / 4)}|${Math.floor(z / 4)}`;
  heat.set(k, (heat.get(k) ?? 0) + 1);
}
async function flushHeat() {
  if (!heat.size) return;
  const cells = [...heat].map(([k, n]) => {
    const [hour, cx, cz] = k.split('|');
    return [hour, Number(cx), Number(cz), n] as const;
  });
  heat.clear();
  const ok = await api('/internal/heat', { method: 'POST', body: JSON.stringify({ cells }) });
  if (!ok) for (const [hour, cx, cz, n] of cells) heat.set(`${hour}|${cx}|${cz}`, (heat.get(`${hour}|${cx}|${cz}`) ?? 0) + n); // retry next time
}

export function startAdminLink() {
  void pullSettings();
  setInterval(() => void pullSettings(), 30_000).unref();
  setInterval(() => void flushHeat(), 5 * 60_000).unref();
  setInterval(() => void flushPlay(), 60_000).unref();
}
export async function stopAdminLink() {
  await flushHeat();
  await flushPlay();
}

// ---------------------------------------------------------------- play time
/** Seconds online per player since the last report; sent to the API with the next flush (about once a minute). */
const playQueue: { id: string; sec: number; start?: boolean }[] = [];
export function addPlay(id: string, sec: number, start = false) {
  if (!id || (sec <= 0 && !start)) return;
  playQueue.push({ id, sec: Math.max(0, Math.min(3600, Math.round(sec))), ...(start ? { start } : {}) });
}
export async function flushPlay() {
  if (!playQueue.length) return;
  const items = playQueue.splice(0, playQueue.length);
  const ok = await api('/internal/playtime', { method: 'POST', body: JSON.stringify({ items }) });
  // API down: keep them for the next try (bounded)
  if (!ok && playQueue.length < 20_000) playQueue.push(...items);
}

// ---------------------------------------------------------------- "My farm" chases
/** How a guard-dog chase ended (the API settles the stolen piece and the fine). */
export function reportChase(id: string, thief: string, result: 'escaped' | 'caught') {
  void api('/internal/farm-chase', { method: 'POST', body: JSON.stringify({ id, thief, result }) });
}
