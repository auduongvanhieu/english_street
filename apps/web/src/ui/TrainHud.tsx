import { useEffect, useState } from 'react';
import { serverNow } from '../net/client';
import { useTrain } from '../store/train';
import { DESTINATIONS, boardRows } from '../world/places/station';
import { useT } from '../i18n';

const PRICE = { single: 4, return: 7 };

/** Train cards: the ticket machine, announcements and the inspector during a ride, the result back home. */
export function TrainHud() {
  const t = useT();
  const machine = useTrain((s) => s.machine);
  const ticket = useTrain((s) => s.ticket);
  const ride = useTrain((s) => s.ride);
  const caption = useTrain((s) => s.caption);
  const asking = useTrain((s) => s.asking);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!machine) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [machine]);
  const st = useTrain.getState();
  const card = 'pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
  return (
    <>
      {machine ? (
        <div data-ui className={wrap}>
          <div className={card}>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold text-gray-800">🎫 {t('Ticket machine')}</span>
              <button type="button" onClick={() => st.closeMachine()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
                ✕
              </button>
            </div>
            {/* the next departures, the same as the big board */}
            <div className="mb-2 rounded-lg bg-gray-900 px-2 py-1 font-mono text-xs text-amber-300" dir="ltr">
              {boardRows(serverNow(), 3).map((r) => (
                <div key={r.time + r.dest} className="flex justify-between gap-2">
                  <span>{r.time}</span>
                  <span className="flex-1 truncate">{r.dest}</span>
                  <span>P{r.platform}</span>
                  <span className={r.status === 'Cancelled' ? 'text-red-400' : ''}>{r.status}</span>
                </div>
              ))}
            </div>
            {machine.step === 'dest' ? (
              <div dir="ltr">
                <p className="mb-1 text-sm font-semibold">Where are you going?</p>
                <p className="mb-1 text-xs text-gray-500">{t('Take the next train that is not cancelled. Read the board!')}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {DESTINATIONS.map((d) => (
                    <button key={d} type="button" onClick={() => st.machineDest(d)} className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 text-sm font-semibold">
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ) : machine.step === 'type' ? (
              <div dir="ltr">
                <p className="mb-1 text-sm font-semibold">
                  {machine.dest}: Single or return?
                </p>
                <p className="mb-1 text-xs text-gray-500">{t('The train comes back here after the trip.')}</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => st.machineType('single')} className="min-h-11 flex-1 rounded-xl bg-gray-100 text-sm font-semibold">
                    ➡️ Single ${PRICE.single}
                  </button>
                  <button type="button" onClick={() => st.machineType('return')} className="min-h-11 flex-1 rounded-xl bg-gray-100 text-sm font-semibold">
                    🔁 Return ${PRICE.return}
                  </button>
                </div>
              </div>
            ) : ticket ? (
              <div className="text-center" dir="ltr">
                <div className="mx-auto w-56 rounded-lg border-2 border-dashed border-orange-400 bg-orange-50 p-2 text-sm">
                  <b>🎫 {ticket.type === 'return' ? 'RETURN' : 'SINGLE'}</b>
                  <div>English Street Central → {ticket.dest}</div>
                </div>
                <p className="mt-2 text-xs text-gray-600">{t('Go to platform 1 and get on when the doors open.')}</p>
                <button type="button" onClick={() => st.closeMachine()} className="mt-2 min-h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white">
                  {t('Done')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {ride ? (
        <div data-ui className={wrap}>
          <div className={card}>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold text-gray-800">🚆 {t('Train to {dest}', { dest: ride.dest })}</span>
              {!ride.done ? (
                <button type="button" onClick={() => st.leave()} className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                  {t('Get off')}
                </button>
              ) : (
                <button type="button" onClick={() => st.leave()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
                  ✕
                </button>
              )}
            </div>
            {caption ? (
              <p className="text-sm" dir="ltr">
                {caption.who === 'pa' ? '📢' : '🧑‍✈️'} {caption.text}
              </p>
            ) : null}
            {asking && !ride.check ? (
              <div className="mt-2 flex gap-1.5" dir="ltr">
                <button type="button" onClick={() => st.showTicket()} className="min-h-10 flex-1 rounded-xl bg-orange-500 text-sm font-semibold text-white">
                  🎫 “Here you are.”
                </button>
                {!ticket ? (
                  <button type="button" onClick={() => st.showTicket()} className="min-h-10 flex-1 rounded-xl bg-gray-200 text-sm font-semibold">
                    “Sorry, I don't have one.”
                  </button>
                ) : null}
              </div>
            ) : null}
            {ride.done ? (
              <div className="mt-2 border-t pt-2 text-center text-sm">
                <p>
                  {'⭐'.repeat(ride.check?.ok ?? 0)}
                  {'☆'.repeat(2 - (ride.check?.ok ?? 0))} {ride.check?.ok === 2 ? t('The right ticket for the right train!') : t('Next time: the right destination and a return ticket.')}
                </p>
                {ride.result ? <p className="text-emerald-700">{ride.result.capped ? t('No more rewards for this game today.') : `+${ride.result.xp} XP, +${ride.result.coins} 🪙`}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
