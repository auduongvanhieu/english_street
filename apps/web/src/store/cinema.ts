import { create } from 'zustand';
import { useArea } from './area';

export type CinemaMode = 'menu' | 'tickets' | 'books';

/** Which game of the cinema's activity tab is showing; the scene's box office / library desk switch it. */
export const useCinema = create<{ mode: CinemaMode; setMode: (m: CinemaMode) => void }>((set) => ({
  mode: 'menu',
  setMode: (mode) => set({ mode }),
}));

/** Open the guide on the activity tab in one mode (clicks in the 3D scene). */
export function openCinema(mode: CinemaMode) {
  useCinema.getState().setMode(mode);
  useArea.getState().setPanel(true, 'activity');
}
