import { useEffect, useMemo, useState } from 'react';
import { ANIMALS, ANIMAL_INFO, CROPS, CROP_SELL, DOG_COMMANDS, DOG_PRICE, DOG_TRAIN_PER_DAY, FARM_DAY_CAP, FIELD_PLOTS, MAX_FIELDS, PRODUCT_SELL, SEED_PRICE, barnValue, dogLevel, shopPrice, type VisitMode } from '@es/shared';
import { breath } from '../scene/LocalPlayer';
import { useMyFarm } from '../store/myFarm';
import { Icon } from './icons';
import { useT } from '../i18n';
import { useVoice } from '../store/voice';

const CROP_ICON: Record<string, string> = { carrot: '🥕', corn: '🌽', tomato: '🍅', potato: '🥔', pumpkin: '🎃', strawberry: '🍓', egg: '🥚', milk: '🥛', wool: '🧶', truffle: '🍄' };
const ERRORS: Record<string, string> = {
  no_dog: 'You have no dog yet. Buy one in the farm shop.',
  dog_fed: 'Your dog has had its dinner today.',
  trained: 'Enough training for today. Come back tomorrow!',
  steal_guest: 'Only players with an account can do that.',
  steal_level: 'You and your friend need to be level 3 or higher.',
  steal_busy: 'You are already running!',
  steal_limit: 'That is enough for today.',
  steal_not_ready: 'It is not ripe yet.',
  steal_taken: 'Somebody already took one from there.',
  help_limit: 'You helped a lot today. Thank you!',
  help_nothing: 'That plot does not need water.',
  note_limit: 'You left enough notes today.',
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
      <ChaseBanner />
      {at && panel === 'train' ? <TrainPanel /> : null}
      {toast?.note ? (
        <div data-ui className="pointer-events-none absolute left-1/2 top-28 z-30 -translate-x-1/2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          🐕 {toast.note}
        </div>
      ) : null}
      {toast && !toast.note ? (
        <div data-ui className="pointer-events-none absolute bottom-40 left-1/2 z-20 -translate-x-1/2">
          <div className={`rounded-full px-4 py-2 text-sm shadow-lg ${toast.error ? 'bg-red-50 text-red-700' : 'bg-white/95 text-slate-800'}`} dir="auto">
            {toast.error ? t(ERRORS[toast.error] ?? toast.error) : (
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
            <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('A guard dog')}</h3>
            <button type="button" disabled={!!mine.dog} onClick={() => void s.act({ action: 'buy', item: 'dog', qty: 1 })} className="mb-3 flex min-h-14 w-full items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2 text-left text-xs disabled:opacity-50" dir="ltr">
              <span className="text-2xl">🐕</span>
              <span>
                <b className="block">
                  a dog · {DOG_PRICE} {coin}
                </b>
                <span className="text-gray-500">{mine.dog ? t('You have {name}.', { name: mine.dog.name }) : t('Feed it every day and it chases thieves away.')}</span>
              </span>
            </button>
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

      {at && panel === 'settings' && view ? <VisitorBoard /> : null}
      {at && panel === 'settings' && !view ? (
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
            {mine.notes.length ? (
              <>
                <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">{t('Notes from friends')}</h3>
                <ul className="mb-3 space-y-1 text-sm" dir="ltr">
                  {[...mine.notes].reverse().map((n) => (
                    <li key={n.t} className="rounded-lg bg-amber-50 px-2 py-1">
                      <b>{n.name}:</b> {n.text}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
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

/** Running from a farm dog: get to the gate! (breath bar) */
function ChaseBanner() {
  const t = useT();
  const chase = useMyFarm((s) => s.chase);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!chase) return;
    const id = window.setInterval(() => tick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [chase]);
  if (!chase) return null;
  const k = breath.max ? breath.left / breath.max : 0;
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-40 w-[80vw] max-w-xs -translate-x-1/2">
      <div className="rounded-2xl bg-red-600/95 p-3 text-center text-white shadow-2xl">
        <p className="text-lg font-black">🐕 {t('{name} is coming! Run to the gate!', { name: chase.dog })}</p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/30">
          <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${Math.round(k * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs opacity-90">{k > 0 ? t('Hold Shift (or push the stick all the way) to run') : t('Out of breath… keep walking!')}</p>
      </div>
    </div>
  );
}

/** Training the dog: hear a command, choose what the dog does. All right = the dog gets better. */
function TrainPanel() {
  const t = useT();
  const s = useMyFarm.getState();
  const dog = useMyFarm((x) => x.mine.dog);
  const day = useMyFarm((x) => x.day);
  const rounds = useMemo(() => [...DOG_COMMANDS].sort(() => Math.random() - 0.5).slice(0, 3), []);
  const [i, setI] = useState(0);
  const [miss, setMiss] = useState(false);
  const [done, setDone] = useState<boolean | null>(null);
  const cur = rounds[i];
  const options = useMemo(() => (cur ? [cur, ...DOG_COMMANDS.filter((c) => c !== cur).sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5) : []), [cur]);
  useEffect(() => {
    if (cur && done === null) useVoice.getState().speakAs('me', `${cur.cmd}`, 'en-US');
  }, [cur, done]);
  if (!dog) return null;
  const left = DOG_TRAIN_PER_DAY - (dog.trainDay === day ? dog.trainCount : 0);
  const pick = (c: (typeof DOG_COMMANDS)[number]) => {
    if (c !== cur) return setMiss(true);
    if (i + 1 < rounds.length) return setI(i + 1);
    const ok = !miss;
    setDone(ok);
    void s.act({ action: 'train', ok });
  };
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[94vw] max-w-md -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl bg-white/95 p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <b className="text-gray-800">🐕 {t('Train {name} · level {n}', { name: dog.name, n: dogLevel(dog.train) })}</b>
          <button type="button" onClick={() => s.setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {left <= 0 && done === null ? (
          <p className="text-sm text-gray-600">{t('Enough training for today. Come back tomorrow!')}</p>
        ) : done !== null ? (
          <p className="text-center text-sm">{done ? `✅ ${t('Perfect! {name} is getting faster.', { name: dog.name })}` : t('Not quite. Practise again next time!')}</p>
        ) : cur ? (
          <>
            <p className="mb-1 text-xs text-gray-500">
              {i + 1}/{rounds.length} · {t('You say the command. What does the dog do?')}
            </p>
            <button type="button" onClick={() => useVoice.getState().speakAs('me', cur.cmd, 'en-US')} className="mb-2 w-full rounded-xl bg-sky-50 py-2 text-xl font-black text-sky-800" dir="ltr">
              🔊 “{cur.cmd}”
            </button>
            <div className="flex flex-col gap-1.5" dir="ltr">
              {options.map((o) => (
                <button key={o.cmd} type="button" onClick={() => pick(o)} className="min-h-10 rounded-xl border border-gray-200 bg-white px-3 text-left text-sm">
                  {o.does}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** A friend's notice board: read their notes, leave one (in English!). */
function VisitorBoard() {
  const t = useT();
  const view = useMyFarm((x) => x.view);
  const s = useMyFarm.getState();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  if (!view) return null;
  const ideas = ['Your farm is beautiful!', 'I watered your carrots.', 'Your chickens are so cute!', 'See you at the market!'];
  return (
    <div data-ui className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 w-[94vw] max-w-md -translate-x-1/2">
      <div className="pointer-events-auto max-h-[70dvh] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <b className="flex items-center gap-1.5 text-gray-800">
            <Icon name="book" size={18} />
            {t("{name}'s notice board", { name: view.name })}
          </b>
          <button type="button" onClick={() => s.setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <ul className="mb-2 space-y-1 text-sm" dir="ltr">
          {view.notes.length ? (
            [...view.notes].reverse().map((n) => (
              <li key={n.t} className="rounded-lg bg-amber-50 px-2 py-1">
                <b>{n.name}:</b> {n.text}
              </li>
            ))
          ) : (
            <li className="text-gray-500">{t('No notes yet. Be the first!')}</li>
          )}
        </ul>
        {sent ? (
          <p className="text-center text-sm text-green-700">✓ {t('Your note is on the board.')}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim().length < 2) return;
              void s.note(text.trim()).then((ok) => ok && setSent(true));
            }}
          >
            <div className="mb-1.5 flex flex-wrap gap-1" dir="ltr">
              {ideas.map((i) => (
                <button key={i} type="button" onClick={() => setText(i)} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {i}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input value={text} onChange={(e) => setText(e.target.value.slice(0, 80))} placeholder={t('Write a note in English')} className="min-h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm" dir="ltr" />
              <button type="submit" className="min-h-10 rounded-xl bg-amber-500 px-3 text-sm font-semibold text-white">
                {t('Post')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
