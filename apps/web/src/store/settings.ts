import { create } from 'zustand';
import { track } from '../net/analytics';

export type Quality = 'high' | 'low';
export type Tri = 'auto' | 'on' | 'off';
/** Sky shown to this player: the real Vietnam clock / live weather ('system') or a fixed choice. */
export type SkyTime = 'system' | 'morning' | 'noon' | 'sunset' | 'night';
export type SkyWeather = 'system' | 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
const SKY_TIMES: SkyTime[] = ['system', 'morning', 'noon', 'sunset', 'night'];
const SKY_WEATHERS: SkyWeather[] = ['system', 'clear', 'cloudy', 'rain', 'storm', 'fog'];

/**
 * Low quality = no shadows, dpr 1, fewer remote characters. Every device starts on High each time the game opens;
 * Low (HUD toggle / Settings) lasts for this visit only.
 */
function initialQuality(): Quality {
  return 'high';
}
const read = <T>(key: string, fallback: T, ok: (v: unknown) => boolean): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v = JSON.parse(raw) as unknown;
    return ok(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};

export interface Settings {
  quality: Quality;
  /** Subtitles (learner's language) under NPC lines: auto = on for A1–A2, off for B1+. */
  subtitles: Tri;
  /** IPA pronunciation line under NPC lines. */
  ipa: boolean;
  /** NPC voice speed (SpeechSynthesis rate). */
  ttsRate: number;
  /** Ambient street sound volume 0–1 (0 = off). */
  ambientVolume: number;
  /** Talk mic: 'tap' = tap to start, tap again to stop (default); 'hold' = hold while speaking. */
  micMode: 'tap' | 'hold';
  skyTime: SkyTime;
  skyWeather: SkyWeather;
  setQuality: (q: Quality) => void;
  set: (patch: Partial<Pick<Settings, 'subtitles' | 'ipa' | 'ttsRate' | 'ambientVolume' | 'micMode' | 'skyTime' | 'skyWeather'>>) => void;
}

export const useSettings = create<Settings>((set) => ({
  quality: initialQuality(),
  // Off by default: each NPC line has its own Dịch / IPA buttons. 'On' = always show (new key, so the old 'auto' default resets).
  subtitles: read<Tri>('es:subs2', 'off', (v) => v === 'on' || v === 'off'),
  ipa: read<boolean>('es:ipa', false, (v) => typeof v === 'boolean'),
  ttsRate: read<number>('es:ttsRate', 0.95, (v) => typeof v === 'number' && v >= 0.5 && v <= 1.5),
  ambientVolume: read<number>('es:ambient', matchMedia('(pointer: coarse)').matches ? 0 : 0.4, (v) => typeof v === 'number' && v >= 0 && v <= 1),
  micMode: read<'tap' | 'hold'>('es:micMode', 'tap', (v) => v === 'tap' || v === 'hold'),
  skyTime: read<SkyTime>('es:skyTime', 'system', (v) => SKY_TIMES.includes(v as SkyTime)),
  skyWeather: read<SkyWeather>('es:skyWeather', 'system', (v) => SKY_WEATHERS.includes(v as SkyWeather)),
  setQuality: (quality) => {
    track('settings_change', { key: 'quality', value: quality });
    set({ quality });
  },
  set: (patch) => {
    if (patch.subtitles !== undefined) localStorage.setItem('es:subs2', JSON.stringify(patch.subtitles));
    if (patch.ipa !== undefined) localStorage.setItem('es:ipa', JSON.stringify(patch.ipa));
    if (patch.ttsRate !== undefined) localStorage.setItem('es:ttsRate', JSON.stringify(patch.ttsRate));
    if (patch.micMode !== undefined) localStorage.setItem('es:micMode', JSON.stringify(patch.micMode));
    if (patch.skyTime !== undefined) localStorage.setItem('es:skyTime', JSON.stringify(patch.skyTime));
    if (patch.skyWeather !== undefined) localStorage.setItem('es:skyWeather', JSON.stringify(patch.skyWeather));
    if (patch.ambientVolume !== undefined) localStorage.setItem('es:ambient', JSON.stringify(patch.ambientVolume));
    for (const [key, value] of Object.entries(patch)) track('settings_change', { key, value: String(value) });
    set(patch);
  },
}));

/** Resolve the subtitle tri-state against the learner's level. */
export function subtitlesOn(pref: Tri, cefrLevel: string | undefined): boolean {
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return !cefrLevel || cefrLevel === 'A1' || cefrLevel === 'A2';
}
