import { create } from 'zustand';
import { TABLES } from '../world/buildings';
import { sendProp } from '../net/client';
import { useGame } from './game';
import { track } from '../net/analytics';
import { teleportTo } from '../scene/LocalPlayer';

export interface SeatRef {
  table: number;
  seat: number;
}

interface RestaurantStore {
  /** Chair I'm sitting on. */
  seat: SeatRef | null;
  /** Nearest free chair within reach (for the Sit button). */
  near: SeatRef | null;
  /** What I ordered and when it arrives. */
  order: { item: string; readyAt: number } | null;
  setNear: (s: SeatRef | null) => void;
  sit: (s: SeatRef) => void;
  stand: () => void;
  orderDish: (item: string) => void;
}

let timer: number | null = null;

export const useRestaurant = create<RestaurantStore>((set, get) => ({
  seat: null,
  near: null,
  order: null,
  setNear: (near) => {
    const cur = get().near;
    if (cur?.table === near?.table && cur?.seat === near?.seat) return;
    set({ near });
  },
  sit(s) {
    const seat = TABLES[s.table]?.seats[s.seat];
    if (!seat) return;
    teleportTo(seat.x, seat.z, seat.rot);
    set({ seat: s });
    track('restaurant_sit', { table: s.table });
  },
  stand() {
    if (!get().seat) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    sendProp('');
    set({ seat: null, order: null });
  },
  orderDish(item) {
    if (!get().seat) return;
    if (timer !== null) clearTimeout(timer);
    sendProp('');
    const readyAt = Date.now() + 5000;
    set({ order: { item, readyAt } });
    track('restaurant_order', { item });
    // The waiter brings it after a few seconds; everyone at the restaurant sees it on your table.
    timer = window.setTimeout(() => {
      timer = null;
      if (get().order?.item === item) sendProp(`dish:${item}`);
    }, 5000);
  },
}));

/** Seats taken by other players (they sit exactly on the chair). */
export function seatTaken(x: number, z: number): boolean {
  const g = useGame.getState();
  for (const id in g.players) {
    if (id === g.sessionId) continue;
    const p = g.players[id]!;
    if (p.anim === 'sit' && Math.abs(p.x - x) < 0.3 && Math.abs(p.z - z) < 0.3) return true;
  }
  return false;
}
