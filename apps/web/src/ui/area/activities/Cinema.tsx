import { useEffect, useMemo, useState } from 'react';
import type { AreaContentDto } from '@es/shared';
import { useT } from '../../../i18n';
import { sendAreaQuiz } from '../../../net/api';
import { track } from '../../../net/analytics';
import { useArea } from '../../../store/area';
import { useCinema } from '../../../store/cinema';
import { useProfile } from '../../../store/profile';
import { say } from '../common';
import { BOOKS, FILMS, PRICE, SNACKS, type Book, type Film } from './cinemaData';

/**
 * 🎟️ Tickets & books. Two games:
 *  - Box office: a customer's request is read out; the learner (the ticket seller) picks the film, the show,
 *    the tickets, seats on the seat map and snacks, then the total price. 4 requests × 5 points.
 *  - Library: Mrs. Patel describes a book; the learner picks its cover out of 4, then answers an opinion /
 *    summary question about it. 4 books × 2 points.
 * Both send the score with sendAreaQuiz('cinema', …).
 */
export default function CinemaActivity({ content: _content }: { content: AreaContentDto }) {
  const t = useT();
  const mode = useCinema((s) => s.mode);
  const setMode = useCinema((s) => s.setMode);
  if (mode === 'tickets') return <TicketsGame onBack={() => setMode('menu')} />;
  if (mode === 'books') return <BooksGame onBack={() => setMode('menu')} />;
  return (
    <div className="grid gap-3 py-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setMode('tickets')}
        className="flex min-h-28 flex-col items-start gap-1 rounded-xl border-2 border-violet-200 bg-violet-50 p-3 text-left hover:border-violet-400"
      >
        <span className="text-3xl">🎟️</span>
        <span className="font-bold text-violet-900">{t('Box office')}</span>
        <span className="text-sm text-gray-600">
          {t(
            'Listen to customers, sell them the right tickets, seats and snacks, and say the total.',
          )}
        </span>
        <span className="text-[11px] font-semibold text-violet-700">A2</span>
      </button>
      <button
        type="button"
        onClick={() => setMode('books')}
        className="flex min-h-28 flex-col items-start gap-1 rounded-xl border-2 border-amber-200 bg-amber-50 p-3 text-left hover:border-amber-400"
      >
        <span className="text-3xl">📚</span>
        <span className="font-bold text-amber-900">{t('Find the book')}</span>
        <span className="text-sm text-gray-600">
          {t('The librarian describes a book. Find its cover, then answer a question about it.')}
        </span>
        <span className="text-[11px] font-semibold text-amber-700">A2–B2</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- helpers
const NUM = ['no', 'one', 'two', 'three', 'four'];
const ROWS = ['A', 'B', 'C', 'D', 'E'];
const SEATS_PER_ROW = 6;
const pick = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)]!;
function shuffle<T>(l: T[]): T[] {
  const a = [...l];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

async function reward(kind: string, correct: number, total: number, wrong: string[]) {
  let r: { xp: number; coins: number } = { xp: 0, coins: 0 };
  try {
    const res = await sendAreaQuiz('cinema', correct, total, wrong.slice(0, 20));
    r = res;
    if (res.badge) useArea.getState().showBadge(res.badge);
    void useProfile.getState().refresh();
  } catch {
    /* offline: no reward */
  }
  track(`cinema_${kind}_done`, { correct, total });
  return r;
}

function Header({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="mb-2 flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="min-h-10 rounded-lg px-2 text-sm text-gray-600 hover:bg-gray-100"
      >
        ← {t('Back')}
      </button>
      <h3 className="flex-1 text-sm font-bold">{title}</h3>
      {right}
    </div>
  );
}

function Result({
  correct,
  total,
  prize,
  line,
  again,
  onBack,
}: {
  correct: number;
  total: number;
  prize: { xp: number; coins: number } | null;
  line: string;
  again: () => void;
  onBack: () => void;
}) {
  const t = useT();
  return (
    <div className="py-4 text-center">
      <div className="text-4xl">
        {correct / total >= 0.8 ? '🏆' : correct / total >= 0.5 ? '🎬' : '🍿'}
      </div>
      <p className="font-semibold">{t('{score} / {total} points', { score: correct, total })}</p>
      {prize && (prize.xp || prize.coins) ? (
        <p className="text-sm text-emerald-700">
          +{prize.xp} XP{prize.coins ? ` · +${prize.coins} 🪙` : ''}
        </p>
      ) : null}
      <p className="mt-1 text-sm" dir="ltr">
        “{line}”
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={onBack} className="min-h-11 rounded-lg border px-4 text-sm">
          {t('Back')}
        </button>
        <button
          type="button"
          onClick={again}
          className="min-h-11 rounded-lg bg-violet-600 px-6 text-sm font-semibold text-white"
        >
          ↻ {t('Play again')}
        </button>
      </div>
    </div>
  );
}

/** The English line to read or listen to, with 🔊 and a "listen only" mode that hides the text. */
function Bubble({
  who,
  text,
  hidden,
  accent,
  onReveal,
}: {
  who: string;
  text: string;
  hidden: boolean;
  accent: 'en-US' | 'en-GB';
  onReveal: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-xl bg-white p-3 shadow ring-1 ring-black/5">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-500">
        <span>{who}</span>
        <button
          type="button"
          onClick={() => say(text, accent)}
          className="ml-auto min-h-9 rounded-full border px-3 text-sm"
          aria-label={t('Listen')}
        >
          🔊
        </button>
        <button
          type="button"
          onClick={() => say(text, accent, true)}
          className="min-h-9 rounded-full border px-3 text-sm"
          aria-label={t('Listen slowly')}
        >
          🐢
        </button>
      </div>
      {hidden ? (
        <button
          type="button"
          onClick={onReveal}
          className="w-full rounded-lg bg-gray-100 py-3 text-sm text-gray-600"
        >
          🎧 {t('Listen first — tap to show the text')}
        </button>
      ) : (
        <p className="text-base leading-snug" dir="ltr">
          {text}
        </p>
      )}
    </div>
  );
}

function ListenOnly({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  const t = useT();
  return (
    <label className="flex min-h-9 items-center gap-1.5 text-xs text-gray-600">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => set(e.target.checked)}
        className="h-4 w-4"
      />
      🎧 {t('Listen only')}
    </label>
  );
}

// ---------------------------------------------------------------- box office
type SeatPref = 'together' | 'front' | 'back' | 'aisle' | 'any';
interface TicketRequest {
  film: Film;
  time: string;
  adults: number;
  children: number;
  pref: SeatPref;
  snacks: Record<string, number>;
  taken: Set<string>;
  text: string;
  total: number;
}
const seatId = (r: number, n: number) => `${ROWS[r]}${n + 1}`;

/** Every seat group that satisfies the request (list of seat-id lists). */
function validGroups(n: number, pref: SeatPref): string[][] {
  const rows = pref === 'front' ? [0] : pref === 'back' ? [ROWS.length - 1] : ROWS.map((_, i) => i);
  const out: string[][] = [];
  for (const r of rows)
    for (let s = 0; s + n <= SEATS_PER_ROW; s++) {
      if (pref === 'aisle' && s !== 0 && s !== SEATS_PER_ROW - 1) continue;
      out.push(Array.from({ length: n }, (_, k) => seatId(r, s + k)));
    }
  return out;
}

function seatsOk(sel: string[], n: number, pref: SeatPref, taken: Set<string>) {
  if (sel.length !== n || sel.some((s) => taken.has(s))) return false;
  if (n === 1 && pref === 'any') return true;
  const key = [...sel].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).join(',');
  return validGroups(n, pref).some((g) => g.join(',') === key);
}

function snackPhrase(id: string, q: number) {
  const s = SNACKS.find((x) => x.id === id)!;
  if (id === 'nachos') return q === 1 ? 'some nachos' : `${NUM[q]} portions of nachos`;
  const noun = q === 1 ? s.en : id.startsWith('popcorn') ? `${s.en}s` : `${s.en}s`;
  return `${q === 1 ? (/^[aeiou]/.test(s.en) ? 'an' : 'a') : NUM[q]} ${noun}`;
}
const list = (xs: string[]) =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

function makeRequest(): TicketRequest {
  const film = pick(FILMS);
  const time = pick(film.times);
  const n = pick([1, 2, 2, 3, 4]);
  const kidsOk = film.id !== 'lighthouse';
  const children =
    kidsOk && n > 1
      ? Math.floor(Math.random() * n)
      : kidsOk && n === 1 && Math.random() < 0.2
        ? 1
        : 0;
  const adults = n === 1 ? 1 - children : Math.max(1, n - children);
  const kids = n - adults;
  const pref: SeatPref =
    n === 1
      ? pick(['front', 'back', 'aisle', 'any'] as const)
      : pick(['together', 'together', 'front', 'back'] as const);
  // snacks: 0–2 kinds
  const snacks: Record<string, number> = {};
  for (let k = pick([0, 1, 1, 2]); k > 0; k--) {
    const s = pick(SNACKS);
    if (
      snacks[s.id] ||
      (s.id.startsWith('popcorn') && Object.keys(snacks).some((x) => x.startsWith('popcorn')))
    )
      continue;
    snacks[s.id] = s.id === 'nachos' ? 1 : pick([1, 1, 2]);
  }
  // taken seats, keeping at least one valid group free
  const taken = new Set<string>();
  ROWS.forEach((_, r) => {
    for (let s = 0; s < SEATS_PER_ROW; s++) if (Math.random() < 0.35) taken.add(seatId(r, s));
  });
  const groups = validGroups(n, pref === 'any' ? 'together' : pref);
  if (!groups.some((g) => g.every((s) => !taken.has(s))))
    for (const s of pick(groups)) taken.delete(s);

  const who =
    n === 1
      ? kids
        ? 'It’s for my son.'
        : ''
      : kids === 0
        ? `${cap(NUM[adults]!)} adults.`
        : `${cap(NUM[adults]!)} ${adults === 1 ? 'adult' : 'adults'} and ${NUM[kids]} ${kids === 1 ? 'child' : 'children'}.`;
  const seat =
    n === 1
      ? {
          front: 'A seat in the front row, please.',
          back: 'Can I sit in the back row?',
          aisle: 'An aisle seat, please — at the end of a row.',
          any: 'I don’t mind where I sit.',
          together: '',
        }[pref]
      : {
          together: 'We’d like to sit next to each other.',
          front: 'Can we sit together in the front row?',
          back: 'Seats next to each other in the back row, please.',
          aisle: '',
          any: '',
        }[pref];
  const sn = Object.entries(snacks).map(([id, q]) => snackPhrase(id, q));
  const snack = sn.length ? `And ${list(sn)}, please.` : 'No snacks, thanks.';
  const text =
    `${n === 1 ? 'One ticket' : `${cap(NUM[n]!)} tickets`} for the ${time} show of ${film.title}, please. ${who} ${seat} ${snack}`
      .replace(/\s+/g, ' ')
      .trim();
  const total =
    adults * PRICE.adult +
    kids * PRICE.child +
    Object.entries(snacks).reduce(
      (a, [id, q]) => a + SNACKS.find((x) => x.id === id)!.price * q,
      0,
    );
  return { film, time, adults, children: kids, pref, snacks, taken, text, total };
}

function totalOptions(r: TicketRequest): number[] {
  const snackSum = r.total - r.adults * PRICE.adult - r.children * PRICE.child;
  const cands = [
    r.total + PRICE.adult,
    r.total - (snackSum || 3),
    r.children ? r.total + PRICE.adult - PRICE.child : r.total - PRICE.adult + PRICE.child,
    r.total + 3,
    r.total - 1,
    r.total + 2,
  ];
  const out = new Set<number>([r.total]);
  for (const c of cands) if (c > 0 && out.size < 4) out.add(c);
  return shuffle([...out]);
}

interface Form {
  film: string | null;
  time: string | null;
  adults: number;
  children: number;
  seats: string[];
  snacks: Record<string, number>;
  total: number | null;
}
const EMPTY: Form = {
  film: null,
  time: null,
  adults: 0,
  children: 0,
  seats: [],
  snacks: {},
  total: null,
};
const ROUND = 4;

function TicketsGame({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [reqs, setReqs] = useState<TicketRequest[]>(() =>
    Array.from({ length: ROUND }, makeRequest),
  );
  const [i, setI] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [checked, setChecked] = useState<boolean[] | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [hide, setHide] = useState(false);
  const [shown, setShown] = useState(false);
  const [prize, setPrize] = useState<{ xp: number; coins: number } | null>(null);
  const done = i >= reqs.length;
  const r = reqs[Math.min(i, reqs.length - 1)]!;
  const opts = useMemo(() => totalOptions(r), [r]);
  useEffect(() => {
    if (!done) say(r.text);
  }, [r, done]);
  const set = (p: Partial<Form>) => !checked && setForm((f) => ({ ...f, ...p }));
  const n = form.adults + form.children;

  if (done)
    return (
      <div>
        <Header title={`🎟️ ${t('Box office')}`} onBack={onBack} />
        <Result
          correct={score}
          total={reqs.length * 5}
          prize={prize}
          line="Thank you! Enjoy the film, and don't forget your popcorn!"
          onBack={onBack}
          again={() => {
            setReqs(Array.from({ length: ROUND }, makeRequest));
            setI(0);
            setScore(0);
            setWrong([]);
            setPrize(null);
            setForm(EMPTY);
          }}
        />
      </div>
    );

  const parts = [
    {
      id: 'show',
      label: t('Film and time'),
      ok: form.film === r.film.id && form.time === r.time,
      right: `${r.film.title}, ${r.time}`,
    },
    {
      id: 'tickets',
      label: t('Tickets'),
      ok: form.adults === r.adults && form.children === r.children,
      right: `${r.adults} × adult${r.children ? `, ${r.children} × child` : ''}`,
    },
    {
      id: 'seats',
      label: t('Seats'),
      ok: seatsOk(form.seats, r.adults + r.children, r.pref, r.taken),
      right: {
        together: 'next to each other',
        front: 'row A (front)',
        back: 'row E (back)',
        aisle: 'seat 1 or 6 (aisle)',
        any: 'any free seat',
      }[r.pref],
    },
    {
      id: 'snacks',
      label: t('Snacks'),
      ok:
        JSON.stringify(
          Object.entries(form.snacks)
            .filter(([, q]) => q > 0)
            .sort(),
        ) === JSON.stringify(Object.entries(r.snacks).sort()),
      right:
        Object.entries(r.snacks)
          .map(([id, q]) => snackPhrase(id, q))
          .join(', ') || 'none',
    },
    { id: 'total', label: t('Total'), ok: form.total === r.total, right: `$${r.total}` },
  ];
  const check = () => {
    const res = parts.map((p) => p.ok);
    setChecked(res);
    setScore((s) => s + res.filter(Boolean).length);
    setWrong((w) => [
      ...w,
      ...parts.filter((p) => !p.ok).map((p) => `${p.id}: ${r.text}`.slice(0, 80)),
    ]);
    const seats = [...form.seats].sort().join(' and ');
    say(
      `Here you are. ${seats ? `Seats ${seats}. ` : ''}That's ${r.total} dollars, please. Enjoy the film!`,
    );
  };
  const next = async () => {
    setChecked(null);
    setForm(EMPTY);
    setShown(false);
    if (i + 1 >= reqs.length) setPrize(await reward('tickets', score, reqs.length * 5, wrong));
    setI(i + 1);
  };
  const film = FILMS.find((f) => f.id === form.film);

  return (
    <div className="space-y-3 pb-2">
      <Header
        title={`🎟️ ${t('Customer {i} of {n}', { i: i + 1, n: reqs.length })}`}
        onBack={onBack}
        right={<ListenOnly on={hide} set={setHide} />}
      />
      <Bubble
        who={`🧑 ${t('Customer')}`}
        text={r.text}
        hidden={hide && !shown && !checked}
        accent="en-US"
        onReveal={() => setShown(true)}
      />

      <Section n={1} title={t('Film and time')}>
        <div className="grid grid-cols-2 gap-1.5">
          {FILMS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ film: f.id, time: null })}
              className={`min-h-11 rounded-lg border-2 px-2 py-1 text-left text-xs ${form.film === f.id ? 'border-violet-600 bg-violet-50' : 'border-gray-200'}`}
            >
              <span className="block font-semibold" dir="ltr">
                {f.title}
              </span>
              <span className="text-[10px] text-gray-500" dir="ltr">
                {f.genre}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {film ? (
            film.times.map((tm) => (
              <button
                key={tm}
                type="button"
                onClick={() => set({ time: tm })}
                className={`min-h-11 min-w-16 rounded-full border-2 px-3 text-sm font-semibold ${form.time === tm ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-200'}`}
              >
                🕒 {tm}
              </button>
            ))
          ) : (
            <span className="text-xs text-gray-500">{t('Pick a film to see its showtimes.')}</span>
          )}
        </div>
      </Section>

      <Section n={2} title={t('Tickets')}>
        <Counter
          label={`🧑 ${t('Adult')} · $${PRICE.adult}`}
          v={form.adults}
          set={(adults) => set({ adults, seats: [] })}
          max={4}
        />
        <Counter
          label={`🧒 ${t('Child')} · $${PRICE.child}`}
          v={form.children}
          set={(children) => set({ children, seats: [] })}
          max={3}
        />
      </Section>

      <Section n={3} title={n ? t('Seats: choose {n}', { n }) : t('Seats')}>
        <SeatMap
          taken={r.taken}
          sel={form.seats}
          max={n}
          onToggle={(s) =>
            !checked &&
            setForm((f) => ({
              ...f,
              seats: f.seats.includes(s)
                ? f.seats.filter((x) => x !== s)
                : f.seats.length < f.adults + f.children
                  ? [...f.seats, s]
                  : f.seats,
            }))
          }
        />
      </Section>

      <Section n={4} title={t('Snacks')}>
        {SNACKS.map((s) => (
          <Counter
            key={s.id}
            label={`${s.icon} ${s.en} · $${s.price}`}
            v={form.snacks[s.id] ?? 0}
            max={3}
            set={(q) => set({ snacks: { ...form.snacks, [s.id]: q } })}
            ltr
          />
        ))}
      </Section>

      <Section n={5} title={t('How much is it altogether?')}>
        <div className="grid grid-cols-4 gap-1.5">
          {opts.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => set({ total: o })}
              className={`min-h-11 rounded-lg border-2 text-base font-bold ${form.total === o ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-200'}`}
            >
              ${o}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          {t('Add up the tickets and snacks the customer asked for.')}
        </p>
      </Section>

      {checked ? (
        <div className="rounded-xl bg-gray-50 p-3">
          {parts.map((p, k) => (
            <div key={p.id} className="flex items-start gap-2 py-0.5 text-sm">
              <span>{checked[k] ? '✅' : '❌'}</span>
              <span className="font-medium">{p.label}</span>
              {!checked[k] ? (
                <span className="text-gray-600" dir="ltr">
                  → {p.right}
                </span>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => void next()}
            className="mt-2 min-h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white"
          >
            {i + 1 >= reqs.length ? t('Finish') : t('Next customer')} →
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={check}
          disabled={!form.film || !form.time || !n || form.total === null}
          className="min-h-11 w-full rounded-lg bg-violet-600 text-sm font-semibold text-white disabled:opacity-40"
        >
          🎟️ {t('Sell the tickets')}
        </button>
      )}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 p-2.5">
      <h4 className="mb-1.5 text-sm font-semibold text-gray-700">
        <span className="mr-1 inline-block h-5 w-5 rounded-full bg-violet-600 text-center text-xs leading-5 text-white">
          {n}
        </span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Counter({
  label,
  v,
  set,
  max,
  ltr,
}: {
  label: string;
  v: number;
  set: (v: number) => void;
  max: number;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="min-w-0 flex-1 text-sm" dir={ltr ? 'ltr' : undefined}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => set(Math.max(0, v - 1))}
        className="h-11 w-11 rounded-full border text-lg"
        aria-label="−"
      >
        −
      </button>
      <span className="w-6 text-center font-bold">{v}</span>
      <button
        type="button"
        onClick={() => set(Math.min(max, v + 1))}
        className="h-11 w-11 rounded-full border text-lg"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}

/** Rows A (front, next to the screen) … E (back), seats 1…6; aisles on both sides. */
function SeatMap({
  taken,
  sel,
  max,
  onToggle,
}: {
  taken: Set<string>;
  sel: string[];
  max: number;
  onToggle: (s: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center" dir="ltr">
      <div className="mb-2 w-4/5 rounded-b-[50%] bg-gradient-to-b from-sky-200 to-sky-50 py-0.5 text-center text-[10px] font-bold tracking-widest text-sky-800">
        {t('SCREEN')}
      </div>
      {ROWS.map((row, r) => (
        <div key={row} className="mb-1 flex items-center gap-1">
          <span className="w-4 text-xs font-bold text-gray-500">{row}</span>
          {Array.from({ length: SEATS_PER_ROW }, (_, s) => {
            const id = seatId(r, s);
            const busy = taken.has(id);
            const on = sel.includes(id);
            return (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => onToggle(id)}
                aria-label={busy ? `${id} ${t('taken')}` : id}
                className={`h-11 w-11 rounded-t-xl text-[11px] font-semibold ${busy ? 'bg-gray-300 text-gray-400' : on ? 'bg-violet-600 text-white' : 'bg-rose-100 text-rose-900 hover:bg-rose-200'}`}
              >
                {busy ? '✕' : id}
              </button>
            );
          })}
          <span className="w-4" />
        </div>
      ))}
      <p className="mt-1 text-[11px] text-gray-500">
        {max
          ? t('{n} of {max} chosen · ✕ = taken', { n: sel.length, max })
          : t('Choose the tickets first.')}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- library
interface BookRound {
  book: Book;
  covers: Book[];
  options: string[];
}
function makeBooks(): BookRound[] {
  return shuffle(BOOKS)
    .slice(0, 4)
    .map((book) => {
      // distractors that look alike (same colour or genre) are preferred, so the whole description matters
      const others = shuffle(BOOKS.filter((b) => b.id !== book.id))
        .map((b) => ({
          b,
          s:
            (b.genre === book.genre ? 2 : 0) +
            (b.colour.includes(book.colour) || book.colour.includes(b.colour) ? 2 : 0) +
            (b.author === book.author ? 1 : 0) +
            Math.random() * 1.5,
        }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map((x) => x.b);
      return { book, covers: shuffle([book, ...others]), options: shuffle(book.options) };
    });
}
/** Relative brightness of a #rrggbb colour (0…1), to pick dark or light text on a cover. */
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function dueDate() {
  const d = new Date(Date.now() + 21 * 86400_000);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function BooksGame({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [rounds, setRounds] = useState<BookRound[]>(makeBooks);
  const [i, setI] = useState(0);
  const [cover, setCover] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [hide, setHide] = useState(false);
  const [shown, setShown] = useState(false);
  const [prize, setPrize] = useState<{ xp: number; coins: number } | null>(null);
  const done = i >= rounds.length;
  const r = rounds[Math.min(i, rounds.length - 1)]!;
  const text = `I'm thinking of a book. ${r.book.desc.join(' ')} Can you find it?`;
  useEffect(() => {
    if (!done) say(text, 'en-GB');
  }, [text, done]);

  if (done)
    return (
      <div>
        <Header title={`📚 ${t('Find the book')}`} onBack={onBack} />
        <Result
          correct={score}
          total={rounds.length * 2}
          prize={prize}
          line="Lovely work, dear. Happy reading — and bring them back on time!"
          onBack={onBack}
          again={() => {
            setRounds(makeBooks());
            setI(0);
            setScore(0);
            setWrong([]);
            setPrize(null);
          }}
        />
      </div>
    );

  const pickCover = (id: string) => {
    if (cover) return;
    setCover(id);
    const ok = id === r.book.id;
    if (ok) setScore((s) => s + 1);
    else setWrong((w) => [...w, `book: ${r.book.title}`]);
    say(
      ok
        ? `Yes, that's the one: ${r.book.title} by ${r.book.author}.`
        : `Not quite. It's ${r.book.title}, by ${r.book.author}.`,
      'en-GB',
    );
  };
  const pickAnswer = (o: string) => {
    if (answer) return;
    setAnswer(o);
    const ok = o === r.book.options[0];
    if (ok) setScore((s) => s + 1);
    else setWrong((w) => [...w, `q: ${r.book.q}`.slice(0, 80)]);
    say(
      `${ok ? 'Exactly.' : 'Hmm, not really.'} Here you are. It's due back on ${dueDate()}.`,
      'en-GB',
    );
  };
  const next = async () => {
    setCover(null);
    setAnswer(null);
    setShown(false);
    if (i + 1 >= rounds.length) setPrize(await reward('books', score, rounds.length * 2, wrong));
    setI(i + 1);
  };

  return (
    <div className="space-y-3 pb-2">
      <Header
        title={`📚 ${t('Book {i} of {n}', { i: i + 1, n: rounds.length })}`}
        onBack={onBack}
        right={<ListenOnly on={hide} set={setHide} />}
      />
      <Bubble
        who={`👩‍🦳 Mrs. Patel`}
        text={text}
        hidden={hide && !shown && !cover}
        accent="en-GB"
        onReveal={() => setShown(true)}
      />
      <div className="grid grid-cols-2 gap-2">
        {r.covers.map((b) => {
          const state = !cover
            ? ''
            : b.id === r.book.id
              ? 'ring-4 ring-green-500'
              : b.id === cover
                ? 'ring-4 ring-red-500 opacity-70'
                : 'opacity-50';
          const light = lum(b.hex) > 0.55;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => pickCover(b.id)}
              className={`flex min-h-40 flex-col rounded-r-xl rounded-l-sm p-2.5 text-left shadow-md ${light ? 'text-gray-900' : 'text-white'} ${state}`}
              style={{
                background: `linear-gradient(90deg, rgba(0,0,0,.25) 0 6px, transparent 6px), ${b.hex}`,
              }}
              dir="ltr"
            >
              <span className="self-start rounded bg-white/85 px-1.5 text-[10px] font-semibold uppercase text-gray-800">
                {b.genre}
              </span>
              <span className="mt-1.5 text-sm font-extrabold leading-tight drop-shadow">
                {b.title}
              </span>
              <span className="text-[11px] opacity-95 drop-shadow">by {b.author}</span>
              <span
                className={`mt-auto rounded p-1 text-[11px] leading-snug ${light ? 'bg-white/45' : 'bg-black/25'}`}
              >
                {b.blurb}
              </span>
            </button>
          );
        })}
      </div>
      {cover ? (
        <section className="rounded-xl bg-amber-50 p-3">
          <p className="mb-2 text-sm font-semibold" dir="ltr">
            {r.book.q}{' '}
            <button
              type="button"
              onClick={() => say(r.book.q, 'en-GB')}
              className="text-xs"
              aria-label={t('Listen')}
            >
              🔊
            </button>
          </p>
          <div className="grid gap-1.5">
            {r.options.map((o) => {
              const right = o === r.book.options[0];
              const cls = !answer
                ? 'border-gray-200 bg-white'
                : right
                  ? 'border-green-500 bg-green-50'
                  : o === answer
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 bg-white opacity-60';
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => pickAnswer(o)}
                  className={`min-h-11 rounded-lg border-2 px-3 py-1.5 text-left text-sm ${cls}`}
                  dir="ltr"
                >
                  {o}
                </button>
              );
            })}
          </div>
          {answer ? (
            <>
              <p className="mt-2 text-xs text-gray-600" dir="ltr">
                📅 “Here you are. It’s due back on {dueDate()}.”
              </p>
              <button
                type="button"
                onClick={() => void next()}
                className="mt-2 min-h-11 w-full rounded-lg bg-amber-600 text-sm font-semibold text-white"
              >
                {i + 1 >= rounds.length ? t('Finish') : t('Next book')} →
              </button>
            </>
          ) : null}
        </section>
      ) : (
        <p className="text-center text-xs text-gray-500">
          {t('Tap the cover that matches the description.')}
        </p>
      )}
    </div>
  );
}
