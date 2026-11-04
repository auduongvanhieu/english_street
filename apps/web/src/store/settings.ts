import { create } from 'zustand';
import { track } from '../net/analytics';

export type Quality = 'high' | 'low';
export type Tri = 'auto' | 'on' | 'off';

/** Low quality = no shadows, dpr 1, fewer remote characters. Default: low on touch devices. */
function initialQuality(): Quality {
  const saved = localStorage.getItem('es:quality');
  if (saved === 'high' || saved === 'low') return saved;
  return matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
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
  /** Vietnamese subtitles under NPC lines: auto = on for A1–A2, off for B1+. */
  subtitlesVi: Tri;
  /** IPA pronunciation line under NPC lines. */
  ipa: boolean;
  /** NPC voice speed (SpeechSynthesis rate). */
  ttsRate: number;
  /** Ambient street sound volume 0–1 (0 = off). */
  ambientVolume: number;
  setQuality: (q: Quality) => void;
  set: (patch: Partial<Pick<Settings, 'subtitlesVi' | 'ipa' | 'ttsRate' | 'ambientVolume'>>) => void;
}

export const useSettings = create<Settings>((set) => ({
  quality: initialQuality(),
  // Off by default: each NPC line has its own Dịch / IPA buttons. 'On' = always show (new key, so the old 'auto' default resets).
  subtitlesVi: read<Tri>('es:subs2', 'off', (v) => v === 'on' || v === 'off'),
  ipa: read<boolean>('es:ipa', false, (v) => typeof v === 'boolean'),
  ttsRate: read<number>('es:ttsRate', 0.95, (v) => typeof v === 'number' && v >= 0.5 && v <= 1.5),
  ambientVolume: read<number>('es:ambient', matchMedia('(pointer: coarse)').matches ? 0 : 0.4, (v) => typeof v === 'number' && v >= 0 && v <= 1),
  setQuality: (quality) => {
    localStorage.setItem('es:quality', quality);
    track('settings_change', { key: 'quality', value: quality });
    set({ quality });
  },
  set: (patch) => {
    if (patch.subtitlesVi !== undefined) localStorage.setItem('es:subs2', JSON.stringify(patch.subtitlesVi));
    if (patch.ipa !== undefined) localStorage.setItem('es:ipa', JSON.stringify(patch.ipa));
    if (patch.ttsRate !== undefined) localStorage.setItem('es:ttsRate', JSON.stringify(patch.ttsRate));
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
