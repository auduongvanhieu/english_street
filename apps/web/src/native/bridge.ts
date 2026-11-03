/**
 * Bridge to the Flutter shell (apps/mobile). When the page runs inside the app, Flutter registers
 * JavaScript handlers (flutter_inappwebview) and sets window.esNative = { platform, version }.
 * Calls go web → native through `call()`; events come back through window.__esNativeEvent(json).
 *
 * Why: WKWebView on iOS has no Web Speech API, so speech recognition / synthesis must be native there.
 */
export type NativeEvent =
  | { type: 'stt.interim'; text: string }
  | { type: 'stt.final'; text: string }
  | { type: 'stt.error'; code: string }
  | { type: 'stt.end' }
  | { type: 'tts.start'; id: number }
  | { type: 'tts.end'; id: number }
  | { type: 'push.token'; token: string; platform: string };

interface FlutterWindow extends Window {
  esNative?: { platform: 'android' | 'ios'; version: string; stt?: boolean; tts?: boolean };
  flutter_inappwebview?: { callHandler: (name: string, ...args: unknown[]) => Promise<unknown> };
  __esNativeEvent?: (json: string) => void;
  __esSession?: () => { playerId: string; token: string | null; apiUrl: string; name: string };
}
const w = window as FlutterWindow;

export const isNativeApp = () => !!w.esNative && !!w.flutter_inappwebview;
export const nativePlatform = () => w.esNative?.platform ?? null;
export const nativeHas = (cap: 'stt' | 'tts') => !!w.esNative?.[cap];

export async function nativeCall<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  if (!isNativeApp()) return null;
  try {
    return (await w.flutter_inappwebview!.callHandler(name, args)) as T;
  } catch (e) {
    console.warn('[native]', name, e);
    return null;
  }
}

const listeners = new Set<(e: NativeEvent) => void>();
export function onNative(fn: (e: NativeEvent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
w.__esNativeEvent = (json: string) => {
  try {
    const e = JSON.parse(json) as NativeEvent;
    listeners.forEach((fn) => fn(e));
  } catch {
    /* ignore malformed */
  }
};

/** Short vibration on phones (incoming talk request, critter tap…). No-op on the web. */
export function haptic(kind: 'light' | 'medium' = 'light') {
  if (isNativeApp()) void nativeCall('haptic', { kind });
  else if ('vibrate' in navigator) navigator.vibrate?.(kind === 'light' ? 40 : 120);
}

/** Lets the shell read the current session (for its native Notebook / Settings screens). */
export function exposeSession(get: FlutterWindow['__esSession']) {
  w.__esSession = get;
}
