import { create } from 'zustand';
import type { AttemptSummary, NpcTurnResponse, SessionState } from '@es/shared';
import { endSession, sendTurn, startFreeTalk, startQuest } from '../net/api';
import { useProfile } from './profile';

interface ConversationStore {
  state: SessionState | null;
  lastTurn: NpcTurnResponse | null;
  summary: AttemptSummary | null;
  loading: boolean;
  error: string | null;
  start: (npcId: string, questId: string | null, playerName: string) => Promise<void>;
  send: (text: string, source?: 'text' | 'voice') => Promise<void>;
  end: () => Promise<void>;
  reset: () => void;
}

export const useConversation = create<ConversationStore>((set, get) => ({
  state: null,
  lastTurn: null,
  summary: null,
  loading: false,
  error: null,

  async start(npcId, questId, playerName) {
    set({ loading: true, error: null, summary: null, lastTurn: null });
    try {
      const state = questId ? await startQuest(questId, playerName) : await startFreeTalk(npcId, playerName);
      set({ state, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async send(text, source = 'text') {
    const s = get().state;
    if (!s || get().loading || s.finished) return;
    // Optimistic echo of the learner's line.
    set({
      loading: true,
      error: null,
      state: { ...s, messages: [...s.messages, { role: 'user', content: text }] },
    });
    try {
      const r = await sendTurn(s.sessionId, text, source);
      set({ state: r.state, lastTurn: r.turn, summary: r.summary, loading: false });
      if (r.summary) void useProfile.getState().refresh();
    } catch (e) {
      set({ loading: false, error: (e as Error).message, state: s });
    }
  },

  async end() {
    const s = get().state;
    if (!s) return;
    if (!s.finished) {
      try {
        const r = await endSession(s.sessionId);
        if (r.summary) {
          set({ summary: r.summary, state: { ...s, finished: true } });
          return;
        }
      } catch {
        /* ignore: closing anyway */
      }
    }
    get().reset();
  },

  reset() {
    set({ state: null, lastTurn: null, summary: null, loading: false, error: null });
  },
}));
