import { useMemo, useState } from 'react';
import type { AreaContentDto } from '@es/shared';
import { sendAreaQuiz } from '../../../net/api';
import { track } from '../../../net/analytics';
import { useArea } from '../../../store/area';
import { useProfile } from '../../../store/profile';
import { tk, useLang, useT } from '../../../i18n';
import { say } from '../common';

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!;

// ---------------------------------------------------------------- booking calls (you are the receptionist)
type RoomId = 'single-room' | 'double-room' | 'twin-room' | 'family-room';
const ROOMS: { id: RoomId; en: string; people: number; price: number }[] = [
  { id: 'single-room', en: 'single room', people: 1, price: 60 },
  { id: 'double-room', en: 'double room', people: 2, price: 90 },
  { id: 'twin-room', en: 'twin room', people: 2, price: 90 },
  { id: 'family-room', en: 'family room', people: 4, price: 140 },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NAMES: [string, string][] = [
  ['Kate', 'Brown'],
  ['Tom', 'Clark'],
  ['Anna', 'Smith'],
  ['Ben', 'Taylor'],
  ['Lucy', 'Green'],
  ['Sam', 'White'],
  ['Emma', 'Wilson'],
  ['Jack', 'Hill'],
  ['Mai', 'Nguyen'],
  ['Lan', 'Tran'],
  ['Minh', 'Pham'],
  ['Olivia', 'King'],
  ['Leo', 'Parker'],
  ['Grace', 'Wood'],
  ['Harry', 'Moore'],
];
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const BREAKFAST = 10;

interface Call {
  first: string;
  last: string;
  room: RoomId;
  nights: number;
  day: number;
  month: number;
  breakfast: boolean;
  /** What the guest says: shown text and the TTS version (letters spelled out one by one). */
  text: string;
  speech: string;
}
const priceOf = (c: { room: RoomId; nights: number; breakfast: boolean }) => {
  const r = ROOMS.find((x) => x.id === c.room)!;
  return r.price * c.nights + (c.breakfast ? BREAKFAST * r.people * c.nights : 0);
};

function makeCall(): Call {
  const [first, last] = pick(NAMES);
  const room = pick(ROOMS);
  const nights = 1 + Math.floor(Math.random() * 4);
  const day = 1 + Math.floor(Math.random() * 28);
  const month = Math.floor(Math.random() * 12);
  const breakfast = Math.random() < 0.5;
  const we = room.people === 1 ? 'I' : 'we';
  const We = room.people === 1 ? "I'm" : "We're";
  const n = `${NUM[nights]} ${nights === 1 ? 'night' : 'nights'}`;
  const date = `the ${ordinal(day)} of ${MONTHS[month]}`;
  const bf = breakfast ? pick([`And ${we}'d like breakfast, please.`, 'With breakfast, please.']) : pick([`${we === 'I' ? 'I' : 'We'} don't need breakfast, thanks.`, 'No breakfast, thank you.']);
  const spellT = last.toUpperCase().split('').join('-');
  const spellS = last.toUpperCase().split('').join(', ');
  const templates: ((spell: string) => string)[] = [
    (s) => `Hello, I'd like to book a ${room.en} for ${n}, from ${date}. ${bf} My name is ${first} ${last}. That's ${s}.`,
    (s) => `Hi! Have you got a ${room.en} from ${date}? It's for ${n}. ${bf} The name is ${first} ${last}, ${s}.`,
    (s) => `Good morning. Can I book a ${room.en}, please? ${We} arriving on ${date} and staying ${n}. ${bf} My surname is ${last}: ${s}.`,
  ];
  const tpl = pick(templates);
  return { first, last, room: room.id, nights, day, month, breakfast, text: tpl(spellT), speech: tpl(spellS) };
}

interface Form {
  name: string;
  room: RoomId | null;
  nights: number | null;
  day: number | null;
  month: number | null;
  breakfast: boolean | null;
  price: number | null;
}
const EMPTY: Form = { name: '', room: null, nights: null, day: null, month: null, breakfast: null, price: null };
const CALLS = 3;

/** Score a filled form: one point per field; `wrong` = area item ids for the admin stats. */
function check(c: Call, f: Form) {
  const name = f.name.replace(/[^a-z]/gi, '').toLowerCase() === c.last.toLowerCase();
  const res = {
    name,
    room: f.room === c.room,
    nights: f.nights === c.nights,
    date: f.day === c.day && f.month === c.month,
    breakfast: f.breakfast === c.breakfast,
    price: f.price === priceOf(c),
  };
  const wrong: string[] = [];
  if (!res.name) wrong.push('full-name');
  if (!res.room) wrong.push(c.room);
  if (!res.nights) wrong.push('night');
  if (!res.date) wrong.push('date');
  if (!res.breakfast) wrong.push('breakfast');
  return { res, score: Object.values(res).filter(Boolean).length, wrong };
}

function Booking({ content, onDone }: { content: AreaContentDto; onDone: (correct: number, total: number, wrong: string[]) => Promise<void> }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const [calls] = useState(() => Array.from({ length: CALLS }, makeCall));
  const [i, setI] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [showText, setShowText] = useState(false);
  const [checked, setChecked] = useState<ReturnType<typeof check> | null>(null);
  const [total, setTotal] = useState({ score: 0, wrong: [] as string[] });
  const c = calls[i]!;
  const item = (id: string) => content.items.find((x) => x.id === id);
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  // price choices once the room, nights and breakfast are filled (computed from the learner's own form)
  const priceOptions = useMemo(() => {
    const right = priceOf(c);
    const near = [right + 10 * c.nights, Math.max(10, right - ROOMS.find((r) => r.id === c.room)!.price), right + 30, priceOf({ ...c, breakfast: !c.breakfast })].filter((x) => x !== right);
    return shuffle([right, ...shuffle([...new Set(near)]).slice(0, 2)]);
  }, [c]);
  const ready = form.name.trim() && form.room && form.nights && form.day && form.month !== null && form.breakfast !== null && form.price !== null;
  const submit = () => {
    const r = check(c, form);
    setChecked(r);
    setTotal((s) => ({ score: s.score + r.score, wrong: [...s.wrong, ...r.wrong] }));
    const room = ROOMS.find((x) => x.id === c.room)!;
    say(
      `Thank you, ${c.first}. So that's a ${room.en} for ${NUM[c.nights]} ${c.nights === 1 ? 'night' : 'nights'} from the ${ordinal(c.day)} of ${MONTHS[c.month]}, ${c.breakfast ? 'with' : 'without'} breakfast. The total is ${priceOf(c)} dollars. See you soon!`,
      'en-GB',
    );
  };
  const next = () => {
    if (i + 1 >= calls.length) {
      void onDone(total.score, calls.length * 6, total.wrong);
      return;
    }
    setI(i + 1);
    setForm(EMPTY);
    setChecked(null);
    setShowText(false);
  };
  const mark = (ok: boolean | undefined) => (checked ? (ok ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50') : '');
  const chip = (on: boolean) => `min-h-11 rounded-lg border-2 px-2 text-sm ${on ? 'border-amber-600 bg-amber-50 font-semibold' : 'border-gray-200 bg-white'}`;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t('Call {n} of {total}', { n: i + 1, total: calls.length })}</span>
        <span>⭐ {total.score}</span>
      </div>
      <div className="rounded-xl bg-amber-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl">☎️</span>
          <button type="button" onClick={() => say(c.speech)} className="min-h-11 rounded-full bg-amber-600 px-4 text-sm font-semibold text-white">
            🔊 {t('Answer the phone')}
          </button>
          <button type="button" onClick={() => say(c.speech, 'en-US', true)} className="min-h-11 rounded-full border border-amber-600 bg-white px-3 text-sm" aria-label={t('Listen slowly')}>
            🐢
          </button>
          <button type="button" onClick={() => setShowText((s) => !s)} className="min-h-11 rounded-full border bg-white px-3 text-xs">
            {showText ? t('Hide text') : t('Show text')}
          </button>
        </div>
        {showText || checked ? (
          <p className="mt-2 text-sm italic" dir="ltr">
            “{c.text}”
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-600">{t('Listen to the guest and fill in the booking form.')}</p>
        )}
      </div>

      <div className="space-y-2.5 rounded-xl border p-3">
        <h3 className="text-sm font-semibold">📋 {t('Booking form')}</h3>
        <label className="block">
          <span className="text-xs text-gray-600">{t("Guest's surname")}</span>
          <input
            value={form.name}
            disabled={!!checked}
            onChange={(e) => set({ name: e.target.value })}
            className={`mt-0.5 block min-h-11 w-full rounded-lg border-2 px-3 text-base uppercase ${mark(checked?.res.name)}`}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("Type the letters you hear")}
          />
          {checked && !checked.res.name ? <span className="text-xs text-red-600" dir="ltr">{c.last.toUpperCase()}</span> : null}
        </label>
        <div>
          <span className="text-xs text-gray-600">{t('Room type')}</span>
          <div className={`mt-0.5 grid grid-cols-2 gap-1.5 rounded-lg ${checked ? `border-2 p-1 ${mark(checked.res.room)}` : ''}`}>
            {ROOMS.map((r) => (
              <button key={r.id} type="button" disabled={!!checked} onClick={() => set({ room: r.id, price: null })} className={chip(form.room === r.id)}>
                {item(r.id)?.icon} <span dir="ltr">{r.en}</span>
                {!noTr && item(r.id)?.tr.meaning ? <span className="block text-[10px] font-normal text-gray-500">{item(r.id)!.tr.meaning}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-600">{t('Nights')}</span>
          <div className={`mt-0.5 flex gap-1.5 rounded-lg ${checked ? `border-2 p-1 ${mark(checked.res.nights)}` : ''}`}>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" disabled={!!checked} onClick={() => set({ nights: n, price: null })} className={`flex-1 ${chip(form.nights === n)}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-600">{t('Check-in date')}</span>
          <div className={`mt-0.5 flex gap-1.5 rounded-lg ${checked ? `border-2 p-1 ${mark(checked.res.date)}` : ''}`} dir="ltr">
            <select disabled={!!checked} value={form.day ?? ''} onChange={(e) => set({ day: e.target.value ? Number(e.target.value) : null })} className="min-h-11 w-24 rounded-lg border-2 bg-white px-2 text-sm">
              <option value="">{t('Day')}</option>
              {Array.from({ length: 31 }, (_, k) => k + 1).map((d) => (
                <option key={d} value={d}>
                  {ordinal(d)}
                </option>
              ))}
            </select>
            <select disabled={!!checked} value={form.month ?? ''} onChange={(e) => set({ month: e.target.value === '' ? null : Number(e.target.value) })} className="min-h-11 flex-1 rounded-lg border-2 bg-white px-2 text-sm">
              <option value="">{t('Month')}</option>
              {MONTHS.map((m, k) => (
                <option key={m} value={k}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {checked && !checked.res.date ? <span className="text-xs text-red-600" dir="ltr">the {ordinal(c.day)} of {MONTHS[c.month]}</span> : null}
        </div>
        <div>
          <span className="text-xs text-gray-600">{t('Breakfast')} (${BREAKFAST} / {t('person')} / {t('night')})</span>
          <div className={`mt-0.5 flex gap-1.5 rounded-lg ${checked ? `border-2 p-1 ${mark(checked.res.breakfast)}` : ''}`}>
            {[true, false].map((b) => (
              <button key={String(b)} type="button" disabled={!!checked} onClick={() => set({ breakfast: b, price: null })} className={`flex-1 ${chip(form.breakfast === b)}`}>
                {b ? `🥐 ${t('Yes')}` : `🚫 ${t('No')}`}
              </button>
            ))}
          </div>
        </div>
        {form.room && form.nights && form.breakfast !== null ? (
          <div>
            <span className="text-xs text-gray-600">{t('Tell the guest the total price')}</span>
            <div className={`mt-0.5 flex gap-1.5 rounded-lg ${checked ? `border-2 p-1 ${mark(checked.res.price)}` : ''}`}>
              {priceOptions.map((p) => (
                <button key={p} type="button" disabled={!!checked} onClick={() => set({ price: p })} className={`flex-1 ${chip(form.price === p)}`}>
                  ${p}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-500" dir="ltr">
              {ROOMS.map((r) => `${r.en} $${r.price}`).join(' · ')}
            </p>
          </div>
        ) : null}
      </div>

      {checked ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{t('{score} / {total} correct', { score: checked.score, total: 6 })}</span>
          <button type="button" onClick={next} className="min-h-11 rounded-lg bg-amber-600 px-5 text-sm font-semibold text-white">
            {i + 1 >= calls.length ? t('Finish') : t('Next call')} →
          </button>
        </div>
      ) : (
        <button type="button" disabled={!ready} onClick={submit} className="min-h-11 w-full rounded-lg bg-amber-600 text-sm font-semibold text-white disabled:opacity-40">
          ✅ {t('Confirm the booking')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- situations (you are the guest)
type Kind = 'ok' | 'rude' | 'grammar';
interface Situation {
  icon: string;
  en: string;
  options: [string, Kind][];
  reply: string;
  item: string;
}
const SITUATIONS: Situation[] = [
  {
    icon: '🥶',
    en: tk('Your room is too cold.'),
    options: [
      ['Excuse me, my room is too cold. Could you help me, please?', 'ok'],
      ['My room is cold. Fix it now!', 'rude'],
      ['I am very cold room.', 'grammar'],
      ['Why is your hotel so cold?', 'rude'],
    ],
    reply: "I'm so sorry. I'll send a technician to check the air conditioner right away.",
    item: 'air-conditioner',
  },
  {
    icon: '🍳',
    en: tk('You want to have breakfast at 7 o’clock.'),
    options: [
      ['Excuse me, can I have breakfast at seven?', 'ok'],
      ['Breakfast seven o’clock. Give me.', 'rude'],
      ['I want eat breakfast at seven.', 'grammar'],
      ['Do breakfast at seven?', 'grammar'],
    ],
    reply: 'Yes, of course. Breakfast is from half past six to ten, on the ground floor.',
    item: 'breakfast',
  },
  {
    icon: '💳',
    en: tk('You lost your key card.'),
    options: [
      ["I'm sorry, I've lost my key card. Could I have a new one?", 'ok'],
      ['Give me a new key card.', 'rude'],
      ['My key card is lose.', 'grammar'],
      ['I lost key, you give other.', 'grammar'],
    ],
    reply: "No problem. What's your name and room number? I'll make you a new one.",
    item: 'key-card',
  },
  {
    icon: '📶',
    en: tk('You need the Wi-Fi password.'),
    options: [
      ['Could you tell me the Wi-Fi password, please?', 'ok'],
      ['Wi-Fi password. Now.', 'rude'],
      ['What is the password of Wi-Fi is?', 'grammar'],
      ['You tell me Wi-Fi.', 'grammar'],
    ],
    reply: "Of course. It's river2024, all in small letters.",
    item: 'wi-fi',
  },
  {
    icon: '🔊',
    en: tk("Your room is very noisy and you can't sleep."),
    options: [
      ["I'm sorry to bother you, but my room is very noisy. Would it be possible to change rooms?", 'ok'],
      ['Your hotel is terrible!', 'rude'],
      ['My room is noise. Change.', 'grammar'],
      ["I can't sleeping, room noisy.", 'grammar'],
    ],
    reply: "I'm very sorry about that. I can move you to a quiet room at the back of the hotel.",
    item: 'noisy',
  },
  {
    icon: '🧺',
    en: tk('You need more towels.'),
    options: [
      ['Could I have some more towels, please?', 'ok'],
      ['More towels! Quickly!', 'rude'],
      ['I need a towels more.', 'grammar'],
      ['Give towels to me.', 'rude'],
    ],
    reply: 'Certainly. Housekeeping will bring them up in five minutes.',
    item: 'towel',
  },
  {
    icon: '🧳',
    en: tk('You check out at 11, but your train leaves at 4. You want to leave your bags.'),
    options: [
      ['Can I leave my luggage here until four o’clock?', 'ok'],
      ['I leave luggages here.', 'grammar'],
      ['Keep my bags. OK?', 'rude'],
      ['Can I leaving my luggage here?', 'grammar'],
    ],
    reply: "Of course. We'll keep it behind the desk. Just show me this ticket when you come back.",
    item: 'luggage',
  },
  {
    icon: '🏊',
    en: tk('You want to know when the pool is open.'),
    options: [
      ['What time does the pool open?', 'ok'],
      ['What time the pool opens?', 'grammar'],
      ['When pool open?', 'grammar'],
      ['Open the pool for me.', 'rude'],
    ],
    reply: "The pool is open from seven in the morning until nine in the evening. Towels are at the pool.",
    item: 'swimming-pool',
  },
  {
    icon: '🚿',
    en: tk("There's no hot water in your shower."),
    options: [
      ["Excuse me, there's no hot water in my shower.", 'ok'],
      ["The water is cold. It's your fault.", 'rude'],
      ['No have hot water.', 'grammar'],
      ['Shower is not hot water.', 'grammar'],
    ],
    reply: "Oh dear, I'm sorry. I'll ask our technician to come up straight away.",
    item: 'shower',
  },
  {
    icon: '⏰',
    en: tk('You would like to check out later than 11.'),
    options: [
      ['Would it be possible to have a late check-out?', 'ok'],
      ['I check out later. OK?', 'rude'],
      ['I want stay more long.', 'grammar'],
      ['Late check-out me.', 'grammar'],
    ],
    reply: "Yes, you can stay until two o'clock. It's twenty dollars extra.",
    item: 'check-out',
  },
  {
    icon: '🛗',
    en: tk("You can't find the lift."),
    options: [
      ['Excuse me, where is the lift, please?', 'ok'],
      ['Where the lift is?', 'grammar'],
      ['Lift! Where?', 'rude'],
      ['Show me lift.', 'rude'],
    ],
    reply: "It's just over there, next to the reception desk.",
    item: 'lift',
  },
];
const PER_ROUND = 5;

function Guest({ onDone }: { onDone: (correct: number, total: number, wrong: string[]) => Promise<void> }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const [qs] = useState(() => shuffle(SITUATIONS).slice(0, PER_ROUND).map((s) => ({ ...s, options: shuffle(s.options) })));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const q = qs[i]!;
  const choose = (k: number) => {
    setPicked(k);
    const ok = q.options[k]![1] === 'ok';
    if (ok) {
      setScore((s) => s + 1);
      say(q.reply, 'en-GB');
    } else setWrong((w) => [...w, q.item]);
  };
  const next = () => {
    if (i + 1 >= qs.length) {
      void onDone(score, qs.length, wrong);
      return;
    }
    setI(i + 1);
    setPicked(null);
  };
  const kind = picked !== null ? q.options[picked]![1] : null;
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">{t('Situation {n} of {total}', { n: i + 1, total: qs.length })}</div>
      <div className="flex items-start gap-3 rounded-xl bg-sky-50 p-3">
        <span className="text-4xl">{q.icon}</span>
        <div>
          <p className="text-base font-medium" dir="ltr">
            {q.en}
          </p>
          {!noTr && t(q.en) !== q.en ? <p className="text-xs text-gray-600">{t(q.en)}</p> : null}
          <p className="mt-1 text-xs text-gray-600">{t('What do you say at the front desk?')}</p>
        </div>
      </div>
      <div className="grid gap-1.5">
        {q.options.map(([en, k], j) => {
          const st = picked === null ? 'bg-white' : k === 'ok' ? 'border-green-500 bg-green-50' : j === picked ? 'border-red-400 bg-red-50' : 'opacity-60';
          return (
            <button key={en} type="button" disabled={picked !== null} onClick={() => choose(j)} className={`min-h-11 rounded-xl border-2 px-3 py-2 text-start text-sm ${st}`} dir="ltr">
              {en}
            </button>
          );
        })}
      </div>
      {picked !== null ? (
        <div className="space-y-2">
          {kind === 'ok' ? (
            <div className="rounded-lg bg-green-50 px-3 py-2 text-sm">
              <b>✓ {t('Polite and correct!')}</b>
              <div className="mt-1 flex items-start gap-1.5">
                <span>💁 Mia:</span>
                <span className="italic" dir="ltr">
                  “{q.reply}”
                </span>
                <button type="button" onClick={() => say(q.reply, 'en-GB')} className="text-xs" aria-label={t('Listen')}>
                  🔊
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{kind === 'rude' ? t('Hmm, that sounds rude. Be polite: use "Excuse me", "please", "Could I…?"') : t('There is a grammar mistake in that sentence.')}</div>
          )}
          <button type="button" onClick={next} className="min-h-11 w-full rounded-lg bg-sky-600 text-sm font-semibold text-white">
            {i + 1 >= qs.length ? t('Finish') : t('Next')} →
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- the tab
type Mode = 'booking' | 'guest';

/** 🛎️ Front desk: take bookings on the phone as the receptionist, or be a guest and say the right thing. */
export default function HotelActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  const [mode, setMode] = useState<Mode | null>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<{ mode: Mode; correct: number; total: number; xp: number; coins: number; capped: boolean } | null>(null);
  const done = (m: Mode) => async (correct: number, total: number, wrong: string[]) => {
    let r = { xp: 0, coins: 0, capped: false };
    try {
      const res = await sendAreaQuiz('hotel', correct, total, wrong);
      r = res;
      if (res.badge) useArea.getState().showBadge(res.badge);
      void useProfile.getState().refresh();
    } catch {
      /* offline: no reward */
    }
    track(m === 'booking' ? 'hotel_booking_done' : 'hotel_guest_done', { correct, total });
    setResult({ mode: m, correct, total, ...r });
  };
  const start = (m: Mode) => {
    setMode(m);
    setResult(null);
    setRound((n) => n + 1);
  };

  if (result)
    return (
      <div className="py-6 text-center">
        <div className="text-4xl">{result.correct === result.total ? '🏆' : result.correct >= result.total * 0.6 ? '🎉' : '💪'}</div>
        <p className="mt-2 text-lg font-bold">{t('{score} / {total} correct', { score: result.correct, total: result.total })}</p>
        <p className="text-sm text-emerald-700">
          +{result.xp} XP{result.coins ? ` · +${result.coins} 🪙` : ''} {result.capped ? `(${t('daily quiz limit reached')})` : ''}
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" onClick={() => start(result.mode)} className="min-h-11 rounded-lg bg-amber-600 px-5 text-sm font-semibold text-white">
            ↻ {t('Play again')}
          </button>
          <button type="button" onClick={() => {
              setResult(null);
              setMode(null);
            }} className="min-h-11 rounded-lg border px-5 text-sm">
            {t('Back')}
          </button>
        </div>
      </div>
    );

  if (!mode)
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-gray-600">{t('Work at the front desk of Riverside Hotel, or be a guest with a problem.')}</p>
        <button type="button" onClick={() => start('booking')} className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-start">
          <span className="text-3xl">☎️</span>
          <span>
            <b className="block text-sm">{t('Take a booking')}</b>
            <span className="text-xs text-gray-600">{t('You are the receptionist. Guests phone you: write down the name, room, nights, date and breakfast.')}</span>
          </span>
        </button>
        <button type="button" onClick={() => start('guest')} className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-sky-300 bg-sky-50 px-3 py-2 text-start">
          <span className="text-3xl">🧳</span>
          <span>
            <b className="block text-sm">{t('Be the guest')}</b>
            <span className="text-xs text-gray-600">{t('Something is wrong in your room. Choose the polite and correct thing to say.')}</span>
          </span>
        </button>
      </div>
    );

  return (
    <div className="py-2">
      <button type="button" onClick={() => setMode(null)} className="mb-2 text-xs text-blue-700 hover:underline">
        ← {t('Back')}
      </button>
      {mode === 'booking' ? <Booking key={round} content={content} onDone={done('booking')} /> : <Guest key={round} onDone={done('guest')} />}
    </div>
  );
}
