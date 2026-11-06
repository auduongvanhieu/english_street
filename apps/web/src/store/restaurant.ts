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
  pay: () => void;
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
      set({ seat: s, step: 'greet', order: null, eaten: 0 });
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
      set({ seat: null, order: null, step: 'greet', eaten: 0 });
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
              const price = menuItem(get().order?.item ?? '')?.price;
              serverSays(price ? `Here is your bill. That's ${price} dollars, please.` : 'Here is your bill.');
              set({ step: 'paying' });
            });
          }),
      });
    },
    pay() {
      const s = get().seat;
      if (!s || get().step !== 'paying') return;
      iSay('Here you are. Thank you!');
      track('restaurant_pay', { item: get().order?.item ?? '' });
      later(1600, () => {
        if (!still(s)) return;
        serverSays('Thank you very much! Have a nice day!');
        sendProp('');
        set({ step: 'menu', order: null, eaten: 0 });
        later(1500, () => still(s) && waiterHome());
      });
    },
  };
});

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
