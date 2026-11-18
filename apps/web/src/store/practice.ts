import { create } from 'zustand';
import type { PracticeKind, PracticeSet } from '@es/shared';
import { get } from '../net/api';
import { getPlayerId } from '../net/player';
import { learnerLang } from '../i18n';
import { useGame } from './game';
import { useProfile } from './profile';
import { stopSpeaking } from '../voice/tts';

/**
 * The listening / shadowing lesson sheet (daily tasks d-listen, d-shadow). "Practise more" asks for the next
 * round of the day; the round is remembered per day so reopening shows a fresh lesson after a finished one.
 */
interface PracticeStore {
  kind: PracticeKind | null;
  set: PracticeSet | null;
  loading: boolean;
  error: string | null;
  start: (kind: PracticeKind) => Promise<void>;
  close: () => void;
  /** a lesson was finished: the next open starts the next round */
  finished: (kind: PracticeKind) => void;
}

const KEY = 'es:practice-round';
type Rounds = Record<string, number>;
const day = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
function rounds(): Rounds {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Rounds & { day?: string };
    return r.day === day() ? r : {};
  } catch {
    return {};
  }
}
function saveRound(kind: PracticeKind, n: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...rounds(), day: day(), [kind]: n }));
  } catch {
    /* private mode */
  }
}

export const usePractice = create<PracticeStore>((set, getS) => ({
  kind: null,
  set: null,
  loading: false,
  error: null,
  async start(kind) {
    useGame.getState().setUiPanel(null);
    const round = rounds()[kind] ?? 0;
    set({ kind, set: null, loading: true, error: null });
    try {
      const level = useProfile.getState().profile?.cefrLevel ?? 'A1';
      const s = await get<PracticeSet>(`/practice/${kind}?playerId=${encodeURIComponent(getPlayerId())}&lang=${learnerLang()}&level=${level}&round=${round}`);
      if (getS().kind === kind) set({ set: s, loading: false });
    } catch (e) {
      if (getS().kind === kind) set({ loading: false, error: (e as Error).message });
    }
  },
  close() {
    stopSpeaking();
    set({ kind: null, set: null, loading: false, error: null });
  },
  finished(kind) {
    saveRound(kind, (rounds()[kind] ?? 0) + 1);
  },
}));
