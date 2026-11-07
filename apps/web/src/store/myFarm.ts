import { create } from 'zustand';
import { THIEF_BREATH_S, applyMyFarm, emptyMyFarm, myFarm, type FarmView, type MyFarmAction, type MyFarmError, type MyFarmState } from '@es/shared';
import { get, post } from '../net/api';
import { getPlayerId } from '../net/player';
import { onFarm, sendFarm } from '../net/client';
import { t as tr } from '../i18n';
import { track } from '../net/analytics';
import { breath, localHeading, localPos, teleportTo } from '../scene/LocalPlayer';
import { sendProp } from '../net/client';
import { areaById, frontZ } from '../world/areas';
import { useProfile } from './profile';
import { useGame } from './game';
import { useVoice } from './voice';

/**
 * "My farm" in the game: going in (the game server gives the farm a slot in this zone), your farm's state from
 * the API, actions (run locally first, then confirmed by the API), and visiting a friend's farm (read-only).
 */
export type FarmPanel = 'shop' | 'barn' | 'settings' | 'train' | { plot: number } | null;
export type StealError = 'steal_guest' | 'steal_level' | 'friends_only' | 'steal_busy' | 'steal_limit' | 'steal_not_ready' | 'steal_taken' | 'steal_limit' | 'closed';
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
  last: { said: string; xp: number; coins: number; error?: MyFarmError | StealError; note?: string; at: number } | null;
  /** you are running from a farm dog */
  chase: { dog: string; crop: string; at: number } | null;
  /** the watering / feeding effect in front of you (scene: MyFarm FarmFx) */
  fx: { kind: 'water' | 'feed'; x: number; z: number; at: number } | null;
  /** the dog's place during a chase on this farm (from the game server) */
  dogAt: { slot: number; x: number; z: number; run: boolean; at: number } | null;
  /** take one piece from a friend's ripe plot */
  steal: (plot: number) => Promise<void>;
  /** water a friend's seeded plot; leave a note on their board */
  help: (plot: number) => Promise<void>;
  note: (text: string) => Promise<boolean>;
  enter: (owner?: string, name?: string) => void;
  leave: () => void;
  load: () => Promise<void>;
  act: (a: MyFarmAction) => Promise<void>;
  setPanel: (p: FarmPanel) => void;
}

/** Water or feed: the tool in hand (everybody sees it), the matching move and drops / grain falling in front. */
let toolTimer = 0;
function farmFx(kind: 'water' | 'feed') {
  const x = localPos.x + Math.sin(localHeading.y) * 0.75;
  const z = localPos.z + Math.cos(localHeading.y) * 0.75;
  useMyFarm.setState({ fx: { kind, x, z, at: Date.now() } });
  sendProp(kind === 'water' ? 'tool:can' : 'tool:feed');
  useGame.getState().playEmote(kind);
  window.clearTimeout(toolTimer);
  toolTimer = window.setTimeout(() => sendProp(''), 2400);
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
  chase: null,
  dogAt: null,
  fx: null,
  async help(plot) {
    const at = getS().at;
    if (!at) return;
    try {
      const r = await post<{ plot: FarmView['plots'][number]; said: string }>(`/farms/${encodeURIComponent(at.owner)}/help${q()}`, { plot, playerId: getPlayerId() });
      const v = getS().view;
      if (v) set({ view: { ...v, plots: v.plots.map((p, i) => (i === plot ? r.plot : p)) } });
      farmFx('water');
      set({ last: { said: r.said, xp: 3, coins: 0, at: Date.now() } });
      say(r.said);
      void useProfile.getState().refresh();
    } catch (e) {
      set({ last: { said: '', xp: 0, coins: 0, error: (e as Error).message as StealError, at: Date.now() } });
    }
  },
  async note(text) {
    const at = getS().at;
    if (!at) return false;
    try {
      const r = await post<{ notes: FarmView['notes'] }>(`/farms/${encodeURIComponent(at.owner)}/note${q()}`, { text, playerId: getPlayerId() });
      const v = getS().view;
      if (v) set({ view: { ...v, notes: r.notes } });
      return true;
    } catch (e) {
      set({ last: { said: '', xp: 0, coins: 0, error: (e as Error).message as StealError, at: Date.now() } });
      return false;
    }
  },
  async steal(plot) {
    const at = getS().at;
    if (!at || getS().chase) return;
    try {
      const r = await post<{ got?: string; chase?: string; crop?: string; dog?: { name: string; speed: number } }>(`/farms/${encodeURIComponent(at.owner)}/steal${q()}`, { plot, playerId: getPlayerId() });
      // the plot shows the missing piece now
      const v = getS().view;
      if (v) set({ view: { ...v, plots: v.plots.map((p, i) => (i === plot ? { ...p, stolen: 1 } : p)) } });
      if (r.chase && r.dog) {
        sendFarm({ op: 'chase', ticket: r.chase });
        Object.assign(breath, { on: true, left: THIEF_BREATH_S, max: THIEF_BREATH_S });
        set({ chase: { dog: r.dog.name, crop: r.crop ?? '', at: Date.now() } });
        useVoice.getState().speakAs('me', `Oh no! ${r.dog.name} is coming! Run!`, 'en-US');
        track('myfarm_steal', { dog: true });
      } else {
        set({ last: { said: `I took a ${r.got}. Nobody saw me!`, xp: 0, coins: 0, at: Date.now() } });
        say(`I took a ${r.got}. Nobody saw me!`);
        track('myfarm_steal', { dog: false });
      }
    } catch (e) {
      set({ last: { said: '', xp: 0, coins: 0, error: (e as Error).message as StealError, at: Date.now() } });
    }
  },
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
    // back at the farm area, on the path by the "MY FARM" gate (scene/areas/Farm.tsx)
    const a = areaById('farm');
    set({ at: null, view: null, panel: null });
    teleportTo(a.doorX - 0.5, frontZ(a) + (a.side === 'north' ? -5 : 5), a.side === 'north' ? 0 : Math.PI);
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
    if (a.action === 'water') farmFx('water');
    else if (a.action === 'feed' || a.action === 'dogfeed') farmFx('feed');
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

/** Messages from the game server: the farm's slot (walk in through the gate), the dog in a chase, the end. */
export function initMyFarm() {
  return onFarm((m) => {
    const st = useMyFarm.getState();
    if (m.op === 'slot') {
      const at = st.at;
      if (!at || m.owner !== at.owner) return;
      useMyFarm.setState({ at: { ...at, slot: m.slot } });
      const g = myFarm(m.slot).gate;
      teleportTo(g.x, g.z, Math.PI);
    } else if (m.op === 'dog') {
      useMyFarm.setState({ dogAt: { slot: m.slot, x: m.x, z: m.z, run: m.run, at: Date.now() } });
    } else if (m.op === 'chase_end') {
      if (!st.chase) return;
      breath.on = false;
      const caught = m.result === 'caught';
      useMyFarm.setState({
        chase: null,
        last: { said: caught ? `${st.chase.dog} caught me! I gave the ${st.chase.crop} back and paid a fine.` : `I got away with the ${st.chase.crop}!`, xp: 0, coins: 0, at: Date.now() },
      });
      say(caught ? `${st.chase.dog} caught me!` : 'I got away!');
      window.setTimeout(() => void useProfile.getState().refresh(), 1500);
    } else if (m.op === 'alarm') {
      useMyFarm.setState({ last: { said: '', xp: 0, coins: 0, note: tr('{name} is stealing from your farm! Your dog is running after them.', { name: m.thief }), at: Date.now() } });
    }
  });
}
