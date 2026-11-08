import { useSyncExternalStore } from 'react';
import { isNativeApp } from '../native/bridge';

/**
 * Installing English Street on the phone (PWA): is this the installed app, can the browser install it in one tap
 * (Android Chrome, Edge, desktop Chrome: `beforeinstallprompt`), and which browser the player is in (for the
 * step-by-step guide; iPhones have no install button, it is Share → Add to Home Screen).
 */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

/** Running as the installed app (home-screen web app or the store app), not in a browser tab. */
export function isInstalledApp(): boolean {
  if (isNativeApp()) return true;
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches);
}

/** One-tap install (where the browser offers it). Resolves true when the player accepted. */
export async function installNow(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  if (outcome === 'accepted') installedNow = true;
  emit();
  return outcome === 'accepted';
}

const snap = () => `${deferred ? 1 : 0}${installedNow ? 1 : 0}`;
/** { canInstall: one-tap install available, justInstalled: installed from this tab a moment ago } */
export function useInstallState() {
  const s = useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    snap,
    snap,
  );
  return { canInstall: s[0] === '1', justInstalled: s[1] === '1' };
}

export type InstallPlatform = 'ios-safari' | 'ios-chrome' | 'ios-other' | 'inapp' | 'android-chrome' | 'android-samsung' | 'android-other' | 'desktop';
/** Which guide to show. In-app browsers (Zalo, Facebook, Messenger…) can't install: open in a real browser first. */
export function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Zalo|Line\/|MicroMessenger|TikTok|musical_ly|Messenger/i.test(ua)) return 'inapp';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS/.test(ua) ? 'ios-chrome' : /FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/.test(ua)) return /SamsungBrowser/.test(ua) ? 'android-samsung' : /Chrome\//.test(ua) && !/EdgA|OPR|Opera|coc_coc|UCBrowser|MiuiBrowser|wv\)/i.test(ua) ? 'android-chrome' : 'android-other';
  return 'desktop';
}
