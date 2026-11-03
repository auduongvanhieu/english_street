import { create } from 'zustand';
import type { TalkMessage } from '@es/shared';
import { onTalk, sendTalk } from '../net/client';
import { track } from '../net/analytics';
import { useGame } from './game';
import { useVoiceChat } from '../net/voicechat';

export interface TalkLine {
  from: 'me' | 'them';
  text: string;
  at: number;
}

interface TalkStore {
  /** Someone nearby asked to talk. */
  incoming: { from: string; name: string } | null;
  /** We asked someone and wait for the answer. */
  pendingTo: { id: string; name: string } | null;
  /** Active private talk. */
  partner: { id: string; name: string } | null;
  lines: TalkLine[];
  partnerTyping: boolean;
  /** Short status text (declined, ended by distance…) shown for a few seconds. */
  notice: string | null;
  request: (id: string, name: string) => void;
  accept: () => void;
  decline: () => void;
  send: (text: string) => void;
  typing: () => void;
  end: () => void;
}

let typingTimer: number | null = null;
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
  lines: [],
  partnerTyping: false,
  notice: null,

  request(id, name) {
    if (get().partner || get().pendingTo) return;
    sendTalk({ to: id, type: 'request', name: useGame.getState().playerName });
    set({ pendingTo: { id, name } });
    useGame.getState().setSelectedPlayer(null);
  },
  accept() {
    const inc = get().incoming;
    if (!inc) return;
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
    const t = text.trim();
    if (!p || !t) return;
    sendTalk({ to: p.id, type: 'msg', text: t });
    set((s) => ({ lines: [...s.lines.slice(-99), { from: 'me', text: t, at: Date.now() }] }));
  },
  typing() {
    const p = get().partner;
    if (p) sendTalk({ to: p.id, type: 'typing' });
  },
  end() {
    const p = get().partner;
    if (p) sendTalk({ to: p.id, type: 'end' });
    finish('You ended the conversation.');
  },
}));

function finish(notice: string | null, reason?: string) {
  const p = useTalk.getState().partner;
  if (p) track('talk_end', { lines: useTalk.getState().lines.length, reason: reason ?? 'self' });
  useTalk.setState({ partner: null, lines: [], partnerTyping: false, pendingTo: null, incoming: null });
  useVoiceChat.getState().setTalkPartner(null);
  if (notice) setNotice(notice);
}

/** Subscribe to relayed talk messages; returns an unsubscribe function. */
export function initTalkMessaging() {
  return onTalk((m: TalkMessage & { from: string }) => {
    const s = useTalk.getState();
    switch (m.type) {
      case 'request':
        if (s.partner || s.incoming) return; // busy: the server will tell them when they try again
        useTalk.setState({ incoming: { from: m.from, name: m.name } });
        if ('vibrate' in navigator) navigator.vibrate?.(120);
        return;
      case 'decline':
        if (s.pendingTo?.id === m.from) {
          useTalk.setState({ pendingTo: null });
          setNotice(`${s.pendingTo.name} is busy right now.`);
        }
        return;
      case 'start':
        useTalk.setState({ partner: { id: m.from, name: m.name }, lines: [], pendingTo: null, incoming: null, partnerTyping: false, notice: null });
        useVoiceChat.getState().setTalkPartner(m.from);
        track('talk_start');
        return;
      case 'msg':
        if (s.partner?.id !== m.from) return;
        useTalk.setState((st) => ({ lines: [...st.lines.slice(-99), { from: 'them', text: m.text, at: Date.now() }], partnerTyping: false }));
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
          setNotice('That player is already talking to someone.');
          return;
        }
        if (s.partner?.id === m.from) finish(m.reason === 'distance' ? 'You walked too far apart — the conversation ended.' : `${s.partner.name} ended the conversation.`, m.reason);
        return;
    }
  });
}
