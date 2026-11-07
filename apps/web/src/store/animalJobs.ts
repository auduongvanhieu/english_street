import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { ENCLOSURES } from '../world/zooLayout';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Jobs with animals.
 *  - Zoo feeding time: the zookeeper's list names four animals; at each enclosure choose the right food
 *    ("Lions eat meat."). Score = right first time (0-4), minigame 'zookeeper'.
 *  - Farm: milk a cow (Left! Right! in time, then "How much milk?") and collect eggs ("How many eggs?").
 *    Each right answer first time = 1, minigame 'farmhand'.
 */
export const FOODS: Record<string, { en: string; icon: string }> = {
  meat: { en: 'meat', icon: '🥩' },
  fish: { en: 'fish', icon: '🐟' },
  bamboo: { en: 'bamboo', icon: '🎋' },
  bananas: { en: 'bananas', icon: '🍌' },
  leaves: { en: 'leaves', icon: '🌿' },
  grass: { en: 'grass', icon: '🌾' },
  hay: { en: 'hay', icon: '🟨' },
  shrimp: { en: 'shrimp', icon: '🦐' },
};
/** What each zoo animal eats, and the sentence the keeper says. */
export const DIET: Record<string, { food: keyof typeof FOODS; say: string }> = {
  lion: { food: 'meat', say: 'Lions eat meat.' },
  tiger: { food: 'meat', say: 'Tigers eat meat.' },
  giraffe: { food: 'leaves', say: 'Giraffes eat leaves from tall trees.' },
  zebra: { food: 'grass', say: 'Zebras eat grass.' },
  penguin: { food: 'fish', say: 'Penguins eat fish.' },
  panda: { food: 'bamboo', say: 'Pandas eat bamboo.' },
  monkey: { food: 'bananas', say: 'Monkeys love bananas.' },
  elephant: { food: 'hay', say: 'Elephants eat a lot of hay.' },
  kangaroo: { food: 'grass', say: 'Kangaroos eat grass.' },
  crocodile: { food: 'meat', say: 'Crocodiles eat meat.' },
  bear: { food: 'fish', say: 'Bears like fish.' },
  flamingo: { food: 'shrimp', say: 'Flamingos eat shrimp. That is why they are pink!' },
};
const plural = (item: string) => (item === 'penguin' || item === 'monkey' || item === 'flamingo' || item === 'zebra' ? `the ${item}s` : `the ${item}`);

type FarmJob = 'milk' | 'eggs';
interface JobsStore {
  /** zoo: the four enclosure items to feed (in order of the list), and how it went */
  feed: { targets: string[]; done: Record<string, boolean>; result: MinigameResult | null } | null;
  /** the enclosure whose food card is open, with its three food choices */
  feeding: { item: string; options: string[]; miss: string | null } | null;
  farm: { job: FarmJob; step: 'play' | 'ask' | 'done'; taps: number; next: 'L' | 'R'; amount: number; options: number[]; right: boolean | null; result: MinigameResult | null; eggs?: number[] } | null;
  startFeeding: () => void;
  openEnclosure: (item: string) => void;
  give: (food: string) => void;
  closeFeeding: () => void;
  startFarm: (job: FarmJob) => void;
  squeeze: (hand: 'L' | 'R') => void;
  takeEgg: (nest: number) => void;
  answer: (n: number) => void;
  closeFarm: () => void;
}

const keeper = (t: string) => useVoice.getState().speakAs('zookeeper', t, 'en-GB');
const farmer = (t: string) => useVoice.getState().speakAs('farmer', t, 'en-US');
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numWord = (n: number) => NUM[n] ?? String(n);
const MILK_TAPS = 12;

export const useAnimalJobs = create<JobsStore>((set, get) => ({
  feed: null,
  feeding: null,
  farm: null,
  startFeeding() {
    const targets = shuffle(ENCLOSURES.map((e) => e.item)).slice(0, 4);
    set({ feed: { targets, done: {}, result: null }, feeding: null });
    keeper(`It's feeding time! Please feed ${targets.map(plural).join(', ').replace(/, ([^,]*)$/, ' and $1')}. The food is in the bucket.`);
    track('zoo_feeding_start');
  },
  openEnclosure(item) {
    const f = get().feed;
    if (!f || !f.targets.includes(item) || item in f.done) return;
    const right = DIET[item]!.food;
    const others = shuffle(Object.keys(FOODS).filter((k) => k !== right)).slice(0, 2);
    set({ feeding: { item, options: shuffle([right, ...others]), miss: null } });
  },
  give(food) {
    const { feed, feeding } = get();
    if (!feed || !feeding) return;
    const d = DIET[feeding.item]!;
    if (food !== d.food) {
      useVoice.getState().speakAs('zookeeper', `No, ${plural(feeding.item).replace('the ', '')} don't eat ${FOODS[food]!.en}!`, 'en-GB');
      set({ feeding: { ...feeding, miss: food } });
      return;
    }
    const done = { ...feed.done, [feeding.item]: feeding.miss === null };
    keeper(`Yum! ${d.say}`);
    set({ feed: { ...feed, done }, feeding: null });
    if (Object.keys(done).length === feed.targets.length) {
      const score = Object.values(done).filter(Boolean).length;
      track('zoo_feeding_done', { score });
      window.setTimeout(() => keeper('All the animals are happy. Thank you for your help!'), 2200);
      void reportMinigame('zookeeper', { score })
        .then((result) => {
          const f = get().feed;
          if (f) set({ feed: { ...f, result } });
          void useProfile.getState().refresh();
        })
        .catch(() => undefined);
    }
  },
  closeFeeding: () => set({ feeding: null }),
  startFarm(job) {
    if (job === 'milk') {
      set({ farm: { job, step: 'play', taps: 0, next: 'L', amount: 0, options: [], right: null, result: null } });
      farmer("Let's milk Daisy! Squeeze gently: left hand, right hand… Left!");
    } else {
      // five nests, 0-3 eggs each (at least 4 in all)
      let eggs: number[];
      do eggs = Array.from({ length: 5 }, () => Math.floor(Math.random() * 4));
      while (eggs.reduce((a, b) => a + b, 0) < 4);
      set({ farm: { job, step: 'play', taps: 0, next: 'L', amount: 0, options: [], right: null, result: null, eggs } });
      farmer('Can you collect the eggs? Look in every nest and count them.');
    }
    track('farm_job_start', { job });
  },
  squeeze(hand) {
    const f = get().farm;
    if (!f || f.job !== 'milk' || f.step !== 'play') return;
    if (hand !== f.next) {
      farmer(f.next === 'L' ? 'Left hand!' : 'Right hand!');
      return;
    }
    const taps = f.taps + 1;
    if (taps < MILK_TAPS) return set({ farm: { ...f, taps, next: hand === 'L' ? 'R' : 'L' } });
    const amount = 2 + Math.floor(Math.random() * 4); // litres
    const options = shuffle([amount, amount + 1, amount - 1]);
    set({ farm: { ...f, taps, step: 'ask', amount, options } });
    farmer('Great job! Look at the bucket. How much milk is there?');
  },
  takeEgg(nest) {
    const f = get().farm;
    if (!f || f.job !== 'eggs' || f.step !== 'play' || !f.eggs) return;
    if (!f.eggs[nest]) return;
    const eggs = f.eggs.map((n, i) => (i === nest ? n - 1 : n));
    const amount = f.amount + 1;
    if (eggs.some((n) => n > 0)) return set({ farm: { ...f, eggs, amount } });
    const options = shuffle([amount, amount + 1, amount - 1]);
    set({ farm: { ...f, eggs, amount, step: 'ask', options } });
    farmer('Well done! How many eggs did you collect?');
  },
  answer(n) {
    const f = get().farm;
    if (!f || f.step !== 'ask') return;
    const right = n === f.amount;
    const unit = f.job === 'milk' ? 'litres of milk' : 'eggs';
    useVoice.getState().speakAs('me', `${numWord(n)} ${unit}.`, 'en-US');
    window.setTimeout(() => farmer(right ? `Yes! ${numWord(f.amount)} ${unit}. Thank you!` : `Let's count again… it's ${numWord(f.amount)} ${unit}.`), 1400);
    set({ farm: { ...f, step: 'done', right } });
    track('farm_job_done', { job: f.job, right });
    void reportMinigame('farmhand', { score: right ? 1 : 0 })
      .then((result) => {
        const cur = get().farm;
        if (cur) set({ farm: { ...cur, result } });
        void useProfile.getState().refresh();
      })
      .catch(() => undefined);
  },
  closeFarm: () => set({ farm: null }),
}));
