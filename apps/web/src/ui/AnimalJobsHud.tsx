import { useEffect, useState } from 'react';
import { BINS, DIET, FOODS, LITTER, TRACTOR_N, meterPos, numWord, useAnimalJobs } from '../store/animalJobs';
import { useT } from '../i18n';

/** Zoo feeding list + food choice; farm milking / egg collecting. */
export function AnimalJobsHud() {
  const t = useT();
  const feed = useAnimalJobs((s) => s.feed);
  const feeding = useAnimalJobs((s) => s.feeding);
  const farm = useAnimalJobs((s) => s.farm);
  const menu = useAnimalJobs((s) => s.menu);
  const throwing = useAnimalJobs((s) => s.throwing);
  const clean = useAnimalJobs((s) => s.clean);
  const tractor = useAnimalJobs((s) => s.tractor);
  const j = useAnimalJobs.getState();
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
  const card = 'pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  const close = (f: () => void) => (
    <button type="button" onClick={f} className="min-h-8 min-w-8 rounded-full text-base text-gray-500" aria-label={t('Close')}>
      ✕
    </button>
  );
  if (menu)
    return (
      <div data-ui className={wrap}>
        <div className={card}>
          <div className="mb-2 flex items-center justify-between text-xs">
            <b className="text-gray-800">🦁 {t('Zoo jobs')}</b>
            {close(() => j.setMenu(false))}
          </div>
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => (j.setMenu(false), j.startFeeding())} className="min-h-12 rounded-xl border border-green-200 bg-green-50 px-3 text-left text-sm">
              🪣 <b>{t('Feeding time')}</b> · {t('choose the food, throw it over the fence')}
            </button>
            <button type="button" onClick={() => j.startClean()} className="min-h-12 rounded-xl border border-sky-200 bg-sky-50 px-3 text-left text-sm">
              🧹 <b>{t('Clean up the zoo')}</b> · {t('put the rubbish in the right bin')}
            </button>
          </div>
        </div>
      </div>
    );
  if (throwing) return <ThrowCard item={throwing.item} note={throwing.note} wrap={wrap} card={card} />;
  if (clean) {
    const it = clean.i < clean.items.length ? LITTER.find((x) => x.id === clean.items[clean.i])! : null;
    return (
      <div data-ui className={wrap}>
        <div className={card}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <b className="text-gray-800">
              🧹 {t('Clean up the zoo')} · {Math.min(clean.i + 1, clean.items.length)}/{clean.items.length}
            </b>
            {close(() => j.closeJob('clean'))}
          </div>
          {it ? (
            <>
              <p className="my-1 text-center" dir="ltr">
                <span className="text-4xl">{it.icon}</span>
                <br />
                <b>{it.en}</b> — {t('which bin?')}
              </p>
              <div className="grid grid-cols-3 gap-1.5" dir="ltr">
                {(Object.keys(BINS) as (keyof typeof BINS)[]).map((b) => (
                  <button key={b} type="button" onClick={() => j.sortLitter(b)} className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white text-xs font-semibold">
                    <span className="text-2xl">{BINS[b].icon}</span>
                    {b}
                  </button>
                ))}
              </div>
              {clean.note ? <p className="mt-1 text-center text-sm text-red-600" dir="ltr">{clean.note}</p> : null}
            </>
          ) : (
            <p className="text-center text-sm">
              ✅ {clean.score}/{clean.items.length} {clean.result ? (clean.result.capped ? t('No more rewards for this game today.') : `· +${clean.result.xp} XP, +${clean.result.coins} 🪙`) : ''}
            </p>
          )}
        </div>
      </div>
    );
  }
  if (tractor) {
    const r = tractor.r;
    const arrow = ['⬆️', '➡️', '⬇️', '⬅️'][r.dir];
    return (
      <div data-ui className={wrap}>
        <div className={card}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <b className="text-gray-800">
              🚜 {t('Drive the tractor')} · {t('Round {n} of {total}', { n: tractor.round, total: 3 })}
            </b>
            {close(() => j.closeJob('tractor'))}
          </div>
          <div className="mx-auto mb-2 grid w-56 gap-0.5" style={{ gridTemplateColumns: `repeat(${TRACTOR_N}, 1fr)` }} dir="ltr">
            {Array.from({ length: TRACTOR_N * TRACTOR_N }, (_, i) => {
              const x = i % TRACTOR_N;
              const z = Math.floor(i / TRACTOR_N);
              const here = r.pos[0] === x && r.pos[1] === z;
              const goal = r.goal[0] === x && r.goal[1] === z;
              const block = r.blocks.findIndex(([bx, bz]) => bx === x && bz === z);
              return (
                <div key={i} className={`flex aspect-square items-center justify-center rounded text-xl ${block >= 0 ? 'bg-amber-200' : 'bg-lime-200'}`}>
                  {here ? <span className="relative">🚜<span className="absolute -right-2 -top-2 text-xs">{arrow}</span></span> : goal ? '🏠' : block >= 0 ? (block % 2 ? '🪨' : '🥕') : ''}
                </div>
              );
            })}
          </div>
          {tractor.done ? (
            <p className="text-center text-sm">
              ✅ {tractor.score}/3 {t('perfect drives')} {tractor.result ? (tractor.result.capped ? t('No more rewards for this game today.') : `· +${tractor.result.xp} XP, +${tractor.result.coins} 🪙`) : ''}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5" dir="ltr">
                <button type="button" onClick={() => j.drive('left')} className="min-h-12 rounded-xl bg-gray-100 text-sm font-semibold">
                  ↰ Turn left
                </button>
                <button type="button" onClick={() => j.drive('forward')} className="min-h-12 rounded-xl bg-green-600 text-sm font-semibold text-white">
                  ⬆ Go forward
                </button>
                <button type="button" onClick={() => j.drive('right')} className="min-h-12 rounded-xl bg-gray-100 text-sm font-semibold">
                  Turn right ↱
                </button>
              </div>
              <p className="mt-1 text-center text-xs text-gray-500">
                {tractor.note || t('Moves: {n} · the best way: {best}', { n: r.moves, best: r.best })}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }
  if (farm) {
    const done = farm.step === 'done';
    return (
      <div data-ui className={wrap}>
        <div className={card}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <b className="text-gray-800">{farm.job === 'milk' ? `🐄 ${t('Milk the cow')}` : `🐔 ${t('Collect the eggs')}`}</b>
            {close(() => j.closeFarm())}
          </div>
          {farm.step === 'play' && farm.job === 'milk' ? (
            <>
              <p className="mb-1 text-center text-lg font-bold" dir="ltr">
                {farm.next === 'L' ? '👈 Left!' : 'Right! 👉'}
              </p>
              <div className="mb-2 h-3 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-sky-400 transition-all" style={{ width: `${(farm.taps / 12) * 100}%` }} />
              </div>
              <div className="flex gap-2" dir="ltr">
                <button type="button" onPointerDown={() => j.squeeze('L')} className={`min-h-16 flex-1 rounded-2xl text-lg font-bold ${farm.next === 'L' ? 'bg-amber-400' : 'bg-gray-100'}`}>
                  ✋ Left
                </button>
                <button type="button" onPointerDown={() => j.squeeze('R')} className={`min-h-16 flex-1 rounded-2xl text-lg font-bold ${farm.next === 'R' ? 'bg-amber-400' : 'bg-gray-100'}`}>
                  Right 🤚
                </button>
              </div>
            </>
          ) : farm.step === 'play' && farm.eggs ? (
            <>
              <p className="mb-2 text-sm">{t('Tap the eggs to put them in your basket.')} 🧺 {farm.amount}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {farm.eggs.map((n, i) => (
                  <button key={i} type="button" onClick={() => j.takeEgg(i)} className="flex min-h-16 flex-col items-center justify-center rounded-xl bg-amber-100 text-lg leading-5" aria-label={`nest ${i + 1}`}>
                    <span>{n ? '🥚'.repeat(n) : '·'}</span>
                    <span className="text-xs">🪺</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mb-1 text-center text-3xl">{farm.job === 'milk' ? '🪣🥛' : `🧺 ${'🥚'.repeat(Math.min(farm.amount, 12))}`}</p>
              <p className="mb-2 text-sm font-semibold" dir="ltr">
                {farm.job === 'milk' ? `“How much milk is there?” (the bucket shows ${farm.amount} L)` : '“How many eggs did you collect?”'}
              </p>
              <div className="flex flex-col gap-1.5" dir="ltr">
                {farm.options.map((n) => {
                  const cls = !done ? 'border-amber-200 bg-amber-50' : n === farm.amount ? 'border-green-500 bg-green-100' : 'border-gray-200 bg-gray-50 opacity-60';
                  return (
                    <button key={n} type="button" disabled={done} onClick={() => j.answer(n)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${cls}`}>
                      🗣️ {numWord(n)} {farm.job === 'milk' ? (n === 1 ? 'litre of milk' : 'litres of milk') : n === 1 ? 'egg' : 'eggs'}
                    </button>
                  );
                })}
              </div>
              {done ? <p className="mt-2 text-center text-sm">{farm.right ? '✅' : '✘'} {farm.result ? (farm.result.capped ? t('No more rewards for this game today.') : `+${farm.result.xp} XP, +${farm.result.coins} 🪙`) : ''}</p> : null}
            </>
          )}
        </div>
      </div>
    );
  }
  if (feeding)
    return (
      <div data-ui className={wrap}>
        <div className={card}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <b className="text-gray-800">🪣 {t('Feeding time')}</b>
            {close(() => j.closeFeeding())}
          </div>
          <p className="mb-2 font-semibold" dir="ltr">
            What do {feeding.item}s eat?
          </p>
          <div className="grid grid-cols-3 gap-1.5" dir="ltr">
            {feeding.options.map((f) => (
              <button key={f} type="button" onClick={() => j.give(f)} className={`flex min-h-16 flex-col items-center justify-center rounded-xl border text-sm ${feeding.miss === f ? 'border-red-400 bg-red-50 line-through' : 'border-green-200 bg-green-50'}`}>
                <span className="text-2xl">{FOODS[f]!.icon}</span>
                {FOODS[f]!.en}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  if (feed) {
    const all = Object.keys(feed.done).length === feed.targets.length;
    return (
      <div data-ui className="pointer-events-none absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9.5rem)] z-10 max-w-[60vw]">
        <div className="pointer-events-auto rounded-xl bg-yellow-50/95 p-2 text-xs shadow-lg" dir="ltr">
          <div className="flex items-center justify-between gap-2">
            <b>🪣 {t('Feeding time')}</b>
            {all ? close(() => useAnimalJobs.setState({ feed: null })) : null}
          </div>
          {feed.targets.map((it) => (
            <div key={it} className={it in feed.done ? 'text-green-700 line-through' : ''}>
              {it in feed.done ? (feed.done[it] ? '✅' : '☑️') : '⬜'} the {it} {it in feed.done ? `· ${DIET[it]!.say}` : ''}
            </div>
          ))}
          {all ? <div className="mt-1 font-semibold text-green-700">{feed.result ? (feed.result.capped ? t('No more rewards for this game today.') : `+${feed.result.xp} XP, +${feed.result.coins} 🪙`) : '…'}</div> : <div className="mt-1 text-gray-500">{t('Walk to each enclosure and press E / the button.')}</div>}
        </div>
      </div>
    );
  }
  return null;
}

/** Throw the food over the fence: a meter goes up and down, throw when it is in the green. */
function ThrowCard({ item, note, wrap, card }: { item: string; note: string; wrap: string; card: string }) {
  const t = useT();
  const t0 = useAnimalJobs((s) => s.throwing?.t0 ?? 0);
  const [, tick] = useState(0);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      tick((n) => n + 1);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  const m = meterPos(t0);
  const food = FOODS[DIET[item]!.food]!;
  return (
    <div data-ui className={wrap}>
      <div className={card}>
        <p className="mb-1 text-center text-sm font-semibold" dir="ltr">
          {food.icon} {t('Throw the {food} to the {animal}!', { food: food.en, animal: item })}
        </p>
        <div className="relative mx-auto h-4 w-full overflow-hidden rounded-full bg-gray-200">
          <div className="absolute inset-y-0 left-[37%] w-[26%] bg-green-300" />
          <div className="absolute inset-y-0 w-1.5 rounded bg-slate-800" style={{ left: `${m * 100}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px] text-gray-500" dir="ltr">
          <span>too short</span>
          <span>too far</span>
        </div>
        <button type="button" onClick={() => useAnimalJobs.getState().throwFood()} className="mt-2 min-h-11 w-full rounded-xl bg-orange-500 text-base font-bold text-white">
          🤾 {t('Throw!')}
        </button>
        {note ? <p className="mt-1 text-center text-sm text-red-600" dir="ltr">{note}</p> : null}
      </div>
    </div>
  );
}
