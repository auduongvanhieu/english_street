import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n';
import { METER_GOOD, meterAt, useMini } from '../../store/minigames';

/** Re-render every animation frame while `on` (for the meter and the race clock). */
function useTicker(on: boolean) {
  const [, set] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!on) return;
    const loop = () => {
      set((n) => n + 1);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [on]);
}

function Meter() {
  const t0 = useMini((s) => s.meterT0);
  const shot = useMini((s) => s.shot);
  useTicker(!shot);
  const m = meterAt(t0);
  return (
    <div className="relative mt-2 h-5 w-full overflow-hidden rounded-full bg-gray-200" aria-hidden>
      <div className="absolute inset-y-0 bg-green-400" style={{ left: `${(0.5 - METER_GOOD) * 100}%`, width: `${METER_GOOD * 200}%` }} />
      <div className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded bg-black" style={{ left: `${m * 100}%` }} />
    </div>
  );
}

function RaceClock() {
  const t0 = useMini((s) => s.raceT0);
  useTicker(true);
  return <div className="font-mono text-3xl font-bold tabular-nums">{((performance.now() - t0) / 1000).toFixed(2)} s</div>;
}

function CoachBar() {
  const r = useMini((s) => s.coachRound);
  useTicker(!!r && r.done === null);
  if (!r) return null;
  const left = Math.max(0, 1 - (performance.now() - r.t0) / r.ms);
  return (
    <>
      <div className="text-xl font-bold" dir="ltr">
        📣 {r.text}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full ${r.done === null ? 'bg-sky-500' : r.done ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${(r.done === null ? left : 1) * 100}%` }} />
      </div>
      {r.done !== null ? <div className={`mt-1 text-sm font-semibold ${r.done ? 'text-green-700' : 'text-red-600'}`}>{r.done ? '✔' : '✘'}</div> : null}
    </>
  );
}

/** Sports park minigame HUD: hoops meter, race clock, Coach says commands, then the result and today's board. */
export function MinigameHud() {
  const t = useT();
  const game = useMini((s) => s.game);
  const phase = useMini((s) => s.phase);
  const throws = useMini((s) => s.throws);
  const made = useMini((s) => s.made);
  const shot = useMini((s) => s.shot);
  const note = useMini((s) => s.note);
  const raceMs = useMini((s) => s.raceMs);
  const round = useMini((s) => s.round);
  const correct = useMini((s) => s.correct);
  const result = useMini((s) => s.result);
  const board = useMini((s) => s.board);
  const hoopsQ = useMini((s) => s.hoopsQ);
  const pp = useMini((s) => s.pp);
  if (!game) return null;
  const title = game === 'hoops' ? t('Hoops') : game === 'race' ? t('Race') : game === 'pingpong' ? `🏓 ${t('Table tennis · sports hall')}` : t('Coach says');
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 text-center shadow-2xl">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-gray-800">{title}</span>
          <span>
            {game === 'hoops' ? `🏀 ${made} / ${throws} · ${t('{n} left', { n: 10 - throws })}` : game === 'coach' && round ? `${round} / 8 · ✔ ${correct}` : null}
          </span>
          <button type="button" onClick={() => useMini.getState().stop()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
            ✕
          </button>
        </div>
        {phase === 'countdown' ? <div className="py-2 text-lg font-semibold">{game === 'race' ? t('On your marks…') : t('Get ready…')}</div> : null}
        {phase === 'play' && game === 'hoops' && hoopsQ ? (
          <div className="mt-1">
            <p className="text-sm">
              {t('Get the ball! Which picture is')} <b dir="ltr">“{hoopsQ.word}”</b>?
            </p>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {hoopsQ.options.map((o, i) => (
                <button key={o} type="button" onClick={() => useMini.getState().answerHoops(i)} className="min-h-14 rounded-xl border border-orange-200 bg-orange-50 text-3xl">
                  {o}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {phase === 'play' && game === 'pingpong' && pp ? (
          <div className="mt-1">
            <p className="text-3xl font-black tabular-nums">
              {pp.me} <span className="text-gray-400">–</span> {pp.coach}
            </p>
            <p className="text-xs text-gray-500">{t('You – Coach · first to 7 · listen and hit!')}</p>
            <div className="mx-auto mt-2 grid w-48 grid-cols-3 grid-rows-3 gap-1" dir="ltr">
              {(
                [
                  ['long', '⬆️ Long', 'col-start-2 row-start-1'],
                  ['left', '⬅️ Left', 'col-start-1 row-start-2'],
                  ['right', 'Right ➡️', 'col-start-3 row-start-2'],
                  ['short', '⬇️ Short', 'col-start-2 row-start-3'],
                ] as const
              ).map(([k, label, pos]) => (
                <button key={k} type="button" onClick={() => useMini.getState().hitPP(k)} className={`min-h-12 rounded-xl text-xs font-bold ${pos} ${pp.call ? 'bg-sky-500 text-white active:bg-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                  {label}
                </button>
              ))}
              <div className="col-start-2 row-start-2 flex items-center justify-center text-2xl">🏓</div>
            </div>
          </div>
        ) : null}
        {phase === 'play' && game === 'hoops' && !hoopsQ ? (
          <>
            <Meter />
            <button type="button" disabled={!!shot} onClick={() => useMini.getState().throwBall()} className="mt-2 min-h-11 w-full rounded-xl bg-orange-500 text-base font-bold text-white disabled:opacity-50">
              🏀 {t('Throw!')}
            </button>
          </>
        ) : null}
        {phase === 'play' && game === 'race' ? <RaceClock /> : null}
        {phase === 'play' && game === 'coach' ? <CoachBar /> : null}
        {note ? (
          <div className="mt-1 text-sm font-medium" dir="ltr">
            {note}
          </div>
        ) : null}
        {phase === 'done' ? (
          <div className="mt-1 space-y-2">
            <div className="text-lg font-bold">
              {game === 'hoops' ? `🏀 ${made} / 10` : game === 'pingpong' ? `🏓 ${pp?.me ?? 0} – ${pp?.coach ?? 0}` : game === 'race' ? (raceMs ? `⏱️ ${(raceMs / 1000).toFixed(2)} s` : '') : `✔ ${correct} / 8`}
            </div>
            {result ? (
              <div className="text-sm">
                {result.capped ? t('No more rewards for this game today.') : t('+{xp} XP, +{coins} coins', { xp: result.xp, coins: result.coins })}
                {result.record ? ` · 🏆 ${t('New personal best!')}` : ''}
              </div>
            ) : null}
            {board.length ? (
              <ol className="mx-auto max-w-[16rem] text-left text-xs">
                <li className="font-semibold text-gray-600">{t("Today's best")}</li>
                {board.map((b, i) => (
                  <li key={i} className="flex justify-between">
                    <span>
                      {i + 1}. {b.name}
                    </span>
                    <span className="tabular-nums">{game === 'race' ? `${(b.score / 1000).toFixed(2)} s` : b.score}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            <button type="button" onClick={() => useMini.getState().start(game)} className="min-h-10 w-full rounded-xl bg-sky-600 text-sm font-semibold text-white">
              {t('Play again')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
