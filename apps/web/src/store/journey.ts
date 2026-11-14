import { create } from 'zustand';
import { FISH_SPOTS } from './fishing';
import { MAIN_STEPS, PIERS, stepById, type JourneyEvent, type JourneyGuide, type JourneyStep, type JourneyView } from '@es/shared';
import { get, post } from '../net/api';
import { getPlayerId } from '../net/player';
import { onJourney } from '../net/client';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { localPos, teleportTo } from '../scene/LocalPlayer';
import { AREAS, areaById, frontZ, yardRect } from '../world/areas';
import { nearestStop } from '../world/bus';
import { useBus } from './bus';
import { KIOSK_SPOT } from '../world/places/river';
import { COOK_Z, STATIONS } from '../world/kitchen';
import { BOOK_SPOTS, FRAME as CINEMA } from '../world/places/cinema';
import { useGame } from './game';
import { useProfile } from './profile';
import { stepText } from '../ui/journey/journeyText';

/**
 * The Journey (quest system) in the game: progress from the API, completion pushes from the game server (toasts),
 * the current step for the HUD chip, and "Take me there" (the bus to the nearest stop, then walking along yellow dots;
 * the NPC's panel opens on arrival).
 */
export interface JourneyToast {
  key: number;
  id: string;
  xp: number;
  coins: number;
  /** 💎 gift (main chapters) */
  gems?: number;
  /** days in a row (the streak gift) */
  streak?: number;
  stamp?: string;
}
interface JourneyStore {
  view: JourneyView | null;
  toasts: JourneyToast[];
  /** the step whose target the arrow points at */
  guiding: string | null;
  /** "Take me there": walk the last part (after the bus) along the dots: to `via` (an area gate) first, then the
   * target; talk to `npc` on arrival */
  walk: { x: number; z: number; via: { x: number; z: number } | null; npc?: string; area?: string; label: string } | null;
  stopWalk: () => void;
  load: () => Promise<void>;
  track: (id: string, on: boolean) => Promise<void>;
  go: (step: JourneyStep) => void;
  dismiss: (key: number) => void;
  /** a toast that is not a journey step (the 💎 streak gift) */
  pushToast: (x: Omit<JourneyToast, 'key'>) => void;
}

const q = () => `?playerId=${encodeURIComponent(getPlayerId())}`;
let toastKey = 0;

/** Where a guide points (world x, z) and which way to face on arrival. */
export function guideTarget(g: JourneyGuide | undefined): { x: number; z: number; rot: number; npc?: string } | null {
  if (!g) return null;
  if ('npc' in g) {
    const n = useGame.getState().npcs.find((x) => x.id === g.npc);
    if (!n) return null;
    const f = n.facing ?? 0;
    return { x: n.position[0] + Math.sin(f) * 1.8, z: n.position[2] + Math.cos(f) * 1.8, rot: f + Math.PI, npc: n.id };
  }
  if ('area' in g) {
    // a few steps inside the gate (in the area, so its guide can open on arrival)
    const a = areaById(g.area);
    const z = frontZ(a) + (a.side === 'north' ? -3 : 3);
    return { x: a.doorX, z, rot: a.side === 'north' ? Math.PI : 0 };
  }
  switch (g.place) {
    case 'river':
    case 'kiosk':
      return { x: KIOSK_SPOT.x + 0.6, z: KIOSK_SPOT.z, rot: -Math.PI / 2 };
    case 'ferry':
      return { x: PIERS.ferryN.x, z: PIERS.ferryN.tipZ - 1.2, rot: 0 };
    case 'fishing':
      return { x: FISH_SPOTS[0]!.x, z: FISH_SPOTS[0]!.z, rot: 0 };
    case 'kitchen':
      return { x: STATIONS.prep.x, z: COOK_Z, rot: Math.PI };
    case 'library': {
      const [x, z] = CINEMA.toWorld(BOOK_SPOTS[0]!.x, BOOK_SPOTS[0]!.z + 0.4);
      return { x, z, rot: Math.PI };
    }
  }
  return null;
}

export const useJourney = create<JourneyStore>((set, getS) => ({
  view: null,
  toasts: [],
  guiding: null,
  walk: null,
  async load() {
    try {
      set({ view: await get<JourneyView>(`/me/journey${q()}`) });
    } catch {
      /* offline */
    }
  },
  async track(id, on) {
    try {
      const r = await post<{ tracked: string[] }>(`/me/journey/track${q()}`, { id, on });
      const v = getS().view;
      if (v) set({ view: { ...v, state: { ...v.state, tracked: r.tracked } } });
    } catch {
      /* ignore */
    }
  },
  go(step) {
    const t = guideTarget(step.guide);
    if (!t) return;
    useGame.getState().setUiPanel(null);
    set({ guiding: step.id });
    track('journey_go', { id: step.id });
    // somewhere off the street map (a hotel room, a trip…): jump there as before
    if (t.z < -100 || localPos.z < -100) {
      teleportTo(t.x, t.z, t.rot);
      return;
    }
    // inside an area yard: through its gate
    const area = AREAS.find((a) => {
      const y = yardRect(a);
      return t.x >= y.minX && t.x <= y.maxX && t.z >= y.minZ && t.z <= y.maxZ;
    });
    const gate = area ? { x: area.doorX, z: frontZ(area) + (area.side === 'north' ? 1.5 : -1.5) } : null;
    const via = gate && Math.hypot(gate.x - t.x, gate.z - t.z) > 2 ? gate : null;
    set({ walk: { x: t.x, z: t.z, via, npc: t.npc, area: step.guide && 'area' in step.guide ? step.guide.area : undefined, label: stepText(step).title } });
    // far away: take the bus to the stop nearest to the target first (the dots show after stepping off)
    const stop = nearestStop(t.x, t.z);
    if (Math.hypot(localPos.x - t.x, localPos.z - t.z) > 30 && nearestStop(localPos.x, localPos.z) !== stop && !useBus.getState().ride) {
      void import('../ui/area/Travel').then((m) => m.rideTo(stop));
    }
  },
  stopWalk: () => set({ walk: null }),
  dismiss(key) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.key !== key) }));
  },
  pushToast(x) {
    const key = ++toastKey;
    set((s) => ({ toasts: [...s.toasts, { ...x, key }].slice(-4) }));
    window.setTimeout(() => getS().dismiss(key), 7000);
  },
}));

/** The step to show on the HUD: the current main chapter, else a tracked / today's task. */
export function currentStep(v: JourneyView | null): JourneyStep | null {
  if (!v) return null;
  const main = MAIN_STEPS[v.chapter];
  if (main) return main;
  const id = v.state.tracked[0] ?? v.state.daily.find((d) => !v.state.dailyDone.includes(d));
  return id ? (stepById(id) ?? null) : null;
}

export function initJourney() {
  const off = onJourney((ev: JourneyEvent) => {
    haptic('medium');
    const toasts = ev.done.map((d) => ({ key: ++toastKey, id: d.id, xp: d.xp, coins: d.coins, gems: d.gems ?? 0, stamp: undefined as string | undefined }));
    if (ev.stamp && toasts[0]) toasts[toasts.length - 1]!.stamp = ev.stamp;
    useJourney.setState((s) => ({ toasts: [...s.toasts, ...toasts].slice(-4) }));
    for (const x of toasts) window.setTimeout(() => useJourney.getState().dismiss(x.key), 7000);
    // the guide arrow moves on with the journey
    if (ev.done.some((d) => d.id === useJourney.getState().guiding)) useJourney.setState({ guiding: null, walk: null });
    void useJourney.getState().load();
    void useProfile.getState().refresh();
  });
  void useJourney.getState().load();
  return off;
}

