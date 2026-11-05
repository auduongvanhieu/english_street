import { useEffect, useMemo, useRef, useState } from 'react';
import { vnHour, type AreaContentDto } from '@es/shared';
import { sendAreaQuiz } from '../../../net/api';
import { track } from '../../../net/analytics';
import { useProfile } from '../../../store/profile';
import { useArea } from '../../../store/area';
import { useLang, useT } from '../../../i18n';
import { say } from '../common';

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;
const mumSays = (s: string, slow = false) => say(s, 'en-GB', slow);

type Reward = { xp: number; coins: number; capped: boolean } | null;
/** Send a finished round (XP/coins, area quiz pass at ≥ 80 %) and refresh the profile. */
async function finish(correct: number, total: number, wrong: string[], event: string): Promise<Reward> {
  track(event, { correct, total });
  try {
    const r = await sendAreaQuiz('home', correct, total, wrong);
    if (r.badge) useArea.getState().showBadge(r.badge);
    void useProfile.getState().refresh();
    return r;
  } catch {
    return null; // offline: no reward
  }
}

function Score({ score, total, reward, again }: { score: number; total: number; reward: Reward; again: () => void }) {
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
      <button type="button" onClick={again} className="mt-3 min-h-11 rounded-lg bg-orange-500 px-6 text-sm font-semibold text-white">
        ↻ {t('Play again')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- 🧹 Tidy the room

/** Places in the room picture: centre in % of the picture (x from the left, y from the bottom). */
interface Spot {
  id: string;
  phrases: string[];
  x: number;
  y: number;
  /** Where the placed thing is drawn relative to the furniture: behind it (z below) or in front. */
  z: number;
}
const SPOTS: Spot[] = [
  { id: 'shelf', phrases: ['on the shelf'], x: 14, y: 81, z: 3 },
  { id: 'on-bed', phrases: ['on the bed'], x: 14, y: 39, z: 3 },
  { id: 'under-bed', phrases: ['under the bed'], x: 14, y: 12, z: 3 },
  { id: 'bed-sofa', phrases: ['between the bed and the sofa', 'next to the bed'], x: 31, y: 12, z: 3 },
  { id: 'on-sofa', phrases: ['on the sofa'], x: 47, y: 34, z: 3 },
  { id: 'behind-sofa', phrases: ['behind the sofa'], x: 47, y: 54, z: 1 },
  { id: 'front-sofa', phrases: ['in front of the sofa'], x: 47, y: 9, z: 4 },
  { id: 'on-desk', phrases: ['on the desk'], x: 70, y: 57, z: 3 },
  { id: 'under-desk', phrases: ['under the desk'], x: 70, y: 13, z: 3 },
  { id: 'desk-box', phrases: ['between the desk and the box', 'next to the box'], x: 83.5, y: 12, z: 3 },
  { id: 'in-box', phrases: ['in the box'], x: 93, y: 15, z: 1 },
];
const THINGS = [
  { id: 'ball', en: 'ball', icon: '⚽' },
  { id: 'teddy-bear', en: 'teddy bear', icon: '🧸' },
  { id: 'book', en: 'book', icon: '📕' },
  { id: 'cup', en: 'cup', icon: '☕' },
  { id: 'cat', en: 'cat', icon: '🐱' },
  { id: 'shoes', en: 'shoes', icon: '👟' },
  { id: 'plant', en: 'plant', icon: '🪴' },
  { id: 'bag', en: 'bag', icon: '🎒' },
  { id: 'keys', en: 'keys', icon: '🔑' },
  { id: 'guitar', en: 'guitar', icon: '🎸' },
  { id: 'car', en: 'toy car', icon: '🚗' },
  { id: 'clock', en: 'clock', icon: '⏰' },
];
type Thing = (typeof THINGS)[number];
const TASKS = 7;

interface Task {
  thing: Thing;
  spot: Spot;
  text: string;
}
function newRound(): { tasks: Task[]; tray: Thing[] } {
  const things = shuffle(THINGS).slice(0, TASKS + 2);
  const spots = shuffle(SPOTS).slice(0, TASKS);
  const tasks = spots.map((spot, i) => {
    const thing = things[i]!;
    return { thing, spot, text: `Put the ${thing.en} ${pick(spot.phrases)}.` };
  });
  return { tasks, tray: shuffle(things) };
}

/** The room as a side view: shelf, bed, sofa, desk and a toy box drawn with CSS. */
function Room({ placed, onSpot, active }: { placed: Record<string, string>; onSpot: (s: Spot) => void; active: boolean }) {
  const t = useT();
  const at = (l: number, b: number, w: number, h: number, z = 2) => ({ left: `${l}%`, bottom: `${b}%`, width: `${w}%`, height: `${h}%`, zIndex: z });
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md select-none overflow-hidden rounded-xl bg-[#fdf1dc] shadow-inner" dir="ltr">
      {/* window and floor */}
      <div className="absolute rounded border-4 border-white bg-sky-200" style={{ left: '38%', bottom: '66%', width: '18%', height: '24%' }} />
      <div className="absolute inset-x-0 bottom-0 bg-[#d8b48a]" style={{ height: '6%' }} />
      {/* shelf */}
      <div className="absolute rounded-sm bg-[#8b5a2b]" style={at(3, 72, 22, 2.5)} />
      {/* bed: headboard, legs, frame, mattress, pillow */}
      <div className="absolute rounded-t-lg bg-[#8b5a2b]" style={at(2, 4, 3, 40)} />
      <div className="absolute bg-[#6b4226]" style={at(23.5, 4, 2, 16)} />
      <div className="absolute rounded bg-[#8b5a2b]" style={at(2, 18, 24, 6)} />
      <div className="absolute rounded-md bg-[#e85d75]" style={at(4, 24, 22, 7)} />
      <div className="absolute rounded-md bg-white" style={at(5, 28, 7, 5)} />
      {/* sofa: back, seat, arms */}
      <div className="absolute rounded-t-xl bg-[#4a76c9]" style={at(37, 26, 20, 22)} />
      <div className="absolute rounded-md bg-[#5b8def]" style={at(36, 4, 22, 22)} />
      <div className="absolute rounded-md bg-[#4a76c9]" style={at(35, 4, 4, 28)} />
      <div className="absolute rounded-md bg-[#4a76c9]" style={at(55, 4, 4, 28)} />
      {/* desk */}
      <div className="absolute rounded-sm bg-[#c48a5a]" style={at(60, 44, 21, 4)} />
      <div className="absolute bg-[#a06a40]" style={at(61, 4, 2, 40)} />
      <div className="absolute bg-[#a06a40]" style={at(78, 4, 2, 40)} />
      {/* toy box: back and front (the front hides what is in it) */}
      <div className="absolute rounded-sm bg-[#d9a52f]" style={at(87, 4, 12, 22, 0)} />
      <div className="absolute rounded-sm border-t-4 border-[#b9861f] bg-[#f2c94c]" style={at(87, 4, 12, 14, 2)} />
      {SPOTS.map((s) => {
        const icon = placed[s.id];
        return (
          <div key={s.id}>
            {icon ? (
              <span className="pointer-events-none absolute -translate-x-1/2 translate-y-1/2 text-[28px] leading-none" style={{ left: `${s.x}%`, bottom: `${s.y}%`, zIndex: s.z }}>
                {icon}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={t('Put it here')}
              disabled={!active || !!icon}
              onClick={() => onSpot(s)}
              className={`absolute h-11 w-11 -translate-x-1/2 translate-y-1/2 rounded-full ${active && !icon ? 'border-2 border-dashed border-orange-500/70 bg-white/25 hover:bg-orange-200/50' : ''}`}
              style={{ left: `${s.x}%`, bottom: `${s.y}%`, zIndex: 10 }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Tidy({ content }: { content: AreaContentDto }) {
  const t = useT();
  const [round, setRound] = useState<ReturnType<typeof newRound> | null>(null);
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [missed, setMissed] = useState<string[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [listenOnly, setListenOnly] = useState(false);
  const [reward, setReward] = useState<Reward>(null);
  const busy = useRef(false);
  const task = round?.tasks[i];
  const done = round && i >= round.tasks.length;

  const start = () => {
    const r = newRound();
    setRound(r);
    setI(0);
    setSel(null);
    setPlaced({});
    setMissed([]);
    setNote(null);
    setReward(null);
    mumSays(r.tasks[0]!.text);
  };
  const miss = (id: string) => setMissed((m) => (m.includes(id) ? m : [...m, id]));
  const onSpot = (s: Spot) => {
    if (!round || !task || busy.current) return;
    if (!sel) return setNote({ ok: false, text: t('First tap a thing, then tap the place.') });
    const thing = THINGS.find((x) => x.id === sel)!;
    if (sel !== task.thing.id) {
      miss(task.thing.id);
      setSel(null);
      return setNote({ ok: false, text: t("That's the {thing}. Listen again!", { thing: thing.en }) });
    }
    if (s.id !== task.spot.id) {
      miss(task.thing.id);
      return setNote({ ok: false, text: t('Oops! That is {place}. Try again.', { place: s.phrases[0]! }) });
    }
    setPlaced((p) => ({ ...p, [s.id]: thing.icon }));
    setSel(null);
    setNote({ ok: true, text: pick(['Well done!', 'Great job!', 'Thank you!', 'Perfect!']) });
    busy.current = true;
    setTimeout(() => {
      busy.current = false;
      const n = i + 1;
      setI(n);
      setNote(null);
      if (n < round.tasks.length) mumSays(round.tasks[n]!.text);
      else {
        const score = round.tasks.length - missed.length;
        mumSays('Thank you! The room looks lovely now.');
        const known = new Set(content.items.map((x) => x.id));
        void finish(score, round.tasks.length, missed.filter((m) => known.has(m)), 'home_tidy_done').then(setReward);
      }
    }, 900);
  };

  if (!round)
    return (
      <div className="py-3 text-center">
        <div className="text-4xl">🧹</div>
        <p className="mx-auto mb-3 max-w-sm text-sm text-gray-600">{t('Mum asks you to tidy the room. Listen, tap the thing, then tap the right place.')}</p>
        <button type="button" onClick={start} className="min-h-11 rounded-lg bg-orange-500 px-6 text-sm font-semibold text-white">
          ▶ {t('Start')}
        </button>
      </div>
    );
  if (done) return <Score score={round.tasks.length - missed.length} total={round.tasks.length} reward={reward} again={start} />;
  if (!task) return null;
  const tray = round.tray.filter((x) => !Object.values(placed).includes(x.icon));
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t('Task {n} of {total}', { n: i + 1, total: round.tasks.length })}</span>
        <label className="flex min-h-8 items-center gap-1">
          <input type="checkbox" checked={listenOnly} onChange={(e) => setListenOnly(e.target.checked)} /> 👂 {t('Listen only')}
        </label>
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-orange-50 p-2">
        <span className="text-2xl">👩</span>
        <span className="flex-1 text-base font-semibold" dir="ltr">
          {listenOnly ? '…' : `“${task.text}”`}
        </span>
        <button type="button" onClick={() => mumSays(task.text)} className="min-h-11 min-w-11 rounded-full bg-orange-500 text-lg text-white" aria-label={t('Listen')}>
          🔊
        </button>
        <button type="button" onClick={() => mumSays(task.text, true)} className="min-h-11 min-w-11 rounded-full border border-orange-300 bg-white text-lg" aria-label={t('Listen slowly')}>
          🐢
        </button>
      </div>
      <Room placed={placed} onSpot={onSpot} active />
      <div className="flex flex-wrap justify-center gap-1.5">
        {tray.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => {
              setSel(x.id);
              say(x.en, 'en-GB');
            }}
            className={`flex min-h-11 min-w-11 flex-col items-center rounded-xl border px-2 py-1 ${sel === x.id ? 'border-orange-500 bg-orange-100 ring-2 ring-orange-400' : 'border-gray-200 bg-white'}`}
          >
            <span className="text-2xl leading-none">{x.icon}</span>
            <span className="text-[11px] text-gray-600" dir="ltr">
              {x.en}
            </span>
          </button>
        ))}
      </div>
      {note ? <div className={`rounded-lg px-3 py-1.5 text-center text-sm ${note.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>{note.text}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- 🕖 My day

interface Act {
  id: string;
  /** "I … at …" */
  en: string;
  icon: string;
}
/** The day in slots (in time order); each slot has a few activities that fit there and a time range in hours. */
const SLOTS: { acts: Act[]; from: number; to: number }[] = [
  { acts: [{ id: 'get-up', en: 'get up', icon: '⏰' }], from: 5.5, to: 7 },
  {
    acts: [
      { id: 'brush-my-teeth', en: 'brush my teeth', icon: '🦷' },
      { id: 'have-a-shower', en: 'have a shower', icon: '🚿' },
      { id: 'get-dressed', en: 'get dressed', icon: '👕' },
    ],
    from: 6,
    to: 7,
  },
  { acts: [{ id: 'have-breakfast', en: 'have breakfast', icon: '🥞' }], from: 6.5, to: 7.5 },
  { acts: [{ id: 'go-to-school', en: 'go to school', icon: '🚌' }], from: 7, to: 8 },
  { acts: [{ id: 'have-lunch', en: 'have lunch', icon: '🍱' }], from: 11, to: 12.5 },
  {
    acts: [
      { id: 'go-home', en: 'go home', icon: '🏠' },
      { id: 'play-football', en: 'play football', icon: '⚽' },
    ],
    from: 16,
    to: 17.5,
  },
  { acts: [{ id: 'do-my-homework', en: 'do my homework', icon: '📝' }], from: 17, to: 18.5 },
  { acts: [{ id: 'have-dinner', en: 'have dinner', icon: '🍝' }], from: 18, to: 19.5 },
  {
    acts: [
      { id: 'watch-tv', en: 'watch TV', icon: '📺' },
      { id: 'read-a-book', en: 'read a book', icon: '📖' },
    ],
    from: 19.5,
    to: 20.5,
  },
  { acts: [{ id: 'go-to-bed', en: 'go to bed', icon: '😴' }], from: 21, to: 22.5 },
];
const CARDS = 6;
const NUM = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
const h12 = (t: number) => Math.floor(t) % 12;
/** 6.5 → "half past six", 7 → "seven o'clock". */
const timeWords = (t: number) => (t % 1 ? `half past ${NUM[h12(t)]}` : `${NUM[h12(t)]} o'clock`);
const timeDigits = (t: number) => `${h12(t) || 12}:${t % 1 ? '30' : '00'} ${t < 12 ? 'am' : 'pm'}`;
const clockIcon = (t: number) => String.fromCodePoint((t % 1 ? 0x1f55c : 0x1f550) + ((h12(t) + 11) % 12));

interface DayCard extends Act {
  time: number;
}
function newDay(): DayCard[] {
  const middle = shuffle(SLOTS.slice(1, -1).map((_, i) => i + 1))
    .slice(0, CARDS - 2)
    .sort((a, b) => a - b);
  let prev = 0;
  return [0, ...middle, SLOTS.length - 1].map((si) => {
    const s = SLOTS[si]!;
    const opts: number[] = [];
    for (let t = s.from; t <= s.to; t += 0.5) if (t > prev) opts.push(t);
    const time = opts.length ? pick(opts) : prev + 0.5;
    prev = time;
    return { ...pick(s.acts), time };
  });
}
function timeOptions(t: number) {
  const near = shuffle([t - 1, t - 0.5, t + 0.5, t + 1].filter((x) => x > 0 && x < 24)).slice(0, 2);
  return shuffle([t, ...near]);
}

function MyDay({ content }: { content: AreaContentDto }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const [day, setDay] = useState<DayCard[] | null>(null);
  const [deck, setDeck] = useState<DayCard[]>([]);
  const [order, setOrder] = useState<DayCard[]>([]);
  /** order checked: how many were in the right place */
  const [orderScore, setOrderScore] = useState<number | null>(null);
  const [ti, setTi] = useState(0);
  const [opts, setOpts] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeScore, setTimeScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [reward, setReward] = useState<Reward>(null);
  const tr = (id: string) => (noTr ? '' : (content.items.find((x) => x.id === id)?.tr.meaning ?? ''));
  const now = vnHour(Date.now());

  const start = () => {
    const d = newDay();
    setDay(d);
    setDeck(shuffle(d));
    setOrder([]);
    setOrderScore(null);
    setTi(0);
    setPicked(null);
    setTimeScore(0);
    setWrong([]);
    setReward(null);
  };
  const check = () => {
    if (!day) return;
    const ok = order.filter((c, k) => c.id === day[k]!.id).length;
    setOrderScore(ok);
    setWrong(order.filter((c, k) => c.id !== day[k]!.id).map((c) => c.id));
    setOrder(day);
    setOpts(timeOptions(day[0]!.time));
  };
  const answer = (x: number) => {
    if (!day || picked !== null) return;
    const card = day[ti]!;
    setPicked(x);
    const ok = x === card.time;
    if (ok) setTimeScore((s) => s + 1);
    else setWrong((w) => (w.includes(card.id) ? w : [...w, card.id]));
    mumSays(`I ${card.en} at ${timeWords(card.time)}.`);
  };
  const nextTime = () => {
    if (!day) return;
    const n = ti + 1;
    setTi(n);
    setPicked(null);
    if (n < day.length) setOpts(timeOptions(day[n]!.time));
    else {
      const known = new Set(content.items.map((x) => x.id));
      void finish((orderScore ?? 0) + timeScore, day.length * 2, wrong.filter((w) => known.has(w)), 'home_day_done').then(setReward);
    }
  };
  useEffect(() => {
    if (day && orderScore === null && order.length === day.length) mumSays('Good! Now check your order.');
  }, [order.length, day, orderScore]);

  if (!day)
    return (
      <div className="py-3 text-center">
        <div className="text-4xl">🕖</div>
        <p className="mx-auto mb-1 max-w-sm text-sm text-gray-600">{t('Put the day in order, then match the times. Mum reads your day back to you.')}</p>
        <p className="mb-3 text-xs text-gray-500">
          🇻🇳 {t('Vietnam time now')}: {timeDigits(Math.floor(now * 2) / 2)}
        </p>
        <button type="button" onClick={start} className="min-h-11 rounded-lg bg-orange-500 px-6 text-sm font-semibold text-white">
          ▶ {t('Start')}
        </button>
      </div>
    );

  // step 1: put the cards in order
  if (orderScore === null)
    return (
      <div className="space-y-2 py-1">
        <p className="text-sm">{t('Tap the cards in order, from morning to night.')}</p>
        <ol className="min-h-24 space-y-1 rounded-xl bg-orange-50 p-2">
          {order.length === 0 ? <li className="py-6 text-center text-xs text-gray-400">{t('Your day is empty. Tap a card below.')}</li> : null}
          {order.map((c, k) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOrder((o) => o.filter((x) => x.id !== c.id))} className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-white px-2 text-left shadow-sm" title={t('Tap to take it out')}>
                <span className="w-5 text-xs text-gray-400">{k + 1}.</span>
                <span className="text-xl">{c.icon}</span>
                <span className="flex-1 text-sm" dir="ltr">
                  {c.en}
                </span>
                <span className="text-xs text-gray-400">✕</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-1.5">
          {deck
            .filter((c) => !order.includes(c))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setOrder((o) => [...o, c]);
                  mumSays(c.en);
                }}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 text-left"
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-sm leading-tight" dir="ltr">
                  {c.en}
                  {tr(c.id) ? <span className="block text-[11px] text-gray-500">{tr(c.id)}</span> : null}
                </span>
              </button>
            ))}
        </div>
        <button type="button" disabled={order.length < day.length} onClick={check} className="min-h-11 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white disabled:opacity-40">
          ✓ {t('Check my order')}
        </button>
      </div>
    );

  // step 3: read my day back
  if (ti >= day.length) {
    const lines = day.map((c) => `I ${c.en} at ${timeWords(c.time)}.`);
    const nowIdx = day.reduce((b, c, k) => (c.time <= now ? k : b), -1);
    return (
      <div className="space-y-2 py-1">
        <Score score={(orderScore ?? 0) + timeScore} total={day.length * 2} reward={reward} again={start} />
        <div className="rounded-xl bg-orange-50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <b className="text-sm">📖 {t('My day')}</b>
            <button type="button" onClick={() => mumSays(lines.join(' '))} className="min-h-11 rounded-full bg-orange-500 px-3 text-sm text-white">
              🔊 {t('Read my day')}
            </button>
          </div>
          {lines.map((l, k) => (
            <button key={l} type="button" onClick={() => mumSays(l)} className={`flex min-h-10 w-full items-center gap-2 rounded px-1 text-left text-sm ${k === nowIdx ? 'bg-yellow-100 font-semibold' : ''}`} dir="ltr">
              <span>{day[k]!.icon}</span>
              <span className="flex-1">{l}</span>
              <span className="text-xs text-gray-400">{timeDigits(day[k]!.time)}</span>
            </button>
          ))}
          {nowIdx >= 0 ? (
            <p className="mt-1 text-[11px] text-gray-500">
              🇻🇳 {t('Vietnam time now')}: {timeDigits(Math.floor(now * 2) / 2)}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // step 2: match the times
  const card = day[ti]!;
  return (
    <div className="space-y-2 py-1">
      <div className={`rounded-lg px-3 py-1.5 text-sm ${orderScore === day.length ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
        {t('Order: {score} / {total} in the right place.', { score: orderScore, total: day.length })} {orderScore === day.length ? '🎉' : t('Here is the right order.')}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {day.map((c, k) => (
          <span key={c.id} className={`shrink-0 rounded-lg px-2 py-1 text-xs ${k === ti ? 'bg-orange-500 text-white' : k < ti ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-700 ring-1 ring-gray-200'}`} dir="ltr">
            {c.icon} {k < ti ? timeDigits(c.time) : c.en}
          </span>
        ))}
      </div>
      <div className="rounded-xl bg-orange-50 p-3 text-center">
        <div className="text-5xl">{clockIcon(card.time)}</div>
        <div className="text-2xl font-bold tabular-nums">{timeDigits(card.time)}</div>
        <p className="mt-1 text-base" dir="ltr">
          {card.icon} I {card.en} at <b>…</b>
        </p>
      </div>
      <div className="grid gap-1.5">
        {opts.map((x) => {
          const show = picked !== null;
          const cls = show && x === card.time ? 'border-green-500 bg-green-50' : show && x === picked ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white';
          return (
            <button key={x} type="button" disabled={show} onClick={() => answer(x)} className={`min-h-11 rounded-xl border px-3 text-left text-base ${cls}`} dir="ltr">
              at {timeWords(x)}
            </button>
          );
        })}
      </div>
      {picked !== null ? (
        <button type="button" onClick={nextTime} className="min-h-11 w-full rounded-lg bg-orange-500 text-sm font-semibold text-white">
          {ti + 1 < day.length ? `${t('Next')} →` : `🏁 ${t('Finish')}`}
        </button>
      ) : null}
    </div>
  );
}

/** Home: tidy the room (prepositions of place) and my day (daily routine + telling the time). */
export default function HomeActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  const [mode, setMode] = useState<'tidy' | 'day'>('tidy');
  const modes = useMemo(
    () =>
      [
        ['tidy', `🧹 ${t('Tidy the room')}`],
        ['day', `🕖 ${t('My day')}`],
      ] as const,
    [t],
  );
  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
        {modes.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`min-h-10 rounded-lg text-sm font-semibold ${mode === id ? 'bg-white text-orange-600 shadow' : 'text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'tidy' ? <Tidy content={content} /> : <MyDay content={content} />}
    </div>
  );
}
