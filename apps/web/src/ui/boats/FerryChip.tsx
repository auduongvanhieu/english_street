import { useEffect, useState } from 'react';
import { PIER_NAME, pierTip, useFerry } from '../../store/ferryman';
import { localPos } from '../../scene/LocalPlayer';
import { useT } from '../../i18n';

/** While rowing: the passenger job (where to pick up / drop off, how far), and the thanks after a trip. */
export function FerryChip() {
  const t = useT();
  const job = useFerry((s) => s.job);
  const last = useFerry((s) => s.last);
  const trips = useFerry((s) => s.trips);
  const result = useFerry((s) => s.result);
  const [, tick] = useState(0);
  const [shownTrip, setShownTrip] = useState(0);
  useEffect(() => {
    if (!job) return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [job]);
  useEffect(() => {
    if (trips === shownTrip) return;
    const id = window.setTimeout(() => setShownTrip(trips), 6000);
    return () => window.clearTimeout(id);
  }, [trips, shownTrip]);
  const thanks = trips !== shownTrip;
  if (!job && !thanks) return null;
  const target = job ? pierTip(job.phase === 'pickup' ? job.from : job.to) : null;
  const d = target ? Math.round(Math.hypot(localPos.x - target.x, localPos.z - target.z)) : 0;
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+6rem)] z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-[86vw] items-center gap-2 rounded-2xl bg-sky-900/85 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-md">
        <span className="text-lg">🙋</span>
        {job ? (
          <span className="min-w-0" dir="ltr">
            {job.phase === 'pickup' ? (
              <>
                <b>{job.name}</b> {t('is waiting at')} <b>{PIER_NAME[job.from]}</b> · {d} m
              </>
            ) : (
              <>
                {t('Take {name} to', { name: job.name })} <b>{PIER_NAME[job.to]}</b> · {d} m
              </>
            )}
          </span>
        ) : (
          <span className="min-w-0" dir="ltr">
            {last} {result ? (result.capped ? t('No more rewards for this game today.') : `+${result.xp} XP, +${result.coins} 🪙`) : ''}
          </span>
        )}
        {job?.phase === 'pickup' ? (
          <button type="button" onClick={() => useFerry.getState().decline()} className="shrink-0 rounded-full bg-white/20 px-2 py-1">
            {t('No thanks')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
