import { create } from 'zustand';
import type { AvatarLook } from '@es/shared';
import { cameraOrbit } from '../input/camera';
import { track } from '../net/analytics';
import { useArea } from './area';

/**
 * Style Corner fitting rooms: step into a cubicle, try clothes on in front of a real mirror. While trying, the local
 * character wears `look` (others see it only once you buy / wear it).
 */
interface FittingStore {
  room: number | null;
  look: AvatarLook | null;
  prevDist: number;
  prevMin: number;
  /** camera yaw that looks at the mirror (the area frame's rotation) */
  enter: (room: number, yaw: number) => void;
  setLook: (l: AvatarLook | null) => void;
  leave: () => void;
}
export const useFitting = create<FittingStore>((set, get) => ({
  room: null,
  look: null,
  prevDist: 0,
  prevMin: 0,
  enter(room, yaw) {
    if (get().room !== null) return;
    set({ room, prevDist: cameraOrbit.dist, prevMin: cameraOrbit.minDist });
    // close behind your back, looking at the mirror
    cameraOrbit.minDist = 2.4;
    cameraOrbit.dist = 3.2;
    // over the shoulder, so the mirror is not behind your head
    cameraOrbit.yaw = yaw - 0.55;
    track('clothes_fitting_room');
  },
  setLook: (look) => set({ look }),
  leave() {
    const { room, prevDist, prevMin } = get();
    if (room === null) return;
    if (prevMin) cameraOrbit.minDist = prevMin;
    if (prevDist) cameraOrbit.dist = prevDist;
    set({ room: null, look: null });
  },
}));

useArea.subscribe((s, prev) => {
  if (s.current !== prev.current && prev.current === 'clothes') useFitting.getState().leave();
});
