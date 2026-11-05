import { useMemo, useState } from 'react';
import type { AreaContentDto } from '@es/shared';
import { tk, useLang, useT } from '../../../i18n';
import { sendAreaQuiz } from '../../../net/api';
import { track } from '../../../net/analytics';
import { useProfile } from '../../../store/profile';
import { DESTINATIONS, JOURNEY_MIN } from '../../../world/places/station';
import { say } from '../common';

/**
 * 🚆 Trains & tickets: read a timetable and buy the right ticket for a traveller (train → single/return →
 * platform), then listen to one station announcement. 5 tasks per round (4 timetables + 1 announcement).
 */
type Dest = (typeof DESTINATIONS)[number];
interface Row {
  dep: number; // minutes after midnight
  dest: Dest;
  platform: number;
  /** minutes late, -1 = cancelled */
  delay: number;
}
interface TTTask {
  kind: 'tt';
  who: string;
  lines: string[];
  rows: Row[];
  answer: number;
  ticket: 'single' | 'return';
  /** why the obvious row is wrong, for the feedback */
  trap: 'cancelled' | 'delayed' | null;
}
interface AnnTask {
  kind: 'ann';
  text: string;
  speech: string;
  question: string;
  options: string[];
  answer: number;
}
type Task = TTTask | AnnTask;

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: readonly T[]) => a[rnd(a.length)]!;
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** 14:30 → "2:30 pm", 15:00 → "3 pm" */
const twelve = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};
const NUM = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
const words = (n: number) => (n < 20 ? NUM[n]! : TENS[Math.floor(n / 10)]! + (n % 10 ? `-${NUM[n % 10]}` : ''));
/** Railway style: 14:05 → "fourteen oh five", 9:30 → "nine thirty", 15:00 → "fifteen hundred". */
const spoken = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h === 0 ? 'zero' : words(h)} ${mm === 0 ? 'hundred' : mm < 10 ? `oh ${NUM[mm]}` : words(mm)}`;
};
const arrives = (r: Row) => r.dep + JOURNEY_MIN[r.dest] + Math.max(0, r.delay);
const status = (r: Row) => (r.delay < 0 ? 'Cancelled' : r.delay > 0 ? `Delayed ${r.delay} min` : 'On time');

const WHO = ['🧑‍💼', '👩‍🦳', '👨‍🎓', '🧕', '👵', '👦', '👩‍🍳', '🧑‍🎨'];
const RETURN_LINES = ["I'm coming back tomorrow.", "I'm coming back this evening.", 'I need to come home on Sunday.', "I'll come back after the weekend."];
const SINGLE_LINES = ["I'm not coming back. I'm moving there!", 'My dad is driving me home later.', "I'm only going one way. I'll take the bus back.", "I'm staying there. I've got a new job."];

function makeRows(start: number, dest: Dest): Row[] {
  const rows: Row[] = [];
  let t = start;
  const dests = shuffle([dest, dest, dest, ...shuffle(DESTINATIONS.filter((d) => d !== dest)).slice(0, 3)]);
  for (const d of dests) {
    t += 6 + rnd(18);
    const r = Math.random();
    rows.push({ dep: t, dest: d, platform: 1 + rnd(4), delay: r < 0.18 ? -1 : r < 0.4 ? pick([5, 10, 15, 20]) : 0 });
  }
  return rows;
}

function makeTT(): TTTask {
  for (;;) {
    const dest = pick(DESTINATIONS);
    const start = (7 + rnd(12)) * 60 + pick([0, 5, 10, 20, 30, 40]);
    const rows = makeRows(start, dest);
    const ticket = Math.random() < 0.55 ? 'return' : 'single';
    const tail = pick(ticket === 'return' ? RETURN_LINES : SINGLE_LINES);
    const mine = rows.map((r, i) => ({ r, i })).filter((x) => x.r.dest === dest);
    if (Math.random() < 0.5) {
      // "be there before …": exactly one train must work
      const deadline = Math.ceil((arrives(mine[1]!.r) + 1) / 30) * 30;
      const ok = mine.filter((x) => x.r.delay >= 0 && arrives(x.r) <= deadline);
      if (ok.length !== 1 || mine.every((x) => x.r.delay === 0)) continue;
      const trap = mine.some((x) => x.r.delay < 0 && x.r.dep + JOURNEY_MIN[dest] <= deadline) ? 'cancelled' : mine.some((x) => x.r.delay > 0 && x.r.dep + JOURNEY_MIN[dest] <= deadline && arrives(x.r) > deadline) ? 'delayed' : null;
      return { kind: 'tt', who: pick(WHO), lines: [`I need to be in ${dest} before ${twelve(deadline)}.`, tail], rows, answer: ok[0]!.i, ticket, trap };
    }
    // "the first train after …"
    const after = mine[0]!.r.dep - (mine[0]!.r.dep % 5) - 5 * rnd(2);
    const first = mine.find((x) => x.r.delay >= 0 && x.r.dep >= after);
    if (!first || !mine.some((x) => x.r.delay !== 0)) continue;
    const trap = mine[0]!.r.delay < 0 && first !== mine[0] ? 'cancelled' : null;
    const lead = pick([`I can't leave before ${twelve(after)}. What's the first train to ${dest}?`, `My class finishes at ${twelve(after)}. I want the next train to ${dest} after that.`]);
    return { kind: 'tt', who: pick(WHO), lines: [lead, tail], rows, answer: first.i, ticket, trap };
  }
}

function makeAnn(): AnnTask {
  const dest = pick(DESTINATIONS);
  const t = (8 + rnd(12)) * 60 + 5 * rnd(12);
  const p = 1 + rnd(4);
  const platforms = ['1', '2', '3', '4'];
  const k = rnd(4);
  if (k === 0) {
    const text = `The train now arriving at platform ${p} is the ${hhmm(t)} service to ${dest}. Please stand behind the yellow line.`;
    return { kind: 'ann', text, speech: text.replace(hhmm(t), spoken(t)), question: 'Which platform is the train at?', options: platforms, answer: p - 1 };
  }
  if (k === 1) {
    const n = pick([5, 10, 15, 20]);
    const text = `We are sorry to announce that the ${hhmm(t)} to ${dest} is delayed by ${n} minutes.`;
    const opts = ['5 minutes', '10 minutes', '15 minutes', '20 minutes'];
    return { kind: 'ann', text, speech: text.replace(hhmm(t), spoken(t)), question: 'How late is the train?', options: opts, answer: opts.indexOf(`${n} minutes`) };
  }
  if (k === 2) {
    const next = t + pick([15, 20, 25, 30]);
    const text = `We are sorry to announce that the ${hhmm(t)} service to ${dest} has been cancelled. Passengers for ${dest} should take the ${hhmm(next)} from platform ${p}.`;
    const opts = shuffle([next, t, next + 10, t - 15]).map(hhmm);
    return { kind: 'ann', text, speech: text.replace(hhmm(t), spoken(t)).replace(hhmm(next), spoken(next)), question: `What time is the next train to ${dest}?`, options: opts, answer: opts.indexOf(hhmm(next)) };
  }
  const text = `Platform change. The ${hhmm(t)} to ${dest} will now leave from platform ${p}.`;
  if (Math.random() < 0.5) return { kind: 'ann', text, speech: text.replace(hhmm(t), spoken(t)), question: 'Which platform does the train leave from now?', options: platforms, answer: p - 1 };
  const opts = [...DESTINATIONS];
  return { kind: 'ann', text, speech: text.replace(hhmm(t), spoken(t)), question: 'Where is the train going?', options: opts, answer: opts.indexOf(dest) };
}

const newRound = (): Task[] => [makeTT(), makeTT(), makeTT(), makeTT(), makeAnn()];
const STEP_Q = { train: tk('Which train should they take?'), ticket: tk('Single or return?'), platform: tk('Which platform does it leave from?') };

export default function StationActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [i, setI] = useState(0);
  const [step, setStep] = useState<'train' | 'ticket' | 'platform'>('train');
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [showText, setShowText] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; xp: number; coins: number } | null>(null);
  const tr = (id: string) => (noTr ? '' : (content.items.find((x) => x.id === id)?.tr.meaning ?? ''));
  const total = useMemo(() => (tasks ? tasks.reduce((n, k) => n + (k.kind === 'tt' ? 3 : 1), 0) : 0), [tasks]);

  const start = () => {
    setTasks(newRound());
    setI(0);
    setStep('train');
    setPicked(null);
    setScore(0);
    setWrong([]);
    setShowText(false);
    setResult(null);
    track('station_tickets_start');
  };

  if (!tasks)
    return (
      <div className="py-4 text-center">
        {result ? (
          <div className="mb-4">
            <div className="text-4xl">{result.correct / result.total >= 0.8 ? '🏆' : '🎫'}</div>
            <p className="font-semibold">{t('{score} / {total} correct', { score: result.correct, total: result.total })}</p>
            {result.xp || result.coins ? <p className="text-sm text-emerald-700">+{result.xp} XP{result.coins ? ` · +${result.coins} 🪙` : ''}</p> : null}
            <p className="mt-1 text-sm" dir="ltr">
              “Thank you for travelling with us. Have a good journey!”
            </p>
          </div>
        ) : (
          <>
            <div className="mb-2 text-4xl">🚆🎫</div>
            <p className="mb-3 text-sm text-gray-600">{t('Help 4 travellers: read the timetable, choose the right train and ticket, and find the platform. Then listen to a station announcement.')}</p>
          </>
        )}
        <button type="button" onClick={start} className="min-h-11 rounded-lg bg-slate-600 px-6 text-sm font-semibold text-white">
          🎫 {result ? t('Play again') : t('Start')}
        </button>
      </div>
    );

  const task = tasks[i]!;
  const answered = picked !== null;
  const right = (() => {
    if (picked === null) return false;
    if (task.kind === 'ann') return picked === task.answer;
    if (step === 'train') return picked === task.answer;
    if (step === 'ticket') return (picked === 1 ? 'return' : 'single') === task.ticket;
    return picked === task.rows[task.answer]!.platform - 1;
  })();

  const choose = (n: number) => {
    if (answered) return;
    setPicked(n);
    let ok: boolean;
    let miss = '';
    if (task.kind === 'ann') {
      ok = n === task.answer;
      miss = 'departure';
      setShowText(true);
    } else if (step === 'train') {
      ok = n === task.answer;
      miss = task.trap === 'cancelled' ? 'cancelled' : task.trap === 'delayed' ? 'delayed' : 'timetable';
    } else if (step === 'ticket') {
      ok = (n === 1 ? 'return' : 'single') === task.ticket;
      miss = task.ticket === 'return' ? 'return-ticket' : 'single-ticket';
    } else {
      ok = n === task.rows[task.answer]!.platform - 1;
      miss = 'platform';
    }
    if (ok) setScore((s) => s + 1);
    else setWrong((w) => (w.includes(miss) ? w : [...w, miss]));
  };

  const finish = async () => {
    const correct = score;
    let xp = 0;
    let coins = 0;
    try {
      const r = await sendAreaQuiz('station', correct, total, wrong);
      xp = r.xp;
      coins = r.coins;
      void useProfile.getState().refresh();
    } catch {
      /* offline */
    }
    track('station_tickets_done', { correct, total });
    setResult({ correct, total, xp, coins });
    setTasks(null);
  };

  const next = () => {
    setPicked(null);
    if (task.kind === 'tt' && step !== 'platform') return setStep(step === 'train' ? 'ticket' : 'platform');
    setStep('train');
    setShowText(false);
    if (i + 1 < tasks.length) setI(i + 1);
    else void finish();
  };

  const btn = (n: number, label: React.ReactNode, sub?: string) => {
    const isRight = task.kind === 'ann' ? n === task.answer : step === 'train' ? n === task.answer : step === 'ticket' ? (n === 1 ? 'return' : 'single') === task.ticket : n === task.rows[task.answer]!.platform - 1;
    const cls = !answered ? 'border-gray-300 bg-white hover:bg-gray-50' : isRight ? 'border-green-500 bg-green-50' : n === picked ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white opacity-60';
    return (
      <button key={n} type="button" onClick={() => choose(n)} className={`min-h-11 rounded-lg border px-3 py-1.5 text-sm ${cls}`}>
        <span dir="ltr">{label}</span>
        {sub ? <span className="block text-[11px] text-gray-500">{sub}</span> : null}
      </button>
    );
  };

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t('Task {n} of {total}', { n: i + 1, total: tasks.length })}</span>
        <span>
          ⭐ {score} / {total}
        </span>
      </div>

      {task.kind === 'tt' ? (
        <>
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3">
            <span className="text-3xl">{task.who}</span>
            <div className="flex-1 text-sm" dir="ltr">
              {task.lines.map((l) => (
                <p key={l}>“{l}”</p>
              ))}
            </div>
            <button type="button" onClick={() => say(task.lines.join(' '))} className="min-h-11 min-w-11 rounded-full bg-white text-lg shadow" aria-label={t('Listen')}>
              🔊
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl bg-slate-900 p-2 text-[12px] text-white" dir="ltr">
            <div className="mb-1 flex justify-between px-1 font-bold text-amber-300">
              <span>DEPARTURES</span>
              <span>Central Station</span>
            </div>
            <table className="w-full border-separate border-spacing-y-0.5">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="px-1">Dep</th>
                  <th className="px-1">To</th>
                  <th className="px-1">Arr</th>
                  <th className="px-1">Plat</th>
                  <th className="px-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {task.rows.map((r, n) => {
                  const sel = step === 'train' && answered && (n === task.answer || n === picked);
                  const mark = step !== 'train' && n === task.answer;
                  return (
                    <tr
                      key={n}
                      onClick={() => step === 'train' && choose(n)}
                      className={`${step === 'train' && !answered ? 'cursor-pointer hover:bg-slate-700' : ''} ${sel ? (n === task.answer ? 'bg-green-700' : 'bg-red-700') : mark ? 'bg-slate-700 outline outline-1 outline-amber-300' : ''}`}
                    >
                      <td className="px-1 py-1.5 font-mono text-amber-300">{hhmm(r.dep)}</td>
                      <td className="px-1 py-1.5">{r.dest}</td>
                      <td className="px-1 py-1.5 font-mono">{hhmm(r.dep + JOURNEY_MIN[r.dest])}</td>
                      <td className="px-1 py-1.5 text-center">{r.platform}</td>
                      <td className={`px-1 py-1.5 ${r.delay < 0 ? 'text-red-300' : r.delay > 0 ? 'text-orange-300' : 'text-green-300'}`}>{status(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm font-semibold">{t(STEP_Q[step])}</p>
          {step === 'train' ? (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{task.rows.map((r, n) => btn(n, `${hhmm(r.dep)} → ${r.dest}`))}</div>
          ) : step === 'ticket' ? (
            <div className="grid grid-cols-2 gap-1.5">
              {btn(0, '➡️ Single', tr('single-ticket'))}
              {btn(1, '🔁 Return', tr('return-ticket'))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map((n) => btn(n, `${n + 1}`))}</div>
          )}
          {answered ? (
            <div className={`rounded-lg px-3 py-2 text-sm ${right ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
              {right ? '✅ ' : '❌ '}
              <span dir="ltr">
                {step === 'train'
                  ? `The ${hhmm(task.rows[task.answer]!.dep)} to ${task.rows[task.answer]!.dest} arrives at ${hhmm(arrives(task.rows[task.answer]!))}.`
                  : step === 'ticket'
                    ? task.ticket === 'return'
                      ? 'They are coming back, so they need a return ticket.'
                      : "They aren't coming back by train, so a single ticket is enough."
                    : `It leaves from platform ${task.rows[task.answer]!.platform}.`}
              </span>
              {!right && step === 'train' && task.trap ? <span className="block text-xs">{task.trap === 'cancelled' ? t('Careful: one train is cancelled!') : t('Careful: a delayed train arrives later!')}</span> : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="rounded-xl bg-slate-100 p-3 text-center">
            <div className="mb-1 text-3xl">📢</div>
            <p className="mb-2 text-sm text-gray-600">{t('Listen to the announcement.')}</p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => say(task.speech, 'en-GB')} className="min-h-11 rounded-full bg-slate-600 px-4 text-sm font-semibold text-white">
                🔊 {t('Play')}
              </button>
              <button type="button" onClick={() => say(task.speech, 'en-GB', true)} className="min-h-11 rounded-full border bg-white px-4 text-sm" aria-label={t('Listen slowly')}>
                🐢
              </button>
              <button type="button" onClick={() => setShowText((s) => !s)} className="min-h-11 rounded-full border bg-white px-3 text-xs">
                {showText ? t('Hide text') : t('Show text')}
              </button>
            </div>
            {showText ? (
              <p className="mt-2 text-sm italic" dir="ltr">
                {task.text}
              </p>
            ) : null}
          </div>
          <p className="text-sm font-semibold" dir="ltr">
            {task.question}
          </p>
          <div className="grid grid-cols-2 gap-1.5">{task.options.map((o, n) => btn(n, o))}</div>
        </>
      )}

      {answered ? (
        <button type="button" onClick={next} className="min-h-11 w-full rounded-lg bg-slate-600 text-sm font-semibold text-white">
          {task.kind === 'tt' && step !== 'platform' ? t('Next question') : i + 1 < tasks.length ? t('Next traveller') : t('Finish')} →
        </button>
      ) : null}
    </div>
  );
}
