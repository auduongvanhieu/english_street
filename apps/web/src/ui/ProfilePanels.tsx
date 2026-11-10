import { BONUS_STEPS } from '@es/shared';
import { isInstalledApp } from '../net/pwa';
import { useInstallDone, useInstallGuide } from './InstallApp';
import { useJourney } from '../store/journey';
import { AREA_INFO } from '@es/shared';
import { JourneyPanel } from './journey/JourneyPanel';
import { BagPanel } from './BagPanel';
import { TopUpPanel } from './TopUpPanel';
import { usePay } from '../store/pay';
import { Icon, type IconName } from './icons';
import { useEffect, useState } from 'react';
import { AREAS } from '../world/areas';
import { BADGES, type PlacementQuestion, type VocabEntryDto } from '@es/shared';
import { useGame } from '../store/game';
import { Sheet, SheetHeader } from './Sheet';
import { SettingsPanel } from './SettingsPanel';
import { useProfile } from '../store/profile';
import { fetchPlacement, fetchVocab, reviewVocab, submitPlacement } from '../net/api';
import { AVATAR_INTRO_KEY, AvatarCreator } from './AvatarCreator';
import { t as tr, useLang, useT } from '../i18n';
import { useMeaning } from '../i18n/meaning';

// Badge names/descriptions reach t() dynamically; listed literally for key extraction. Never called.
const _i18n = () => [
  tr('First Steps'), tr('Complete your first quest'),
  tr('Regular'), tr('Complete 5 quests'),
  tr('Café Regular'), tr('Complete 3 quests at the café'),
  tr('Well Travelled'), tr('Complete a quest with 4 different NPCs'),
  tr('On a Roll'), tr('Play 3 days in a row'),
  tr('Team Player'), tr('Finish a pair quest'),
  tr('Bookworm'), tr('Review 20 flashcards'),
];
void _i18n;

/** "+" next to the coins: opens Top up (only when top-ups are open for this player, never inside the store app). */
export function TopUpButton({ dark }: { dark?: boolean }) {
  const t = useT();
  const on = usePay((s) => !!s.info?.enabled);
  const open = useGame((s) => s.setUiPanel);
  if (!on) return null;
  return (
    <button type="button" onClick={() => open('topup')} aria-label={t('Top up coins')} title={t('Top up coins')} className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold leading-none ${dark ? 'bg-yellow-400 text-slate-900 hover:bg-yellow-300' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
      +
    </button>
  );
}

export function ProfileHud({ compact }: { compact?: boolean }) {
  const t = useT();
  const p = useProfile((s) => s.profile);
  const loggedIn = useProfile((s) => s.loggedIn);
  const open = useGame((s) => s.setUiPanel);
  // what top-ups this player may see (again after signing in)
  useEffect(() => void usePay.getState().load(), [loggedIn]);
  if (!p) return null;
  const prevLevelXp = 50 * (p.level - 1) * (p.level - 1);
  const pct = Math.min(100, Math.round(((p.xp - prevLevelXp) / Math.max(1, p.nextLevelXp - prevLevelXp)) * 100));
  if (compact) {
    return (
      <button
        type="button"
        data-ui
        onClick={() => open('profile')}
        className="hud-top absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] flex min-h-9 items-center gap-1.5 rounded-full bg-black/45 px-2.5 text-[11px] text-white backdrop-blur-sm"
        aria-label={`${t('Profile')}: ${p.name}`}
      >
        {/* the name is over the character's head already: level only */}
        <span className="rounded bg-white/20 px-1 py-px font-mono">{p.cefrLevel}</span>
        <span className="flex items-center gap-1">
          {t('Lv {level}', { level: p.level })}
          <span className="h-1 w-8 rounded bg-white/20">
            <span className="block h-1 rounded bg-yellow-400" style={{ width: `${pct}%` }} />
          </span>
        </span>
        {!p.placementDone && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-slate-900">
            <Icon name="target" size={11} />
          </span>
        )}
      </button>
    );
  }
  return (
    <div data-ui className="absolute right-3 top-3 w-64 rounded-xl bg-black/50 p-3 text-xs text-white">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{p.name}</span>
        <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono">{p.cefrLevel}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span>{t('Lv {level}', { level: p.level })}</span>
        <div className="h-2 flex-1 rounded bg-white/20">
          <div className="h-2 rounded bg-yellow-400" style={{ width: `${pct}%` }} />
        </div>
        <span>{t('{xp} XP', { xp: p.xp })}</span>
      </div>
      <div className="mt-1 flex justify-between opacity-90">
        <span className="flex items-center gap-1"><Icon name="coin" size={14} className="text-yellow-300" />{p.coins}<TopUpButton dark /></span>
        <span className="flex items-center gap-1"><Icon name="bolt" size={14} className="text-orange-300" />{p.streak === 1 ? t('1 day') : t('{n} days', { n: p.streak })}</span>
        <span className="flex items-center gap-1"><Icon name="star" size={14} className="text-amber-300" />{p.badges.length}</span>
        {p.quota && <span className="flex items-center gap-1" title={t('NPC conversation turns left today')}><Icon name="chat" size={14} />{p.quota.turnsLeftToday}</span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {(
          [
            ['daily', 'book', t('Daily')],
            ['notebook', 'feedback', t('Notebook')],
            ['avatar', 'smile', t('Character')],
            ['bag', 'bag', t('Bag')],
          ] as const
        ).map(([to, icon, label]) => (
          <button key={to} type="button" onClick={() => open(to)} className="flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-1 py-1.5 text-[11px] hover:bg-white/30">
            <Icon name={icon} size={14} className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      {!p.placementDone && (
        <button type="button" onClick={() => open('placement')} className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-full bg-yellow-400/90 py-1.5 font-medium text-black hover:bg-yellow-300">
          <Icon name="target" size={15} />
          {t('Take the 2-minute level test')}
        </button>
      )}
    </div>
  );
}

/** Phone-only profile sheet: stats plus the buttons the desktop card shows inline. */
function ProfilePanel() {
  const t = useT();
  const p = useProfile((s) => s.profile);
  const open = useGame((s) => s.setUiPanel);
  if (!p) return null;
  const prevLevelXp = 50 * (p.level - 1) * (p.level - 1);
  const pct = Math.min(100, Math.round(((p.xp - prevLevelXp) / Math.max(1, p.nextLevelXp - prevLevelXp)) * 100));
  const Item = ({ to, children }: { to: 'daily' | 'notebook' | 'avatar' | 'placement' | 'bag'; children: React.ReactNode }) => (
    <button type="button" onClick={() => open(to)} className="flex min-h-12 w-full items-center rounded-xl border px-4 text-left text-base">
      {children}
    </button>
  );
  return (
    <Panel title={`${p.name} · ${p.cefrLevel}`}>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span>{t('Lv {level}', { level: p.level })}</span>
        <div className="h-2 flex-1 rounded bg-gray-200">
          <div className="h-2 rounded bg-yellow-400" style={{ width: `${pct}%` }} />
        </div>
        <span>{t('{xp} XP', { xp: p.xp })}</span>
      </div>
      <div className="mb-4 flex justify-between text-sm text-gray-700">
        <span className="flex items-center gap-1"><Icon name="coin" size={16} className="text-amber-500" />{p.coins}<TopUpButton /></span>
        <span className="flex items-center gap-1"><Icon name="bolt" size={16} className="text-orange-500" />{p.streak === 1 ? t('1 day') : t('{n} days', { n: p.streak })}</span>
        <span className="flex items-center gap-1"><Icon name="star" size={16} className="text-amber-500" />{p.badges.length}</span>
        {p.quota && <span className="flex items-center gap-1" title={t('NPC conversation turns left today')}><Icon name="chat" size={16} />{t('{n} left', { n: p.quota.turnsLeftToday })}</span>}
      </div>
      <JourneyBadges />
      <div className="space-y-2">
        {!p.placementDone && (
          <button type="button" onClick={() => open('placement')} className="flex min-h-12 w-full items-center rounded-xl bg-yellow-400 px-4 text-left text-base font-medium text-black">
            <Icon name="target" className="me-2" />
            {t('Take the 2-minute level test')}
          </button>
        )}
        <InstallItem />
        <Item to="daily"><Icon name="book" className="me-3 text-slate-600" />{t('My journey: quests, passport, today')}</Item>
        <Item to="notebook"><Icon name="feedback" className="me-3 text-slate-600" />{t('Notebook')}</Item>
        <Item to="avatar"><Icon name="smile" className="me-3 text-slate-600" />{t('Character & shop')}</Item>
        <Item to="bag"><Icon name="bag" className="me-3 text-slate-600" />{t('My bag: everything I own')}</Item>
      </div>
    </Panel>
  );
}

export function Panel({ title, icon, children }: { title: string; icon?: IconName; children: React.ReactNode }) {
  const t = useT();
  const close = useGame((s) => s.setUiPanel);
  return (
    <Sheet onClose={() => close(null)} label={title}>
      <SheetHeader>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {icon ? <Icon name={icon} className="text-slate-700" /> : null}
          {title}
        </h2>
        <button type="button" onClick={() => close(null)} className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          <Icon name="close" size={20} />
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
    </Sheet>
  );
}

export function UiPanels() {
  const which = useGame((s) => s.uiPanel);
  if (which === 'daily') return <JourneyPanel />;
  if (which === 'notebook') return <NotebookPanel />;
  if (which === 'avatar') return <AvatarCreator />;
  if (which === 'placement') return <PlacementPanel />;
  if (which === 'profile') return <ProfilePanel />;
  if (which === 'settings') return <SettingsPanel />;
  if (which === 'bag') return <BagPanel />;
  if (which === 'topup') return <TopUpPanel />;
  return null;
}

// ---------------------------------------------------------------- daily + badges
/** Today's NPC quests, area word progress and badges (a tab of the Journey book). */
export function DailyContent() {
  const t = useT();
  const p = useProfile((s) => s.profile);
  const npcs = useGame((s) => s.npcs);
  if (!p) return null;
  return (
    <>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Conversation quests of the day')}</h3>
      <ul className="space-y-2">
        {p.daily.map((d) => (
          <li key={d.questId} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${d.done ? 'bg-green-50' : ''}`}>
            <span>
              <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{d.level}</span>
              {d.done ? '✓ ' : ''}
              <span dir="ltr">{d.title}</span>
              <span className="ml-2 text-xs text-gray-500">· {npcs.find((n) => n.id === d.npcId)?.name ?? d.npcId}</span>
            </span>
            <span className="text-xs text-yellow-700">{t('+{xp} XP bonus', { xp: d.bonusXp })}</span>
          </li>
        ))}
      </ul>
      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Areas')}</h3>
      <ul className="space-y-1.5">
        {AREAS.map((a) => {
          const pr = p.areas?.[a.id];
          if (!pr) return null;
          const pct = pr.total ? Math.round((pr.learned / pr.total) * 100) : 0;
          return (
            <li key={a.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>
                  {a.icon} <span dir="ltr">{a.name}</span>
                </span>
                <span className="text-xs text-gray-600">
                  {t('{n}/{total} words', { n: pr.learned, total: pr.total })}
                  {pr.quiz ? ` · ✓ ${t('quiz')}` : ''}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: a.color }} />
              </div>
            </li>
          );
        })}
      </ul>
      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Badges')}</h3>
      <ul className="grid grid-cols-2 gap-2">
        {BADGES.map((b) => {
          const has = p.badges.includes(b.id);
          return (
            <li key={b.id} className={`rounded-lg border px-3 py-2 text-sm ${has ? 'border-yellow-300 bg-yellow-50' : 'opacity-50'}`}>
              <div>
                {b.icon} <b>{t(b.name)}</b>
              </div>
              <div className="text-xs text-gray-600">{t(b.desc)}</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-gray-500">
        {t('{quests} quests completed · {reviews} flashcards reviewed', { quests: p.stats.questsCompleted, reviews: p.stats.reviewsDone })}
      </p>
    </>
  );
}

// ---------------------------------------------------------------- notebook / flashcards
function NotebookPanel() {
  const t = useT();
  const [items, setItems] = useState<VocabEntryDto[] | null>(null);
  const [mode, setMode] = useState<'list' | 'review'>('list');
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const refresh = useProfile((s) => s.refresh);

  useEffect(() => {
    fetchVocab().then(setItems).catch(() => setItems([]));
  }, []);

  if (!items) return <Panel title={`📓 ${t('Notebook')}`}>{t('Loading…')}</Panel>;
  const due = items.filter((v) => v.due);

  async function grade(g: 'again' | 'hard' | 'good') {
    const card = due[idx];
    if (!card) return;
    const updated = await reviewVocab(card.id, g).catch(() => null);
    if (updated) setItems((xs) => xs!.map((x) => (x.id === updated.id ? updated : x)));
    setFlipped(false);
    if (idx + 1 >= due.length) {
      setMode('list');
      setIdx(0);
      void refresh();
    } else setIdx(idx + 1);
  }

  if (mode === 'review' && due[idx]) {
    const card = due[idx]!;
    return (
      <Panel title={`📓 ${t('Review {n}/{total}', { n: idx + 1, total: due.length })}`}>
        <button type="button" onClick={() => setFlipped((f) => !f)} className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 text-center">
          <div className="text-2xl font-bold" dir="ltr">{card.word}</div>
          {flipped ? (
            <>
              <div className="mt-2 text-lg text-blue-900"><Meaning word={card.word} meaning={card.meaning} lang={card.lang} /></div>
              <div className="mt-1 text-sm italic text-gray-600" dir="ltr">{card.example}</div>
            </>
          ) : (
            <div className="mt-2 text-sm text-gray-500">{t('Tap to see the meaning')}</div>
          )}
        </button>
        {flipped && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => grade('again')} className="rounded-lg bg-red-100 py-2 text-sm text-red-800">
              {t('Again')}
            </button>
            <button type="button" onClick={() => grade('hard')} className="rounded-lg bg-amber-100 py-2 text-sm text-amber-800">
              {t('Hard')}
            </button>
            <button type="button" onClick={() => grade('good')} className="rounded-lg bg-green-100 py-2 text-sm text-green-800">
              {t('Good')}
            </button>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel title={`📓 ${t('Notebook')}`}>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{t('No words yet. Talk to NPCs and new words will be saved here automatically.')}</p>
      ) : (
        <>
          <button type="button" disabled={due.length === 0} onClick={() => { setIdx(0); setFlipped(false); setMode('review'); }} className="mb-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {due.length ? (due.length > 1 ? t('Review {n} due cards', { n: due.length }) : t('Review 1 due card')) : t('All caught up — nothing due')}
          </button>
          <ul className="space-y-1">
            {items.map((v) => (
              <li key={v.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <b dir="ltr">{v.word}</b> — <Meaning word={v.word} meaning={v.meaning} lang={v.lang} />
                <div className="text-xs italic text-gray-500" dir="ltr">{v.example}</div>
                <div className="text-[10px] text-gray-400">{v.due ? t('due now') : t('next review in {n} day(s)', { n: Math.max(1, Math.ceil((new Date(v.nextReviewAt).getTime() - Date.now()) / 86_400_000)) })}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- placement test
function PlacementPanel() {
  const t = useT();
  const [qs, setQs] = useState<Omit<PlacementQuestion, 'answer'>[] | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; level: string } | null>(null);
  const refresh = useProfile((s) => s.refresh);
  const close = useGame((s) => s.setUiPanel);
  useEffect(() => {
    fetchPlacement().then((q) => { setQs(q); setAnswers(q.map(() => -1)); }).catch(() => setQs([]));
  }, []);
  if (!qs) return <Panel title={`🎯 ${t('Level test')}`}>{t('Loading…')}</Panel>;
  const i = answers.findIndex((a) => a === -1);
  if (result)
    return (
      <Panel title={`🎯 ${t('Your level')}`}>
        <div className="text-center">
          <div className="text-5xl font-black text-blue-600">{result.level}</div>
          <p className="mt-2 text-sm text-gray-600">{t('{correct}/{total} correct. NPCs will now adapt to this level. You can retake the test any time from your profile.', { correct: result.correct, total: result.total })}</p>
          <button type="button" onClick={() => close(localStorage.getItem(AVATAR_INTRO_KEY) ? null : 'avatar')} className="mt-4 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white">
            {localStorage.getItem(AVATAR_INTRO_KEY) ? t('Start playing') : t('Next: create your character')}
          </button>
        </div>
      </Panel>
    );
  const q = qs[i] ?? qs[qs.length - 1]!;
  const n = i === -1 ? qs.length : i;
  return (
    <Panel title={`🎯 ${t('Level test')} · ${Math.min(n + 1, qs.length)}/${qs.length}`}>
      <p className="mb-3 text-lg" dir="ltr">{q.question}</p>
      <div className="grid gap-2">
        {q.options.map((o, oi) => (
          <button
            key={oi}
            type="button"
            onClick={async () => {
              const next = [...answers];
              next[n] = oi;
              setAnswers(next);
              if (!next.includes(-1)) {
                const r = await submitPlacement(next).catch(() => null);
                if (r) {
                  setResult(r);
                  void refresh();
                }
              }
            }}
            className="rounded-lg border px-3 py-2 text-left hover:bg-blue-50"
            dir="ltr"
          >
            {o}
          </button>
        ))}
      </div>
    </Panel>
  );
}

/** A saved meaning; if it was saved in another language than the current one, show the translation in the current language instead. */
function Meaning({ word, meaning, lang }: { word: string; meaning: string; lang: string }) {
  const cur = useLang((s) => s.lang);
  const same = lang === cur || cur === 'en';
  const tr = useMeaning(same ? undefined : word);
  if (same) return <>{meaning}</>;
  return <>{tr ?? '…'}</>;
}

/** Passport stamps and the journey title, on the profile. */
function JourneyBadges() {
  const t = useT();
  const view = useJourney((s) => s.view);
  if (!view) return null;
  const citizen = view.state.done.includes('m12-citizen');
  return (
    <div className="mb-4 rounded-xl border bg-gray-50 p-3">
      {citizen ? <div className="mb-1 font-semibold text-amber-700">🏅 English Street Citizen</div> : null}
      <div className="text-xs text-gray-600">{t('Journey: chapter {n} of {total} · stamps {s}/{st}', { n: Math.min(view.chapter + 1, 12), total: 12, s: view.stamps.length, st: 13 })}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-lg">
        {view.stamps.map((a) => (
          <span key={a} title={a} className="rounded-full bg-green-100 px-1 ring-1 ring-green-300">
            {a === 'river' ? '🚣' : AREA_INFO[a as keyof typeof AREA_INFO]?.icon}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Phone profile sheet: "Install the game (+200 coins)" until it is done. */
function InstallItem() {
  const t = useT();
  const done = useInstallDone();
  if (done || isInstalledApp()) return null;
  return (
    <button type="button" onClick={() => useInstallGuide.getState().show(true)} className="flex min-h-12 w-full items-center rounded-xl bg-blue-600 px-4 text-left text-base font-medium text-white">
      <span className="me-3 text-lg">📲</span>
      {t('Install the game, get {n} coins!', { n: BONUS_STEPS[0]!.reward.coins })}
    </button>
  );
}
