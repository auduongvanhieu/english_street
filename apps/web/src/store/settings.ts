import { create } from 'zustand';

export type Quality = 'high' | 'low';

/** Low quality = no shadows, dpr 1, fewer remote characters. Default: low on touch devices. */
function initialQuality(): Quality {
  const saved = localStorage.getItem('es:quality');
  if (saved === 'high' || saved === 'low') return saved;
  return matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
}

interface Settings {
  quality: Quality;
  setQuality: (q: Quality) => void;
}

export const useSettings = create<Settings>((set) => ({
  quality: initialQuality(),
  setQuality: (quality) => {
    localStorage.setItem('es:quality', quality);
    set({ quality });
  },
}));
