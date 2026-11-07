import { create } from 'zustand';
import { soldOut } from './world';
import type { AreaItemDto } from '@es/shared';
import { reportMinigame, sendAreaQuiz } from '../net/api';
import { sendProp } from '../net/client';
import { useArea } from './area';
import { useProfile } from './profile';
import { useVoice } from './voice';
import { track } from '../net/analytics';
import { CHECKOUTS } from '../world/buildings';
import { teleportTo } from '../scene/LocalPlayer';

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

/** One line on the checkout screen (what the cashier has scanned). */
export interface TillLine {
  item: string;
  qty: number;
  name: string;
  price: number;
}
export type TillStage = 'line' | 'wait' | 'scan' | 'pay' | 'change' | 'bag' | 'done';
export interface Till {
  stage: TillStage;
  lines: TillLine[];
  /** lines scanned so far (the HUD steps it) */
  scanned: number;
  total: number;
  /** the note the shopper handed over */
  paid: number;
  options: number[];
  changeRight: boolean | null;
  note: string | null;
  /** which checkout (0 / 1) */
  at: number;
  /** shoppers in front of me (stage 'line' / 'wait') */
  ahead: number;
  /** what to say when you join the queue (the right line first, shown shuffled) */
  lineOptions: string[];
}

/** Joining the queue: the polite question first. */
export const QUEUE_LINES = ['Excuse me, is this the end of the queue?', 'Hey! Me first, I am in a hurry.', 'Excuse me, is this the end of the queue, yes, no?'];
/** Where the shopper stands at a checkout (being served). */
export const tillSpot = (i: number) => {
  const c = CHECKOUTS[i] ?? CHECKOUTS[0]!;
  return { x: (c.minX + c.maxX) / 2, z: c.maxZ + 0.9 };
};
export const QUEUE_GAP = 0.95;
/**
 * The k-th place in a checkout's queue (0 = being served). The front wall is close behind the tills, so the queue
 * runs along the counter towards the middle of the shop; people face the person in front (the first one the till).
 */
export const queueSpot = (i: number, k: number) => {
  const p = tillSpot(i);
  const dir = i === 0 ? 1 : -1;
  return { x: p.x + dir * k * QUEUE_GAP, z: p.z, rot: k === 0 ? Math.PI : dir > 0 ? -Math.PI / 2 : Math.PI / 2 };
};
const newQueue = () => [1 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 2)];

interface ShoppingStore {
  list: ListLine[];
  cart: Record<string, number>;
  /** pushing a trolley (synced to others as the "cart:n" prop) */
  trolley: boolean;
  /** Feedback after picking something ("not on your list"). */
  note: { text: string; ok: boolean; at: number } | null;
  result: { correct: number; total: number; xp: number; coins: number; change?: boolean } | null;
  till: Till | null;
  /** shoppers waiting at each checkout (drawn in the scene) */
  queue: number[];
  start: () => Promise<void>;
  pick: (item: string) => void;
  remove: (item: string) => void;
  takeTrolley: () => void;
  returnTrolley: () => void;
  /** walk up to the checkout: the cashier scans the trolley */
  openTill: (at?: number) => void;
  /** in the queue: say the line (the right one lets you join) */
  joinQueue: (line: string) => void;
  scanNext: () => void;
  payWith: (note: number) => void;
  sayChange: (v: number) => void;
  bag: (yes: boolean) => void;
  closeTill: () => void;
  /** pay without the till walk (empty trolley): straight to the result */
  checkout: () => Promise<void>;
  reset: () => void;
}

const cashier = (text: string) => useVoice.getState().speakAs('grocer', text, 'en-US');
const round2 = (v: number) => Math.round(v * 100) / 100;
const cartCount = (cart: Record<string, number>) => Object.values(cart).reduce((a, b) => a + b, 0);
const syncCart = (cart: Record<string, number>) => sendProp(`cart:${Math.min(99, cartCount(cart))}`);
/** Notes a shopper can hand over. */
export const NOTES = [5, 10, 20, 50];

/** Change choices: the right one and two near misses (a dollar off, the cents off). */
function changeOptions(right: number): number[] {
  const wrong = [right + 1, right - 1, right + 0.5, right - 0.5, right + 10].map(round2).filter((v) => v >= 0 && Math.abs(v - right) > 0.001);
  const pick = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
  return [right, ...pick].sort(() => Math.random() - 0.5);
}

/** "$12.50" the way a cashier says it: "12 dollars 50". */
export function speakMoney(v: number): string {
  const d = Math.floor(v + 1e-6);
  const c = Math.round((v - d) * 100);
  if (!c) return `${d} dollar${d === 1 ? '' : 's'}`;
  if (!d) return `${c} cents`;
  return `${d} dollar${d === 1 ? '' : 's'} ${c}`;
}

export const useShopping = create<ShoppingStore>((set, get) => ({
  list: [],
  cart: {},
  trolley: false,
  note: null,
  result: null,
  till: null,
  queue: newQueue(),
  async start() {
    const c = await useArea.getState().load('supermarket');
    if (!c) return;
    const gone = soldOut('supermarket');
    const pool = c.items.filter((it) => !gone.includes(it.id)).sort(() => Math.random() - 0.5).slice(0, 4);
    const list = pool.map((it) => {
      const qty = it.id === 'cake' ? 1 : 1 + Math.floor(Math.random() * 3);
      return { item: it.id, qty, text: phrase(it, qty) };
    });
    set({ list, cart: {}, note: null, result: null, till: null });
    if (get().trolley) syncCart({});
    track('shopping_start');
  },
  pick(item) {
    const { list, cart } = get();
    if (!list.length) return; // no list yet: tapping a product only opens its card
    if (soldOut('supermarket').includes(item)) return set({ note: { text: 'sold_out', ok: false, at: Date.now() } });
    const line = list.find((l) => l.item === item);
    const n = (cart[item] ?? 0) + 1;
    const next = { ...cart, [item]: n };
    if (!get().trolley) set({ trolley: true });
    syncCart(next);
    set({ cart: next, note: { text: line ? (n > line.qty ? 'too_many' : 'added') : 'not_on_list', ok: !!line && n <= line.qty, at: Date.now() } });
  },
  remove(item) {
    const cart = { ...get().cart };
    if (cart[item]) cart[item]! -= 1;
    if (!cart[item]) delete cart[item];
    set({ cart });
    if (get().trolley) syncCart(cart);
  },
  takeTrolley() {
    set({ trolley: true });
    syncCart(get().cart);
    track('supermarket_trolley');
    if (!get().list.length) void get().start();
  },
  returnTrolley() {
    set({ trolley: false });
    sendProp('');
  },
  openTill(at = 0) {
    const { cart, till } = get();
    if (till && till.stage !== 'done') return;
    const items = useArea.getState().content.supermarket?.items ?? [];
    const lines: TillLine[] = Object.entries(cart).map(([item, qty]) => {
      const it = items.find((i) => i.id === item);
      return { item, qty, name: it ? phrase(it, Math.min(qty, 3)) : item, price: it?.price ?? 1 };
    });
    if (!lines.length) return;
    const total = round2(lines.reduce((a, l) => a + l.qty * l.price, 0));
    const ahead = get().queue[at] ?? 0;
    const base = { lines, scanned: 0, total, paid: 0, options: [], changeRight: null, note: null, at, ahead, lineOptions: [...QUEUE_LINES].sort(() => Math.random() - 0.5) };
    if (ahead > 0) {
      // people are waiting: join the end of the queue first
      set({ result: null, till: { ...base, stage: 'line' } });
      track('supermarket_queue', { ahead });
      return;
    }
    set({ result: null, till: { ...base, stage: 'scan' } });
    cashier('Hi there! Did you find everything you need?');
    track('supermarket_till', { lines: lines.length });
  },
  joinQueue(line) {
    const till = get().till;
    if (!till || till.stage !== 'line') return;
    if (line !== QUEUE_LINES[0]) return set({ till: { ...till, note: line } });
    useVoice.getState().speakAs('me', line, 'en-US');
    window.setTimeout(() => useVoice.getState().speakAs('shopper', 'Yes, it is. Go ahead and wait behind me.', 'en-GB'), 1800);
    // stand at the end of the line
    const sp = queueSpot(till.at, till.ahead);
    teleportTo(sp.x, sp.z, sp.rot);
    set({ till: { ...till, stage: 'wait', note: null } });
    const step = () => {
      const t = get().till;
      if (!t || t.stage !== 'wait') return;
      const ahead = t.ahead - 1;
      const queue = get().queue.map((n, i) => (i === t.at ? Math.max(0, n - 1) : n));
      cashier(ahead > 0 ? 'Thank you! Next, please!' : 'Next, please!');
      const p = queueSpot(t.at, ahead);
      teleportTo(p.x, p.z, p.rot);
      if (ahead > 0) {
        set({ queue, till: { ...t, ahead } });
        window.setTimeout(step, 4000);
        return;
      }
      set({ queue, till: { ...t, ahead: 0, stage: 'scan' } });
      window.setTimeout(() => cashier('Hi there! Did you find everything you need?'), 1400);
      track('supermarket_till', { lines: t.lines.length, queued: true });
    };
    window.setTimeout(step, 4500);
  },
  scanNext() {
    const till = get().till;
    if (!till || till.stage !== 'scan') return;
    const scanned = till.scanned + 1;
    if (scanned < till.lines.length) return set({ till: { ...till, scanned } });
    set({ till: { ...till, scanned, stage: 'pay' } });
    cashier(`That's ${speakMoney(till.total)}, please.`);
  },
  payWith(note) {
    const till = get().till;
    if (!till || till.stage !== 'pay') return;
    if (note < till.total) {
      cashier(`Sorry, that's not enough. It's ${speakMoney(till.total)}.`);
      return set({ till: { ...till, note: 'not_enough' } });
    }
    const change = round2(note - till.total);
    if (change === 0) {
      cashier('Thank you! That is exactly right. Do you need a bag?');
      return set({ till: { ...till, paid: note, changeRight: true, stage: 'bag', note: null } });
    }
    cashier(`Out of ${speakMoney(note)}. Here's your change.`);
    set({ till: { ...till, paid: note, stage: 'change', options: changeOptions(change), note: null } });
  },
  sayChange(v) {
    const till = get().till;
    if (!till || till.stage !== 'change') return;
    const right = round2(till.paid - till.total);
    const ok = Math.abs(v - right) < 0.001;
    cashier(ok ? `Yes, ${speakMoney(right)} change. Do you need a bag?` : `Let me count it again: ${speakMoney(till.paid)} minus ${speakMoney(till.total)} is ${speakMoney(right)}. Do you need a bag?`);
    set({ till: { ...till, changeRight: ok, stage: 'bag' } });
  },
  bag(yes) {
    const till = get().till;
    if (!till || till.stage !== 'bag') return;
    cashier(yes ? "Here you are. That's ten cents for the bag. Have a nice day!" : 'No problem. Here is your receipt. Have a nice day!');
    set({ till: { ...till, stage: 'done' } });
    void finish(!!till.changeRight);
    // more shoppers arrive at the checkouts
    window.setTimeout(() => useShopping.setState({ queue: newQueue() }), 20_000);
  },
  closeTill: () => set({ till: null }),
  async checkout() {
    await finish(null);
  },
  reset: () => set({ list: [], cart: {}, note: null, result: null, till: null }),
}));

/** Score the list (and the change, when paid at the till), report it, empty the trolley. */
async function finish(changeRight: boolean | null) {
  const { list, cart } = useShopping.getState();
  if (!list.length && changeRight === null) return;
  const correct = list.filter((l) => cart[l.item] === l.qty).length;
  const extra = Object.keys(cart).filter((k) => !list.some((l) => l.item === k)).length;
  const score = list.length ? Math.max(0, correct - extra) : 0;
  let xp = 0;
  let coins = 0;
  try {
    if (list.length) {
      const r = await sendAreaQuiz('supermarket', score, list.length);
      xp += r.xp;
      coins += r.coins;
    }
    if (changeRight !== null) {
      const m = await reportMinigame('checkout', { score: score + (changeRight ? 2 : 0) });
      xp += m.xp;
      coins += m.coins;
    }
    void useProfile.getState().refresh();
  } catch {
    /* offline */
  }
  track('shopping_done', { correct: score, total: list.length, till: changeRight !== null, change: !!changeRight });
  useShopping.setState({ result: { correct: score, total: list.length, xp, coins, change: changeRight ?? undefined }, list: [], cart: {} });
  if (useShopping.getState().trolley) syncCart({});
}

// leaving the supermarket: the trolley stays at the door
useArea.subscribe((s, prev) => {
  if (s.current !== prev.current && s.current !== 'supermarket' && useShopping.getState().trolley) {
    useShopping.getState().returnTrolley();
    useShopping.setState({ till: null });
  }
});
