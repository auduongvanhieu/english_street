import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { serverNow } from '../net/client';
import { track } from '../net/analytics';
import { LANDMARKS, weatherAt, type HillWeather } from '../world/mapleHill';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Maple Hill: follow the ranger's directions on a hike (visit the places in order), pack your backpack for today's
 * weather (on the shared clock), and guess the animal from Rosa's description at the summit viewer.
 * Rewards: minigame 'hill'.
 */
export const HIKES: { text: string; stops: string[] }[] = [
  { text: 'Cross the bridge and turn left. Walk to the campsite, then go up to the big maple tree.', stops: ['bridge', 'campsite', 'maple'] },
  { text: 'Go past the picnic tables and cross the bridge. Then turn right and climb up to the big rock.', stops: ['picnic', 'bridge', 'rock'] },
  { text: 'Walk down to the lake. Then cross the bridge and go all the way up to the top of the hill.', stops: ['lake', 'bridge', 'summit'] },
  { text: 'Cross the bridge and go straight on to the big maple tree. Then climb to the top of the hill.', stops: ['bridge', 'maple', 'summit'] },
  { text: 'Cross the bridge and turn right. Climb up to the big rock, then walk across to the big maple tree.', stops: ['bridge', 'rock', 'maple'] },
  { text: 'Cross the bridge, turn left and walk to the campsite. Then climb all the way to the top of the hill.', stops: ['bridge', 'campsite', 'summit'] },
];
/** Places you pass on the way anyway: walking by them is never a wrong turn. */
const ON_THE_WAY = new Set(['bridge', 'maple']);

export const FORECAST: Record<HillWeather, { icon: string; text: string; need: [string, string]; why: string }> = {
  sunny: { icon: '☀️', text: "It's going to be hot and sunny today.", need: ['sunhat', 'suncream'], why: "It's sunny" },
  rainy: { icon: '🌧️', text: "It's going to rain this afternoon.", need: ['raincoat', 'boots'], why: "It's going to rain" },
  cold: { icon: '❄️', text: "It's very cold and windy at the top.", need: ['gloves', 'scarf'], why: "It's cold" },
  foggy: { icon: '🌫️', text: "It's foggy today. You can't see very far.", need: ['torch', 'compass'], why: "It's foggy" },
};
export const PACK_ITEMS: { id: string; en: string; icon: string }[] = [
  { id: 'water', en: 'a bottle of water', icon: '💧' },
  { id: 'map', en: 'a map', icon: '🗺️' },
  { id: 'sunhat', en: 'a sun hat', icon: '👒' },
  { id: 'suncream', en: 'sun cream', icon: '🧴' },
  { id: 'raincoat', en: 'a raincoat', icon: '🧥' },
  { id: 'boots', en: 'rain boots', icon: '👢' },
  { id: 'gloves', en: 'gloves', icon: '🧤' },
  { id: 'scarf', en: 'a scarf', icon: '🧣' },
  { id: 'torch', en: 'a torch', icon: '🔦' },
  { id: 'compass', en: 'a compass', icon: '🧭' },
  { id: 'swimsuit', en: 'a swimsuit', icon: '🩱' },
  { id: 'laptop', en: 'a laptop', icon: '💻' },
];
export const needFor = (w: HillWeather) => ['water', 'map', ...FORECAST[w].need];

export const ANIMALS: { id: string; en: string; icon: string; riddle: string }[] = [
  { id: 'moose', en: 'a moose', icon: '🫎', riddle: "It's very big and brown. It has huge antlers and it likes to stand in lakes." },
  { id: 'squirrel', en: 'a squirrel', icon: '🐿️', riddle: "It's small and quick. It has a big bushy tail and it lives in the trees." },
  { id: 'eagle', en: 'an eagle', icon: '🦅', riddle: "It's a big bird. It flies high over the mountains and it can see very far." },
  { id: 'owl', en: 'an owl', icon: '🦉', riddle: "It's a bird with big round eyes. It sleeps in the day and it's awake at night." },
  { id: 'bear', en: 'a bear', icon: '🐻', riddle: "It's big and strong. It loves honey and fish, and it sleeps all winter." },
  { id: 'beaver', en: 'a beaver', icon: '🦫', riddle: 'It has big orange teeth and a flat tail. It builds dams in the river.' },
  { id: 'rabbit', en: 'a rabbit', icon: '🐇', riddle: "It's small and soft. It has long ears and it can jump very well." },
  { id: 'fox', en: 'a fox', icon: '🦊', riddle: "It's orange and clever. It has a white tip on its tail and pointed ears." },
];
const ROUNDS = 4;

interface HillStore {
  hike: { route: number; done: string[]; wrong: string[]; finished: boolean; result: MinigameResult | null } | null;
  pack: { weather: HillWeather; picked: string[]; checked: null | { missing: string[]; extra: string[] }; result: MinigameResult | null } | null;
  animals: { order: number[]; round: number; options: number[]; score: number; miss: number | null; done: boolean; result: MinigameResult | null } | null;
  startHike: () => void;
  sayHike: () => void;
  openPack: () => void;
  togglePack: (id: string) => void;
  checkPack: () => void;
  startAnimals: () => void;
  guess: (i: number) => void;
  close: (what: 'hike' | 'pack' | 'animals') => void;
}

const rosa = (t: string) => useVoice.getState().speakAs('ranger', t, 'en-CA');
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const reward = (score: number, then: (r: MinigameResult) => void) =>
  void reportMinigame('hill', { score })
    .then((r) => {
      then(r);
      void useProfile.getState().refresh();
    })
    .catch(() => undefined);
const optionsFor = (answer: number) => shuffle([answer, ...shuffle(ANIMALS.map((_, i) => i).filter((i) => i !== answer)).slice(0, 3)]);

export const useHill = create<HillStore>((set, get) => ({
  hike: null,
  pack: null,
  animals: null,
  startHike() {
    const prev = get().hike?.route ?? -1;
    let route = Math.floor(Math.random() * HIKES.length);
    if (route === prev) route = (route + 1) % HIKES.length;
    set({ hike: { route, done: [], wrong: [], finished: false, result: null } });
    rosa(`Here are your directions. ${HIKES[route]!.text}`);
    track('hill_hike_start', { route });
  },
  sayHike() {
    const h = get().hike;
    if (h) rosa(HIKES[h.route]!.text);
  },
  openPack() {
    const weather = weatherAt(serverNow());
    set({ pack: { weather, picked: [], checked: null, result: null } });
    rosa(`${FORECAST[weather].text} What do you need in your backpack? Pick four things.`);
  },
  togglePack(id) {
    const p = get().pack;
    if (!p || p.checked) return;
    const picked = p.picked.includes(id) ? p.picked.filter((x) => x !== id) : p.picked.length < 4 ? [...p.picked, id] : p.picked;
    set({ pack: { ...p, picked } });
  },
  checkPack() {
    const p = get().pack;
    if (!p || p.checked || p.picked.length < 4) return;
    const need = needFor(p.weather);
    const missing = need.filter((id) => !p.picked.includes(id));
    const extra = p.picked.filter((id) => !need.includes(id));
    const name = (id: string) => PACK_ITEMS.find((x) => x.id === id)!.en;
    const f = FORECAST[p.weather];
    set({ pack: { ...p, checked: { missing, extra } } });
    if (!missing.length) rosa(`Perfect! ${f.why}, so you need ${name(f.need[0])} and ${name(f.need[1])}. And always take water and a map!`);
    else rosa(`Hmm, you forgot ${missing.map(name).join(' and ')}. ${f.why}, so you need ${name(f.need[0])} and ${name(f.need[1])}.`);
    track('hill_pack', { weather: p.weather, missing: missing.length });
    reward(4 - missing.length, (result) => {
      const cur = get().pack;
      if (cur) set({ pack: { ...cur, result } });
    });
  },
  startAnimals() {
    const order = shuffle(ANIMALS.map((_, i) => i)).slice(0, ROUNDS);
    set({ animals: { order, round: 0, options: optionsFor(order[0]!), score: 0, miss: null, done: false, result: null } });
    rosa(`Let's look for animals! Listen. ${ANIMALS[order[0]!]!.riddle} What is it?`);
  },
  guess(i) {
    const a = get().animals;
    if (!a || a.done) return;
    const answer = a.order[a.round]!;
    if (i !== answer) {
      if (a.miss === null) set({ animals: { ...a, miss: i } });
      rosa('No, look again. ' + ANIMALS[answer]!.riddle);
      return;
    }
    const score = a.score + (a.miss === null ? 1 : 0);
    useVoice.getState().speakAs('me', `It's ${ANIMALS[answer]!.en}!`, 'en-US');
    const round = a.round + 1;
    if (round < ROUNDS) {
      const next = a.order[round]!;
      set({ animals: { ...a, round, options: optionsFor(next), score, miss: null } });
      window.setTimeout(() => rosa(`Yes! Next one. ${ANIMALS[next]!.riddle}`), 1300);
      return;
    }
    set({ animals: { ...a, round, score, miss: null, done: true } });
    window.setTimeout(() => rosa(`Great spotting! You got ${score} out of ${ROUNDS}.`), 1300);
    track('hill_animals', { score });
    reward(score, (result) => {
      const cur = get().animals;
      if (cur) set({ animals: { ...cur, result } });
    });
  },
  close: (what) => set(what === 'hike' ? { hike: null } : what === 'pack' ? { pack: null } : { animals: null }),
}));

/** The hike: called a few times a second by the scene with the player's position. */
export function hikeTick(x: number, z: number) {
  const st = useHill.getState();
  const h = st.hike;
  if (!h || h.finished) return;
  const route = HIKES[h.route]!;
  const next = route.stops[h.done.length];
  for (const l of LANDMARKS) {
    if (Math.hypot(l.x - x, l.z - z) > l.r) continue;
    if (l.id === next) {
      const done = [...h.done, l.id];
      const finished = done.length === route.stops.length;
      useHill.setState({ hike: { ...h, done, finished } });
      if (!finished) {
        useVoice.getState().speakAs('me', `This is ${l.en}.`, 'en-US');
        return;
      }
      const score = Math.max(1, 5 - 2 * h.wrong.length);
      window.setTimeout(() => rosa(h.wrong.length ? 'You made it! Next time, listen carefully to the directions.' : 'You made it! You followed the directions perfectly.'), 600);
      track('hill_hike_done', { route: h.route, wrong: h.wrong.length });
      reward(score, (result) => {
        const cur = useHill.getState().hike;
        if (cur) useHill.setState({ hike: { ...cur, result } });
      });
      return;
    }
    if (!h.done.includes(l.id) && !h.wrong.includes(l.id) && !ON_THE_WAY.has(l.id)) {
      useHill.setState({ hike: { ...h, wrong: [...h.wrong, l.id] } });
      useVoice.getState().speakAs('ranger', `Oops, this is ${l.en}. Read the directions again!`, 'en-CA');
      return;
    }
  }
}
