import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { sendProp, serverNow } from '../net/client';
import { track } from '../net/analytics';
import { FINDS } from '../world/sunnyBay';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Sunny Bay: the lifeguard's flag (on the shared clock), the beach hunt (find five things on the list), the
 * ice-cream kiosk and building a sandcastle (put the steps in order). Rewards: minigame 'beach'.
 */
export type Flag = 'green' | 'yellow' | 'red';
const FLAG_MS = 180_000;
const hash = (n: number) => {
  const x = Math.sin(n * 91.345 + 7.13) * 43758.5453;
  return x - Math.floor(x);
};
/** The flag on the lifeguard tower now: mostly green, sometimes yellow, now and then red. */
export function flagAt(now: number): Flag {
  const h = hash(Math.floor(now / FLAG_MS));
  return h < 0.55 ? 'green' : h < 0.82 ? 'yellow' : 'red';
}
export const FLAG_TEXT: Record<Flag, string> = {
  green: 'Green flag: it is safe to swim.',
  yellow: 'Yellow flag: be careful and stay near the beach.',
  red: 'Red flag: no swimming today!',
};

export const CASTLE_STEPS = ['First, dig a hole to find wet sand.', 'Then, fill the bucket with the wet sand.', 'Next, turn the bucket over and lift it slowly.', 'Finally, decorate the castle with shells.'];
export const ICE_CREAMS = [
  { id: 'vanilla', en: 'vanilla', icon: '🍦', lines: ['Can I have a vanilla ice cream, please?', 'Can I has a vanilla ice cream, please?', 'Give me vanilla ice cream one.'] },
  { id: 'chocolate', en: 'chocolate', icon: '🍫', lines: ["I'd like a chocolate ice cream, please.", "I'd like a ice cream chocolate, please.", 'I like a chocolate ice cream, please.'] },
  { id: 'strawberry', en: 'strawberry', icon: '🍓', lines: ['A strawberry one, please. In a cone.', 'A strawberry ones, please. In a cone.', 'Strawberry is please one cone.'] },
] as const;

interface BeachStore {
  hunt: { list: string[]; found: string[]; result: MinigameResult | null } | null;
  castle: { order: string[]; picked: number; mistakes: number; built: boolean; result: MinigameResult | null } | null;
  castlesBuilt: number;
  kiosk: { pick: (typeof ICE_CREAMS)[number] | null; lines: string[]; miss: string | null } | null;
  lastWarn: number;
  swum: boolean;
  startHunt: () => void;
  find: (id: string) => void;
  startCastle: () => void;
  castleStep: (step: string) => void;
  openKiosk: () => void;
  pickIce: (id: string | null) => void;
  sayLine: (line: string) => void;
  close: (what: 'hunt' | 'castle' | 'kiosk') => void;
}

const kai = (t: string) => useVoice.getState().speakAs('lifeguard', t, 'en-AU');
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const reward = (score: number, then: (r: MinigameResult) => void) =>
  void reportMinigame('beach', { score })
    .then((r) => {
      then(r);
      void useProfile.getState().refresh();
    })
    .catch(() => undefined);

export const useBeach = create<BeachStore>((set, get) => ({
  hunt: null,
  castle: null,
  castlesBuilt: 0,
  kiosk: null,
  lastWarn: 0,
  swum: false,
  startHunt() {
    const list = shuffle(FINDS.map((f) => f.id)).slice(0, 5);
    set({ hunt: { list, found: [], result: null } });
    kai(`Can you help me? Find these things on the beach: ${list.map((id) => FINDS.find((f) => f.id === id)!.en).join(', ')}.`);
    track('beach_hunt_start');
  },
  find(id) {
    const h = get().hunt;
    const f = FINDS.find((x) => x.id === id);
    if (!f) return;
    useVoice.getState().speakAs('me', `I found ${f.en}!`, 'en-US');
    if (!h || !h.list.includes(id) || h.found.includes(id)) return;
    const found = [...h.found, id];
    set({ hunt: { ...h, found } });
    if (found.length === h.list.length) {
      window.setTimeout(() => kai('You found everything. Good on you, mate!'), 1500);
      track('beach_hunt_done');
      reward(5, (result) => {
        const cur = get().hunt;
        if (cur) set({ hunt: { ...cur, result } });
      });
    }
  },
  startCastle() {
    set({ castle: { order: shuffle(CASTLE_STEPS), picked: 0, mistakes: 0, built: false, result: null } });
    kai("Let's build a sandcastle! Put the steps in the right order: first, then, next, finally.");
  },
  castleStep(step) {
    const c = get().castle;
    if (!c || c.built) return;
    if (step !== CASTLE_STEPS[c.picked]) {
      set({ castle: { ...c, mistakes: c.mistakes + 1 } });
      kai('Hmm, not yet. What do we do before that?');
      return;
    }
    useVoice.getState().speakAs('me', step, 'en-US');
    const picked = c.picked + 1;
    if (picked < CASTLE_STEPS.length) return set({ castle: { ...c, picked } });
    const score = Math.max(0, 4 - c.mistakes);
    set({ castle: { ...c, picked, built: true }, castlesBuilt: get().castlesBuilt + 1 });
    window.setTimeout(() => kai('What a beautiful sandcastle!'), 1800);
    track('beach_castle', { mistakes: c.mistakes });
    reward(score, (result) => {
      const cur = get().castle;
      if (cur) set({ castle: { ...cur, result } });
    });
  },
  openKiosk() {
    set({ kiosk: { pick: null, lines: [], miss: null } });
    useVoice.getState().speakAs('vendor', "Hi! What flavour would you like? We've got vanilla, chocolate and strawberry.", 'en-AU');
  },
  pickIce(id) {
    const ic = ICE_CREAMS.find((x) => x.id === id) ?? null;
    set({ kiosk: { pick: ic, lines: ic ? shuffle([...ic.lines]) : [], miss: null } });
  },
  sayLine(line) {
    const k = get().kiosk;
    if (!k?.pick) return;
    if (line !== k.pick.lines[0]) return set({ kiosk: { ...k, miss: line } });
    useVoice.getState().speakAs('me', line, 'en-US');
    window.setTimeout(() => useVoice.getState().speakAs('vendor', "Here you go! That's three dollars. Enjoy!", 'en-AU'), 1600);
    sendProp('snack:icecream');
    track('beach_icecream', { flavour: k.pick.id });
    set({ kiosk: null });
  },
  close: (what) => set(what === 'hunt' ? { hunt: null } : what === 'castle' ? { castle: null } : { kiosk: null }),
}));

/** Swimming at Sunny Bay: Kai blows the whistle on a red-flag day, cheers on a green one (called by the scene). */
export function swimTick(swimming: boolean) {
  if (!swimming) return;
  const s = useBeach.getState();
  const now = Date.now();
  const flag = flagAt(serverNow());
  if (flag === 'red' && now - s.lastWarn > 25_000) {
    useBeach.setState({ lastWarn: now });
    kai('Red flag! No swimming today. Please get out of the water!');
    track('beach_red_swim');
  } else if (!s.swum) {
    useBeach.setState({ swum: true });
    kai(flag === 'green' ? 'Green flag today. Enjoy your swim!' : 'Yellow flag: be careful and stay close to the beach, OK?');
    track('beach_swim', { flag });
  }
}
