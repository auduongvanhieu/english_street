import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage, Correction } from '@es/shared';
import { useGame } from '../store/game';
import { useConversation } from '../store/conversation';

export function NpcPanel() {
  const id = useGame((s) => s.panelNpc);
  const npc = useGame((s) => s.npcs.find((n) => n.id === id));
  const playerName = useGame((s) => s.playerName);
  const closePanel = useGame((s) => s.closePanel);
  const conv = useConversation();

  // Leaving the panel ends any open session.
  useEffect(() => {
    if (!id) useConversation.getState().reset();
  }, [id]);

  if (!npc) return null;

  const close = async () => {
    await conv.end();
    if (!useConversation.getState().summary) closePanel();
  };

  return (
    <div className="absolute inset-0 flex items-end justify-center bg-black/25 p-3 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-lg font-bold leading-tight">{npc.name}</h2>
            <p className="text-xs text-gray-500">{npc.role}</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label="Close">
            ✕ <span className="hidden sm:inline">Esc</span>
          </button>
        </header>

        {conv.summary ? (
          <Summary onClose={() => { conv.reset(); closePanel(); }} />
        ) : conv.state ? (
          <Chat />
        ) : (
          <Menu npcId={npc.id} greeting={npc.greeting} quests={npc.quests} playerName={playerName} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Menu
function Menu({ npcId, greeting, quests, playerName }: { npcId: string; greeting: string; quests: { id: string; title: string; level: string }[]; playerName: string }) {
  const { start, loading, error } = useConversation();
  return (
    <div className="p-5">
      <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-blue-900">“{greeting}”</p>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quests</h3>
      <ul className="space-y-2">
        {quests.map((q) => (
          <li key={q.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
            <span>
              <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{q.level}</span>
              {q.title}
            </span>
            <button type="button" disabled={loading} onClick={() => start(npcId, q.id, playerName)} className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50">
              Start
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={loading} onClick={() => start(npcId, null, playerName)} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        💬 Just chat (no quest)
      </button>
      {error && <p className="mt-2 text-sm text-red-600">Could not start: {error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Chat
function Chat() {
  const { state, lastTurn, loading, error, send } = useConversation();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [state?.messages.length, loading]);
  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  if (!state) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || loading) return;
    setText('');
    void send(t);
  }

  return (
    <>
      {state.goals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
          {state.goals.map((g) => {
            const done = state.goalsDone.includes(g.id);
            return (
              <span key={g.id} className={`rounded-full px-2.5 py-0.5 text-xs ${done ? 'bg-green-100 text-green-800 line-through' : 'bg-gray-100 text-gray-700'}`}>
                {done ? '✓ ' : '○ '}
                {g.desc}
              </span>
            );
          })}
          <span className="ml-auto self-center text-xs text-gray-400">
            {state.turns}/{state.maxTurns}
          </span>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ minHeight: 240 }}>
        {state.messages.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-400">…</div>
          </div>
        )}
        {lastTurn?.hint && !loading && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            💡 <b>Hint:</b> {lastTurn.hint}
          </div>
        )}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t p-3">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={state.finished ? 'Conversation finished' : 'Type in English…'}
          disabled={loading || state.finished}
          maxLength={500}
          className="flex-1 rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50"
        />
        <button type="submit" disabled={loading || state.finished || !text.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const mine = m.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div className={`rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'}`}>
          {m.content}
        </div>
        {m.corrections?.map((c, i) => (
          <CorrectionNote key={i} c={c} />
        ))}
        {m.goalsCompleted && m.goalsCompleted.length > 0 && (
          <div className="mt-1 text-right text-xs text-green-700">✓ goal{m.goalsCompleted.length > 1 ? 's' : ''} completed</div>
        )}
      </div>
    </div>
  );
}

function CorrectionNote({ c }: { c: Correction }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 block w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-left text-xs text-amber-900">
      💡 <span className="line-through opacity-60">{c.original}</span> → <b>{c.corrected}</b>
      {open && <div className="mt-1 text-amber-800">{c.explanation_vi}</div>}
    </button>
  );
}

// ---------------------------------------------------------------- Summary
function Summary({ onClose }: { onClose: () => void }) {
  const summary = useConversation((s) => s.summary);
  if (!summary) return null;
  const title = summary.status === 'completed' ? '🎉 Quest complete!' : summary.status === 'failed' ? '⏱️ Out of turns' : '👋 Quest left';
  return (
    <div className="space-y-4 overflow-y-auto p-5">
      <div className="text-center">
        <h3 className="text-xl font-bold">{title}</h3>
        <div className="mt-1 text-4xl font-black text-blue-600">{summary.score}</div>
        <p className="text-sm text-gray-500">
          {summary.goalsDone.length}/{summary.goalsTotal} goals · {summary.turns} turns · +{summary.reward.xp} XP · +{summary.reward.coins} coins
        </p>
      </div>
      {summary.corrections.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Corrections</h4>
          <ul className="space-y-1 text-sm">
            {summary.corrections.map((c, i) => (
              <li key={i} className="rounded-lg bg-amber-50 px-3 py-2">
                <span className="line-through opacity-60">{c.original}</span> → <b>{c.corrected}</b>
                <div className="text-xs text-amber-800">{c.explanation_vi}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {summary.vocab.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">New words</h4>
          <ul className="space-y-1 text-sm">
            {summary.vocab.map((v, i) => (
              <li key={i} className="rounded-lg bg-green-50 px-3 py-2">
                <b>{v.word}</b> — {v.meaning_vi}
                <div className="text-xs italic text-green-800">{v.example}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <button type="button" onClick={onClose} className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white">
        Back to the street
      </button>
    </div>
  );
}
