import { useMini } from '../../../store/minigames';
import { useTeamGame } from '../../../store/teamGame';
import { useMemo, useRef, useState } from 'react';
import type { AreaContentDto, AreaItemDto } from '@es/shared';
import { sendAreaQuiz } from '../../../net/api';
import { track } from '../../../net/analytics';
import { useProfile } from '../../../store/profile';
import { useArea } from '../../../store/area';
import { useLang, useT } from '../../../i18n';
import { say } from '../common';

const shuffle = <T,>(a: T[], rnd = Math.random) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j]!, b[i]!];
  }
  return b;
};
const teacherSays = (s: string, slow = false) => say(s, 'en-GB', slow);

type Reward = { xp: number; coins: number; capped: boolean } | null;
/** Send a finished round (XP/coins, area quiz pass at ≥ 80 %) and refresh the profile. */
async function finish(correct: number, total: number, wrong: string[], event: string, props: Record<string, string | number> = {}): Promise<Reward> {
  track(event, { correct, total, ...props });
  try {
    const r = await sendAreaQuiz('school', correct, total, wrong);
    if (r.badge) useArea.getState().showBadge(r.badge);
    void useProfile.getState().refresh();
    return r;
  } catch {
    return null; // offline: no reward
  }
}

function Score({ score, total, reward, again, children }: { score: number; total: number; reward: Reward; again: () => void; children?: React.ReactNode }) {
  const t = useT();
  return (
    <div className="py-4 text-center">
      <div className="text-4xl">{score === total ? '🏆' : score >= total * 0.6 ? '🎉' : '💪'}</div>
      <p className="mt-1 text-lg font-bold">{t('{score} / {total} correct', { score, total })}</p>
      {reward ? (
        <p className="text-sm text-emerald-700">
          +{reward.xp} XP{reward.coins ? ` · +${reward.coins} 🪙` : ''} {reward.capped ? `(${t('daily quiz limit reached')})` : ''}
        </p>
      ) : null}
      {children}
      <button type="button" onClick={again} className="mt-3 min-h-11 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white">
        ↻ {t('Play again')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- 🐝 Spelling bee

const WORDS_PER_ROUND = 8;
type Level = 'easy' | 'medium' | 'hard';
const levelOf = (w: string): Level => (w.length <= 5 ? 'easy' : w.length <= 7 ? 'medium' : 'hard');
const LEVELS: { id: Level; label: string }[] = [
  { id: 'easy', label: '🐣 3–5' },
  { id: 'medium', label: '🐝 6–7' },
  { id: 'hard', label: '🦉 8+' },
];

/** One-word school items (pen, ruler, Wednesday…) that can be spelled. */
function spellable(c: AreaContentDto) {
  return c.items.filter((it) => /^[A-Za-z]{3,}$/.test(it.en));
}
function bee(c: AreaContentDto, level: Level): AreaItemDto[] {
  const all = shuffle(spellable(c));
  const same = all.filter((it) => levelOf(it.en) === level);
  const order: Level[] = level === 'easy' ? ['medium', 'hard'] : level === 'medium' ? ['easy', 'hard'] : ['medium', 'easy'];
  const rest = order.flatMap((l) => all.filter((it) => levelOf(it.en) === l));
  return [...same, ...rest].slice(0, WORDS_PER_ROUND);
}

function Spelling({ content }: { content: AreaContentDto }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const [level, setLevel] = useState<Level>('easy');
  const [words, setWords] = useState<AreaItemDto[] | null>(null);
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  /** 0 = first try, 1 = second try (hint shown), 2 = answer shown */
  const [tries, setTries] = useState(0);
  const [result, setResult] = useState<'ok' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [reward, setReward] = useState<Reward>(null);
  const input = useRef<HTMLInputElement>(null);
  const w = words?.[i];
  const counts = useMemo(() => {
    const c: Record<Level, number> = { easy: 0, medium: 0, hard: 0 };
    for (const it of spellable(content)) c[levelOf(it.en)]++;
    return c;
  }, [content]);

  const speakWord = (it: AreaItemDto, slow = false) => teacherSays(slow ? it.en : `${it.en}.`, slow);
  const start = () => {
    const ws = bee(content, level);
    setWords(ws);
    setI(0);
    setText('');
    setTries(0);
    setResult(null);
    setScore(0);
    setWrong([]);
    setReward(null);
    teacherSays(`Spell: ${ws[0]!.en}.`);
    setTimeout(() => input.current?.focus(), 50);
  };
  const check = () => {
    if (!w || result || !text.trim()) return;
    if (text.trim().toLowerCase() === w.en.toLowerCase()) {
      setResult('ok');
      setScore((s) => s + 1);
      teacherSays(tries === 0 ? 'Well done!' : 'Good job!');
      return;
    }
    if (tries === 0) {
      setTries(1);
      setText('');
      teacherSays(`Not quite. Try again: ${w.en}.`);
      setTimeout(() => input.current?.focus(), 50);
      return;
    }
    setTries(2);
    setResult('wrong');
    setWrong((x) => [...x, w.id]);
    teacherSays(`${w.en}: ${w.en.split('').join(', ')}.`, true);
  };
  const next = () => {
    if (!words) return;
    const n = i + 1;
    setI(n);
    setText('');
    setTries(0);
    setResult(null);
    if (n < words.length) {
      teacherSays(`Spell: ${words[n]!.en}.`);
      setTimeout(() => input.current?.focus(), 50);
    } else void finish(score, words.length, wrong, 'school_spelling_done', { level }).then(setReward);
  };

  if (!words)
    return (
      <div className="py-3 text-center">
        <div className="text-4xl">🐝</div>
        <p className="mx-auto mb-2 max-w-sm text-sm text-gray-600">{t('Listen to the word and type it. You have two tries for each word.')}</p>
        <div className="mb-3 flex justify-center gap-1.5">
          {LEVELS.map((l) => (
            <button key={l.id} type="button" onClick={() => setLevel(l.id)} className={`min-h-11 rounded-full border px-3 text-sm ${level === l.id ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700' : 'border-gray-200 bg-white'}`}>
              {l.label} {t('letters')} <span className="text-[11px] text-gray-500">({counts[l.id]})</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={start} className="min-h-11 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white">
          ▶ {t('Start the spelling bee')}
        </button>
      </div>
    );
  if (i >= words.length)
    return (
      <Score score={score} total={words.length} reward={reward} again={start}>
        {wrong.length ? (
          <p className="mt-2 text-sm" dir="ltr">
            {t('Practise these')}: {wrong.map((id) => words.find((x) => x.id === id)?.en).join(', ')}
          </p>
        ) : null}
      </Score>
    );
  if (!w) return null;
  const hint = tries > 0;
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t('Word {n} of {total}', { n: i + 1, total: words.length })}</span>
        <span>⭐ {score}</span>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-blue-50 p-3">
        <button type="button" onClick={() => speakWord(w)} className="min-h-12 rounded-full bg-blue-600 px-5 text-lg text-white">
          🔊 {t('Again')}
        </button>
        <button type="button" onClick={() => speakWord(w, true)} className="min-h-12 rounded-full border border-blue-300 bg-white px-4 text-lg">
          🐢 {t('Slow')}
        </button>
        <button type="button" onClick={() => teacherSays(w.sentences[0]?.en ?? w.en)} className="min-h-12 rounded-full border border-blue-300 bg-white px-4 text-sm">
          💬 {t('In a sentence')}
        </button>
      </div>
      {hint ? (
        <div className="flex items-center justify-center gap-3 rounded-lg bg-amber-50 px-3 py-2">
          <span className="text-4xl">{w.icon}</span>
          <span className="font-mono text-lg tracking-widest" dir="ltr">
            {w.en
              .split('')
              .map((ch, k) => (k === 0 ? ch : '_'))
              .join(' ')}
          </span>
          {!noTr && w.tr.meaning ? <span className="text-xs text-gray-600">{w.tr.meaning}</span> : null}
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (result) next();
          else check();
        }}
        className="flex gap-2"
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!result}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          placeholder={t('Type the word')}
          className={`min-h-12 flex-1 rounded-lg border px-3 font-mono text-xl tracking-wider ${result === 'ok' ? 'border-green-500 bg-green-50' : result === 'wrong' ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        />
        <button type="submit" className="min-h-12 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">
          {result ? (i + 1 < words.length ? `${t('Next')} →` : '🏁') : t('Check')}
        </button>
      </form>
      {result === 'ok' ? (
        <div className="rounded-lg bg-green-50 px-3 py-2 text-center text-green-800">
          ✓ {t('Correct!')} <span className="text-xl">{w.icon}</span> <b dir="ltr">{w.en}</b>
        </div>
      ) : result === 'wrong' ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-center text-red-800">
          {t('The right spelling is')} <b className="font-mono text-lg tracking-wider" dir="ltr">{w.en}</b> <span className="text-xl">{w.icon}</span>
        </div>
      ) : hint ? (
        <p className="text-center text-sm text-amber-800">{t('Not quite. Look at the hint and try again!')}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- 🗓️ Timetable

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [
  { digits: '8:00', words: "eight o'clock" },
  { digits: '9:00', words: "nine o'clock" },
  { digits: '10:30', words: 'half past ten' },
  { digits: '11:30', words: 'half past eleven' },
];
const SUBJECTS = ['english', 'maths', 'science', 'art', 'music', 'pe', 'history', 'geography'];
const QUESTIONS = 6;

/** Small seeded random generator (mulberry32): the same round number gives the same timetable. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface TQ {
  kind: string;
  q: string;
  options: string[];
  answer: string;
  /** cells to highlight after answering: [day, period] */
  cells: [number, number][];
  /** subject asked about (wrong list) */
  subject: string;
}

function makeRound(seed: number, name: (id: string) => string) {
  const rnd = seeded(seed);
  const grid = DAYS.map(() => shuffle(SUBJECTS, rnd).slice(0, PERIODS.length));
  const r = (n: number) => Math.floor(rnd() * n);
  const others = (right: string, pool: string[]) => shuffle([right, ...shuffle(pool.filter((x) => x !== right), rnd).slice(0, 3)], rnd);
  const subjectNames = SUBJECTS.map(name);
  const make: Record<string, () => TQ | null> = {
    after: () => {
      const d = r(5);
      const p = r(PERIODS.length - 1);
      const s = grid[d]![p]!;
      const a = name(grid[d]![p + 1]!);
      return { kind: 'after', q: `What's after ${name(s)} on ${DAYS[d]}?`, options: others(a, subjectNames.filter((x) => x !== name(s))), answer: a, cells: [[d, p + 1]], subject: s };
    },
    before: () => {
      const d = r(5);
      const p = 1 + r(PERIODS.length - 1);
      const s = grid[d]![p]!;
      const a = name(grid[d]![p - 1]!);
      return { kind: 'before', q: `What's before ${name(s)} on ${DAYS[d]}?`, options: others(a, subjectNames.filter((x) => x !== name(s))), answer: a, cells: [[d, p - 1]], subject: s };
    },
    when: () => {
      // a subject on exactly one day: "When do we have Art?"
      const once = shuffle(SUBJECTS, rnd).find((s) => grid.filter((day) => day.includes(s)).length === 1);
      if (!once) return null;
      const d = grid.findIndex((day) => day.includes(once));
      const a = `On ${DAYS[d]}`;
      return { kind: 'when', q: `When do we have ${name(once)}?`, options: others(a, DAYS.map((x) => `On ${x}`)), answer: a, cells: [[d, grid[d]!.indexOf(once)]], subject: once };
    },
    time: () => {
      const d = r(5);
      const p = r(PERIODS.length);
      const s = grid[d]![p]!;
      const a = `At ${PERIODS[p]!.words}`;
      return { kind: 'time', q: `What time does ${name(s)} start on ${DAYS[d]}?`, options: shuffle(PERIODS.map((x) => `At ${x.words}`), rnd), answer: a, cells: [[d, p]], subject: s };
    },
    what: () => {
      const d = r(5);
      const p = r(PERIODS.length);
      const s = grid[d]![p]!;
      return { kind: 'what', q: `What do we have on ${DAYS[d]} at ${PERIODS[p]!.words}?`, options: others(name(s), subjectNames), answer: name(s), cells: [[d, p]], subject: s };
    },
    howmany: () => {
      const s = SUBJECTS[r(SUBJECTS.length)]!;
      const cells: [number, number][] = [];
      grid.forEach((day, d) => day.forEach((x, p) => x === s && cells.push([d, p])));
      const n = cells.length;
      const nums = [0, 1, 2, 3, 4, 5].filter((x) => x !== n);
      const a = String(n);
      return { kind: 'howmany', q: `How many ${name(s)} lessons do we have this week?`, options: shuffle([a, ...shuffle(nums, rnd).slice(0, 3).map(String)], rnd), answer: a, cells, subject: s };
    },
  };
  const kinds = shuffle(Object.keys(make), rnd);
  const qs: TQ[] = [];
  for (let k = 0; qs.length < QUESTIONS && k < 30; k++) {
    const q = make[kinds[k % kinds.length]!]!();
    if (q && !qs.some((x) => x.q === q.q)) qs.push(q);
  }
  return { grid, qs };
}

function Timetable({ content }: { content: AreaContentDto }) {
  const t = useT();
  const item = (id: string) => content.items.find((x) => x.id === id);
  const name = (id: string) => item(id)?.en ?? id;
  const [seed, setSeed] = useState<number | null>(null);
  const round = useMemo(() => (seed === null ? null : makeRound(seed, name)), [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [reward, setReward] = useState<Reward>(null);
  const q = round?.qs[i];
  const start = () => {
    const s = 1 + Math.floor(Math.random() * 9999);
    setSeed(s);
    setI(0);
    setPicked(null);
    setScore(0);
    setWrong([]);
    setReward(null);
    const r = makeRound(s, name);
    teacherSays(r.qs[0]!.q);
  };
  const answer = (o: string) => {
    if (!q || picked) return;
    setPicked(o);
    if (o === q.answer) {
      setScore((s) => s + 1);
      teacherSays(`Yes! ${q.answer}.`);
    } else {
      setWrong((w) => (w.includes(q.subject) ? w : [...w, q.subject]));
      teacherSays(`No, ${q.answer}.`);
    }
  };
  const next = () => {
    if (!round) return;
    const n = i + 1;
    setI(n);
    setPicked(null);
    if (n < round.qs.length) teacherSays(round.qs[n]!.q);
    else void finish(score, round.qs.length, wrong, 'school_timetable_done').then(setReward);
  };

  if (!round)
    return (
      <div className="py-3 text-center">
        <div className="text-4xl">🗓️</div>
        <p className="mx-auto mb-3 max-w-sm text-sm text-gray-600">{t('Read the class timetable and answer the teacher’s questions.')}</p>
        <button type="button" onClick={start} className="min-h-11 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white">
          ▶ {t('Get a timetable')}
        </button>
      </div>
    );
  const done = i >= round.qs.length;
  const lit = new Set((picked && q ? q.cells : []).map(([d, p]) => `${d}-${p}`));
  return (
    <div className="space-y-2 py-1">
      <div className="overflow-x-auto rounded-xl border border-blue-100" dir="ltr">
        <table className="w-full table-fixed border-collapse text-center text-[11px] leading-tight">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="w-11 py-1 font-normal">🕗</th>
              {DAYS.map((d) => (
                <th key={d} className="py-1 font-semibold">
                  {d.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p, pi) => (
              <tr key={p.digits} className={pi % 2 ? 'bg-blue-50/60' : 'bg-white'}>
                <td className="py-1 font-semibold tabular-nums text-gray-600">{p.digits}</td>
                {round.grid.map((day, d) => {
                  const it = item(day[pi]!);
                  return (
                    <td key={d} className={`px-0.5 py-1 ${lit.has(`${d}-${pi}`) ? 'bg-yellow-200 font-semibold' : ''}`}>
                      <div className="text-base leading-none">{it?.icon}</div>
                      <div className="break-words">{it?.en}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {done ? (
        <Score score={score} total={round.qs.length} reward={reward} again={start} />
      ) : q ? (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{t('Question {n} of {total}', { n: i + 1, total: round.qs.length })}</span>
            <span>⭐ {score}</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-2">
            <span className="text-2xl">👩‍🏫</span>
            <span className="flex-1 text-base font-semibold" dir="ltr">
              {q.q}
            </span>
            <button type="button" onClick={() => teacherSays(q.q)} className="min-h-11 min-w-11 rounded-full bg-blue-600 text-lg text-white" aria-label={t('Listen')}>
              🔊
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {q.options.map((o) => {
              const cls = picked && o === q.answer ? 'border-green-500 bg-green-50' : picked === o ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white';
              return (
                <button key={o} type="button" disabled={!!picked} onClick={() => answer(o)} className={`min-h-11 rounded-xl border px-2 text-sm ${cls}`} dir="ltr">
                  {o}
                </button>
              );
            })}
          </div>
          {picked ? (
            <button type="button" onClick={next} className="min-h-11 w-full rounded-lg bg-blue-600 text-sm font-semibold text-white">
              {i + 1 < round.qs.length ? `${t('Next')} →` : `🏁 ${t('Finish')}`}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** School: spelling bee (listen and type school words) and timetable questions. */
export default function SchoolActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  const [mode, setMode] = useState<'bee' | 'timetable' | 'play'>('bee');
  const modes = [
    ['bee', `🐝 ${t('Spelling bee')}`],
    ['timetable', `🗓️ ${t('Timetable')}`],
    ['play', `🪢 ${t('Playtime')}`],
  ] as const;
  return (
    <div>
      <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
        {modes.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`min-h-10 rounded-lg text-sm font-semibold ${mode === id ? 'bg-white text-blue-700 shadow' : 'text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'bee' ? <Spelling content={content} /> : mode === 'timetable' ? <Timetable content={content} /> : <Playtime />}
    </div>
  );
}

/** Playtime in the school yard: skipping rope (count in English), and a spelling bee against another team. */
function Playtime() {
  const t = useT();
  return (
    <div className="space-y-2 py-1">
      <button
        type="button"
        onClick={() => {
          useArea.getState().setPanel(false);
          useMini.getState().start('jumprope');
        }}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-pink-300 bg-pink-50 px-3 py-2 text-start"
      >
        <span className="text-3xl">🪢</span>
        <span>
          <b className="block text-sm">{t('Skipping rope')}</b>
          <span className="text-xs text-gray-600">{t('Jump when the rope touches the ground. Count your jumps in English! It gets faster.')}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          useArea.getState().setPanel(false);
          useTeamGame.getState().setOpen(true);
          useTeamGame.getState().pick('spell');
        }}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-start"
      >
        <span className="text-3xl">🐝</span>
        <span>
          <b className="block text-sm">{t('Spelling bee: team against team')}</b>
          <span className="text-xs text-gray-600">{t('Play with other players (or robots) in 🏆 Team games.')}</span>
        </span>
      </button>
    </div>
  );
}
