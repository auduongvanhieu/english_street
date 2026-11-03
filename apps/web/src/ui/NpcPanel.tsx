import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import type { ChatMessage, Correction } from '@es/shared';
import { useGame } from '../store/game';
import { useConversation } from '../store/conversation';
import { useVoice } from '../store/voice';
import { startStt, type SttHandle } from '../voice/stt';
import { usePair } from '../store/pair';
import { INTERACT_RADIUS, PROXIMITY_RADIUS } from '@es/shared';

export function NpcPanel() {
  const id = useGame((s) => s.panelNpc);
  const npc = useGame((s) => s.npcs.find((n) => n.id === id));
  const playerName = useGame((s) => s.playerName);
  const closePanel = useGame((s) => s.closePanel);
  const conv = useConversation();
  const voice = useVoice();

  // Leaving the panel ends any open session and silences the NPC.
  useEffect(() => {
    if (!id) {
      useConversation.getState().reset();
      useVoice.getState().stop();
    }
  }, [id]);

  if (!npc) return null;

  const close = async () => {
    voice.stop();
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
          <div className="flex items-center gap-1">
            {voice.ttsSupported && (
              <button
                type="button"
                onClick={() => voice.setMuted(!voice.muted)}
                className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
                title={voice.muted ? 'Unmute NPC voice' : 'Mute NPC voice'}
                aria-label={voice.muted ? 'Unmute' : 'Mute'}
              >
                {voice.muted ? '🔇' : '🔊'}
              </button>
            )}
            <button type="button" onClick={close} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label="Close">
              ✕ <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </header>

        {conv.summary ? (
          <Summary onClose={() => { conv.reset(); closePanel(); }} />
        ) : conv.state ? (
          <Chat npcId={npc.id} lang={npc.voice} />
        ) : (
          <Menu npcId={npc.id} greeting={npc.greeting} quests={npc.quests} pairQuests={npc.pairQuests} playerName={playerName} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Menu
function Menu({ npcId, greeting, quests, pairQuests, playerName }: { npcId: string; greeting: string; quests: { id: string; title: string; level: string }[]; pairQuests: { id: string; title: string; level: string; roles: { id: string; label: string }[] }[]; playerName: string }) {
  const { start, loading, error } = useConversation();
  const pair = usePair();
  const closePanel = useGame((s) => s.closePanel);
  const [picking, setPicking] = useState<string | null>(null);
  const players = useGame((s) => s.players);
  const me = useGame((s) => (s.sessionId ? s.players[s.sessionId] : null));
  const nearby = me ? Object.values(players).filter((p) => p.id !== me.id && Math.hypot(p.x - me.x, p.z - me.z) <= PROXIMITY_RADIUS + INTERACT_RADIUS) : [];
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
      {pairQuests.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Pair quests (with another player)</h3>
          <ul className="space-y-2">
            {pairQuests.map((q) => (
              <li key={q.id} className="rounded-lg border px-3 py-2">
                <div className="flex items-center justify-between">
                  <span>
                    <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{q.level}</span>
                    👥 {q.title}
                  </span>
                  <button type="button" disabled={!!pair.pendingTo} onClick={() => setPicking(picking === q.id ? null : q.id)} className="rounded-lg bg-purple-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50">
                    {pair.pendingTo ? 'Waiting…' : 'Invite'}
                  </button>
                </div>
                {picking === q.id && (
                  <div className="mt-2 text-sm">
                    {nearby.length === 0 ? (
                      <p className="text-gray-500">No other player nearby. Ask someone to walk over here first.</p>
                    ) : (
                      <ul className="space-y-1">
                        {nearby.map((p) => (
                          <li key={p.id} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1">
                            <span>{p.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                pair.invitePlayer({ id: p.id, name: p.name }, q.id, q.title, q.roles[1]?.label ?? 'partner');
                                setPicking(null);
                                closePanel();
                              }}
                              className="rounded bg-purple-600 px-2 py-0.5 text-xs text-white"
                            >
                              Invite as {q.roles[1]?.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" disabled={loading} onClick={() => start(npcId, null, playerName)} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
        💬 Just chat (no quest)
      </button>
      {error && <p className="mt-2 text-sm text-red-600">Could not start: {error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Chat
function Chat({ npcId, lang }: { npcId: string; lang: string }) {
  const { state, lastTurn, loading, error, send } = useConversation();
  const voice = useVoice();
  const [text, setText] = useState('');
  const [sttError, setSttError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stt = useRef<SttHandle | null>(null);
  const spokeUpTo = useRef(0);
  const fromVoice = useRef(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [state?.messages.length, loading]);
  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  // Voice the newest NPC line (greeting on start, then every reply).
  const msgCount = state?.messages.length ?? 0;
  useEffect(() => {
    if (!state) return;
    const last = state.messages[state.messages.length - 1];
    if (msgCount > spokeUpTo.current && last?.role === 'assistant') {
      spokeUpTo.current = msgCount;
      useVoice.getState().speakAs(npcId, last.content, lang);
    }
  }, [state, msgCount, npcId, lang]);

  // Stop any recognition when the chat unmounts.
  useEffect(() => () => stt.current?.abort(), []);

  if (!state) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || loading) return;
    setText('');
    const src = fromVoice.current ? 'voice' : 'text';
    fromVoice.current = false;
    void send(t, src);
  }

  // --- push-to-talk ---
  function micDown(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (stt.current || loading) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSttError(null);
    voice.stop(); // don't transcribe the NPC's own voice
    const base = text.trim();
    stt.current = startStt({
      lang: 'en-US',
      onInterim: (t) => setText(base ? `${base} ${t}` : t),
      onFinal: (t) => {
        setText(base ? `${base} ${t}` : t);
        fromVoice.current = true;
      },
      onError: (code) => {
        if (code !== 'aborted' && code !== 'no-speech') setSttError(code === 'not-allowed' ? 'Microphone permission denied' : `Speech recognition error: ${code}`);
        if (code === 'no-speech') setSttError('No speech detected. Hold the mic and speak clearly.');
      },
      onEnd: () => {
        stt.current = null;
        voice.setListening(false);
        inputRef.current?.focus();
      },
    });
    if (stt.current) voice.setListening(true);
    else setSttError('Voice input is not supported in this browser (try Chrome or Edge).');
  }
  function micUp() {
    stt.current?.stop();
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
          <Bubble key={i} m={m} onReplay={m.role === 'assistant' && voice.ttsSupported ? () => useVoice.getState().speakAs(npcId, m.content, lang) : undefined} />
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
        {sttError && <p className="text-sm text-red-600">{sttError}</p>}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t p-3">
        {voice.sttSupported && (
          <button
            type="button"
            onPointerDown={micDown}
            onPointerUp={micUp}
            onPointerCancel={micUp}
            onPointerLeave={micUp}
            disabled={loading || state.finished}
            aria-label="Hold to talk"
            title="Hold to talk (release to stop)"
            className={`select-none rounded-lg px-3 py-2 text-lg touch-none ${voice.listening ? 'animate-pulse bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'} disabled:opacity-50`}
          >
            🎤
          </button>
        )}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            fromVoice.current = false;
          }}
          placeholder={state.finished ? 'Conversation finished' : voice.listening ? 'Listening…' : voice.sttSupported ? 'Type, or hold 🎤 to speak…' : 'Type in English…'}
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

function Bubble({ m, onReplay }: { m: ChatMessage; onReplay?: () => void }) {
  const mine = m.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div className={`flex items-start gap-1 rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'}`}>
          <span>{m.content}</span>
          {onReplay && (
            <button type="button" onClick={onReplay} className="ml-1 shrink-0 opacity-50 hover:opacity-100" aria-label="Replay" title="Listen again">
              🔊
            </button>
          )}
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
