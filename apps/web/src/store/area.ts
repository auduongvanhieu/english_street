import { create } from 'zustand';
import type { AreaContentDto, AreaId } from '@es/shared';
import { fetchArea, fetchAreaLearned, sendAreaLearned } from '../net/api';
import { onLangChange, useLang } from '../i18n';
import { track } from '../net/analytics';

/** What the learner opened in an area: an item card (animal, dish, product…). */
export interface CardRef {
  area: AreaId;
  item: string;
}

interface AreaStore {
  /** Area the local player is standing in. */
  current: AreaId | null;
  /** Panel open (auto-opens on the first visit of each area). */
  panel: boolean;
  tab: string;
  card: CardRef | null;
  content: Partial<Record<AreaId, AreaContentDto>>;
  /** Item ids the learner has opened, per area (progress). */
  learned: Record<string, string[]>;
  setCurrent: (a: AreaId | null) => void;
  setPanel: (open: boolean, tab?: string) => void;
  setTab: (tab: string) => void;
  openCard: (c: CardRef | null) => void;
  load: (id: AreaId) => Promise<AreaContentDto | null>;
  /** Badge just earned (toast), cleared after a few seconds. */
  badge: string | null;
  showBadge: (id: string | null) => void;
  /** Merge word cards opened on this device with the ones saved on the server (both ways). */
  syncLearned: () => Promise<void>;
}

/** Cards opened but not yet saved on the server, per area (sent in small batches). */
const pending = new Map<AreaId, Set<string>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function queueLearned(area: AreaId, items: string[]) {
  const set = pending.get(area) ?? new Set<string>();
  for (const i of items) set.add(i);
  pending.set(area, set);
  if (!flushTimer) flushTimer = setTimeout(flushLearned, 1500);
}
async function flushLearned() {
  flushTimer = null;
  for (const [area, set] of [...pending]) {
    pending.delete(area);
    try {
      const r = await sendAreaLearned(area, [...set].slice(0, 80));
      if (r.badge) useArea.getState().showBadge(r.badge);
    } catch {
      /* offline: the next sync sends them again */
    }
  }
}

const LS_SEEN = 'es:areasSeen';
const LS_LEARNED = 'es:areaLearned';
const read = <T>(k: string, d: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d;
  } catch {
    return d;
  }
};
const inflight = new Map<string, Promise<AreaContentDto | null>>();

export const useArea = create<AreaStore>((set, get) => ({
  current: null,
  panel: false,
  tab: 'items',
  card: null,
  content: {},
  learned: read<Record<string, string[]>>(LS_LEARNED, {}),
  badge: null,
  showBadge(id) {
    set({ badge: id });
    if (id) setTimeout(() => get().badge === id && set({ badge: null }), 6000);
  },
  async syncLearned() {
    try {
      const server = (await fetchAreaLearned()).learned;
      const local = get().learned;
      const merged: Record<string, string[]> = {};
      for (const a of new Set([...Object.keys(server), ...Object.keys(local)])) {
        const s = server[a] ?? [];
        const l = local[a] ?? [];
        merged[a] = [...new Set([...s, ...l])];
        const missing = l.filter((x) => !s.includes(x));
        if (missing.length) queueLearned(a as AreaId, missing);
      }
      localStorage.setItem(LS_LEARNED, JSON.stringify(merged));
      set({ learned: merged });
    } catch {
      /* API down */
    }
  },
  setCurrent(a) {
    if (a === get().current) return;
    if (!a) return set({ current: null, panel: false, card: null });
    const seen = read<string[]>(LS_SEEN, []);
    const first = !seen.includes(a);
    if (first) localStorage.setItem(LS_SEEN, JSON.stringify([...seen, a]));
    track('area_enter', { area: a, first });
    set({ current: a, panel: first, tab: 'items', card: null });
    void get().load(a);
  },
  setPanel(open, tab) {
    if (open) track('area_panel_open', { area: get().current ?? '' });
    set({ panel: open, ...(tab ? { tab } : {}) });
  },
  setTab: (tab) => set({ tab }),
  openCard(c) {
    set({ card: c });
    if (!c) return;
    track('word_card_open', { area: c.area, item: c.item });
    const l = { ...get().learned };
    const list = l[c.area] ?? [];
    if (!list.includes(c.item)) {
      l[c.area] = [...list, c.item];
      localStorage.setItem(LS_LEARNED, JSON.stringify(l));
      set({ learned: l });
      queueLearned(c.area, [c.item]);
    }
    void get().load(c.area);
  },
  async load(id) {
    const lang = useLang.getState().lang;
    const have = get().content[id];
    if (have && have.lang === lang) return have;
    const key = `${id}:${lang}`;
    let p = inflight.get(key);
    if (!p) {
      p = fetchArea(id, lang)
        .then((dto) => {
          if (useLang.getState().lang === lang) set((s) => ({ content: { ...s.content, [id]: dto } }));
          return dto;
        })
        .catch(() => null)
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  },
}));

// New language → refetch what is open.
onLangChange(() => {
  const s = useArea.getState();
  useArea.setState({ content: {} });
  if (s.current) void s.load(s.current);
  if (s.card) void s.load(s.card.area);
});
