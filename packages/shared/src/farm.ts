import { z } from 'zod';

/** Garden crops the learner can grow on the farm (item ids in farm.yaml). */
export const CROPS = ['carrot', 'corn', 'tomato', 'potato', 'pumpkin', 'strawberry'] as const;
export type Crop = (typeof CROPS)[number];
export const CropSchema = z.enum(CROPS);
/** Garden plots built in the farm scene (the admin site may use fewer). */
export const MAX_PLOTS = 6;
/** Animal chores (feed, milk, collect eggs): XP each, once per chore per cooldown. */
export const CHORES = ['feed', 'milk', 'collect-eggs'] as const;
export type Chore = (typeof CHORES)[number];

/**
 * Farm rules. Defaults below; the admin site changes them (world config → applyFarmConfig on the API and the
 * client). The objects are mutated in place so every importer sees the live values.
 */
export const GROW_MS: Record<Crop, number> = { carrot: 3 * 60_000, potato: 4 * 60_000, tomato: 5 * 60_000, strawberry: 5 * 60_000, corn: 6 * 60_000, pumpkin: 8 * 60_000 };
/** Market price per piece (coins). */
export const CROP_PRICE: Record<Crop, number> = { carrot: 1, potato: 1, tomato: 2, strawberry: 3, corn: 2, pumpkin: 4 };
export const FARM = {
  /** Pieces per harvest. */
  harvestQty: 3,
  plotCount: MAX_PLOTS,
  /** Farm coins per rolling hour (stops "coin farming"). */
  coinsPerHour: 60,
  choreCooldownMs: 10 * 60_000,
  xp: { plant: 2, water: 2, harvest: 5, sell: 3, chore: 3 },
  /** Crops that can't be planted right now. */
  disabled: [] as Crop[],
};
const FARM_DEFAULTS = structuredClone({ GROW_MS, CROP_PRICE, FARM });

const int = (min: number, max: number) => z.number().int().min(min).max(max);
export const FarmConfigSchema = z.object({
  crops: z.partialRecord(CropSchema, z.object({ price: int(0, 1000).optional(), growMin: z.number().min(0.5).max(24 * 60).optional(), enabled: z.boolean().optional() })).optional(),
  harvestQty: int(1, 50).optional(),
  plotCount: int(1, MAX_PLOTS).optional(),
  coinsPerHour: int(0, 100_000).optional(),
  choreCooldownMin: z.number().min(0.5).max(24 * 60).optional(),
  xp: z.object({ plant: int(0, 100), water: int(0, 100), harvest: int(0, 100), sell: int(0, 100), chore: int(0, 100) }).partial().optional(),
});
export type FarmConfig = z.infer<typeof FarmConfigSchema>;

/** Reset the farm rules to the defaults, then apply the admin settings. */
export function applyFarmConfig(c: FarmConfig | undefined) {
  Object.assign(GROW_MS, FARM_DEFAULTS.GROW_MS);
  Object.assign(CROP_PRICE, FARM_DEFAULTS.CROP_PRICE);
  Object.assign(FARM, structuredClone(FARM_DEFAULTS.FARM));
  if (!c) return;
  for (const crop of CROPS) {
    const x = c.crops?.[crop];
    if (!x) continue;
    if (x.price != null) CROP_PRICE[crop] = x.price;
    if (x.growMin != null) GROW_MS[crop] = Math.round(x.growMin * 60_000);
    if (x.enabled === false) FARM.disabled.push(crop);
  }
  if (c.harvestQty != null) FARM.harvestQty = c.harvestQty;
  if (c.plotCount != null) FARM.plotCount = c.plotCount;
  if (c.coinsPerHour != null) FARM.coinsPerHour = c.coinsPerHour;
  if (c.choreCooldownMin != null) FARM.choreCooldownMs = Math.round(c.choreCooldownMin * 60_000);
  if (c.xp) Object.assign(FARM.xp, c.xp);
}
/** The default farm rules (admin site: placeholders and "reset"). */
export const farmDefaults = () => structuredClone(FARM_DEFAULTS);

export const PlotSchema = z.object({ crop: CropSchema.nullable(), plantedAt: z.number(), wateredAt: z.number() });
export type Plot = z.infer<typeof PlotSchema>;
export const FarmStateSchema = z.object({
  plots: z.array(PlotSchema).default([]),
  basket: z.record(z.string(), z.number().int()).default({}),
  /** recent sales [time, coins] for the hourly cap */
  sales: z.array(z.tuple([z.number(), z.number()])).default([]),
  chores: z.record(z.string(), z.number()).default({}),
});
export type FarmState = z.infer<typeof FarmStateSchema>;

export type PlotStage = 'empty' | 'seed' | 'growing' | 'ready';
export function plotStage(p: Plot | undefined, now: number): { stage: PlotStage; progress: number } {
  if (!p || !p.crop) return { stage: 'empty', progress: 0 };
  if (!p.wateredAt) return { stage: 'seed', progress: 0 };
  const k = (now - p.wateredAt) / GROW_MS[p.crop];
  return k >= 1 ? { stage: 'ready', progress: 1 } : { stage: 'growing', progress: Math.max(0, k) };
}

/** Compact garden summary for the game server (GARDEN_RE). */
export function encodeGarden(f: FarmState): string {
  return Array.from({ length: FARM.plotCount }, (_, i) => {
    const p = f.plots[i];
    return p?.crop ? `${p.crop}:${p.wateredAt}` : '';
  }).join('|');
}
/** Plots of someone else's garden (plantedAt is not shared: 0). */
export function decodeGarden(s: string): Plot[] {
  return s.split('|').slice(0, MAX_PLOTS).map((part) => {
    const [crop, w] = part.split(':');
    const c = CropSchema.safeParse(crop);
    return c.success ? { crop: c.data, plantedAt: 0, wateredAt: Number(w) || 0 } : { crop: null, plantedAt: 0, wateredAt: 0 };
  });
}

export function emptyFarm(): FarmState {
  return { plots: Array.from({ length: FARM.plotCount }, () => ({ crop: null, plantedAt: 0, wateredAt: 0 })), basket: {}, sales: [], chores: {} };
}

export const FarmActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plant'), plot: z.number().int().min(0).max(MAX_PLOTS - 1), crop: CropSchema }),
  z.object({ action: z.literal('water'), plot: z.number().int().min(0).max(MAX_PLOTS - 1) }),
  z.object({ action: z.literal('harvest'), plot: z.number().int().min(0).max(MAX_PLOTS - 1) }),
  z.object({ action: z.literal('sell'), crop: CropSchema }),
  z.object({ action: z.literal('chore'), chore: z.enum(CHORES) }),
]);
export type FarmAction = z.infer<typeof FarmActionSchema>;
export interface FarmActionResult {
  farm: FarmState;
  xp: number;
  coins: number;
  /** English sentence describing what you did ("I'm watering the carrots."). */
  said: string;
  error?: 'not_ready' | 'busy' | 'empty' | 'nothing_to_sell' | 'coin_cap' | 'cooldown' | 'needs_water' | 'already_watered' | 'no_plot' | 'crop_disabled';
}

const plural: Record<Crop, string> = { carrot: 'carrots', corn: 'corn', tomato: 'tomatoes', potato: 'potatoes', pumpkin: 'pumpkins', strawberry: 'strawberries' };

/** Pure farm rules (server authoritative; the client uses the same function for instant feedback). */
export function applyFarm(state: FarmState, a: FarmAction, now: number): FarmActionResult {
  const f: FarmState = structuredClone(state);
  while (f.plots.length < FARM.plotCount) f.plots.push({ crop: null, plantedAt: 0, wateredAt: 0 });
  const fail = (error: FarmActionResult['error']): FarmActionResult => ({ farm: state, xp: 0, coins: 0, said: '', error });
  if ('plot' in a && a.plot >= FARM.plotCount) return fail('no_plot');
  switch (a.action) {
    case 'plant': {
      const p = f.plots[a.plot]!;
      if (p.crop) return fail('busy');
      if (FARM.disabled.includes(a.crop)) return fail('crop_disabled');
      f.plots[a.plot] = { crop: a.crop, plantedAt: now, wateredAt: 0 };
      return { farm: f, xp: FARM.xp.plant, coins: 0, said: `I'm planting ${plural[a.crop]}.` };
    }
    case 'water': {
      const p = f.plots[a.plot]!;
      if (!p.crop) return fail('empty');
      if (p.wateredAt) return fail('already_watered');
      p.wateredAt = now;
      return { farm: f, xp: FARM.xp.water, coins: 0, said: `I'm watering the ${plural[p.crop]}.` };
    }
    case 'harvest': {
      const p = f.plots[a.plot]!;
      const st = plotStage(p, now);
      if (st.stage === 'empty') return fail('empty');
      if (st.stage === 'seed') return fail('needs_water');
      if (st.stage !== 'ready') return fail('not_ready');
      const crop = p.crop!;
      f.basket[crop] = (f.basket[crop] ?? 0) + FARM.harvestQty;
      f.plots[a.plot] = { crop: null, plantedAt: 0, wateredAt: 0 };
      return { farm: f, xp: FARM.xp.harvest, coins: 0, said: FARM.harvestQty === 1 ? `I harvested one ${crop}.` : `I harvested ${FARM.harvestQty} ${plural[crop]}.` };
    }
    case 'sell': {
      const n = f.basket[a.crop] ?? 0;
      if (n <= 0) return fail('nothing_to_sell');
      f.sales = f.sales.filter(([t]) => now - t < 3600_000);
      const earned = f.sales.reduce((s, [, c]) => s + c, 0);
      const coins = Math.min(n * CROP_PRICE[a.crop], FARM.coinsPerHour - earned);
      if (coins <= 0) return fail('coin_cap');
      f.basket[a.crop] = 0;
      f.sales.push([now, coins]);
      return { farm: f, xp: FARM.xp.sell, coins, said: n === 1 ? `I sold one ${a.crop} for ${coins} coins.` : `I sold ${n} ${plural[a.crop]} for ${coins} coins.` };
    }
    case 'chore': {
      const last = f.chores[a.chore] ?? 0;
      if (now - last < FARM.choreCooldownMs) return fail('cooldown');
      f.chores[a.chore] = now;
      const said = a.chore === 'feed' ? "I'm feeding the animals." : a.chore === 'milk' ? "I'm milking the cow." : "I'm collecting the eggs.";
      return { farm: f, xp: FARM.xp.chore, coins: 0, said };
    }
  }
}
