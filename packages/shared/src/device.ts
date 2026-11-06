import { z } from 'zod';

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
});
export const GfxInfoSchema = DeviceInfoSchema.shape.gfx.unwrap().unwrap();
export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

/** "iPhone · iOS 18.1 · Wi-Fi" style one-liner for lists. */
export function deviceSummary(d: Partial<DeviceInfo> | null | undefined): string {
  if (!d || !d.os) return '';
  const net = d.network === 'wifi' ? 'Wi-Fi' : d.network === 'cellular' ? d.radio || 'mobile data' : d.network === 'ethernet' ? 'cable' : '';
  return [d.model || (d.form === 'desktop' ? '' : d.form), [d.os, d.osVersion].filter(Boolean).join(' '), d.kind === 'app' ? 'app' : d.browser, net].filter(Boolean).join(' · ');
}
