import { create } from 'zustand';
import { soldOut } from './world';
import type { AreaItemDto } from '@es/shared';
import { sendAreaQuiz } from '../net/api';
import { useArea } from './area';
import { useProfile } from './profile';
import { track } from '../net/analytics';

/** One line of the shopping list, written the way people say it ("two loaves of bread"). */
export interface ListLine {
  item: string;
  qty: number;
  text: string;
}

const NUM = ['zero', 'one', 'two', 'three'];
const UNIT_PLURAL: Record<string, string> = {
  'a bunch of': 'bunches of',
  'a jar of': 'jars of',
  'a bag of': 'bags of',
  'a head of': 'heads of',
  'a kilo of': 'kilos of',
  'a loaf of': 'loaves of',
  'a carton of': 'cartons of',
  'a piece of': 'pieces of',
  'a box of': 'boxes of',
  'a pot of': 'pots of',
  'a pack of': 'packs of',
  'a tub of': 'tubs of',
  'a bottle of': 'bottles of',
  'a can of': 'cans of',
  'a bar of': 'bars of',
  'a tube of': 'tubes of',
};
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

/** "a carton of milk", "two loaves of bread", "three croissants", "a birthday cake". */
export function phrase(it: Pick<AreaItemDto, 'en' | 'plural' | 'unit'>, qty: number): string {
  const noun = it.plural ?? it.en;
  if (it.unit) return qty === 1 ? `${it.unit} ${noun}` : `${NUM[qty]} ${UNIT_PLURAL[it.unit] ?? it.unit} ${noun}`;
  return qty === 1 ? `${article(it.en)} ${it.en}` : `${NUM[qty]} ${noun}`;
}

interface ShoppingStore {
  list: ListLine[];
  cart: Record<string, number>;
  /** Feedback after picking something ("not on your list"). */
  note: { text: string; ok: boolean; at: number } | null;
  result: { correct: number; total: number; xp: number; coins: number } | null;
  start: () => Promise<void>;
  pick: (item: string) => void;
  remove: (item: string) => void;
  checkout: () => Promise<void>;
  reset: () => void;
}

export const useShopping = create<ShoppingStore>((set, get) => ({
  list: [],
  cart: {},
  note: null,
  result: null,
  async start() {
    const c = await useArea.getState().load('supermarket');
    if (!c) return;
    const gone = soldOut('supermarket');
    const pool = c.items.filter((it) => !gone.includes(it.id)).sort(() => Math.random() - 0.5).slice(0, 4);
    const list = pool.map((it) => {
      const qty = it.id === 'cake' ? 1 : 1 + Math.floor(Math.random() * 3);
      return { item: it.id, qty, text: phrase(it, qty) };
    });
    set({ list, cart: {}, note: null, result: null });
    track('shopping_start');
  },
  pick(item) {
    const { list, cart } = get();
    if (!list.length) return; // no list yet: tapping a product only opens its card
    if (soldOut('supermarket').includes(item)) return set({ note: { text: 'sold_out', ok: false, at: Date.now() } });
    const line = list.find((l) => l.item === item);
    const n = (cart[item] ?? 0) + 1;
    set({ cart: { ...cart, [item]: n }, note: { text: line ? (n > line.qty ? 'too_many' : 'added') : 'not_on_list', ok: !!line && n <= line.qty, at: Date.now() } });
  },
  remove(item) {
    const cart = { ...get().cart };
    if (cart[item]) cart[item]! -= 1;
    if (!cart[item]) delete cart[item];
    set({ cart });
  },
  async checkout() {
    const { list, cart } = get();
    if (!list.length) return;
    const correct = list.filter((l) => cart[l.item] === l.qty).length;
    const extra = Object.keys(cart).filter((k) => !list.some((l) => l.item === k)).length;
    const score = Math.max(0, correct - extra);
    let xp = 0;
    let coins = 0;
    try {
      const r = await sendAreaQuiz('supermarket', score, list.length);
      xp = r.xp;
      coins = r.coins;
      void useProfile.getState().refresh();
    } catch {
      /* offline */
    }
    track('shopping_done', { correct: score, total: list.length });
    set({ result: { correct: score, total: list.length, xp, coins }, list: [], cart: {} });
  },
  reset: () => set({ list: [], cart: {}, note: null, result: null }),
}));
