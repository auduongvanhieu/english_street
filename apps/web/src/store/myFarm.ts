import { create } from 'zustand';
import { applyMyFarm, emptyMyFarm, myFarm, type FarmView, type MyFarmAction, type MyFarmError, type MyFarmState } from '@es/shared';
import { get, post } from '../net/api';
import { getPlayerId } from '../net/player';
import { onFarm, sendFarm } from '../net/client';
import { track } from '../net/analytics';
import { teleportTo } from '../scene/LocalPlayer';
import { areaById, frontZ } from '../world/areas';
import { useProfile } from './profile';
import { useGame } from './game';
import { useVoice } from './voice';

/**
 * "My farm" in the game: going in (the game server gives the farm a slot in this zone), your farm's state from
 * the API, actions (run locally first, then confirmed by the API), and visiting a friend's farm (read-only).
 */
export type FarmPanel = 'shop' | 'barn' | 'settings' | { plot: number } | null;
interface MyFarmStore {
  /** the farm you are in (or going to): owner id, name, slot (-1 = waiting for the server) */
  at: { owner: string; name: string; slot: number } | null;
  mine: MyFarmState;
  /** somebody else's farm while visiting */
  view: FarmView | null;
  coins: number;
  skew: number;
  day: string;
  loaded: boolean;
  panel: FarmPanel;
  last: { said: string; xp: number; coins: number; error?: MyFarmError | 'closed' | 'friends_only'; at: number } | null;
  enter: (owner?: string, name?: string) => void;
  leave: () => void;
  load: () => Promise<void>;
  act: (a: MyFarmAction) => Promise<void>;
  setPanel: (p: FarmPanel) => void;
}

const q = () => `?playerId=${encodeURIComponent(getPlayerId())}`;
const say = (s: string) => useVoice.getState().speakAs('me', s, 'en-US');
type Reply = { farm: MyFarmState; coins: number; now: number; day?: string; said?: string; xp?: number; delta?: number; error?: MyFarmError };

export const useMyFarm = create<MyFarmStore>((set, getS) => ({
  at: null,
  mine: emptyMyFarm(),
  view: null,
  coins: 0,
  skew: 0,
  day: '',
  loaded: false,
  panel: null,
  last: null,
  enter(owner = getPlayerId(), name) {
    const mineToo = owner === getPlayerId();
    set({ at: { owner, name: name ?? (mineToo ? useGame.getState().playerName || (useProfile.getState().profile?.name ?? 'My') : 'A friend'), slot: -1 }, view: null, panel: null });
    sendFarm({ op: 'slot', owner });
    track('myfarm_enter', { mine: mineToo });
    if (mineToo) void getS().load();
    else
      void get<{ farm: FarmView; now: number }>(`/farms/${encodeURIComponent(owner)}${q()}`)
        .then((r) => set({ view: r.farm, skew: r.now - Date.now(), at: { ...getS().at!, name: r.farm.name } }))
        .catch((e: Error) => {
          const code = /friends_only/.test(e.message) ? 'friends_only' : 'closed';
          set({ at: null, last: { said: '', xp: 0, coins: 0, error: code, at: Date.now() } });
        });
  },
  leave() {
    // back at the farm area, by the "My farm" sign
    const a = areaById('farm');
    set({ at: null, view: null, panel: null });
    teleportTo(a.doorX + 2, frontZ(a) + (a.side === 'north' ? -3 : 3), a.side === 'north' ? 0 : Math.PI);
  },
  async load() {
    try {
      const r = await get<Reply>(`/me/myfarm${q()}`);
      set({ mine: r.farm, coins: r.coins, skew: r.now - Date.now(), day: r.day ?? '', loaded: true });
    } catch {
      /* offline */
    }
  },
  async act(a) {
    const s = getS();
    const now = Date.now() + s.skew;
    const local = applyMyFarm(s.mine, a, now, s.coins, s.day);
    if (local.error) {
      set({ last: { said: '', xp: 0, coins: 0, error: local.error, at: Date.now() } });
      return;
    }
    set({ mine: local.farm, coins: s.coins + local.coins, last: { said: local.said, xp: local.xp, coins: local.coins, at: Date.now() } });
    if (local.said) say(local.said);
    try {
      const r = await post<Reply>(`/me/myfarm${q()}`, { ...a, playerId: getPlayerId() });
      set({ mine: r.farm, coins: r.coins });
      if (r.error) set({ last: { said: '', xp: 0, coins: 0, error: r.error, at: Date.now() } });
      void useProfile.getState().refresh();
    } catch {
      void getS().load();
    }
  },
  setPanel: (panel) => set({ panel }),
}));

/** The game server answered with the slot: walk in through the gate. */
export function initMyFarm() {
  return onFarm((m) => {
    const at = useMyFarm.getState().at;
    if (!at || m.owner !== at.owner) return;
    useMyFarm.setState({ at: { ...at, slot: m.slot } });
    const g = myFarm(m.slot).gate;
    teleportTo(g.x, g.z, Math.PI);
  });
}
