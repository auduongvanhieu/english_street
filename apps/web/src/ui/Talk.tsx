import { Icon } from './icons';
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { Sheet, SheetHeader } from './Sheet';
import { useVoice } from '../store/voice';
import { useSettings } from '../store/settings';
import { startStt, type SttHandle } from '../voice/stt';
import { track } from '../net/analytics';
import { PROXIMITY_RADIUS, INTERACT_RADIUS } from '@es/shared';
import { useGame } from '../store/game';
import { useTalk } from '../store/talk';
import { useFollow } from '../store/follow';
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
  const following = useFollow((s) => s.target?.id === id);
  const vc = useVoiceChat();
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
          <div className="text-xs text-gray-500">{near ? t('nearby') : t('{distance} m away — walk closer to chat, or call', { distance: Math.round(d) })}{p.talkWith ? ` · ${t('in a conversation')}` : ''}</div>
        </div>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 text-sm text-gray-500" aria-label={t('Close player menu')}>
          ✕
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <button type="button" disabled={!near || busy} onClick={() => talk.request(p.id, p.name)} className="min-h-11 rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-50">
          💬 {t('Request to talk')}
        </button>
        {vc.supported && (
          <button type="button" disabled={busy} onClick={() => talk.request(p.id, p.name, true)} className="min-h-11 rounded-lg bg-green-600 text-sm font-medium text-white disabled:opacity-50">
            📞 {t('Voice call (any distance)')}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (following) useFollow.getState().stop();
            else useFollow.getState().start(p.id, p.name);
            close(null);
          }}
          className={`min-h-11 rounded-lg text-sm font-medium ${following ? 'border border-gray-300 text-gray-700' : 'bg-emerald-600 text-white'}`}
        >
          🚶 {following ? t('Stop following') : t('Follow')}
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

/** A soft phone ring (two short beeps every 2 s) while someone is calling us. */
function useRing(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const beep = (at: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.12, at + 0.02);
      g.gain.setValueAtTime(0.12, at + 0.18);
      g.gain.linearRampToValueAtTime(0, at + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.25);
    };
    const ring = () => {
      void ctx.resume();
      beep(ctx.currentTime + 0.01);
      beep(ctx.currentTime + 0.32);
    };
    ring();
    const timer = window.setInterval(ring, 2000);
    return () => {
      window.clearInterval(timer);
      void ctx.close();
    };
  }, [on]);
}

/** Incoming request or call / waiting (with cancel) / notices for private talks. */
export function TalkToast() {
  const inc = useTalk((s) => s.incoming);
  const pending = useTalk((s) => s.pendingTo);
  const notice = useTalk((s) => s.notice);
  const accept = useTalk((s) => s.accept);
  const decline = useTalk((s) => s.decline);
  const cancel = useTalk((s) => s.cancel);
  const t = useT();
  useRing(!!inc?.call);
  // nobody answers for 30 s: let it go
  useEffect(() => {
    if (!inc) return;
    const timer = window.setTimeout(() => useTalk.getState().decline(), 30_000);
    return () => window.clearTimeout(timer);
  }, [inc]);
  if (inc) {
    const [before, after = ''] = (inc.call ? t('{name} is calling you.') : t('{name} would like to talk with you.')).split('{name}');
    return (
      <div data-ui className={`${TOP} w-[92vw] max-w-sm rounded-xl bg-white p-4 shadow-2xl`}>
        <p className="text-sm">
          {inc.call ? <span className="mr-1 inline-block animate-bounce">📞</span> : null}
          {before}
          <b>{inc.name}</b>
          {after}
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={accept} className={`min-h-11 flex-1 rounded-lg text-sm font-medium text-white ${inc.call ? 'bg-green-600' : 'bg-blue-600'}`}>
            {inc.call ? `📞 ${t('Answer the call')}` : t('Accept')}
          </button>
          <button type="button" onClick={decline} className="min-h-11 flex-1 rounded-lg border text-sm">
            {t('Not now')}
          </button>
        </div>
      </div>
    );
  }
  if (pending)
    return (
      <div data-ui className={`${TOP} flex items-center gap-3 rounded-xl bg-white/95 py-1.5 pl-4 pr-1.5 text-sm shadow`}>
        <span>{pending.call ? `📞 ${t('Calling {name}…', { name: pending.name })}` : t('Asking {name}…', { name: pending.name })}</span>
        <button type="button" onClick={cancel} className="min-h-9 rounded-lg bg-red-50 px-3 text-sm font-medium text-red-700">
          {t('Cancel')}
        </button>
      </div>
    );
  if (notice) return <div className={`${TOP} rounded-xl bg-white/90 px-4 py-2 text-sm shadow`}>{notice}</div>;
  return null;
}

/**
 * The talk or call while its chat window is closed: a small bar at the top so you can walk, play and do
 * other things meanwhile. Shows the call timer and mute for calls, the last message and unread count for chats.
 */
export function TalkBar() {
  const partner = useTalk((s) => s.partner);
  const open = useTalk((s) => s.open);
  const call = useTalk((s) => s.call);
  const startedAt = useTalk((s) => s.startedAt);
  const unread = useTalk((s) => s.unread);
  const typing = useTalk((s) => s.partnerTyping);
  const last = useTalk((s) => s.lines[s.lines.length - 1]);
  const setOpen = useTalk((s) => s.setOpen);
  const end = useTalk((s) => s.end);
  const vc = useVoiceChat();
  const t = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!partner || open || !call) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [partner, open, call]);
  if (!partner || open) return null;
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const connected = vc.connected.includes(partner.id);
  const sub = call
    ? !vc.mic
      ? t('microphone off')
      : connected
        ? `${clock}${vc.muted ? ` · ${t('muted')}` : ''}`
        : t('connecting voice…')
    : typing
      ? t('{name} is typing…', { name: partner.name })
      : last
        ? `${last.from === 'me' ? `${t('You')}: ` : ''}${last.text}`
        : t('Tap to open the chat');
  return (
    <div data-ui className={`${TOP} flex w-[min(92vw,22rem)] items-center gap-2 rounded-2xl p-1.5 pl-3 shadow-xl ${call ? 'bg-green-700 text-white' : 'bg-white text-gray-900'}`} role="status" aria-label={call ? t('Call with {name}', { name: partner.name }) : t('Talking to {name}', { name: partner.name })}>
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={`text-lg ${call && connected && !vc.muted ? 'animate-pulse' : ''}`}>{call ? '📞' : '💬'}</span>
        <span className="min-w-0">
          <b className="block truncate text-sm leading-tight">{partner.name}</b>
          <span className={`block truncate text-xs ${call ? 'text-green-100' : 'text-gray-500'}`}>{sub}</span>
        </span>
      </button>
      {call && (
        <button type="button" onClick={() => (vc.mic ? vc.toggleMute() : void vc.enable())} className={`min-h-10 min-w-10 rounded-full text-lg ${vc.mic && !vc.muted ? 'bg-white/20' : 'bg-white text-gray-900'}`} aria-label={vc.mic ? (vc.muted ? t('Unmute') : t('Mute')) : t('Turn on microphone')} title={vc.mic ? (vc.muted ? t('Unmute') : t('Mute')) : t('Turn on microphone')}>
          {vc.mic && !vc.muted ? '🎙️' : '🔇'}
        </button>
      )}
      <button type="button" onClick={() => setOpen(true)} className={`relative min-h-10 min-w-10 rounded-full text-lg ${call ? 'bg-white/20' : 'bg-gray-100'}`} aria-label={t('Open chat')} title={t('Open chat')}>
        💬
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1 text-xs font-bold text-white">{unread}</span>}
      </button>
      <button type="button" onClick={end} className="min-h-10 min-w-10 rounded-full bg-red-600 text-lg text-white" aria-label={call ? t('Hang up') : t('End conversation')} title={call ? t('Hang up') : t('End conversation')}>
        {call ? '☎️' : '✕'}
      </button>
    </div>
  );
}

/**
 * The private conversation with another player, laid out like the NPC conversation (NpcPanel): a sheet with the
 * partner's name and voice state, chat bubbles (listen 🔊 / translate on theirs), 🎤 speech-to-text and Send.
 */
export function TalkBox(_props: { compact: boolean }) {
  const partner = useTalk((s) => s.partner);
  const lines = useTalk((s) => s.lines);
  const typing = useTalk((s) => s.partnerTyping);
  const send = useTalk((s) => s.send);
  const notifyTyping = useTalk((s) => s.typing);
  const end = useTalk((s) => s.end);
  const open = useTalk((s) => s.open);
  const call = useTalk((s) => s.call);
  const setOpen = useTalk((s) => s.setOpen);
  const vc = useVoiceChat();
  const voice = useVoice();
  const micMode = useSettings((s) => s.micMode);
  const t = useT();
  const partnerPlayer = useGame((s) => (partner ? s.players[partner.id] : undefined));
  const [text, setText] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const stt = useRef<SttHandle | null>(null);
  const sttRun = useRef<object | null>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [lines.length, typing]);
  useEffect(() => {
    // phones: no automatic keyboard (it would cover the conversation); tap the field to type
    if (partner && open && !matchMedia('(pointer: coarse)').matches) input.current?.focus();
  }, [partner, open]);
  useEffect(() => () => stt.current?.abort(), []);
  if (!partner || !open) return null;
  const voiceConnected = vc.connected.includes(partner.id);
  const status = vc.supported
    ? vc.mic
      ? voiceConnected
        ? vc.muted
          ? t('voice on · you are muted')
          : t('voice on · they can hear you')
        : t('connecting voice…')
      : partnerPlayer?.voice
        ? t('listening · turn on your mic to speak')
        : t('text only · tap 🎙️ to use your voice')
    : t('text conversation');

  function submit(e: FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    if (stt.current) {
      sttRun.current = null;
      stt.current.abort();
    }
    send(msg);
    setText('');
  }
  function onType(v: string) {
    setText(v);
    const now = Date.now();
    if (now - lastTyping.current > 1500) {
      lastTyping.current = now;
      notifyTyping();
    }
  }
  // --- 🎤 speech to text, same behaviour as with NPCs (tap to start/stop, or hold — Settings) ---
  function micStart() {
    setSttError(null);
    voice.stop();
    const base = text.trim();
    track('stt_used');
    const run = {};
    sttRun.current = run;
    const live = () => sttRun.current === run;
    stt.current = startStt({
      lang: 'en-US',
      onInterim: (s) => live() && onType(base ? `${base} ${s}` : s),
      onFinal: (s) => live() && onType(base ? `${base} ${s}` : s),
      onError: (code) => {
        if (!live()) return;
        if (code === 'not-allowed') setSttError(t('Microphone permission denied'));
        else if (code === 'no-speech') setSttError(micMode === 'hold' ? t('No speech detected. Hold the mic and speak clearly.') : t('No speech detected. Tap the mic and speak clearly.'));
        else if (code !== 'aborted') setSttError(t('Speech recognition error: {code}', { code }));
      },
      onEnd: () => {
        stt.current = null;
        voice.setListening(false);
      },
    });
    if (stt.current) voice.setListening(true);
    else setSttError(t('Voice input is not supported in this browser (try Chrome or Edge).'));
  }
  const micDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (micMode !== 'hold' || stt.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    micStart();
  };
  const micUp = () => micMode === 'hold' && stt.current?.stop();
  const micClick = () => {
    if (micMode !== 'tap') return;
    if (stt.current) stt.current.stop();
    else micStart();
  };

  return (
    <Sheet onClose={() => setOpen(false)} label={t('Talking to {name}', { name: partner.name })}>
      <SheetHeader>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold leading-tight">{call ? '📞' : '💬'} {partner.name}</h2>
          <p className="truncate text-xs text-gray-500">{status}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {vc.supported && (
            <button type="button" onClick={() => (vc.mic ? vc.toggleMute() : void vc.enable())} className={`min-h-9 min-w-9 rounded-lg px-2 text-sm ${vc.mic && !vc.muted ? 'bg-green-100' : 'bg-gray-100'}`} aria-label={vc.mic ? (vc.muted ? t('Unmute') : t('Mute')) : t('Turn on microphone')} title={t('Voice chat')}>
              {vc.mic ? (vc.muted ? '🔇' : '🎙️') : '📞'}
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} className="min-h-9 rounded-lg bg-gray-100 px-2 text-sm" aria-label={t('Minimize — keep talking while you play')} title={t('Minimize — keep talking while you play')}>
            ▾ {t('Minimize')}
          </button>
          <button type="button" onClick={end} className="min-h-9 rounded-lg bg-red-50 px-3 text-sm font-medium text-red-700" aria-label={t('End conversation')}>
            {t('End')}
          </button>
        </div>
      </SheetHeader>
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ minHeight: 140 }}>
        {lines.length === 0 && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">{t('Say hello in English! Nobody else can read this conversation.')}</p>}
        {lines.map((l, i) => {
          const mine = l.from === 'me';
          return (
            <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[85%] items-start gap-1 rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'}`}>
                <span dir="ltr">{l.text}</span>
                {!mine && <TranslateButton text={l.text} dark />}
                {!mine && voice.ttsSupported && (
                  <button type="button" onClick={() => useVoice.getState().speakAs('player', l.text, 'en-US')} className="ml-1 shrink-0 opacity-50 hover:opacity-100" aria-label={t('Listen again')} title={t('Listen again')}>
                    🔊
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-400">{t('{name} is typing…', { name: partner.name })}</div>
          </div>
        )}
        {sttError && <p className="text-sm text-red-600">{sttError}</p>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t p-3">
        {voice.sttSupported && (
          <button
            type="button"
            onPointerDown={micDown}
            onPointerUp={micUp}
            onPointerCancel={micUp}
            onPointerLeave={micUp}
            onClick={micClick}
            aria-label={micMode === 'hold' ? t('Hold to talk') : voice.listening ? t('Tap to stop') : t('Tap to talk')}
            className={`min-h-11 min-w-11 select-none rounded-lg px-3 py-2 text-lg touch-none ${voice.listening ? 'animate-pulse bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            🎤
          </button>
        )}
        <input
          ref={input}
          value={text}
          onChange={(e) => onType(e.target.value)}
          placeholder={voice.listening ? t('Listening…') : t('Message {name}…', { name: partner.name })}
          maxLength={300}
          enterKeyHint="send"
          className="min-h-11 min-w-0 flex-1 rounded-lg border px-3 py-2 text-base sm:text-sm"
        />
        <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {t('Send')}
        </button>
      </form>
      <span className="hidden">{getPlayerId()}</span>
    </Sheet>
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
  const cls = compact ? (held ? 'bg-red-500 text-white ring-1 ring-red-300' : 'bg-white/85 text-slate-700 ring-1 ring-black/5 shadow-md') : held ? 'bg-red-600 text-white' : 'bg-black/45 text-white hover:bg-black/60';
  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      title={t('Hold to shout (voice heard across the street)')}
      aria-label={t('Hold to shout')}
      className={`touch-none select-none shadow backdrop-blur-md ${compact ? 'flex h-11 w-11 items-center justify-center rounded-full' : 'rounded-lg px-2 py-1 text-xs'} ${cls}`}
    >
      {compact ? <Icon name="megaphone" /> : `📢 ${held ? t('Shouting…') : t('Hold to shout')}`}
    </button>
  );
}

/** "Following X" chip with a Stop button (keys / joystick also stop it). */
export function FollowChip() {
  const target = useFollow((s) => s.target);
  const t = useT();
  if (!target) return null;
  return (
    <div data-ui className={`${TOP} flex items-center gap-2 rounded-full bg-emerald-600 py-1 pe-1 ps-4 text-sm font-medium text-white shadow-lg`}>
      🚶 {t('Following {name}', { name: target.name })}
      <button type="button" onClick={() => useFollow.getState().stop()} className="min-h-9 rounded-full bg-white/20 px-3 text-sm hover:bg-white/30">
        {t('Stop')}
      </button>
    </div>
  );
}
