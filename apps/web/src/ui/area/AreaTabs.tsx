import { useEffect, useState } from 'react';
import { CROPS, CROP_PRICE, GROW_MS, plotStage, type AreaContentDto, type Crop } from '@es/shared';
import { useFarm } from '../../store/farm';
import { useRestaurant } from '../../store/restaurant';
import { useShopping } from '../../store/shopping';
import { useArea } from '../../store/area';
import { tk, useLang, useT } from '../../i18n';
import { say } from './common';

const ERR: Record<string, string> = {
  not_ready: tk("It isn't ready yet. Wait a little!"),
  busy: tk('Something is already growing there.'),
  empty: tk('Nothing is planted there.'),
  nothing_to_sell: tk('You have nothing to sell.'),
  coin_cap: tk("You've sold a lot this hour. Come back later!"),
  cooldown: tk('You did that a moment ago. Try again later.'),
  needs_water: tk('Water it first!'),
  already_watered: tk('It already has water.'),
};

/** 🌱 My garden (6 plots), basket + market, animal chores. */
export function FarmTab({ content }: { content: AreaContentDto }) {
  const t = useT();
  const { farm, skew, act, busy, last, plot, setPlot } = useFarm();
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 2000);
    return () => clearInterval(iv);
  }, []);
  const now = Date.now() + skew;
  const item = (id: string) => content.items.find((i) => i.id === id);
  const label = (id: string) => item(id)?.en ?? id;
  const tr = (id: string) => item(id)?.tr.meaning;
  const icon = (id: string) => item(id)?.icon ?? '🌱';
  return (
    <div className="space-y-4 py-2">
      {last && Date.now() - last.at < 8000 ? (
        <div className={`rounded-lg px-3 py-2 text-sm ${last.error ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900'}`}>
          {last.error ? (
            t(ERR[last.error] ?? tk('Try again.'))
          ) : (
            <>
              <span dir="ltr">“{last.said}”</span> <button type="button" onClick={() => say(last.said)} className="text-xs">🔊</button>
              {last.xp || last.coins ? <span className="ms-2 text-emerald-700">+{last.xp} XP{last.coins ? ` · +${last.coins} 🪙` : ''}</span> : null}
            </>
          )}
        </div>
      ) : null}
      <section>
        <h3 className="mb-2 text-sm font-semibold">🌱 {t('My garden')}</h3>
        <div className="grid grid-cols-3 gap-2">
          {farm.plots.map((p, i) => {
            const st = plotStage(p, now);
            const sel = plot === i;
            return (
              <button key={i} type="button" onClick={() => setPlot(sel ? null : i)} className={`min-h-20 rounded-xl border-2 p-1 text-center ${sel ? 'border-green-600 bg-green-50' : 'border-amber-200 bg-amber-50/50'}`}>
                <div className="text-2xl">{p.crop ? icon(p.crop) : '🟫'}</div>
                <div className="text-[11px]" dir="ltr">
                  {p.crop ? label(p.crop) : t('empty')}
                </div>
                <div className="text-[10px] text-gray-500">
                  {st.stage === 'seed' ? `💧 ${t('needs water')}` : st.stage === 'growing' ? `${Math.round(st.progress * 100)}%` : st.stage === 'ready' ? `⭐ ${t('ready!')}` : ''}
                </div>
              </button>
            );
          })}
        </div>
        {plot !== null ? (
          <div className="mt-2 rounded-xl bg-gray-50 p-2">
            {(() => {
              const p = farm.plots[plot];
              const st = plotStage(p, now);
              if (st.stage === 'empty')
                return (
                  <>
                    <div className="mb-1 text-xs text-gray-600">{t('Choose seeds to plant:')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {CROPS.map((c) => (
                        <button key={c} type="button" disabled={busy} onClick={() => void act({ action: 'plant', plot, crop: c })} className="min-h-9 rounded-full border bg-white px-2.5 text-sm" title={`${Math.round(GROW_MS[c] / 60000)} min`}>
                          {icon(c)} <span dir="ltr">{label(c)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                );
              if (st.stage === 'seed')
                return (
                  <button type="button" disabled={busy} onClick={() => void act({ action: 'water', plot })} className="min-h-10 w-full rounded-lg bg-sky-600 text-sm font-semibold text-white">
                    💧 <span dir="ltr">Water the {label(p!.crop!)}</span>
                  </button>
                );
              if (st.stage === 'growing')
                return (
                  <div className="text-sm text-gray-600">
                    {t('Growing… ready in about {m} min.', { m: Math.max(1, Math.ceil(((1 - st.progress) * GROW_MS[p!.crop as Crop]) / 60000)) })}
                  </div>
                );
              return (
                <button type="button" disabled={busy} onClick={() => void act({ action: 'harvest', plot })} className="min-h-10 w-full rounded-lg bg-amber-500 text-sm font-semibold text-white">
                  🧺 <span dir="ltr">Harvest the {label(p!.crop!)}</span>
                </button>
              );
            })()}
          </div>
        ) : null}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">🧺 {t('My basket')} · {t('Farm market')}</h3>
        {Object.values(farm.basket).every((n) => !n) ? (
          <p className="text-xs text-gray-500">{t('Harvest something, then sell it here.')}</p>
        ) : (
          <div className="space-y-1">
            {Object.entries(farm.basket)
              .filter(([, n]) => n > 0)
              .map(([c, n]) => (
                <div key={c} className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-sm">
                  <span>
                    {icon(c)} <span dir="ltr">{n} × {label(c)}</span> {tr(c) ? <span className="text-xs text-blue-800">({tr(c)})</span> : null}
                  </span>
                  <button type="button" disabled={busy} onClick={() => void act({ action: 'sell', crop: c as Crop })} className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">
                    {t('Sell')} · {n * CROP_PRICE[c as Crop]} 🪙
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">🐄 {t('Farm jobs')}</h3>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['feed', '🌾', 'Feed the animals'],
              ['milk', '🥛', 'Milk the cow'],
              ['collect-eggs', '🥚', 'Collect the eggs'],
            ] as const
          ).map(([c, ic, en]) => (
            <button key={c} type="button" disabled={busy} onClick={() => void act({ action: 'chore', chore: c })} className="min-h-14 rounded-xl border bg-white px-1 text-xs">
              <div className="text-xl">{ic}</div>
              <span dir="ltr">{en}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** 📋 Menu with prices; when you sit at a table you can order and the dish arrives on your table. */
export function MenuTab({ content }: { content: AreaContentDto }) {
  const t = useT();
  const noTr = useLang((s) => s.lang === 'en');
  const seat = useRestaurant((s) => s.seat);
  const order = useRestaurant((s) => s.order);
  const orderDish = useRestaurant((s) => s.orderDish);
  const openCard = useArea((s) => s.openCard);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!order) return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [order]);
  const cats = content.categories.filter((c) => c.id !== 'table');
  return (
    <div className="py-2">
      <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${seat ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
        {seat ? (order ? (order.readyAt > Date.now() ? t('The waiter is bringing your food…') : t('Enjoy your meal!')) : t('You are at a table. Tap “Order” next to a dish.')) : t('Sit at a table inside the restaurant to order.')}
      </div>
      {order ? (
        <div className="mb-3 text-center text-sm" dir="ltr">
          “I'd like the {content.items.find((i) => i.id === order.item)?.en}, please.”{' '}
          <button type="button" onClick={() => say(`I'd like the ${content.items.find((i) => i.id === order.item)?.en}, please.`)} className="text-xs">
            🔊
          </button>
        </div>
      ) : null}
      {cats.map((c) => (
        <section key={c.id} className="mb-3">
          <h3 className="border-b pb-1 text-sm font-bold" dir="ltr">
            {c.label} {!noTr && content.categoryTr[c.id] ? <span className="text-xs font-normal text-blue-800">· {content.categoryTr[c.id]}</span> : null}
          </h3>
          {content.items
            .filter((i) => i.category === c.id)
            .map((i) => (
              <div key={i.id} className="flex items-center gap-2 border-b border-dashed py-1.5">
                <button type="button" onClick={() => openCard({ area: 'restaurant', item: i.id })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="text-2xl">{i.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium" dir="ltr">
                      {i.en}
                    </span>
                    <span className="block truncate text-[11px] text-gray-500" dir="ltr">
                      {i.note}
                    </span>
                    {!noTr && i.tr.meaning ? <span className="block text-[11px] text-blue-800">{i.tr.meaning}</span> : null}
                  </span>
                </button>
                <span className="text-sm font-semibold text-emerald-700" dir="ltr">
                  ${i.price}
                </span>
                {seat ? (
                  <button
                    type="button"
                    onClick={() => {
                      orderDish(i.id);
                      say(`I'd like the ${i.en}, please.`);
                    }}
                    className="min-h-9 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white"
                  >
                    {t('Order')}
                  </button>
                ) : null}
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

/** 🛒 Shopping list game: find the products on the shelves, then pay at the checkout. */
export function ShoppingTab({ content }: { content: AreaContentDto }) {
  const t = useT();
  const { list, cart, note, result, start, remove, checkout } = useShopping();
  const label = (id: string) => content.items.find((i) => i.id === id);
  if (!list.length)
    return (
      <div className="py-4 text-center">
        {result ? (
          <div className="mb-4">
            <div className="text-4xl">{result.correct === result.total ? '🏆' : '🧾'}</div>
            <p className="font-semibold">{t('{score} / {total} items right', { score: result.correct, total: result.total })}</p>
            {result.xp || result.coins ? <p className="text-sm text-emerald-700">+{result.xp} XP{result.coins ? ` · +${result.coins} 🪙` : ''}</p> : null}
            <p className="mt-1 text-sm" dir="ltr">
              “Here's your change and your receipt. Have a nice day!”
            </p>
          </div>
        ) : (
          <p className="mb-3 text-sm text-gray-600">{t('Get a shopping list, find each product on the shelves and tap it to put it in your trolley.')}</p>
        )}
        <button type="button" onClick={() => void start()} className="min-h-11 rounded-lg bg-teal-600 px-6 text-sm font-semibold text-white">
          📝 {t('Get a shopping list')}
        </button>
      </div>
    );
  return (
    <div className="space-y-3 py-2">
      <section className="rounded-xl bg-yellow-50 p-3 shadow-inner">
        <h3 className="mb-1 text-sm font-bold">📝 {t('Shopping list')}</h3>
        {list.map((l) => {
          const have = cart[l.item] ?? 0;
          const ok = have === l.qty;
          return (
            <div key={l.item} className="flex items-center justify-between gap-2 py-0.5 text-base">
              <span className={ok ? 'text-green-700 line-through' : ''} dir="ltr">
                {l.text}
              </span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => say(l.text)} className="text-xs">
                  🔊
                </button>
                <span className={`text-xs ${have > l.qty ? 'text-red-600' : 'text-gray-500'}`}>
                  {have}/{l.qty}
                </span>
              </span>
            </div>
          );
        })}
      </section>
      {note && Date.now() - note.at < 5000 ? (
        <div className={`rounded-lg px-3 py-1.5 text-sm ${note.ok ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
          {note.text === 'added' ? t('In the trolley!') : note.text === 'too_many' ? t('Too many! Check the list.') : t("That's not on your list.")}
        </div>
      ) : null}
      <section>
        <h3 className="mb-1 text-sm font-semibold">🛒 {t('My trolley')}</h3>
        {Object.keys(cart).length === 0 ? <p className="text-xs text-gray-500">{t('Empty. Walk to the shelves and tap a product.')}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(cart).map(([id, n]) => (
            <button key={id} type="button" onClick={() => remove(id)} className="rounded-full border bg-white px-2 py-0.5 text-sm" title={t('Tap to put one back')}>
              {label(id)?.icon} <span dir="ltr">{n}× {label(id)?.en}</span> ✕
            </button>
          ))}
        </div>
      </section>
      <button type="button" onClick={() => void checkout()} className="min-h-11 w-full rounded-lg bg-teal-600 text-sm font-semibold text-white">
        💳 {t('Pay at the checkout')}
      </button>
    </div>
  );
}

/** Small floating shopping list while the guide is closed (walk the aisles with it). */
export function ShoppingMini() {
  const t = useT();
  const list = useShopping((s) => s.list);
  const cart = useShopping((s) => s.cart);
  const current = useArea((s) => s.current);
  const panel = useArea((s) => s.panel);
  const setPanel = useArea((s) => s.setPanel);
  if (!list.length || panel || current !== 'supermarket') return null;
  return (
    <button type="button" data-ui onClick={() => setPanel(true, 'shop')} className="absolute left-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-10 max-w-[60vw] rounded-xl bg-yellow-50/95 p-2 text-left text-xs shadow-lg">
      <b>📝 {t('Shopping list')}</b>
      {list.map((l) => (
        <div key={l.item} className={(cart[l.item] ?? 0) === l.qty ? 'text-green-700 line-through' : ''} dir="ltr">
          {l.text} <span className="text-gray-500">({cart[l.item] ?? 0}/{l.qty})</span>
        </div>
      ))}
    </button>
  );
}
