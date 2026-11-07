import { useEffect, useState } from 'react';
import { HOTEL_MAX_NIGHTS, MINIBAR, hotelRoomInfo, ordinal } from '@es/shared';
import { Sheet, SheetHeader } from '../Sheet';
import { ROOM_SERVICE, useHotel } from '../../store/hotel';
import { useGame } from '../../store/game';
import { useVoice } from '../../store/voice';
import { useProfile } from '../../store/profile';
import { useT } from '../../i18n';

/**
 * Riverside Hotel panels: the reception desk (check-in conversation, check-out with the bill), the lift, the room
 * phone (room service) and the minibar; plus the knock / notice toasts. English lines are spoken (TTS) and stay in
 * English; instructions are translated.
 */
const say = (text: string) => useVoice.getState().speakAs('hotel', text, 'en-US');

export function HotelPanels() {
  const panel = useHotel((s) => s.panel);
  const close = () => useHotel.setState({ panel: null });
  const t = useT();
  if (!panel) return null;
  const title = panel === 'reception' ? `🛎️ ${t('Reception')}` : panel === 'lift' ? `🛗 ${t('Lift')}` : panel === 'phone' ? `☎️ ${t('Room phone')}` : `🧊 ${t('Minibar')}`;
  return (
    <Sheet onClose={close} label={title}>
      <SheetHeader>
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={close} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
        {panel === 'reception' ? <Reception /> : panel === 'lift' ? <Lift /> : panel === 'phone' ? <Phone /> : <Minibar />}
      </div>
    </Sheet>
  );
}

/** A line the receptionist says (English, with a replay button). */
function Line({ who, text }: { who: string; text: string }) {
  return (
    <div className="mb-2 flex items-start gap-2">
      <span className="text-xl">{who}</span>
      <p className="flex-1 rounded-2xl bg-gray-100 px-3 py-2 text-sm" dir="ltr">
        {text}
      </p>
      <button type="button" onClick={() => say(text)} className="min-h-8 min-w-8 rounded-full text-sm hover:bg-gray-100" aria-label="🔊">
        🔊
      </button>
    </div>
  );
}

function Choice({ text, onPick, tone = 'blue' }: { text: string; onPick: () => void; tone?: 'blue' | 'gray' }) {
  return (
    <button
      type="button"
      onClick={() => {
        say(text);
        onPick();
      }}
      className={`mb-1.5 block min-h-11 w-full rounded-xl border px-3 py-2 text-left text-sm ${tone === 'blue' ? 'border-blue-200 bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
      dir="ltr"
    >
      {text}
    </button>
  );
}

/* ------------------------------------------------------------------------------------------- reception */

function Reception() {
  const s = useHotel();
  useEffect(() => {
    void s.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (s.result) return <CheckoutResult />;
  return s.stay ? <Checkout /> : <Checkin />;
}

function Checkin() {
  const t = useT();
  const s = useHotel();
  const name = useGame((g) => (g.sessionId ? g.players[g.sessionId]?.name : '')) ?? '';
  const coins = useProfile((p) => p.profile?.coins ?? 0);
  const [step, setStep] = useState(0);
  const [nights, setNights] = useState(1);
  const [suite, setSuite] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const greet = 'Good afternoon! Welcome to the Riverside Hotel. How can I help you?';
  useEffect(() => say(greet), []);
  const cost = suite ? nights * s.suitePrice : s.free ? 0 : nights * s.price;
  const wrong = (h: string) => setHint(h);
  return (
    <div>
      <Line who="💁" text={greet} />
      {step === 0 ? (
        <>
          <p className="mb-2 text-xs text-gray-500">{t('Choose what you say:')}</p>
          <Choice text="I'd like to check in, please." onPick={() => setStep(1)} />
          <Choice text="Can I have the menu, please?" tone="gray" onPick={() => wrong(t('That is for a restaurant. You want a room: "I\'d like to check in."'))} />
          <Choice text="One ticket to the zoo, please." tone="gray" onPick={() => wrong(t('That is for the bus or the zoo. Try again!'))} />
        </>
      ) : null}
      {step >= 1 ? (
        <>
          <p className="mb-2 rounded-2xl bg-blue-600 px-3 py-2 text-right text-sm text-white" dir="ltr">
            I'd like to check in, please.
          </p>
          <Line who="💁" text="Certainly. Do you have a reservation?" />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Choice text={`Yes, I do. The name is ${name || 'Sam'}.`} onPick={() => setStep(2)} />
          <Choice text="No, I don't. Do you have a room for tonight?" onPick={() => setStep(2)} />
        </>
      ) : null}
      {step >= 2 ? <Line who="💁" text={`Would you like a standard room or a suite? A suite has a big bed, a view of the river, and the minibar is included. It's ${s.suitePrice} coins a night.`} /> : null}
      {step === 2 && suite === null ? (
        <>
          <Choice text="A standard room, please." onPick={() => setSuite(false)} />
          <Choice text={`I'd like a suite, please. (⭐ ${s.suitePrice} 🪙 / night)`} onPick={() => setSuite(true)} />
        </>
      ) : null}
      {step >= 2 && suite !== null ? (
        <p className="mb-2 rounded-2xl bg-blue-600 px-3 py-2 text-right text-sm text-white" dir="ltr">
          {suite ? "I'd like a suite, please." : 'A standard room, please.'}
        </p>
      ) : null}
      {step >= 2 && suite !== null ? <Line who="💁" text={suite ? 'Excellent choice! How many nights would you like to stay?' : 'Yes, we have a lovely room for you. How many nights would you like to stay?'} /> : null}
      {step === 2 && suite !== null ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: HOTEL_MAX_NIGHTS }, (_, i) => i + 1).map((n) => (
            <Choice
              key={n}
              text={['One night', 'Two nights', 'Three nights'][n - 1]!}
              onPick={() => {
                setNights(n);
                setStep(3);
              }}
            />
          ))}
        </div>
      ) : null}
      {step >= 3 ? (
        <Line
          who="💁"
          text={s.free && !suite ? `${nights === 1 ? 'One night' : `${nights} nights`}. Good news: your first stay is free!` : `${nights === 1 ? 'One night' : `${nights} nights`}${suite ? ' in a suite' : ''}. That's ${cost} coins, please.`}
        />
      ) : null}
      {step === 3 ? (
        <>
          <p className="mb-2 text-xs text-gray-500">
            {t('You have {coins} coins.', { coins })} {cost > 0 && coins < cost ? t('Not enough coins. Do a quiz in any area to earn some!') : null}
          </p>
          <Choice
            text={cost === 0 ? 'Thank you very much!' : 'Here you are.'}
            onPick={async () => {
              if (await useHotel.getState().checkin(nights, !!suite)) setStep(4);
            }}
          />
        </>
      ) : null}
      {hint ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">💡 {hint}</p> : null}
      {s.error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{s.error}</p> : null}
    </div>
  );
}

/** Shown right after check-in: the key card. */
export function KeyCard({ room, suite = false }: { room: number; suite?: boolean }) {
  const t = useT();
  const info = hotelRoomInfo(room);
  return (
    <div className="mx-auto my-3 w-64 rounded-2xl bg-gradient-to-br from-[#7a2e3a] to-[#3a1a20] p-4 text-white shadow-lg">
      <div className="text-xs tracking-widest text-amber-200">RIVERSIDE HOTEL ★★★</div>
      <div className="mt-3 text-3xl font-bold" dir="ltr">
        Room {room}
      </div>
      {suite ? (
        <div className="mt-1 inline-block rounded bg-amber-300 px-2 text-xs font-bold text-[#3a1a20]" dir="ltr">
          ⭐ SUITE · minibar included
        </div>
      ) : null}
      <div className="text-sm text-amber-100" dir="ltr">
        {ordinal(info.floor)} floor
      </div>
      <div className="mt-3 text-[11px] text-white/70">{t('Take the lift, then tap your door to open it.')}</div>
    </div>
  );
}

function Checkout() {
  const t = useT();
  const s = useHotel();
  const [dispute, setDispute] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  if (!s.stay) return null;
  if (!asked)
    return (
      <div>
        <KeyCard room={s.stay.room} suite={!!s.stay.suite} />
        {Date.now() - s.stay.since < 60_000 ? (
          <>
            <Line who="💁" text={`Here is your key card. Your room is ${s.stay.room}, on the ${ordinal(hotelRoomInfo(s.stay.room).floor)} floor. The lift is over there.`} />
            <Choice text="Thank you very much!" onPick={() => useHotel.setState({ panel: null })} />
            <p className="mb-2 mt-3 text-xs text-gray-500">{t('Later, come back here to check out.')}</p>
          </>
        ) : (
          <Line who="💁" text="Hello again! How can I help you?" />
        )}
        <Choice text="I'd like to check out, please." onPick={() => setAsked(true)} />
        <Choice text="What time is breakfast?" tone="gray" onPick={() => say('Breakfast is from seven to ten in the restaurant.')} />
        <Choice text="Close" tone="gray" onPick={() => useHotel.setState({ panel: null })} />
      </div>
    );
  const b = s.bill;
  return (
    <div>
      <Line who="💁" text="Of course. Here is your bill. Please check it. Is everything correct?" />
      {!b ? <p className="text-sm text-gray-500">{t('Loading…')}</p> : null}
      {b ? (
        <div className="mb-3 rounded-xl border bg-amber-50/40 p-3 font-mono text-xs" dir="ltr">
          <div className="mb-1 font-bold">RIVERSIDE HOTEL · Room {b.room}</div>
          {b.lines.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDispute(dispute === i ? null : i)}
              className={`flex w-full justify-between rounded px-1 py-1 text-left ${dispute === i ? 'bg-red-100 ring-1 ring-red-400' : 'hover:bg-white'}`}
            >
              <span>
                {l.qty} × {l.en}
              </span>
              <span>{l.qty * l.price} 🪙</span>
            </button>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1 font-bold">
            <span>TOTAL</span>
            <span>{b.total} 🪙</span>
          </div>
        </div>
      ) : null}
      <p className="mb-2 text-xs text-gray-500">{t('Room nights were paid at check-in. Tap a wrong line if you find one, or say everything is correct.')}</p>
      <Choice text="Yes, everything is correct." onPick={() => void s.checkout(-1)} />
      <Choice text={dispute !== null ? 'Excuse me, I think this line is wrong.' : 'Excuse me, I think there is a mistake. (tap the line first)'} tone={dispute !== null ? 'blue' : 'gray'} onPick={() => dispute !== null && void s.checkout(dispute)} />
      {s.error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{s.error}</p> : null}
    </div>
  );
}

function CheckoutResult() {
  const t = useT();
  const r = useHotel((s) => s.result)!;
  return (
    <div className="text-center">
      <div className="text-4xl">{r.correct ? '🎉' : '🙂'}</div>
      <p className="mt-2 text-sm" dir="ltr">
        {r.correct ? (r.wrong >= 0 ? "Well spotted! I'm sorry about that mistake." : 'Thank you for checking!') : r.wrong >= 0 ? 'Oh, there was a mistake on the bill. Never mind!' : 'Actually, the bill was correct.'}
      </p>
      <p className="mt-2 text-xs text-gray-600">
        {r.correct ? t('You checked the bill correctly: +{xp} XP.', { xp: r.xp }) : t('Next time read every line carefully.')} {r.paid ? t('You paid {coins} coins for the minibar.', { coins: r.paid }) : null}
      </p>
      <button type="button" onClick={() => useHotel.setState({ panel: null, result: null })} className="mt-3 min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white">
        {t('Done')}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- lift, phone, minibar */

function Lift() {
  const t = useT();
  const s = useHotel();
  const stay = s.stay;
  const btn = (label: string, sub: string, go: () => void) => (
    <button type="button" onClick={go} className="flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-gray-50">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-800 font-bold text-amber-300">{label}</span>
      <span className="text-sm" dir="ltr">
        {sub}
      </span>
    </button>
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{t('Which floor?')}</p>
      {btn('3', 'Third floor · rooms 301–312', () => s.goFloor(3))}
      {btn('2', 'Second floor · rooms 201–212', () => s.goFloor(2))}
      {btn('G', 'Ground floor · reception, restaurant', () => s.goFloor('lobby'))}
      {stay ? <p className="text-xs text-gray-600">🔑 {t('Your room: {room}', { room: stay.room })}</p> : <p className="text-xs text-gray-600">{t('No room yet: check in at reception to get a key card. You can still visit and knock on doors.')}</p>}
    </div>
  );
}

function Phone() {
  const t = useT();
  const s = useHotel();
  useEffect(() => say('Reception. How can I help you?'), []);
  return (
    <div>
      <Line who="☎️" text="Reception. How can I help you?" />
      <p className="mb-2 text-xs text-gray-500">{t('Choose what you say:')}</p>
      {ROOM_SERVICE.map((r) => (
        <Choice key={r.id} text={r.en} onPick={() => s.callService(r)} />
      ))}
      {s.coming ? <p className="mt-2 text-xs text-gray-600">⏳ {t('Room service is on its way…')}</p> : null}
    </div>
  );
}

function Minibar() {
  const t = useT();
  const s = useHotel();
  const taken = s.stay?.minibar ?? [];
  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">{s.stay?.suite ? `⭐ ${t('Suite: the minibar is included. Help yourself!')}` : t('Everything you take goes on your bill (you pay at check-out).')}</p>
      <div className="grid grid-cols-2 gap-2">
        {MINIBAR.map((m) => {
          const n = taken.filter((x) => x === m.id).length;
          return (
            <button key={m.id} type="button" onClick={() => void s.takeMinibar(m.id)} className="flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left hover:bg-gray-50">
              <span className="text-2xl">{m.icon}</span>
              <span className="min-w-0 flex-1 text-sm" dir="ltr">
                {m.en}
                <span className="block text-xs text-gray-500">{s.stay?.suite ? t('Included') : `${m.price} 🪙`}</span>
              </span>
              {n ? <span className="rounded-full bg-blue-600 px-2 text-xs font-bold text-white">×{n}</span> : null}
            </button>
          );
        })}
      </div>
      {s.error ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{s.error}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- toasts */

/** Someone knocking on the room you are in, and short hotel notices. */
export function HotelToasts() {
  const t = useT();
  const knocks = useHotel((s) => s.knocks);
  const notice = useHotel((s) => s.notice);
  const k = knocks[0];
  if (!k && !notice) return null;
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-40 flex w-[92vw] max-w-sm -translate-x-1/2 flex-col gap-2">
      {k ? (
        <div className="pointer-events-auto rounded-xl bg-white p-3 shadow-2xl">
          <p className="text-sm">
            ✊ <b>{k.name}</b> {t('is knocking on your door.')}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                say('Come in, please!');
                useHotel.getState().answer(k.from, true);
              }}
              className="min-h-10 flex-1 rounded-lg bg-green-600 text-sm font-medium text-white"
              dir="ltr"
            >
              Come in!
            </button>
            <button
              type="button"
              onClick={() => {
                say('Sorry, not now.');
                useHotel.getState().answer(k.from, false);
              }}
              className="min-h-10 flex-1 rounded-lg border text-sm"
              dir="ltr"
            >
              Sorry, not now.
            </button>
          </div>
        </div>
      ) : null}
      {notice ? <div className="pointer-events-auto rounded-xl bg-black/75 px-3 py-2 text-center text-sm text-white">{notice}</div> : null}
    </div>
  );
}
