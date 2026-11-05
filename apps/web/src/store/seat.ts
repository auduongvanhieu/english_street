import { create } from 'zustand';
import { standSpot, type Seat } from '../world/seats';
import { teleportTo } from '../scene/LocalPlayer';
import { track } from '../net/analytics';

/** Sitting on any chair / bench / sofa (world/seats.ts). */
interface SeatStore {
  seat: Seat | null;
  /** Nearest free seat within reach (for the Sit button / E). */
  near: Seat | null;
  setNear: (s: Seat | null) => void;
  sit: (s: Seat) => void;
  stand: () => void;
}

export const useSeat = create<SeatStore>((set, get) => ({
  seat: null,
  near: null,
  setNear(near) {
    if (near !== get().near) set({ near });
  },
  sit(s) {
    teleportTo(s.x, s.z, s.rot);
    set({ seat: s, near: null });
    track('seat_sit');
  },
  stand() {
    const s = get().seat;
    if (!s) return;
    const [x, z] = standSpot(s);
    teleportTo(x, z, s.rot);
    set({ seat: null });
  },
}));
