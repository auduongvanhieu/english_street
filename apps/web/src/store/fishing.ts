import { create } from 'zustand';
import { PIERS } from '@es/shared';
import { reportMinigame } from '../net/api';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { useGame } from './game';
import { useProfile } from './profile';
import { boatSay } from './boats';

/**
 * Fishing at the end of the boat-hire piers: cast, wait for a bite, press E / the button in time, and the fish goes
 * into your fish book (kept on this device) with its English name and a sentence about it. Rare fish give more XP.
 */
export interface Fish {
  id: string;
  en: string;
  emoji: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  fact: string;
}
export const FISH: Fish[] = [
  { id: 'carp', en: 'a carp', emoji: '🐟', rarity: 1, fact: 'Carp are big, slow fish. They like warm, muddy water.' },
  { id: 'perch', en: 'a perch', emoji: '🐟', rarity: 1, fact: 'A perch has green and black stripes on its body.' },
  { id: 'catfish', en: 'a catfish', emoji: '🐡', rarity: 2, fact: 'A catfish has long whiskers, like a cat!' },
  { id: 'trout', en: 'a trout', emoji: '🐟', rarity: 2, fact: 'Trout live in clean, cold water.' },
  { id: 'eel', en: 'an eel', emoji: '🐍', rarity: 3, fact: 'An eel is a fish, but it looks like a snake.' },
  { id: 'pike', en: 'a pike', emoji: '🐊', rarity: 3, fact: 'A pike is a fast hunter with very sharp teeth.' },
  { id: 'crab', en: 'a crab', emoji: '🦀', rarity: 3, fact: 'A crab walks sideways. It is not a fish!' },
  { id: 'goldfish', en: 'a goldfish', emoji: '🐠', rarity: 4, fact: 'Someone let their goldfish go in the river. Lucky you!' },
  { id: 'boot', en: 'an old boot', emoji: '🥾', rarity: 1, fact: 'Oh no, an old boot! Please put rubbish in the bin.' },
  { id: 'golden', en: 'the golden fish', emoji: '✨', rarity: 5, fact: 'The golden fish! People say it brings good luck.' },
];
const WEIGHT: Record<number, number> = { 1: 10, 2: 6, 3: 3, 4: 1.2, 5: 0.3 };
const BOOK_KEY = 'es:fishbook';
const loadBook = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(BOOK_KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** Fishing spots: the water end of each boat-hire pier. */
export const FISH_SPOTS = [PIERS.boatN, PIERS.boatS].map((p) => ({ id: p.id, x: p.x, z: p.tipZ - p.out * 0.35, bobZ: p.tipZ + p.out * 2.2, out: p.out }));

interface FishingStore {
  spot: string | null;
  phase: 'idle' | 'waiting' | 'bite' | 'caught' | 'missed';
  catch: Fish | null;
  book: string[];
  xp: number;
  cast: (spot: string) => void;
  reel: () => void;
  stop: () => void;
}

let timer: number | null = null;
const clear = () => {
  if (timer) window.clearTimeout(timer);
  timer = null;
};

function pick(): Fish {
  const total = FISH.reduce((s, f) => s + WEIGHT[f.rarity]!, 0);
  let r = Math.random() * total;
  for (const f of FISH) {
    r -= WEIGHT[f.rarity]!;
    if (r <= 0) return f;
  }
  return FISH[0]!;
}

export const useFishing = create<FishingStore>((set, get) => ({
  spot: null,
  phase: 'idle',
  catch: null,
  book: loadBook(),
  xp: 0,
  cast(spot) {
    clear();
    set({ spot, phase: 'waiting', catch: null, xp: 0 });
    useGame.getState().playEmote('wave');
    track('fishing_cast');
    timer = window.setTimeout(
      () => {
        set({ phase: 'bite' });
        haptic('medium');
        boatSay('A bite! Pull it in!');
        // too slow: it gets away
        timer = window.setTimeout(() => {
          if (get().phase !== 'bite') return;
          set({ phase: 'missed' });
          boatSay('Oh no, it got away. Try again!');
        }, 1600);
      },
      3000 + Math.random() * 6000,
    );
  },
  reel() {
    const s = get();
    if (s.phase === 'waiting') {
      // pulled too early
      clear();
      set({ phase: 'missed' });
      boatSay('Too early! Wait for a bite.');
      return;
    }
    if (s.phase !== 'bite') return;
    clear();
    const f = pick();
    const book = s.book.includes(f.id) ? s.book : [...s.book, f.id];
    localStorage.setItem(BOOK_KEY, JSON.stringify(book));
    set({ phase: 'caught', catch: f, book });
    useGame.getState().playEmote('thumbsup');
    boatSay(`You caught ${f.en}! ${f.fact}`);
    track('fishing_catch', { fish: f.id });
    if (f.id !== 'boot')
      reportMinigame('fishing', { score: f.rarity })
        .then((r) => {
          set({ xp: r.xp });
          void useProfile.getState().refresh();
        })
        .catch(() => undefined);
  },
  stop() {
    clear();
    set({ spot: null, phase: 'idle', catch: null });
  },
}));
