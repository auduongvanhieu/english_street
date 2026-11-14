import { FURNITURE, furniture } from '@es/shared';
import { getPlayerId } from '../net/player';
import { canBuyMore, inBag, useMyRoom } from '../store/myRoom';
import { useProfile } from '../store/profile';
import { usePay } from '../store/pay';
import { useEffect } from 'react';
import { useVoice } from '../store/voice';
import { useT } from '../i18n';
import { Icon } from './icons';

/** My room: shop and bag, the carried piece's controls, and the visitor bar. */
export function MyRoomHud() {
  const t = useT();
  const owner = useMyRoom((s) => s.owner);
  const ownerName = useMyRoom((s) => s.ownerName);
  const items = useMyRoom((s) => s.items);
  const owned = useMyRoom((s) => s.owned);
  const ghost = useMyRoom((s) => s.ghost);
  const panel = useMyRoom((s) => s.panel);
  const note = useMyRoom((s) => s.note);
  const coins = useProfile((s) => s.profile?.coins ?? 0);
  const gems = useProfile((s) => s.profile?.gems ?? 0);
  const gemPrices = usePay((s) => s.gem?.prices);
  useEffect(() => void usePay.getState().loadGems(), []);
  const m = useMyRoom.getState();
  if (!owner) return null;
  const mine = owner === getPlayerId();
  const bag = inBag({ items, owned });
  const bagN = Object.values(bag).reduce((a, b) => a + b, 0);
  const speak = (w: string) => useVoice.getState().speakAs('me', w, 'en-US');
  const title = mine ? t('My room') : t("{name}'s room", { name: ownerName });
  // closed: one small button; open: the bag and the shop as two tabs (going out is the door button below)
  const head = !mine ? (
    <div className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold shadow-lg">🏠 {title}</div>
  ) : !panel ? (
    <button type="button" onClick={() => m.setPanel('bag')} className="pointer-events-auto flex min-h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-sm font-semibold text-slate-800 shadow-lg">
      🏠 {title} <span className="text-xs font-normal text-slate-500">· 🎒 {bagN} · 🛒</span>
    </button>
  ) : null;
  return (
    <div
      data-ui
      // closed, the small button sits under the top-left chips (level, next quest); open, the card covers them
      className={`pointer-events-none absolute left-1/2 z-30 flex w-[94vw] max-w-md -translate-x-1/2 flex-col items-center gap-2 ${panel || ghost ? 'top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]' : 'top-[calc(max(0.75rem,env(safe-area-inset-top))+6.6rem)]'}`}
    >
      {ghost ? null : head}
      {ghost ? (
        <div className="pointer-events-auto w-full rounded-2xl bg-white/95 p-2.5 shadow-xl">
          <p className="mb-1.5 text-center text-sm" dir="ltr">
            {furniture(ghost.id)?.icon} <b>{furniture(ghost.id)?.en}</b> — {ghost.ok ? t('Walk and turn to choose the place.') : t('No space here. Move a little.')}
          </p>
          <div className="flex gap-1.5">
            {!furniture(ghost.id)?.wallY ? (
              <button type="button" onClick={() => m.rotate()} className="min-h-11 flex-1 rounded-xl bg-gray-100 text-sm font-semibold">
                ↻ {t('Turn')}
              </button>
            ) : null}
            <button type="button" disabled={!ghost.ok} onClick={() => m.place()} className="min-h-11 flex-[2] rounded-xl bg-green-600 text-sm font-semibold text-white disabled:opacity-40">
              ✓ {t('Put it here')}
            </button>
            <button type="button" onClick={() => m.putAway()} className="min-h-11 flex-1 rounded-xl bg-gray-100 text-sm">
              🎒 {t('Put away')}
            </button>
          </div>
        </div>
      ) : panel && mine ? (
        <div className="pointer-events-auto flex max-h-[60dvh] w-full flex-col overflow-hidden rounded-2xl bg-white/95 shadow-xl">
          {/* tabs and the close button stay put, the list scrolls */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-2">
            <button type="button" onClick={() => m.setPanel('bag')} className={`min-h-9 flex-1 rounded-xl px-2 text-sm font-semibold ${panel === 'bag' ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-800'}`}>
              🎒 {t('My things')} ({bagN})
            </button>
            <button type="button" onClick={() => m.setPanel('shop')} className={`min-h-9 flex-1 rounded-xl px-2 text-sm font-semibold ${panel === 'shop' ? 'bg-amber-400 text-slate-900' : 'bg-amber-50 text-amber-800'}`}>
              🛒 {t('Shop')}
            </button>
            <button type="button" onClick={() => m.setPanel(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label={t('Close')}>
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {panel === 'shop' ? (
            <>
              <p className="mb-1.5 text-xs text-gray-600">
                {t('Buy furniture for your room. Every piece is an English word!')} <b className="text-slate-700">🪙 {coins}</b>
                {gems ? <b className="ms-1 text-sky-700">💎 {gems}</b> : null}
              </p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" dir="ltr">
                {FURNITURE.map((f) => {
                  const g = f.gems ? (gemPrices?.[f.id] ?? f.gems) : 0;
                  const can = canBuyMore(owned, f.id) && (g ? gems >= g : coins >= f.price);
                  return (
                    <button key={f.id} type="button" disabled={!can} onClick={() => void m.buy(f.id)} onMouseEnter={() => undefined} className={`flex min-h-20 flex-col items-center justify-center rounded-xl border p-1 text-xs disabled:opacity-40 ${g ? 'border-sky-300 bg-sky-50' : 'border-amber-200 bg-amber-50'}`}>
                      <span className="text-2xl">{f.icon}</span>
                      <b className="text-sm">{f.en}</b>
                      <span>
                        {g ? `💎 ${g}` : `🪙 ${f.price}`}
                        {owned[f.id] ? ` · ×${owned[f.id]}` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
              {note ? <p className="mt-1 text-xs text-red-600">{note}</p> : null}
            </>
          ) : (
            <>
              <p className="mb-1.5 text-xs text-gray-600">{t('Tap a thing to carry it, then put it where you like.')}</p>
              {bagN ? (
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" dir="ltr">
                  {Object.entries(bag).map(([id, n]) => {
                    const f = furniture(id)!;
                    return (
                      <button key={id} type="button" onClick={() => (speak(f.en), m.carry(id))} className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-xs">
                        <span className="text-2xl">{f.icon}</span>
                        <b>{f.en}</b>×{n}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('Everything is in its place. Buy more in the shop!')}</p>
              )}
            </>
          )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
