import { useGame } from '../store/game';
import { useProfile } from '../store/profile';
import { subtitlesOn, useSettings, type Tri, type SkyTime, type SkyWeather } from '../store/settings';
import { useVoice } from '../store/voice';
import { useVoiceChat } from '../net/voicechat';
import { Sheet, SheetHeader } from './Sheet';
import { HudButton } from './Hud';
import { LANGS, type LangCode } from '@es/shared';
import { useLang, useT } from '../i18n';

export function SettingsButton({ compact }: { compact?: boolean }) {
  const open = useGame((s) => s.setUiPanel);
  const t = useT();
  if (compact)
    return (
      <HudButton onClick={() => open('settings')} title={t('Settings')}>
        ⚙️
      </HudButton>
    );
  return (
    <button type="button" onClick={() => open('settings')} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title={t('Settings')}>
      ⚙️ {t('Settings')}
    </button>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-gray-100 p-0.5">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} className={`min-h-9 rounded-md px-3 text-sm ${value === o.id ? 'bg-white font-medium shadow' : 'text-gray-600'}`} aria-pressed={value === o.id}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-8 w-14 rounded-full transition ${on ? 'bg-green-500' : 'bg-gray-300'}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

/** Learner's own language (translations) + interface language. Also used on the first-run name screen. */
export function LanguagePicker({ id = 'lang-select', className = '' }: { id?: string; className?: string }) {
  const lang = useLang((s) => s.lang);
  const setLang = useLang((s) => s.setLang);
  const t = useT();
  return (
    <select id={id} value={lang} onChange={(e) => setLang(e.target.value as LangCode)} aria-label={t('My language')} className={`min-h-9 rounded-lg border bg-white px-2 text-sm ${className}`}>
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.native}
          {l.code === 'en' ? ` (${t('no translation')})` : ''}
        </option>
      ))}
    </select>
  );
}

/** ⚙️ All player options in one sheet: language, subtitles, IPA, voice, graphics, sound. */
export function SettingsPanel() {
  const t = useT();
  const lang = useLang((st) => st.lang);
  const ui = useLang((st) => st.ui);
  const setUi = useLang((st) => st.setUi);
  const noTr = lang === 'en';
  const s = useSettings();
  const close = useGame((st) => st.setUiPanel);
  const level = useProfile((p) => p.profile?.cefrLevel);
  const voice = useVoice();
  const vc = useVoiceChat();
  const effective = subtitlesOn(s.subtitles, level);
  return (
    <Sheet onClose={() => close(null)} label={t('Settings')}>
      <SheetHeader>
        <h2 className="text-lg font-bold">⚙️ {t('Settings')}</h2>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 divide-y overflow-y-auto px-4 sm:px-5">
        <section className="py-2">
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">🌐 {t('Language')}</h3>
          <Row label={t('My language')} hint={t('Meanings, subtitles and explanations are shown in this language')}>
            <LanguagePicker />
          </Row>
          {!noTr && (
            <Row label={t('Interface language')} hint={t('Keep menus in English for extra practice')}>
              <Segmented<'auto' | 'en'> value={ui} options={[{ id: 'auto', label: LANGS.find((l) => l.code === lang)?.native ?? lang }, { id: 'en', label: 'English' }]} onChange={setUi} />
            </Row>
          )}
        </section>
        <section className="py-2">
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Learning')}</h3>
          {!noTr && (
            <Row label={t('Always show subtitles')} hint={t('Off: tap "Translate" on a line (now {mode})', { mode: effective ? t('always on') : t('per line') })}>
              <Segmented<Tri> value={s.subtitles === 'on' ? 'on' : 'off'} options={[{ id: 'off', label: t('Off') }, { id: 'on', label: t('On') }]} onChange={(v) => s.set({ subtitles: v })} />
            </Row>
          )}
          <Row label={t('Always show IPA')} hint={t('Off: tap "IPA" on a line; tap any word for details')}>
            <Toggle on={s.ipa} onChange={(v) => s.set({ ipa: v })} label="IPA" />
          </Row>
        </section>
        <section className="py-2">
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Voice')}</h3>
          {voice.ttsSupported && (
            <>
              <Row label={t('NPC voice')} hint={t('Read NPC lines aloud')}>
                <Toggle on={!voice.muted} onChange={(v) => voice.setMuted(!v)} label={t('NPC voice')} />
              </Row>
              <Row label={t('Voice speed')} hint={`${s.ttsRate.toFixed(2)}×`}>
                <input type="range" min={0.6} max={1.3} step={0.05} value={s.ttsRate} onChange={(e) => s.set({ ttsRate: Number(e.target.value) })} className="w-36" aria-label={t('Voice speed')} />
              </Row>
            </>
          )}
          {voice.sttSupported && (
            <Row label={t('Speaking mic')} hint={s.micMode === 'tap' ? t('Tap 🎤 to start, tap again when you finish') : t('Hold 🎤 while you speak, release to stop')}>
              <Segmented<'tap' | 'hold'> value={s.micMode} options={[{ id: 'tap', label: t('Tap') }, { id: 'hold', label: t('Hold') }]} onChange={(v) => s.set({ micMode: v })} />
            </Row>
          )}
          {vc.supported && (
            <Row label={t('Voice chat with players')} hint={t('Microphone, only players near you can hear')}>
              <Toggle on={vc.enabled} onChange={(v) => (v ? void vc.enable() : vc.disable())} label={t('Voice chat')} />
            </Row>
          )}
        </section>
        <section className="py-2">
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Graphics & sound')}</h3>
          <Row label={t('Graphics quality')} hint={t('Low = no shadows, smoother on phones')}>
            <Segmented value={s.quality} options={[{ id: 'low' as const, label: `⚡ ${t('Low')}` }, { id: 'high' as const, label: `✨ ${t('High')}` }]} onChange={(v) => s.setQuality(v)} />
          </Row>
          <Row label={t('Time of day')} hint={s.skyTime === 'system' ? t('Follows the real time in Vietnam') : t('Only on your screen')}>
            <select value={s.skyTime} onChange={(e) => s.set({ skyTime: e.target.value as SkyTime })} className="min-h-9 rounded-lg border bg-white px-2 text-sm" aria-label={t('Time of day')}>
              <option value="system">🕒 {t('Real time')}</option>
              <option value="morning">🌅 {t('Morning')}</option>
              <option value="noon">☀️ {t('Noon')}</option>
              <option value="sunset">🌇 {t('Sunset')}</option>
              <option value="night">🌙 {t('Night')}</option>
            </select>
          </Row>
          <Row label={t('Weather')} hint={s.skyWeather === 'system' ? t('Follows the real weather') : t('Only on your screen')}>
            <select value={s.skyWeather} onChange={(e) => s.set({ skyWeather: e.target.value as SkyWeather })} className="min-h-9 rounded-lg border bg-white px-2 text-sm" aria-label={t('Weather')}>
              <option value="system">🛰️ {t('Real weather')}</option>
              <option value="clear">☀️ {t('Sunny')}</option>
              <option value="cloudy">☁️ {t('Cloudy')}</option>
              <option value="rain">🌧️ {t('Rain')}</option>
              <option value="storm">⛈️ {t('Storm')}</option>
              <option value="fog">🌫️ {t('Fog')}</option>
            </select>
          </Row>
          <Row label={t('Bird sounds')} hint={s.ambientVolume === 0 ? t('off') : `${Math.round(s.ambientVolume * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} value={s.ambientVolume} onChange={(e) => s.set({ ambientVolume: Number(e.target.value) })} className="w-36" aria-label={t('Bird sounds')} />
          </Row>
        </section>
      </div>
    </Sheet>
  );
}
