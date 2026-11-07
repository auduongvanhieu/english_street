import { ANIMALS, FORECAST, HIKES, PACK_ITEMS, needFor, useHill } from '../store/hill';
import { LANDMARKS } from '../world/mapleHill';
import type { MinigameResult } from '../net/api';
import { useT } from '../i18n';

/** Maple Hill: the hike directions, packing the backpack, the animal riddles at the summit. */
export function HillHud() {
  const t = useT();
  const hike = useHill((s) => s.hike);
  const pack = useHill((s) => s.pack);
  const animals = useHill((s) => s.animals);
  const h = useHill.getState();
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
  const card = 'pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  const prize = (r: MinigameResult | null) => (r ? <p className="mt-1 text-center text-sm font-semibold text-green-700">{r.capped ? t('No more rewards for this game today.') : `+${r.xp} XP, +${r.coins} 🪙`}</p> : null);
  const head = (title: string, what: 'hike' | 'pack' | 'animals') => (
    <div className="mb-1 flex items-center justify-between text-xs">
      <b className="text-gray-800">{title}</b>
      <button type="button" onClick={() => h.close(what)} className="min-h-8 min-w-8 rounded-full text-base text-gray-500" aria-label={t('Close')}>
        ✕
      </button>
    </div>
  );
  const route = hike ? HIKES[hike.route]! : null;
  return (
    <>
      {hike && route ? (
        <div data-ui className="pointer-events-none absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9.5rem)] z-10 max-w-[min(20rem,62vw)]">
          <div className="pointer-events-auto rounded-xl bg-orange-50/95 p-2 text-xs shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <b>🥾 {t('Hike: follow the directions')}</b>
              <button type="button" onClick={() => h.close('hike')} className="text-base text-gray-500" aria-label={t('Close')}>
                ✕
              </button>
            </div>
            <p className="my-1 text-sm leading-snug" dir="ltr">
              {route.text}{' '}
              <button type="button" onClick={() => h.sayHike()} className="align-middle text-base" aria-label={t('Listen')}>
                🔊
              </button>
            </p>
            <div className="flex flex-wrap gap-1" dir="ltr">
              {route.stops.map((id, i) => {
                const done = hike.done.includes(id);
                return (
                  <span key={id} className={`rounded-full px-2 py-0.5 ${done ? 'bg-green-100 text-green-800' : 'bg-white text-gray-400'}`}>
                    {done ? `✅ ${LANDMARKS.find((l) => l.id === id)!.en}` : `${i + 1}. …`}
                  </span>
                );
              })}
            </div>
            {hike.wrong.length ? <p className="mt-1 text-red-600">{t('Wrong turns: {n}', { n: hike.wrong.length })}</p> : null}
            {hike.finished ? <p className="mt-1 font-semibold text-green-700">🎉 {t('You made it!')}</p> : <p className="mt-1 text-gray-500">{t('Read the signposts on the way.')}</p>}
            {prize(hike.result)}
          </div>
        </div>
      ) : null}
      {pack ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head(`🎒 ${t('Pack your backpack')}`, 'pack')}
            <p className="mb-1 text-sm" dir="ltr">
              {FORECAST[pack.weather].icon} {FORECAST[pack.weather].text}
            </p>
            <p className="mb-2 text-xs text-gray-600">{t('Pick four things for the hike ({n}/4).', { n: pack.picked.length })}</p>
            <div className="grid grid-cols-3 gap-1.5" dir="ltr">
              {PACK_ITEMS.map((it) => {
                const on = pack.picked.includes(it.id);
                const need = needFor(pack.weather).includes(it.id);
                const tone = !pack.checked ? (on ? 'border-orange-400 bg-orange-100' : 'border-gray-200 bg-white') : need ? 'border-green-400 bg-green-50' : on ? 'border-red-300 bg-red-50 line-through' : 'border-gray-100 bg-gray-50 opacity-50';
                return (
                  <button key={it.id} type="button" onClick={() => h.togglePack(it.id)} className={`flex min-h-14 flex-col items-center justify-center rounded-xl border text-xs ${tone}`}>
                    <span className="text-xl">{it.icon}</span>
                    {it.en}
                  </button>
                );
              })}
            </div>
            {!pack.checked ? (
              <button type="button" disabled={pack.picked.length < 4} onClick={() => h.checkPack()} className="mt-2 min-h-10 w-full rounded-xl bg-orange-600 text-sm font-semibold text-white disabled:opacity-40">
                {t("I'm ready!")}
              </button>
            ) : (
              <p className="mt-2 text-center text-sm">{pack.checked.missing.length ? t('Green = what you need today.') : `✅ ${t('Perfect! You are ready for the hike.')}`}</p>
            )}
            {prize(pack.result)}
          </div>
        </div>
      ) : null}
      {animals ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head(`🔭 ${t('What animal is it?')}`, 'animals')}
            {!animals.done ? (
              <>
                <p className="mb-1 text-xs text-gray-500">
                  {animals.round + 1}/{animals.order.length}
                </p>
                <p className="mb-2 text-sm" dir="ltr">
                  “{ANIMALS[animals.order[animals.round]!]!.riddle}”
                </p>
                <div className="grid grid-cols-2 gap-1.5" dir="ltr">
                  {animals.options.map((i) => (
                    <button key={i} type="button" onClick={() => h.guess(i)} className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border text-sm ${animals.miss === i ? 'border-red-300 bg-red-50 line-through' : 'border-emerald-200 bg-emerald-50'}`}>
                      <span className="text-xl">{ANIMALS[i]!.icon}</span>
                      {ANIMALS[i]!.en}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-sm">
                🦌 {t('Great spotting!')} {animals.score}/{animals.order.length}
              </p>
            )}
            {prize(animals.result)}
          </div>
        </div>
      ) : null}
    </>
  );
}
