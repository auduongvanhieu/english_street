import { create } from 'zustand';
import { DM_MAX, type DmReceived } from '@es/shared';
import { onDm, sendDm } from '../net/client';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { useGame } from './game';

/**
 * Private messages at any distance (MSG.DM): one thread per player in the room. The players list (👥) shows
 * where everyone is; a message lets you find a friend, then walk over (follow) and talk face to face.
 */
export interface DmLine {
  from: 'me' | 'them';
  text: string;
  at: number;
}
export interface DmThread {
  name: string;
  lines: DmLine[];
  unread: number;
}

interface DmStore {
  threads: Record<string, DmThread>;
  /** Thread shown in the players panel (null = the list). */
  openId: string | null;
  /** Latest message that arrived while its thread was not open (small toast). */
  toast: { from: string; name: string; text: string; at: number } | null;
  /** Player highlighted on the 🗺️ map ("Show on map"). */
  mapFocus: string | null;
  showOnMap: (id: string) => void;
  open: (id: string | null) => void;
  send: (to: string, text: string) => void;
  dismissToast: () => void;
  reset: () => void;
}

export const useDm = create<DmStore>((set, get) => ({
  threads: {},
  openId: null,
  toast: null,
  mapFocus: null,
  showOnMap(id) {
    set({ mapFocus: id });
    useGame.getState().setUiPanel('map');
  },
  open(id) {
    set((s) => {
      if (!id || !s.threads[id]) return { openId: id };
      return { openId: id, threads: { ...s.threads, [id]: { ...s.threads[id]!, unread: 0 } }, toast: s.toast?.from === id ? null : s.toast };
    });
  },
  send(to, text) {
    const msg = text.trim().slice(0, DM_MAX);
    if (!msg) return;
    const name = useGame.getState().players[to]?.name ?? get().threads[to]?.name ?? '';
    sendDm({ to, text: msg });
    track('dm_send', { len: msg.length });
    set((s) => ({ threads: { ...s.threads, [to]: add(s.threads[to] ?? { name, lines: [], unread: 0 }, { from: 'me', text: msg, at: Date.now() }, false) } }));
  },
  dismissToast: () => set({ toast: null }),
  reset: () => set({ threads: {}, openId: null, toast: null, mapFocus: null }),
}));

function add(t: DmThread, line: DmLine, unread: boolean): DmThread {
  return { ...t, lines: [...t.lines.slice(-99), line], unread: unread ? t.unread + 1 : t.unread };
}

/** Panel showing this thread right now? (then no toast / unread). */
const reading = (id: string) => useDm.getState().openId === id && useGame.getState().uiPanel === 'players';

/** Total unread private messages (badge on 👥). */
export const useDmUnread = () => useDm((s) => Object.values(s.threads).reduce((n, t) => n + t.unread, 0));

export function initDm() {
  // leaving the room (zone change / exit) forgets its threads: session ids are per room
  const offRoom = useGame.subscribe((s, prev) => {
    if (prev.zone && !s.zone) useDm.getState().reset();
  });
  const offDm = onDm((m: DmReceived) => {
    const seen = reading(m.from);
    useDm.setState((s) => ({
      threads: { ...s.threads, [m.from]: add({ ...(s.threads[m.from] ?? { lines: [], unread: 0 }), name: m.name }, { from: 'them', text: m.text, at: Date.now() }, !seen) },
      toast: seen ? s.toast : { from: m.from, name: m.name, text: m.text, at: Date.now() },
    }));
    if (!seen) haptic('light');
  });
  return () => {
    offRoom();
    offDm();
  };
}
