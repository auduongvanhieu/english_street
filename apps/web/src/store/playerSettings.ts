import type { PlayerSettings } from '@es/shared';
import { post } from '../net/api';
import { getPlayerId } from '../net/player';
import { useLang } from '../i18n';
import { useSettings } from './settings';
import { useVoice } from './voice';

/**
 * The player's in-game settings as one object: reported to the API (the admin site shows them) and applied when
 * an admin changes them (pushed by the game server, or handed over on the next join).
 */
export function currentPlayerSettings(): PlayerSettings {
  const s = useSettings.getState();
  return {
    quality: s.quality,
    lang: useLang.getState().lang,
    subtitles: s.subtitles === 'on' ? 'on' : 'off',
    ipa: s.ipa,
    ttsRate: s.ttsRate,
    muted: useVoice.getState().muted,
    ambientVolume: s.ambientVolume,
    micMode: s.micMode,
    skyTime: s.skyTime,
    skyWeather: s.skyWeather,
  };
}

let applying = false;
export function applyPlayerSettings(p: PlayerSettings) {
  applying = true;
  try {
    const s = useSettings.getState();
    if (p.quality && p.quality !== s.quality) s.setQuality(p.quality);
    const patch: Parameters<typeof s.set>[0] = {};
    if (p.subtitles) patch.subtitles = p.subtitles;
    if (p.ipa !== undefined) patch.ipa = p.ipa;
    if (p.ttsRate !== undefined) patch.ttsRate = p.ttsRate;
    if (p.ambientVolume !== undefined) patch.ambientVolume = p.ambientVolume;
    if (p.micMode) patch.micMode = p.micMode;
    if (p.skyTime) patch.skyTime = p.skyTime;
    if (p.skyWeather) patch.skyWeather = p.skyWeather;
    if (Object.keys(patch).length) s.set(patch);
    if (p.lang && p.lang !== useLang.getState().lang) useLang.getState().setLang(p.lang);
    if (p.muted !== undefined && p.muted !== useVoice.getState().muted) useVoice.getState().setMuted(p.muted);
  } finally {
    applying = false;
  }
  reportSettings();
}

let timer: number | null = null;
/** Send the current settings to the API (debounced). */
export function reportSettings() {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void post(`/me/gfx?playerId=${encodeURIComponent(getPlayerId())}`, { quality: useSettings.getState().quality, settings: currentPlayerSettings() }).catch(() => undefined);
  }, 2500);
}

/** Report whenever the player changes something (subscribed once, after joining). */
export function watchPlayerSettings() {
  const a = useSettings.subscribe(() => !applying && reportSettings());
  const b = useLang.subscribe((n, o) => n.lang !== o.lang && !applying && reportSettings());
  const c = useVoice.subscribe((n, o) => n.muted !== o.muted && !applying && reportSettings());
  reportSettings();
  return () => {
    a();
    b();
    c();
  };
}
