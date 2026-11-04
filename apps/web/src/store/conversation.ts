import { create } from 'zustand';
import type { AttemptSummary, NpcTurnResponse, SessionState } from '@es/shared';
import { endSession, sendTurn, startFreeTalk, startQuest, translateText } from '../net/api';
import { useProfile } from './profile';
import { subtitlesOn, useSettings } from './settings';

interface ConversationStore {
  state: SessionState | null;
  lastTurn: NpcTurnResponse | null;
  summary: AttemptSummary | null;
  loading: boolean;
  error: string | null;
  /** Subtitles (learner's language) for lines that did not come with content_tr (greeting, older turns), by English text. */
  vi: Record<string, string>;
  translate: (text: string) => Promise<void>;
  start: (npcId: string, questId: string | null, playerName: string) => Promise<void>;
  send: (text: string, source?: 'text' | 'voice') => Promise<void>;
  end: () => Promise<void>;
  reset: () => void;
}

import { onLangChange } from '../i18n';
// Subtitles are per language: drop them when the learner switches.
onLangChange(() => useConversation.setState({ vi: {} }));

/** Texts currently being translated (avoids duplicate requests from several bubbles). */
const inflight = new Set<string>();

export const useConversation = create<ConversationStore>((set, get) => ({
  state: null,
  lastTurn: null,
  summary: null,
  loading: false,
  error: null,
  vi: {},

  async translate(text) {
    if (get().vi[text] || inflight.has(text)) return;
    inflight.add(text);
    try {
      const r = await translateText(text);
      set((s) => ({ vi: { ...s.vi, [text]: r.text } }));
    } catch {
      /* subtitles are best-effort */
    } finally {
      inflight.delete(text);
    }
  },

  async start(npcId, questId, playerName) {
    set({ loading: true, error: null, summary: null, lastTurn: null, vi: {} });
    try {
      const state = questId ? await startQuest(questId, playerName) : await startFreeTalk(npcId, playerName);
      set({ state, loading: false });
      // The greeting is static text, so it is translated through the cached /translate endpoint.
      if (subtitlesOn(useSettings.getState().subtitles, useProfile.getState().profile?.cefrLevel)) {
        for (const m of state.messages) if (m.role === 'assistant' && !m.content_tr) void get().translate(m.content);
      }
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
      const subs = subtitlesOn(useSettings.getState().subtitles, useProfile.getState().profile?.cefrLevel);
      const r = await sendTurn(s.sessionId, text, source, subs);
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
    set({ state: null, lastTurn: null, summary: null, loading: false, error: null, vi: {} });
  },
}));
