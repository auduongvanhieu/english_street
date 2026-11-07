import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { SPOTS, STALLS } from '../world/riverside';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Riverside village: the market (buy the things on Ruby's list with the right word: a loaf of bread, a bunch of
 * flowers…) and helping Lily find what she lost (she says where: on the bridge, behind the mill…).
 * Rewards: minigame 'riverside'.
 */
export interface Product {
  id: string;
  stall: string;
  icon: string;
  noun: string;
  /** the right container word: a ___ of noun */
  unit: string;
}
export const PRODUCTS: Product[] = [
  { id: 'apples', stall: 'fruit', icon: '🍎', noun: 'apples', unit: 'bag' },
  { id: 'bananas', stall: 'fruit', icon: '🍌', noun: 'bananas', unit: 'bunch' },
  { id: 'potatoes', stall: 'fruit', icon: '🥔', noun: 'potatoes', unit: 'kilo' },
  { id: 'bread', stall: 'bakery', icon: '🍞', noun: 'bread', unit: 'loaf' },
  { id: 'cake', stall: 'bakery', icon: '🍰', noun: 'cake', unit: 'slice' },
  { id: 'milk', stall: 'dairy', icon: '🥛', noun: 'milk', unit: 'bottle' },
  { id: 'eggs', stall: 'dairy', icon: '🥚', noun: 'eggs', unit: 'box' },
  { id: 'cheese', stall: 'dairy', icon: '🧀', noun: 'cheese', unit: 'piece' },
  { id: 'flowers', stall: 'flowers', icon: '💐', noun: 'flowers', unit: 'bunch' },
  { id: 'basil', stall: 'flowers', icon: '🪴', noun: 'basil', unit: 'pot' },
  { id: 'honey', stall: 'drinks', icon: '🍯', noun: 'honey', unit: 'jar' },
  { id: 'juice', stall: 'drinks', icon: '🧃', noun: 'orange juice', unit: 'carton' },
];
const UNITS = ['bag', 'bunch', 'kilo', 'loaf', 'slice', 'bottle', 'box', 'piece', 'pot', 'jar', 'carton'];
export const phrase = (p: Product, unit = p.unit) => `a ${unit} of ${p.noun}`;
/** Three words to choose from for a product (the right one and two others), the same every time. */
export function unitChoices(p: Product): string[] {
  const seed = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const others = UNITS.filter((u) => u !== p.unit);
  const two = [others[seed % others.length]!, others[(seed * 7 + 3) % others.length]!];
  if (two[0] === two[1]) two[1] = others[(seed + 1) % others.length]!;
  const out = [p.unit, ...two];
  return seed % 3 === 0 ? out : seed % 3 === 1 ? [out[1]!, out[0]!, out[2]!] : [out[1]!, out[2]!, out[0]!];
}

export const LOST_THINGS = [
  { id: 'cat', en: 'my cat', icon: '🐱' },
  { id: 'teddy', en: 'my teddy bear', icon: '🧸' },
  { id: 'ball', en: 'my ball', icon: '⚽' },
  { id: 'hat', en: 'my hat', icon: '👒' },
  { id: 'kite', en: 'my kite', icon: '🪁' },
  { id: 'book', en: 'my book', icon: '📕' },
];
const ROUNDS = 3;

interface RiversideStore {
  list: { items: string[]; bought: string[]; mistakes: number; result: MinigameResult | null } | null;
  stall: string | null;
  /** last answer at the stall: the product and whether the word was right */
  last: { id: string; unit: string; ok: boolean; note: string } | null;
  lost: { order: { thing: number; spot: string }[]; round: number; mistakes: number; looked: string[]; done: boolean; result: MinigameResult | null } | null;
  takeList: () => void;
  openStall: (id: string) => void;
  buy: (product: string, unit: string) => void;
  startLost: () => void;
  look: (spot: string) => void;
  sayLost: () => void;
  close: (what: 'list' | 'stall' | 'lost') => void;
}

const ruby = (t: string) => useVoice.getState().speakAs('trader', t, 'en-GB');
const lily = (t: string) => useVoice.getState().speakAs('lily', t, 'en-GB');
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const reward = (score: number, then: (r: MinigameResult) => void) =>
  void reportMinigame('riverside', { score })
    .then((r) => {
      then(r);
      void useProfile.getState().refresh();
    })
    .catch(() => undefined);
const lostLine = (o: { thing: number; spot: string }) => `Oh no! I can't find ${LOST_THINGS[o.thing]!.en}. I think it's ${SPOTS.find((s) => s.id === o.spot)!.en}.`;

export const useRiverside = create<RiversideStore>((set, get) => ({
  list: null,
  stall: null,
  last: null,
  lost: null,
  takeList() {
    // four things from four different stalls
    const items = shuffle(STALLS.map((s) => s.id))
      .slice(0, 4)
      .map((st) => shuffle(PRODUCTS.filter((p) => p.stall === st))[0]!.id);
    set({ list: { items, bought: [], mistakes: 0, result: null } });
    ruby(`Here's your shopping list: ${items.map((id) => phrase(PRODUCTS.find((p) => p.id === id)!)).join(', ')}. The stalls are all around the square!`);
    track('riverside_list');
  },
  openStall(id) {
    set({ stall: id, last: null });
    const s = STALLS.find((x) => x.id === id)!;
    useVoice.getState().speakAs('trader', `Hello! Welcome to the ${s.name} stall. What would you like?`, 'en-GB');
  },
  buy(productId, unit) {
    const p = PRODUCTS.find((x) => x.id === productId);
    if (!p) return;
    const l = get().list;
    if (unit !== p.unit) {
      set({ last: { id: p.id, unit, ok: false, note: `We don't say "${phrase(p, unit)}". We say "${phrase(p)}".` }, list: l ? { ...l, mistakes: l.mistakes + 1 } : l });
      useVoice.getState().speakAs('trader', `Sorry? Oh, you mean ${phrase(p)}!`, 'en-GB');
      return;
    }
    useVoice.getState().speakAs('me', `Can I have ${phrase(p)}, please?`, 'en-US');
    if (!l || !l.items.includes(p.id)) {
      set({ last: { id: p.id, unit, ok: true, note: l ? "That's not on your list." : 'Get a shopping list from Ruby first.' } });
      return;
    }
    if (l.bought.includes(p.id)) return;
    const bought = [...l.bought, p.id];
    set({ last: { id: p.id, unit, ok: true, note: `✅ ${phrase(p)}` }, list: { ...l, bought } });
    window.setTimeout(() => useVoice.getState().speakAs('trader', 'Here you are. Anything else?', 'en-GB'), 1500);
    if (bought.length === l.items.length) {
      track('riverside_market_done', { mistakes: l.mistakes });
      window.setTimeout(() => ruby('Well done! You bought everything on your list.'), 3200);
      reward(Math.max(1, 4 - l.mistakes), (result) => {
        const cur = get().list;
        if (cur) set({ list: { ...cur, result } });
      });
    }
  },
  startLost() {
    const things = shuffle(LOST_THINGS.map((_, i) => i)).slice(0, ROUNDS);
    const spots = shuffle(SPOTS.map((s) => s.id)).slice(0, ROUNDS);
    const order = things.map((thing, i) => ({ thing, spot: spots[i]! }));
    set({ lost: { order, round: 0, mistakes: 0, looked: [], done: false, result: null } });
    lily(lostLine(order[0]!));
    track('riverside_lost_start');
  },
  sayLost() {
    const l = get().lost;
    if (l && !l.done) lily(lostLine(l.order[l.round]!));
  },
  look(spot) {
    const l = get().lost;
    if (!l || l.done) return;
    const cur = l.order[l.round]!;
    if (spot !== cur.spot) {
      if (l.looked.includes(spot)) return;
      set({ lost: { ...l, mistakes: l.mistakes + 1, looked: [...l.looked, spot] } });
      useVoice.getState().speakAs('me', `It isn't ${SPOTS.find((s) => s.id === spot)!.en}.`, 'en-US');
      return;
    }
    useVoice.getState().speakAs('me', `I found ${LOST_THINGS[cur.thing]!.en.replace('my', 'your')}!`, 'en-US');
    const round = l.round + 1;
    if (round < l.order.length) {
      set({ lost: { ...l, round, looked: [] } });
      window.setTimeout(() => lily(`Thank you! ${lostLine(l.order[round]!)}`), 1800);
      return;
    }
    set({ lost: { ...l, round, looked: [], done: true } });
    window.setTimeout(() => lily('You found everything! Thank you so much!'), 1800);
    track('riverside_lost_done', { mistakes: l.mistakes });
    reward(ROUNDS + (l.mistakes === 0 ? 1 : 0) - Math.min(ROUNDS - 1, Math.floor(l.mistakes / 2)), (result) => {
      const c = get().lost;
      if (c) set({ lost: { ...c, result } });
    });
  },
  close: (what) => set(what === 'list' ? { list: null } : what === 'stall' ? { stall: null, last: null } : { lost: null }),
}));
