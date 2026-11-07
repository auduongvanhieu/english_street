import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { sendProp } from '../net/client';
import { track } from '../net/analytics';
import { useArea } from './area';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Star Cinema, Screen 1: shows on the shared clock (scene/areas/places/cartoon.ts showPhase). Sitting in the room
 * while the film runs counts as watching; when the film ends the watcher gets three questions and a vote.
 * The snack bar: choose a snack, say the order right, get it in your hands (prop "snack:<kind>").
 */
export interface MovieQ {
  q: string;
  options: string[];
  answer: number;
}
const POOL: MovieQ[] = [
  { q: 'What colour is Dino?', options: ['green', 'red', 'blue'], answer: 0 },
  { q: 'What does Dino want to do?', options: ['fly', 'swim', 'sing'], answer: 0 },
  { q: 'What happens when Dino first flaps his wings?', options: ['He falls down.', 'He flies away.', 'He goes to sleep.'], answer: 0 },
  { q: 'Who helps Dino?', options: ['a bird', 'a cat', 'a fish'], answer: 0 },
  { q: 'What does the bird say?', options: ['"Don\'t give up!"', '"Go home!"', '"Be quiet!"'], answer: 0 },
  { q: 'What is the lesson of the film?', options: ['Never give up.', 'Always sleep late.', "Don't talk to birds."], answer: 0 },
  { q: 'Dino is a little green…', options: ['dragon', 'dog', 'duck'], answer: 0 },
  { q: 'At the end, Dino can fly with his…', options: ['friends', 'teacher', 'dad'], answer: 0 },
];
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

function pickQuestions(): MovieQ[] {
  return shuffle(POOL)
    .slice(0, 3)
    .map((q) => {
      const order = shuffle(q.options.map((_, i) => i));
      return { q: q.q, options: order.map((i) => q.options[i]!), answer: order.indexOf(q.answer) };
    });
}

/* ------------------------------------------------------------------------------------------- snack bar */
export interface SnackItem {
  id: string;
  prop: 'popcorn' | 'nachos' | 'drink' | 'icecream';
  icon: string;
  name: string;
  price: number;
  /** what to say: the right sentence first */
  lines: [string, string, string];
}
export const SNACKS: SnackItem[] = [
  { id: 'popcorn-s', prop: 'popcorn', icon: '🍿', name: 'Small popcorn', price: 4, lines: ['Can I have a small popcorn, please?', 'Can I has a small popcorn, please?', 'I want popcorn small give me.'] },
  { id: 'popcorn-l', prop: 'popcorn', icon: '🍿', name: 'Large popcorn', price: 6, lines: ["I'd like a large popcorn, please.", "I'd like a popcorn large, please.", 'I like a large popcorn, please.'] },
  { id: 'nachos', prop: 'nachos', icon: '🧀', name: 'Nachos', price: 5, lines: ['Could I get some nachos, please?', 'Could I get a nachos, please?', 'Could I getting nachos, please?'] },
  { id: 'drink', prop: 'drink', icon: '🥤', name: 'Drink', price: 3, lines: ['A cola, please. No ice, thanks.', 'A cola, please. No ices, thanks.', 'Cola me, please. No ice.'] },
  { id: 'icecream', prop: 'icecream', icon: '🍦', name: 'Ice cream', price: 4, lines: ["I'll have an ice cream, please.", "I'll have a ice cream, please.", 'I will having an ice cream, please.'] },
];

interface MovieStore {
  /** seconds of the current show's film watched from inside Screen 1 */
  watched: number;
  watchShow: number;
  /** subtitle being shown (in the room, during the film) */
  sub: string;
  inRoom: boolean;
  /** read the subtitles aloud */
  voice: boolean;
  after: { show: number; qs: MovieQ[]; picked: (number | null)[]; done: boolean; result: MinigameResult | null; vote: 0 | 1 | -1 } | null;
  snackOpen: boolean;
  snackItem: SnackItem | null;
  snackLines: string[];
  snackNote: string | null;
  holding: string;
  setVoice: (v: boolean) => void;
  answer: (i: number, k: number) => void;
  vote: (v: 1 | -1) => void;
  closeAfter: () => void;
  openSnacks: () => void;
  chooseSnack: (s: SnackItem | null) => void;
  sayLine: (line: string) => void;
  closeSnacks: () => void;
}

const staff = (text: string) => useVoice.getState().speakAs('usher', text, 'en-US');

export const useMovie = create<MovieStore>((set, get) => ({
  watched: 0,
  watchShow: -1,
  sub: '',
  inRoom: false,
  voice: true,
  after: null,
  snackOpen: false,
  snackItem: null,
  snackLines: [],
  snackNote: null,
  holding: '',
  setVoice: (voice) => set({ voice }),
  answer(i, k) {
    const a = get().after;
    if (!a || a.done || a.picked[i] !== null) return;
    const picked = a.picked.map((p, j) => (j === i ? k : p));
    const done = picked.every((p) => p !== null);
    set({ after: { ...a, picked, done } });
    if (!done) return;
    const correct = picked.filter((p, j) => p === a.qs[j]!.answer).length;
    track('cinema_film_done', { correct });
    void reportMinigame('movie', { score: correct })
      .then((result) => {
        const cur = get().after;
        if (cur && cur.show === a.show) set({ after: { ...cur, result } });
        void useProfile.getState().refresh();
      })
      .catch(() => undefined);
  },
  vote(v) {
    const a = get().after;
    if (!a || a.vote) return;
    set({ after: { ...a, vote: v } });
    track('cinema_vote', { like: v > 0 });
  },
  closeAfter: () => set({ after: null }),
  openSnacks() {
    set({ snackOpen: true, snackItem: null, snackNote: null });
    staff('Hi there! What can I get you?');
  },
  chooseSnack(s) {
    set({ snackItem: s, snackLines: s ? shuffle(s.lines) : [], snackNote: null });
  },
  sayLine(line) {
    const s = get().snackItem;
    if (!s) return;
    const ok = line === s.lines[0];
    track('cinema_snack', { item: s.id, ok });
    if (!ok) {
      set({ snackNote: line });
      return;
    }
    useVoice.getState().speakAs('me', line, 'en-US');
    window.setTimeout(() => staff(`Sure! That's ${s.price} dollars. Enjoy the film!`), 1600);
    sendProp(`snack:${s.prop}`);
    set({ holding: s.prop, snackOpen: false, snackItem: null, snackNote: null });
  },
  closeSnacks: () => set({ snackOpen: false, snackItem: null, snackNote: null }),
}));

/** Called ~4×/s by the cinema scene: am I in Screen 1, which show is on, what does the subtitle say. */
export function watchTick(inRoom: boolean, show: number, phase: 'countdown' | 'film' | 'break', sub: string, dt: number) {
  const s = useMovie.getState();
  const patch: Partial<MovieStore> = {};
  if (s.inRoom !== inRoom) patch.inRoom = inRoom;
  let watched = s.watchShow === show ? s.watched : 0;
  if (inRoom && phase === 'film') watched += dt;
  if (watched !== s.watched || s.watchShow !== show) Object.assign(patch, { watched, watchShow: show });
  const shownSub = inRoom && phase === 'film' ? sub : '';
  if (shownSub !== s.sub) {
    patch.sub = shownSub;
    if (shownSub && s.voice) useVoice.getState().speakAs('narrator', shownSub.replace(/[“”"]/g, ''), 'en-GB');
  }
  // the film just ended for someone who watched most of it: questions
  if (phase === 'break' && inRoom && s.watchShow === show && s.watched >= 35 && s.after?.show !== show) {
    patch.after = { show, qs: pickQuestions(), picked: [null, null, null], done: false, result: null, vote: 0 };
    track('cinema_film_watched', { seconds: Math.round(s.watched) });
  }
  if (Object.keys(patch).length) useMovie.setState(patch);
}

// leaving the cinema: snacks are finished
useArea.subscribe((s, prev) => {
  if (s.current !== prev.current && prev.current === 'cinema' && useMovie.getState().holding) {
    sendProp('');
    useMovie.setState({ holding: '', snackOpen: false });
  }
});
