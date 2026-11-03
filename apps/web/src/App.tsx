import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { EMOTES } from '@es/shared';
// The 3D scene (three.js + models) loads only after sign-in, keeping the first paint small.
const Scene = lazy(() => import('./scene/Scene'));
import { connect } from './net/client';
import { fetchNpcs } from './net/api';
import { getBetaPass, getPlayerId, getToken } from './net/player';
import { initAnalytics, track } from './net/analytics';
import { useProfile } from './store/profile';
import { AuthScreen } from './ui/AuthScreen';
import { ProfileHud, UiPanels } from './ui/ProfilePanels';
import { useGame } from './store/game';
import { initPairMessaging, usePair } from './store/pair';
import { initVoiceWatch, useVoiceChat } from './net/voicechat';
import { initTalkMessaging, useTalk } from './store/talk';
import { PlayerPopup, ShoutButton, TalkBox, TalkToast } from './ui/Talk';
import { CritterCard } from './ui/CritterCard';
import { setAmbientVolume } from './audio/ambient';
import { exposeSession, isNativeApp, onNative } from './native/bridge';
import { API_URL, post } from './net/api';
import { useSettings } from './store/settings';
import { isTouchDevice } from './input/joystick';
import { attachCameraGestures, cameraOrbit } from './input/camera';
import { Joystick } from './ui/Joystick';
import { InteractPrompt } from './ui/InteractPrompt';
import { NpcPanel } from './ui/NpcPanel';
import { PairPanel } from './ui/PairPanel';
import { ChatBox, EmoteBar, FeedbackButton, HintToast, HudButton, InviteToast, TalkButton, VoiceChatButton } from './ui/Hud';
import { SettingsButton } from './ui/SettingsPanel';
import { useKeyboardInset } from './ui/useKeyboardInset';

if (import.meta.env.DEV) {
  // Test hooks (used by the headless e2e scripts).
  (window as unknown as { __es: unknown }).__es = { useGame, usePair, useVoiceChat, cameraOrbit };
}

export default function App() {
  const { playerName, setPlayerName, conn } = useGame();
  const [draft] = useState(playerName);
  const [npcError, setNpcError] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const touch = isTouchDevice();
  const stage = useRef<HTMLDivElement>(null);
  const busy = useGame((s) => s.panelNpc !== null || s.uiPanel !== null);
  const inPair = usePair((s) => !!s.state || s.loading || !!s.summaries);
  const inTalk = useTalk((s) => !!s.partner);
  useKeyboardInset();

  // Load NPC definitions once; subscribe to pair-quest relay messages.
  useEffect(() => {
    initAnalytics();
    exposeSession(() => ({ playerId: getPlayerId(), token: getToken(), apiUrl: API_URL, name: useGame.getState().playerName }));
    const offNative = onNative((e) => {
      if (e.type === 'push.token') void post('/me/push-token', { playerId: getPlayerId(), token: e.token, platform: e.platform }).catch(() => undefined);
    });
    fetchNpcs()
      .then((n) => useGame.getState().setNpcs(n))
      .catch(() => setNpcError(true));
    const off = initPairMessaging();
    const offTalk = initTalkMessaging();
    const offWatch = initVoiceWatch();
    return () => {
      off();
      offTalk();
      offWatch();
      offNative();
    };
  }, []);

  // Ambient sound follows the setting; browsers only allow audio after a gesture, so (re)apply on first tap/key.
  const ambient = useSettings((s) => s.ambientVolume);
  useEffect(() => {
    if (conn !== 'connected') return;
    setAmbientVolume(ambient);
    const kick = () => setAmbientVolume(useSettings.getState().ambientVolume);
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
    return () => {
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
  }, [conn, ambient]);

  // Drag on the scene rotates the camera (mouse or one finger); wheel / pinch zooms.
  useEffect(() => {
    if (conn !== 'connected' || !stage.current) return;
    return attachCameraGestures(stage.current);
  }, [conn]);

  // Global keys: E = talk, Esc = close panel, 1-5 = emotes (Enter-to-chat lives in ChatBox).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const s = useGame.getState();
      const typing = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      if (e.key === 'Escape') {
        if (s.uiPanel) s.setUiPanel(null);
        else if (s.panelNpc) s.closePanel();
        else (document.activeElement as HTMLElement | null)?.blur();
      } else if (!typing && (e.key === 'e' || e.key === 'E') && s.interactTarget && !s.panelNpc) {
        s.openPanel(s.interactTarget);
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
    track('join', { loggedIn: !!getToken(), level: useProfile.getState().profile?.cefrLevel ?? '', touch, app: isNativeApp() });
    // First visit: offer the placement test right away.
    const p = useProfile.getState().profile;
    if (p && !p.placementDone && !localStorage.getItem('es:placement-skipped')) {
      useGame.getState().setUiPanel('placement');
      localStorage.setItem('es:placement-skipped', '1');
    }
  }

  if (conn !== 'connected') {
    return <AuthScreen initialName={draft} onPlay={(n) => void join(n)} connecting={conn === 'connecting'} connError={conn === 'error' ? (useGame.getState().connError ?? 'connect_failed') : null} />;
  }

  const hudHidden = busy || inPair;

  return (
    <div ref={stage} className="relative h-full touch-none select-none overflow-hidden">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-700">Loading the street…</div>}>
        <Scene playerName={playerName} />
      </Suspense>

      <HintToast touch={touch} />
      {npcError && <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-yellow-300">NPCs unavailable: API server not reachable.</div>}

      {touch ? (
        <>
          {/* top-right: utility buttons */}
          <div data-ui className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-end gap-2">
            <VoiceChatButton compact />
            <SettingsButton compact />
            <FeedbackButton compact />
          </div>
          {/* bottom-right: actions */}
          {!hudHidden && !chatOpen && !inTalk && (
            <div data-ui className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] flex flex-col items-end gap-3">
              <TalkButton />
              <EmoteBar compact />
              <ShoutButton compact />
              <HudButton onClick={() => setChatOpen(true)} title="Nearby chat">💬</HudButton>
            </div>
          )}
          {!hudHidden && !chatOpen && !inTalk && <Joystick />}
          <ChatBox compact open={chatOpen} onClose={() => setChatOpen(false)} />
        </>
      ) : (
        <>
          <div data-ui className="absolute left-3 top-3 flex flex-wrap gap-2">
            <EmoteBar />
            <VoiceChatButton />
            <ShoutButton />
            <SettingsButton />
            <FeedbackButton />
          </div>
          <ChatBox compact={false} open onClose={() => undefined} />
          <InteractPrompt touch={false} />
        </>
      )}

      <ProfileHud compact={touch} />
      <InviteToast />
      <TalkToast />
      {!hudHidden && <PlayerPopup />}
      {!hudHidden && <CritterCard />}
      {!hudHidden && <TalkBox compact={touch} />}
      <NpcPanel />
      <PairPanel />
      <UiPanels />
    </div>
  );
}
