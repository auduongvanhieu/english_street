import { useClassroom } from '../store/classroom';
import { nextLesson } from '../world/lessons';
import { useVoice } from '../store/voice';
import { useT } from '../i18n';

/** Maple School class: the slide caption, the quiz (put up your hand, then answer), and the result after class. */
export function ClassHud() {
  const t = useT();
  const inRoom = useClassroom((s) => s.inRoom);
  const p = useClassroom((s) => s.phase);
  const hand = useClassroom((s) => s.hand);
  const answers = useClassroom((s) => s.answers);
  const result = useClassroom((s) => s.result);
  const c = useClassroom.getState();
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2';
  const card = 'pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  if (result)
    return (
      <div data-ui className={wrap}>
        <div className={`${card} text-center`}>
          <div className="text-3xl">{result.correct === result.total ? '🏆' : '📒'}</div>
          <p className="font-semibold">{t('Class is over: {score} / {total} right', { score: result.correct, total: result.total })}</p>
          {result.reward ? <p className="text-sm text-emerald-700">{result.reward.capped ? t('No more rewards for this game today.') : `+${result.reward.xp} XP, +${result.reward.coins} 🪙`}</p> : null}
          <button type="button" onClick={() => c.closeResult()} className="mt-2 min-h-10 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white">
            {t('Done')}
          </button>
        </div>
      </div>
    );
  if (!inRoom || !p) return null;
  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  if (p.phase === 'slide') {
    const sl = p.lesson.slides[p.slide]!;
    return (
      <div data-ui className="pointer-events-none absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+11rem)] left-1/2 z-20 w-[92vw] max-w-md -translate-x-1/2 text-center">
        <button type="button" onClick={() => useVoice.getState().speakAs('teacher', `${sl.word}. ${sl.say}`, 'en-GB')} className="pointer-events-auto inline-block rounded-xl bg-[#2f6b4f]/95 px-3 py-2 text-left text-white shadow-lg" dir="ltr">
          <span className="text-2xl">{sl.pic}</span> <b className="text-lg text-yellow-200">{sl.word}</b>
          <span className="block text-sm">🔊 {sl.say}</span>
        </button>
      </div>
    );
  }
  if (p.phase === 'quiz') {
    const q = p.lesson.quiz[p.q]!;
    const mine = answers[p.q];
    return (
      <div data-ui className={wrap}>
        <div className={card} dir="ltr">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>
              🏫 {p.lesson.title} · {t('Question {n} of {total}', { n: p.q + 1, total: p.lesson.quiz.length })}
            </span>
            <span>⏱ {Math.ceil(p.left)}</span>
          </div>
          <p className="mb-2 font-semibold">{q.q}</p>
          {mine === undefined && !hand ? (
            <button type="button" onClick={() => c.putUpHand()} className="min-h-11 w-full rounded-xl bg-amber-400 text-base font-bold">
              ✋ {t('Put up your hand')}
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              {q.options.map((o, k) => {
                const done = mine !== undefined;
                const cls = !done ? 'bg-blue-50 border-blue-200' : k === q.answer ? 'bg-green-100 border-green-500' : k === mine ? 'bg-red-100 border-red-400' : 'bg-gray-50 border-gray-200 opacity-60';
                return (
                  <button key={o} type="button" disabled={done} onClick={() => c.answer(p.q, k)} className={`min-h-10 rounded-xl border px-3 text-left text-sm ${cls}`}>
                    {'ABC'[k]}. {o}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (p.phase === 'break')
    return (
      <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-20 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-sm shadow">
        🔔 {t('Next lesson: {title} in {time}. Take a seat!', { title: nextLesson(p.n).title, time: clock(p.left) })}
      </div>
    );
  return null;
}
