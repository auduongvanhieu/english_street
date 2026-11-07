import { useArea } from './area';
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
/** Cleaning up at the zoo: which bin each thing goes in. */
export const LITTER: { id: string; en: string; icon: string; bin: 'recycling' | 'rubbish' | 'compost' }[] = [
  { id: 'banana', en: 'a banana skin', icon: '🍌', bin: 'compost' },
  { id: 'apple', en: 'an apple core', icon: '🍎', bin: 'compost' },
  { id: 'leaves', en: 'some old leaves', icon: '🍂', bin: 'compost' },
  { id: 'bottle', en: 'a plastic bottle', icon: '🧴', bin: 'recycling' },
  { id: 'can', en: 'a drinks can', icon: '🥫', bin: 'recycling' },
  { id: 'paper', en: 'a newspaper', icon: '📰', bin: 'recycling' },
  { id: 'jar', en: 'a glass jar', icon: '🫙', bin: 'recycling' },
  { id: 'crisps', en: 'a crisp packet', icon: '🛍️', bin: 'rubbish' },
  { id: 'wrapper', en: 'a sweet wrapper', icon: '🍬', bin: 'rubbish' },
  { id: 'toy', en: 'a broken toy', icon: '🧸', bin: 'rubbish' },
];
export const BINS = { recycling: { icon: '♻️', en: 'the recycling bin' }, rubbish: { icon: '🗑️', en: 'the rubbish bin' }, compost: { icon: '🌱', en: 'the compost bin' } } as const;
/** Driving the tractor on a 5 x 5 field: rocks and carrot rows to avoid, the barn to reach. */
export const TRACTOR_N = 5;
export type Dir = 0 | 1 | 2 | 3; // north, east, south, west
interface TractorRound {
  pos: [number, number];
  dir: Dir;
  goal: [number, number];
  blocks: [number, number][];
  moves: number;
  best: number;
}
interface JobsStore {
  /** zoo: the four enclosure items to feed (in order of the list), and how it went */
  feed: { targets: string[]; done: Record<string, boolean>; result: MinigameResult | null } | null;
  /** the enclosure whose food card is open, with its three food choices */
  feeding: { item: string; options: string[]; miss: string | null } | null;
  /** the board's menu (feeding or cleaning), the throw after the right food, cleaning, the tractor */
  menu: boolean;
  throwing: { item: string; t0: number; note: string } | null;
  clean: { items: string[]; i: number; score: number; miss: boolean; note: string; result: MinigameResult | null } | null;
  tractor: { round: number; r: TractorRound; score: number; note: string; result: MinigameResult | null; done: boolean } | null;
  setMenu: (o: boolean) => void;
  throwFood: () => void;
  startClean: () => void;
  sortLitter: (bin: 'recycling' | 'rubbish' | 'compost') => void;
  startTractor: () => void;
  drive: (cmd: 'forward' | 'left' | 'right') => void;
  closeJob: (what: 'clean' | 'tractor') => void;
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

/** Throwing meter 0…1 (1.4 s a sweep); the green zone is the middle. */
export const meterPos = (t0: number, now = performance.now()) => 0.5 - 0.5 * Math.cos(((now - t0) / 1400) * Math.PI);
export const STEP: Record<Dir, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };
/** A round: the tractor in a corner, the barn somewhere far, a few blocks, and the shortest number of moves. */
function tractorRound(): TractorRound {
  for (;;) {
    const pos: [number, number] = [0, TRACTOR_N - 1];
    const goal: [number, number] = [2 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 2)];
    const blocks: [number, number][] = [];
    while (blocks.length < 5) {
      const b: [number, number] = [Math.floor(Math.random() * TRACTOR_N), Math.floor(Math.random() * TRACTOR_N)];
      if ((b[0] === pos[0] && b[1] === pos[1]) || (b[0] === goal[0] && b[1] === goal[1]) || blocks.some((x) => x[0] === b[0] && x[1] === b[1])) continue;
      blocks.push(b);
    }
    const best = shortest(pos, 0, goal, blocks);
    if (best > 0) return { pos, dir: 0, goal, blocks, moves: 0, best };
  }
}
/** Fewest commands (forward / turn) from pos facing dir to goal (breadth-first). */
function shortest(pos: [number, number], dir: Dir, goal: [number, number], blocks: [number, number][]) {
  const key = (x: number, z: number, d: number) => `${x},${z},${d}`;
  const seen = new Set([key(pos[0], pos[1], dir)]);
  let frontier: [number, number, Dir][] = [[pos[0], pos[1], dir]];
  for (let steps = 1; steps < 60 && frontier.length; steps++) {
    const next: [number, number, Dir][] = [];
    for (const [x, z, d] of frontier) {
      const moves: [number, number, Dir][] = [[x, z, ((d + 1) % 4) as Dir], [x, z, ((d + 3) % 4) as Dir]];
      const [dx, dz] = STEP[d];
      const nx = x + dx;
      const nz = z + dz;
      if (nx >= 0 && nz >= 0 && nx < TRACTOR_N && nz < TRACTOR_N && !blocks.some((b) => b[0] === nx && b[1] === nz)) moves.push([nx, nz, d]);
      for (const m of moves) {
        if (m[0] === goal[0] && m[1] === goal[1]) return steps;
        const k = key(...m);
        if (!seen.has(k)) {
          seen.add(k);
          next.push(m);
        }
      }
    }
    frontier = next;
  }
  return -1;
}

/** Feeding: was the food right first time (scored after the throw)? */
const firstTry: Record<string, boolean> = {};
const keeper = (t: string) => useVoice.getState().speakAs('zookeeper', t, 'en-GB');
const farmer = (t: string) => useVoice.getState().speakAs('farmer', t, 'en-US');
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export const numWord = (n: number) => NUM[n] ?? String(n);
const MILK_TAPS = 12;

export const useAnimalJobs = create<JobsStore>((set, get) => ({
  menu: false,
  throwing: null,
  clean: null,
  tractor: null,
  feed: null,
  feeding: null,
  farm: null,
  startFeeding() {
    useArea.getState().setPanel(false);
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
    // the right food: now throw it over the fence (a timing meter)
    keeper(`Yes! ${d.say} Now throw it over the fence!`);
    set({ feeding: null, throwing: { item: feeding.item, t0: performance.now(), note: '' } });
    firstTry[feeding.item] = feeding.miss === null;
  },
  throwFood() {
    const { feed, throwing } = get();
    if (!feed || !throwing) return;
    const m = meterPos(throwing.t0);
    if (Math.abs(m - 0.5) > 0.13) {
      const note = m < 0.5 ? 'Too short! Throw it harder.' : 'Too far! Throw it more gently.';
      keeper(note);
      set({ throwing: { ...throwing, note, t0: performance.now() } });
      return;
    }
    const item = throwing.item;
    const d = DIET[item]!;
    const first = firstTry[item] ?? true;
    const done = { ...feed.done, [item]: first };
    keeper(`Great throw! Look, ${plural(item)} ${item === 'penguin' || item === 'monkey' || item === 'flamingo' || item === 'zebra' ? 'are' : 'is'} eating.`);
    set({ feed: { ...feed, done }, throwing: null });
    void d;
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
  closeFeeding: () => set({ feeding: null, throwing: null }),
  setMenu(menu) {
    if (menu) useArea.getState().setPanel(false);
    set({ menu });
  },
  startClean() {
    useArea.getState().setPanel(false);
    const items = [...LITTER].sort(() => Math.random() - 0.5).slice(0, 6).map((x) => x.id);
    set({ menu: false, clean: { items, i: 0, score: 0, miss: false, note: '', result: null } });
    keeper('Thank you for helping! Pick up the rubbish and put each thing in the right bin.');
  },
  sortLitter(bin) {
    const c = get().clean;
    if (!c || c.i >= c.items.length) return;
    const it = LITTER.find((x) => x.id === c.items[c.i])!;
    if (bin !== it.bin) {
      set({ clean: { ...c, miss: true, note: `No, ${it.en} doesn't go in ${BINS[bin].en}.` } });
      keeper('Hmm, not that bin. Try again!');
      return;
    }
    const score = c.score + (c.miss ? 0 : 1);
    const i = c.i + 1;
    useVoice.getState().speakAs('me', `${it.en[0]!.toUpperCase()}${it.en.slice(1)} goes in ${BINS[bin].en}.`, 'en-US');
    set({ clean: { ...c, i, score, miss: false, note: '' } });
    if (i >= c.items.length) {
      window.setTimeout(() => keeper('The zoo is clean and tidy now. Brilliant!'), 1800);
      track('zoo_clean_done', { score });
      void reportMinigame('cleaner', { score })
        .then((result) => {
          const cur = get().clean;
          if (cur) set({ clean: { ...cur, result } });
          void useProfile.getState().refresh();
        })
        .catch(() => undefined);
    }
  },
  startTractor() {
    useArea.getState().setPanel(false);
    set({ tractor: { round: 1, r: tractorRound(), score: 0, note: '', result: null, done: false } });
    farmer("Let's drive the tractor to the barn! Use: go forward, turn left, turn right. Don't drive over the rocks or the carrots!");
  },
  drive(cmd) {
    const tr = get().tractor;
    if (!tr || tr.done) return;
    const r = { ...tr.r, moves: tr.r.moves + 1 };
    if (cmd === 'left') r.dir = ((r.dir + 3) % 4) as Dir;
    else if (cmd === 'right') r.dir = ((r.dir + 1) % 4) as Dir;
    else {
      const [dx, dz] = STEP[r.dir];
      const nx = r.pos[0] + dx;
      const nz = r.pos[1] + dz;
      if (nx < 0 || nz < 0 || nx >= TRACTOR_N || nz >= TRACTOR_N || r.blocks.some(([bx, bz]) => bx === nx && bz === nz)) {
        farmer('Stop! You can\'t go that way.');
        return set({ tractor: { ...tr, r, note: "Stop! You can't go that way." } });
      }
      r.pos = [nx, nz];
    }
    useVoice.getState().speakAs('me', cmd === 'forward' ? 'Go forward.' : cmd === 'left' ? 'Turn left.' : 'Turn right.', 'en-US');
    if (r.pos[0] !== r.goal[0] || r.pos[1] !== r.goal[1]) return set({ tractor: { ...tr, r, note: '' } });
    // at the barn: good driving = not many more moves than needed
    const good = r.moves <= r.best + 2;
    const score = tr.score + (good ? 1 : 0);
    farmer(good ? 'Perfect driving!' : 'You made it! Next time, try a shorter way.');
    if (tr.round >= 3) {
      set({ tractor: { ...tr, r, score, done: true, note: '' } });
      track('farm_tractor_done', { score });
      void reportMinigame('tractor', { score })
        .then((result) => {
          const cur = get().tractor;
          if (cur) set({ tractor: { ...cur, result } });
          void useProfile.getState().refresh();
        })
        .catch(() => undefined);
      return;
    }
    set({ tractor: { ...tr, r, score, note: good ? '✓ Perfect driving!' : '✓ You made it!' } });
    window.setTimeout(() => {
      const cur = get().tractor;
      if (cur && !cur.done) set({ tractor: { ...cur, round: cur.round + 1, r: tractorRound(), note: '' } });
    }, 1500);
  },
  closeJob: (what) => set(what === 'clean' ? { clean: null } : { tractor: null }),
  startFarm(job) {
    useArea.getState().setPanel(false);
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
