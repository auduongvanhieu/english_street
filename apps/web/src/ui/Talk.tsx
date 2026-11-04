import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PROXIMITY_RADIUS, INTERACT_RADIUS } from '@es/shared';
import { useGame } from '../store/game';
import { useTalk } from '../store/talk';
import { useVoiceChat } from '../net/voicechat';
import { ReportButton, TranslateButton } from './Hud';
import { getPlayerId } from '../net/player';
import { useT } from '../i18n';

const TOP = 'absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-20 -translate-x-1/2';

/** Popup for a tapped player: request a talk, wave, report. */
export function PlayerPopup() {
  const id = useGame((s) => s.selectedPlayer);
  const p = useGame((s) => (id ? s.players[id] : undefined));
  const me = useGame((s) => (s.sessionId ? s.players[s.sessionId] : undefined));
  const close = useGame((s) => s.setSelectedPlayer);
  const playEmote = useGame((s) => s.playEmote);
  const talk = useTalk();
  const t = useT();
  if (!p || !me) return null;
  const d = Math.hypot(p.x - me.x, p.z - me.z);
  const near = d <= PROXIMITY_RADIUS + INTERACT_RADIUS;
  const busy = !!p.talkWith || !!talk.partner || !!talk.pendingTo;
  return (
    <div data-ui className="absolute bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+5.5rem)] left-1/2 z-20 w-[92vw] max-w-xs -translate-x-1/2 rounded-xl bg-white p-3 shadow-2xl sm:bottom-24">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <b className="text-sm">{p.name}</b>
          <div className="text-xs text-gray-500">{near ? t('nearby') : t('{distance} m away — walk closer to talk', { distance: Math.round(d) })}{p.talkWith ? ` · ${t('in a conversation')}` : ''}</div>
        </div>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 text-sm text-gray-500" aria-label={t('Close player menu')}>
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" disabled={!near || busy} onClick={() => talk.request(p.id, p.name)} className="min-h-11 rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-50">
          💬 {t('Request to talk')}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => { playEmote('wave'); close(null); }} className="min-h-10 flex-1 rounded-lg border text-sm">
            👋 {t('Wave')}
          </button>
          <span className="flex min-h-10 flex-1 items-center justify-center rounded-lg border text-xs text-gray-600">
            {t('Report')} <ReportButton targetName={p.name} targetPlayerId={p.pid} />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Incoming request / waiting / notices for private talks. */
export function TalkToast() {
  const inc = useTalk((s) => s.incoming);
  const pending = useTalk((s) => s.pendingTo);
  const notice = useTalk((s) => s.notice);
  const accept = useTalk((s) => s.accept);
  const decline = useTalk((s) => s.decline);
  const t = useT();
  if (inc) {
    const [before, after = ''] = t('{name} would like to talk with you.').split('{name}');
    return (
      <div data-ui className={`${TOP} w-[92vw] max-w-sm rounded-xl bg-white p-4 shadow-2xl`}>
        <p className="text-sm">
          {before}
          <b>{inc.name}</b>
          {after}
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={accept} className="min-h-11 flex-1 rounded-lg bg-blue-600 text-sm font-medium text-white">
            {t('Accept')}
          </button>
          <button type="button" onClick={decline} className="min-h-11 flex-1 rounded-lg border text-sm">
            {t('Not now')}
          </button>
        </div>
      </div>
    );
  }
  if (pending) return <div className={`${TOP} rounded-xl bg-white/90 px-4 py-2 text-sm shadow`}>{t('Asking {name}…', { name: pending.name })}</div>;
  if (notice) return <div className={`${TOP} rounded-xl bg-white/90 px-4 py-2 text-sm shadow`}>{notice}</div>;
  return null;
}

/** The private conversation box: text lines, typing indicator, voice state, end button. */
export function TalkBox({ compact }: { compact: boolean }) {
  const partner = useTalk((s) => s.partner);
  const lines = useTalk((s) => s.lines);
  const typing = useTalk((s) => s.partnerTyping);
  const send = useTalk((s) => s.send);
  const notifyTyping = useTalk((s) => s.typing);
  const end = useTalk((s) => s.end);
  const vc = useVoiceChat();
  const t = useT();
  const partnerPlayer = useGame((s) => (partner ? s.players[partner.id] : undefined));
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [lines.length, typing]);
  useEffect(() => {
    if (partner && !compact) input.current?.focus();
  }, [partner, compact]);
  if (!partner) return null;
  const voiceConnected = vc.connected.includes(partner.id);

  function submit(e: FormEvent) {
    e.preventDefault();
    send(text);
    setText('');
  }

  return (
    <div
      data-ui
      className={`absolute z-20 flex flex-col rounded-xl bg-white/95 shadow-2xl backdrop-blur ${compact ? 'inset-x-2 max-h-[48dvh]' : 'bottom-3 left-1/2 w-96 max-h-[55vh] -translate-x-1/2'}`}
      style={compact ? { bottom: 'calc(max(0.5rem, env(safe-area-inset-bottom)) + var(--kb, 0px))' } : undefined}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <b className="text-sm">💬 {partner.name}</b>
          <div className="truncate text-[11px] text-gray-500">
            {vc.supported
              ? vc.mic
                ? voiceConnected
                  ? vc.muted
                    ? t('voice on · you are muted')
                    : t('voice on · they can hear you')
                  : t('connecting voice…')
                : partnerPlayer?.voice
                  ? t('listening · turn on your mic to speak')
                  : t('text only · tap 🎙️ to use your voice')
              : t('text conversation')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {vc.supported && (
            <button type="button" onClick={() => (vc.mic ? vc.toggleMute() : void vc.enable())} className={`min-h-9 min-w-9 rounded-lg px-2 text-sm ${vc.mic && !vc.muted ? 'bg-green-100' : 'bg-gray-100'}`} aria-label={vc.mic ? (vc.muted ? t('Unmute') : t('Mute')) : t('Turn on microphone')}>
              {vc.mic ? (vc.muted ? '🔇' : '🎤') : '🎙️'}
            </button>
          )}
          <button type="button" onClick={end} className="min-h-9 rounded-lg bg-red-50 px-2 text-sm text-red-700" aria-label={t('End conversation')}>
            {t('End')}
          </button>
        </div>
      </header>
      <div ref={list} className="min-h-24 flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm">
        {lines.length === 0 && <p className="text-xs text-gray-400">{t('Say hello in English! Nobody else can read this conversation.')}</p>}
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 ${l.from === 'me' ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'}`}>
              <span dir="ltr">{l.text}</span>
              {l.from === 'them' && <TranslateButton text={l.text} dark />}
            </div>
          </div>
        ))}
        {typing && <div className="text-xs text-gray-400">{t('{name} is typing…', { name: partner.name })}</div>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t p-2">
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const now = Date.now();
            if (now - lastTyping.current > 1500) {
              lastTyping.current = now;
              notifyTyping();
            }
          }}
          placeholder={t('Message {name}…', { name: partner.name })}
          maxLength={300}
          enterKeyHint="send"
          className="min-h-11 flex-1 rounded-lg border px-3 text-base sm:min-h-9 sm:text-sm"
        />
        <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50 sm:min-h-9">
          {t('Send')}
        </button>
      </form>
      <span className="hidden">{getPlayerId()}</span>
    </div>
  );
}

/** Hold to shout with your voice: everyone within SHOUT_RADIUS hears you at full volume. */
export function ShoutButton({ compact }: { compact?: boolean }) {
  const vc = useVoiceChat();
  const t = useT();
  const [held, setHeld] = useState(false);
  if (!vc.supported) return null;
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setHeld(true);
    void vc.setShouting(true);
  };
  const up = () => {
    setHeld(false);
    void vc.setShouting(false);
  };
  const cls = held ? 'bg-red-600' : 'bg-black/45 hover:bg-black/60';
  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      title={t('Hold to shout (voice heard across the street)')}
      aria-label={t('Hold to shout')}
      className={`touch-none select-none text-white shadow backdrop-blur-sm ${compact ? 'flex h-14 w-14 items-center justify-center rounded-full text-2xl' : 'rounded-lg px-2 py-1 text-xs'} ${cls}`}
    >
      📢{compact ? '' : held ? ` ${t('Shouting…')}` : ` ${t('Hold to shout')}`}
    </button>
  );
}
