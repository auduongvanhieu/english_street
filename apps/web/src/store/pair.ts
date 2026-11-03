import { create } from 'zustand';
import type { AttemptSummary, PairChatResponse, PairLine, PairMessage, PairSessionState } from '@es/shared';
import { onPair, sendPair } from '../net/client';
import { API_URL } from '../net/api';
import { getPlayerId } from '../net/player';
import { useGame } from './game';
import { useProfile } from './profile';

export interface Invite {
  from: string; // sessionId
  inviterPlayerId: string;
  inviterName: string;
  questId: string;
  questTitle: string;
  yourRole: string;
}

interface PairStore {
  invite: Invite | null;
  /** Outgoing invite waiting for an answer */
  pendingTo: { sessionId: string; name: string; questId: string } | null;
  partnerSession: string | null;
  state: PairSessionState | null;
  summaries: Record<string, AttemptSummary> | null;
  loading: boolean;
  error: string | null;
  partnerLeft: boolean;

  invitePlayer: (target: { id: string; name: string }, questId: string, questTitle: string, role: string) => void;
  accept: () => void;
  decline: () => void;
  send: (text: string) => Promise<void>;
  leave: () => Promise<void>;
  reset: () => void;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? `${path} ${res.status}`);
  return (await res.json()) as T;
}

export const usePair = create<PairStore>((set, get) => ({
  invite: null,
  pendingTo: null,
  partnerSession: null,
  state: null,
  summaries: null,
  loading: false,
  error: null,
  partnerLeft: false,

  invitePlayer(target, questId, questTitle, role) {
    const me = useGame.getState();
    sendPair({ to: target.id, type: 'invite', questId, questTitle, inviterPlayerId: getPlayerId(), inviterName: me.playerName, yourRole: role });
    set({ pendingTo: { sessionId: target.id, name: target.name, questId }, error: null });
  },

  accept() {
    const inv = get().invite;
    if (!inv) return;
    sendPair({ to: inv.from, type: 'accept', playerId: getPlayerId(), name: useGame.getState().playerName });
    set({ invite: null, partnerSession: inv.from, loading: true });
  },

  decline() {
    const inv = get().invite;
    if (inv) sendPair({ to: inv.from, type: 'decline' });
    set({ invite: null });
  },

  async send(text) {
    const s = get().state;
    const partner = get().partnerSession;
    if (!s || !partner || get().loading || s.finished) return;
    set({ loading: true, error: null });
    try {
      const r = await post<PairChatResponse>(`/pair/${s.sessionId}/chat`, { playerId: getPlayerId(), text });
      set({ state: r.state, summaries: r.summaries, loading: false });
      if (r.summaries) void useProfile.getState().refresh();
      const line = r.state.messages[r.state.messages.length - 1];
      sendPair({ to: partner, type: 'msg', message: line, state: r.state, summaries: r.summaries ?? undefined });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async leave() {
    const s = get().state;
    const partner = get().partnerSession;
    if (partner) sendPair({ to: partner, type: 'leave' });
    if (s && !s.finished) {
      try {
        const r = await post<{ summaries: Record<string, AttemptSummary> | null }>(`/pair/${s.sessionId}/end`, { playerId: getPlayerId() });
        if (r.summaries) {
          set({ summaries: r.summaries, state: { ...s, finished: true }, partnerSession: null });
          return;
        }
      } catch {
        /* closing anyway */
      }
    }
    get().reset();
  },

  reset() {
    set({ invite: null, pendingTo: null, partnerSession: null, state: null, summaries: null, loading: false, error: null, partnerLeft: false });
  },
}));

/** Wire relayed pair messages once per app. */
export function initPairMessaging() {
  return onPair(async (m: PairMessage & { from: string }) => {
    const st = usePair.getState();
    switch (m.type) {
      case 'invite':
        if (st.state || st.invite) return; // busy
        usePair.setState({ invite: { from: m.from, inviterPlayerId: m.inviterPlayerId, inviterName: m.inviterName, questId: m.questId, questTitle: m.questTitle, yourRole: m.yourRole } });
        break;
      case 'accept': {
        const pending = st.pendingTo;
        if (!pending || pending.sessionId !== m.from) return;
        usePair.setState({ loading: true, partnerSession: m.from, pendingTo: null });
        try {
          const state = await post<PairSessionState>('/pair/start', {
            questId: pending.questId,
            players: [
              { playerId: getPlayerId(), name: useGame.getState().playerName },
              { playerId: m.playerId, name: m.name },
            ],
          });
          usePair.setState({ state, loading: false });
          sendPair({ to: m.from, type: 'start', session: state });
        } catch (e) {
          usePair.setState({ loading: false, error: (e as Error).message, partnerSession: null });
        }
        break;
      }
      case 'decline':
        if (st.pendingTo?.sessionId === m.from) usePair.setState({ pendingTo: null, error: 'Invitation declined' });
        break;
      case 'start':
        if (st.partnerSession === m.from) usePair.setState({ state: m.session as PairSessionState, loading: false });
        break;
      case 'msg':
        if (st.partnerSession === m.from) {
          usePair.setState({ state: m.state as PairSessionState, summaries: (m.summaries as Record<string, AttemptSummary> | undefined) ?? st.summaries });
          void (m.message as PairLine);
        }
        break;
      case 'leave':
        if (st.partnerSession === m.from) usePair.setState({ partnerLeft: true, partnerSession: null });
        break;
    }
  });
}
