import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { EMOTES } from '@es/shared';
// The 3D scene (three.js + models) loads only after sign-in, keeping the first paint small.
const Scene = lazy(() => import('./scene/Scene'));
import { connect, sendChat } from './net/client';
import { fetchNpcs } from './net/api';
import { getBetaPass, getPlayerId, getToken } from './net/player';
import { initAnalytics, track } from './net/analytics';
import { useProfile } from './store/profile';
import { AuthScreen } from './ui/AuthScreen';
import { ProfileHud, UiPanels } from './ui/ProfilePanels';
import { useGame } from './store/game';
import { initPairMessaging, usePair } from './store/pair';
import { useVoiceChat } from './net/voicechat';
import { isTouchDevice } from './input/joystick';
import { Joystick } from './ui/Joystick';
import { InteractPrompt } from './ui/InteractPrompt';
import { NpcPanel } from './ui/NpcPanel';
import { PairPanel } from './ui/PairPanel';
import { EmoteBar, FeedbackButton, InviteToast, QualityToggle, ReportButton, VoiceChatButton } from './ui/Hud';

if (import.meta.env.DEV) {
  // Test hooks (used by the headless e2e scripts).
  (window as unknown as { __es: unknown }).__es = { useGame, usePair, useVoiceChat };
}

export default function App() {
  const { playerName, setPlayerName, conn, chatLog } = useGame();
  const [draft] = useState(playerName);
  const [chat, setChat] = useState('');
  const [npcError, setNpcError] = useState(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const touch = isTouchDevice();

  // Load NPC definitions once; subscribe to pair-quest relay messages.
  useEffect(() => {
    initAnalytics();
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
        if (s.uiPanel) s.setUiPanel(null);
        else if (s.panelNpc) s.closePanel();
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

  async function join(name: string) {
    setPlayerName(name);
    const prof = useProfile.getState();
    await prof.refresh();
    const avatar = JSON.stringify({ color: useProfile.getState().profile?.avatar.color ?? '#4a90e2' });
    await connect({ name, avatar, playerId: getPlayerId(), betaPass: getBetaPass() ?? undefined, token: getToken() ?? undefined }).catch(() => undefined);
    track('join', { loggedIn: !!getToken(), level: useProfile.getState().profile?.cefrLevel ?? '' });
    // First visit: offer the placement test right away.
    const p = useProfile.getState().profile;
    if (p && !p.placementDone && !localStorage.getItem('es:placement-skipped')) {
      useGame.getState().setUiPanel('placement');
      localStorage.setItem('es:placement-skipped', '1');
    }
  }

  function submitChat(e: FormEvent) {
    e.preventDefault();
    const t = chat.trim();
    if (t) sendChat(t);
    setChat('');
    chatInput.current?.blur();
  }

  if (conn !== 'connected') {
    return <AuthScreen initialName={draft} onPlay={(n) => void join(n)} connecting={conn === 'connecting'} connError={conn === 'error'} />;
  }

  return (
    <div className="relative h-full">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-700">Loading the street…</div>}>
        <Scene playerName={playerName} />
      </Suspense>

      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <div className="pointer-events-none rounded-lg bg-black/50 px-3 py-2 text-xs text-white">
          {touch ? 'Drag the joystick to move · tap NPCs to talk' : 'WASD / arrows to move · Shift to run · E to talk · Enter to chat · 1-5 emotes'}
          {npcError && <div className="mt-1 text-yellow-300">NPCs unavailable: API server not reachable.</div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <EmoteBar />
          <VoiceChatButton />
          <QualityToggle />
          <FeedbackButton />
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
      <ProfileHud />
      <InviteToast />
      <NpcPanel />
      <PairPanel />
      <UiPanels />
    </div>
  );
}
