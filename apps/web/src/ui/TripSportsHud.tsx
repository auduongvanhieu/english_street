import { useEffect, useState } from 'react';
import { SURF_CALLS, VOLLEY_MOVES, useBeachSports } from '../store/beachSports';
import { useTripRides, type RideQ } from '../store/tripRides';
import { serverNow } from '../net/client';
import { cabinAt } from '../world/mapleHill';
import type { MinigameResult } from '../net/api';
import { useT } from '../i18n';

/**
 * Cards for the trip activities: beach volleyball and the surf lesson (Sunny Bay), the cable car (Maple Hill) and the
 * boat trip (Riverside). The logic is in store/beachSports.ts and store/tripRides.ts.
 */
const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
const card = 'pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl';

function Head({ title, onClose }: { title: string; onClose: () => void }) {
  const t = useT();
  return (
    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
      <span className="font-semibold text-gray-800">{title}</span>
      <button type="button" onClick={onClose} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
        ✕
      </button>
    </div>
  );
}

/** Seconds left on a timed call (re-renders 4x a second). */
function useLeft(until: number) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [until]);
  return Math.max(0, (until - Date.now()) / 1000);
}

function Reward({ r }: { r: MinigameResult | null }) {
  const t = useT();
  if (!r) return null;
  return <p className="mt-1 text-center text-sm text-emerald-700">{r.capped ? t('No more rewards for this game today.') : `+${r.xp} XP, +${r.coins} 🪙`}</p>;
}

function Questions({ qs, picked, onPick }: { qs: RideQ[]; picked: (number | null)[]; onPick: (i: number, k: number) => void }) {
  return (
    <div dir="ltr">
      {qs.map((q, i) => (
        <div key={q.q} className="mb-2">
          <p className="text-sm font-semibold">
            {i + 1}. {q.q}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {q.options.map((o, k) => {
              const p = picked[i];
              const shown = p !== null && p !== undefined;
              const cls = !shown ? 'border-sky-200 bg-sky-50' : k === q.answer ? 'border-green-500 bg-green-100' : k === p ? 'border-red-400 bg-red-100' : 'border-gray-200 bg-gray-50 opacity-60';
              return (
                <button key={o} type="button" disabled={shown} onClick={() => onPick(i, k)} className={`min-h-9 rounded-lg border px-2 text-sm ${cls}`}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function VolleyCard() {
  const t = useT();
  const v = useBeachSports((s) => s.volley);
  const left = useLeft(v?.call ? v.until : 0);
  if (!v) return null;
  const st = useBeachSports.getState();
  return (
    <div data-ui className={wrap}>
      <div className={card} data-testid="volley">
        <Head title={`🏐 ${t('Beach volleyball')}`} onClose={() => st.closeVolley()} />
        <div className="mb-2 flex items-center justify-center gap-3 font-mono text-2xl font-bold" dir="ltr">
          <span className="text-blue-700">US {v.ours}</span>
          <span className="text-gray-400">:</span>
          <span className="text-red-600">{v.theirs} THEM</span>
        </div>
        {v.done ? (
          <>
            <p className="text-center font-semibold">{v.ours > v.theirs ? `🏆 ${t('You won!')}` : t('Good game!')}</p>
            <Reward r={v.result} />
            <button type="button" onClick={() => st.startVolley()} className="mt-2 min-h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white">
              {t('Play again')}
            </button>
          </>
        ) : (
          <>
            <p className="min-h-10 text-center text-sm" dir="ltr">
              {v.call ? (
                <>
                  🗣️ <b>“{v.text}”</b> <span className="text-xs text-gray-400">{Math.ceil(left)}s</span>
                </>
              ) : v.last ? (
                <span className={v.last.ok ? 'text-green-700' : 'text-red-600'}>{v.last.ok ? `✅ ${t('Our point!')}` : `❌ ${t('Their point. The right move was: {m}', { m: VOLLEY_MOVES.find((m) => m.id === v.last!.move)!.en })}`}</span>
              ) : (
                t('Listen to your teammate…')
              )}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-1.5" dir="ltr">
              {VOLLEY_MOVES.map((m) => (
                <button key={m.id} type="button" disabled={!v.call} onClick={() => st.pickVolley(m.id)} className="min-h-14 rounded-xl border-2 border-sky-200 bg-sky-50 px-2 text-left disabled:opacity-50">
                  <span className="text-xl">{m.icon}</span> <b>{m.en}</b>
                  <span className="block text-[11px] text-gray-500">{m.how}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SurfCard() {
  const t = useT();
  const s = useBeachSports((x) => x.surf);
  const left = useLeft(s?.call ? s.until : 0);
  if (!s) return null;
  const st = useBeachSports.getState();
  return (
    <div data-ui className={wrap}>
      <div className={card} data-testid="surf">
        <Head title={`🏄 ${t('Surf lesson')} · Jack`} onClose={() => st.closeSurf()} />
        {s.stage === 'rent' ? (
          <>
            <p className="text-sm font-semibold" dir="ltr">
              🗣️ “G'day! How can I help you?”
            </p>
            <p className="mb-1 text-xs text-gray-600">{t('Ask to rent a surfboard:')}</p>
            <div className="flex flex-col gap-1" dir="ltr">
              {s.lines.map((l) => (
                <button key={l} type="button" onClick={() => st.sayRent(l)} className={`min-h-10 rounded-xl border px-2 text-left text-sm ${s.miss === l ? 'border-red-400 bg-red-50 line-through' : 'border-gray-200 bg-white'}`}>
                  🗣️ {l}
                </button>
              ))}
            </div>
            {s.miss ? <p className="mt-1 text-sm text-red-600">{t('Not quite right. Try another one.')}</p> : null}
          </>
        ) : s.stage === 'ride' ? (
          <>
            <p className="min-h-10 text-center text-sm" dir="ltr">
              {s.call ? (
                <>
                  🗣️ <b>“{s.call.say}”</b> <span className="text-xs text-gray-400">{Math.ceil(left)}s</span>
                </>
              ) : s.last ? (
                <span className={s.last.ok ? 'text-green-700' : 'text-red-600'}>{s.last.ok ? '✅ ' + t('Well done!') : `❌ ${SURF_CALLS.find((c) => c.id === s.last!.id)?.en}`}</span>
              ) : (
                t('Listen to Jack…')
              )}
            </p>
            <div className="mt-1 grid grid-cols-3 gap-1.5" dir="ltr">
              {SURF_CALLS.map((c) => (
                <button key={c.id} type="button" disabled={!s.call} onClick={() => st.pickSurf(c.id)} className="min-h-14 rounded-xl border-2 border-cyan-200 bg-cyan-50 px-1 text-xs font-semibold disabled:opacity-50">
                  <span className="block text-xl">{c.icon}</span>
                  {c.en}
                </button>
              ))}
            </div>
            <p className="mt-1 text-center text-xs text-gray-500">
              {t('Wave {n} of {total}', { n: Math.min(s.step + 1, 6), total: 6 })} · ✅ {s.ok}
            </p>
          </>
        ) : (
          <>
            <p className="text-center font-semibold">🏄 {t('{ok} of {total} right', { ok: s.ok, total: 6 })}</p>
            <Reward r={s.result} />
          </>
        )}
      </div>
    </div>
  );
}

function CableCard() {
  const t = useT();
  const c = useTripRides((s) => s.cable);
  const [, tick] = useState(0);
  useEffect(() => {
    if (c?.stage !== 'wait') return;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [c?.stage]);
  if (!c) return null;
  const st = useTripRides.getState();
  // seconds until a cabin is at this station
  let wait = 0;
  if (c.stage === 'wait') {
    const now = serverNow();
    for (let s = 0; s < 120; s++) {
      if ([0, 1].some((k) => cabinAt(k, now + s * 1000).at === c.from)) break;
      wait = s + 1;
    }
  }
  return (
    <div data-ui className={wrap}>
      <div className={card} data-testid="cablecar">
        <Head title={`🚡 ${t('Cable car')}`} onClose={() => st.closeCable()} />
        {c.stage === 'ticket' ? (
          <>
            <p className="mb-1 text-xs text-gray-600">{t('Buy a ticket. What do you say?')}</p>
            <div className="flex flex-col gap-1" dir="ltr">
              {c.lines.map((l) => (
                <button key={l} type="button" onClick={() => st.sayTicket(l)} className={`min-h-10 rounded-xl border px-2 text-left text-sm ${c.miss === l ? 'border-red-400 bg-red-50 line-through' : 'border-gray-200 bg-white'}`}>
                  🗣️ {l}
                </button>
              ))}
            </div>
            {c.miss ? <p className="mt-1 text-sm text-red-600">{t('Not quite right. Try another one.')}</p> : null}
          </>
        ) : c.stage === 'wait' ? (
          <p className="text-sm">⏳ {wait ? t('The next cabin arrives in {s} seconds.', { s: wait }) : t('The cabin is here. Getting in…')}</p>
        ) : c.stage === 'ride' ? (
          <p className="text-sm">{c.from === 'bottom' ? t('Going up to the summit. Listen to the guide!') : t('Going down to the meadow. Listen to the guide!')}</p>
        ) : c.quiz ? (
          <>
            <p className="mb-1 text-xs text-gray-600">{t('What did the guide say?')}</p>
            <Questions qs={c.quiz.qs} picked={c.quiz.picked} onPick={st.answerCable} />
            <Reward r={c.quiz.result} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function BoatCard() {
  const t = useT();
  const b = useTripRides((s) => s.boat);
  if (!b) return null;
  const st = useTripRides.getState();
  return (
    <div data-ui className={wrap}>
      <div className={card} data-testid="boattrip">
        <Head title={`🚣 ${t('Boat trip')} · Sam`} onClose={() => st.closeBoat()} />
        {b.stage === 'ride' ? (
          <p className="text-sm">{t('Sit back and listen to Sam: under, past, along, around…')}</p>
        ) : b.quiz ? (
          <>
            <Questions qs={b.quiz.qs} picked={b.quiz.picked} onPick={st.answerBoat} />
            <Reward r={b.quiz.result} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function TripSportsHud() {
  return (
    <>
      <VolleyCard />
      <SurfCard />
      <CableCard />
      <BoatCard />
    </>
  );
}
