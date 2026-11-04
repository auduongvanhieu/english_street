import { useEffect, useState } from 'react';
import { BADGES, type PlacementQuestion, type VocabEntryDto } from '@es/shared';
import { useGame } from '../store/game';
import { Sheet, SheetHeader } from './Sheet';
import { SettingsPanel } from './SettingsPanel';
import { useProfile } from '../store/profile';
import { fetchPlacement, fetchVocab, reviewVocab, submitPlacement } from '../net/api';
import { AVATAR_INTRO_KEY, AvatarCreator } from './AvatarCreator';

export function ProfileHud({ compact }: { compact?: boolean }) {
  const p = useProfile((s) => s.profile);
  const open = useGame((s) => s.setUiPanel);
  if (!p) return null;
  const prevLevelXp = 50 * (p.level - 1) * (p.level - 1);
  const pct = Math.min(100, Math.round(((p.xp - prevLevelXp) / Math.max(1, p.nextLevelXp - prevLevelXp)) * 100));
  if (compact) {
    return (
      <button
        type="button"
        data-ui
        onClick={() => open('profile')}
        className="absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] flex min-h-11 items-center gap-2 rounded-full bg-black/50 px-3 text-xs text-white backdrop-blur-sm"
        aria-label="Profile"
      >
        <span className="max-w-24 truncate font-semibold">{p.name}</span>
        <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono">{p.cefrLevel}</span>
        <span className="flex items-center gap-1">
          Lv {p.level}
          <span className="h-1.5 w-10 rounded bg-white/20">
            <span className="block h-1.5 rounded bg-yellow-400" style={{ width: `${pct}%` }} />
          </span>
        </span>
        {!p.placementDone && <span className="rounded bg-yellow-400 px-1.5 py-0.5 font-medium text-black">🎯</span>}
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
        <span>Lv {p.level}</span>
        <div className="h-2 flex-1 rounded bg-white/20">
          <div className="h-2 rounded bg-yellow-400" style={{ width: `${pct}%` }} />
        </div>
        <span>{p.xp} XP</span>
      </div>
      <div className="mt-1 flex justify-between opacity-90">
        <span>🪙 {p.coins}</span>
        <span>🔥 {p.streak} day{p.streak === 1 ? '' : 's'}</span>
        <span>🏅 {p.badges.length}</span>
        {p.quota && <span title="NPC conversation turns left today">💬 {p.quota.turnsLeftToday}</span>}
      </div>
      <div className="mt-2 flex gap-1">
        <button type="button" onClick={() => open('daily')} className="flex-1 rounded bg-white/15 py-1 hover:bg-white/30">
          📋 Daily
        </button>
        <button type="button" onClick={() => open('notebook')} className="flex-1 rounded bg-white/15 py-1 hover:bg-white/30">
          📓 Notebook
        </button>
        <button type="button" onClick={() => open('avatar')} className="flex-1 rounded bg-white/15 py-1 hover:bg-white/30">
          🎨 Character
        </button>
      </div>
      {!p.placementDone && (
        <button type="button" onClick={() => open('placement')} className="mt-1 w-full rounded bg-yellow-400/90 py-1 font-medium text-black hover:bg-yellow-300">
          🎯 Take the 2-minute level test
        </button>
      )}
    </div>
  );
}

/** Phone-only profile sheet: stats plus the buttons the desktop card shows inline. */
function ProfilePanel() {
  const p = useProfile((s) => s.profile);
  const open = useGame((s) => s.setUiPanel);
  if (!p) return null;
  const prevLevelXp = 50 * (p.level - 1) * (p.level - 1);
  const pct = Math.min(100, Math.round(((p.xp - prevLevelXp) / Math.max(1, p.nextLevelXp - prevLevelXp)) * 100));
  const Item = ({ to, children }: { to: 'daily' | 'notebook' | 'avatar' | 'placement'; children: React.ReactNode }) => (
    <button type="button" onClick={() => open(to)} className="flex min-h-12 w-full items-center rounded-xl border px-4 text-left text-base">
      {children}
    </button>
  );
  return (
    <Panel title={`${p.name} · ${p.cefrLevel}`}>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span>Lv {p.level}</span>
        <div className="h-2 flex-1 rounded bg-gray-200">
          <div className="h-2 rounded bg-yellow-400" style={{ width: `${pct}%` }} />
        </div>
        <span>{p.xp} XP</span>
      </div>
      <div className="mb-4 flex justify-between text-sm text-gray-700">
        <span>🪙 {p.coins}</span>
        <span>🔥 {p.streak} day{p.streak === 1 ? '' : 's'}</span>
        <span>🏅 {p.badges.length}</span>
        {p.quota && <span title="NPC conversation turns left today">💬 {p.quota.turnsLeftToday} left</span>}
      </div>
      <div className="space-y-2">
        {!p.placementDone && (
          <button type="button" onClick={() => open('placement')} className="flex min-h-12 w-full items-center rounded-xl bg-yellow-400 px-4 text-left text-base font-medium text-black">
            🎯 Take the 2-minute level test
          </button>
        )}
        <Item to="daily">📋 Today's quests &amp; badges</Item>
        <Item to="notebook">📓 Notebook</Item>
        <Item to="avatar">🎨 Character &amp; shop</Item>
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const close = useGame((s) => s.setUiPanel);
  return (
    <Sheet onClose={() => close(null)} label={title}>
      <SheetHeader>
        <h2 className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={() => close(null)} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label="Close">
          ✕
        </button>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
    </Sheet>
  );
}

export function UiPanels() {
  const which = useGame((s) => s.uiPanel);
  if (which === 'daily') return <DailyPanel />;
  if (which === 'notebook') return <NotebookPanel />;
  if (which === 'avatar') return <AvatarCreator />;
  if (which === 'placement') return <PlacementPanel />;
  if (which === 'profile') return <ProfilePanel />;
  if (which === 'settings') return <SettingsPanel />;
  return null;
}

// ---------------------------------------------------------------- daily + badges
function DailyPanel() {
  const p = useProfile((s) => s.profile);
  const npcs = useGame((s) => s.npcs);
  if (!p) return null;
  return (
    <Panel title="📋 Today's quests">
      <ul className="space-y-2">
        {p.daily.map((d) => (
          <li key={d.questId} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${d.done ? 'bg-green-50' : ''}`}>
            <span>
              <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{d.level}</span>
              {d.done ? '✓ ' : ''}
              {d.title}
              <span className="ml-2 text-xs text-gray-500">· {npcs.find((n) => n.id === d.npcId)?.name ?? d.npcId}</span>
            </span>
            <span className="text-xs text-yellow-700">+{d.bonusXp} XP bonus</span>
          </li>
        ))}
      </ul>
      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">Badges</h3>
      <ul className="grid grid-cols-2 gap-2">
        {BADGES.map((b) => {
          const has = p.badges.includes(b.id);
          return (
            <li key={b.id} className={`rounded-lg border px-3 py-2 text-sm ${has ? 'border-yellow-300 bg-yellow-50' : 'opacity-50'}`}>
              <div>
                {b.icon} <b>{b.name}</b>
              </div>
              <div className="text-xs text-gray-600">{b.desc}</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-gray-500">
        {p.stats.questsCompleted} quests completed · {p.stats.reviewsDone} flashcards reviewed
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------- notebook / flashcards
function NotebookPanel() {
  const [items, setItems] = useState<VocabEntryDto[] | null>(null);
  const [mode, setMode] = useState<'list' | 'review'>('list');
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const refresh = useProfile((s) => s.refresh);

  useEffect(() => {
    fetchVocab().then(setItems).catch(() => setItems([]));
  }, []);

  if (!items) return <Panel title="📓 Notebook">Loading…</Panel>;
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
      <Panel title={`📓 Review ${idx + 1}/${due.length}`}>
        <button type="button" onClick={() => setFlipped((f) => !f)} className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 text-center">
          <div className="text-2xl font-bold">{card.word}</div>
          {flipped ? (
            <>
              <div className="mt-2 text-lg text-blue-900">{card.meaningVi}</div>
              <div className="mt-1 text-sm italic text-gray-600">{card.example}</div>
            </>
          ) : (
            <div className="mt-2 text-sm text-gray-500">Tap to see the meaning</div>
          )}
        </button>
        {flipped && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => grade('again')} className="rounded-lg bg-red-100 py-2 text-sm text-red-800">
              Again
            </button>
            <button type="button" onClick={() => grade('hard')} className="rounded-lg bg-amber-100 py-2 text-sm text-amber-800">
              Hard
            </button>
            <button type="button" onClick={() => grade('good')} className="rounded-lg bg-green-100 py-2 text-sm text-green-800">
              Good
            </button>
          </div>
        )}
      </Panel>
    );
  }

  return (
    <Panel title="📓 Notebook">
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No words yet. Talk to NPCs and new words will be saved here automatically.</p>
      ) : (
        <>
          <button type="button" disabled={due.length === 0} onClick={() => { setIdx(0); setFlipped(false); setMode('review'); }} className="mb-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {due.length ? `Review ${due.length} due card${due.length > 1 ? 's' : ''}` : 'All caught up — nothing due'}
          </button>
          <ul className="space-y-1">
            {items.map((v) => (
              <li key={v.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <b>{v.word}</b> — {v.meaningVi}
                <div className="text-xs italic text-gray-500">{v.example}</div>
                <div className="text-[10px] text-gray-400">{v.due ? 'due now' : `next review in ${Math.max(1, Math.ceil((new Date(v.nextReviewAt).getTime() - Date.now()) / 86_400_000))} day(s)`}</div>
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
  const [qs, setQs] = useState<Omit<PlacementQuestion, 'answer'>[] | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; level: string } | null>(null);
  const refresh = useProfile((s) => s.refresh);
  const close = useGame((s) => s.setUiPanel);
  useEffect(() => {
    fetchPlacement().then((q) => { setQs(q); setAnswers(q.map(() => -1)); }).catch(() => setQs([]));
  }, []);
  if (!qs) return <Panel title="🎯 Level test">Loading…</Panel>;
  const i = answers.findIndex((a) => a === -1);
  if (result)
    return (
      <Panel title="🎯 Your level">
        <div className="text-center">
          <div className="text-5xl font-black text-blue-600">{result.level}</div>
          <p className="mt-2 text-sm text-gray-600">{result.correct}/{result.total} correct. NPCs will now adapt to this level. You can retake the test any time from your profile.</p>
          <button type="button" onClick={() => close(localStorage.getItem(AVATAR_INTRO_KEY) ? null : 'avatar')} className="mt-4 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white">
            {localStorage.getItem(AVATAR_INTRO_KEY) ? 'Start playing' : 'Next: create your character'}
          </button>
        </div>
      </Panel>
    );
  const q = qs[i] ?? qs[qs.length - 1]!;
  const n = i === -1 ? qs.length : i;
  return (
    <Panel title={`🎯 Level test · ${Math.min(n + 1, qs.length)}/${qs.length}`}>
      <p className="mb-3 text-lg">{q.question}</p>
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
          >
            {o}
          </button>
        ))}
      </div>
    </Panel>
  );
}
