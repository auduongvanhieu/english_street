import { useState } from 'react';
import { EMOTES, type Emote } from '@es/shared';
import { useGame } from '../store/game';
import { useVoiceChat } from '../net/voicechat';
import { usePair } from '../store/pair';
import { API_URL, sendFeedback } from '../net/api';
import { useSettings } from '../store/settings';
import { getPlayerId } from '../net/player';

const EMOTE_ICON: Record<Emote, string> = { wave: '👋', dance: '💃', thumbsup: '👍', yes: '✅', no: '❌' };

export function EmoteBar() {
  const play = useGame((s) => s.playEmote);
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

export function VoiceChatButton() {
  const vc = useVoiceChat();
  if (!vc.supported) return null;
  return (
    <div className="flex items-center gap-1 rounded-lg bg-black/40 p-1 text-xs text-white">
      <button
        type="button"
        onClick={() => (vc.enabled ? vc.disable() : void vc.enable())}
        className={`rounded px-2 py-1 ${vc.enabled ? 'bg-green-600' : 'hover:bg-white/20'}`}
        title="Proximity voice chat: talk to players near you"
      >
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

export function InviteToast() {
  const inv = usePair((s) => s.invite);
  const accept = usePair((s) => s.accept);
  const decline = usePair((s) => s.decline);
  const pending = usePair((s) => s.pendingTo);
  const err = usePair((s) => s.error);
  const state = usePair((s) => s.state);
  if (state) return null;
  if (inv)
    return (
      <div className="absolute left-1/2 top-16 w-80 -translate-x-1/2 rounded-xl bg-white p-4 shadow-2xl">
        <p className="text-sm">
          <b>{inv.inviterName}</b> invites you to <b>{inv.questTitle}</b> — you would play the <b>{inv.yourRole}</b>.
        </p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={accept} className="flex-1 rounded-lg bg-purple-600 py-1.5 text-sm font-medium text-white">
            Accept
          </button>
          <button type="button" onClick={decline} className="flex-1 rounded-lg border py-1.5 text-sm">
            Decline
          </button>
        </div>
      </div>
    );
  if (pending)
    return <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-xl bg-white/90 px-4 py-2 text-sm shadow">Waiting for {pending.name} to accept…</div>;
  if (err && !inv) return <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-xl bg-white/90 px-4 py-2 text-sm text-red-700 shadow">{err}</div>;
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
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-[10px] text-gray-400 hover:text-red-400" title={`Report ${targetName}`} aria-label={`Report ${targetName}`}>
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
export function QualityToggle() {
  const quality = useSettings((s) => s.quality);
  const set = useSettings((s) => s.setQuality);
  return (
    <button
      type="button"
      onClick={() => set(quality === 'high' ? 'low' : 'high')}
      className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60"
      title="Graphics quality (switch to Low on slow devices)"
    >
      ⚙️ {quality === 'high' ? 'High' : 'Low'}
    </button>
  );
}

/** Beta feedback form (text goes to the Feedback table, visible at GET /admin/feedback). */
export function FeedbackButton() {
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
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title="Send feedback to the team">
        💬 Feedback
      </button>
      {open && (
        <div className="absolute left-0 top-24 z-20 w-80 rounded-xl bg-white p-4 shadow-2xl">
          <form onSubmit={submit}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm">Tell us what you think</b>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500" aria-label="Close feedback">
                ✕
              </button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} placeholder="What worked? What was confusing? Any bugs? (English or Tiếng Việt)" className="w-full rounded-lg border px-2 py-1 text-sm" />
            <button type="submit" disabled={state === 'busy' || text.trim().length < 3} className="mt-2 w-full rounded-lg bg-blue-600 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {state === 'busy' ? 'Sending…' : state === 'sent' ? 'Thank you! ✓' : state === 'error' ? 'Failed — try again' : 'Send'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
