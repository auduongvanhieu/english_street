import type { DeviceInfo } from '@es/shared';
import { isNativeApp, nativeCall, nativePlatform } from '../native/bridge';

/**
 * Best-effort description of the device for the admin site (model, OS, network). Browsers differ a lot:
 *  - Chrome / Edge on Android: model + OS version (User-Agent Client Hints), Wi-Fi vs cellular, speed class
 *  - Safari on iPhone: iOS version only (no model, no network type)
 *  - the phone app adds the exact model, OS version and network (and 4G/5G on iPhone) through the native bridge
 */
interface UaData {
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (h: string[]) => Promise<{ model?: string; platformVersion?: string; platform?: string }>;
}
interface NetInfo {
  type?: string;
  effectiveType?: string;
  downlink?: number;
}

function parseUa(ua: string): Pick<DeviceInfo, 'os' | 'osVersion' | 'browser' | 'model'> {
  let os: string | undefined;
  let osVersion: string | undefined;
  let model: string | undefined;
  const ios = /(iPhone|iPad|iPod)[^)]*OS (\d+)[_.](\d+)/.exec(ua);
  const android = /Android (\d+(?:\.\d+)?)(?:;\s*([^;)]+))?/.exec(ua);
  if (ios) {
    os = ios[1] === 'iPad' ? 'iPadOS' : 'iOS';
    osVersion = `${ios[2]}.${ios[3]}`;
    model = ios[1];
  } else if (android) {
    os = 'Android';
    osVersion = android[1];
    const m = android[2]?.replace(/Build\/.*/, '').trim();
    if (m && m !== 'K' && !/^wv$/i.test(m)) model = m; // reduced UAs say "K"
  } else if (/Windows NT (\d+\.\d+)/.test(ua)) os = 'Windows';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X (\d+)[_.](\d+)/.test(ua)) {
    os = navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS'; // iPads ask for the desktop site
    const m = /Mac OS X (\d+)[_.](\d+)/.exec(ua)!;
    osVersion = `${m[1]}.${m[2]}`;
    if (os === 'iPadOS') model = 'iPad';
  } else if (/Linux/.test(ua)) os = 'Linux';
  const browser = /EdgA?\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /CriOS/.test(ua)
          ? 'Chrome'
          : /FxiOS|Firefox\//.test(ua)
            ? 'Firefox'
            : /Chrome\//.test(ua)
              ? 'Chrome'
              : /Safari\//.test(ua)
                ? 'Safari'
                : undefined;
  return { os, osVersion, browser, model };
}

function gpuName(): string | undefined {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return undefined;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : undefined;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    // "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" → "Apple M2"
    return r?.replace(/^ANGLE \((?:[^,]+, )?(?:ANGLE \w+ Renderer: )?([^,]+).*$/, '$1').slice(0, 80);
  } catch {
    return undefined;
  }
}

let cached: Promise<DeviceInfo> | null = null;
export function deviceInfo(): Promise<DeviceInfo> {
  cached ??= (async () => {
    const ua = navigator.userAgent;
    const base = parseUa(ua);
    const uad = (navigator as Navigator & { userAgentData?: UaData }).userAgentData;
    if (uad?.getHighEntropyValues) {
      try {
        const h = await uad.getHighEntropyValues(['model', 'platformVersion', 'platform']);
        if (h.model) base.model = h.model;
        if (h.platformVersion) {
          // Windows 11 reports platformVersion ≥ 13
          if (base.os === 'Windows') base.osVersion = Number(h.platformVersion.split('.')[0]) >= 13 ? '11' : '10';
          else if (base.os === 'Android' || base.os === 'macOS' || base.os === 'ChromeOS') base.osVersion = h.platformVersion.split('.').slice(0, 2).join('.');
        }
      } catch {
        /* not allowed */
      }
    }
    const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
    const touch = navigator.maxTouchPoints > 0;
    const short = Math.min(screen.width, screen.height);
    const info: DeviceInfo = {
      kind: isNativeApp() ? 'app' : 'web',
      ...base,
      form: !touch ? 'desktop' : short < 600 ? 'phone' : 'tablet',
      network: conn?.type === 'wifi' ? 'wifi' : conn?.type === 'cellular' ? 'cellular' : conn?.type === 'ethernet' ? 'ethernet' : conn?.type === 'none' ? 'offline' : conn?.type ? 'unknown' : undefined,
      speed: conn?.effectiveType,
      downlinkMbps: conn?.downlink,
      screen: `${screen.width}x${screen.height}@${Math.round(devicePixelRatio * 10) / 10}`,
      gpu: gpuName(),
      lang: navigator.language,
    };
    // the phone app knows better (exact model, OS version, Wi-Fi / mobile data, 4G / 5G on iPhone)
    if (isNativeApp()) {
      const n = await nativeCall<Partial<DeviceInfo>>('device.info');
      if (n) Object.assign(info, Object.fromEntries(Object.entries(n).filter(([, v]) => v !== null && v !== undefined && v !== '')));
      if (!info.os) info.os = nativePlatform() === 'ios' ? 'iOS' : 'Android';
    }
    return info;
  })();
  return cached;
}
