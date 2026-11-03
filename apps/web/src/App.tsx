import { useState, type FormEvent } from 'react';
import { Scene } from './scene/Scene';
import { connect, sendChat } from './net/client';
import { useGame } from './store/game';

export default function App() {
  const { playerName, setPlayerName, conn, chatLog } = useGame();
  const [draft, setDraft] = useState(playerName);
  const [chat, setChat] = useState('');

  async function join(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (name.length < 2) return;
    setPlayerName(name);
    await connect({ name, avatar: '{}' }).catch(() => undefined);
  }

  function submitChat(e: FormEvent) {
    e.preventDefault();
    const t = chat.trim();
    if (!t) return;
    sendChat(t);
    setChat('');
  }

  if (conn !== 'connected') {
    return (
      <div className="flex h-full items-center justify-center">
        <form onSubmit={join} className="w-80 rounded-2xl bg-white/90 p-6 shadow-xl">
          <h1 className="mb-1 text-2xl font-bold">English Street</h1>
          <p className="mb-4 text-sm text-gray-600">Walk the street. Talk in English.</p>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            className="mb-3 w-full rounded-lg border px-3 py-2"
          />
          <button
            type="submit"
            disabled={conn === 'connecting'}
            className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50"
          >
            {conn === 'connecting' ? 'Connecting…' : 'Enter the street'}
          </button>
          {conn === 'error' && (
            <p className="mt-2 text-sm text-red-600">Cannot reach the game server. Is it running?</p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <Scene playerName={playerName} />
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/50 px-3 py-2 text-xs text-white">
        WASD / arrows to move · Shift to run · Enter to chat
      </div>
      <div className="absolute bottom-3 left-3 w-80">
        <div className="mb-2 max-h-40 overflow-y-auto rounded-lg bg-black/40 p-2 text-sm text-white">
          {chatLog.length === 0 ? (
            <span className="opacity-60">Nearby chat will appear here.</span>
          ) : (
            chatLog.map((m, i) => (
              <div key={i}>
                <b>{m.name}:</b> {m.text}
              </div>
            ))
          )}
        </div>
        <form onSubmit={submitChat}>
          <input
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            placeholder="Say something in English…"
            maxLength={140}
            className="w-full rounded-lg border bg-white/90 px-3 py-2 text-sm"
          />
        </form>
      </div>
    </div>
  );
}
