import { CASTLE_STEPS, ICE_CREAMS, useBeach } from '../store/beach';
import { FINDS } from '../world/sunnyBay';
import { useT } from '../i18n';

/** Sunny Bay: the beach-hunt list, the sandcastle steps, the ice-cream order. */
export function BeachHud() {
  const t = useT();
  const hunt = useBeach((s) => s.hunt);
  const castle = useBeach((s) => s.castle);
  const kiosk = useBeach((s) => s.kiosk);
  const b = useBeach.getState();
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
  const card = 'pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  const head = (title: string, what: 'hunt' | 'castle' | 'kiosk') => (
    <div className="mb-1 flex items-center justify-between text-xs">
      <b className="text-gray-800">{title}</b>
      <button type="button" onClick={() => b.close(what)} className="min-h-8 min-w-8 rounded-full text-base text-gray-500" aria-label={t('Close')}>
        ✕
      </button>
    </div>
  );
  return (
    <>
      {hunt ? (
        <div data-ui className="pointer-events-none absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9.5rem)] z-10 max-w-[60vw]">
          <div className="pointer-events-auto rounded-xl bg-sky-50/95 p-2 text-xs shadow-lg" dir="ltr">
            <div className="flex items-center justify-between gap-2">
              <b>🔎 {t('Beach hunt')}</b>
              {hunt.found.length === hunt.list.length ? (
                <button type="button" onClick={() => b.close('hunt')} className="text-base text-gray-500">
                  ✕
                </button>
              ) : null}
            </div>
            {hunt.list.map((id) => {
              const f = FINDS.find((x) => x.id === id)!;
              const done = hunt.found.includes(id);
              return (
                <div key={id} className={done ? 'text-green-700 line-through' : ''}>
                  {done ? '✅' : '⬜'} {f.icon} {f.en}
                </div>
              );
            })}
            {hunt.result ? <div className="mt-1 font-semibold text-green-700">{hunt.result.capped ? t('No more rewards for this game today.') : `+${hunt.result.xp} XP, +${hunt.result.coins} 🪙`}</div> : null}
          </div>
        </div>
      ) : null}
      {castle ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head(`🏰 ${t('Build a sandcastle')}`, 'castle')}
            <ol className="mb-2 space-y-1 text-sm" dir="ltr">
              {CASTLE_STEPS.slice(0, castle.picked).map((s) => (
                <li key={s} className="rounded-lg bg-green-50 px-2 py-1 text-green-800">
                  ✅ {s}
                </li>
              ))}
            </ol>
            {castle.built ? (
              <p className="text-center text-sm">
                🏰 {t('Your sandcastle is ready!')} {castle.result ? (castle.result.capped ? t('No more rewards for this game today.') : `+${castle.result.xp} XP, +${castle.result.coins} 🪙`) : ''}
              </p>
            ) : (
              <>
                <p className="mb-1 text-xs text-gray-600">{t('What comes next? Tap the steps in order.')}</p>
                <div className="flex flex-col gap-1.5" dir="ltr">
                  {castle.order
                    .filter((s) => !CASTLE_STEPS.slice(0, castle.picked).includes(s))
                    .map((s) => (
                      <button key={s} type="button" onClick={() => b.castleStep(s)} className="min-h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-left text-sm">
                        {s.replace(/^(First|Then|Next|Finally), /, '… ')}
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      {kiosk ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head(`🍦 ${t('Ice cream')}`, 'kiosk')}
            {!kiosk.pick ? (
              <div className="grid grid-cols-3 gap-1.5" dir="ltr">
                {ICE_CREAMS.map((ic) => (
                  <button key={ic.id} type="button" onClick={() => b.pickIce(ic.id)} className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-pink-200 bg-pink-50 text-sm">
                    <span className="text-2xl">{ic.icon}</span>
                    {ic.en}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5" dir="ltr">
                <p className="text-xs text-gray-600">{t('How do you ask for it?')}</p>
                {kiosk.lines.map((l) => (
                  <button key={l} type="button" onClick={() => b.sayLine(l)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${kiosk.miss === l ? 'border-red-400 bg-red-50 line-through' : 'border-gray-200 bg-white'}`}>
                    🗣️ {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
