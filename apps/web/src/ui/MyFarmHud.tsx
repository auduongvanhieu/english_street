import { ANIMALS, ANIMAL_INFO, CROPS, CROP_SELL, FARM_DAY_CAP, FIELD_PLOTS, MAX_FIELDS, PRODUCT_SELL, SEED_PRICE, barnValue, shopPrice, type MyFarmError, type VisitMode } from '@es/shared';
import { useMyFarm } from '../store/myFarm';
import { Icon } from './icons';
import { useT } from '../i18n';

const CROP_ICON: Record<string, string> = { carrot: '🥕', corn: '🌽', tomato: '🍅', potato: '🥔', pumpkin: '🎃', strawberry: '🍓', egg: '🥚', milk: '🥛', wool: '🧶', truffle: '🍄' };
const ERRORS: Record<MyFarmError | 'closed' | 'friends_only', string> = {
  busy: 'Something is growing there already.',
  empty: 'Nothing is planted there.',
  no_seed: 'You have no seeds of that kind. Buy some in the farm shop.',
  no_plot: 'Buy more fields first.',
  needs_water: 'Water it first.',
  not_ready: 'Not ready yet.',
  already_watered: 'Already watered.',
  no_feed: 'You have no animal feed. Buy some in the farm shop.',
  not_hungry: 'The animals are not hungry.',
  no_animal: 'No animal there.',
  too_many: 'There is no more room for that animal.',
  coins: 'Not enough coins yet.',
  bad_item: 'You cannot buy that.',
  nothing_to_sell: 'There is nothing to sell.',
  day_cap: 'You sold enough today. Come back tomorrow!',
  closed: 'This farm is closed to visitors.',
  friends_only: 'Only friends can visit this farm.',
};

/** "My farm": the top bar, the farm shop, the seed picker, the barn (sell) and the notice board (visitors). */
export function MyFarmHud() {
  const t = useT();
  const at = useMyFarm((s) => s.at);
  const mine = useMyFarm((s) => s.mine);
  const view = useMyFarm((s) => s.view);
  const coins = useMyFarm((s) => s.coins);
  const panel = useMyFarm((s) => s.panel);
  const last = useMyFarm((s) => s.last);
  const day = useMyFarm((s) => s.day);
  const s = useMyFarm.getState();
  const wrap = 'pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[94vw] max-w-md -translate-x-1/2';
  const card = 'pointer-events-auto max-h-[70dvh] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-2xl';
  const head = (icon: Parameters<typeof Icon>[0]['name'], title: string) => (
    <div className="mb-2 flex items-center justify-between">
      <b className="flex items-center gap-1.5 text-gray-800">
        <Icon name={icon} size={18} />
        {title}
      </b>
      <button type="button" onClick={() => s.setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
  const toast = last && Date.now() - last.at < 5000 ? last : null;
  const earned = mine.earned[0] === day ? mine.earned[1] : 0;
  const coin = <Icon name="coin" size={13} className="inline align-[-2px] text-amber-500" />;
  return (
    <>
      {toast?.error && !at ? (
        <div data-ui className="pointer-events-none absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-sm text-white">
          {t(ERRORS[toast.error])}
        </div>
      ) : null}
      {at && at.slot >= 0 ? (
        <div data-ui className="pointer-events-none absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[calc(max(0.75rem,env(safe-area-inset-top))+5.4rem)] z-20 sm:top-[9.4rem]">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 py-1 pe-1 ps-3 text-xs text-slate-800 shadow-md ring-1 ring-black/5 backdrop-blur-md">
            <span className="font-semibold">🌾 {view ? t("{name}'s farm", { name: at.name }) : t('My farm')}</span>
            {!view ? (
              <>
                <span className="flex items-center gap-0.5">{coin}{coins}</span>
                <span className="hidden sm:inline">· 🌱 {Object.values(mine.seeds).reduce((a, b) => a + b, 0)} · 🌾 {mine.feed}</span>
              </>
            ) : null}
            <button type="button" onClick={() => s.leave()} className="flex h-7 items-center gap-1 rounded-full bg-slate-100 px-2" title={t('Leave the farm')}>
              <Icon name="exit" size={14} />
            </button>
          </div>
        </div>
      ) : null}
      {at && toast ? (
        <div data-ui className="pointer-events-none absolute bottom-40 left-1/2 z-20 -translate-x-1/2">
          <div className={`rounded-full px-4 py-2 text-sm shadow-lg ${toast.error ? 'bg-red-50 text-red-700' : 'bg-white/95 text-slate-800'}`} dir="auto">
            {toast.error ? t(ERRORS[toast.error]) : (
              <>
                <span dir="ltr">“{toast.said}”</span> {toast.xp ? <b className="text-emerald-700">+{toast.xp} XP</b> : null} {toast.coins ? <b className={toast.coins > 0 ? 'text-amber-600' : 'text-gray-500'}>{toast.coins > 0 ? '+' : ''}{toast.coins} {coin}</b> : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {at && panel === 'shop' ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head('bus', t('Farm shop'))}
            <p className="mb-2 flex items-center gap-1 text-xs text-gray-500">
              {t('You have')} {coin} <b>{coins}</b>
            </p>
            <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('Seeds (one packet = one plot)')}</h3>
            <div className="mb-3 grid grid-cols-3 gap-1.5" dir="ltr">
              {CROPS.map((c) => (
                <button key={c} type="button" onClick={() => void s.act({ action: 'buy', item: `seed:${c}`, qty: 1 })} className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 p-1 text-xs">
                  <span className="text-xl">{CROP_ICON[c]}</span>
                  <span className="font-medium">{c}</span>
                  <span className="text-gray-500">
                    {SEED_PRICE[c]} {coin} · {t('have {n}', { n: mine.seeds[c] ?? 0 })}
                  </span>
                </button>
              ))}
            </div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('Animals')}</h3>
            <div className="mb-3 grid grid-cols-2 gap-1.5" dir="ltr">
              {ANIMALS.map((k) => {
                const have = mine.animals.filter((a) => a.kind === k).length;
                const info = ANIMAL_INFO[k];
                return (
                  <button key={k} type="button" disabled={have >= info.max} onClick={() => void s.act({ action: 'buy', item: `animal:${k}`, qty: 1 })} className="flex min-h-14 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2 text-left text-xs disabled:opacity-50">
                    <span className="text-2xl">{info.icon}</span>
                    <span>
                      <b className="block">
                        a {k} · {info.price} {coin}
                      </b>
                      <span className="text-gray-500">
                        {info.productEn} · {have}/{info.max}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('Feed and fields')}</h3>
            <div className="grid grid-cols-2 gap-1.5" dir="ltr">
              {[1, 5].map((n) => (
                <button key={n} type="button" onClick={() => void s.act({ action: 'buy', item: 'feed', qty: n })} className="min-h-12 rounded-xl border border-gray-200 bg-white px-2 text-xs">
                  🌾 {n === 1 ? 'a bag of feed' : `${n} bags of feed`} · {n} {coin}
                  <span className="block text-gray-500">{t('have {n}', { n: mine.feed })}</span>
                </button>
              ))}
              <button type="button" disabled={mine.fields >= MAX_FIELDS} onClick={() => void s.act({ action: 'buy', item: 'field', qty: 1 })} className="col-span-2 min-h-12 rounded-xl border border-orange-200 bg-orange-50 px-2 text-xs disabled:opacity-50">
                🪧 {mine.fields >= MAX_FIELDS ? t('All fields bought') : `${t('A new field (+{n} plots)', { n: FIELD_PLOTS })} · ${shopPrice(mine, 'field')}`} {mine.fields < MAX_FIELDS ? coin : null}
                <span className="block text-gray-500">
                  {mine.fields}/{MAX_FIELDS}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {at && panel && typeof panel === 'object' ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head('pin', t('What do you want to plant?'))}
            <div className="grid grid-cols-3 gap-1.5" dir="ltr">
              {CROPS.map((c) => {
                const n = mine.seeds[c] ?? 0;
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={!n}
                    onClick={() => {
                      void s.act({ action: 'plant', plot: panel.plot, crop: c });
                      s.setPanel(null);
                    }}
                    className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs disabled:opacity-40"
                  >
                    <span className="text-xl">{CROP_ICON[c]}</span>
                    {c} × {n}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => s.setPanel('shop')} className="mt-2 w-full rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white">
              {t('Buy seeds')}
            </button>
          </div>
        </div>
      ) : null}

      {at && panel === 'barn' ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head('coin', t('Sell my produce'))}
            {Object.entries(mine.barn).filter(([, n]) => n > 0).length ? (
              <ul className="mb-2 space-y-1 text-sm" dir="ltr">
                {Object.entries(mine.barn)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => (
                    <li key={k} className="flex justify-between rounded-lg bg-amber-50 px-2 py-1">
                      <span>
                        {CROP_ICON[k]} {n} × {k}
                      </span>
                      <span>
                        {n * (CROP_SELL[k as keyof typeof CROP_SELL] ?? PRODUCT_SELL[k] ?? 0)} {coin}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mb-2 text-sm text-gray-500">{t('Your barn is empty. Harvest your plants and collect from your animals.')}</p>
            )}
            <p className="mb-2 text-xs text-gray-500">{t('Sold today: {n}/{max} coins', { n: earned, max: FARM_DAY_CAP })}</p>
            <button type="button" disabled={barnValue(mine) <= 0} onClick={() => void s.act({ action: 'sell' })} className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {t('Sell everything')} · {barnValue(mine)} {coin}
            </button>
          </div>
        </div>
      ) : null}

      {at && panel === 'settings' ? (
        <div data-ui className={wrap}>
          <div className={card}>
            {head('book', t('Farm notice board'))}
            <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('Who can visit my farm?')}</h3>
            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {(
                [
                  ['friends', t('Friends')],
                  ['everyone', t('Everybody')],
                  ['closed', t('Nobody')],
                ] as [VisitMode, string][]
              ).map(([m, label]) => (
                <button key={m} type="button" onClick={() => void s.act({ action: 'visits', mode: m })} className={`min-h-10 rounded-xl text-sm ${mine.visits === m ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                  {label}
                </button>
              ))}
            </div>
            <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('What happened on my farm')}</h3>
            {mine.log.length ? (
              <ul className="space-y-1 text-sm" dir="ltr">
                {[...mine.log].reverse().map((l) => (
                  <li key={l.t} className="rounded-lg bg-gray-50 px-2 py-1">
                    <span className="me-1 text-xs text-gray-400">{new Date(l.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {l.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{t('Nothing yet.')}</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
