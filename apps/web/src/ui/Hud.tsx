import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EMOTES, type Emote } from '@es/shared';
import { useGame } from '../store/game';
import { useVoiceChat } from '../net/voicechat';
import { usePair } from '../store/pair';
import { API_URL, sendFeedback } from '../net/api';
import { useSettings } from '../store/settings';
import { getPlayerId } from '../net/player';
import { sendChat } from '../net/client';

const EMOTE_ICON: Record<Emote, string> = { wave: '👋', dance: '💃', thumbsup: '👍', yes: '✅', no: '❌' };

/** Round translucent HUD button, ≥44px so it is comfortable to tap. */
export function HudButton({ onClick, title, active, children, className = '', big }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode; className?: string; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex shrink-0 items-center justify-center rounded-full text-white shadow backdrop-blur-sm active:scale-95 ${big ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-xl'} ${active ? 'bg-green-600' : 'bg-black/45 hover:bg-black/60'} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmoteBar({ compact }: { compact?: boolean }) {
  const play = useGame((s) => s.playEmote);
  const [open, setOpen] = useState(false);
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {open &&
          EMOTES.map((e) => (
            <HudButton key={e} onClick={() => { play(e); setOpen(false); }} title={e}>
              {EMOTE_ICON[e]}
            </HudButton>
          ))}
        <HudButton onClick={() => setOpen((o) => !o)} title="Emotes" active={open}>
          😀
        </HudButton>
      </div>
    );
  }
  return (
    <div className="flex gap-1 rounded-lg bg-black/40 p-1">
      {EMOTES.map((e, i) => (
        <button key={e} type="button" onClick={() => play(e)} title={`${e} (key ${i + 1})`} className="rounded px-2 py-1 text-lg hover:bg-white/20">
          {EMOTE_ICON[e]}
        </button>
      ))}
    </div>
  );
}

export function VoiceChatButton({ compact }: { compact?: boolean }) {
  const vc = useVoiceChat();
  if (!vc.supported) return null;
  const toggle = () => (vc.enabled ? vc.disable() : void vc.enable());
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {vc.enabled && (
          <HudButton onClick={vc.toggleMute} title={vc.muted ? 'Unmute microphone' : 'Mute microphone'} className={vc.muted ? '!bg-red-600' : ''}>
            {vc.muted ? '🔇' : '🎤'}
          </HudButton>
        )}
        <HudButton onClick={toggle} title={`Voice chat ${vc.enabled ? 'on' : 'off'}`} active={vc.enabled}>
          🎙️
        </HudButton>
        {vc.error && <span className="rounded bg-black/50 px-2 py-1 text-xs text-yellow-300">{vc.error}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1 text-xs text-white">
      <button type="button" onClick={toggle} className={`rounded px-2 py-1 ${vc.enabled ? 'bg-green-600' : 'hover:bg-white/20'}`} title="Proximity voice chat: talk to players near you">
        🎙️ Voice {vc.enabled ? `on · ${vc.connected.length} nearby` : 'off'}
      </button>
      {vc.enabled && (
        <button type="button" onClick={vc.toggleMute} className={`rounded px-2 py-1 ${vc.muted ? 'bg-red-600' : 'hover:bg-white/20'}`} aria-label={vc.muted ? 'Unmute microphone' : 'Mute microphone'}>
          {vc.muted ? '🔇' : '🎤'}
        </button>
      )}
      {vc.error && <span className="px-1 text-yellow-300">{vc.error}</span>}
    </div>
  );
}

/** Big "Talk to X" button for touch screens (desktop uses the keyboard prompt). */
export function TalkButton() {
  const target = useGame((s) => s.interactTarget);
  const npc = useGame((s) => s.npcs.find((n) => n.id === target));
  const open = useGame((s) => s.openPanel);
  if (!npc) return null;
  return (
    <button
      type="button"
      onClick={() => open(npc.id)}
      className="flex min-h-14 items-center gap-2 rounded-full bg-yellow-400 px-5 text-base font-semibold text-black shadow-lg ring-2 ring-white/70 active:scale-95"
    >
      💬 Talk to {npc.name}
    </button>
  );
}

/** First-run hint shown briefly after joining. */
export function HintToast({ touch }: { touch: boolean }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), touch ? 7000 : 12000);
    return () => clearTimeout(t);
  }, [touch]);
  if (!show) return null;
  return (
    <div className={`pointer-events-none absolute left-1/2 z-10 max-w-[90vw] -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-center text-xs text-white ${touch ? 'top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]' : 'bottom-3'}`}>
      {touch ? 'Joystick to move · drag to look around · walk up to a shop and tap Talk' : 'WASD / arrows to move · Shift to run · E to talk · Enter to chat · 1-5 emotes · drag to look around'}
    </div>
  );
}

/** Nearby chat: compact overlay of the last lines plus an input that stays above the on-screen keyboard. */
export function ChatBox({ compact, open, onClose }: { compact: boolean; open: boolean; onClose: () => void }) {
  const chatLog = useGame((s) => s.chatLog);
  const [chat, setChat] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [chatLog.length, open]);
  useEffect(() => {
    if (open && compact) input.current?.focus();
  }, [open, compact]);
  // Desktop: Enter focuses the chat input.
  useEffect(() => {
    if (compact) return;
    function onKey(e: KeyboardEvent) {
      const typing = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      if (!typing && e.key === 'Enter' && !useGame.getState().panelNpc) {
        input.current?.focus();
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = chat.trim();
    if (t) sendChat(t);
    setChat('');
    if (compact) onClose();
    else input.current?.blur();
  }

  if (compact && !open) {
    const recent = chatLog.slice(-3);
    if (recent.length === 0) return null;
    return (
      <div className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] w-[70vw] max-w-sm -translate-x-1/2 space-y-0.5 text-center text-xs text-white [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">
        {recent.map((m, i) => (
          <div key={i} className="truncate">
            <b>{m.name}:</b> {m.text}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      data-ui
      className={compact ? 'absolute inset-x-0 z-20 bg-black/60 p-2 backdrop-blur-sm' : 'absolute right-3 w-80'}
      style={{ bottom: compact ? 'var(--kb, 0px)' : 'calc(0.75rem + var(--kb, 0px))' }}
    >
      <div ref={log} className={`mb-2 overflow-y-auto rounded-lg bg-black/40 p-2 text-sm text-white ${compact ? 'max-h-[30dvh]' : 'max-h-36'}`}>
        {chatLog.length === 0 ? (
          <span className="opacity-60">Nearby chat will appear here.</span>
        ) : (
          chatLog.map((m, i) => (
            <div key={i}>
              <b>{m.name}:</b> {m.text}
              <ReportButton targetName={m.name} targetPlayerId={m.pid} />
            </div>
          ))
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input ref={input} value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Say something in English…" maxLength={140} enterKeyHint="send" className="min-h-11 w-full rounded-lg border bg-white/90 px-3 py-2 text-base sm:min-h-0 sm:text-sm" />
        {compact && (
          <>
            <button type="submit" className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white">Send</button>
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-white/20 px-3 text-sm text-white" aria-label="Close chat">✕</button>
          </>
        )}
      </form>
    </div>
  );
}

export function InviteToast() {
  const inv = usePair((s) => s.invite);
  const accept = usePair((s) => s.accept);
  const decline = usePair((s) => s.decline);
  const pending = usePair((s) => s.pendingTo);
  const err = usePair((s) => s.error);
  const state = usePair((s) => s.state);
  if (state) return null;
  const top = 'absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-20 -translate-x-1/2';
  if (inv)
    return (
      <div data-ui className={`${top} w-[92vw] max-w-sm rounded-xl bg-white p-4 shadow-2xl`}>
        <p className="text-sm">
          <b>{inv.inviterName}</b> invites you to <b>{inv.questTitle}</b> — you would play the <b>{inv.yourRole}</b>.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={accept} className="min-h-11 flex-1 rounded-lg bg-purple-600 text-sm font-medium text-white">
            Accept
          </button>
          <button type="button" onClick={decline} className="min-h-11 flex-1 rounded-lg border text-sm">
            Decline
          </button>
        </div>
      </div>
    );
  if (pending) return <div className={`${top} rounded-xl bg-white/90 px-4 py-2 text-sm shadow`}>Waiting for {pending.name} to accept…</div>;
  if (err && !inv) return <div className={`${top} rounded-xl bg-white/90 px-4 py-2 text-sm text-red-700 shadow`}>{err}</div>;
  return null;
}

/** Report a player from the chat log. */
export function ReportButton({ targetName, targetPlayerId }: { targetName: string; targetPlayerId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const chatLog = useGame((s) => s.chatLog);
  if (targetPlayerId === getPlayerId()) return null;
  async function report(reason: string) {
    setOpen(false);
    await fetch(`${API_URL}/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reporterId: getPlayerId(),
        targetName,
        targetPlayerId,
        reason,
        details: '',
        context: chatLog.slice(-10).map((m) => ({ name: m.name, text: m.text })),
      }),
    }).catch(() => undefined);
    setSent(true);
  }
  if (sent) return <span className="ml-1 text-[10px] text-gray-400">reported</span>;
  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="px-1 text-xs text-gray-400 hover:text-red-400" title={`Report ${targetName}`} aria-label={`Report ${targetName}`}>
        ⚑
      </button>
      {open &&
        ['harassment', 'spam', 'inappropriate', 'cheating', 'other'].map((r) => (
          <button key={r} type="button" onClick={() => void report(r)} className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-gray-800 hover:bg-red-100">
            {r}
          </button>
        ))}
    </span>
  );
}

/** Graphics quality: low = no shadows, 1x pixel ratio, fewer distant players. */
export function QualityToggle({ compact }: { compact?: boolean }) {
  const quality = useSettings((s) => s.quality);
  const set = useSettings((s) => s.setQuality);
  const toggle = () => set(quality === 'high' ? 'low' : 'high');
  if (compact)
    return (
      <HudButton onClick={toggle} title={`Graphics: ${quality}`}>
        {quality === 'high' ? '✨' : '⚡'}
      </HudButton>
    );
  return (
    <button type="button" onClick={toggle} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title="Graphics quality (switch to Low on slow devices)">
      ⚙️ {quality === 'high' ? 'High' : 'Low'}
    </button>
  );
}

/** Beta feedback form (text goes to the Feedback table, visible at GET /admin/feedback). */
export function FeedbackButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const name = useGame((s) => s.playerName);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3) return;
    setState('busy');
    try {
      await sendFeedback(text.trim(), name, useGame.getState().panelNpc ? 'npc' : 'street', { quality: useSettings.getState().quality, w: innerWidth, h: innerHeight });
      setState('sent');
      setText('');
      setTimeout(() => {
        setOpen(false);
        setState('idle');
      }, 1500);
    } catch {
      setState('error');
    }
  }
  return (
    <>
      {compact ? (
        <HudButton onClick={() => setOpen(true)} title="Send feedback">📣</HudButton>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title="Send feedback to the team">
          💬 Feedback
        </button>
      )}
      {open && (
        <div data-ui className="absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2 rounded-xl bg-white p-4 shadow-2xl">
          <form onSubmit={submit}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm">Tell us what you think</b>
              <button type="button" onClick={() => setOpen(false)} className="min-h-9 min-w-9 text-sm text-gray-500" aria-label="Close feedback">
                ✕
              </button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} placeholder="What worked? What was confusing? Any bugs? (English or Tiếng Việt)" className="w-full rounded-lg border px-2 py-1 text-base sm:text-sm" />
            <button type="submit" disabled={state === 'busy' || text.trim().length < 3} className="mt-2 min-h-11 w-full rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-50">
              {state === 'busy' ? 'Sending…' : state === 'sent' ? 'Thank you! ✓' : state === 'error' ? 'Failed — try again' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
