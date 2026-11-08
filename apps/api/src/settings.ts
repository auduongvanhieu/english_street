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
