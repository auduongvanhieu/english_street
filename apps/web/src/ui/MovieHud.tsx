import { SNACKS, useMovie } from '../store/movie';
import { money } from '../store/restaurant';
import { useT } from '../i18n';

/**
 * Star Cinema overlays: subtitles while you watch in Screen 1, the questions + vote after the film, and the snack
 * bar order card.
 */
export function MovieHud() {
  const t = useT();
  const sub = useMovie((s) => s.sub);
  const inRoom = useMovie((s) => s.inRoom);
  const voice = useMovie((s) => s.voice);
  const after = useMovie((s) => s.after);
  const snackOpen = useMovie((s) => s.snackOpen);
  const snackItem = useMovie((s) => s.snackItem);
  const snackLines = useMovie((s) => s.snackLines);
  const snackNote = useMovie((s) => s.snackNote);
  const m = useMovie.getState();
  return (
    <>
      {inRoom && !after ? (
        <div data-ui className="pointer-events-none absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+11rem)] left-1/2 z-20 w-[92vw] max-w-xl -translate-x-1/2 text-center">
          {sub ? (
            <p className="inline-block rounded-lg bg-black/75 px-3 py-1.5 text-lg font-semibold text-yellow-100" dir="ltr">
              {sub}
            </p>
          ) : null}
          <div className="mt-1">
            <button type="button" onClick={() => m.setVoice(!voice)} className="pointer-events-auto rounded-full bg-black/50 px-3 py-1 text-xs text-white">
              {voice ? '🔊' : '🔇'} {t('Read the subtitles aloud')}
            </button>
          </div>
        </div>
      ) : null}

      {after ? (
        <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2">
          <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold text-gray-800">🎬 {t('After the film')}</span>
              <button type="button" onClick={() => m.closeAfter()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
                ✕
              </button>
            </div>
            {after.qs.map((q, i) => (
              <div key={q.q} className="mb-2" dir="ltr">
                <p className="text-sm font-semibold">
                  {i + 1}. {q.q}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {q.options.map((o, k) => {
                    const picked = after.picked[i];
                    const show = picked !== null;
                    const cls = !show ? 'bg-violet-50 border-violet-200' : k === q.answer ? 'bg-green-100 border-green-500' : k === picked ? 'bg-red-100 border-red-400' : 'bg-gray-50 border-gray-200 opacity-60';
                    return (
                      <button key={o} type="button" disabled={show} onClick={() => m.answer(i, k)} className={`min-h-9 rounded-lg border px-2 text-sm ${cls}`}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {after.done ? (
              <div className="border-t pt-2 text-center">
                <p className="text-sm">
                  {t('{score} / {total} right', { score: after.picked.filter((p, j) => p === after.qs[j]!.answer).length, total: after.qs.length })}
                  {after.result ? (after.result.capped ? ` · ${t('No more rewards for this game today.')}` : ` · +${after.result.xp} XP, +${after.result.coins} 🪙`) : ''}
                </p>
                <p className="mt-2 text-sm font-semibold" dir="ltr">
                  “Did you like it?”
                </p>
                {after.vote ? (
                  <p className="text-sm text-violet-700">{t('Thanks for your vote!')}</p>
                ) : (
                  <div className="mt-1 flex gap-1.5" dir="ltr">
                    <button type="button" onClick={() => m.vote(1)} className="min-h-10 flex-1 rounded-xl bg-violet-600 text-sm font-semibold text-white">
                      👍 “Yes, I loved it!”
                    </button>
                    <button type="button" onClick={() => m.vote(-1)} className="min-h-10 flex-1 rounded-xl bg-gray-200 text-sm font-semibold">
                      👎 “Not really.”
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {snackOpen ? (
        <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2">
          <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold text-gray-800">🍿 {t('Snack bar')}</span>
              <button type="button" onClick={() => m.closeSnacks()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
                ✕
              </button>
            </div>
            {!snackItem ? (
              <>
                <p className="mb-1 text-sm font-semibold" dir="ltr">
                  🗣️ “Hi there! What can I get you?”
                </p>
                <div className="grid grid-cols-2 gap-1.5" dir="ltr">
                  {SNACKS.map((s) => (
                    <button key={s.id} type="button" onClick={() => m.chooseSnack(s)} className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-2 text-sm">
                      {s.icon} {s.name} <b>{money(s.price)}</b>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div dir="ltr">
                <p className="text-sm">
                  {snackItem.icon} <b>{snackItem.name}</b> — {t('How do you ask for it?')}
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  {snackLines.map((l) => (
                    <button key={l} type="button" onClick={() => m.sayLine(l)} className={`min-h-10 rounded-xl border px-2 text-left text-sm ${snackNote === l ? 'border-red-400 bg-red-50 line-through' : 'border-gray-200 bg-white'}`}>
                      🗣️ {l}
                    </button>
                  ))}
                </div>
                {snackNote ? <p className="mt-1 text-sm text-red-600">{t('Not quite right. Try another one.')}</p> : null}
                <button type="button" onClick={() => m.chooseSnack(null)} className="mt-2 text-xs text-gray-500 underline">
                  ← {t('Back')}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
