import { useEffect } from 'react';
import { NOTES, useShopping } from '../store/shopping';
import { money } from '../store/restaurant';
import { useSettings } from '../store/settings';
import { beepSound } from '../audio/ambient';
import { useT } from '../i18n';

/**
 * Supermarket checkout card: the cashier scans the trolley line by line (beep), says the total; the shopper hands
 * over a note, works out the change, answers "Do you need a bag?". Then the receipt with the result.
 */
export function CheckoutHud() {
  const t = useT();
  const till = useShopping((s) => s.till);
  const result = useShopping((s) => s.result);
  const stage = till?.stage;
  const scanned = till?.scanned ?? 0;

  useEffect(() => {
    if (stage !== 'scan') return;
    const id = window.setTimeout(() => {
      beepSound(Math.max(0.3, useSettings.getState().ambientVolume));
      useShopping.getState().scanNext();
    }, scanned === 0 ? 1600 : 850);
    return () => window.clearTimeout(id);
  }, [stage, scanned]);

  if (!till) return null;
  const s = useShopping.getState();
  const shown = till.lines.slice(0, till.scanned);
  const sub = shown.reduce((a, l) => a + l.qty * l.price, 0);
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[92vw] max-w-sm -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl">
        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-gray-800">💳 {t('Checkout')} · Sam</span>
          <button type="button" onClick={() => s.closeTill()} className="min-h-8 min-w-8 rounded-full text-base" aria-label={t('Close')}>
            ✕
          </button>
        </div>
        {/* the till screen */}
        <div className="rounded-lg bg-gray-900 px-3 py-2 font-mono text-sm text-green-300" dir="ltr">
          {shown.map((l) => (
            <div key={l.item} className="flex justify-between gap-2">
              <span className="truncate">
                {l.qty}× {l.name.replace(/^(a|an|one|two|three)\s+/, '')}
              </span>
              <span>{money(Math.round(l.qty * l.price * 100) / 100)}</span>
            </div>
          ))}
          {till.stage === 'scan' ? <div className="animate-pulse text-green-500">▌ {t('Scanning…')}</div> : null}
          <div className="mt-1 flex justify-between border-t border-green-800 pt-1 font-bold">
            <span>TOTAL</span>
            <span>{money(Math.round(sub * 100) / 100)}</span>
          </div>
          {till.paid ? (
            <div className="flex justify-between text-green-400">
              <span>CASH</span>
              <span>{money(till.paid)}</span>
            </div>
          ) : null}
        </div>

        {till.stage === 'pay' ? (
          <div className="mt-2" dir="ltr">
            <p className="text-sm font-semibold">🗣️ “That's {money(till.total)}, please.”</p>
            <p className="mb-1 text-xs text-gray-500">{t('Which note do you give?')}</p>
            <div className="flex gap-1.5">
              {NOTES.map((n) => (
                <button key={n} type="button" onClick={() => s.payWith(n)} className="min-h-11 flex-1 rounded-xl border-2 border-emerald-700 bg-emerald-50 text-base font-bold text-emerald-800">
                  💵 ${n}
                </button>
              ))}
            </div>
            {till.note === 'not_enough' ? <p className="mt-1 text-sm text-red-600">{t("That's not enough money.")}</p> : null}
          </div>
        ) : null}

        {till.stage === 'change' ? (
          <div className="mt-2" dir="ltr">
            <p className="text-sm font-semibold">🗣️ “Out of {money(till.paid)}. Here's your change.”</p>
            <p className="mb-1 text-xs text-gray-500">{t('How much change should you get?')}</p>
            <div className="flex gap-1.5">
              {till.options.map((v) => (
                <button key={v} type="button" onClick={() => s.sayChange(v)} className="min-h-11 flex-1 rounded-xl bg-amber-100 text-base font-bold text-amber-900">
                  {money(v)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {till.stage === 'bag' ? (
          <div className="mt-2" dir="ltr">
            {till.changeRight === false ? (
              <p className="text-sm text-red-600">
                {money(till.paid)} − {money(till.total)} = <b>{money(Math.round((till.paid - till.total) * 100) / 100)}</b>
              </p>
            ) : till.changeRight ? (
              <p className="text-sm text-emerald-700">✅ {t('Right change!')}</p>
            ) : null}
            <p className="text-sm font-semibold">🗣️ “Do you need a bag?”</p>
            <div className="mt-1 flex gap-1.5">
              <button type="button" onClick={() => s.bag(true)} className="min-h-11 flex-1 rounded-xl bg-teal-600 text-sm font-semibold text-white">
                “Yes, please.”
              </button>
              <button type="button" onClick={() => s.bag(false)} className="min-h-11 flex-1 rounded-xl bg-gray-200 text-sm font-semibold">
                “No, thanks.”
              </button>
            </div>
          </div>
        ) : null}

        {till.stage === 'done' ? (
          <div className="mt-2 text-center">
            <div className="text-3xl">🧾</div>
            {result ? (
              <>
                {result.total ? <p className="font-semibold">{t('{score} / {total} items right', { score: result.correct, total: result.total })}</p> : null}
                <p className="text-sm">{result.change ? `✅ ${t('Right change!')}` : `✘ ${t('Check the change next time.')}`}</p>
                {result.xp || result.coins ? <p className="text-sm text-emerald-700">+{result.xp} XP{result.coins ? ` · +${result.coins} 🪙` : ''}</p> : null}
              </>
            ) : (
              <p className="text-sm text-gray-500">…</p>
            )}
            <button type="button" onClick={() => s.closeTill()} className="mt-2 min-h-10 w-full rounded-xl bg-teal-600 text-sm font-semibold text-white">
              {t('Done')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
