import { useMemo, useState } from 'react';
import type { AreaContentDto, AreaItemDto, AreaQuizQuestion } from '@es/shared';
import { sendAreaQuiz } from '../../net/api';
import { useProfile } from '../../store/profile';
import { useArea } from '../../store/area';
import { useT } from '../../i18n';
import { say } from './common';

type Q =
  | { type: 'listen'; answer: AreaItemDto; options: AreaItemDto[] }
  | { type: 'picture'; answer: AreaItemDto; options: AreaItemDto[] }
  | { type: 'gap'; answer: AreaItemDto; options: AreaItemDto[]; sentence: string }
  /** Written in the admin site: a question with 4 text options. */
  | { type: 'custom'; q: AreaQuizQuestion; answer: { id: string; en: string }; options: { id: string; en: string; icon: string }[] };

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const QUESTIONS = 6;

/** Up to 2 hand-written questions (admin site), the rest generated from the word cards. */
function makeQuiz(c: AreaContentDto): Q[] {
  const custom: Q[] = shuffle(c.quiz ?? [])
    .slice(0, 2)
    .map((q) => {
      const options = q.options.map((en, i) => ({ id: `${q.id}#${i}`, en, icon: '' }));
      return { type: 'custom' as const, q, answer: options[q.answer]!, options: shuffle(options) };
    });
  // only items with a distinct picture are fair for picture questions
  const pool = c.items.filter((it, i, all) => all.findIndex((x) => x.icon === it.icon) === i);
  const generated: Q[] = shuffle(pool)
    .slice(0, QUESTIONS - custom.length)
    .map((answer, i): Q => {
      const options = shuffle([answer, ...shuffle(pool.filter((x) => x.id !== answer.id)).slice(0, 3)]);
      const kind = i % 3;
      if (kind === 2) {
        const s = answer.sentences.find((x) => x.en.toLowerCase().includes(answer.en.toLowerCase()));
        if (s) {
          const re = new RegExp(answer.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          return { type: 'gap', answer, options, sentence: s.en.replace(re, '_____') };
        }
      }
      return { type: kind === 0 ? 'listen' : 'picture', answer, options };
    });
  return shuffle([...generated, ...custom]);
}

/** Short quiz on an area's words: listen → pick the picture, picture → pick the word, fill the gap. */
export function Quiz({ content }: { content: AreaContentDto }) {
  const t = useT();
  const [qs, setQs] = useState<Q[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  /** Words answered wrong (item ids; custom questions as quiz:<id>), for the admin stats. */
  const [wrong, setWrong] = useState<string[]>([]);
  const [reward, setReward] = useState<{ xp: number; coins: number; capped: boolean } | null>(null);
  const q = qs?.[i];
  const done = qs && i >= qs.length;
  const start = () => {
    const nq = makeQuiz(content);
    setQs(nq);
    setI(0);
    setScore(0);
    setWrong([]);
    setPicked(null);
    setReward(null);
    if (nq[0]?.type === 'listen') say(nq[0].answer.en);
  };
  const next = async () => {
    const n = i + 1;
    setI(n);
    setPicked(null);
    if (qs && n < qs.length && qs[n]!.type === 'listen') say(qs[n]!.answer.en);
    if (qs && n >= qs.length) {
      try {
        const r = await sendAreaQuiz(content.id, score, qs.length, wrong);
        setReward(r);
        if (r.badge) useArea.getState().showBadge(r.badge);
        void useProfile.getState().refresh();
      } catch {
        /* offline: no reward */
      }
    }
  };
  const optionsLabel = useMemo(() => (q?.type === 'listen' ? 'icon' : 'word'), [q]);
  const speak = (s: string) => {
    if (q?.type !== 'custom') say(s);
  };

  if (!qs)
    return (
      <div className="py-6 text-center">
        <p className="mb-3 text-sm text-gray-600">{t('Test yourself: {n} quick questions about the words in this place.', { n: QUESTIONS })}</p>
        <button type="button" onClick={start} className="min-h-11 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white">
          ▶ {t('Start quiz')}
        </button>
      </div>
    );
  if (done)
    return (
      <div className="py-6 text-center">
        <div className="text-4xl">{score === qs.length ? '🏆' : score >= qs.length / 2 ? '🎉' : '💪'}</div>
        <p className="mt-2 text-lg font-bold">{t('{score} / {total} correct', { score, total: qs.length })}</p>
        {reward ? (
          <p className="text-sm text-emerald-700">
            +{reward.xp} XP{reward.coins ? ` · +${reward.coins} 🪙` : ''} {reward.capped ? `(${t('daily quiz limit reached')})` : ''}
          </p>
        ) : null}
        <button type="button" onClick={start} className="mt-3 min-h-11 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white">
          ↻ {t('Play again')}
        </button>
      </div>
    );
  if (!q) return null;
  const correct = picked === q.answer.id;
  return (
    <div className="py-2">
      <div className="mb-2 text-xs text-gray-500">{t('Question {n} of {total}', { n: i + 1, total: qs.length })}</div>
      {q.type === 'listen' ? (
        <div className="mb-3 flex items-center gap-3">
          <button type="button" onClick={() => say(q.answer.en)} className="min-h-12 rounded-full bg-blue-600 px-5 text-xl text-white">
            🔊
          </button>
          <span className="text-sm">{t('Listen and choose the right picture.')}</span>
        </div>
      ) : q.type === 'custom' ? (
        <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-base" dir="ltr">
          {q.q.question}
        </div>
      ) : q.type === 'picture' ? (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-6xl">{q.answer.icon}</span>
          <span className="text-sm">{t('What is this in English?')}</span>
        </div>
      ) : (
        <div className="mb-3">
          <div className="text-sm">{t('Choose the missing word.')}</div>
          <div className="mt-1 rounded-lg bg-gray-50 px-3 py-2 text-base" dir="ltr">
            {q.sentence}
          </div>
        </div>
      )}
      <div className={`grid gap-2 ${optionsLabel === 'icon' ? 'grid-cols-4' : 'grid-cols-2'}`}>
        {q.options.map((o) => {
          const state = picked === null ? '' : o.id === q.answer.id ? 'bg-green-100 border-green-500' : o.id === picked ? 'bg-red-100 border-red-400' : 'opacity-60';
          return (
            <button
              key={o.id}
              type="button"
              disabled={picked !== null}
              onClick={() => {
                setPicked(o.id);
                if (o.id === q.answer.id) setScore((s) => s + 1);
                else setWrong((w) => [...w, q.type === 'custom' ? `quiz:${q.q.id}` : q.answer.id]);
                speak(q.answer.en);
              }}
              className={`min-h-12 rounded-xl border-2 px-2 ${optionsLabel === 'icon' ? 'text-4xl' : 'text-base font-medium'} ${state}`}
              dir="ltr"
            >
              {optionsLabel === 'icon' ? o.icon : o.en}
            </button>
          );
        })}
      </div>
      {picked !== null ? (
        <div className="mt-3 flex items-center justify-between">
          <span className={`text-sm font-semibold ${correct ? 'text-green-700' : 'text-red-600'}`}>
            {correct ? `✓ ${t('Correct!')}` : `✗ ${t('It was:')} `}
            {!correct ? <b dir="ltr">{q.answer.en}</b> : null}
          </span>
          <button type="button" onClick={() => void next()} className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">
            {t('Next')} →
          </button>
        </div>
      ) : null}
    </div>
  );
}
