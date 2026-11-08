import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { APP_INSTALL_STEP, BONUS_STEPS } from '@es/shared';
import { useT } from '../i18n';
import { useGame } from '../store/game';
import { useJourney } from '../store/journey';
import { installNow, installPlatform, isInstalledApp, useInstallState, type InstallPlatform } from '../net/pwa';
import { Icon } from './icons';

/**
 * "Install the game on your phone" (journey bonus task b-install-app, +200 coins): the step-by-step guide for
 * each browser (most players have never installed a web app), the card in the journey book and a gentle nudge
 * after a few minutes of play. The reward comes when the game is opened from the home screen (net/pwa.ts).
 */
export const useInstallGuide = create<{ open: boolean; show: (open: boolean) => void }>((set) => ({ open: false, show: (open) => set({ open }) }));
const REWARD = BONUS_STEPS[0]!.reward;

export function useInstallDone() {
  return useJourney((s) => !!s.view?.state.done.includes(APP_INSTALL_STEP));
}

/* small pictures of the buttons the player has to find */
const svg = (d: string) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-4px]" aria-hidden>
    <path d={d} />
  </svg>
);
const SHARE = svg('M12 3v12M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8');
const PLUS = svg('M4 4h16v16H4zM12 8v8M8 12h8');
const DOTS = svg('M12 5h.01M12 12h.01M12 19h.01');
const BARS = svg('M4 6h16M4 12h16M4 18h16');
const Key = ({ children }: { children: ReactNode }) => <b className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-800 ring-1 ring-slate-200">{children}</b>;

function steps(p: InstallPlatform, t: ReturnType<typeof useT>): ReactNode[] {
  const open = t('Close the browser and open English Street from the new icon on your home screen. The coins arrive at once!');
  switch (p) {
    case 'ios-safari':
      return [
        <>{t('Tap the Share button')} <Key>{SHARE}</Key> {t('in the bar at the bottom of Safari.')}</>,
        <>{t('Scroll down and tap')} <Key>{PLUS} {t('Add to Home Screen')}</Key>.</>,
        <>{t('Tap')} <Key>{t('Add')}</Key> {t('at the top right.')}</>,
        open,
      ];
    case 'ios-chrome':
      return [
        <>{t('Tap the Share button')} <Key>{SHARE}</Key> {t('in the address bar of Chrome.')}</>,
        <>{t('Scroll down and tap')} <Key>{PLUS} {t('Add to Home Screen')}</Key>. {t('(Not there? Open this page in Safari.)')}</>,
        <>{t('Tap')} <Key>{t('Add')}</Key> {t('at the top right.')}</>,
        open,
      ];
    case 'ios-other':
      return [<>{t('This browser cannot install games. Copy the link and open it in')} <b>Safari</b>.</>, <>{t('Tap the Share button')} <Key>{SHARE}</Key> {t('then')} <Key>{PLUS} {t('Add to Home Screen')}</Key>.</>, open];
    case 'inapp':
      return [
        <>{t('You opened the game inside an app (Zalo, Facebook, Messenger…). It cannot install games from here.')}</>,
        <>{t('Tap')} <Key>{DOTS}</Key> {t('or')} <Key>•••</Key> {t('at the top and choose "Open in browser" (Chrome or Safari). Or copy the link below and paste it into Chrome or Safari.')}</>,
        <>{t('Then open this guide again in the browser.')}</>,
      ];
    case 'android-chrome':
      return [
        <>{t('Tap')} <Key>{DOTS}</Key> {t('at the top right of Chrome.')}</>,
        <>{t('Tap')} <Key>{t('Install app')}</Key> {t('or')} <Key>{t('Add to Home screen')}</Key>.</>,
        <>{t('Tap')} <Key>{t('Install')}</Key>.</>,
        open,
      ];
    case 'android-samsung':
      return [
        <>{t('Tap')} <Key>{BARS}</Key> {t('at the bottom right.')}</>,
        <>{t('Tap')} <Key>{t('Add page to')}</Key> {t('then')} <Key>{t('Home screen')}</Key>.</>,
        <>{t('Tap')} <Key>{t('Add')}</Key>.</>,
        open,
      ];
    case 'android-other':
      return [
        <>{t('Open the browser menu')} <Key>{DOTS}</Key> {t('or')} <Key>{BARS}</Key>.</>,
        <>{t('Tap')} <Key>{t('Add to Home screen')}</Key> {t('or')} <Key>{t('Install app')}</Key>. {t('(Not there? Open this page in Chrome.)')}</>,
        open,
      ];
    default:
      return [
        <>{t('On a computer: click the install icon at the right end of the address bar in Chrome or Edge, then Install.')}</>,
        <>{t('On your phone: open this page in the phone browser and open this guide there.')}</>,
        <>{t('Open English Street from the new icon. The coins arrive at once!')}</>,
      ];
  }
}

/** The guide (a card over the game). */
export function InstallGuide() {
  const t = useT();
  const open = useInstallGuide((s) => s.open);
  const done = useInstallDone();
  const { canInstall, justInstalled } = useInstallState();
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const close = () => useInstallGuide.getState().show(false);
  const p = installPlatform();
  const installed = isInstalledApp();
  const link = `${location.origin}/`;
  return (
    <div data-ui className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-14 w-14 shrink-0 rounded-2xl shadow ring-1 ring-black/5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight text-slate-800">{t('Install the game on your phone')}</h2>
            <p className="mt-0.5 text-sm font-semibold text-amber-600">
              🎁 +{REWARD.coins} {t('coins')} · +{REWARD.xp} XP
            </p>
          </div>
          <button type="button" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label={t('Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">{t('Play English Street like an app: one tap from your home screen, full screen, faster to start. It is free and takes 10 seconds.')}</p>
        {done ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-center font-semibold text-emerald-800">✅ {t('Done! You installed the game and got your coins.')}</p>
        ) : installed ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-center font-semibold text-emerald-800">🎉 {t('You are playing the installed game. Your coins are on the way!')}</p>
        ) : justInstalled ? (
          <p className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">🎉 {t('Installed! Now close this tab and open English Street from your home screen to get the coins.')}</p>
        ) : (
          <>
            {canInstall ? (
              <button type="button" onClick={() => void installNow()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/30">
                📲 {t('Install now')}
              </button>
            ) : null}
            {canInstall ? <p className="mt-3 text-center text-xs text-slate-400">{t('Or do it by hand:')}</p> : null}
            <ol className="mt-3 space-y-2.5">
              {steps(p, t).map((s, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{i + 1}</span>
                  <span className="min-w-0 pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
            {p === 'inapp' || p === 'ios-other' ? (
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true))}
                className="mt-4 w-full rounded-2xl bg-slate-100 py-3 text-sm font-semibold text-slate-800"
              >
                {copied ? `✓ ${t('Link copied')}` : `🔗 ${t('Copy the link')}`}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Card for the journey book (until it is done). */
export function InstallCard() {
  const t = useT();
  const done = useInstallDone();
  if (done) return null;
  return (
    <button type="button" onClick={() => useInstallGuide.getState().show(true)} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 p-3 text-left text-white shadow-md">
      <span className="text-3xl">📲</span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm">{t('Install the game on your phone')}</b>
        <span className="block text-xs opacity-90">
          🎁 +{REWARD.coins} {t('coins')} · {t('see how (10 seconds)')}
        </span>
      </span>
      <Icon name="gift" size={20} />
    </button>
  );
}

const NUDGE_KEY = 'es:install-nudge';
/** After 3 minutes of play in a browser on a phone: a small "install and get 200 coins" bar (again 3 days after "later"). */
export function InstallNudge({ touch }: { touch: boolean }) {
  const t = useT();
  const done = useInstallDone();
  const loaded = useJourney((s) => !!s.view);
  const busy = useGame((s) => !!s.uiPanel || !!s.panelNpc);
  const [due, setDue] = useState(false);
  useEffect(() => {
    if (!touch || isInstalledApp()) return;
    const last = Number(localStorage.getItem(NUDGE_KEY) ?? 0);
    if (Date.now() - last < 3 * 86_400_000) return;
    const id = window.setTimeout(() => setDue(true), 3 * 60_000);
    return () => window.clearTimeout(id);
  }, [touch]);
  if (!due || done || !loaded || busy) return null;
  const later = () => {
    localStorage.setItem(NUDGE_KEY, String(Date.now()));
    setDue(false);
  };
  return (
    <div data-ui className="pointer-events-none absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+12.5rem)] left-1/2 z-20 w-[min(92vw,24rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-blue-600 py-2 pe-2 ps-3 text-white shadow-lg">
        <span className="text-2xl">📲</span>
        <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">
          {t('Install the game, get {n} coins!', { n: REWARD.coins })}
        </span>
        <button
          type="button"
          onClick={() => {
            later();
            useInstallGuide.getState().show(true);
          }}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-700"
        >
          {t('How?')}
        </button>
        <button type="button" onClick={later} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20" aria-label={t('Later')}>
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}

let reported = false;
/** Opened as the installed app and the bonus is not paid yet: tell the journey (once per session; the API pays once). */
export function reportInstalledApp(track: (name: string, props: Record<string, string>) => void) {
  if (reported || !isInstalledApp() || !useJourney.getState().view || useJourney.getState().view!.state.done.includes(APP_INSTALL_STEP)) return;
  reported = true;
  track('app_installed', { platform: installPlatform() });
}
