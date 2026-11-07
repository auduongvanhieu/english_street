import { useMini } from '../../../store/minigames';
import { useEffect, useRef, useState } from 'react';
import type { AreaContentDto } from '@es/shared';
import { sendAreaQuiz } from '../../../net/api';
import { track } from '../../../net/analytics';
import { useArea } from '../../../store/area';
import { useGame } from '../../../store/game';
import { useProfile } from '../../../store/profile';
import { gamesInHall } from '../../../world/places/sports';
import { useLang, useT } from '../../../i18n';
import { say } from '../common';

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

/** Real weather: rain or storm moves the games into the sports hall (polled, sky.kind changes slowly). */
function useRainy() {
  const [rainy, setRainy] = useState(gamesInHall);
  useEffect(() => {
    const iv = setInterval(() => setRainy(gamesInHall()), 2000);
    return () => clearInterval(iv);
  }, []);
  return rainy;
}

/** Make the local character move a little (local one-shot animation, same as the emote keys). */
const emote = (name: string) => useGame.getState().playEmote(name);

// ---------------------------------------------------------------- Coach says
type Action = 'kick' | 'throw' | 'catch' | 'jump' | 'run' | 'hit' | 'swim' | 'stretch';
const ACTIONS: { id: Action; icon: string; anim: string }[] = [
  { id: 'kick', icon: '🦵', anim: 'yes' },
  { id: 'throw', icon: '🤾', anim: 'wave' },
  { id: 'catch', icon: '🧤', anim: 'thumbsup' },
  { id: 'jump', icon: '🦘', anim: 'jump' },
  { id: 'run', icon: '🏃', anim: 'run' },
  { id: 'hit', icon: '🏏', anim: 'wave' },
  { id: 'swim', icon: '🏊', anim: 'dance' },
  { id: 'stretch', icon: '🙆', anim: 'dance' },
];
const COMMANDS: [string, Action][] = [
  ['Kick the ball!', 'kick'],
  ['Kick it into the goal!', 'kick'],
  ['Kick the ball to your friend!', 'kick'],
  ['Throw the ball to the left!', 'throw'],
  ['Throw it higher!', 'throw'],
  ['Throw the ball through the hoop!', 'throw'],
  ['Catch the ball!', 'catch'],
  ['Catch it with both hands!', 'catch'],
  ['Jump three times!', 'jump'],
  ['Jump as high as you can!', 'jump'],
  ['Jump over the line!', 'jump'],
  ['Run faster!', 'run'],
  ['Run to the finish line!', 'run'],
  ['Run around the court!', 'run'],
  ['Hit the ball with your racket!', 'hit'],
  ['Hit it over the net!', 'hit'],
  ['Swim to the other side!', 'swim'],
  ['Swim like a fish!', 'swim'],
  ['Stretch your arms up high!', 'stretch'],
  ['Touch your toes and stretch!', 'stretch'],
];
const ROUND = 10;
const START_S = 7;
const MIN_S = 3;

function CoachSays({ content, rainy, onDone }: { content: AreaContentDto; rainy: boolean; onDone: (c: number, n: number, wrong: string[]) => Promise<void> }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  // indoors there is no pool: no swimming commands
  const actions = ACTIONS.filter((a) => !(rainy && a.id === 'swim'));
  const [cmds] = useState(() => {
    const pool = shuffle(COMMANDS.filter(([, a]) => actions.some((x) => x.id === a)));
    return pool.slice(0, ROUND);
  });
  const [listenOnly, setListenOnly] = useState(false);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [picked, setPicked] = useState<Action | 'timeout' | null>(null);
  const [left, setLeft] = useState(START_S);
  const limit = useRef(START_S);
  const started = useRef(0);
  const cmd = cmds[i];

  // say the command and start its timer
  useEffect(() => {
    if (!cmd) return;
    say(cmd[0]);
    started.current = performance.now();
    setLeft(limit.current);
  }, [cmd]);
  useEffect(() => {
    if (picked || !cmd) return;
    const iv = setInterval(() => {
      const l = limit.current - (performance.now() - started.current) / 1000;
      setLeft(Math.max(0, l));
      if (l <= 0) {
        setPicked('timeout');
        setWrong((w) => [...w, cmd[1]]);
        emote('no');
      }
    }, 100);
    return () => clearInterval(iv);
  }, [picked, cmd]);
  // after an answer: short pause, then the next command (faster after a right answer)
  useEffect(() => {
    if (!picked) return;
    const ok = picked === cmd?.[1];
    const to = setTimeout(
      () => {
        if (i + 1 >= cmds.length) {
          emote('dance');
          void onDone(score, cmds.length, wrong);
          return;
        }
        setPicked(null);
        setI(i + 1);
      },
      ok ? 900 : 1800,
    );
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const tap = (a: Action) => {
    if (picked || !cmd) return;
    setPicked(a);
    if (a === cmd[1]) {
      setScore((s) => s + 1);
      limit.current = Math.max(MIN_S, limit.current - 0.5);
      emote(ACTIONS.find((x) => x.id === a)!.anim);
    } else {
      setWrong((w) => [...w, cmd[1]]);
      emote('no');
    }
  };
  if (!cmd) return null;
  const item = (id: string) => content.items.find((x) => x.id === id);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t('Command {n} of {total}', { n: i + 1, total: cmds.length })}</span>
        <label className="flex min-h-8 items-center gap-1.5">
          <input type="checkbox" checked={listenOnly} onChange={(e) => setListenOnly(e.target.checked)} />
          {t('Listening only')}
        </label>
        <span>⭐ {score}</span>
      </div>
      <div className="rounded-xl bg-green-50 p-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🧢</span>
          <div className="flex-1">
            <div className="text-[11px] text-gray-500">Coach Max:</div>
            <div className="text-lg font-bold" dir="ltr">
              {listenOnly && !picked ? '🔊 …' : `“${cmd[0]}”`}
            </div>
          </div>
          <button type="button" onClick={() => say(cmd[0])} className="min-h-11 min-w-11 rounded-full bg-green-600 text-lg text-white" aria-label={t('Listen')}>
            🔊
          </button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-green-100">
          <div className={`h-full rounded-full transition-[width] duration-100 ${left < 2 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${(left / limit.current) * 100}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {actions.map((a) => {
          const st = !picked ? 'bg-white active:scale-95' : a.id === cmd[1] ? 'border-green-500 bg-green-50' : a.id === picked ? 'border-red-400 bg-red-50' : 'opacity-50';
          return (
            <button key={a.id} type="button" disabled={!!picked} onClick={() => tap(a.id)} className={`min-h-16 rounded-xl border-2 px-1 py-1 text-center transition ${st}`}>
              <div className="text-3xl">{a.icon}</div>
              <div className="text-xs font-semibold" dir="ltr">
                {a.id}
              </div>
              {!noTr && item(a.id)?.tr.meaning ? <div className="truncate text-[10px] text-gray-500">{item(a.id)!.tr.meaning}</div> : null}
            </button>
          );
        })}
      </div>
      {picked ? (
        <p className={`text-center text-sm font-semibold ${picked === cmd[1] ? 'text-green-700' : 'text-red-600'}`}>
          {picked === cmd[1] ? `✓ ${t('Well done!')}` : picked === 'timeout' ? `⏰ ${t('Too slow!')} → ${cmd[1]}` : `✗ → ${cmd[1]}`}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Which sport? (+ play / go / do)
type Verb = 'play' | 'go' | 'do';
const CLUES: { sport: string; verb: Verb; clue: string }[] = [
  { sport: 'badminton', verb: 'play', clue: 'You hit a shuttlecock over a high net with a light racket.' },
  { sport: 'football', verb: 'play', clue: 'You kick a ball into a goal. There are eleven players in a team.' },
  { sport: 'basketball', verb: 'play', clue: 'You bounce the ball and throw it through a hoop.' },
  { sport: 'swimming', verb: 'go', clue: 'You do it in a pool, a river or the sea.' },
  { sport: 'cycling', verb: 'go', clue: 'You ride a bike, and you should wear a helmet.' },
  { sport: 'table-tennis', verb: 'play', clue: 'You hit a very small, light ball over a net on a table.' },
  { sport: 'volleyball', verb: 'play', clue: 'You hit the ball over a net with your hands. People often play it on the beach.' },
  { sport: 'martial-arts', verb: 'do', clue: 'You wear a white uniform and a belt. It comes from Japan.' },
  { sport: 'yoga', verb: 'do', clue: 'You stretch and breathe slowly. It helps you relax.' },
  { sport: 'tennis', verb: 'play', clue: 'You need a racket and a yellow ball. You play it on a court.' },
  { sport: 'skateboarding', verb: 'go', clue: 'You ride a board with four small wheels and do tricks.' },
  { sport: 'gymnastics', verb: 'do', clue: 'You jump, turn and balance. Sometimes you use rings or a beam.' },
  { sport: 'running', verb: 'go', clue: 'You only need good trainers. The faster you are, the better.' },
];
const SPORT_Q = 6;

function WhichSport({ content, onDone }: { content: AreaContentDto; onDone: (c: number, n: number, wrong: string[]) => Promise<void> }) {
  const t = useT();
  const items = content.items;
  const [qs] = useState(() =>
    shuffle(CLUES.filter((c) => items.some((it) => it.id === c.sport)))
      .slice(0, SPORT_Q)
      .map((c) => ({ ...c, options: shuffle([c.sport, ...shuffle(CLUES.filter((x) => x.sport !== c.sport && items.some((it) => it.id === x.sport))).slice(0, 3).map((x) => x.sport)]) })),
  );
  const [i, setI] = useState(0);
  const [sport, setSport] = useState<string | null>(null);
  const [verb, setVerb] = useState<Verb | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const q = qs[i];
  useEffect(() => {
    if (q) say(q.clue);
  }, [q]);
  if (!q) return null;
  const item = (id: string) => items.find((x) => x.id === id);
  const name = (id: string) => item(id)?.en ?? id;
  const pickSport = (s: string) => {
    setSport(s);
    if (s === q.sport) setScore((n) => n + 1);
    else setWrong((w) => [...w, q.sport]);
  };
  const pickVerb = (v: Verb) => {
    setVerb(v);
    const ok = v === q.verb;
    if (ok) setScore((n) => n + 1);
    else setWrong((w) => [...w, q.sport]);
    say(`I ${q.verb} ${name(q.sport)}.`);
    emote(ok ? 'thumbsup' : 'no');
  };
  const next = () => {
    if (i + 1 >= qs.length) {
      void onDone(score, qs.length * 2, wrong);
      return;
    }
    setI(i + 1);
    setSport(null);
    setVerb(null);
  };
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">{t('Question {n} of {total}', { n: i + 1, total: qs.length })} · ⭐ {score}</div>
      <div className="flex items-start gap-2 rounded-xl bg-green-50 p-3">
        <span className="text-2xl">🤔</span>
        <p className="flex-1 text-base" dir="ltr">
          {q.clue}
        </p>
        <button type="button" onClick={() => say(q.clue)} className="min-h-11 min-w-11 rounded-full bg-green-600 text-white" aria-label={t('Listen')}>
          🔊
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {q.options.map((s) => {
          const st = sport === null ? 'bg-white' : s === q.sport ? 'border-green-500 bg-green-50' : s === sport ? 'border-red-400 bg-red-50' : 'opacity-50';
          return (
            <button key={s} type="button" disabled={sport !== null} onClick={() => pickSport(s)} className={`min-h-12 rounded-xl border-2 px-2 text-sm font-medium ${st}`} dir="ltr">
              <span className="text-xl">{item(s)?.icon}</span> {name(s)}
            </button>
          );
        })}
      </div>
      {sport !== null ? (
        <div className="rounded-xl border p-3">
          <p className="mb-2 text-sm" dir="ltr">
            I ___ {name(q.sport)}.
          </p>
          <div className="flex gap-1.5">
            {(['play', 'go', 'do'] as Verb[]).map((v) => {
              const st = verb === null ? 'bg-white' : v === q.verb ? 'border-green-500 bg-green-50' : v === verb ? 'border-red-400 bg-red-50' : 'opacity-50';
              return (
                <button key={v} type="button" disabled={verb !== null} onClick={() => pickVerb(v)} className={`min-h-11 flex-1 rounded-lg border-2 text-sm font-semibold ${st}`}>
                  {v}
                </button>
              );
            })}
          </div>
          {verb !== null ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm" dir="ltr">
                ✓ I <b>{q.verb}</b> {name(q.sport)}.
              </span>
              <button type="button" onClick={next} className="min-h-11 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white">
                {i + 1 >= qs.length ? t('Finish') : t('Next')} →
              </button>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-gray-500">{t('Tip: play + ball games, go + -ing sports, do + the others.')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- the tab
type Game = 'coach' | 'sport';

/** 🏃 Mini games: follow the coach's commands against the clock, and guess the sport (+ play / go / do). */
export default function SportsActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  const rainy = useRainy();
  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ game: Game; correct: number; total: number; xp: number; coins: number; capped: boolean } | null>(null);
  const weatherLine = rainy ? "It's raining today, so the games are in the sports hall!" : "It's a nice day, so we're playing outside!";
  const done = (g: Game) => async (correct: number, total: number, wrong: string[]) => {
    let r = { xp: 0, coins: 0, capped: false };
    try {
      const res = await sendAreaQuiz('sports', correct, total, wrong);
      r = res;
      if (res.badge) useArea.getState().showBadge(res.badge);
      void useProfile.getState().refresh();
    } catch {
      /* offline: no reward */
    }
    track(g === 'coach' ? 'sports_coach_done' : 'sports_which_done', { correct, total, rainy });
    setResult({ game: g, correct, total, ...r });
  };
  const start = (g: Game) => {
    setGame(g);
    setResult(null);
    setRound((n) => n + 1);
  };
  const back = () => {
    setGame(null);
    setResult(null);
  };

  const banner = (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${rainy ? 'bg-sky-100 text-sky-900' : 'bg-amber-50 text-amber-900'}`}>
      <span className="text-xl">{rainy ? '☔' : '☀️'}</span>
      <span className="flex-1" dir="ltr">
        {weatherLine}
      </span>
      <button type="button" onClick={() => say(weatherLine)} className="text-xs" aria-label={t('Listen')}>
        🔊
      </button>
    </div>
  );

  if (result)
    return (
      <div className="space-y-3 py-4 text-center">
        <div className="text-4xl">{result.correct === result.total ? '🏆' : result.correct >= result.total * 0.6 ? '🥇' : '💪'}</div>
        <p className="text-lg font-bold">{t('{score} / {total} correct', { score: result.correct, total: result.total })}</p>
        <p className="text-sm text-emerald-700">
          +{result.xp} XP{result.coins ? ` · +${result.coins} 🪙` : ''} {result.capped ? `(${t('daily quiz limit reached')})` : ''}
        </p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => start(result.game)} className="min-h-11 rounded-lg bg-green-600 px-5 text-sm font-semibold text-white">
            ↻ {t('Play again')}
          </button>
          <button type="button" onClick={back} className="min-h-11 rounded-lg border px-5 text-sm">
            {t('Back')}
          </button>
        </div>
      </div>
    );

  if (!game)
    return (
      <div className="space-y-3 py-2">
        {banner}
        <button
          type="button"
          onClick={() => {
            say(`${weatherLine} Listen to me and do it fast!`);
            start('coach');
          }}
          className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-green-300 bg-green-50 px-3 py-2 text-start"
        >
          <span className="text-3xl">📣</span>
          <span>
            <b className="block text-sm">{t('Coach says!')}</b>
            <span className="text-xs text-gray-600">{t('Listen to Coach Max and tap the right action before time runs out. It gets faster!')}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            useArea.getState().setPanel(false);
            useMini.getState().start('pingpong');
          }}
          className={`flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-start ${rainy ? 'border-sky-400 bg-sky-50' : 'border-sky-200 bg-white'}`}
        >
          <span className="text-3xl">🏓</span>
          <span>
            <b className="block text-sm">{t('Table tennis in the sports hall')}</b>
            <span className="text-xs text-gray-600">{rainy ? t('It is raining: play inside! Listen to the coach and hit the ball the right way.') : t('Listen to the coach: left, right, short or long. First to 7 wins.')}</span>
          </span>
        </button>
        <button type="button" onClick={() => start('sport')} className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-start">
          <span className="text-3xl">🤔</span>
          <span>
            <b className="block text-sm">{t('Which sport?')}</b>
            <span className="text-xs text-gray-600">{t('Read or listen to the clue, guess the sport, then choose play, go or do.')}</span>
          </span>
        </button>
      </div>
    );

  return (
    <div className="space-y-2 py-2">
      <button type="button" onClick={back} className="text-xs text-blue-700 hover:underline">
        ← {t('Back')}
      </button>
      {game === 'coach' ? <CoachSays key={round} content={content} rainy={rainy} onDone={done('coach')} /> : <WhichSport key={round} content={content} onDone={done('sport')} />}
    </div>
  );
}
