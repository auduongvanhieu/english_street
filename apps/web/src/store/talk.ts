import { create } from 'zustand';
import type { TalkMessage } from '@es/shared';
import { onTalk, sendTalk } from '../net/client';
import { track } from '../net/analytics';
import { useGame } from './game';
import { useVoiceChat } from '../net/voicechat';
import { haptic } from '../native/bridge';
import { t } from '../i18n';
import { useVoice } from './voice';

export interface TalkLine {
  from: 'me' | 'them';
  text: string;
  at: number;
}

interface TalkStore {
  /** Someone asked to talk (nearby) or is calling (call: any distance, voice). */
  incoming: { from: string; name: string; call: boolean } | null;
  /** We asked someone and wait for the answer. */
  pendingTo: { id: string; name: string; call: boolean } | null;
  /** Active private talk or call. */
  partner: { id: string; name: string } | null;
  /** The active conversation is a voice call (mic on); text works in both. */
  call: boolean;
  /** When the talk/call started (call timer). */
  startedAt: number;
  /** The chat window is shown; closed = a small bar at the top, the talk goes on while you play. */
  open: boolean;
  /** Messages received while the chat window was closed. */
  unread: number;
  lines: TalkLine[];
  partnerTyping: boolean;
  /** Short status text (declined, busy…) shown for a few seconds. */
  notice: string | null;
  request: (id: string, name: string, call?: boolean) => void;
  /** Withdraw our unanswered request/call. */
  cancel: () => void;
  setOpen: (open: boolean) => void;
  accept: () => void;
  decline: () => void;
  send: (text: string) => void;
  typing: () => void;
  end: () => void;
}

let typingTimer: number | null = null;
/** The mic was switched on for a call (not by the player before): switch it off again when the call is over. */
let micByCall = false;
function callMic() {
  const vc = useVoiceChat.getState();
  if (!vc.mic) micByCall = true;
  void vc.enable();
}
function releaseCallMic() {
  if (micByCall) useVoiceChat.getState().disable();
  micByCall = false;
}
let noticeTimer: number | null = null;
const setNotice = (notice: string | null) => {
  useTalk.setState({ notice });
  if (noticeTimer) window.clearTimeout(noticeTimer);
  if (notice) noticeTimer = window.setTimeout(() => useTalk.setState({ notice: null }), 4000);
};

export const useTalk = create<TalkStore>((set, get) => ({
  incoming: null,
  pendingTo: null,
  partner: null,
  call: false,
  startedAt: 0,
  open: true,
  unread: 0,
  lines: [],
  partnerTyping: false,
  notice: null,

  request(id, name, call = false) {
    if (get().partner || get().pendingTo) return;
    // ask for the mic now, while we still have the user's tap (iOS needs it)
    if (call) callMic();
    sendTalk({ to: id, type: 'request', name: useGame.getState().playerName, call });
    set({ pendingTo: { id, name, call } });
    useGame.getState().setSelectedPlayer(null);
  },
  cancel() {
    const p = get().pendingTo;
    if (!p) return;
    sendTalk({ to: p.id, type: 'end' });
    set({ pendingTo: null });
    releaseCallMic();
  },
  setOpen(open) {
    set(open ? { open, unread: 0 } : { open });
  },
  accept() {
    const inc = get().incoming;
    if (!inc) return;
    if (inc.call) callMic();
    sendTalk({ to: inc.from, type: 'accept' });
    set({ incoming: null });
  },
  decline() {
    const inc = get().incoming;
    if (!inc) return;
    sendTalk({ to: inc.from, type: 'decline' });
    set({ incoming: null });
  },
  send(text) {
    const p = get().partner;
    const msg = text.trim();
    if (!p || !msg) return;
    sendTalk({ to: p.id, type: 'msg', text: msg });
    set((s) => ({ lines: [...s.lines.slice(-99), { from: 'me', text: msg, at: Date.now() }] }));
  },
  typing() {
    const p = get().partner;
    if (p) sendTalk({ to: p.id, type: 'typing' });
  },
  end() {
    const p = get().partner;
    if (p) sendTalk({ to: p.id, type: 'end' });
    finish(t('You ended the conversation.'));
  },
}));

function finish(notice: string | null, reason?: string) {
  const p = useTalk.getState().partner;
  if (p) track('talk_end', { lines: useTalk.getState().lines.length, reason: reason ?? 'self', call: useTalk.getState().call });
  useTalk.setState({ partner: null, call: false, open: true, unread: 0, lines: [], partnerTyping: false, pendingTo: null, incoming: null });
  useVoiceChat.getState().setTalkPartner(null);
  releaseCallMic();
  if (notice) setNotice(notice);
}

/** Subscribe to relayed talk messages; returns an unsubscribe function. */
export function initTalkMessaging() {
  return onTalk((m: TalkMessage & { from: string }) => {
    const s = useTalk.getState();
    switch (m.type) {
      case 'request':
        if (s.partner || s.incoming) return; // busy: the server will tell them when they try again
        useTalk.setState({ incoming: { from: m.from, name: m.name, call: m.call === true } });
        haptic('medium');
        return;
      case 'decline':
        if (s.pendingTo?.id === m.from) {
          useTalk.setState({ pendingTo: null });
          releaseCallMic();
          setNotice(t('{name} is busy right now.', { name: s.pendingTo.name }));
        }
        return;
      case 'start':
        // a call starts as a small bar (play on while you talk); a text chat opens its window
        useTalk.setState({ partner: { id: m.from, name: m.name }, call: m.call === true, startedAt: Date.now(), open: m.call !== true, unread: 0, lines: [], pendingTo: null, incoming: null, partnerTyping: false, notice: null });
        useVoiceChat.getState().setTalkPartner(m.from);
        if (m.call) callMic();
        track('talk_start', { call: m.call === true });
        return;
      case 'msg':
        if (s.partner?.id !== m.from) return;
        useTalk.setState((st) => ({ lines: [...st.lines.slice(-99), { from: 'them', text: m.text, at: Date.now() }], partnerTyping: false, unread: st.open ? 0 : st.unread + 1 }));
        // read it aloud (like an NPC's reply; 🔇 in Settings mutes it), unless we are dictating
        if (!useVoice.getState().listening) useVoice.getState().speakAs('player', m.text, 'en-US');
        return;
      case 'typing':
        if (s.partner?.id !== m.from) return;
        useTalk.setState({ partnerTyping: true });
        if (typingTimer) window.clearTimeout(typingTimer);
        typingTimer = window.setTimeout(() => useTalk.setState({ partnerTyping: false }), 2500);
        return;
      case 'end':
        if (m.reason === 'busy') {
          useTalk.setState({ pendingTo: null });
          releaseCallMic();
          setNotice(t('That player is already talking to someone.'));
          return;
        }
        if (s.incoming?.from === m.from) {
          useTalk.setState({ incoming: null });
          setNotice(s.incoming.call ? t('Missed call from {name}.', { name: s.incoming.name }) : null);
          return;
        }
        if (s.partner?.id === m.from) finish(m.reason === 'distance' ? t('You walked too far apart — the conversation ended.') : t('{name} ended the conversation.', { name: s.partner.name }), m.reason);
        return;
    }
  });
}
