import { useEffect, useState } from 'react';
import { Sheet, SheetHeader } from '../Sheet';
import { boatSay, useBoats } from '../../store/boats';
import { useProfile } from '../../store/profile';
import { localPos } from '../../scene/LocalPlayer';
import { KIOSK_SPOT } from '../../world/places/river';
import { FISH, useFishing } from '../../store/fishing';
import { useT } from '../../i18n';

/**
 * The boat keeper at the hire kiosk: ask the price, ask for a life jacket, ask where you may go, hire a boat.
 * Lines are English (spoken); instructions are translated.
 */
type Line = { who: 'keeper' | 'me'; text: string };

function Bubble({ l }: { l: Line }) {
  return (
    <div className={`mb-2 flex items-start gap-2 ${l.who === 'me' ? 'flex-row-reverse' : ''}`}>
      <span className="text-xl">{l.who === 'keeper' ? '🧔' : '🙂'}</span>
      <p className={`flex-1 rounded-2xl px-3 py-2 text-sm ${l.who === 'keeper' ? 'bg-gray-100' : 'bg-blue-50'}`} dir="ltr">
        {l.text}
      </p>
      {l.who === 'keeper' ? (
        <button type="button" onClick={() => boatSay(l.text)} className="min-h-8 min-w-8 rounded-full text-sm hover:bg-gray-100" aria-label="🔊">
          🔊
        </button>
      ) : null}
    </div>
  );
}

function left(until: number) {
  const s = Math.max(0, Math.round((until - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function BoatPanel() {
  const t = useT();
  const panel = useBoats((s) => s.panel);
  const until = useBoats((s) => s.until);
  const price = useBoats((s) => s.price);
  const minutes = useBoats((s) => s.minutes);
  const free = useBoats((s) => s.free);
  const error = useBoats((s) => s.error);
  const coins = useProfile((s) => s.profile?.coins ?? 0);
  const [lines, setLines] = useState<Line[]>([]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!panel) return;
    const hello = 'Hello! Would you like to hire a boat?';
    setLines([{ who: 'keeper', text: hello }]);
    boatSay(hello);
    const id = window.setInterval(() => {
      tick((n) => n + 1);
      // walked away from the kiosk: close
      if (Math.hypot(localPos.x - KIOSK_SPOT.x, localPos.z - KIOSK_SPOT.z) > 4) useBoats.getState().open(null);
    }, 1000);
    return () => window.clearInterval(id);
  }, [panel]);
  if (!panel) return null;
  const close = () => useBoats.getState().open(null);
  const hired = until > Date.now();
  const ask = (q: string, a: string) => {
    setLines((l) => [...l, { who: 'me', text: q }, { who: 'keeper', text: a }]);
    boatSay(a);
  };
  const choices: { q: string; act: () => void }[] = [
    { q: 'How much is it?', act: () => ask('How much is it?', free ? `Your first ride is free! After that, it's ${price} coins for ${minutes} minutes.` : `It's ${price} coins for ${minutes} minutes.`) },
    { q: 'Can I have a life jacket, please?', act: () => ask('Can I have a life jacket, please?', 'Of course. Here you are. Safety first!') },
    { q: 'Where can I go?', act: () => ask('Where can I go?', 'You can go anywhere between the two bridges. Please stay inside the red buoys.') },
    { q: 'How do I row?', act: () => ask('How do I row?', 'Get in the boat. Go forward and back to row, left and right to turn. Two people can sit in one boat!') },
  ];
  return (
    <Sheet onClose={close} label={t('Boat hire')}>
      <SheetHeader>
        <h2 className="text-lg font-bold">🚣 {t('Boat hire')}</h2>
        <button type="button" onClick={close} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
        {lines.map((l, i) => (
          <Bubble key={i} l={l} />
        ))}
        {hired ? <p className="mb-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">⏱️ {t('Your boat time: {t} left. Walk to a boat on the pier and get in.', { t: left(until) })}</p> : null}
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <p className="mb-1 text-xs text-gray-500">{t('Ask the boat keeper:')}</p>
        {choices.map((c) => (
          <button key={c.q} type="button" onClick={c.act} className="mb-1.5 block min-h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm hover:bg-blue-100" dir="ltr">
            {c.q}
          </button>
        ))}
        {!hired ? (
          <button
            type="button"
            disabled={!free && coins < price}
            onClick={async () => {
              const q = "I'd like to hire a boat, please.";
              setLines((l) => [...l, { who: 'me', text: q }]);
              if (await useBoats.getState().hire()) {
                const a = `Here you are! Your boat is at the pier. Please bring it back in ${minutes} minutes. Have fun!`;
                setLines((l) => [...l, { who: 'keeper', text: a }]);
                boatSay(a);
                window.setTimeout(() => useBoats.getState().open(null), 4000);
              }
            }}
            className="mt-2 block min-h-11 w-full rounded-xl bg-blue-600 px-3 py-2 text-left text-sm font-semibold text-white disabled:opacity-50"
            dir="ltr"
          >
            I'd like to hire a boat, please. <span className="font-normal opacity-80">({free ? t('free') : `🪙 ${price}`})</span>
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

/** Short notices (seat taken, time over…). */
export function BoatToasts() {
  const notice = useBoats((s) => s.notice);
  if (!notice) return null;
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-40 w-[92vw] max-w-sm -translate-x-1/2">
      <div className="rounded-xl bg-white p-3 text-sm shadow-2xl">{notice}</div>
    </div>
  );
}

/** Fishing: what is happening, the catch with its English name, and the fish book. */
export function FishingHud() {
  const t = useT();
  const phase = useFishing((s) => s.phase);
  const spot = useFishing((s) => s.spot);
  const fish = useFishing((s) => s.catch);
  const book = useFishing((s) => s.book);
  const xp = useFishing((s) => s.xp);
  const [showBook, setShowBook] = useState(false);
  if (!spot) return null;
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 text-center shadow-2xl">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-gray-800">🎣 {t('Fishing')}</span>
          <button type="button" onClick={() => setShowBook((v) => !v)} className="min-h-8 rounded-full px-2 hover:bg-gray-100">
            📖 {book.length} / {FISH.length}
          </button>
          <button type="button" onClick={() => useFishing.getState().stop()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
            ✕
          </button>
        </div>
        {showBook ? (
          <div className="mt-2 grid grid-cols-5 gap-1 text-xs" dir="ltr">
            {FISH.map((f) => (
              <div key={f.id} className={`rounded-lg p-1 ${book.includes(f.id) ? 'bg-blue-50' : 'bg-gray-100 opacity-50'}`}>
                <div className="text-xl">{book.includes(f.id) ? f.emoji : '❔'}</div>
                <div>{book.includes(f.id) ? f.en.replace(/^(a|an|the) /, '') : '???'}</div>
              </div>
            ))}
          </div>
        ) : phase === 'waiting' ? (
          <div className="py-2 text-sm">{t('Wait for a bite… then press Pull!')}</div>
        ) : phase === 'bite' ? (
          <div className="animate-pulse py-2 text-lg font-bold text-red-600">{t('A bite! Pull now!')}</div>
        ) : phase === 'missed' ? (
          <div className="py-2 text-sm">{t('It got away. Press Go fishing to try again.')}</div>
        ) : phase === 'caught' && fish ? (
          <div className="py-1" dir="ltr">
            <div className="text-3xl">{fish.emoji}</div>
            <div className="font-bold">You caught {fish.en}!</div>
            <div className="text-sm text-gray-600">{fish.fact}</div>
            {xp ? <div className="mt-1 text-xs text-green-700">+{xp} XP</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
