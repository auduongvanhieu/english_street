import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AvatarSchema, EMOTES, avatarLook } from '@es/shared';
import { AVATAR_INTRO_KEY } from './ui/AvatarCreator';
// The 3D scene (three.js + models) loads only after sign-in, keeping the first paint small.
const Scene = lazy(() => import('./scene/Scene'));
import { connect, leaveRoom } from './net/client';
import { ZoneChip, ZoneScreen } from './ui/ZoneScreen';
import type { ZoneSelection } from '@es/shared';
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
import { requestJump } from './input/joystick';
import { localPos, teleportTo } from './scene/LocalPlayer';
import { CYCLISTS, cyclistAt } from './world/cyclists';
import { CRITTERS, poseAt } from './world/critters';
import { livePos } from './world/avoid';
import { freezeClock, serverNow } from './net/client';
import { InteractPrompt } from './ui/InteractPrompt';
import { HugButton } from './ui/HugButton';
import { toggleHug } from './world/hold';
import { NpcPanel } from './ui/NpcPanel';
import { PairPanel } from './ui/PairPanel';
import { ChatBox, EmoteBar, FeedbackButton, HintToast, HudButton, InviteToast, TalkButton, VoiceChatButton } from './ui/Hud';
import { SettingsButton } from './ui/SettingsPanel';
import { useKeyboardInset } from './ui/useKeyboardInset';
import { useT } from './i18n';
import { AreaChip, AreaPanel, BadgeToast, FeedingToast, GardenVisitChip, SitButton } from './ui/area/AreaPanel';
import { ShoppingMini } from './ui/area/AreaTabs';
import { ItemCard } from './ui/area/ItemCard';
import { BusPanel, MapPanel } from './ui/area/Travel';
import { useArea } from './store/area';
import { useRestaurant } from './store/restaurant';
import { useFarm } from './store/farm';
import { useShopping } from './store/shopping';
import { useLang } from './i18n';

if (import.meta.env.DEV) {
  // Test hooks (used by the headless e2e scripts).
  (window as unknown as { __es: unknown }).__es = { useGame, usePair, useVoiceChat, cameraOrbit, localPos, CYCLISTS, cyclistAt, serverNow, freezeClock, CRITTERS, poseAt, livePos, useArea, useRestaurant, useFarm, useShopping, useLang, teleportTo };
}

export default function App() {
  // Narrow selectors: subscribing to the whole store re-rendered the app (and the 3D tree) on every position patch.
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const conn = useGame((s) => s.conn);
  const t = useT();
  const [draft] = useState(playerName);
  const [npcError, setNpcError] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Zone picker shown between the name screen and the street (also after "Change zone").
  const [picker, setPicker] = useState(false);
  // ?zone=<id>[&code=…] deep link from a shared invite: join that zone straight away (code prompt if needed).
  const [deepLink] = useState(() => {
    const q = new URLSearchParams(location.search);
    const id = q.get('zone');
    return id ? { id, code: q.get('code') ?? undefined } : undefined;
  });
  const touch = isTouchDevice();
  const stage = useRef<HTMLDivElement>(null);
  const busy = useGame((s) => s.panelNpc !== null || s.uiPanel !== null);
  const uiPanel = useGame((s) => s.uiPanel);
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
      const area = useArea.getState();
      if (e.key === 'Escape') {
        if (area.card) area.openCard(null);
        else if (area.panel) area.setPanel(false);
        else if (s.uiPanel) s.setUiPanel(null);
        else if (s.panelNpc) s.closePanel();
        else (document.activeElement as HTMLElement | null)?.blur();
      } else if (!typing && e.code === 'Space' && !s.panelNpc) {
        // Edge-triggered here (not polled per frame) so a quick tap still registers on slow devices; no auto-repeat.
        if (!e.repeat) requestJump();
        e.preventDefault();
      } else if (!typing && (e.key === 'f' || e.key === 'F') && !s.panelNpc) {
        toggleHug();
      } else if (!typing && (e.key === 'e' || e.key === 'E') && s.interactTarget && !s.panelNpc) {
        s.openPanel(s.interactTarget);
      } else if (!typing && (e.key === 'e' || e.key === 'E') && !s.panelNpc && useRestaurant.getState().near) {
        useRestaurant.getState().sit(useRestaurant.getState().near!);
        area.setPanel(true, 'menu');
      } else if (!typing && (e.key === 'm' || e.key === 'M') && !s.panelNpc) {
        s.setUiPanel(s.uiPanel === 'map' ? null : 'map');
      } else if (!typing && (e.key === 'g' || e.key === 'G') && !s.panelNpc && area.current) {
        area.setPanel(!area.panel);
      } else if (!typing && /^[1-5]$/.test(e.key)) {
        const emote = EMOTES[Number(e.key) - 1];
        if (emote) s.playEmote(emote);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function join(name: string, zone: ZoneSelection = { mode: 'main' }) {
    setPlayerName(name);
    const prof = useProfile.getState();
    await prof.refresh();
    void useArea.getState().syncLearned();
    const avatar = JSON.stringify(avatarLook(useProfile.getState().profile?.avatar ?? AvatarSchema.parse({})));
    const ok = await connect({ name, avatar, playerId: getPlayerId(), betaPass: getBetaPass() ?? undefined, token: getToken() ?? undefined }, zone)
      .then(() => true)
      .catch(() => false);
    if (!ok) return;
    setPicker(false);
    if (deepLink) history.replaceState(null, '', location.pathname);
    track('join', { loggedIn: !!getToken(), level: useProfile.getState().profile?.cefrLevel ?? '', touch, app: isNativeApp(), zone: zone.mode });
    // First visit: offer the placement test right away.
    const p = useProfile.getState().profile;
    if (p && !p.placementDone && !localStorage.getItem('es:placement-skipped')) {
      useGame.getState().setUiPanel('placement');
      localStorage.setItem('es:placement-skipped', '1');
    } else if (p && !localStorage.getItem(AVATAR_INTRO_KEY)) {
      // First visit (or first since characters exist): open the character creator once.
      useGame.getState().setUiPanel('avatar');
    }
  }

  if (conn !== 'connected') {
    const connError = conn === 'error' ? (useGame.getState().connError ?? 'connect_failed') : null;
    if (picker && playerName) {
      return <ZoneScreen initial={deepLink} onJoin={(z) => void join(playerName, z)} onBack={() => setPicker(false)} connecting={conn === 'connecting'} connError={connError} />;
    }
    return (
      <AuthScreen
        initialName={draft}
        onPlay={(n) => (deepLink ? (setPlayerName(n), setPicker(true)) : void join(n))}
        onZones={(n) => (setPlayerName(n), setPicker(true))}
        connecting={conn === 'connecting'}
        connError={connError}
      />
    );
  }

  const hudHidden = busy || inPair;

  return (
    <div ref={stage} className="relative h-full touch-none select-none overflow-hidden">
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-gray-700">{t('Loading the street…')}</div>}>
        <Scene playerName={playerName} />
      </Suspense>

      <HintToast touch={touch} />
      {npcError && <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-yellow-300">{t('NPCs unavailable: API server not reachable.')}</div>}

      {touch ? (
        <>
          {/* top-right: utility buttons */}
          <div data-ui className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-end gap-2">
            <VoiceChatButton compact />
            <HudButton onClick={() => useGame.getState().setUiPanel('map')} title={t('Map')}>🗺️</HudButton>
            <SettingsButton compact />
            <FeedbackButton compact />
          </div>
          {/* bottom-right: actions */}
          {!hudHidden && !chatOpen && !inTalk && (
            <div data-ui className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] flex flex-col items-end gap-3">
              <SitButton />
              <TalkButton />
              <HugButton touch />
              <HudButton big onClick={requestJump} title={t('Jump')}>⤒</HudButton>
              <EmoteBar compact />
              <ShoutButton compact />
              <HudButton onClick={() => setChatOpen(true)} title={t('Nearby chat')}>💬</HudButton>
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
            <button type="button" onClick={() => useGame.getState().setUiPanel('map')} className="rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title={t('Map (M)')}>
              🗺️ {t('Map')}
            </button>
            <SettingsButton />
            <FeedbackButton />
          </div>
          <ChatBox compact={false} open onClose={() => undefined} />
          <InteractPrompt touch={false} />
          <div className="pointer-events-none absolute bottom-44 left-1/2 -translate-x-1/2">
            <HugButton touch={false} />
          </div>
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
            <SitButton />
          </div>
        </>
      )}

      <ProfileHud compact={touch} />
      <ZoneChip compact={touch} onChange={() => { setPicker(true); leaveRoom(); }} />
      <InviteToast />
      <TalkToast />
      {!hudHidden && <PlayerPopup />}
      {!hudHidden && <CritterCard />}
      {!hudHidden && <TalkBox compact={touch} />}
      <AreaChip />
      {!hudHidden && <ShoppingMini />}
      <FeedingToast />
      <BadgeToast />
      <GardenVisitChip />
      <NpcPanel />
      <PairPanel />
      <UiPanels />
      <AreaPanel />
      <ItemCard />
      {uiPanel === 'bus' ? <BusPanel /> : uiPanel === 'map' ? <MapPanel /> : null}
    </div>
  );
}
