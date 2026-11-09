import { useEffect, useMemo, useState } from 'react';
import { ANIMALS, ANIMAL_INFO, CROPS, CROP_SELL, MY_GROW_MS, HARVEST_QTY, DOG_COMMANDS, DOG_PRICE, DOG_TRAIN_PER_DAY, FARM_DAY_CAP, FIELD_PLOTS, MAX_FIELDS, PRODUCT_SELL, SEED_PRICE, barnValue, dogLevel, shopPrice, type VisitMode } from '@es/shared';
import { breath } from '../scene/LocalPlayer';
import { useMyFarm } from '../store/myFarm';
import { Icon } from './icons';
import { useT, tk } from '../i18n';
import { useVoice } from '../store/voice';
import { useExpire } from './useExpire';
import { DecorateBar, DecoratePanel, FarmBook, FarmTopBar, LevelUpCard, RipeNotice } from './myfarm/FarmBook';

/** Whole minutes (at least 1) of a duration. */
const mins = (ms: number) => Math.max(1, Math.round(ms / 60000));
const CROP_ICON: Record<string, string> = { carrot: '🥕', corn: '🌽', tomato: '🍅', potato: '🥔', pumpkin: '🎃', strawberry: '🍓', wheat: '🌾', egg: '🥚', milk: '🥛', wool: '🧶', truffle: '🍄' };
const ERRORS: Record<string, string> = {
  no_dog: tk('You have no dog yet. Buy one in the farm shop.'),
  dog_fed: tk('Your dog has had its dinner today.'),
  trained: tk('Enough training for today. Come back tomorrow!'),
  steal_guest: tk('Only players with an account can do that.'),
  steal_level: tk('You and your friend need to be level 3 or higher.'),
  steal_busy: tk('You are already running!'),
  steal_limit: tk('That is enough for today.'),
  steal_not_ready: tk('It is not ripe yet.'),
  steal_taken: tk('Somebody already took one from there.'),
  help_limit: tk('You helped a lot today. Thank you!'),
  help_nothing: tk('That plot does not need water.'),
  note_limit: tk('You left enough notes today.'),
  busy: tk('Something is growing there already.'),
  empty: tk('Nothing is planted there.'),
  no_seed: tk('You have no seeds of that kind. Buy some in the farm shop.'),
  no_plot: tk('Buy more fields first.'),
  needs_water: tk('Water it first.'),
  not_ready: tk('Not ready yet.'),
  already_watered: tk('Already watered.'),
  no_feed: tk('You have no animal feed. Buy some in the farm shop.'),
  not_hungry: tk('The animals are not hungry.'),
  no_animal: tk('No animal there.'),
  too_many: tk('There is no more room for that animal.'),
  coins: tk('Not enough coins yet.'),
  bad_item: tk('You cannot buy that.'),
  nothing_to_sell: tk('There is nothing to sell.'),
  day_cap: tk('You earned enough on the farm today. Come back tomorrow!'),
  locked: tk('Your farm level is too low for that. Keep farming!'),
  barn_full: tk('Your barn is full. Sell something or build a bigger barn.'),
  no_fertilizer: tk('You have no fertilizer. Buy some in the farm shop.'),
  no_order: tk('That order is gone.'),
  missing: tk('You do not have everything for this order yet.'),
  nothing: tk('There is nothing to do there right now.'),
  no_machine: tk('Buy that machine in the farm shop first.'),
  machine_busy: tk('That machine is busy. Wait until it is ready.'),
  not_done: tk('You have not finished that goal yet.'),
  no_room: tk('There is no room there. Try a free place (not on a field, a path or a pen).'),
  closed: tk('This farm is closed to visitors.'),
  friends_only: tk('Only friends can visit this farm.'),
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
  const fresh = useExpire(last?.at, 5000);
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
  const toast = last && fresh ? last : null;
  const earned = mine.earned[0] === day ? mine.earned[1] : 0;
  const coin = <Icon name="coin" size={13} className="inline align-[-2px] text-amber-500" />;
  return (
    <>

      <FarmTopBar />
      <FarmBook />
      <DecoratePanel />
      <DecorateBar />
      <LevelUpCard />
      <RipeNotice />
      <ChaseBanner />
      {at && panel === 'train' ? <TrainPanel /> : null}
      {toast?.note ? (
        <div data-ui className="pointer-events-none absolute left-1/2 top-28 z-30 -translate-x-1/2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          🐕 {toast.note}
        </div>
      ) : null}
      {toast && !toast.note ? (
        <div data-ui className="pointer-events-none absolute bottom-40 left-1/2 z-40 -translate-x-1/2">
          <div className={`rounded-full px-4 py-2 text-sm shadow-lg ${toast.error ? 'bg-red-50 text-red-700' : 'bg-white/95 text-slate-800'}`} dir="auto">
            {toast.error ? t(ERRORS[toast.error] ?? toast.error) : (
              <>
                <span dir="ltr">“{toast.said}”</span> {toast.xp ? <b className="text-emerald-700">+{toast.xp} XP</b> : null} {toast.coins ? <b className={toast.coins > 0 ? 'text-amber-600' : 'text-gray-500'}>{toast.coins > 0 ? '+' : ''}{toast.coins} {coin}</b> : null}
              </>
            )}
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
                    <CropFacts crop={c} />
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

/** "⏱ 3 min · 3 × 2 coins": how long a crop grows after watering and what its harvest sells for. */
function CropFacts({ crop }: { crop: (typeof CROPS)[number] }) {
  const t = useT();
  return (
    <span className="mt-0.5 block text-[11px] leading-tight text-emerald-800">
      ⏱ {t('{m} min', { m: mins(MY_GROW_MS[crop]) })} · {HARVEST_QTY} × {CROP_SELL[crop]}
      <Icon name="coin" size={11} className="ms-0.5 inline align-[-1px] text-amber-500" />
    </span>
  );
}
