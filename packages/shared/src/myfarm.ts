import { z } from 'zod';
import { CROPS, CropSchema, type Crop } from './farm';
import { inRect, type Rect } from './interiors';

/**
 * "My farm": every player's own farm, off the street map. Coins from quests buy seeds, animals, feed and more
 * fields; harvests and animal products are sold at the farm's shipping bin (a daily cap keeps the economy sane).
 * Pure rules (the API is authoritative; the client runs the same function for instant feedback).
 *
 * The farms sit in a grid of slots far south of everything (MY_FARM_SLOTS); the game server hands out a free slot
 * to whoever opens a farm in that zone (owner or visitor), so two farms never share a place.
 */

/* ----------------------------------------------------------------------------------------- place */
export const MY_FARM = { w: 40, d: 36 };
export const MY_FARM_SLOTS = 64;
/** Slot centres: 8 x 8, 50 m apart, x -140…210, z -980…-1330. */
export function myFarm(slot: number) {
  const cx = -140 + (slot % 8) * 50;
  const cz = -980 - Math.floor(slot / 8) * 50;
  const rect: Rect = { minX: cx - MY_FARM.w / 2, maxX: cx + MY_FARM.w / 2, minZ: cz - MY_FARM.d / 2, maxZ: cz + MY_FARM.d / 2 };
  return { cx, cz, rect, gate: { x: cx, z: cz + MY_FARM.d / 2 - 1.2 } };
}
export const MY_FARMS_AREA: Rect = { minX: -165, maxX: 235, minZ: -1355, maxZ: -955 };
export function myFarmAt(x: number, z: number): number {
  if (!inRect(MY_FARMS_AREA, x, z)) return -1;
  for (let i = 0; i < MY_FARM_SLOTS; i++) if (inRect(myFarm(i).rect, x, z, 0.5)) return i;
  return -1;
}

/* ----------------------------------------------------------------------------------------- prices */
/**
 * Seeds (one plot), what one piece of the harvest sells for, and how long a crop grows after watering. Slow crops
 * pay more per plot (the farm-game rhythm: plant, go and play elsewhere, come back to harvest). A plot gives
 * HARVEST_QTY pieces; tomatoes and strawberries give REGROW harvests per planting (water again in between).
 */
export const MY_GROW_MS: Record<Crop, number> = { carrot: 10 * 60_000, potato: 15 * 60_000, wheat: 20 * 60_000, tomato: 25 * 60_000, strawberry: 40 * 60_000, corn: 60 * 60_000, pumpkin: 120 * 60_000 };
export const SEED_PRICE: Record<Crop, number> = { carrot: 2, potato: 3, wheat: 3, tomato: 4, strawberry: 5, corn: 6, pumpkin: 8 };
export const CROP_SELL: Record<Crop, number> = { carrot: 3, potato: 4, wheat: 4, tomato: 6, strawberry: 8, corn: 11, pumpkin: 18 };
export const REGROW: Partial<Record<Crop, number>> = { tomato: 3, strawberry: 3 };
export const HARVEST_QTY = 3;
/** Farm level needed to buy a seed / an animal / the next field. */
export const CROP_LEVEL: Record<Crop, number> = { carrot: 1, potato: 1, wheat: 2, tomato: 2, strawberry: 3, corn: 4, pumpkin: 6 };
export const ANIMALS = ['chicken', 'sheep', 'pig', 'cow'] as const;
export type AnimalKind = (typeof ANIMALS)[number];
export const ANIMAL_INFO: Record<AnimalKind, { price: number; max: number; product: string; productEn: string; sell: number; everyMs: number; icon: string; level: number }> = {
  chicken: { price: 20, max: 6, product: 'egg', productEn: 'an egg', sell: 4, everyMs: 15 * 60_000, icon: '🐔', level: 1 },
  cow: { price: 60, max: 3, product: 'milk', productEn: 'a bottle of milk', sell: 10, everyMs: 30 * 60_000, icon: '🐄', level: 3 },
  sheep: { price: 45, max: 3, product: 'wool', productEn: 'some wool', sell: 14, everyMs: 45 * 60_000, icon: '🐑', level: 4 },
  pig: { price: 50, max: 2, product: 'truffle', productEn: 'a truffle', sell: 20, everyMs: 60 * 60_000, icon: '🐖', level: 5 },
};
export const PRODUCTS = ['egg', 'wool', 'truffle', 'milk'] as const;
export const PRODUCT_SELL: Record<string, number> = Object.fromEntries(ANIMALS.map((a) => [ANIMAL_INFO[a].product, ANIMAL_INFO[a].sell]));
export const FEED_PRICE = 1;
/** Fertilizer: halves the time a growing plot still needs. */
export const FERTILIZER_PRICE = 5;
/** Fields: 6 plots each; the first is free. */
export const FIELD_PLOTS = 6;
export const FIELD_PRICES = [0, 50, 120, 250];
export const FIELD_LEVEL = [1, 2, 4, 6];
export const MAX_FIELDS = FIELD_PRICES.length;
/** Coins a farm can earn by selling and orders, per day (Vietnam day). */
export const FARM_DAY_CAP = 500;
/** Barn: how many pieces it holds; upgrades add room. */
export const BARN_BASE = 60;
export const BARN_STEP = 40;
export const BARN_PRICES = [60, 140, 260, 400];
export const barnCap = (f: { barnLevel: number }) => BARN_BASE + BARN_STEP * f.barnLevel;
export const barnCount = (f: { barn: Record<string, number> }) => Object.values(f.barn).reduce((a, b) => a + b, 0);

/* ----------------------------------------------------------------------------------------- farm level */
/** Farm XP needed for each level (level 1 at 0). Every farm action gives farm XP (the same as the player XP). */
export const FARM_LEVELS = [0, 30, 80, 160, 280, 450, 680, 980, 1350, 1800];
export const farmLevel = (xp: number) => FARM_LEVELS.filter((n) => xp >= n).length;
/** [xp into this level, xp this level needs] (null at the top). */
export function levelProgress(xp: number): [number, number] | null {
  const lv = farmLevel(xp);
  if (lv >= FARM_LEVELS.length) return null;
  return [xp - FARM_LEVELS[lv - 1]!, FARM_LEVELS[lv]! - FARM_LEVELS[lv - 1]!];
}
/** What a level unlocks (for the level-up card). */
export function unlocksAt(level: number): string[] {
  const out: string[] = [];
  for (const c of CROPS) if (CROP_LEVEL[c] === level) out.push(`seed:${c}`);
  for (const a of ANIMALS) if (ANIMAL_INFO[a].level === level) out.push(`animal:${a}`);
  FIELD_LEVEL.forEach((l, i) => i > 0 && l === level && out.push('field'));
  return out;
}

/* ----------------------------------------------------------------------------------------- orders */
/** People in the street who order farm goods (the order board by the gate). */
const ORDER_PEOPLE: { who: string; for: string[] }[] = [
  { who: 'Mia the baker', for: ['my bakery', 'tomorrow morning'] },
  { who: 'Chef Leo', for: ["today's menu", 'my restaurant'] },
  { who: 'Mrs Brown', for: ['a family dinner', 'a picnic on Sunday'] },
  { who: 'Sam at the café', for: ['the café', 'the breakfast menu'] },
  { who: 'The school canteen', for: ["the children's lunch", 'the school kitchen'] },
  { who: 'Grandpa Joe', for: ['a big party', 'my grandchildren'] },
];
export interface FarmOrder {
  id: number;
  who: string;
  /** goods (crop ids / product ids) and how many */
  items: Record<string, number>;
  coins: number;
  xp: number;
  /** the English request on the board */
  text: string;
}
/** mulberry32: a small seeded random generator (neighbouring seeds give unrelated orders). */
const rngOf = (seed: number) => {
  let a = (seed * 0x9e3779b9) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const goodName = (k: string, n: number) => {
  if ((CROPS as readonly string[]).includes(k)) return n === 1 ? (k === 'wheat' || k === 'corn' ? k : `a ${k}`) : `${n} ${PLURAL_C[k as Crop]}`;
  const p: Record<string, [string, string]> = { egg: ['an egg', 'eggs'], milk: ['a bottle of milk', 'bottles of milk'], wool: ['a bag of wool', 'bags of wool'], truffle: ['a truffle', 'truffles'], bread: ['a loaf of bread', 'loaves of bread'], cake: ['a strawberry cake', 'strawberry cakes'], cheese: ['a piece of cheese', 'pieces of cheese'], scarf: ['a woolly scarf', 'woolly scarves'] };
  const w = p[k] ?? [k, k];
  return n === 1 ? w[0] : `${n} ${w[1]}`;
};
const PLURAL_C: Record<Crop, string> = { carrot: 'carrots', corn: 'corn cobs', tomato: 'tomatoes', potato: 'potatoes', pumpkin: 'pumpkins', strawberry: 'strawberries', wheat: 'bags of wheat' };
/** Order number `seq` for a farm at `level` (deterministic: the server and the page make the same one). */
export function makeOrder(seq: number, level: number, animals: AnimalKind[], machines: string[] = []): FarmOrder {
  const r = rngOf(seq + 7);
  const goods: string[] = [...CROPS.filter((c) => CROP_LEVEL[c] <= level)];
  for (const a of new Set(animals)) goods.push(ANIMAL_INFO[a].product);
  for (const [id, r] of Object.entries(RECIPES)) if (machines.includes(r.machine)) goods.push(id);
  const kinds = Math.min(goods.length, 1 + Math.floor(r() * Math.min(3, 1 + level / 2)));
  const items: Record<string, number> = {};
  const pool = [...goods];
  for (let i = 0; i < kinds; i++) {
    const k = pool.splice(Math.floor(r() * pool.length), 1)[0]!;
    const price = CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 3;
    items[k] = Math.max(1, Math.round((2 + r() * (2 + level)) * (price > 12 ? 0.4 : price > 7 ? 0.7 : 1)));
  }
  const value = Object.entries(items).reduce((s, [k, n]) => s + n * (CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 0), 0);
  const person = ORDER_PEOPLE[Math.floor(r() * ORDER_PEOPLE.length)]!;
  const dish = person.for[Math.floor(r() * person.for.length)]!;
  const list = Object.entries(items).map(([k, n]) => goodName(k, n));
  const listText = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]!;
  return { id: seq, who: person.who, items, coins: Math.round(value * 1.5) + 3, xp: 6 + 3 * kinds, text: `Hello! Could you bring me ${listText}, please? It's for ${dish}.` };
}
export const ORDER_SLOTS = 3;

/* ----------------------------------------------------------------------------------------- workshop */
/** Machines in the barn: turn farm goods into goods worth more. One job at a time per machine. */
export const MACHINES = ['bakery', 'dairy', 'loom'] as const;
export type MachineId = (typeof MACHINES)[number];
export const MACHINE_INFO: Record<MachineId, { name: string; icon: string; price: number; level: number }> = {
  bakery: { name: 'bakery oven', icon: '🍞', price: 80, level: 3 },
  dairy: { name: 'cheese maker', icon: '🧀', price: 120, level: 4 },
  loom: { name: 'loom', icon: '🧣', price: 150, level: 5 },
};
export const RECIPES: Record<string, { machine: MachineId; needs: Record<string, number>; makes: string; ms: number; sell: number; en: string }> = {
  bread: { machine: 'bakery', needs: { wheat: 3 }, makes: 'bread', ms: 20 * 60_000, sell: 18, en: 'a loaf of bread' },
  cake: { machine: 'bakery', needs: { wheat: 2, egg: 2, strawberry: 1 }, makes: 'cake', ms: 40 * 60_000, sell: 40, en: 'a strawberry cake' },
  cheese: { machine: 'dairy', needs: { milk: 2 }, makes: 'cheese', ms: 30 * 60_000, sell: 30, en: 'a piece of cheese' },
  scarf: { machine: 'loom', needs: { wool: 2 }, makes: 'scarf', ms: 45 * 60_000, sell: 45, en: 'a woolly scarf' },
};
export const CRAFTED = Object.keys(RECIPES);
for (const r of Object.values(RECIPES)) PRODUCT_SELL[r.makes] = r.sell;

/* ----------------------------------------------------------------------------------------- goals */
/** Farm goals: counted from what you do; claim the reward when done (once each). */
export const FARM_GOALS: { id: string; stat: string; n: number; coins: number; fertilizer: number; en: string }[] = [
  { id: 'harvest-10', stat: 'harvest', n: 10, coins: 15, fertilizer: 1, en: 'Harvest 10 plots' },
  { id: 'harvest-50', stat: 'harvest', n: 50, coins: 50, fertilizer: 3, en: 'Harvest 50 plots' },
  { id: 'orders-3', stat: 'orders', n: 3, coins: 20, fertilizer: 1, en: 'Deliver 3 orders' },
  { id: 'orders-20', stat: 'orders', n: 20, coins: 80, fertilizer: 4, en: 'Deliver 20 orders' },
  { id: 'feed-20', stat: 'feed', n: 20, coins: 20, fertilizer: 1, en: 'Feed your animals 20 times' },
  { id: 'craft-5', stat: 'craft', n: 5, coins: 40, fertilizer: 2, en: 'Make 5 things in the workshop' },
  { id: 'sell-300', stat: 'sold', n: 300, coins: 40, fertilizer: 2, en: 'Earn 300 coins on the farm' },
];

/* ----------------------------------------------------------------------------------------- the dog, stealing */
export const DOG_PRICE = 80;
export const DOG_MAX_LEVEL = 5;
/** Training sessions that count per day, and how many good sessions make a level. */
export const DOG_TRAIN_PER_DAY = 3;
export const DOG_TRAIN_PER_LEVEL = 3;
export const dogLevel = (train: number) => Math.min(DOG_MAX_LEVEL, Math.floor(train / DOG_TRAIN_PER_LEVEL));
/** Running speed of the guard dog (m/s); players run at 6 m/s while they have breath, then walk at 3. */
export const dogSpeed = (level: number) => 3.8 + 0.35 * level;
/** A thief can run this long (seconds) before getting tired. */
export const THIEF_BREATH_S = 3.2;
/** Stealing: one piece per ripe plot (the owner keeps the rest), a few a day each way. */
export const STEALS_FROM_FARM_PER_DAY = 5;
export const STEALS_BY_PLAYER_PER_DAY = 5;
/** Players below this level (and guests) can't steal or be stolen from. */
export const STEAL_MIN_LEVEL = 3;
/** Caught: give the piece back and pay the owner (value + 50%, at most 100 coins, never more than you have). */
export const stealFine = (value: number) => Math.min(100, Math.ceil(value * 1.5));
export const DOG_COMMANDS: { cmd: string; does: string }[] = [
  { cmd: 'Sit!', does: 'The dog sits down.' },
  { cmd: 'Stay!', does: "The dog doesn't move." },
  { cmd: 'Fetch!', does: 'The dog brings the ball back.' },
  { cmd: 'Lie down!', does: 'The dog lies on the ground.' },
  { cmd: 'Come here!', does: 'The dog runs to you.' },
  { cmd: 'Guard!', does: 'The dog watches the farm.' },
  { cmd: 'Shake hands!', does: 'The dog gives you its paw.' },
  { cmd: 'Jump!', does: 'The dog jumps up.' },
];

/* ----------------------------------------------------------------------------------------- state */
export const MyPlotSchema = z.object({ crop: CropSchema.nullable(), plantedAt: z.number(), wateredAt: z.number(), stolen: z.number().int().min(0).max(1).optional(), left: z.number().int().min(1).max(5).optional() });
export const DogSchema = z.object({ name: z.string().max(16), train: z.number().int().min(0), fedDay: z.string(), trainDay: z.string(), trainCount: z.number().int().min(0) });
export type FarmDog = z.infer<typeof DogSchema>;
export type MyPlot = z.infer<typeof MyPlotSchema>;
export const MyAnimalSchema = z.object({ kind: z.enum(ANIMALS), name: z.string().max(16), fedAt: z.number(), collectedAt: z.number() });
export type MyAnimal = z.infer<typeof MyAnimalSchema>;
export const VisitModeSchema = z.enum(['friends', 'everyone', 'closed']);
export type VisitMode = z.infer<typeof VisitModeSchema>;
export const MyFarmStateSchema = z.object({
  fields: z.number().int().min(1).max(MAX_FIELDS).default(1),
  plots: z.array(MyPlotSchema).default([]),
  seeds: z.record(z.string(), z.number().int().min(0)).default({}),
  feed: z.number().int().min(0).default(0),
  animals: z.array(MyAnimalSchema).default([]),
  /** harvest and products waiting to be sold */
  barn: z.record(z.string(), z.number().int().min(0)).default({}),
  /** coins earned today: [day, coins] */
  earned: z.tuple([z.string(), z.number()]).default(['', 0]),
  visits: VisitModeSchema.default('friends'),
  /** what happened while you were away (newest last) */
  log: z.array(z.object({ t: z.number(), text: z.string().max(140) })).default([]),
  dog: DogSchema.nullable().default(null),
  /** pieces stolen from this farm today / by this player today: [day, count] */
  robbed: z.tuple([z.string(), z.number()]).default(['', 0]),
  stole: z.tuple([z.string(), z.number()]).default(['', 0]),
  /** a steal waiting for the dog chase to end (the game server reports it) */
  pending: z.object({ id: z.string(), owner: z.string(), crop: CropSchema, at: z.number() }).nullable().default(null),
  /** notes friends left on the notice board (newest last) */
  notes: z.array(z.object({ t: z.number(), name: z.string().max(20), text: z.string().max(80) })).default([]),
  /** plots this player watered on friends' farms today / notes left today: [day, count] */
  helped: z.tuple([z.string(), z.number()]).default(['', 0]),
  noted: z.tuple([z.string(), z.number()]).default(['', 0]),
  /** farm v2: farm XP (levels), fertilizer bags, barn upgrades, the order board */
  farmXp: z.number().int().min(0).default(0),
  fertilizer: z.number().int().min(0).default(0),
  barnLevel: z.number().int().min(0).max(BARN_PRICES.length).default(0),
  orders: z.array(z.object({ id: z.number().int(), who: z.string(), items: z.record(z.string(), z.number().int().min(1)), coins: z.number().int(), xp: z.number().int(), text: z.string() })).default([]),
  orderSeq: z.number().int().min(0).default(0),
  /** workshop machines you own and what each is making */
  machines: z.record(z.string(), z.object({ job: z.object({ recipe: z.string(), at: z.number() }).nullable() })).default({}),
  /** counters for the farm goals, and the goals already claimed */
  stats: z.record(z.string(), z.number().int().min(0)).default({}),
  goals: z.array(z.string()).default([]),
  /** rules version the farm was last brought up to (normalizeMyFarm) */
  v: z.number().int().default(1),
});
/** Visiting friends: water their seeded plots (a little XP), leave notes (a few a day). */
export const HELPS_PER_DAY = 10;
export const NOTES_PER_DAY = 3;
export const NOTES_KEPT = 12;
/** Selling at the Riverside farmers' market pays more than the farm's shipping bin. */
export const MARKET_BONUS = 1.2;
export type MyFarmState = z.infer<typeof MyFarmStateSchema>;
/** A new farm: a starter kit (seeds, one hen and a little feed) so it can start without coins. */
export const emptyMyFarm = (): MyFarmState =>
  MyFarmStateSchema.parse({ plots: Array.from({ length: FIELD_PLOTS }, () => ({ crop: null, plantedAt: 0, wateredAt: 0 })), seeds: { carrot: 3, potato: 2 }, feed: 3, fertilizer: 2, v: 2, animals: [{ kind: 'chicken', name: 'Daisy', fedAt: 0, collectedAt: 0 }] });

/**
 * Bring a stored farm up to the current rules: farms from before v2 get a level that matches what they built and
 * 5 bags of fertilizer (crops grow slower now), and every farm has ORDER_SLOTS orders on its board.
 */
export function normalizeMyFarm(state: MyFarmState): MyFarmState {
  const f: MyFarmState = structuredClone(state);
  if (f.v < 2) {
    f.v = 2;
    f.fertilizer += 5;
    const kinds = new Set(f.animals.map((a) => a.kind));
    const need = Math.max(FIELD_LEVEL[f.fields - 1] ?? 1, ...[...kinds].map((k) => ANIMAL_INFO[k].level));
    f.farmXp = Math.max(f.farmXp, FARM_LEVELS[need - 1] ?? 0);
  }
  const lv = farmLevel(f.farmXp);
  while (f.orders.length < ORDER_SLOTS) {
    f.orderSeq += 1;
    f.orders.push(makeOrder(f.orderSeq, lv, f.animals.map((a) => a.kind), Object.keys(f.machines)));
  }
  return f;
}

export type MyPlotStage = 'empty' | 'seed' | 'growing' | 'ready';
export const dogAwake = (f: MyFarmState, day: string) => !!f.dog && f.dog.fedDay === day;
/** Add a line to a farm's notice board (newest last, 20 kept). */
export function farmLog(f: MyFarmState, text: string, t = Date.now()) {
  f.log = [...f.log, { t, text: text.slice(0, 140) }].slice(-20);
}
const today = (pair: [string, number], day: string) => (pair[0] === day ? pair[1] : 0);
/** The owner's side of a steal: one piece off a ripe plot that was not touched yet. */
export function stealFrom(f: MyFarmState, plot: number, now: number, day: string): { farm: MyFarmState; crop: Crop } | { error: 'not_ready' | 'taken' | 'limit' | 'no_plot' } {
  const p = f.plots[plot];
  if (!p || plot >= f.fields * FIELD_PLOTS) return { error: 'no_plot' };
  if (myPlotStage(p, now).stage !== 'ready') return { error: 'not_ready' };
  if (p.stolen) return { error: 'taken' };
  if (today(f.robbed, day) >= STEALS_FROM_FARM_PER_DAY) return { error: 'limit' };
  const g: MyFarmState = structuredClone(f);
  g.plots[plot] = { ...p, stolen: 1 };
  g.robbed = [day, today(f.robbed, day) + 1];
  return { farm: g, crop: p.crop! };
}
export const canSteal = (f: MyFarmState, day: string) => today(f.stole, day) < STEALS_BY_PLAYER_PER_DAY;
export const pieceValue = (k: string) => CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 0;

export function myPlotStage(p: MyPlot | undefined, now: number): { stage: MyPlotStage; progress: number } {
  if (!p || !p.crop) return { stage: 'empty', progress: 0 };
  if (!p.wateredAt) return { stage: 'seed', progress: 0 };
  const k = (now - p.wateredAt) / MY_GROW_MS[p.crop];
  return k >= 1 ? { stage: 'ready', progress: 1 } : { stage: 'growing', progress: Math.max(0, k) };
}
/** An animal: hungry (feed it), happy (making its product), or ready (collect the product). */
export function animalStage(a: MyAnimal, now: number): { stage: 'hungry' | 'busy' | 'ready'; progress: number } {
  if (!a.fedAt || a.collectedAt >= a.fedAt) return { stage: 'hungry', progress: 0 };
  const k = (now - a.fedAt) / ANIMAL_INFO[a.kind].everyMs;
  return k >= 1 ? { stage: 'ready', progress: 1 } : { stage: 'busy', progress: Math.max(0, k) };
}

/* ----------------------------------------------------------------------------------------- actions */
export const MyFarmActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plant'), plot: z.number().int().min(0).max(MAX_FIELDS * FIELD_PLOTS - 1), crop: CropSchema }),
  z.object({ action: z.literal('water'), plot: z.number().int().min(0).max(MAX_FIELDS * FIELD_PLOTS - 1) }),
  z.object({ action: z.literal('harvest'), plot: z.number().int().min(0).max(MAX_FIELDS * FIELD_PLOTS - 1) }),
  z.object({ action: z.literal('feed'), animal: z.number().int().min(0).max(20) }),
  z.object({ action: z.literal('collect'), animal: z.number().int().min(0).max(20) }),
  z.object({ action: z.literal('buy'), item: z.string().max(24), qty: z.number().int().min(1).max(20) }),
  z.object({ action: z.literal('sell'), market: z.boolean().optional() }),
  z.object({ action: z.literal('visits'), mode: VisitModeSchema }),
  z.object({ action: z.literal('dogfeed') }),
  /** a training session (the command quiz, played in the game): ok = all answers right */
  z.object({ action: z.literal('train'), ok: z.boolean() }),
  z.object({ action: z.literal('fertilize'), plot: z.number().int().min(0).max(MAX_FIELDS * FIELD_PLOTS - 1) }),
  z.object({ action: z.literal('waterAll') }),
  z.object({ action: z.literal('harvestAll') }),
  z.object({ action: z.literal('deliver'), order: z.number().int().min(0) }),
  z.object({ action: z.literal('skipOrder'), order: z.number().int().min(0) }),
  z.object({ action: z.literal('craft'), recipe: z.string().max(16) }),
  z.object({ action: z.literal('takeCraft'), machine: z.enum(MACHINES) }),
  z.object({ action: z.literal('claimGoal'), goal: z.string().max(24) }),
]);
export type MyFarmAction = z.infer<typeof MyFarmActionSchema>;
export type MyFarmError = 'no_dog' | 'dog_fed' | 'trained' | 'busy' | 'empty' | 'no_seed' | 'no_plot' | 'needs_water' | 'not_ready' | 'already_watered' | 'no_feed' | 'not_hungry' | 'no_animal' | 'too_many' | 'coins' | 'bad_item' | 'nothing_to_sell' | 'day_cap' | 'locked' | 'barn_full' | 'no_fertilizer' | 'no_order' | 'missing' | 'nothing' | 'no_machine' | 'machine_busy' | 'not_done';
export interface MyFarmResult {
  farm: MyFarmState;
  /** coins to add (selling) or take (buying, negative) */
  coins: number;
  xp: number;
  /** English sentence describing what you did */
  said: string;
  error?: MyFarmError;
  /** the farm reached this level with this action */
  levelUp?: number;
}

const PLURAL: Record<Crop, string> = { carrot: 'carrots', corn: 'corn', tomato: 'tomatoes', potato: 'potatoes', pumpkin: 'pumpkins', strawberry: 'strawberries', wheat: 'wheat' };
export const cropPlural = (c: Crop) => PLURAL[c];
const NAMES: Record<AnimalKind, string[]> = { chicken: ['Daisy', 'Nugget', 'Penny', 'Goldie', 'Pepper', 'Sunny'], sheep: ['Woolly', 'Fluffy', 'Snowy'], pig: ['Peppa', 'Truffle'], cow: ['Bella', 'Moo'] };
/** Price of a shop item ('seed:carrot', 'animal:cow', 'feed', 'field'), or null if it can't be bought. */
export function shopPrice(f: MyFarmState, item: string): number | null {
  const [kind, what] = item.split(':');
  if (kind === 'seed' && CROPS.includes(what as Crop)) return SEED_PRICE[what as Crop];
  if (kind === 'animal' && ANIMALS.includes(what as AnimalKind)) return ANIMAL_INFO[what as AnimalKind].price;
  if (item === 'feed') return FEED_PRICE;
  if (item === 'fertilizer') return FERTILIZER_PRICE;
  if (item === 'field') return f.fields < MAX_FIELDS ? FIELD_PRICES[f.fields]! : null;
  if (item === 'barn') return f.barnLevel < BARN_PRICES.length ? BARN_PRICES[f.barnLevel]! : null;
  if (item === 'dog') return f.dog ? null : DOG_PRICE;
  if (kind === 'machine' && (MACHINES as readonly string[]).includes(what!)) return f.machines[what!] ? null : MACHINE_INFO[what as MachineId].price;
  return null;
}
/** Farm level a shop item needs (1 = from the start). */
export function itemLevel(f: MyFarmState, item: string): number {
  const [kind, what] = item.split(':');
  if (kind === 'seed') return CROP_LEVEL[what as Crop] ?? 1;
  if (kind === 'animal') return ANIMAL_INFO[what as AnimalKind]?.level ?? 1;
  if (item === 'field') return FIELD_LEVEL[f.fields] ?? 99;
  if (item === 'dog') return 2;
  if (kind === 'machine') return MACHINE_INFO[what as MachineId]?.level ?? 99;
  return 1;
}
const plotCount = (f: MyFarmState) => f.fields * FIELD_PLOTS;
const sellValue = (f: MyFarmState) => Object.entries(f.barn).reduce((s, [k, n]) => s + n * piece(k), 0);
export const barnValue = sellValue;

/**
 * Apply an action; `coins` is the player's balance (buying needs enough), `day` is today's key (the sale cap).
 * Every action that works gives farm XP (the same amount as player XP); `levelUp` says when a new level is reached.
 */
export function applyMyFarm(state: MyFarmState, a: MyFarmAction, now: number, coins: number, day: string): MyFarmResult {
  const base = normalizeMyFarm(state);
  const r = applyRule(base, a, now, coins, day);
  if (r.error) return { ...r, farm: state };
  // the farm goals' counters
  const st = r.farm.stats;
  const bump = (k: string, n: number) => n > 0 && (st[k] = (st[k] ?? 0) + n);
  if (a.action === 'harvest') bump('harvest', 1);
  if (a.action === 'harvestAll') bump('harvest', r.xp / 4);
  if (a.action === 'deliver') bump('orders', 1);
  if (a.action === 'feed') bump('feed', 1);
  if (a.action === 'takeCraft') bump('craft', 1);
  if ((a.action === 'sell' || a.action === 'deliver') && r.coins > 0) bump('sold', r.coins);
  const before = farmLevel(r.farm.farmXp);
  r.farm.farmXp += r.xp;
  const after = farmLevel(r.farm.farmXp);
  if (after > before) r.levelUp = after;
  return r;
}

const piece = (k: string) => CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 0;
function harvestPlot(f: MyFarmState, i: number, now: number): { crop: Crop; n: number } | MyFarmError {
  const p = f.plots[i]!;
  const st = myPlotStage(p, now);
  if (st.stage === 'empty') return 'empty';
  if (st.stage === 'seed') return 'needs_water';
  if (st.stage !== 'ready') return 'not_ready';
  const crop = p.crop!;
  const n = HARVEST_QTY - (p.stolen ?? 0);
  if (barnCount(f) + n > barnCap(f)) return 'barn_full';
  f.barn[crop] = (f.barn[crop] ?? 0) + n;
  // tomatoes and strawberries grow again (water them again); the rest leave the plot empty
  const left = (p.left ?? 1) - 1;
  f.plots[i] = left > 0 ? { crop, plantedAt: now, wateredAt: 0, left } : { crop: null, plantedAt: 0, wateredAt: 0 };
  return { crop, n };
}

function applyRule(state: MyFarmState, a: MyFarmAction, now: number, coins: number, day: string): MyFarmResult {
  const f: MyFarmState = structuredClone(state);
  while (f.plots.length < plotCount(f)) f.plots.push({ crop: null, plantedAt: 0, wateredAt: 0 });
  const fail = (error: MyFarmError): MyFarmResult => ({ farm: state, coins: 0, xp: 0, said: '', error });
  if ('plot' in a && a.plot >= plotCount(f)) return fail('no_plot');
  switch (a.action) {
    case 'plant': {
      const p = f.plots[a.plot]!;
      if (p.crop) return fail('busy');
      if ((f.seeds[a.crop] ?? 0) < 1) return fail('no_seed');
      f.seeds[a.crop] = f.seeds[a.crop]! - 1;
      f.plots[a.plot] = { crop: a.crop, plantedAt: now, wateredAt: 0, ...(REGROW[a.crop] ? { left: REGROW[a.crop] } : {}) };
      return { farm: f, coins: 0, xp: 2, said: `I'm planting ${PLURAL[a.crop]}.` };
    }
    case 'water': {
      const p = f.plots[a.plot]!;
      if (!p.crop) return fail('empty');
      if (p.wateredAt) return fail('already_watered');
      p.wateredAt = now;
      return { farm: f, coins: 0, xp: 2, said: `I'm watering the ${PLURAL[p.crop]}.` };
    }
    case 'harvest': {
      const stolen = !!f.plots[a.plot]!.stolen;
      const h = harvestPlot(f, a.plot, now);
      if (typeof h === 'string') return fail(h);
      return { farm: f, coins: 0, xp: 4, said: stolen ? `I picked ${h.n} ${PLURAL[h.crop]}. Somebody took one!` : `I picked ${h.n} ${PLURAL[h.crop]}.` };
    }
    case 'harvestAll': {
      let n = 0;
      let full = false;
      for (let i = 0; i < plotCount(f); i++) {
        if (myPlotStage(f.plots[i], now).stage !== 'ready') continue;
        const h = harvestPlot(f, i, now);
        if (h === 'barn_full') full = true;
        else if (typeof h !== 'string') n += 1;
      }
      if (!n) return fail(full ? 'barn_full' : 'nothing');
      return { farm: f, coins: 0, xp: 4 * n, said: full ? `I harvested ${n} plots. My barn is full!` : n === 1 ? 'I harvested one plot.' : `I harvested ${n} plots.` };
    }
    case 'waterAll': {
      let n = 0;
      for (let i = 0; i < plotCount(f); i++) {
        const p = f.plots[i]!;
        if (p.crop && !p.wateredAt) {
          p.wateredAt = now;
          n += 1;
        }
      }
      if (!n) return fail('nothing');
      return { farm: f, coins: 0, xp: 2 * n, said: n === 1 ? "I'm watering one plot." : `I'm watering ${n} plots.` };
    }
    case 'fertilize': {
      const p = f.plots[a.plot]!;
      const st = myPlotStage(p, now);
      if (st.stage === 'empty') return fail('empty');
      if (st.stage === 'seed') return fail('needs_water');
      if (st.stage === 'ready') return fail('nothing');
      if (f.fertilizer < 1) return fail('no_fertilizer');
      f.fertilizer -= 1;
      const left = p.wateredAt + MY_GROW_MS[p.crop!] - now;
      p.wateredAt -= Math.ceil(left / 2);
      return { farm: f, coins: 0, xp: 1, said: `I'm putting fertilizer on the ${PLURAL[p.crop!]}. They will grow faster.` };
    }
    case 'deliver': {
      const o = f.orders.find((x) => x.id === a.order);
      if (!o) return fail('no_order');
      if (Object.entries(o.items).some(([k, n]) => (f.barn[k] ?? 0) < n)) return fail('missing');
      const earned = f.earned[0] === day ? f.earned[1] : 0;
      if (earned + o.coins > FARM_DAY_CAP) return fail('day_cap');
      for (const [k, n] of Object.entries(o.items)) f.barn[k] = f.barn[k]! - n;
      f.earned = [day, earned + o.coins];
      f.orders = f.orders.filter((x) => x.id !== o.id);
      // every 4th order brings a bag of fertilizer too
      const bonus = o.id % 4 === 0;
      if (bonus) f.fertilizer += 1;
      const lv = farmLevel(f.farmXp);
      f.orderSeq += 1;
      f.orders.push(makeOrder(f.orderSeq, lv, f.animals.map((x) => x.kind), Object.keys(f.machines)));
      return { farm: f, coins: o.coins, xp: o.xp, said: `Here you are, ${o.who.replace(/^The /, 'the ')}! That's ${o.coins} coins, thank you.${bonus ? ' And a bag of fertilizer!' : ''}` };
    }
    case 'craft': {
      const rec = RECIPES[a.recipe];
      if (!rec) return fail('bad_item');
      const m = f.machines[rec.machine];
      if (!m) return fail('no_machine');
      if (m.job) return fail('machine_busy');
      if (Object.entries(rec.needs).some(([k, n]) => (f.barn[k] ?? 0) < n)) return fail('missing');
      for (const [k, n] of Object.entries(rec.needs)) f.barn[k] = f.barn[k]! - n;
      m.job = { recipe: a.recipe, at: now };
      return { farm: f, coins: 0, xp: 3, said: `I'm making ${rec.en} in my ${MACHINE_INFO[rec.machine].name}.` };
    }
    case 'takeCraft': {
      const m = f.machines[a.machine];
      if (!m) return fail('no_machine');
      if (!m.job) return fail('nothing');
      const rec = RECIPES[m.job.recipe]!;
      if (now - m.job.at < rec.ms) return fail('not_ready');
      if (barnCount(f) + 1 > barnCap(f)) return fail('barn_full');
      f.barn[rec.makes] = (f.barn[rec.makes] ?? 0) + 1;
      m.job = null;
      return { farm: f, coins: 0, xp: 6, said: `${rec.en[0]!.toUpperCase()}${rec.en.slice(1)} is ready. It smells great!` };
    }
    case 'claimGoal': {
      const g = FARM_GOALS.find((x) => x.id === a.goal);
      if (!g) return fail('bad_item');
      if (f.goals.includes(g.id)) return fail('nothing');
      if ((f.stats[g.stat] ?? 0) < g.n) return fail('not_done');
      f.goals.push(g.id);
      f.fertilizer += g.fertilizer;
      return { farm: f, coins: g.coins, xp: 10, said: `Goal done: ${g.en}! I got ${g.coins} coins and ${g.fertilizer} fertilizer.` };
    }
    case 'skipOrder': {
      const o = f.orders.find((x) => x.id === a.order);
      if (!o) return fail('no_order');
      f.orders = f.orders.filter((x) => x.id !== o.id);
      f.orderSeq += 1;
      f.orders.push(makeOrder(f.orderSeq, farmLevel(f.farmXp), f.animals.map((x) => x.kind), Object.keys(f.machines)));
      return { farm: f, coins: 0, xp: 0, said: `Sorry, I can't do this order today.` };
    }
    case 'feed': {
      const an = f.animals[a.animal];
      if (!an) return fail('no_animal');
      if (animalStage(an, now).stage !== 'hungry') return fail('not_hungry');
      if (f.feed < 1) return fail('no_feed');
      f.feed -= 1;
      an.fedAt = now;
      return { farm: f, coins: 0, xp: 2, said: `I'm feeding ${an.name} the ${an.kind}.` };
    }
    case 'collect': {
      const an = f.animals[a.animal];
      if (!an) return fail('no_animal');
      if (animalStage(an, now).stage !== 'ready') return fail('not_ready');
      const info = ANIMAL_INFO[an.kind];
      if (barnCount(f) + 1 > barnCap(f)) return fail('barn_full');
      f.barn[info.product] = (f.barn[info.product] ?? 0) + 1;
      an.collectedAt = now;
      return { farm: f, coins: 0, xp: 3, said: `${an.name} gave me ${info.productEn}!` };
    }
    case 'buy': {
      const unit = shopPrice(f, a.item);
      if (unit == null) return fail('bad_item');
      if (farmLevel(f.farmXp) < itemLevel(f, a.item)) return fail('locked');
      const [kind, what] = a.item.split(':');
      const qty = kind === 'animal' || kind === 'machine' || a.item === 'field' || a.item === 'barn' || a.item === 'dog' ? 1 : a.qty;
      const cost = unit * qty;
      if (coins < cost) return fail('coins');
      let said: string;
      if (kind === 'seed') {
        f.seeds[what!] = (f.seeds[what!] ?? 0) + qty;
        said = qty === 1 ? `Can I have a packet of ${what} seeds, please?` : `Can I have ${qty} packets of ${what} seeds, please?`;
      } else if (kind === 'animal') {
        const k = what as AnimalKind;
        const have = f.animals.filter((x) => x.kind === k).length;
        if (have >= ANIMAL_INFO[k].max) return fail('too_many');
        f.animals.push({ kind: k, name: NAMES[k][have % NAMES[k].length]!, fedAt: 0, collectedAt: 0 });
        said = `I'd like to buy a ${k}, please.`;
      } else if (a.item === 'dog') {
        f.dog = { name: 'Rex', train: 0, fedDay: '', trainDay: '', trainCount: 0 };
        said = "I'd like a dog to guard my farm, please.";
      } else if (kind === 'machine') {
        f.machines[what!] = { job: null };
        said = `I bought a ${MACHINE_INFO[what as MachineId].name} for my barn!`;
      } else if (a.item === 'fertilizer') {
        f.fertilizer += qty;
        said = qty === 1 ? 'A bag of fertilizer, please.' : `${qty} bags of fertilizer, please.`;
      } else if (a.item === 'barn') {
        f.barnLevel += 1;
        said = `My barn is bigger now. It holds ${barnCap(f)} things!`;
      } else if (a.item === 'feed') {
        f.feed += qty;
        said = qty === 1 ? 'A bag of animal feed, please.' : `${qty} bags of animal feed, please.`;
      } else {
        f.fields += 1;
        while (f.plots.length < plotCount(f)) f.plots.push({ crop: null, plantedAt: 0, wateredAt: 0 });
        said = 'I want a bigger farm. I bought a new field!';
      }
      return { farm: f, coins: -cost, xp: 1, said };
    }
    case 'sell': {
      const value = Math.round(sellValue(f) * (a.market ? MARKET_BONUS : 1));
      if (value <= 0) return fail('nothing_to_sell');
      const earned = f.earned[0] === day ? f.earned[1] : 0;
      const room = FARM_DAY_CAP - earned;
      if (room <= 0) return fail('day_cap');
      const got = Math.min(value, room);
      // sell everything up to the cap; what is left over stays in the barn (pieces, cheapest last)
      if (got === value) f.barn = {};
      else {
        let left = Math.floor(got / (a.market ? MARKET_BONUS : 1));
        for (const k of Object.keys(f.barn).sort((x, y) => (CROP_SELL[y as Crop] ?? PRODUCT_SELL[y] ?? 0) - (CROP_SELL[x as Crop] ?? PRODUCT_SELL[x] ?? 0))) {
          const price = CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 0;
          const n = Math.min(f.barn[k]!, Math.floor(left / price));
          f.barn[k] = f.barn[k]! - n;
          left -= n * price;
        }
      }
      f.earned = [day, earned + got];
      return { farm: f, coins: got, xp: a.market ? 5 : 3, said: a.market ? `I sold my farm produce at the market for ${got} coins.` : `I sold my farm produce for ${got} coins.` };
    }
    case 'dogfeed': {
      if (!f.dog) return fail('no_dog');
      if (f.dog.fedDay === day) return fail('dog_fed');
      if (f.feed < 1) return fail('no_feed');
      f.feed -= 1;
      f.dog.fedDay = day;
      return { farm: f, coins: 0, xp: 2, said: `Good dog, ${f.dog.name}! Here's your dinner.` };
    }
    case 'train': {
      if (!f.dog) return fail('no_dog');
      const count = f.dog.trainDay === day ? f.dog.trainCount : 0;
      if (count >= DOG_TRAIN_PER_DAY) return fail('trained');
      f.dog.trainDay = day;
      f.dog.trainCount = count + 1;
      if (a.ok) f.dog.train += 1;
      const lv = dogLevel(f.dog.train);
      return { farm: f, coins: 0, xp: a.ok ? 4 : 1, said: a.ok ? `Well done, ${f.dog.name}! You are getting faster. (level ${lv})` : `Let's practise again tomorrow, ${f.dog.name}.` };
    }
    case 'visits':
      f.visits = a.mode;
      return { farm: f, coins: 0, xp: 0, said: a.mode === 'closed' ? 'My farm is closed to visitors.' : a.mode === 'friends' ? 'Only my friends can visit my farm.' : 'Everybody is welcome on my farm!' };
  }
}

/** What a visitor sees of somebody's farm. */
export interface FarmView {
  owner: string;
  name: string;
  fields: number;
  plots: MyPlot[];
  animals: MyAnimal[];
  visits: VisitMode;
  dog: { name: string; level: number; awake: boolean } | null;
  notes: { t: number; name: string; text: string }[];
}
