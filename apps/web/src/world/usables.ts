import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Things you can use by walking up to them: a lift button, a hotel door, a phone, a minibar, a ball, a boat…
 * Scenes register them (useUsable); LocalPlayer picks the nearest one in reach ~10×/s; the HUD shows a
 * button (touch) or "E" prompt (keyboard). NPC talk keeps priority (INTERACT_RADIUS), then usables, then seats.
 */
export interface Usable {
  id: string;
  /** world position (x, z) and reach in metres */
  x: number;
  z: number;
  r?: number;
  icon: string;
  /** label in the learner's language (already translated) */
  label: string;
  use: () => void;
  /** greyed out, with a reason shown instead of the action */
  disabled?: string;
  /** wins over a nearby NPC's Talk (e.g. kitchen stations while cooking next to the chef) */
  priority?: boolean;
}

const all = new Map<string, Usable>();
export const registerUsable = (u: Usable) => void all.set(u.id, u);
export const unregisterUsable = (id: string) => void all.delete(id);
export const usables = () => all.values();

/** Register while mounted (re-registers when the fields change). */
export function useUsable(u: Usable | null) {
  const key = u ? `${u.id}|${u.x}|${u.z}|${u.r}|${u.icon}|${u.label}|${u.disabled ?? ''}` : '';
  useEffect(() => {
    if (!u) return;
    registerUsable(u);
    return () => {
      if (all.get(u.id) === u) unregisterUsable(u.id);
      if (useNearUsable.getState().near?.id === u.id) useNearUsable.setState({ near: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // the callback may change without the position: keep the latest one
  if (u && all.get(u.id)) all.set(u.id, u);
}

export const useNearUsable = create<{ near: Usable | null }>(() => ({ near: null }));

/** Nearest usable within its reach of (x, z); called by LocalPlayer. */
export function pickUsable(x: number, z: number): Usable | null {
  let best: Usable | null = null;
  let bestD = Infinity;
  for (const u of all.values()) {
    const r = u.r ?? 1.4;
    const d = Math.hypot(u.x - x, u.z - z);
    if (d <= r && d < bestD) {
      best = u;
      bestD = d;
    }
  }
  return best;
}

/** Use the nearest usable (E key / button). Returns false when there is none or it is disabled. */
export function useNearest(): boolean {
  const u = useNearUsable.getState().near;
  if (!u || u.disabled) return false;
  u.use();
  return true;
}
