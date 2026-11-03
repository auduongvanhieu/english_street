import { useGame } from '../store/game';
import { useProfile } from '../store/profile';
import { subtitlesOn, useSettings, type Tri } from '../store/settings';
import { useVoice } from '../store/voice';
import { useVoiceChat } from '../net/voicechat';
import { Sheet, SheetHeader } from './Sheet';
import { HudButton } from './Hud';

export function SettingsButton({ compact }: { compact?: boolean }) {
  const open = useGame((s) => s.setUiPanel);
  if (compact)
    return (
      <HudButton onClick={() => open('settings')} title="Settings">
        ⚙️
      </HudButton>
    );
  return (
    <button type="button" onClick={() => open('settings')} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title="Settings">
      ⚙️ Settings
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

/** ⚙️ All player options in one sheet: subtitles, IPA, voice, graphics, sound. */
export function SettingsPanel() {
  const s = useSettings();
  const close = useGame((st) => st.setUiPanel);
  const level = useProfile((p) => p.profile?.cefrLevel);
  const voice = useVoice();
  const vc = useVoiceChat();
  const effective = subtitlesOn(s.subtitlesVi, level);
  return (
    <Sheet onClose={() => close(null)} label="Settings">
      <SheetHeader>
        <h2 className="text-lg font-bold">⚙️ Settings</h2>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label="Close">
          ✕
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 divide-y overflow-y-auto px-4 sm:px-5">
        <section className="py-2">
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Learning</h3>
          <Row label="Phụ đề tiếng Việt" hint={`Vietnamese subtitles under NPC lines · auto = on for A1–A2 (now ${effective ? 'on' : 'off'})`}>
            <Segmented<Tri> value={s.subtitlesVi} options={[{ id: 'auto', label: 'Auto' }, { id: 'on', label: 'On' }, { id: 'off', label: 'Off' }]} onChange={(v) => s.set({ subtitlesVi: v })} />
          </Row>
          <Row label="IPA pronunciation" hint="Show /ˈkɒfi/ under NPC lines; tap any word for details">
            <Toggle on={s.ipa} onChange={(v) => s.set({ ipa: v })} label="IPA" />
          </Row>
        </section>
        <section className="py-2">
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Voice</h3>
          {voice.ttsSupported && (
            <>
              <Row label="NPC voice" hint="Read NPC lines aloud">
                <Toggle on={!voice.muted} onChange={(v) => voice.setMuted(!v)} label="NPC voice" />
              </Row>
              <Row label="Voice speed" hint={`${s.ttsRate.toFixed(2)}×`}>
                <input type="range" min={0.6} max={1.3} step={0.05} value={s.ttsRate} onChange={(e) => s.set({ ttsRate: Number(e.target.value) })} className="w-36" aria-label="Voice speed" />
              </Row>
            </>
          )}
          {vc.supported && (
            <Row label="Voice chat with players" hint="Microphone, only players near you can hear">
              <Toggle on={vc.enabled} onChange={(v) => (v ? void vc.enable() : vc.disable())} label="Voice chat" />
            </Row>
          )}
        </section>
        <section className="py-2">
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Graphics &amp; sound</h3>
          <Row label="Graphics quality" hint="Low = no shadows, smoother on phones">
            <Segmented value={s.quality} options={[{ id: 'low' as const, label: '⚡ Low' }, { id: 'high' as const, label: '✨ High' }]} onChange={(v) => s.setQuality(v)} />
          </Row>
          <Row label="Ambient sound" hint={s.ambientVolume === 0 ? 'off' : `${Math.round(s.ambientVolume * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} value={s.ambientVolume} onChange={(e) => s.set({ ambientVolume: Number(e.target.value) })} className="w-36" aria-label="Ambient volume" />
          </Row>
        </section>
      </div>
    </Sheet>
  );
}
