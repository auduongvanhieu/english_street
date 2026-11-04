import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PairLine } from '@es/shared';
import { usePair } from '../store/pair';
import { useGame } from '../store/game';
import { getPlayerId } from '../net/player';
import { Sheet, SheetHeader } from './Sheet';
import { useT } from '../i18n';
import type { AreaId } from '@es/shared';
import { useArea } from '../store/area';

/** Pair quests judged by an area NPC use that area's real menu / price list (both players can read it). */
const PAIR_AREA: Record<string, AreaId> = { waiter: 'restaurant', chef: 'restaurant', grocer: 'supermarket' };
const NO_CONTENT = null;

function PairMenu({ area, open: initial }: { area: AreaId; open: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(initial);
  const content = useArea((st) => st.content[area] ?? NO_CONTENT);
  useEffect(() => {
    if (open) void useArea.getState().load(area);
  }, [open, area]);
  return (
    <div className="mt-1.5">
      <button type="button" onClick={() => setOpen(!open)} className="rounded-full border border-blue-300 bg-white px-3 py-0.5 text-xs font-semibold text-blue-800 hover:bg-blue-100">
        {area === 'restaurant' ? '📋 ' + t('Menu') : '🏷️ ' + t('Prices')} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border bg-white p-2 text-xs text-gray-800">
          {!content ? (
            <span className="text-gray-400">…</span>
          ) : (
            content.categories.map((c) => {
              const items = content.items.filter((i) => i.category === c.id && i.price != null);
              if (!items.length) return null;
              return (
                <div key={c.id} className="mb-1.5">
                  <div className="font-semibold text-gray-500" dir="ltr">
                    {c.label}
                  </div>
                  {items.map((i) => (
                    <div key={i.id} className="flex items-baseline gap-1.5">
                      <span>{i.icon}</span>
                      <span dir="ltr" className="font-medium">
                        {i.en}
                      </span>
                      {i.tr.meaning && <span className="truncate text-gray-500">· {i.tr.meaning}</span>}
                      <span className="ml-auto font-mono">${i.price}</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Two-player role-play: role card, shared transcript with per-line feedback, and the final summary. */
export function PairPanel() {
  const pair = usePair();
  const npc = useGame((s) => s.npcs.find((n) => n.id === pair.state?.npcId));
  const me = getPlayerId();
  const t = useT();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [pair.state?.messages.length, pair.loading]);

  if (!pair.state && !pair.loading && !pair.summaries) return null;
  const s = pair.state;
  const mine = s?.players.find((p) => p.playerId === me);
  const partner = s?.players.find((p) => p.playerId !== me);
  const myRole = s?.roles.find((r) => r.id === mine?.role);
  const myTurns = s ? (s.turns[me] ?? 0) : 0;
  const summary = pair.summaries?.[me] ?? null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || pair.loading) return;
    setText('');
    void pair.send(msg);
  }

  return (
    <Sheet wide label={t('Pair quest')}>
        <SheetHeader>
          <div>
            <h2 className="text-lg font-bold leading-tight">👥 {s ? t('with {name}', { name: partner?.name ?? '…' }) : t('Starting…')}</h2>
            <p className="text-xs text-gray-500">{npc ? t('{name} is watching and will give feedback', { name: npc.name }) : ''}</p>
          </div>
          <button type="button" onClick={() => void pair.leave()} className="min-h-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Leave pair quest')}>
            ✕ {t('Leave')}
          </button>
        </SheetHeader>

        {summary ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            <div className="text-center">
              <h3 className="text-xl font-bold">{summary.status === 'completed' ? `🎉 ${t('Well done!')}` : summary.status === 'failed' ? `⏱️ ${t('Out of lines')}` : `👋 ${t('Quest left')}`}</h3>
              <div className="mt-1 text-4xl font-black text-blue-600">{summary.score}</div>
              <p className="text-sm text-gray-500">
                {t('{done}/{total} goals as {role} · +{xp} XP · +{coins} coins', { done: summary.goalsDone.length, total: summary.goalsTotal, role: myRole?.label ?? '', xp: summary.reward.xp, coins: summary.reward.coins })}
              </p>
            </div>
            {summary.corrections.length > 0 && (
              <ul className="space-y-1 text-sm">
                {summary.corrections.map((c, i) => (
                  <li key={i} className="rounded-lg bg-amber-50 px-3 py-2">
                    <span dir="ltr"><span className="line-through opacity-60">{c.original}</span> → <b>{c.corrected}</b></span>
                    <div className="text-xs text-amber-800">{c.explanation}</div>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={pair.reset} className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white">
              {t('Back to the street')}
            </button>
          </div>
        ) : !s ? (
          <div className="p-6 text-center text-sm text-gray-500">{pair.error ? <span className="text-red-600">{pair.error}</span> : t('Waiting for your partner…')}</div>
        ) : (
          <>
            <div className="border-b bg-blue-50 px-4 py-2 text-sm text-blue-900">
              <b>{t('You are the {role}.', { role: myRole?.label ?? '' })}</b> <span dir="ltr">{myRole?.brief}</span>
              {PAIR_AREA[s.npcId] ? (
                <PairMenu area={PAIR_AREA[s.npcId]!} open={mine?.role === s.roles[1].id} />
              ) : (
                myRole?.facts && <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-blue-800" dir="ltr">{myRole.facts}</pre>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
              {myRole?.goals.map((g) => {
                const done = (s.goalsDone[myRole.id] ?? []).includes(g.id);
                return (
                  <span key={g.id} className={`rounded-full px-2.5 py-0.5 text-xs ${done ? 'bg-green-100 text-green-800 line-through' : 'bg-gray-100 text-gray-700'}`}>
                    {done ? '✓ ' : '○ '}
                    <span dir="ltr">{g.desc}</span>
                  </span>
                );
              })}
              <span className="ml-auto self-center text-xs text-gray-400">
                {myTurns}/{s.maxTurns}
              </span>
            </div>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ minHeight: 220 }}>
              {s.messages.length === 0 && <p className="text-sm text-gray-400">{mine?.role === s.roles[1].id ? t('The customer has just sat down. Greet them!') : t('You just sat down. Wait for the waiter, or say hello.')}</p>}
              {s.messages.map((m, i) => (
                <Line key={i} m={m} mine={m.playerId === me} npcName={npc?.name ?? t('Judge')} />
              ))}
              {pair.partnerLeft && <p className="text-sm text-red-600">{t('Your partner left the quest.')}</p>}
              {pair.error && <p className="text-sm text-red-600">{t('Error: {error}', { error: pair.error })}</p>}
            </div>
            <form onSubmit={submit} className="flex gap-2 border-t p-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={s.finished ? t('Finished') : myTurns >= s.maxTurns ? t('No lines left — wait for your partner') : t('Speak as the {role}…', { role: myRole?.label ?? '' })}
                disabled={pair.loading || s.finished || myTurns >= s.maxTurns || pair.partnerLeft}
                maxLength={500}
                autoFocus
                enterKeyHint="send"
                className="min-h-11 flex-1 rounded-lg border px-3 py-2 text-base disabled:bg-gray-50 sm:text-sm"
              />
              <button type="submit" disabled={pair.loading || s.finished || !text.trim()} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {t('Send')}
              </button>
            </form>
          </>
        )}
    </Sheet>
  );
}

function Line({ m, mine, npcName }: { m: PairLine; mine: boolean; npcName: string }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div className={`mb-0.5 text-[10px] uppercase tracking-wide ${mine ? 'text-right text-blue-500' : 'text-gray-400'}`}>
          {m.name} · {m.role}
        </div>
        <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'}`} dir="ltr">{m.content}</div>
        {mine &&
          m.corrections?.map((c, i) => (
            <button key={i} type="button" onClick={() => setOpen((o) => !o)} className="mt-1 block w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-left text-xs text-amber-900">
              💡 <span dir="ltr"><span className="line-through opacity-60">{c.original}</span> → <b>{c.corrected}</b></span>
              {open && <div className="mt-1 text-amber-800">{c.explanation}</div>}
            </button>
          ))}
        {m.goalsCompleted && m.goalsCompleted.length > 0 && <div className={`mt-1 text-xs text-green-700 ${mine ? 'text-right' : ''}`}>✓ {t('goal completed')}</div>}
        {m.judge && (
          <div className="mt-1 rounded-lg bg-purple-50 px-2 py-1 text-xs text-purple-900">
            🎩 <b>{npcName}:</b> <span dir="ltr">{m.judge}</span>
          </div>
        )}
      </div>
    </div>
  );
}
