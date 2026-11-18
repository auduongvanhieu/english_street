import { useEffect, useRef, useState } from 'react';
import { SHADOW_PASS, shadowScore, type ListenQuestion, type PracticeSentence } from '@es/shared';
import { usePractice } from '../store/practice';
import { useSettings } from '../store/settings';
import { speak, stopSpeaking, ttsSupported } from '../voice/tts';
import { startStt, sttSupported, type SttHandle } from '../voice/stt';
import { track } from '../net/analytics';
import { useT } from '../i18n';
import { Sheet, SheetHeader } from './Sheet';
import { Icon } from './icons';

/**
 * Daily listening and shadowing lessons (journey tasks d-listen / d-shadow).
 *  - Listening: hear a sentence, pick what you heard or the missing word (6 questions).
 *  - Shadowing: hear a sentence, say it the same way; the speech recogniser scores the words (5 sentences).
 * Finishing sends listening_done / shadowing_done, which the journey counts.
 */

function say(text: string, slow = false, onEnd?: () => void) {
  const rate = useSettings.getState().ttsRate ?? 0.95;
  return speak(text, { lang: 'en-US', rate: slow ? Math.min(rate, 0.95) * 0.7 : rate, onEnd });
}

function ListenButtons({ text, onPlayed, auto }: { text: string; onPlayed?: () => void; auto?: boolean }) {
  const t = useT();
  const [playing, setPlaying] = useState<'n' | 's' | null>(null);
  const play = (slow: boolean) => {
    setPlaying(slow ? 's' : 'n');
    say(text, slow, () => {
      setPlaying(null);
      onPlayed?.();
    });
  };
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => play(false), 350);
    return () => {
      window.clearTimeout(id);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={() => play(false)} className={`flex min-h-14 items-center gap-2 rounded-full px-6 text-lg font-semibold text-white shadow ${playing === 'n' ? 'animate-pulse bg-blue-500' : 'bg-blue-600'}`}>
        <Icon name="speaker" size={22} />
        {t('Listen')}
      </button>
      <button type="button" onClick={() => play(true)} className={`flex min-h-12 items-center gap-1 rounded-full border-2 px-4 font-medium ${playing === 's' ? 'animate-pulse border-blue-400 text-blue-700' : 'border-blue-200 text-blue-800'}`}>
        🐢 {t('Slowly')}
      </button>
    </div>
  );
}

function Translation({ s }: { s: PracticeSentence }) {
  return s.tr ? <p className="mt-1 text-sm text-gray-600">{s.tr}</p> : null;
}

function Done({ title, line, again }: { title: string; line: string; again: () => void }) {
  const t = useT();
  const close = usePractice((s) => s.close);
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="text-5xl">🎉</div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-gray-700">{line}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={again} className="min-h-11 rounded-xl border px-4 font-medium">
          {t('Practise more')}
        </button>
        <button type="button" onClick={close} className="min-h-11 rounded-xl bg-blue-600 px-5 font-semibold text-white">
          {t('Done')}
        </button>
      </div>
    </div>
  );
}

function Listening({ questions }: { questions: ListenQuestion[] }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const q = questions[i];
  if (!q) {
    return <Done title={t('Listening done!')} line={t('{n} of {total} right.', { n: right, total: questions.length })} again={() => void usePractice.getState().start('listen')} />;
  }
  const answered = picked !== null;
  const choose = (k: number) => {
    if (answered) return;
    setPicked(k);
    const ok = k === q.answer;
    const score = right + (ok ? 1 : 0);
    if (ok) setRight(score);
    // the last answer finishes the lesson (the result screen is one tap later)
    if (i === questions.length - 1) {
      track('listening_done', { score, total: questions.length });
      usePractice.getState().finished('listen');
    }
  };
  const words = q.s.en.split(/\s+/);
  return (
    <div>
      <p className="mb-3 text-center text-sm font-medium text-gray-500">
        {t('Question {n} of {total}', { n: i + 1, total: questions.length })}
      </p>
      <ListenButtons text={q.s.en} auto />
      <p className="mb-2 mt-5 font-semibold">{q.type === 'pick' ? t('Which sentence did you hear?') : t('Which word is missing?')}</p>
      {q.type === 'gap' ? (
        <p className="mb-3 rounded-xl bg-gray-50 p-3 text-lg" dir="ltr">
          {words.map((w, k) => (
            <span key={k}>
              {k === q.gap ? (answered ? <b className="text-blue-700">{w}</b> : <span className="inline-block min-w-16 border-b-2 border-gray-400">&nbsp;</span>) : w}{' '}
            </span>
          ))}
        </p>
      ) : null}
      <div className={q.type === 'gap' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
        {q.options.map((o, k) => {
          const state = !answered ? '' : k === q.answer ? 'border-green-500 bg-green-50 text-green-900' : k === picked ? 'border-red-400 bg-red-50 text-red-800 line-through' : 'opacity-60';
          return (
            <button key={k} type="button" dir="ltr" onClick={() => choose(k)} className={`min-h-12 rounded-xl border-2 px-3 py-2 text-start ${state || 'border-gray-200 hover:border-blue-300'}`}>
              {o}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className={`mt-3 rounded-xl p-3 ${picked === q.answer ? 'bg-green-50' : 'bg-amber-50'}`}>
          <p className="font-semibold">{picked === q.answer ? `✓ ${t('Correct!')}` : t('Not quite. Listen again:')}</p>
          <p className="mt-1" dir="ltr">
            {q.s.icon} {q.s.en}
          </p>
          <Translation s={q.s} />
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              setPicked(null);
              setI(i + 1);
            }}
            className="mt-3 min-h-11 w-full rounded-xl bg-blue-600 font-semibold text-white"
          >
            {i === questions.length - 1 ? t('See my result') : t('Next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type MicState = 'idle' | 'listening' | 'error' | 'denied';

function Shadowing({ sentences }: { sentences: PracticeSentence[] }) {
  const t = useT();
  const stt = sttSupported();
  const [i, setI] = useState(0);
  const [mic, setMic] = useState<MicState>('idle');
  const [heard, setHeard] = useState('');
  const [result, setResult] = useState<ReturnType<typeof shadowScore> | null>(null);
  const [tries, setTries] = useState(0);
  const [played, setPlayed] = useState(false);
  const [best, setBest] = useState<number[]>([]);
  const h = useRef<SttHandle | null>(null);
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((x) => window.clearTimeout(x));
    timers.current = [];
  };
  useEffect(
    () => () => {
      h.current?.abort();
      clearTimers();
    },
    [],
  );
  const s = sentences[i];
  if (!s) {
    const avg = best.length ? Math.round((best.reduce((a, b) => a + b, 0) / best.length) * 100) : 0;
    return <Done title={t('Shadowing done!')} line={stt ? t('Average: {n}% of the words.', { n: avg }) : t('Well done! Keep saying sentences out loud.')} again={() => void usePractice.getState().start('shadow')} />;
  }
  const passed = (result?.score ?? 0) >= SHADOW_PASS;
  const canNext = stt ? passed || tries >= 2 || mic === 'denied' : played;

  function record() {
    if (!s) return;
    stopSpeaking();
    h.current?.abort();
    clearTimers();
    setHeard('');
    setResult(null);
    setMic('listening');
    let last = '';
    const target = s.en.split(/\s+/).length;
    // stop a moment after the learner stops talking (or when they said enough words), at most 9 s
    const quiet = () => {
      clearTimers();
      timers.current.push(window.setTimeout(() => h.current?.stop(), 1600), window.setTimeout(() => h.current?.stop(), 9000));
    };
    h.current = startStt({
      lang: 'en-US',
      onInterim: (x) => (setHeard(x), quiet()),
      onFinal: (x) => {
        last = x;
        setHeard(x);
        if (x.split(/\s+/).length >= target + 3) h.current?.stop();
        else quiet();
      },
      onError: (code) => setMic(code === 'not-allowed' || code === 'service-not-allowed' ? 'denied' : 'error'),
      onEnd: () => {
        clearTimers();
        setMic((m) => (m === 'listening' ? 'idle' : m));
        if (!last) return;
        const r = shadowScore(s.en, last);
        setResult(r);
        setTries((n) => n + 1);
        setBest((b) => {
          const c = [...b];
          c[i] = Math.max(c[i] ?? 0, r.score);
          return c;
        });
      },
    });
    if (!h.current) setMic('error');
    else timers.current.push(window.setTimeout(() => h.current?.stop(), 9000));
  }
  function next() {
    h.current?.abort();
    clearTimers();
    stopSpeaking();
    const last = i === sentences.length - 1;
    if (last) {
      const scores = sentences.map((_, k) => (k === i ? Math.max(best[k] ?? 0, result?.score ?? 0) : (best[k] ?? 0)));
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / sentences.length) * 100);
      track('shadowing_done', { score: avg, passed: scores.filter((x) => x >= SHADOW_PASS).length, total: sentences.length, stt });
      usePractice.getState().finished('shadow');
    }
    setI(i + 1);
    setResult(null);
    setHeard('');
    setTries(0);
    setPlayed(false);
    setMic('idle');
  }

  return (
    <div>
      <p className="mb-3 text-center text-sm font-medium text-gray-500">
        {t('Sentence {n} of {total}', { n: i + 1, total: sentences.length })}
      </p>
      <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-center">
        <p className="text-xl font-semibold leading-snug" dir="ltr">
          {result
            ? result.words.map((w, k) => (
                <span key={k} className={w.ok ? 'text-green-700' : 'text-red-600 underline decoration-wavy'}>
                  {w.w}{' '}
                </span>
              ))
            : s.en}
        </p>
        <Translation s={s} />
      </div>
      <ListenButtons text={s.en} auto onPlayed={() => setPlayed(true)} />
      <p className="mt-4 text-center text-sm text-gray-600">{t('Listen, then say the sentence the same way: same words, same rhythm.')}</p>
      {stt ? (
        <div className="mt-3 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => (mic === 'listening' ? h.current?.stop() : record())}
            className={`flex min-h-14 items-center gap-2 rounded-full px-7 text-lg font-semibold text-white shadow ${mic === 'listening' ? 'animate-pulse bg-red-500' : 'bg-purple-600'}`}
          >
            <Icon name="mic" size={22} />
            {mic === 'listening' ? t('Listening… tap when done') : tries ? t('Say it again') : t('Say it')}
          </button>
          {mic === 'listening' && heard ? (
            <p className="text-sm text-gray-500" dir="ltr">
              “{heard}”
            </p>
          ) : null}
          {result ? (
            <p className={`font-semibold ${passed ? 'text-green-700' : 'text-amber-700'}`}>
              {passed ? `✓ ${t('Great! {n}% of the words.', { n: Math.round(result.score * 100) })}` : t('{n}% of the words. Listen again and try once more!', { n: Math.round(result.score * 100) })}
            </p>
          ) : null}
          {result && !passed && heard ? (
            <p className="text-sm text-gray-500" dir="ltr">
              {t('We heard:')} “{heard}”
            </p>
          ) : null}
          {mic === 'denied' ? <p className="text-center text-sm text-red-600">{t('The microphone is blocked. Allow it in your browser settings, or say the sentence out loud and go on.')}</p> : null}
          {mic === 'error' ? <p className="text-center text-sm text-gray-500">{t('We could not hear you. Try again.')}</p> : null}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-900">{t('This device cannot check your voice. Listen, say the sentence out loud, then go on.')}</p>
      )}
      <button type="button" disabled={!canNext} onClick={next} className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 font-semibold text-white disabled:bg-gray-300">
        {i === sentences.length - 1 ? t('Finish') : stt && !passed && canNext ? t('Skip') : t('Next')}
      </button>
    </div>
  );
}

export function PracticePanel() {
  const t = useT();
  const kind = usePractice((s) => s.kind);
  const set = usePractice((s) => s.set);
  const loading = usePractice((s) => s.loading);
  const error = usePractice((s) => s.error);
  const close = usePractice((s) => s.close);
  const sound = useSettings((s) => s.sound);
  if (!kind) return null;
  const title = kind === 'listen' ? `🎧 ${t('Listening')}` : `🗣️ ${t('Shadowing')}`;
  return (
    <Sheet onClose={close} label={title}>
      <SheetHeader>
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={close} className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          <Icon name="close" size={20} />
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {!sound ? <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t('Game sound is off: turn it on in Settings to hear the sentences.')}</p> : null}
        {!ttsSupported() ? <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t('This device cannot play English voices.')}</p> : null}
        {loading ? <p className="py-10 text-center text-gray-500">{t('Loading…')}</p> : null}
        {error ? <p className="py-6 text-center text-red-600">{error}</p> : null}
        {set && set.kind === 'listen' ? <Listening key={`l${set.round}`} questions={set.questions} /> : null}
        {set && set.kind === 'shadow' ? <Shadowing key={`s${set.round}`} sentences={set.sentences} /> : null}
      </div>
    </Sheet>
  );
}
