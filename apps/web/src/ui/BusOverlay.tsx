import { useT } from '../i18n';
import { stopName, useBus } from '../store/bus';

/** Between two stops: the screen fades out, "Riding to …" with a little bus, then fades back in at the stop. */
export function BusOverlay() {
  const t = useT();
  const ride = useBus((s) => s.ride);
  const fade = useBus((s) => s.fade);
  // a taxi ride (Travel.tsx taxiTo): just the fade
  if (!ride)
    return fade > 0 ? (
      <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900" style={{ opacity: fade }}>
        <div className="animate-bounce text-5xl">🚕</div>
        <div className="mt-3 text-lg font-semibold text-white">{t('Taxi!')}</div>
      </div>
    ) : null;
  return (
    <>
      {ride.stage === 'board' && fade === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-30 flex justify-center">
          <div className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold shadow">
            🚌 {t('The bus to {place} is coming…', { place: stopName(ride.to) })}
          </div>
        </div>
      ) : null}
      {fade > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900" style={{ opacity: fade }}>
          <div className="animate-bounce text-5xl">🚌</div>
          <div className="mt-3 text-lg font-semibold text-white" dir="auto">
            {t('Riding to {place}…', { place: stopName(ride.to) })}
          </div>
        </div>
      ) : null}
    </>
  );
}
