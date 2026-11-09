import { useEffect, useState } from 'react';
import {
  ANIMALS,
  DECOR_ITEMS,
  DECOR_MAX,
  FARM_GOALS,
  MACHINES,
  MACHINE_INFO,
  RECIPES,
  ANIMAL_INFO,
  BARN_PRICES,
  CROPS,
  CROP_SELL,
  DOG_PRICE,
  FARM_DAY_CAP,
  FERTILIZER_PRICE,
  FIELD_PLOTS,
  HARVEST_QTY,
  MAX_FIELDS,
  MY_GROW_MS,
  PRODUCT_SELL,
  REGROW,
  SEED_PRICE,
  animalStage,
  barnCap,
  barnCount,
  barnValue,
  farmLevel,
  itemLevel,
  levelProgress,
  myPlotStage,
  shopPrice,
  unlocksAt,
  type Crop,
  type FarmOrder,
} from '@es/shared';
import { useMyFarm } from '../../store/myFarm';
import { useVoice } from '../../store/voice';
import { Icon } from '../icons';
import { useT } from '../../i18n';

/**
 * "My farm" v2 HUD pieces: the top bar with the farm level, quick buttons (water all, harvest all, orders, shop,
 * barn), the farm book (Orders · Shop · Barn tabs), the level-up card and "your crops are ready" outside the farm.
 * Rules: @es/shared myfarm.ts.
 */
export const GOOD_ICON: Record<string, string> = { carrot: '🥕', corn: '🌽', tomato: '🍅', potato: '🥔', pumpkin: '🎃', strawberry: '🍓', wheat: '🌾', egg: '🥚', milk: '🥛', wool: '🧶', truffle: '🍄', bread: '🍞', cake: '🍰', cheese: '🧀', scarf: '🧣' };
const mins = (ms: number) => (ms >= 3600_000 ? `${Math.round((ms / 3600_000) * 10) / 10} h` : `${Math.max(1, Math.round(ms / 60000))} min`);
const piece = (k: string) => CROP_SELL[k as Crop] ?? PRODUCT_SELL[k] ?? 0;
const Coin = ({ size = 13 }: { size?: number }) => <Icon name="coin" size={size} className="inline align-[-2px] text-amber-500" />;

function useNow(ms = 2000) {
  const skew = useMyFarm((s) => s.skew);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return Date.now() + skew;
}

/**
 * On screen inside the farm, kept small: one "farm book" button (badge = things to do), plus "water all" and
 * "harvest all" only while there is something to water or pick. The level, coins and barn live on the info board
 * in the middle of the farm (and the book's Info tab). A friend's farm: their name and a leave button.
 */
export function FarmTopBar() {
  const t = useT();
  const at = useMyFarm((s) => s.at);
  const view = useMyFarm((s) => s.view);
  const mine = useMyFarm((s) => s.mine);
  const panel = useMyFarm((s) => s.panel);
  const s = useMyFarm.getState();
  const now = useNow();
  if (!at || at.slot < 0) return null;
  const top = 'pointer-events-none absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(max(0.75rem,env(safe-area-inset-top))+5.4rem)] z-20 flex max-w-[calc(100vw-6rem)] items-center gap-1.5 sm:top-[9.4rem]';
  if (view) {
    return (
      <div data-ui className={top}>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/95 py-1 pe-1 ps-3 text-xs font-semibold text-slate-800 shadow-md ring-1 ring-black/5">
          🌾 {t("{name}'s farm", { name: at.name })}
          <button type="button" onClick={() => s.leave()} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100" title={t('Leave the farm')}>
            <Icon name="exit" size={13} />
          </button>
        </div>
      </div>
    );
  }
  if (panel) return null;
  const plots = mine.fields * FIELD_PLOTS;
  const toWater = mine.plots.slice(0, plots).filter((p) => p.crop && !p.wateredAt).length;
  const ripe = mine.plots.slice(0, plots).filter((p) => myPlotStage(p, now).stage === 'ready').length;
  const crafted = Object.values(mine.machines).filter((m) => m.job && now - m.job.at >= (RECIPES[m.job.recipe]?.ms ?? Infinity)).length;
  const claimable = FARM_GOALS.filter((g) => !mine.goals.includes(g.id) && (mine.stats[g.stat] ?? 0) >= g.n).length;
  const room = FARM_DAY_CAP - (mine.earned[0] === s.day ? mine.earned[1] : 0);
  const canDeliver = mine.orders.filter((o) => o.coins <= room && Object.entries(o.items).every(([k, n]) => (mine.barn[k] ?? 0) >= n)).length;
  const todo = canDeliver + crafted + claimable;
  const btn = 'pointer-events-auto relative flex h-9 items-center gap-1 rounded-full bg-white/95 px-2.5 text-sm font-semibold text-slate-800 shadow-md ring-1 ring-black/5';
  const badge = (n: number, c: string) => (n ? <span className={`absolute -right-1 -top-1 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 text-white ${c}`}>{n}</span> : null);
  return (
    <div data-ui className={top}>
      <button type="button" onClick={() => s.setPanel('info')} className={btn} title={t('Farm book')}>
        📒 <span className="hidden text-xs sm:inline">{t('Farm book')}</span>
        {badge(todo, 'bg-emerald-500')}
      </button>
      {toWater ? (
        <button type="button" onClick={() => void s.act({ action: 'waterAll' })} className={btn} title={t('Water all')}>
          💧 <span className="hidden text-xs sm:inline">{t('Water all')}</span>
          {badge(toWater, 'bg-sky-500')}
        </button>
      ) : null}
      {ripe ? (
        <button type="button" onClick={() => void s.act({ action: 'harvestAll' })} className={btn} title={t('Harvest all')}>
          🧺 <span className="hidden text-xs sm:inline">{t('Harvest all')}</span>
          {badge(ripe, 'bg-amber-500')}
        </button>
      ) : null}
    </div>
  );
}

/** Book tab: the farm at a glance (what the info board in the middle shows). */
function Info() {
  const t = useT();
  const mine = useMyFarm((s) => s.mine);
  const coins = useMyFarm((s) => s.coins);
  const day = useMyFarm((s) => s.day);
  const s = useMyFarm.getState();
  const lv = farmLevel(mine.farmXp);
  const prog = levelProgress(mine.farmXp);
  const next = prog ? unlocksAt(lv + 1) : [];
  const earned = mine.earned[0] === day ? mine.earned[1] : 0;
  const name = (it: string) => {
    const [k, w] = it.split(':');
    if (k === 'seed') return `${GOOD_ICON[w!]} ${w}`;
    if (k === 'animal') return `${ANIMAL_INFO[w as keyof typeof ANIMAL_INFO].icon} ${w}`;
    return `🪧 ${t('A new field')}`;
  };
  const cell = 'rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-black/5';
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-amber-50 p-3 ring-1 ring-black/5">
        <div className="flex items-baseline justify-between">
          <b className="text-lg text-slate-800">🌾 {t('Level {n}', { n: lv })}</b>
          <span className="text-xs text-gray-500">{prog ? `${prog[0]}/${prog[1]} XP` : 'MAX'}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${prog ? Math.round((prog[0] / prog[1]) * 100) : 100}%` }} />
        </div>
        {next.length ? (
          <p className="mt-2 text-xs text-gray-600" dir="auto">
            {t('Next level:')} <span dir="ltr" className="font-semibold text-slate-700">{next.map(name).join(' · ')}</span>
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className={cell}>
          <div className="text-xs text-gray-500">{t('Coins')}</div>
          <b className="flex items-center gap-1"><Coin /> {coins}</b>
        </div>
        <div className={cell}>
          <div className="text-xs text-gray-500">{t('Barn')}</div>
          <b>🏠 {barnCount(mine)}/{barnCap(mine)}</b>
        </div>
        <div className={cell}>
          <div className="text-xs text-gray-500">{t('Fertilizer')}</div>
          <b>🧪 {mine.fertilizer}</b>
        </div>
        <div className={cell}>
          <div className="text-xs text-gray-500">{t('Earned today')}</div>
          <b>{earned}/{FARM_DAY_CAP}</b>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => s.setPanel('decorate')} className="flex-1 rounded-xl bg-pink-50 py-2 text-sm font-semibold text-pink-800 ring-1 ring-pink-200">
          🌷 {t('Decorate')}
        </button>
        <button type="button" onClick={() => s.leave()} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-100 py-2 text-sm font-semibold text-slate-700">
          <Icon name="exit" size={15} /> {t('Leave the farm')}
        </button>
      </div>
    </div>
  );
}

/** The farm book: Orders · Shop · Barn in one card with tabs. */
export function FarmBook() {
  const t = useT();
  const panel = useMyFarm((s) => s.panel);
  const view = useMyFarm((s) => s.view);
  const at = useMyFarm((s) => s.at);
  const s = useMyFarm.getState();
  if (!at || view || (panel !== 'info' && panel !== 'orders' && panel !== 'shop' && panel !== 'barn' && panel !== 'workshop' && panel !== 'goals')) return null;
  const tabs: [typeof panel, string, string][] = [
    ['info', '🌾', t('Info')],
    ['orders', '📋', t('Orders')],
    ['shop', '🛒', t('Shop')],
    ['barn', '🏠', t('Barn')],
    ['workshop', '🍞', t('Workshop')],
    ['goals', '🏅', t('Goals')],
  ];
  const cur = tabs.find(([id]) => id === panel)!;
  return (
    <div data-ui className="absolute inset-0 z-30 flex justify-center bg-black/25 px-[3vw] pt-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)]" onPointerDown={(e) => e.target === e.currentTarget && s.setPanel(null)}>
      <div className="flex h-fit max-h-[calc(100dvh-max(0.75rem,env(safe-area-inset-top))-4.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* the title and the close button stay put; the tabs below always fit (icons, small labels) */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-amber-50 px-3 pt-2.5">
          <b className="min-w-0 flex-1 truncate text-base text-slate-800">
            {cur[1]} {cur[2]}
          </b>
          <button type="button" onClick={() => s.setPanel(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-black/5" aria-label={t('Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-amber-50 px-2 pb-1.5 pt-1.5">
          {tabs.map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => s.setPanel(id)} title={label} className={`flex min-w-0 flex-col items-center rounded-xl px-0.5 py-1 ${panel === id ? 'bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-200' : 'text-slate-500'}`}>
              <span className="text-lg leading-6">{icon}</span>
              <span className="w-full truncate text-center text-[10px] font-semibold sm:text-xs">{label}</span>
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{panel === 'info' ? <Info /> : panel === 'orders' ? <Orders /> : panel === 'shop' ? <Shop /> : panel === 'workshop' ? <Workshop /> : panel === 'goals' ? <Goals /> : <Barn />}</div>
      </div>
    </div>
  );
}

function Orders() {
  const t = useT();
  const mine = useMyFarm((s) => s.mine);
  const day = useMyFarm((s) => s.day);
  const s = useMyFarm.getState();
  const earned = mine.earned[0] === day ? mine.earned[1] : 0;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{t('People in the street need farm goods. Read the order, get everything into your barn, then deliver it. Orders pay more than selling.')}</p>
      <p className="text-xs font-semibold text-amber-700">{t('Earned on the farm today: {n}/{max} coins', { n: earned, max: FARM_DAY_CAP })}</p>
      {mine.orders.map((o) => (
        <OrderCard key={o.id} o={o} barn={mine.barn} room={FARM_DAY_CAP - earned} deliver={() => void s.act({ action: 'deliver', order: o.id })} skip={() => void s.act({ action: 'skipOrder', order: o.id })} />
      ))}
    </div>
  );
}

function OrderCard({ o, barn, room, deliver, skip }: { o: FarmOrder; barn: Record<string, number>; room: number; deliver: () => void; skip: () => void }) {
  const t = useT();
  const ok = Object.entries(o.items).every(([k, n]) => (barn[k] ?? 0) >= n);
  // the farm pays at most FARM_DAY_CAP a day: an order over what is left waits for tomorrow
  const capped = ok && o.coins > room;
  return (
    <div className={`rounded-xl border p-2.5 ${ok ? 'border-emerald-300 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/60'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <b className="text-sm text-slate-800">{o.who}</b>
        <span className="flex items-center gap-1 text-xs font-semibold">
          <span className="text-amber-700">
            +{o.coins} <Coin size={12} />
          </span>
          <span className="text-emerald-700">+{o.xp} XP</span>
        </span>
      </div>
      <button type="button" onClick={() => useVoice.getState().speakAs('me', o.text, 'en-US')} className="mb-1.5 block w-full rounded-lg bg-white/80 px-2 py-1 text-left text-sm text-slate-700" dir="ltr">
        🔊 “{o.text}”
      </button>
      <div className="mb-2 flex flex-wrap gap-1.5" dir="ltr">
        {Object.entries(o.items).map(([k, n]) => {
          const have = barn[k] ?? 0;
          return (
            <span key={k} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${have >= n ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
              {GOOD_ICON[k]} {Math.min(have, n)}/{n} {k}
            </span>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        <button type="button" disabled={!ok || capped} onClick={deliver} className="min-h-9 flex-1 rounded-lg bg-emerald-600 text-sm font-semibold text-white disabled:opacity-40">
          {t('Deliver')}
        </button>
        <button type="button" onClick={skip} className="min-h-9 rounded-lg bg-white px-3 text-xs text-slate-500 ring-1 ring-slate-200">
          {t('Skip')}
        </button>
      </div>
      {capped ? <p className="mt-1.5 text-xs font-semibold text-red-600">{t('You can earn only {n} more coins on the farm today. Deliver this order tomorrow!', { n: Math.max(0, room) })}</p> : null}
    </div>
  );
}

function Shop() {
  const t = useT();
  const mine = useMyFarm((s) => s.mine);
  const coins = useMyFarm((s) => s.coins);
  const s = useMyFarm.getState();
  const lv = farmLevel(mine.farmXp);
  const buy = (item: string, qty = 1) => void s.act({ action: 'buy', item, qty });
  const lock = (item: string) => (lv < itemLevel(mine, item) ? itemLevel(mine, item) : 0);
  const h3 = 'mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500 first:mt-0';
  return (
    <div>
      <p className="mb-2 flex items-center gap-1 text-xs text-gray-500">
        {t('You have')} <Coin /> <b>{coins}</b>
      </p>
      <h3 className={h3}>{t('Seeds (one packet = one plot)')}</h3>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" dir="ltr">
        {CROPS.map((c) => {
          const l = lock(`seed:${c}`);
          return (
            <button key={c} type="button" disabled={!!l} onClick={() => buy(`seed:${c}`)} className="relative flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 p-1 text-xs disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
              <span className="text-xl">{l ? '🔒' : GOOD_ICON[c]}</span>
              <span className="font-semibold">{c}</span>
              {l ? (
                <span>{t('Level {n}', { n: l })}</span>
              ) : (
                <>
                  <span className="text-gray-600">
                    {SEED_PRICE[c]} <Coin size={11} /> · {t('have {n}', { n: mine.seeds[c] ?? 0 })}
                  </span>
                  <span className="text-[11px] leading-tight text-emerald-800">
                    ⏱ {mins(MY_GROW_MS[c])} · {HARVEST_QTY} × {CROP_SELL[c]} <Coin size={10} />
                    {REGROW[c] ? ` · ×${REGROW[c]}` : ''}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">{t('×3 = gives three harvests (water it again after each one).')}</p>
      <h3 className={h3}>{t('Animals')}</h3>
      <div className="grid grid-cols-2 gap-1.5" dir="ltr">
        {ANIMALS.map((k) => {
          const have = mine.animals.filter((a) => a.kind === k).length;
          const info = ANIMAL_INFO[k];
          const l = lock(`animal:${k}`);
          return (
            <button key={k} type="button" disabled={!!l || have >= info.max} onClick={() => buy(`animal:${k}`)} className="flex min-h-14 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2 text-left text-xs disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
              <span className="text-2xl">{l ? '🔒' : info.icon}</span>
              <span>
                <b className="block">
                  a {k} · {info.price} <Coin size={11} />
                </b>
                {l ? (
                  <span>{t('Level {n}', { n: l })}</span>
                ) : (
                  <span className="text-gray-600">
                    {GOOD_ICON[info.product]} ⏱ {mins(info.everyMs)} · {info.sell} <Coin size={10} /> · {have}/{info.max}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <h3 className={h3}>{t('Workshop machines (in the barn)')}</h3>
      <div className="grid grid-cols-3 gap-1.5" dir="ltr">
        {MACHINES.map((m) => {
          const info = MACHINE_INFO[m];
          const l = lock(`machine:${m}`);
          const have = !!mine.machines[m];
          return (
            <button key={m} type="button" disabled={!!l || have} onClick={() => buy(`machine:${m}`)} className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-orange-200 bg-orange-50 p-1 text-xs disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400">
              <span className="text-xl">{l ? '🔒' : info.icon}</span>
              <b>{info.name}</b>
              <span>{have ? `✓ ${t('You have it')}` : l ? t('Level {n}', { n: l }) : <>{info.price} <Coin size={10} /></>}</span>
            </button>
          );
        })}
      </div>
      <h3 className={h3}>{t('Farm supplies')}</h3>
      <div className="grid grid-cols-2 gap-1.5" dir="ltr">
        <button type="button" onClick={() => buy('feed', 5)} className="min-h-12 rounded-xl border border-gray-200 bg-white px-2 text-xs">
          🌾 5 bags of feed · 5 <Coin size={11} />
          <span className="block text-gray-500">{t('have {n}', { n: mine.feed })}</span>
        </button>
        <button type="button" onClick={() => buy('fertilizer')} className="min-h-12 rounded-xl border border-violet-200 bg-violet-50 px-2 text-xs">
          🧪 fertilizer · {FERTILIZER_PRICE} <Coin size={11} />
          <span className="block text-gray-500">
            {t('have {n}', { n: mine.fertilizer })} · {t('half the time left')}
          </span>
        </button>
        <button type="button" disabled={mine.fields >= MAX_FIELDS || !!lock('field')} onClick={() => buy('field')} className="min-h-12 rounded-xl border border-orange-200 bg-orange-50 px-2 text-xs disabled:opacity-50">
          🪧 {mine.fields >= MAX_FIELDS ? t('All fields bought') : lock('field') ? `🔒 ${t('A new field')} · ${t('Level {n}', { n: lock('field') })}` : `${t('A new field (+{n} plots)', { n: FIELD_PLOTS })} · ${shopPrice(mine, 'field')}`}
          <span className="block text-gray-500">
            {mine.fields}/{MAX_FIELDS}
          </span>
        </button>
        <button type="button" disabled={mine.barnLevel >= BARN_PRICES.length} onClick={() => buy('barn')} className="min-h-12 rounded-xl border border-rose-200 bg-rose-50 px-2 text-xs disabled:opacity-50">
          🏠 {mine.barnLevel >= BARN_PRICES.length ? t('Biggest barn') : `${t('A bigger barn')} · ${shopPrice(mine, 'barn')}`}
          <span className="block text-gray-500">{t('holds {n}', { n: barnCap(mine) })}</span>
        </button>
        <button type="button" disabled={!!mine.dog || !!lock('dog')} onClick={() => buy('dog')} className="col-span-2 min-h-12 rounded-xl border border-sky-200 bg-sky-50 px-2 text-xs disabled:opacity-50">
          🐕 {mine.dog ? t('You have {name}.', { name: mine.dog.name }) : lock('dog') ? `🔒 a dog · ${t('Level {n}', { n: lock('dog') })}` : `a dog · ${DOG_PRICE}`}
          <span className="block text-gray-500">{t('Feed it every day and it chases thieves away.')}</span>
        </button>
      </div>
    </div>
  );
}

function Barn() {
  const t = useT();
  const mine = useMyFarm((s) => s.mine);
  const day = useMyFarm((s) => s.day);
  const s = useMyFarm.getState();
  const earned = mine.earned[0] === day ? mine.earned[1] : 0;
  const n = barnCount(mine);
  const cap = barnCap(mine);
  const items = Object.entries(mine.barn).filter(([, k]) => k > 0);
  return (
    <div>
      <div className="mb-2">
        <div className="mb-1 flex justify-between text-xs text-gray-600">
          <span>{t('Barn')}</span>
          <span>
            {n}/{cap}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${n >= cap ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, Math.round((n / cap) * 100))}%` }} />
        </div>
      </div>
      {items.length ? (
        <ul className="mb-2 grid grid-cols-2 gap-1.5 text-sm" dir="ltr">
          {items.map(([k, c]) => (
            <li key={k} className="flex items-center justify-between rounded-lg bg-amber-50 px-2 py-1.5">
              <span>
                {GOOD_ICON[k]} {c} × {k}
              </span>
              <span className="text-xs text-gray-600">
                {c * piece(k)} <Coin size={11} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-gray-500">{t('Your barn is empty. Harvest your plants and collect from your animals.')}</p>
      )}
      <p className="mb-2 text-xs text-gray-500">{t('Earned on the farm today: {n}/{max} coins', { n: earned, max: FARM_DAY_CAP })}</p>
      <button type="button" disabled={barnValue(mine) <= 0} onClick={() => void s.act({ action: 'sell' })} className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-40">
        {t('Sell everything')} · {barnValue(mine)} <Coin />
      </button>
      <p className="mt-1 text-center text-[11px] text-gray-500">{t('Tip: orders pay more than selling.')}</p>
    </div>
  );
}

/** "Farm level 3!" with what it unlocks. */
export function LevelUpCard() {
  const t = useT();
  const lv = useMyFarm((s) => s.levelUp);
  if (!lv) return null;
  const items = unlocksAt(lv);
  const name = (it: string) => {
    const [k, w] = it.split(':');
    if (k === 'seed') return `${GOOD_ICON[w!]} ${w} (${t('seeds')})`;
    if (k === 'animal') return `${ANIMAL_INFO[w as keyof typeof ANIMAL_INFO].icon} ${w}`;
    return `🪧 ${t('A new field')}`;
  };
  return (
    <div data-ui className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/25">
      <div className="pointer-events-auto w-[86vw] max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
        <div className="text-5xl">🎉</div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">{t('Farm level up!')}</p>
        <p className="text-3xl font-black text-slate-800">{t('Level {n}', { n: lv })}</p>
        {items.length ? (
          <>
            <p className="mt-3 text-sm text-gray-600">{t('New in the shop:')}</p>
            <ul className="mt-1 space-y-1 text-sm font-semibold" dir="ltr">
              {items.map((i) => (
                <li key={i}>{name(i)}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-600">{t('Your farm is growing. Keep going!')}</p>
        )}
        <button type="button" onClick={() => useMyFarm.setState({ levelUp: null })} className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white">
          {t('Great!')}
        </button>
      </div>
    </div>
  );
}

/** Outside the farm: "Your crops are ready!" (tap to go there). Shown once per batch. */
export function RipeNotice() {
  const t = useT();
  const at = useMyFarm((s) => s.at);
  const loaded = useMyFarm((s) => s.loaded);
  const mine = useMyFarm((s) => s.mine);
  const now = useNow(15_000);
  const [seen, setSeen] = useState('');
  if (at || !loaded) return null;
  const plots = mine.plots.slice(0, mine.fields * FIELD_PLOTS);
  const ripe = plots.filter((p) => myPlotStage(p, now).stage === 'ready').length;
  const products = mine.animals.filter((a) => animalStage(a, now).stage === 'ready').length;
  if (!ripe && !products) return null;
  const key = `${ripe}:${products}`;
  if (seen === key) return null;
  return (
    <div data-ui className="pointer-events-none absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+9rem)] left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 py-1.5 pe-1.5 ps-4 text-sm font-semibold text-white shadow-lg">
        <span>🌾 {ripe ? t('Your crops are ready! ({n} plots)', { n: ripe }) : t('Your animals have something for you!')}</span>
        <button type="button" onClick={() => useMyFarm.getState().enter()} className="rounded-full bg-white px-3 py-1 text-xs text-emerald-800">
          {t('Go')}
        </button>
        <button type="button" onClick={() => setSeen(key)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20" aria-label={t('Close')}>
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}


const timeLeftText = (ms: number) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec}s`;
};

function Workshop() {
  const t = useT();
  const mine = useMyFarm((s) => s.mine);
  const s = useMyFarm.getState();
  const now = useNow(1000);
  const owned = MACHINES.filter((m) => mine.machines[m]);
  if (!owned.length)
    return (
      <div className="py-4 text-center text-sm text-gray-600">
        <div className="text-4xl">🍞🧀🧣</div>
        <p className="mt-2">{t('Buy a machine in the shop to make bread, cheese and scarves. They sell for much more!')}</p>
        <button type="button" onClick={() => s.setPanel('shop')} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white">
          {t('Open the shop')}
        </button>
      </div>
    );
  return (
    <div className="space-y-2.5">
      {owned.map((m) => {
        const info = MACHINE_INFO[m];
        const job = mine.machines[m]!.job;
        const rec = job ? RECIPES[job.recipe] : null;
        const left = rec && job ? job.at + rec.ms - now : 0;
        return (
          <div key={m} className="rounded-xl border border-orange-200 bg-orange-50/60 p-2.5">
            <b className="text-sm">
              {info.icon} {info.name}
            </b>
            {rec && job ? (
              <div className="mt-1.5">
                <div className="mb-1 flex justify-between text-xs text-gray-600" dir="ltr">
                  <span>
                    {GOOD_ICON[rec.makes]} {rec.en}
                  </span>
                  <span>{left > 0 ? timeLeftText(left) : t('Ready!')}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, Math.round(((now - job.at) / rec.ms) * 100))}%` }} />
                </div>
                <button type="button" disabled={left > 0} onClick={() => void s.act({ action: 'takeCraft', machine: m })} className="mt-2 w-full rounded-lg bg-emerald-600 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                  {t('Take it out')}
                </button>
              </div>
            ) : (
              <div className="mt-1.5 grid gap-1.5" dir="ltr">
                {Object.entries(RECIPES)
                  .filter(([, r]) => r.machine === m)
                  .map(([id, r]) => {
                    const ok = Object.entries(r.needs).every(([k, n]) => (mine.barn[k] ?? 0) >= n);
                    return (
                      <button key={id} type="button" disabled={!ok} onClick={() => void s.act({ action: 'craft', recipe: id })} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-left text-xs ring-1 ring-orange-200 disabled:opacity-50">
                        <span>
                          <b>
                            {GOOD_ICON[r.makes]} {r.en}
                          </b>
                          <span className="block text-gray-500">
                            {Object.entries(r.needs)
                              .map(([k, n]) => `${GOOD_ICON[k] ?? ''} ${Math.min(mine.barn[k] ?? 0, n)}/${n}`)
                              .join(' · ')}{' '}
                            · ⏱ {mins(r.ms)}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold text-amber-700">
                          {r.sell} <Coin size={11} />
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Goals() {
  const t = useT();
  const mine = useMyFarm((s) => s.mine);
  const s = useMyFarm.getState();
  return (
    <div className="space-y-1.5">
      {FARM_GOALS.map((g) => {
        const have = Math.min(g.n, mine.stats[g.stat] ?? 0);
        const claimed = mine.goals.includes(g.id);
        const done = have >= g.n;
        return (
          <div key={g.id} className={`flex items-center gap-2 rounded-xl p-2.5 ring-1 ${claimed ? 'bg-slate-50 ring-slate-200' : done ? 'bg-emerald-50 ring-emerald-300' : 'bg-white ring-slate-200'}`}>
            <span className="text-xl">{claimed ? '✅' : done ? '🎁' : '🏅'}</span>
            <div className="min-w-0 flex-1">
              <b className="block text-sm" dir="ltr">
                {g.en}
              </b>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((have / g.n) * 100)}%` }} />
              </div>
              <span className="text-[11px] text-gray-500">
                {have}/{g.n} · +{g.coins} <Coin size={10} /> · +{g.fertilizer} 🧪
              </span>
            </div>
            {!claimed ? (
              <button type="button" disabled={!done} onClick={() => void s.act({ action: 'claimGoal', goal: g.id })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                {t('Claim')}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Pick a decoration (then tap the ground to put it down). */
export function DecoratePanel() {
  const t = useT();
  const panel = useMyFarm((s) => s.panel);
  const at = useMyFarm((s) => s.at);
  const view = useMyFarm((s) => s.view);
  const coins = useMyFarm((s) => s.coins);
  const count = useMyFarm((s) => s.mine.decor.length);
  if (!at || view || panel !== 'decorate') return null;
  const pick = (k: string) => useMyFarm.setState({ decorating: k, panel: null });
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[94vw] max-w-md -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl bg-white/97 p-3 shadow-2xl ring-1 ring-black/5">
        <div className="mb-2 flex items-center justify-between">
          <b className="text-gray-800">🌷 {t('Decorate my farm')}</b>
          <button type="button" onClick={() => useMyFarm.getState().setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <p className="mb-2 text-xs text-gray-500">
          {t('Choose something, then tap a free place on your farm. Tap a decoration again to take it away (you get half back).')} · {count}/{DECOR_MAX}
        </p>
        <div className="grid grid-cols-3 gap-1.5" dir="ltr">
          {Object.entries(DECOR_ITEMS).map(([k, it]) => (
            <button key={k} type="button" disabled={coins < it.price} onClick={() => pick(k)} className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-pink-200 bg-pink-50 p-1 text-xs disabled:opacity-50">
              <span className="text-xl">{it.icon}</span>
              <span>{it.en.replace(/^(a|an|some) /, '')}</span>
              <span className="text-gray-600">
                {it.price} <Coin size={10} />
              </span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => pick('')} className="mt-2 w-full rounded-xl bg-slate-100 py-2 text-sm text-slate-700">
          🧹 {t('Take decorations away')}
        </button>
      </div>
    </div>
  );
}

/** While decorating: what a tap does, and Done. */
export function DecorateBar() {
  const t = useT();
  const k = useMyFarm((s) => s.decorating);
  const at = useMyFarm((s) => s.at);
  if (k === null || !at) return null;
  const it = k ? DECOR_ITEMS[k] : null;
  return (
    <div data-ui className="pointer-events-none absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+8.5rem)] left-1/2 z-30 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-pink-600 py-1.5 pe-1.5 ps-4 text-sm font-semibold text-white shadow-xl">
        <span>{it ? `${it.icon} ${t('Tap the ground to put it there')}` : `🧹 ${t('Tap a decoration to take it away')}`}</span>
        <button type="button" onClick={() => useMyFarm.getState().setPanel('decorate')} className="rounded-full bg-white/20 px-3 py-1 text-xs">
          {t('Change')}
        </button>
        <button type="button" onClick={() => useMyFarm.setState({ decorating: null })} className="rounded-full bg-white px-3 py-1 text-xs text-pink-700">
          {t('Done')}
        </button>
      </div>
    </div>
  );
}
