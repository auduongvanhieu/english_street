import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { chimeSound } from '../audio/ambient';
import { EXHIBITS } from '../world/oldTown';
import { useProfile } from './profile';
import { useSettings } from './settings';
import { useVoice } from './voice';

/**
 * Old Town: telling the time from the clock tower (the hands move to a time, pick the sentence) and the museum
 * (read the plaque, answer Mr Hughes's question about the past). Rewards: minigame 'oldtown'.
 */
const HOURS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const MINS: Record<number, string> = { 5: 'five', 10: 'ten', 20: 'twenty', 25: 'twenty-five' };
const hourWord = (h: number) => HOURS[((h % 12) + 12) % 12 || 12]!;
/** "It's quarter past three." for 3:15, "It's twenty to four." for 3:40… */
export function timeSentence(h: number, m: number): string {
  if (m === 0) return `It's ${hourWord(h)} o'clock.`;
  if (m === 15) return `It's quarter past ${hourWord(h)}.`;
  if (m === 30) return `It's half past ${hourWord(h)}.`;
  if (m === 45) return `It's quarter to ${hourWord(h + 1)}.`;
  if (m < 30) return `It's ${MINS[m]} past ${hourWord(h)}.`;
  return `It's ${MINS[60 - m]} to ${hourWord(h + 1)}.`;
}
function timeOptions(h: number, m: number): string[] {
  const right = timeSentence(h, m);
  const cands = [timeSentence(h, (60 - m) % 60), timeSentence(h + 1, m), timeSentence(h - 1, m), timeSentence(h, (m + 30) % 60), timeSentence(h, (m + 15) % 60)];
  const wrong = [...new Set(cands.filter((c) => c !== right))].sort(() => Math.random() - 0.5).slice(0, 3);
  return [right, ...wrong].sort(() => Math.random() - 0.5);
}
const ROUNDS = 5;

interface OldTownStore {
  clock: { h: number; m: number; round: number; options: string[]; miss: string[]; score: number; done: boolean; result: MinigameResult | null } | null;
  museum: { answered: Record<string, boolean>; open: string | null; pick: string | null; result: MinigameResult | null; order: Record<string, string[]> } | null;
  startClock: () => void;
  answerClock: (s: string) => void;
  openExhibit: (id: string) => void;
  answerExhibit: (a: string) => void;
  close: (what: 'clock' | 'museum' | 'exhibit') => void;
}

const hughes = (t: string) => useVoice.getState().speakAs('curator', t, 'en-GB');
const randTime = () => ({ h: 1 + Math.floor(Math.random() * 12), m: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55][Math.floor(Math.random() * 12)]! });
const reward = (score: number, then: (r: MinigameResult) => void) =>
  void reportMinigame('oldtown', { score })
    .then((r) => {
      then(r);
      void useProfile.getState().refresh();
    })
    .catch(() => undefined);

export const useOldTown = create<OldTownStore>((set, get) => ({
  clock: null,
  museum: null,
  startClock() {
    const { h, m } = randTime();
    set({ clock: { h, m, round: 0, options: timeOptions(h, m), miss: [], score: 0, done: false, result: null } });
    chimeSound(Math.max(0.3, useSettings.getState().ambientVolume));
    hughes('Look at the clock tower. What time is it?');
    track('oldtown_clock_start');
  },
  answerClock(s) {
    const c = get().clock;
    if (!c || c.done) return;
    if (s !== timeSentence(c.h, c.m)) {
      if (!c.miss.includes(s)) set({ clock: { ...c, miss: [...c.miss, s] } });
      return;
    }
    useVoice.getState().speakAs('me', s, 'en-US');
    const score = c.score + (c.miss.length ? 0 : 1);
    const round = c.round + 1;
    if (round < ROUNDS) {
      const { h, m } = randTime();
      window.setTimeout(() => set({ clock: { ...get().clock!, h, m, round, options: timeOptions(h, m), miss: [], score } }), 1200);
      set({ clock: { ...c, score } });
      return;
    }
    set({ clock: { ...c, round, score, done: true } });
    track('oldtown_clock_done', { score });
    reward(score, (result) => {
      const cur = get().clock;
      if (cur) set({ clock: { ...cur, result } });
    });
  },
  openExhibit(id) {
    const e = EXHIBITS.find((x) => x.id === id);
    if (!e) return;
    const m = get().museum ?? { answered: {}, open: null, pick: null, result: null, order: {} };
    const order = m.order[id] ?? [...e.answers].sort(() => Math.random() - 0.5);
    set({ museum: { ...m, open: id, pick: null, order: { ...m.order, [id]: order } } });
    useVoice.getState().speakAs('curator', `${e.title}. ${e.plaque}`, 'en-GB');
  },
  answerExhibit(a) {
    const m = get().museum;
    const e = m?.open ? EXHIBITS.find((x) => x.id === m.open) : null;
    if (!m || !e || m.answered[e.id] !== undefined) return;
    const ok = a === e.answers[0];
    const answered = { ...m.answered, [e.id]: ok };
    set({ museum: { ...m, answered, pick: a } });
    hughes(ok ? `That's right! ${e.answers[0]}` : `Not quite. Read the plaque again: the answer is "${e.answers[0]}"`);
    if (Object.keys(answered).length === EXHIBITS.length) {
      const score = Object.values(answered).filter(Boolean).length;
      track('oldtown_museum_done', { score });
      window.setTimeout(() => hughes(`You have seen every exhibit. You got ${score} out of ${EXHIBITS.length}. Thank you for visiting our museum!`), 2500);
      reward(Math.min(5, score), (result) => {
        const cur = get().museum;
        if (cur) set({ museum: { ...cur, result } });
      });
    }
  },
  close: (what) => (what === 'clock' ? set({ clock: null }) : what === 'exhibit' ? set({ museum: get().museum ? { ...get().museum!, open: null } : null }) : set({ museum: null })),
}));
