import { create } from 'zustand';
import { applyFarmConfig, type WorldDto } from '@es/shared';
import { API_URL } from '../net/api';
import { ENCLOSURES } from '../world/zooLayout';
import { CRITTERS } from '../world/critters';

/**
 * World settings from the admin site (GET /world): animal names, farm rules, sold-out items, notices and
 * maintenance. Loaded before the street is shown and refreshed every 2 minutes.
 */
export interface Notice {
  id: string;
  text: string;
  level: 'info' | 'warning';
}
interface WorldStore {
  cfg: WorldDto | null;
  /** Live notices from the server (announcements, mute…) shown as toasts. */
  live: (Notice & { at: number })[];
  dismissed: string[];
  pushLive: (n: Omit<Notice, 'id'>) => void;
  dismiss: (id: string) => void;
}
const LS_DISMISSED = 'es:noticesSeen';

const ZOO_DEFAULT = new Map(ENCLOSURES.map((e) => [e.item, [...e.names]]));
const CRITTER_DEFAULT = new Map(CRITTERS.map((c) => [c.id, c.name]));

function apply(cfg: WorldDto) {
  applyFarmConfig(cfg.farm);
  for (const e of ENCLOSURES) e.names = cfg.zooNames[e.item] ?? ZOO_DEFAULT.get(e.item) ?? e.names;
  for (const c of CRITTERS) c.name = cfg.critterNames[c.id] ?? CRITTER_DEFAULT.get(c.id) ?? c.name;
}

export const useWorld = create<WorldStore>((set, get) => ({
  cfg: null,
  live: [],
  dismissed: (() => {
    try {
      return JSON.parse(localStorage.getItem(LS_DISMISSED) ?? '[]') as string[];
    } catch {
      return [];
    }
  })(),
  pushLive(n) {
    const item = { ...n, id: `live-${Date.now()}`, at: Date.now() };
    set({ live: [...get().live.slice(-2), item] });
    setTimeout(() => set({ live: get().live.filter((x) => x.id !== item.id) }), 10_000);
  },
  dismiss(id) {
    const d = [...get().dismissed.slice(-30), id];
    localStorage.setItem(LS_DISMISSED, JSON.stringify(d));
    set({ dismissed: d, live: get().live.filter((x) => x.id !== id) });
  },
}));

export async function loadWorld() {
  try {
    const res = await fetch(`${API_URL}/world`);
    if (!res.ok) return;
    const cfg = (await res.json()) as WorldDto;
    apply(cfg);
    useWorld.setState({ cfg });
  } catch {
    /* API down: code defaults */
  }
}
let started = false;
export function startWorldSync() {
  if (started) return;
  started = true;
  void loadWorld();
  setInterval(() => void loadWorld(), 120_000);
}

/** Item ids sold out today in an area. */
export const soldOut = (area: string): string[] => useWorld.getState().cfg?.soldOut[area] ?? [];
/** Staff can play during maintenance (signed in to the admin site in this browser tab). */
export const isStaffTab = () => !!sessionStorage.getItem('es:admin');
