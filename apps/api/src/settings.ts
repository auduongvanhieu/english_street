import { z } from 'zod';
import type Redis from 'ioredis';
import { env } from './env';
import { prisma } from './plugins/prisma';

/**
 * Settings the admin site can change without a restart (table Setting). Unset keys use the .env value.
 * The game server reads the ones it needs from GET /internal/settings.
 */
export const SETTING_DEFS = {
  maxGuestsPerIp: { schema: z.number().int().min(1).max(500), def: () => Number(process.env.MAX_GUESTS_PER_IP) || 6 },
  guestPassesPerIpHour: { schema: z.number().int().min(1).max(10_000), def: () => env.GUEST_PASSES_PER_IP_HOUR },
  guestPassesPerIpDay: { schema: z.number().int().min(1).max(100_000), def: () => env.GUEST_PASSES_PER_IP_DAY },
  npcDailyBudgetUsd: { schema: z.number().min(0).max(10_000), def: () => env.NPC_DAILY_BUDGET_USD },
  npcDailyTurnsPerPlayer: { schema: z.number().int().min(0).max(10_000), def: () => env.NPC_DAILY_TURNS_PER_PLAYER },
  npcRatePerMin: { schema: z.number().int().min(1).max(600), def: () => env.NPC_RATE_PER_MIN },
  npcModel: { schema: z.string().regex(/^claude-[a-z0-9.-]+$/), def: () => env.NPC_MODEL },
  npcModelBasic: { schema: z.string().regex(/^claude-[a-z0-9.-]+$/), def: () => env.NPC_MODEL_BASIC },
  /** Translating the UI and the learning content (admin auto-translate; the dev script reads TRANSLATE_MODEL). */
  translateModel: { schema: z.string().regex(/^claude-[a-z0-9.-]+$/), def: () => env.TRANSLATE_MODEL },
  /** Message shown instead of the street ('' = open). Admins can still play. */
  maintenance: { schema: z.string().max(500), def: () => '' },
  /** Extra words for the chat filter (masked like the built-in list). */
  extraBannedWords: { schema: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(2000), def: () => [] as string[] },
  /** Built-in filter words to allow again. */
  allowedWords: { schema: z.array(z.string().trim().toLowerCase().min(2).max(40)).max(2000), def: () => [] as string[] },
  /** Admin "try the NPC" turns per admin per day. */
  adminTestTurnsPerDay: { schema: z.number().int().min(0).max(1000), def: () => 100 },
  // ---- top-ups (payments/): 💎 gem packs paid by bank transfer (SePay) or USDT ----
  /** off = hidden; test = only the testers below; on = every signed-in player */
  payMode: { schema: z.enum(['off', 'test', 'on']), def: () => 'off' as 'off' | 'test' | 'on' },
  /** user ids or e-mails who can top up while payMode = test */
  payTesters: { schema: z.array(z.string().trim().toLowerCase().min(3).max(80)).max(200), def: () => [] as string[] },
  payVnd: { schema: z.boolean(), def: () => true },
  payUsdt: { schema: z.boolean(), def: () => true },
  /** gem packs: id, gems, price in đồng and in USDT */
  payPacks: {
    schema: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,20}$/), gems: z.number().int().min(1).max(1_000_000), vnd: z.number().int().min(1000).max(50_000_000), usdt: z.number().min(0.5).max(2000) })).min(1).max(8),
    def: () => [
      { id: 'small', gems: 100, vnd: 20_000, usdt: 1 },
      { id: 'medium', gems: 270, vnd: 50_000, usdt: 2 },
      { id: 'large', gems: 600, vnd: 100_000, usdt: 4 },
    ],
  },
  /** the first paid top-up gives double gems */
  payFirstBonus: { schema: z.boolean(), def: () => true },
  /** an order waits this long (the transfer is still accepted after it, the code still matches) */
  payOrderMinutes: { schema: z.number().int().min(5).max(24 * 60), def: () => 30 },
  /** bank for VietQR: bank code or BIN (e.g. MB, VCB, 970422), account number, account name */
  payBank: { schema: z.string().trim().max(20), def: () => '' },
  payBankAccount: { schema: z.string().trim().regex(/^[0-9A-Za-z]{0,30}$/), def: () => '' },
  payBankName: { schema: z.string().trim().max(60), def: () => '' },
  /** wallets that receive USDT (addresses only, the keys never touch the server) */
  payTrc20Address: { schema: z.string().trim().regex(/^(T[1-9A-HJ-NP-Za-km-z]{33})?$/), def: () => '' },
  payBep20Address: { schema: z.string().trim().regex(/^(0x[0-9a-fA-F]{40})?$/), def: () => '' },
  /** BEP20: blocks to wait (TRC20 uses Tron's own "confirmed") */
  payBep20Confirmations: { schema: z.number().int().min(1).max(200), def: () => 15 },
  // ---- 💎 gems (gems/) ----
  /** coins for 1 gem (gems → coins only, never back) */
  gemRate: { schema: z.number().int().min(1).max(1000), def: () => 10 },
  /** extra NPC turns sold for gems (used after the free daily turns; they do not expire) */
  gemTurnPack: { schema: z.object({ turns: z.number().int().min(1).max(1000), gems: z.number().int().min(1).max(10_000) }), def: () => ({ turns: 20, gems: 20 }) },
  /** extra USD a day for bought NPC turns, on top of npcDailyBudgetUsd (players who paid are not stopped by the free budget) */
  npcPaidDailyBudgetUsd: { schema: z.number().min(0).max(10_000), def: () => 2 },
  /** gift for every 7 days in a row (signed-up players; 0 = off) */
  gemGiftStreak: { schema: z.number().int().min(0).max(1000), def: () => 5 },
  /** gift for each journey chapter done (signed-up players; 0 = off) */
  gemGiftChapter: { schema: z.number().int().min(0).max(1000), def: () => 10 },
  /** gem price changes per item id ('tag:diamond', 'royal-bed'…); items not listed keep their price */
  gemPrices: { schema: z.record(z.string().regex(/^[a-z0-9:-]{1,40}$/), z.number().int().min(1).max(100_000)), def: () => ({}) as Record<string, number> },
} as const;
export type SettingKey = keyof typeof SETTING_DEFS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTING_DEFS)[K]['schema']>;
export const SETTING_KEYS = Object.keys(SETTING_DEFS) as SettingKey[];

const values = new Map<string, unknown>();
let redis: Redis | null = null;
let seen = '';
let dbOn = false;
const listeners = new Set<() => void>();

/** Current value of a setting (admin value, else .env default). */
export function setting<K extends SettingKey>(key: K): SettingValue<K> {
  return (values.has(key) ? values.get(key) : SETTING_DEFS[key].def()) as SettingValue<K>;
}
export const isDefault = (key: SettingKey) => !values.has(key);
/** Tests only: set a value in this process without the database. */
export const setSettingForTest = <K extends SettingKey>(key: K, value: SettingValue<K>) => void values.set(key, value);
export const onSettingsChange = (fn: () => void) => listeners.add(fn);

export async function loadSettings() {
  if (!dbOn) return;
  const rows = await prisma.setting.findMany();
  values.clear();
  for (const r of rows) {
    const def = SETTING_DEFS[r.key as SettingKey];
    const ok = def?.schema.safeParse(r.value);
    if (ok?.success) values.set(r.key, ok.data);
  }
  for (const l of listeners) l();
}

/** Save (or with value null: reset to the .env default). Other API processes reload within 15 s. */
export async function saveSetting(key: SettingKey, value: unknown, by: string) {
  if (value === null) await prisma.setting.deleteMany({ where: { key } });
  else {
    const v = SETTING_DEFS[key].schema.parse(value);
    await prisma.setting.upsert({ where: { key }, create: { key, value: v as object, updatedBy: by }, update: { value: v as object, updatedBy: by } });
  }
  await loadSettings();
  if (redis) seen = String(await redis.incr('settings:ver'));
}

/** Load once, then follow changes made by other processes (Redis version counter). */
export async function startSettings(r: Redis | null, db: boolean) {
  redis = r;
  dbOn = db;
  await loadSettings().catch((e: unknown) => console.warn('[settings] load failed', e));
  if (!redis) return;
  seen = (await redis.get('settings:ver')) ?? '';
  setInterval(() => {
    void redis!.get('settings:ver').then(async (v) => {
      if ((v ?? '') !== seen) {
        seen = v ?? '';
        await loadSettings();
      }
    }).catch(() => undefined);
  }, 15_000).unref();
}
