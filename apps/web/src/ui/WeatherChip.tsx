import { Icon, type IconName } from './icons';
import { useEffect, useState } from 'react';
import { NIGHT_WORD, WEATHER_WORD } from '@es/shared';
import { useWorld } from '../store/world';
import { sky } from '../world/sky';
import { useSettings, type SkyTime, type SkyWeather } from '../store/settings';
import { speak } from '../voice/tts';
import { useT } from '../i18n';
import { inRect } from '@es/shared';
import { serverNow } from '../net/client';
import { localPos } from '../scene/LocalPlayer';
import { HILL, HILL_SKY, weatherAt } from '../world/mapleHill';

const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

/**
 * Weather and Vietnam time at the top of the screen (the street's sky follows both). Tap: the English
 * sentence for the weather (with a speaker), the place, and a button to look up at the sky.
 */
/** Line icon for the sky right now (phone HUD). */
function skyIcon(night: boolean, kind: string): IconName {
  if (kind === 'storm') return 'storm';
  if (kind === 'rain' || kind === 'drizzle') return 'rain';
  if (kind === 'fog') return 'fog';
  if (kind === 'cloudy') return 'cloud';
  return night ? 'moon' : 'sun';
}

export function WeatherChip({ compact }: { compact: boolean }) {
  const now = useWorld((s) => s.cfg?.now ?? null);
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  const t = useT();
  const skyTime = useSettings((s) => s.skyTime);
  const skyWeather = useSettings((s) => s.skyWeather);
  const setSky = useSettings((s) => s.set);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const night = sky.day < 0.3;
  const w = WEATHER_WORD[sky.kind];
  const clearish = sky.kind === 'clear' || sky.kind === 'partly';
  const sw = night && clearish ? NIGHT_WORD : w;
  // Maple Hill has its own weather (world/mapleHill.ts)
  const hill = inRect(HILL, localPos.x, localPos.z, 30) ? HILL_SKY[weatherAt(serverNow())] : null;
  const icon = hill ? hill.icon : night && clearish ? '🌙' : w.icon;
  const tempC = hill ? hill.tempC : now?.tempC;
  const word = hill ?? sw;
  const times: [SkyTime, string, string][] = [
    ['system', '🕒', t('Real time')],
    ['morning', '🌅', t('Morning')],
    ['noon', '☀️', t('Noon')],
    ['sunset', '🌇', t('Sunset')],
    ['night', '🌙', t('Night')],
  ];
  const weathers: [SkyWeather, string, string][] = [
    ['system', '🛰️', t('Real weather')],
    ['clear', '☀️', t('Sunny')],
    ['cloudy', '☁️', t('Cloudy')],
    ['rain', '🌧️', t('Rain')],
    ['storm', '⛈️', t('Storm')],
    ['fog', '🌫️', t('Fog')],
  ];
  const chip = (on: boolean) => `flex min-h-9 flex-col items-center justify-center rounded-lg px-1 py-1 text-[10px] leading-tight ${on ? 'bg-sky-600 font-semibold text-white' : 'bg-slate-100 text-slate-700'}`;
  return (
    // touch: a round button in the right-hand column (App.tsx), the card opens to its left
    <div data-ui className={compact ? 'relative text-xs' : 'absolute bottom-3 left-3 z-10 flex flex-col-reverse items-start text-xs'}>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={t('Weather')}
          aria-label={t('Weather')}
          className="flex h-11 w-11 flex-col items-center justify-center rounded-full bg-white/85 text-slate-700 shadow-md ring-1 ring-black/5 backdrop-blur-md active:scale-95"
        >
          <Icon name={skyIcon(night, sky.kind)} size={18} />
          <span className="mt-0.5 text-[9px] font-semibold leading-none tabular-nums">{hhmm(sky.hour)}</span>
        </button>
      ) : (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title={t('Weather')}
          className="flex min-h-9 items-center gap-1.5 rounded-full bg-black/50 px-3 font-medium text-white backdrop-blur-sm hover:bg-black/60"
        >
          <span className="text-base leading-none">{icon}</span>
          {tempC != null && <span>{Math.round(tempC)}°C</span>}
          <span className="tabular-nums opacity-80">{hhmm(sky.hour)}</span>
        </button>
      </div>
      )}
      {open && (
        <div className={`w-72 rounded-xl ${compact ? 'absolute right-14 top-0 z-30' : 'my-2'} bg-white/95 p-3 text-gray-800 shadow-xl`}>
          <div className="flex items-start gap-2">
            <span className="text-2xl leading-none">{icon}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">{word.sentence}</div>
              <div className="mt-0.5 text-gray-500">
                {t('Word')}: <b>{word.word}</b>
              </div>
            </div>
            <button type="button" onClick={() => speak(word.sentence, { lang: 'en-US' })} className="rounded-full p-1 text-lg hover:bg-gray-100" title={t('Listen')}>
              🔊
            </button>
          </div>
          <div className="mt-2 space-y-0.5 border-t pt-2 text-gray-600">
            <div>
              📍 {hill ? 'Maple Hill' : (now?.place ?? 'Ho Chi Minh City')} · {hhmm(sky.hour)} ({t('Vietnam time')})
            </div>
            {!hill && now?.tempC != null && (
              <div>
                🌡️ {Math.round(now.tempC)}°C{now.humidity != null ? ` · 💧 ${Math.round(now.humidity)}%` : ''} · 🍃 {Math.round(now.windKmh)} km/h
              </div>
            )}
            <div className="text-[11px] text-gray-400">{now?.live === false ? t('Weather set by the game team') : t('Live weather, updated every 10 minutes')}</div>
          </div>
          {/* day / night and weather on this screen only (same as Settings) */}
          <div className="mt-2 border-t pt-2">
            <div className="mb-1 font-semibold text-gray-700">{t('Time of day')}</div>
            <div className="grid grid-cols-5 gap-1">
              {times.map(([id, ic, label]) => (
                <button key={id} type="button" onClick={() => setSky({ skyTime: id })} className={chip(skyTime === id)} aria-pressed={skyTime === id}>
                  <span className="text-base leading-none">{ic}</span>
                  <span className="mt-0.5 w-full truncate text-center">{label}</span>
                </button>
              ))}
            </div>
            <div className="mb-1 mt-2 font-semibold text-gray-700">{t('Weather')}</div>
            <div className="grid grid-cols-6 gap-1">
              {weathers.map(([id, ic, label]) => (
                <button key={id} type="button" onClick={() => setSky({ skyWeather: id })} className={chip(skyWeather === id)} aria-pressed={skyWeather === id}>
                  <span className="text-base leading-none">{ic}</span>
                  <span className="mt-0.5 w-full truncate text-center">{label}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-center text-[11px] text-gray-400">{skyTime === 'system' && skyWeather === 'system' ? t('Follows the real time and weather in Vietnam') : t('Only on your screen')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
