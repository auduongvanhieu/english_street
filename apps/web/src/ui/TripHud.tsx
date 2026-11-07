import { LOST_THINGS, PRODUCTS, phrase, unitChoices, useRiverside } from '../store/riverside';
import { timeSentence, useOldTown } from '../store/oldTown';
import { SPOTS, STALLS } from '../world/riverside';
import { EXHIBITS } from '../world/oldTown';
import type { MinigameResult } from '../net/api';
import { useT } from '../i18n';

/** Riverside (market list, a stall, Lily's lost things) and Old Town (the clock quiz, the museum) cards. */
export function TripHud() {
  const t = useT();
  const list = useRiverside((s) => s.list);
  const stall = useRiverside((s) => s.stall);
  const last = useRiverside((s) => s.last);
  const lost = useRiverside((s) => s.lost);
  const clock = useOldTown((s) => s.clock);
  const museum = useOldTown((s) => s.museum);
  const r = useRiverside.getState();
  const o = useOldTown.getState();
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
  const card = 'pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  const side = 'pointer-events-none absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9.5rem)] z-10 max-w-[min(18rem,62vw)]';
  const prize = (res: MinigameResult | null) => (res ? <p className="mt-1 text-center text-sm font-semibold text-green-700">{res.capped ? t('No more rewards for this game today.') : `+${res.xp} XP, +${res.coins} 🪙`}</p> : null);
  const head = (title: string, onClose: () => void) => (
    <div className="mb-1 flex items-center justify-between text-xs">
      <b className="text-gray-800">{title}</b>
      <button type="button" onClick={onClose} className="min-h-8 min-w-8 rounded-full text-base text-gray-500" aria-label={t('Close')}>
        ✕
      </button>
    </div>
  );
  const st = stall ? STALLS.find((s) => s.id === stall) : null;
  const ex = museum?.open ? EXHIBITS.find((e) => e.id === museum.open) : null;
  return (
    <>
      {/* side cards: the shopping list, Lily's request */}
      {list || lost ? (
        <div data-ui className={side}>
          {list ? (
            <div className="pointer-events-auto mb-2 rounded-xl bg-amber-50/95 p-2 text-xs shadow-lg" dir="ltr">
              <div className="flex items-center justify-between gap-2">
                <b>📝 {t('Shopping list')}</b>
                <button type="button" onClick={() => r.close('list')} className="text-base text-gray-500" aria-label={t('Close')}>
                  ✕
                </button>
              </div>
              {list.items.map((id) => {
                const p = PRODUCTS.find((x) => x.id === id)!;
                const done = list.bought.includes(id);
                return (
                  <div key={id} className={done ? 'text-green-700 line-through' : ''}>
                    {done ? '✅' : '⬜'} {p.icon} {phrase(p)}
                  </div>
                );
              })}
              {prize(list.result)}
            </div>
          ) : null}
          {lost ? (
            <div className="pointer-events-auto rounded-xl bg-sky-50/95 p-2 text-xs shadow-lg" dir="ltr">
              <div className="flex items-center justify-between gap-2">
                <b>🧒 {t('Help Lily')}</b>
                <button type="button" onClick={() => r.close('lost')} className="text-base text-gray-500" aria-label={t('Close')}>
                  ✕
                </button>
              </div>
              {lost.done ? (
                <p className="mt-1 font-semibold text-green-700">🎉 {t('You found everything!')}</p>
              ) : (
                <p className="my-1 text-sm leading-snug">
                  “I can't find {LOST_THINGS[lost.order[lost.round]!.thing]!.en} {LOST_THINGS[lost.order[lost.round]!.thing]!.icon}. I think it's <b>{SPOTS.find((s) => s.id === lost.order[lost.round]!.spot)!.en}</b>.”{' '}
                  <button type="button" onClick={() => r.sayLost()} className="align-middle text-base" aria-label={t('Listen')}>
                    🔊
                  </button>
                </p>
              )}
              <div className="text-gray-500">
                {Math.min(lost.round, lost.order.length)}/{lost.order.length} · {t('Wrong places: {n}', { n: lost.mistakes })}
              </div>
              {prize(lost.result)}
            </div>
          ) : null}
        </div>
      ) : null}

      {st ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head(`🛒 ${st.name}`, () => r.close('stall'))}
            <p className="mb-2 text-xs text-gray-600">{t('Choose the right word to ask for each thing.')}</p>
            <div className="flex flex-col gap-1.5" dir="ltr">
              {PRODUCTS.filter((p) => p.stall === st.id).map((p) => {
                const onList = !!list?.items.includes(p.id);
                const bought = !!list?.bought.includes(p.id);
                return (
                  <div key={p.id} className={`rounded-xl border p-1.5 ${onList ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
                    <div className="mb-1 text-sm">
                      {p.icon} a … of {p.noun} {bought ? '✅' : onList ? '📝' : ''}
                    </div>
                    <div className="flex gap-1">
                      {unitChoices(p).map((u) => {
                        const wrong = last && last.id === p.id && !last.ok && last.unit === u;
                        return (
                          <button key={u} type="button" disabled={bought} onClick={() => r.buy(p.id, u)} className={`min-h-9 flex-1 rounded-lg border text-sm ${wrong ? 'border-red-300 bg-red-50 line-through' : 'border-gray-200 bg-white'} disabled:opacity-50`}>
                            {u}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {last ? <p className={`mt-2 text-center text-sm ${last.ok ? 'text-green-700' : 'text-red-600'}`}>{last.note}</p> : null}
          </div>
        </div>
      ) : null}

      {clock ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head(`🕰️ ${t('What time is it?')}`, () => o.close('clock'))}
            {!clock.done ? (
              <>
                <div className="mb-2 flex items-center justify-center gap-3">
                  <Clock h={clock.h} m={clock.m} />
                  <p className="text-xs text-gray-500">
                    {clock.round + 1}/5
                    <br />
                    {t('Look at the clock tower too!')}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-1.5" dir="ltr">
                  {clock.options.map((s) => (
                    <button key={s} type="button" onClick={() => o.answerClock(s)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${clock.miss.includes(s) ? 'border-red-300 bg-red-50 line-through' : 'border-indigo-200 bg-indigo-50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-sm">
                ✅ {t('Well done!')} {clock.score}/5 · {timeSentence(clock.h, clock.m)}
              </p>
            )}
            {prize(clock.result)}
          </div>
        </div>
      ) : null}

      {museum && ex ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head(`🏛️ ${ex.title}`, () => o.close('exhibit'))}
            <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm leading-snug" dir="ltr">
              {ex.plaque}
            </p>
            <p className="mb-1 text-sm font-semibold" dir="ltr">
              🎩 {ex.q}
            </p>
            <div className="flex flex-col gap-1.5" dir="ltr">
              {(museum.order[ex.id] ?? ex.answers).map((a) => {
                const answered = museum.answered[ex.id] !== undefined;
                const tone = !answered ? 'border-gray-200 bg-white' : a === ex.answers[0] ? 'border-green-400 bg-green-50' : a === museum.pick ? 'border-red-300 bg-red-50 line-through' : 'border-gray-100 opacity-60';
                return (
                  <button key={a} type="button" disabled={answered} onClick={() => o.answerExhibit(a)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${tone}`}>
                    {a}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">{t('Exhibits seen: {n}/{total}', { n: Object.keys(museum.answered).length, total: EXHIBITS.length })}</p>
            {prize(museum.result)}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** A small analogue clock. */
function Clock({ h, m }: { h: number; m: number }) {
  const ha = (((h % 12) + m / 60) / 12) * 360;
  const ma = (m / 60) * 360;
  return (
    <svg viewBox="-50 -50 100 100" className="h-24 w-24">
      <circle r="47" fill="#fffdf6" stroke="#c0a062" strokeWidth="4" />
      {Array.from({ length: 12 }, (_, k) => (
        <line key={k} x1="0" y1="-40" x2="0" y2={k % 3 === 0 ? -32 : -36} stroke="#2a2230" strokeWidth={k % 3 === 0 ? 3 : 1.5} transform={`rotate(${k * 30})`} />
      ))}
      <line x1="0" y1="4" x2="0" y2="-22" stroke="#2a2230" strokeWidth="5" strokeLinecap="round" transform={`rotate(${ha})`} />
      <line x1="0" y1="5" x2="0" y2="-34" stroke="#2a2230" strokeWidth="3" strokeLinecap="round" transform={`rotate(${ma})`} />
      <circle r="3" fill="#2a2230" />
    </svg>
  );
}
