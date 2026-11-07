import { internalKey } from '@es/shared/token';
import { env } from '../env';

/** Calls to the game server's /internal routes (online list, kick, mute, notices). */
const base = () => process.env.GAME_INTERNAL_URL || `http://127.0.0.1:${process.env.GAME_PORT ?? 2567}`;

async function game<T>(method: 'GET' | 'POST', path: string, q: Record<string, string> = {}): Promise<T | null> {
  try {
    const qs = new URLSearchParams(q).toString();
    const res = await fetch(`${base()}${path}${qs ? `?${qs}` : ''}`, { method, headers: { 'x-internal-key': internalKey(env.AUTH_SECRET) }, signal: AbortSignal.timeout(3000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export interface OnlinePlayer {
  sessionId: string;
  uid: string;
  guest: boolean;
  name: string;
  x: number;
  z: number;
  ip: string;
  since: number;
  room: string;
  zone: string;
}
export const gameOnline = () => game<{ players: OnlinePlayer[]; rooms: { id: string; zone: string; clients: number }[] }>('GET', '/internal/online');
export const gameKick = (uid: string, reason: string, banned = false) => game<{ kicked: number }>('POST', '/internal/kick', { uid, reason, banned: banned ? '1' : '0' });
export const gameMute = (uid: string, until: number) => game('POST', '/internal/mute', { uid, until: String(until) });
export const gameNotice = (text: string, level: 'info' | 'warning') => game<{ rooms: number }>('POST', '/internal/notice', { text, level });

/** Push in-game settings to a player's open game(s); `applied` = how many sessions got them. */
export const gameSettings = (uid: string, settings: object) => game<{ applied: number }>('POST', '/internal/settings', { uid, s: JSON.stringify(settings) });

/** Tell a player's open game that journey steps were finished. */
export const gameRename = (uid: string, name: string) => game<{ renamed: number }>('POST', '/internal/rename', { uid, name });
export const gameJourney = (uid: string, ev: object) => game<{ sent: number }>('POST', '/internal/journey', { uid, ev: JSON.stringify(ev) });
