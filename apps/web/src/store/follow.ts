import { create } from 'zustand';

/** Following another player around (LocalPlayer walks after them while no key / joystick is used). */
interface FollowStore {
  target: { id: string; name: string } | null;
  start: (id: string, name: string) => void;
  stop: () => void;
}

export const useFollow = create<FollowStore>((set) => ({
  target: null,
  start: (id, name) => set({ target: { id, name } }),
  stop: () => set({ target: null }),
}));
