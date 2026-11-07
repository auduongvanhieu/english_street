import { z } from 'zod';
import { CROPS, CropSchema, GROW_MS, type Crop } from './farm';
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
/** Seeds (one plot) and what one piece of the harvest sells for; a plot gives HARVEST_QTY pieces. */
export const SEED_PRICE: Record<Crop, number> = { carrot: 2, potato: 2, tomato: 3, corn: 3, strawberry: 4, pumpkin: 6 };
export const CROP_SELL: Record<Crop, number> = { carrot: 2, potato: 2, tomato: 3, corn: 3, strawberry: 4, pumpkin: 6 };
export const HARVEST_QTY = 3;
export const ANIMALS = ['chicken', 'sheep', 'pig', 'cow'] as const;
export type AnimalKind = (typeof ANIMALS)[number];
export const ANIMAL_INFO: Record<AnimalKind, { price: number; max: number; product: string; productEn: string; sell: number; everyMs: number; icon: string }> = {
  chicken: { price: 20, max: 6, product: 'egg', productEn: 'an egg', sell: 3, everyMs: 4 * 60_000, icon: '🐔' },
  sheep: { price: 45, max: 3, product: 'wool', productEn: 'some wool', sell: 9, everyMs: 10 * 60_000, icon: '🐑' },
  pig: { price: 50, max: 2, product: 'truffle', productEn: 'a truffle', sell: 12, everyMs: 12 * 60_000, icon: '🐖' },
  cow: { price: 60, max: 2, product: 'milk', productEn: 'a bottle of milk', sell: 8, everyMs: 8 * 60_000, icon: '🐄' },
};
export const PRODUCTS = ['egg', 'wool', 'truffle', 'milk'] as const;
export const PRODUCT_SELL: Record<string, number> = Object.fromEntries(ANIMALS.map((a) => [ANIMAL_INFO[a].product, ANIMAL_INFO[a].sell]));
export const FEED_PRICE = 1;
/** Fields: 6 plots each; the first is free. */
export const FIELD_PLOTS = 6;
export const FIELD_PRICES = [0, 50, 120, 250];
export const MAX_FIELDS = FIELD_PRICES.length;
/** Coins a farm can earn by selling, per day (Vietnam day). */
export const FARM_DAY_CAP = 300;

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
export const MyPlotSchema = z.object({ crop: CropSchema.nullable(), plantedAt: z.number(), wateredAt: z.number(), stolen: z.number().int().min(0).max(1).optional() });
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
});
export type MyFarmState = z.infer<typeof MyFarmStateSchema>;
/** A new farm: a starter kit (seeds, one hen and a little feed) so it can start without coins. */
export const emptyMyFarm = (): MyFarmState =>
  MyFarmStateSchema.parse({ plots: Array.from({ length: FIELD_PLOTS }, () => ({ crop: null, plantedAt: 0, wateredAt: 0 })), seeds: { carrot: 3, potato: 2, tomato: 1 }, feed: 3, animals: [{ kind: 'chicken', name: 'Daisy', fedAt: 0, collectedAt: 0 }] });

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
  const k = (now - p.wateredAt) / GROW_MS[p.crop];
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
  z.object({ action: z.literal('sell') }),
  z.object({ action: z.literal('visits'), mode: VisitModeSchema }),
  z.object({ action: z.literal('dogfeed') }),
  /** a training session (the command quiz, played in the game): ok = all answers right */
  z.object({ action: z.literal('train'), ok: z.boolean() }),
]);
export type MyFarmAction = z.infer<typeof MyFarmActionSchema>;
export type MyFarmError = 'no_dog' | 'dog_fed' | 'trained' | 'busy' | 'empty' | 'no_seed' | 'no_plot' | 'needs_water' | 'not_ready' | 'already_watered' | 'no_feed' | 'not_hungry' | 'no_animal' | 'too_many' | 'coins' | 'bad_item' | 'nothing_to_sell' | 'day_cap';
export interface MyFarmResult {
  farm: MyFarmState;
  /** coins to add (selling) or take (buying, negative) */
  coins: number;
  xp: number;
  /** English sentence describing what you did */
  said: string;
  error?: MyFarmError;
}

const PLURAL: Record<Crop, string> = { carrot: 'carrots', corn: 'corn', tomato: 'tomatoes', potato: 'potatoes', pumpkin: 'pumpkins', strawberry: 'strawberries' };
export const cropPlural = (c: Crop) => PLURAL[c];
const NAMES: Record<AnimalKind, string[]> = { chicken: ['Daisy', 'Nugget', 'Penny', 'Goldie', 'Pepper', 'Sunny'], sheep: ['Woolly', 'Fluffy', 'Snowy'], pig: ['Peppa', 'Truffle'], cow: ['Bella', 'Moo'] };
/** Price of a shop item ('seed:carrot', 'animal:cow', 'feed', 'field'), or null if it can't be bought. */
export function shopPrice(f: MyFarmState, item: string): number | null {
  const [kind, what] = item.split(':');
  if (kind === 'seed' && CROPS.includes(what as Crop)) return SEED_PRICE[what as Crop];
  if (kind === 'animal' && ANIMALS.includes(what as AnimalKind)) return ANIMAL_INFO[what as AnimalKind].price;
  if (item === 'feed') return FEED_PRICE;
  if (item === 'field') return f.fields < MAX_FIELDS ? FIELD_PRICES[f.fields]! : null;
  if (item === 'dog') return f.dog ? null : DOG_PRICE;
  return null;
}
const plotCount = (f: MyFarmState) => f.fields * FIELD_PLOTS;
const sellValue = (f: MyFarmState) => Object.entries(f.barn).reduce((s, [k, n]) => s + n * (CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 0), 0);
export const barnValue = sellValue;

/** Apply an action; `coins` is the player's balance (buying needs enough), `day` is today's key (the sale cap). */
export function applyMyFarm(state: MyFarmState, a: MyFarmAction, now: number, coins: number, day: string): MyFarmResult {
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
      f.plots[a.plot] = { crop: a.crop, plantedAt: now, wateredAt: 0 };
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
      const p = f.plots[a.plot]!;
      const st = myPlotStage(p, now);
      if (st.stage === 'empty') return fail('empty');
      if (st.stage === 'seed') return fail('needs_water');
      if (st.stage !== 'ready') return fail('not_ready');
      const crop = p.crop!;
      const n = HARVEST_QTY - (p.stolen ?? 0);
      f.barn[crop] = (f.barn[crop] ?? 0) + n;
      f.plots[a.plot] = { crop: null, plantedAt: 0, wateredAt: 0 };
      return { farm: f, coins: 0, xp: 4, said: p.stolen ? `I picked ${n} ${PLURAL[crop]}. Somebody took one!` : `I picked ${n} ${PLURAL[crop]}.` };
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
      f.barn[info.product] = (f.barn[info.product] ?? 0) + 1;
      an.collectedAt = now;
      return { farm: f, coins: 0, xp: 3, said: `${an.name} gave me ${info.productEn}!` };
    }
    case 'buy': {
      const unit = shopPrice(f, a.item);
      if (unit == null) return fail('bad_item');
      const [kind, what] = a.item.split(':');
      const qty = kind === 'animal' || a.item === 'field' ? 1 : a.qty;
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
      const value = sellValue(f);
      if (value <= 0) return fail('nothing_to_sell');
      const earned = f.earned[0] === day ? f.earned[1] : 0;
      const room = FARM_DAY_CAP - earned;
      if (room <= 0) return fail('day_cap');
      const got = Math.min(value, room);
      // sell everything up to the cap; what is left over stays in the barn (pieces, cheapest last)
      if (got === value) f.barn = {};
      else {
        let left = got;
        for (const k of Object.keys(f.barn).sort((x, y) => (CROP_SELL[y as Crop] ?? PRODUCT_SELL[y] ?? 0) - (CROP_SELL[x as Crop] ?? PRODUCT_SELL[x] ?? 0))) {
          const price = CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 0;
          const n = Math.min(f.barn[k]!, Math.floor(left / price));
          f.barn[k] = f.barn[k]! - n;
          left -= n * price;
        }
      }
      f.earned = [day, earned + got];
      return { farm: f, coins: got, xp: 3, said: `I sold my farm produce for ${got} coins.` };
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
}
