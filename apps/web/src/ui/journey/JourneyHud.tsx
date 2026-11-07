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
      className={`hud-top absolute z-10 flex max-w-[min(20rem,62vw)] items-center gap-1 rounded-2xl bg-white/90 py-1 pl-3 pr-1 text-slate-800 shadow-md ring-1 ring-black/5 backdrop-blur-md ${
        touch ? 'left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(max(0.75rem,env(safe-area-inset-top))+5.6rem)]' : 'left-3 top-24'
      }`}
    >
      <button type="button" onClick={() => useGame.getState().setUiPanel('daily')} className="min-w-0 flex-1 text-left">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">{step.kind === 'main' ? t('Journey') : step.area ? `${step.area === 'river' ? '🚣' : AREA_INFO[step.area].icon} ${t('Passport')}` : t('Today')}</div>
        <div className="truncate text-sm font-semibold">
          {tx.title}
          {need > 1 ? <span className="ml-1 font-normal text-gray-500">{`${Math.min(prog, need)}/${need}`}</span> : null}
        </div>
      </button>
      {step.guide ? (
        <button type="button" onClick={() => useJourney.getState().go(step)} title={t('Take me there')} aria-label={t('Take me there')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          📍
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
