import { z } from 'zod';
import { PlayerSettingsSchema } from './playerSettings';

const s = (n: number) => z.string().trim().max(n).optional().catch(undefined);
/**
 * What the player plays on (sent once when joining the street, stored as User.device, summarised in the
 * `join` event). Everything is best effort: browsers expose different things, iOS Safari hides the model and
 * the network, Android only tells Wi-Fi / cellular unless the app has the phone permission.
 */
export const DeviceInfoSchema = z.object({
  /** 'app' = the phone app (Flutter shell), 'web' = a browser */
  kind: z.enum(['app', 'web']).catch('web'),
  /** iOS | Android | Windows | macOS | Linux | ChromeOS | … */
  os: s(20),
  osVersion: s(20),
  /** Phone / tablet model when known ("iPhone15,3", "SM-S918B", "Pixel 8") */
  model: s(60),
  /** phone | tablet | desktop */
  form: z.enum(['phone', 'tablet', 'desktop']).optional().catch(undefined),
  browser: s(40),
  /** wifi | cellular | ethernet | offline | unknown */
  network: z.enum(['wifi', 'cellular', 'ethernet', 'offline', 'unknown']).optional().catch(undefined),
  /** Mobile radio when known: 5G | 4G | 3G | 2G */
  radio: z.enum(['5G', '4G', '3G', '2G']).optional().catch(undefined),
  /** Browser speed class (navigator.connection.effectiveType: slow-2g … 4g) and estimated downlink */
  speed: s(10),
  downlinkMbps: z.number().min(0).max(100_000).optional().catch(undefined),
  screen: s(20),
  gpu: s(80),
  appVersion: s(20),
  lang: s(16),
  /** Graphics in the game: chosen quality, render pixel ratio, measured frames per second and draw calls. */
  gfx: z
    .object({
      quality: z.enum(['high', 'low']).catch('high'),
      dpr: z.number().min(0.25).max(5).optional().catch(undefined),
      fps: z.number().int().min(0).max(500).optional().catch(undefined),
      calls: z.number().int().min(0).max(100_000).optional().catch(undefined),
      at: z.number().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  /** the player's current in-game settings (reported by the game; the admin site can change them) */
  settings: PlayerSettingsSchema.optional().catch(undefined),
});
export const GfxInfoSchema = DeviceInfoSchema.shape.gfx.unwrap().unwrap();
export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

/** "iPhone · iOS 18.1 · Wi-Fi" style one-liner for lists. */
export function deviceSummary(d: Partial<DeviceInfo> | null | undefined): string {
  if (!d || !d.os) return '';
  const net = d.network === 'wifi' ? 'Wi-Fi' : d.network === 'cellular' ? d.radio || 'mobile data' : d.network === 'ethernet' ? 'cable' : '';
  return [deviceModelName(d) || (d.form === 'desktop' ? '' : d.form), [d.os, d.osVersion].filter(Boolean).join(' '), d.kind === 'app' ? 'app' : d.browser, net].filter(Boolean).join(' · ');
}

// ---- iPhone model names ---------------------------------------------------------------------------------------
/** Apple's model identifiers (the phone app reports these) -> marketing names. */
const IPHONE_IDS: Record<string, string> = {
  'iPhone10,1': 'iPhone 8', 'iPhone10,4': 'iPhone 8', 'iPhone10,2': 'iPhone 8 Plus', 'iPhone10,5': 'iPhone 8 Plus', 'iPhone10,3': 'iPhone X', 'iPhone10,6': 'iPhone X',
  'iPhone11,2': 'iPhone XS', 'iPhone11,4': 'iPhone XS Max', 'iPhone11,6': 'iPhone XS Max', 'iPhone11,8': 'iPhone XR',
  'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro', 'iPhone12,5': 'iPhone 11 Pro Max', 'iPhone12,8': 'iPhone SE (2nd gen)',
  'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12', 'iPhone13,3': 'iPhone 12 Pro', 'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13', 'iPhone14,2': 'iPhone 13 Pro', 'iPhone14,3': 'iPhone 13 Pro Max', 'iPhone14,6': 'iPhone SE (3rd gen)',
  'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus', 'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus', 'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,3': 'iPhone 16', 'iPhone17,4': 'iPhone 16 Plus', 'iPhone17,1': 'iPhone 16 Pro', 'iPhone17,2': 'iPhone 16 Pro Max', 'iPhone17,5': 'iPhone 16e',
  'iPhone18,3': 'iPhone 17', 'iPhone18,1': 'iPhone 17 Pro', 'iPhone18,2': 'iPhone 17 Pro Max', 'iPhone18,4': 'iPhone Air',
};
/**
 * Safari hides the model: guess the family from the screen (CSS points, portrait, pixel ratio). `maxIos` drops models
 * that cannot run the reported iOS version.
 */
const IPHONE_SCREENS: Record<string, [string, number?][]> = {
  '440x956@3': [['16 Pro Max'], ['17 Pro Max']],
  '402x874@3': [['16 Pro'], ['17'], ['17 Pro']],
  '420x912@3': [['Air']],
  '430x932@3': [['14 Pro Max'], ['15 Plus'], ['15 Pro Max'], ['16 Plus']],
  '393x852@3': [['14 Pro'], ['15'], ['15 Pro'], ['16']],
  '390x844@3': [['12'], ['12 Pro'], ['13'], ['13 Pro'], ['14'], ['16e']],
  '428x926@3': [['12 Pro Max'], ['13 Pro Max'], ['14 Plus']],
  '375x812@3': [['X', 16], ['XS', 18], ['11 Pro'], ['12 mini'], ['13 mini']],
  '414x896@2': [['XR', 18], ['11']],
  '414x896@3': [['XS Max', 18], ['11 Pro Max']],
  '414x736@3': [['8 Plus', 16]],
  '375x667@2': [['8', 16], ['SE 2'], ['SE 3']],
};

/** Readable phone model: exact for the app ("iPhone 14 Pro"), a short list for iPhone browsers, else the raw model. */
export function deviceModelName(d: Partial<DeviceInfo> | null | undefined): string {
  if (!d) return '';
  if (d.model && IPHONE_IDS[d.model]) return IPHONE_IDS[d.model]!;
  if (d.model) return d.model;
  if (d.os !== 'iOS' || !d.screen) return '';
  const m = /^(\d+)x(\d+)@([\d.]+)$/.exec(d.screen);
  if (!m) return '';
  const a = Number(m[1]);
  const b = Number(m[2]);
  const key = `${Math.min(a, b)}x${Math.max(a, b)}@${Math.round(Number(m[3]))}`;
  const list = IPHONE_SCREENS[key];
  if (!list) return Math.min(a, b) >= 700 ? 'iPad' : 'iPhone';
  const ios = parseFloat(d.osVersion ?? '') || 0;
  const fit = list.filter(([, max]) => !max || !ios || ios <= max + 0.99).map(([n]) => n);
  const names = fit.length ? fit : list.map(([n]) => n);
  return names.length === 1 ? `iPhone ${names[0]}` : `iPhone ${names.join(' / ')}`;
}
