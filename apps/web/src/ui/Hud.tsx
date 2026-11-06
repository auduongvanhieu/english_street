import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon, type IconName } from './icons';
import { EMOTES, type Emote } from '@es/shared';
import { useGame } from '../store/game';
import { useVoiceChat } from '../net/voicechat';
import { usePair } from '../store/pair';
import { API_URL, sendFeedback } from '../net/api';
import { useSettings } from '../store/settings';
import { getPlayerId } from '../net/player';
import { sendChat, sendShout } from '../net/client';
import { translateText } from '../net/api';
import { track } from '../net/analytics';
import { t, useLang, useT } from '../i18n';

const EMOTE_ICON: Record<Emote, string> = { wave: '👋', dance: '💃', thumbsup: '👍', yes: '✅', no: '❌' };

/** Emote name shown in tooltips (call during render of a component that uses `useT`). */
function emoteLabel(e: Emote): string {
  const labels: Record<Emote, string> = { wave: t('wave'), dance: t('dance'), thumbsup: t('thumbs up'), yes: t('yes'), no: t('no') };
  return labels[e];
}

/** Translated sentence with `{key}` placeholders filled by React nodes (keeps the sentence whole for translators). */
function rich(s: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return s.split(/\{(\w+)\}/).map((piece, i) => (i % 2 === 0 ? piece : <span key={i}>{piece in parts ? parts[piece] : `{${piece}}`}</span>));
}

/** Round translucent HUD button, ≥44px so it is comfortable to tap. */
/**
 * Jump (touch): fires on pointerdown, not click. Phones (iOS especially) send no click for a second finger while
 * the first one is holding the joystick, so "run and jump" never worked with onClick.
 */
export function JumpButton({ onJump, title }: { onJump: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onJump();
      }}
      onClick={(e) => {
        // keyboard / screen readers (a real tap was already handled on pointerdown)
        if (e.detail === 0) onJump();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={`${HUD_BTN} ${HUD_OFF} h-14 w-14 touch-none select-none`}
    >
      <Icon name="jump" size={26} />
    </button>
  );
}

/** One look for every round HUD button on phones: frosted white, slate icon; "on" = sky blue. */
const HUD_BTN = 'flex shrink-0 items-center justify-center rounded-full shadow-md ring-1 backdrop-blur-md transition active:scale-95';
const HUD_OFF = 'bg-white/85 text-slate-700 ring-black/5 hover:bg-white';
const HUD_ON = 'bg-sky-500 text-white ring-sky-300';

export function HudButton({ onClick, title, active, children, className = '', big }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode; className?: string; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`${HUD_BTN} ${big ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-xl'} ${active ? HUD_ON : HUD_OFF} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Contextual action for phones (talk, sit, use, hug): a filled colour circle with a white line icon, and what it
 * does written in a small pill beside it.
 */
export function ActionCircle({ onClick, icon, badge, label, color }: { onClick: () => void; icon: IconName | string; badge?: string; label: string; color: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-lg ring-2 ring-white/80 transition active:scale-95 ${color}`}>
      {isIcon(icon) ? <Icon name={icon} size={26} /> : <span className="text-2xl">{icon}</span>}
      <span className="pointer-events-none absolute right-full mr-2 max-w-[11rem] truncate rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white shadow backdrop-blur-sm">{label}</span>
      {badge ? <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm shadow">{badge}</span> : null}
    </button>
  );
}
const ICONS = new Set<string>(['menu', 'close', 'more', 'users', 'map', 'settings', 'feedback', 'exit', 'mic', 'micOff', 'voice', 'chat', 'talk', 'jump', 'smile', 'megaphone', 'chair', 'stand', 'hand', 'heart', 'drop', 'sun', 'moon', 'cloud', 'rain', 'storm', 'fog', 'target', 'pin', 'graphics', 'bolt']);
const isIcon = (v: string): v is IconName => ICONS.has(v);

/** A group of HUD buttons behind a ☰ / ⋯ toggle (phones); open/closed is remembered. */
export function Collapsible({ id, icon, title, children, reverse, row }: { id: string; icon: IconName; title: string; children: React.ReactNode; reverse?: boolean; row?: boolean }) {
  const key = `es.hud.${id}`;
  const [open, setOpen] = useState(() => localStorage.getItem(key) === '1');
  const toggle = () =>
    setOpen((o) => {
      localStorage.setItem(key, o ? '0' : '1');
      return !o;
    });
  const btn = (
    <HudButton onClick={toggle} title={title} active={open}>
      <Icon name={open ? 'close' : icon} />
    </HudButton>
  );
  // row: the buttons open in a line to the left of the toggle (top-right menu, so it never covers the action column)
  if (row)
    return (
      <div className="relative">
        {btn}
        {open ? <div className="absolute right-full top-0 mr-2 flex flex-row-reverse items-center gap-2">{children}</div> : null}
      </div>
    );
  // on short screens (phones held sideways) the opened buttons line up in a row: a column would run off the bottom
  const items = open ? <div className="flex flex-col items-end gap-2 [@media(max-height:500px)]:flex-row-reverse">{children}</div> : null;
  return (
    <>
      {reverse ? items : null}
      {btn}
      {!reverse ? items : null}
    </>
  );
}

export function EmoteBar({ compact }: { compact?: boolean }) {
  const play = useGame((s) => s.playEmote);
  const [open, setOpen] = useState(false);
  const t = useT();
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {open &&
          EMOTES.map((e) => (
            <HudButton key={e} onClick={() => { play(e); setOpen(false); }} title={emoteLabel(e)}>
              {EMOTE_ICON[e]}
            </HudButton>
          ))}
        <HudButton onClick={() => setOpen((o) => !o)} title={t('Emotes')} active={open}>
          <Icon name="smile" />
        </HudButton>
      </div>
    );
  }
  return (
    <div className="flex gap-1 rounded-lg bg-black/40 p-1">
      {EMOTES.map((e, i) => (
        <button key={e} type="button" onClick={() => play(e)} title={t('{emote} (key {n})', { emote: emoteLabel(e), n: i + 1 })} className="rounded px-2 py-1 text-lg hover:bg-white/20">
          {EMOTE_ICON[e]}
        </button>
      ))}
    </div>
  );
}

export function VoiceChatButton({ compact }: { compact?: boolean }) {
  const vc = useVoiceChat();
  const t = useT();
  if (!vc.supported) return null;
  const toggle = () => (vc.enabled ? vc.disable() : void vc.enable());
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {vc.enabled && (
          <HudButton onClick={vc.toggleMute} title={vc.muted ? t('Unmute microphone') : t('Mute microphone')} className={vc.muted ? '!bg-red-500 !text-white !ring-red-300' : ''}>
            <Icon name={vc.muted ? 'micOff' : 'mic'} />
          </HudButton>
        )}
        <HudButton onClick={toggle} title={vc.enabled ? t('Voice chat on') : t('Voice chat off')} active={vc.enabled}>
          <Icon name="voice" />
        </HudButton>
        {vc.error && <span className="rounded bg-black/50 px-2 py-1 text-xs text-yellow-300">{vc.error}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1 text-xs text-white">
      <button type="button" onClick={toggle} className={`rounded px-2 py-1 ${vc.enabled ? 'bg-green-600' : 'hover:bg-white/20'}`} title={t('Proximity voice chat: talk to players near you')}>
        🎙️ {vc.enabled ? t('Voice on · {count} nearby', { count: vc.connected.length }) : t('Voice off')}
      </button>
      {vc.enabled && (
        <button type="button" onClick={vc.toggleMute} className={`rounded px-2 py-1 ${vc.muted ? 'bg-red-600' : 'hover:bg-white/20'}`} aria-label={vc.muted ? t('Unmute microphone') : t('Mute microphone')}>
          {vc.muted ? '🔇' : '🎤'}
        </button>
      )}
      {vc.error && <span className="px-1 text-yellow-300">{vc.error}</span>}
    </div>
  );
}

/** Big "Talk to X" button for touch screens (desktop uses the keyboard prompt). */
export function TalkButton({ compact }: { compact?: boolean }) {
  const target = useGame((s) => s.interactTarget);
  const npc = useGame((s) => s.npcs.find((n) => n.id === target));
  const open = useGame((s) => s.openPanel);
  const t = useT();
  if (!npc) return null;
  if (compact) return <ActionCircle onClick={() => open(npc.id)} icon="talk" label={t('Talk to {name}', { name: npc.name })} color="bg-amber-500" />;
  return (
    <button
      type="button"
      onClick={() => open(npc.id)}
      className="flex min-h-14 items-center gap-2 rounded-full bg-yellow-400 px-5 text-base font-semibold text-black shadow-lg ring-2 ring-white/70 active:scale-95"
    >
      💬 {t('Talk to {name}', { name: npc.name })}
    </button>
  );
}

/** First-run hint shown briefly after joining. */
export function HintToast({ touch }: { touch: boolean }) {
  const [show, setShow] = useState(true);
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(() => setShow(false), touch ? 7000 : 12000);
    return () => clearTimeout(timer);
  }, [touch]);
  if (!show) return null;
  return (
    <div className={`pointer-events-none absolute left-1/2 z-10 max-w-[90vw] -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-center text-xs text-white ${touch ? 'top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]' : 'bottom-3'}`}>
      {touch ? t('Joystick to move · drag to look around · walk up to a shop and tap Talk · 🗺️ map and 🚌 bus to the zoo, farm, supermarket and restaurant') : t('WASD / arrows or click to move · Shift to run · E to talk or sit · F to hug a pet · M map · G area guide · Enter to chat · 1-5 emotes · drag to look around')}
    </div>
  );
}

/** Nearby chat: compact overlay of the last lines plus an input that stays above the on-screen keyboard. */
export function ChatBox({ compact, open, onClose }: { compact: boolean; open: boolean; onClose: () => void }) {
  const chatLog = useGame((s) => s.chatLog);
  const [chat, setChat] = useState('');
  const [shout, setShout] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const t = useT();
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
    const msg = chat.trim();
    if (msg && shout) {
      sendShout(msg);
      track('shout');
      setShout(false);
    } else if (msg) sendChat(msg);
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
          <div key={i} className={`truncate ${m.shout ? 'text-yellow-300' : ''}`}>
            {m.shout ? '📢 ' : ''}<b>{m.name}:</b> <span dir="ltr">{m.text}</span>
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
          <span className="opacity-60">{t('Nearby chat will appear here.')}</span>
        ) : (
          chatLog.map((m, i) => (
            <div key={i} className={m.shout ? 'text-yellow-300' : ''}>
              {m.shout ? '📢 ' : ''}<b>{m.name}:</b> <span dir="ltr">{m.text}</span>
              <TranslateButton text={m.text} />
              <ReportButton targetName={m.name} targetPlayerId={m.pid} />
            </div>
          ))
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <button
          type="button"
          onClick={() => setShout((v) => !v)}
          aria-pressed={shout}
          title={shout ? t('Shout: everyone across the street will read this') : t('Shout (heard further away, once every 5 s)')}
          className={`min-h-11 shrink-0 rounded-lg px-2 text-base sm:min-h-0 ${shout ? 'bg-red-600 text-white' : 'bg-black/40 text-white/80'}`}
        >
          📢
        </button>
        <input ref={input} value={chat} onChange={(e) => setChat(e.target.value)} placeholder={shout ? t('Shout to the whole street…') : t('Say something in English…')} maxLength={140} enterKeyHint="send" className={`min-h-11 w-full rounded-lg border bg-white/90 px-3 py-2 text-base sm:min-h-0 sm:text-sm ${shout ? 'ring-2 ring-red-500' : ''}`} />
        {compact && (
          <>
            <button type="submit" className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white">{t('Send')}</button>
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg bg-white/20 px-3 text-sm text-white" aria-label={t('Close chat')}>✕</button>
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
  const t = useT();
  if (state) return null;
  const top = 'absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-20 -translate-x-1/2';
  if (inv)
    return (
      <div data-ui className={`${top} w-[92vw] max-w-sm rounded-xl bg-white p-4 shadow-2xl`}>
        <p className="text-sm">
          {rich(t('{inviter} invites you to {quest} — you would play the {role}.'), { inviter: <b>{inv.inviterName}</b>, quest: <b dir="ltr">{inv.questTitle}</b>, role: <b dir="ltr">{inv.yourRole}</b> })}
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={accept} className="min-h-11 flex-1 rounded-lg bg-purple-600 text-sm font-medium text-white">
            {t('Accept')}
          </button>
          <button type="button" onClick={decline} className="min-h-11 flex-1 rounded-lg border text-sm">
            {t('Decline')}
          </button>
        </div>
      </div>
    );
  if (pending) return <div className={`${top} rounded-xl bg-white/90 px-4 py-2 text-sm shadow`}>{t('Waiting for {name} to accept…', { name: pending.name })}</div>;
  if (err && !inv) return <div className={`${top} rounded-xl bg-white/90 px-4 py-2 text-sm text-red-700 shadow`}>{err}</div>;
  return null;
}

/** "translate" link under a chat line: translation into the learner's language on demand (cached server-side). */
export function TranslateButton({ text, dark }: { text: string; dark?: boolean }) {
  const [vi, setVi] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const lang = useLang((s) => s.lang);
  if (lang === 'en') return null;
  if (vi) return <div className={`text-xs ${dark ? 'text-blue-800' : 'text-blue-200'}`}>{vi}</div>;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        track('translate_chat');
        translateText(text)
          .then((r) => setVi(r.text))
          .catch(() => setVi(t('(cannot translate right now)')))
          .finally(() => setBusy(false));
      }}
      className={`ml-1 px-1 text-xs ${dark ? 'text-gray-400 hover:text-gray-700' : 'text-gray-300 hover:text-white'}`}
      title={t('Translate')}
    >
      {busy ? '…' : t('translate')}
    </button>
  );
}

/** Report a player from the chat log. */
export function ReportButton({ targetName, targetPlayerId }: { targetName: string; targetPlayerId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const chatLog = useGame((s) => s.chatLog);
  const t = useT();
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
  if (sent) return <span className="ml-1 text-[10px] text-gray-400">{t('reported')}</span>;
  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="px-1 text-xs text-gray-400 hover:text-red-400" title={t('Report {name}', { name: targetName })} aria-label={t('Report {name}', { name: targetName })}>
        ⚑
      </button>
      {open &&
        ['harassment', 'spam', 'inappropriate', 'cheating', 'other'].map((r) => (
          <button key={r} type="button" onClick={() => void report(r)} className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-gray-800 hover:bg-red-100">
            {{ harassment: t('harassment'), spam: t('spam'), inappropriate: t('inappropriate'), cheating: t('cheating'), other: t('other') }[r]}
          </button>
        ))}
    </span>
  );
}

/** Graphics quality: low = no shadows, 1x pixel ratio, fewer distant players. */
export function QualityToggle({ compact }: { compact?: boolean }) {
  const quality = useSettings((s) => s.quality);
  const set = useSettings((s) => s.setQuality);
  const t = useT();
  const toggle = () => set(quality === 'high' ? 'low' : 'high');
  if (compact)
    return (
      <HudButton onClick={toggle} title={t('Graphics: {quality}', { quality: quality === 'high' ? t('high') : t('low') })}>
        {quality === 'high' ? '✨' : '⚡'}
      </HudButton>
    );
  return (
    <button type="button" onClick={toggle} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title={t('Graphics quality (switch to Low on slow devices)')}>
      ⚙️ {quality === 'high' ? t('High') : t('Low')}
    </button>
  );
}

/** Beta feedback form (text goes to the Feedback table, visible at GET /admin/feedback). */
export function FeedbackButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const name = useGame((s) => s.playerName);
  const t = useT();
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
        <HudButton onClick={() => setOpen(true)} title={t('Send feedback')}>
          <Icon name="feedback" />
        </HudButton>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title={t('Send feedback to the team')}>
          💬 {t('Feedback')}
        </button>
      )}
      {/* fixed: centred on the screen, not on the button (on phones the button sits in the narrow right-hand column) */}
      {open && (
        <div data-ui className="fixed left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-50 max-h-[calc(100dvh-5rem)] w-[92vw] max-w-sm -translate-x-1/2 overflow-y-auto rounded-xl bg-white p-4 shadow-2xl">
          <form onSubmit={submit}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm">{t('Tell us what you think')}</b>
              <button type="button" onClick={() => setOpen(false)} className="min-h-9 min-w-9 text-sm text-gray-500" aria-label={t('Close feedback')}>
                ✕
              </button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} placeholder={t('What worked? What was confusing? Any bugs? (any language)')} className="w-full rounded-lg border px-2 py-1 text-base sm:text-sm" />
            <button type="submit" disabled={state === 'busy' || text.trim().length < 3} className="mt-2 min-h-11 w-full rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-50">
              {state === 'busy' ? t('Sending…') : state === 'sent' ? t('Thank you! ✓') : state === 'error' ? t('Failed — try again') : t('Send')}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
