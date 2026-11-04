import { create } from 'zustand';
import { emptyFarm, encodeGarden, type FarmAction, type FarmActionResult, type FarmState } from '@es/shared';
import { farmAction, fetchFarm } from '../net/api';
import { sendGarden } from '../net/client';
import { useProfile } from './profile';
import { useVoice } from './voice';
import { track } from '../net/analytics';

interface FarmStore {
  farm: FarmState;
  loaded: boolean;
  /** server clock offset (server - local), for growth progress */
  skew: number;
  busy: boolean;
  /** Last thing you did, as an English sentence + rewards (toast). */
  last: { said: string; xp: number; coins: number; error?: FarmActionResult['error']; at: number } | null;
  /** Selected garden plot (opens the plot menu). */
  plot: number | null;
  load: () => Promise<void>;
  act: (a: FarmAction) => Promise<void>;
  setPlot: (i: number | null) => void;
  /** Session id of the player whose garden is shown on the plots instead of yours (null = yours). */
  visiting: string | null;
  visit: (sessionId: string | null) => void;
}

export const useFarm = create<FarmStore>((set, get) => ({
  farm: emptyFarm(),
  loaded: false,
  skew: 0,
  busy: false,
  last: null,
  plot: null,
  visiting: null,
  visit(visiting) {
    set({ visiting, plot: null });
    if (visiting) track('garden_visit', {});
  },
  async load() {
    try {
      const r = await fetchFarm();
      set({ farm: r.farm, loaded: true, skew: r.now - Date.now() });
      sendGarden(encodeGarden(r.farm));
    } catch {
      /* offline: empty garden */
    }
  },
  async act(a) {
    if (get().busy) return;
    set({ busy: true });
    try {
      const r = await farmAction(a);
      sendGarden(encodeGarden(r.farm));
      set({ farm: r.farm, skew: r.now - Date.now(), last: { said: r.said, xp: r.xp, coins: r.coins, error: r.error, at: Date.now() } });
      if (!r.error) {
        track('farm_action', { action: a.action });
        if (r.said) useVoice.getState().speakAs('farm', r.said, 'en-US');
        if (r.xp || r.coins) void useProfile.getState().refresh();
      }
    } catch {
      set({ last: { said: '', xp: 0, coins: 0, error: 'busy', at: Date.now() } });
    } finally {
      set({ busy: false });
    }
  },
  setPlot: (plot) => set({ plot }),
}));
