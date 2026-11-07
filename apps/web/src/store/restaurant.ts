import { create } from 'zustand';
import { TABLES } from '../world/buildings';
import { sendProp } from '../net/client';
import { useGame } from './game';
import { useArea } from './area';
import { useVoice } from './voice';
import { track } from '../net/analytics';
import { teleportTo } from '../scene/LocalPlayer';
import { WAITER_HOME, sendWaiter, servingSpot, waiterHome, waiterSays } from '../world/waiter';

export interface SeatRef {
  table: number;
  seat: number;
}

/**
 * A meal at the restaurant:
 * greet (server walks over) → menu (order) → kitchen / serve (server fetches the dish) → served (Eat) →
 * eating → finished (Ask for the bill) → bill (server fetches it) → paying (Pay) → menu again.
 */
export type MealStep = 'greet' | 'menu' | 'kitchen' | 'serve' | 'served' | 'eating' | 'finished' | 'bill' | 'paying';

interface RestaurantStore {
  /** Chair I'm sitting on. */
  seat: SeatRef | null;
  /** Nearest free chair within reach (for the Sit button). */
  near: SeatRef | null;
  /** What I ordered. */
  order: { item: string } | null;
  step: MealStep;
  /** 0…1 while eating */
  eaten: number;
  setNear: (s: SeatRef | null) => void;
  sit: (s: SeatRef) => void;
  stand: () => void;
  orderDish: (item: string) => void;
  eat: () => void;
  askBill: () => void;
  /** pay the bill: tip in percent, and the total the guest worked out (null = no tip) */
  pay: (tip?: number, total?: number) => void;
  /** Eating with other players at the table: everybody's dishes on one bill. */
  bill: BillLine[];
  /** Shared bill: split it equally (the share the guest worked out) or pay for everybody. */
  payShared: (mode: 'split' | 'treat', amount: number) => void;
}

export interface BillLine {
  /** '' = me */
  who: string;
  name: string;
  item: string;
  price: number;
}

const EAT_MS = 9000;
let timers: number[] = [];
const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
const clearTimers = () => {
  timers.forEach((x) => clearTimeout(x));
  timers = [];
};

/** Mia's lines: spoken aloud (NPC voice) and shown in a bubble over her head. */
function serverSays(text: string) {
  waiterSays(text);
  useVoice.getState().speakAs('server', text, 'en-US');
}
/** The player's own line (read aloud so they hear how to say it). */
function iSay(text: string) {
  useVoice.getState().speakAs('me', text, 'en-US');
}

export function menuItem(id: string) {
  return useArea.getState().content.restaurant?.items.find((i) => i.id === id);
}

export const useRestaurant = create<RestaurantStore>((set, get) => {
  /** Still sitting at the same table (the player may stand up while Mia is walking). */
  const still = (s: SeatRef) => get().seat?.table === s.table && get().seat?.seat === s.seat;
  const goToTable = (s: SeatRef, carry: string, onArrive: () => void) => {
    const spot = servingSpot(s.table, s.seat);
    sendWaiter(spot, { carry, face: spot.face, onArrive: () => still(s) && onArrive() });
  };
  return {
    seat: null,
    near: null,
    order: null,
    step: 'greet',
    eaten: 0,
    bill: [],
    setNear: (near) => {
      const cur = get().near;
      if (cur?.table === near?.table && cur?.seat === near?.seat) return;
      set({ near });
    },
    sit(s) {
      const seat = TABLES[s.table]?.seats[s.seat];
      if (!seat) return;
      teleportTo(seat.x, seat.z, seat.rot);
      clearTimers();
      set({ seat: s, step: 'greet', order: null, eaten: 0, bill: [] });
      mateDish.clear();
      track('restaurant_sit', { table: s.table });
      // Mia comes over with the menu
      goToTable(s, '', () => {
        if (get().step !== 'greet') return;
        serverSays('Good evening! Here is the menu. What would you like?');
        set({ step: 'menu' });
        useArea.getState().setPanel(true, 'menu');
      });
    },
    stand() {
      if (!get().seat) return;
      clearTimers();
      sendProp('');
      set({ seat: null, order: null, step: 'greet', eaten: 0, bill: [] });
      waiterHome();
    },
    orderDish(item) {
      const s = get().seat;
      if (!s || !['greet', 'menu'].includes(get().step)) return;
      set({ order: { item }, step: 'kitchen' });
      track('restaurant_order', { item });
      const name = menuItem(item)?.en ?? 'that';
      // she writes it down (coming over first if she isn't there yet), takes it to the kitchen and brings it back
      goToTable(s, '', () => {
        serverSays(`One ${name}. Good choice! I'll be right back.`);
        later(1800, () => {
          if (!still(s)) return;
          sendWaiter(WAITER_HOME, {
            face: { x: WAITER_HOME.x, z: WAITER_HOME.z - 5 },
            onArrive: () =>
              later(2500, () => {
                if (!still(s) || get().order?.item !== item) return;
                set({ step: 'serve' });
                goToTable(s, `dish:${item}`, () => {
                  sendProp(`dish:${item}`);
                  serverSays(`Here is your ${name}. Enjoy your meal!`);
                  set({ step: 'served' });
                  later(2000, () => still(s) && waiterHome());
                });
              }),
          });
        });
      });
    },
    eat() {
      if (get().step !== 'served') return;
      set({ step: 'eating', eaten: 0 });
      track('restaurant_eat', { item: get().order?.item ?? '' });
      const t0 = Date.now();
      const tick = () => {
        if (get().step !== 'eating') return;
        const k = Math.min(1, (Date.now() - t0) / EAT_MS);
        set({ eaten: k });
        if (k < 1) later(250, tick);
        else {
          sendProp('dish:empty');
          set({ step: 'finished' });
          iSay('That was delicious!');
        }
      };
      later(250, tick);
    },
    askBill() {
      const s = get().seat;
      if (!s || get().step !== 'finished') return;
      iSay('Excuse me. Could I have the bill, please?');
      set({ step: 'bill' });
      sendWaiter(WAITER_HOME, {
        onArrive: () =>
          later(1200, () => {
            if (!still(s)) return;
            goToTable(s, 'bill', () => {
              const item = get().order?.item ?? '';
              const price = menuItem(item)?.price;
              const bill = tableBill(s.table, item);
              if (bill.length > 1) {
                const total = Math.round(bill.reduce((a, l) => a + l.price, 0) * 100) / 100;
                serverSays(`Here is the bill for the table. That's ${total} dollars altogether. Would you like to pay together or separately?`);
              } else serverSays(price ? `Here is your bill. That's ${price} dollars, please.` : 'Here is your bill.');
              set({ step: 'paying', bill: bill.length > 1 ? bill : [] });
            });
          }),
      });
    },
    pay(tip = 0, total) {
      const s = get().seat;
      if (!s || get().step !== 'paying') return;
      const price = menuItem(get().order?.item ?? '')?.price ?? 0;
      const right = tipTotal(price, tip);
      const ok = !tip || (total !== undefined && Math.abs(total - right) < 0.005);
      iSay(tip ? `Here's ${money(total ?? right)}. That includes a ${tip} percent tip.` : 'Here you are. Thank you!');
      track('restaurant_pay', { item: get().order?.item ?? '', tip, ok });
      later(2200, () => {
        if (!still(s)) return;
        serverSays(!tip ? 'Thank you very much! Have a nice day!' : ok ? "That's very kind of you, thank you so much! Have a nice day!" : `Thank you! Actually, with the tip it's ${money(right)}. Have a nice day!`);
        sendProp('');
        set({ step: 'menu', order: null, eaten: 0, bill: [] });
        later(1500, () => still(s) && waiterHome());
      });
    },
    payShared(mode, amount) {
      const s = get().seat;
      const bill = get().bill;
      if (!s || get().step !== 'paying' || bill.length < 2) return;
      const total = Math.round(bill.reduce((a, l) => a + l.price, 0) * 100) / 100;
      const each = shareOf(total, bill.length);
      const ok = mode === 'treat' ? Math.abs(amount - total) < 0.005 : Math.abs(amount - each) < 0.005;
      iSay(mode === 'treat' ? `It's on me! Here's ${money(total)} for everyone.` : `Can we split the bill, please? Here's my share: ${money(amount)}.`);
      track('restaurant_pay_shared', { mode, people: bill.length, ok });
      later(2400, () => {
        if (!still(s)) return;
        serverSays(
          mode === 'treat'
            ? "That's very generous of you! Thank you, and have a lovely evening!"
            : ok
              ? `Of course. That's ${money(each)} each. Thank you very much!`
              : `Let me check: ${money(total)} divided by ${bill.length} is ${money(each)} each. Thank you!`,
        );
        sendProp('');
        set({ step: 'menu', order: null, eaten: 0, bill: [] });
        later(1500, () => still(s) && waiterHome());
      });
    },
  };
});

/** Equal share of a bill, rounded to cents. */
export const shareOf = (total: number, people: number) => Math.round((total / people) * 100) / 100;

/** What the other players at my table ordered (seen on their plates: prop "dish:<item>"). */
const mateDish = new Map<string, string>();
/** Other players sitting on a chair of this table. */
function tableMates(table: number) {
  const t = TABLES[table];
  const g = useGame.getState();
  if (!t) return [];
  return Object.values(g.players).filter(
    (p) => p.id !== g.sessionId && (p.anim === 'sit' || p.anim === 'eat') && t.seats.some((c) => Math.abs(p.x - c.x) < 0.3 && Math.abs(p.z - c.z) < 0.3),
  );
}
useGame.subscribe((g) => {
  const seat = useRestaurant.getState().seat;
  if (!seat) return;
  for (const p of tableMates(seat.table)) {
    const m = /^dish:([a-z-]+)$/.exec(p.prop);
    if (m && m[1] !== 'empty' && menuItem(m[1]!)) mateDish.set(p.id, m[1]!);
  }
  void g;
});
/** The table's bill: my dish first, then each table mate whose dish I saw. */
function tableBill(table: number, mine: string): BillLine[] {
  const lines: BillLine[] = [];
  const me = menuItem(mine);
  if (me) lines.push({ who: '', name: 'You', item: me.en, price: me.price ?? 0 });
  for (const p of tableMates(table)) {
    const d = mateDish.get(p.id);
    const it = d ? menuItem(d) : undefined;
    if (it) lines.push({ who: p.id, name: p.name, item: it.en, price: it.price ?? 0 });
  }
  return lines;
}

/** Seats taken by other players (they sit exactly on the chair). */
export function seatTaken(x: number, z: number): boolean {
  const g = useGame.getState();
  for (const id in g.players) {
    if (id === g.sessionId) continue;
    const p = g.players[id]!;
    if ((p.anim === 'sit' || p.anim === 'eat') && Math.abs(p.x - x) < 0.3 && Math.abs(p.z - z) < 0.3) return true;
  }
  return false;
}

/** Bill + tip, rounded to cents. */
export const tipTotal = (price: number, tip: number) => Math.round(price * (100 + tip)) / 100;
/** "$12.50" / "$12" */
export const money = (v: number) => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
