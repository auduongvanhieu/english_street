import { Suspense, useEffect, useState } from 'react';
import { BADGES, type AreaContentDto, type AreaId } from '@es/shared';
import { useArea } from '../../store/area';
import { useRestaurant } from '../../store/restaurant';
import { useFarm } from '../../store/farm';
import { useGame } from '../../store/game';
import { tk, useLang, useT } from '../../i18n';
import { serverNow } from '../../net/client';
import { feedingNow } from '../../world/zooLayout';
import { AREAS, areaById } from '../../world/areas';
import { Sheet, SheetHeader } from '../Sheet';
import { Line } from './common';
import { Quiz } from './Quiz';
import { FarmTab, MenuTab, ShoppingTab } from './AreaTabs';
import { ACTIVITIES } from './activities';

/** Tabs per area: the area's own activity first, then words, phrases and a quiz. */
const EXTRA_TAB: Partial<Record<AreaId, { id: string; label: string }>> = {
  farm: { id: 'farm', label: tk('🌱 My farm') },
  restaurant: { id: 'menu', label: tk('📋 Menu') },
  supermarket: { id: 'shop', label: tk('🛒 Shopping') },
};
const NONE: string[] = [];
const ITEMS_LABEL: Record<AreaId, string> = {
  zoo: tk('🦁 Animals'),
  farm: tk('🐄 Words'),
  restaurant: tk('🍽️ Food words'),
  supermarket: tk('🥛 Products'),
  home: tk('🛋️ Home words'),
  school: tk('✏️ School words'),
  clothes: tk('👗 Clothes words'),
  cinema: tk('🎞️ Film & book words'),
  station: tk('🎫 Travel words'),
  hospital: tk('🩺 Health words'),
  hotel: tk('🛏️ Hotel words'),
  sports: tk('🏅 Sports words'),
};

/** Shown only while the player stands at the area's guide board (scene/areas/GuideBoard.tsx). */
export function AreaChip() {
  const t = useT();
  const current = useArea((s) => s.current);
  const panel = useArea((s) => s.panel);
  const near = useArea((s) => s.nearBoard);
  const setPanel = useArea((s) => s.setPanel);
  if (!current || panel || !near) return null;
  const a = areaById(current);
  return (
    <button
      type="button"
      data-ui
      onClick={() => setPanel(true)}
      className="absolute bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+0.25rem)] left-1/2 z-20 flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white shadow-lg active:scale-95 sm:bottom-24"
      style={{ background: a.color }}
    >
      📖 {t('Read guide')} <kbd className="hidden rounded bg-white/25 px-1.5 text-xs sm:inline">E</kbd>
    </button>
  );
}

function ItemsTab({ content }: { content: AreaContentDto }) {
  const openCard = useArea((s) => s.openCard);
  const learned = useArea((s) => s.learned[content.id]) ?? NONE;
  const noTr = useLang((s) => s.lang === 'en');
  return (
    <div className="py-2">
      {content.categories.map((c) => {
        const items = content.items.filter((i) => i.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500" dir="ltr">
              {c.label}
              {!noTr && content.categoryTr[c.id] ? <span className="ms-1 normal-case text-blue-800">· {content.categoryTr[c.id]}</span> : null}
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((i) => (
                <button key={i.id} type="button" onClick={() => openCard({ area: content.id, item: i.id })} className="relative min-h-20 rounded-xl border bg-white p-1.5 text-center hover:bg-gray-50">
                  {learned.includes(i.id) ? <span className="absolute end-1 top-1 text-[10px] text-green-600">✓</span> : null}
                  <div className="text-3xl">{i.icon}</div>
                  <div className="truncate text-sm font-medium" dir="ltr">
                    {i.en}
                  </div>
                  {!noTr && i.tr.meaning ? <div className="truncate text-[11px] text-blue-800">{i.tr.meaning}</div> : null}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PhrasesTab({ content }: { content: AreaContentDto }) {
  const noTr = useLang((s) => s.lang === 'en');
  return (
    <div className="py-2">
      {content.groups.map((g) => (
        <section key={g.id} className="mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500" dir="ltr">
            {g.label}
            {!noTr && content.groupTr[g.id] ? <span className="ms-1 normal-case text-blue-800">· {content.groupTr[g.id]}</span> : null}
          </h3>
          <div className="divide-y">
            {content.phrases
              .filter((p) => p.group === g.id)
              .map((p, i) => (
                <Line key={i} en={p.en} tr={p.tr} level={p.level} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AreaPanel() {
  const t = useT();
  const current = useArea((s) => s.current);
  const panel = useArea((s) => s.panel);
  const tab = useArea((s) => s.tab);
  const setTab = useArea((s) => s.setTab);
  const setPanel = useArea((s) => s.setPanel);
  const content = useArea((s) => (current ? s.content[current] : undefined));
  const load = useArea((s) => s.load);
  const noTr = useLang((s) => s.lang === 'en');
  const learned = useArea((s) => (current ? (s.learned[current] ?? []).length : 0));
  useEffect(() => {
    if (current && panel && !content) void load(current);
  }, [current, panel, content, load]);
  if (!current || !panel) return null;
  const a = areaById(current);
  const act = ACTIVITIES[current];
  const extra = EXTRA_TAB[current] ?? (act ? { id: 'activity', label: act.label } : undefined);
  const tabs = [...(extra ? [extra] : []), { id: 'items', label: ITEMS_LABEL[current] }, { id: 'phrases', label: tk('💬 Phrases') }, { id: 'quiz', label: tk('❓ Quiz') }];
  const active = tabs.some((x) => x.id === tab) ? tab : tabs[0]!.id;
  return (
    <Sheet onClose={() => setPanel(false)} label={a.name} wide>
      <SheetHeader>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold" dir="ltr">
            {a.icon} {a.name}
          </h2>
          {content ? (
            <p className="text-xs text-gray-500">
              {!noTr && content.introTr ? content.introTr : <span dir="ltr">{content.intro}</span>} · {t('{n}/{total} words learned', { n: learned, total: content.items.length })}
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => setPanel(false)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <div className="flex gap-1 overflow-x-auto border-b px-3 sm:px-5">
        {tabs.map((x) => (
          <button key={x.id} type="button" onClick={() => setTab(x.id)} className={`min-h-10 shrink-0 border-b-2 px-2.5 text-sm ${active === x.id ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent text-gray-600'}`}>
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
        {!content ? (
          <div className="py-8 text-center text-sm text-gray-500">{t('Loading…')}</div>
        ) : active === 'items' ? (
          <ItemsTab content={content} />
        ) : active === 'phrases' ? (
          <PhrasesTab content={content} />
        ) : active === 'quiz' ? (
          <Quiz content={content} />
        ) : active === 'farm' ? (
          <FarmTab content={content} />
        ) : active === 'menu' ? (
          <MenuTab content={content} />
        ) : active === 'activity' && act ? (
          <Suspense fallback={<div className="py-8 text-center text-sm text-gray-500">{t('Loading…')}</div>}>
            <act.C content={content} />
          </Suspense>
        ) : (
          <ShoppingTab content={content} />
        )}
      </div>
    </Sheet>
  );
}

/** Zoo feeding time banner (first 2 minutes of every 10, server clock) while you are in the zoo. */
export function FeedingToast() {
  const t = useT();
  const inZoo = useArea((s) => s.current === 'zoo');
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!inZoo) return setOn(false);
    const f = () => setOn(feedingNow(serverNow()));
    f();
    const iv = setInterval(f, 5000);
    return () => clearInterval(iv);
  }, [inZoo]);
  if (!on) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-10 -translate-x-1/2 rounded-full bg-orange-500/90 px-4 py-1.5 text-sm font-semibold text-white shadow">
      🐟 <span dir="ltr">Feeding time at the penguin pool!</span> · {t('Visit the zookeeper')}
    </div>
  );
}

/** "👀 Minh's garden ✕" while the plots show someone else's crops. */
export function GardenVisitChip() {
  const t = useT();
  const visiting = useFarm((s) => s.visiting);
  const visit = useFarm((s) => s.visit);
  const name = useGame((s) => (visiting ? s.players[visiting]?.name : undefined));
  const inFarm = useArea((s) => s.current === 'farm');
  useEffect(() => {
    if (visiting && (!name || !inFarm)) visit(null);
  }, [visiting, name, inFarm, visit]);
  if (!visiting || !name) return null;
  return (
    <div className="absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)] z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-green-700/90 px-4 py-1.5 text-sm font-semibold text-white shadow">
      👀 {t("{name}'s garden", { name })}
      <button type="button" onClick={() => visit(null)} aria-label={t('Back to my garden')} className="rounded-full bg-white/20 px-2 text-xs">
        ✕
      </button>
    </div>
  );
}

/** "🏅 New badge!" for a few seconds after an area badge is earned. */
export function BadgeToast() {
  const t = useT();
  const id = useArea((s) => s.badge);
  const b = BADGES.find((x) => x.id === id);
  if (!b) return null;
  return (
    <div role="status" className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 animate-bounce rounded-2xl border-2 border-yellow-300 bg-yellow-50 px-5 py-3 text-center shadow-xl">
      <div className="text-3xl">{b.icon}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-yellow-700">{t('New badge!')}</div>
      <div className="font-bold">{t(b.name)}</div>
    </div>
  );
}

/** "🪑 Sit down" near a free restaurant chair, "Stand up" while seated. */
export function SitButton() {
  const t = useT();
  const near = useRestaurant((s) => s.near);
  const seat = useRestaurant((s) => s.seat);
  const sit = useRestaurant((s) => s.sit);
  const stand = useRestaurant((s) => s.stand);
  const setPanel = useArea((s) => s.setPanel);
  if (seat)
    return (
      <div data-ui className="flex gap-2">
        <button type="button" onClick={() => setPanel(true, 'menu')} className="min-h-12 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white shadow-lg">
          📋 {t('Menu')}
        </button>
        <button type="button" onClick={stand} className="min-h-12 rounded-full bg-white px-4 text-sm font-semibold shadow-lg">
          🧍 {t('Stand up')}
        </button>
      </div>
    );
  if (!near) return null;
  return (
    <button
      type="button"
      data-ui
      onClick={() => {
        sit(near);
        setPanel(true, 'menu');
      }}
      className="min-h-12 rounded-full bg-amber-400 px-5 text-base font-semibold text-black shadow-lg ring-2 ring-white/70"
    >
      🪑 {t('Sit down')}
    </button>
  );
}

export { AREAS };
