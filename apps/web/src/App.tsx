import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EMOTES } from '@es/shared';
import { Scene } from './scene/Scene';
import { connect, sendChat } from './net/client';
import { fetchNpcs } from './net/api';
import { getPlayerId } from './net/player';
import { useGame } from './store/game';
import { initPairMessaging, usePair } from './store/pair';
import { useVoiceChat } from './net/voicechat';
import { isTouchDevice } from './input/joystick';
import { Joystick } from './ui/Joystick';
import { InteractPrompt } from './ui/InteractPrompt';
import { NpcPanel } from './ui/NpcPanel';
import { PairPanel } from './ui/PairPanel';
import { EmoteBar, InviteToast, ReportButton, VoiceChatButton } from './ui/Hud';

if (import.meta.env.DEV) {
  // Test hooks (used by the headless e2e scripts).
  (window as unknown as { __es: unknown }).__es = { useGame, usePair, useVoiceChat };
}

export default function App() {
  const { playerName, setPlayerName, conn, chatLog } = useGame();
  const [draft, setDraft] = useState(playerName);
  const [chat, setChat] = useState('');
  const [npcError, setNpcError] = useState(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const touch = isTouchDevice();

  // Load NPC definitions once; subscribe to pair-quest relay messages.
  useEffect(() => {
    fetchNpcs()
      .then((n) => useGame.getState().setNpcs(n))
      .catch(() => setNpcError(true));
    const off = initPairMessaging();
    return () => {
      off();
    };
  }, []);

  // Global keys: E = talk, Esc = close panel, Enter = focus chat, 1-5 = emotes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useGame.getState();
      const typing = document.activeElement?.tagName === 'INPUT';
      if (e.key === 'Escape') {
        if (s.panelNpc) s.closePanel();
        else (document.activeElement as HTMLElement | null)?.blur();
      } else if (!typing && (e.key === 'e' || e.key === 'E') && s.interactTarget && !s.panelNpc) {
        s.openPanel(s.interactTarget);
      } else if (!typing && e.key === 'Enter' && !s.panelNpc) {
        chatInput.current?.focus();
        e.preventDefault();
      } else if (!typing && /^[1-5]$/.test(e.key)) {
        const emote = EMOTES[Number(e.key) - 1];
        if (emote) s.playEmote(emote);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function join(e: FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (name.length < 2) return;
    setPlayerName(name);
    await connect({ name, avatar: '{}', playerId: getPlayerId() }).catch(() => undefined);
  }

  function submitChat(e: FormEvent) {
    e.preventDefault();
    const t = chat.trim();
    if (t) sendChat(t);
    setChat('');
    chatInput.current?.blur();
  }

  if (conn !== 'connected') {
    return (
      <div className="flex h-full items-center justify-center">
        <form onSubmit={join} className="w-80 rounded-2xl bg-white/90 p-6 shadow-xl">
          <h1 className="mb-1 text-2xl font-bold">English Street</h1>
          <p className="mb-4 text-sm text-gray-600">Walk the street. Talk in English.</p>
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your name" maxLength={20} className="mb-3 w-full rounded-lg border px-3 py-2" />
          <button type="submit" disabled={conn === 'connecting'} className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white disabled:opacity-50">
            {conn === 'connecting' ? 'Connecting…' : 'Enter the street'}
          </button>
          {conn === 'error' && <p className="mt-2 text-sm text-red-600">Cannot reach the game server. Is it running?</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <Scene playerName={playerName} />

      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <div className="pointer-events-none rounded-lg bg-black/50 px-3 py-2 text-xs text-white">
          {touch ? 'Drag the joystick to move · tap NPCs to talk' : 'WASD / arrows to move · Shift to run · E to talk · Enter to chat · 1-5 emotes'}
          {npcError && <div className="mt-1 text-yellow-300">NPCs unavailable: API server not reachable.</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <EmoteBar />
          <VoiceChatButton />
        </div>
      </div>

      <div className="absolute bottom-3 right-3 w-72 sm:w-80">
        <div className="mb-2 max-h-36 overflow-y-auto rounded-lg bg-black/40 p-2 text-sm text-white">
          {chatLog.length === 0 ? (
            <span className="opacity-60">Nearby chat will appear here.</span>
          ) : (
            chatLog.map((m, i) => (
              <div key={i}>
                <b>{m.name}:</b> {m.text}
                <ReportButton targetName={m.name} targetPlayerId={m.pid} />
              </div>
            ))
          )}
        </div>
        <form onSubmit={submitChat}>
          <input ref={chatInput} value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Say something in English…" maxLength={140} className="w-full rounded-lg border bg-white/90 px-3 py-2 text-sm" />
        </form>
      </div>

      {touch && <Joystick />}
      <InteractPrompt touch={touch} />
      <InviteToast />
      <NpcPanel />
      <PairPanel />
    </div>
  );
}
