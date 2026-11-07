import { useEffect, useState } from 'react';
import { useBus } from '../../store/bus';
import { localPos } from '../../scene/LocalPlayer';
import { Icon } from '../icons';
import { useJourney, currentStep } from '../../store/journey';
import { useGame } from '../../store/game';
import { stepById, AREA_INFO } from '@es/shared';
import { useT } from '../../i18n';
import { stepText } from './journeyText';

/**
 * HUD: the next thing to do (one line, tap = the Journey book, 📍 = take me there) and "✅ Done" toasts.
 */
export function NextStepChip({ touch }: { touch: boolean }) {
  const t = useT();
  const view = useJourney((s) => s.view);
  const busy = useGame((s) => !!s.uiPanel || !!s.panelNpc);
  const step = currentStep(view);
  if (!step || busy) return null;
  const tx = stepText(step);
  const need = step.goal.count ?? 1;
  const prog = step.kind === 'daily' ? (view?.state.dailyProg[step.id] ?? 0) : (view?.state.prog[step.id] ?? 0);
  return (
    <div
      data-ui
      className={`hud-top absolute z-10 flex items-center gap-1 bg-white/90 text-slate-800 shadow-md ring-1 ring-black/5 backdrop-blur-md ${
        touch ? 'hud-left left-[calc(max(0.75rem,env(safe-area-inset-left))+3.4rem)] top-[calc(max(0.75rem,env(safe-area-inset-top))+3.1rem)] max-w-[52vw] rounded-full py-0.5 pl-2.5 pr-0.5' : 'left-3 top-[6.6rem] max-w-[min(20rem,62vw)] rounded-2xl py-1 pl-3 pr-1'
      }`}
    >
      <button type="button" onClick={() => useGame.getState().setUiPanel('daily')} className="min-w-0 flex-1 text-left">
        {/* phones: one small line (the title only) so it does not cover the street */}
        <div className={`text-[10px] font-semibold uppercase tracking-wide text-amber-600 ${touch ? 'hidden' : ''}`}>{step.kind === 'main' ? t('Journey') : step.area ? `${step.area === 'river' ? '🚣' : AREA_INFO[step.area].icon} ${t('Passport')}` : t('Today')}</div>
        <div className={`truncate font-semibold ${touch ? 'text-xs' : 'text-sm'}`}>
          {tx.title}
          {need > 1 ? <span className="ml-1 font-normal text-gray-500">{`${Math.min(prog, need)}/${need}`}</span> : null}
        </div>
      </button>
      {step.guide ? (
        <button type="button" onClick={() => useJourney.getState().go(step)} title={t('Take me there')} aria-label={t('Take me there')} className={`flex shrink-0 items-center justify-center bg-blue-600 text-white ${touch ? 'h-7 w-7 rounded-full text-xs' : 'h-9 w-9 rounded-xl'}`}>
          <Icon name="pin" size={touch ? 15 : 18} />
        </button>
      ) : null}
    </div>
  );
}

export function JourneyToasts() {
  const t = useT();
  const toasts = useJourney((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-50 flex w-[92vw] max-w-sm -translate-x-1/2 flex-col gap-2">
      {toasts.map((x) => {
        const s = stepById(x.id);
        const title = s
          ? stepText(s).title
          : x.id === 'weekly'
            ? t('Weekly challenge complete!')
            : x.id === 'invite'
              ? t('Your friend joined English Street!')
              : x.id === 'welcome'
                ? t('Welcome bonus from your friend')
                : x.id === 'story-bonus'
                  ? t('A whole day in English Street!')
                  : t('Daily bonus');
        return (
          <button key={x.key} type="button" onClick={() => useJourney.getState().dismiss(x.key)} className="pointer-events-auto animate-[pop_.3s_ease-out] rounded-2xl bg-emerald-600 px-4 py-3 text-left text-white shadow-2xl">
            <div className="text-xs font-semibold uppercase opacity-80">✅ {t('Done!')}</div>
            <div className="font-bold">{title}</div>
            <div className="text-sm">
              +{x.xp} XP · +{x.coins} 🪙 {x.stamp ? `· 🛂 ${t('New stamp!')}` : ''}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** "Take me there", walking part: where to, how far, and a way to stop (hidden while on the bus). */
export function GuideChip() {
  const t = useT();
  const walk = useJourney((s) => s.walk);
  const riding = useBus((s) => !!s.ride);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!walk) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [walk]);
  if (!walk || riding) return null;
  const d = Math.round(Math.hypot(walk.x - localPos.x, walk.z - localPos.z));
  return (
    <div data-ui className="hud-top pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+6rem)] z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-[78vw] items-center gap-2 rounded-full bg-slate-900/80 py-1 pe-1 ps-3 text-xs text-white shadow-lg backdrop-blur-md">
        <Icon name="walk" size={16} className="shrink-0 text-yellow-300" />
        <span className="min-w-0 truncate">
          {t('Follow the yellow dots')}: <b>{walk.label}</b> · {d} m
        </span>
        <button type="button" onClick={() => useJourney.getState().stopWalk()} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20" aria-label={t('Stop')}>
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
