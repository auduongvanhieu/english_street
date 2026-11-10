import { InstallGuide, InstallNudge, reportInstalledApp } from './ui/InstallApp';
import { waiter } from './world/waiter';
import { TripSportsHud } from './ui/TripSportsHud';
import { useBeachSports } from './store/beachSports';
import { useTripRides } from './store/tripRides';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { deviceInfo } from './net/device';
import { rideTo } from './ui/area/Travel';
import { sky, skyDebug } from './world/sky';
import { moveTarget } from './input/clickMove';
import { useBus } from './store/bus';
import { BusOverlay } from './ui/BusOverlay';
import { isStaffTab, startWorldSync, useWorld } from './store/world';
import { Maintenance, Notices } from './ui/Notices';
import { AvatarSchema, EMOTES, avatarLook } from '@es/shared';
import { AVATAR_INTRO_KEY } from './ui/AvatarCreator';
// The 3D scene (three.js + models) loads only after sign-in, keeping the first paint small.
import { SceneBoundary } from './scene/SceneBoundary';
const Scene = lazy(() => import('./scene/Scene'));
import { connect, leaveRoom } from './net/client';
import { ZoneChip, ZoneScreen } from './ui/ZoneScreen';
import type { ZoneSelection } from '@es/shared';
import { fetchNpcs } from './net/api';
import { restoreSpot } from './world/lastPos';
import { adoptGuestId, getBetaPass, getHumanPass, getPlayerId, getToken, setHumanPass } from './net/player';
import { initAnalytics, track } from './net/analytics';
import { useProfile } from './store/profile';
import { AuthScreen } from './ui/AuthScreen';
import { ProfileHud, UiPanels } from './ui/ProfilePanels';
import { useGame } from './store/game';
import { initPairMessaging, usePair } from './store/pair';
import { initVoiceWatch, useVoiceChat } from './net/voicechat';
import { initTalkMessaging, useTalk } from './store/talk';
import { initDm, useDm } from './store/dm';
import { initFriends, setZoneJumper } from './store/friends';
import { initGroup } from './store/group';
import { SocialToasts } from './ui/Social';
import { initHotel, useHotel } from './store/hotel';
import { initSports, useSports } from './store/sports';
import { initBoats, useBoats } from './store/boats';
import { BoatPanel, BoatToasts, FishingHud } from './ui/boats/BoatPanel';
import { Library } from './ui/books/Library';
import { Tutorial } from './ui/Tutorial';
import { GuideChip, JourneyToasts, NextStepChip } from './ui/journey/JourneyHud';
import { initJourney, useJourney } from './store/journey';
import { initMyFarm, useMyFarm } from './store/myFarm';
import { MyFarmHud } from './ui/MyFarmHud';
import { FerryChip } from './ui/boats/FerryChip';
import { useFerry } from './store/ferryman';
import { TeamGameButton, TeamGameHud } from './ui/TeamGameHud';
import { initTeamGame, useTeamGame } from './store/teamGame';
import { Icon } from './ui/icons';
import { applyPlayerSettings, currentPlayerSettings, watchPlayerSettings } from './store/playerSettings';
import type { PlayerSettings } from '@es/shared';
import { KitchenHud } from './ui/KitchenHud';
import { CheckoutHud } from './ui/CheckoutHud';
import { MovieHud } from './ui/MovieHud';
import { TrainHud } from './ui/TrainHud';
import { ClassHud } from './ui/ClassHud';
import { ClinicHud } from './ui/ClinicHud';
import { FittingHud } from './ui/FittingHud';
import { AnimalJobsHud } from './ui/AnimalJobsHud';
import { MyRoomHud } from './ui/MyRoomHud';
import { BeachHud } from './ui/BeachHud';
import { HillHud } from './ui/HillHud';
import { TripHud } from './ui/TripHud';
import { useRiverside } from './store/riverside';
import { useOldTown } from './store/oldTown';
import { useHill } from './store/hill';
import { useBeach } from './store/beach';
import { useMyRoom } from './store/myRoom';
import { useAnimalJobs } from './store/animalJobs';
import { useFitting } from './store/fitting';
import { useClinic } from './store/clinic';
import { useClassroom } from './store/classroom';
import { useTrain } from './store/train';
import { useMovie } from './store/movie';
import { useKitchen } from './store/kitchen';
import { TUTORIAL_KEY, tutorialPending, useTutorial } from './store/tutorial';
import { useBooks } from './store/books';
import { SportsHud } from './ui/sports/SportsHud';
import { MinigameHud } from './ui/sports/MinigameHud';
import { useMini } from './store/minigames';
import { HotelPanels, HotelToasts } from './ui/hotel/HotelPanels';
import { DmToast, PlayersButton, PlayersPanel } from './ui/PlayersPanel';
import { PlayerPopup, ShoutButton, TalkBar, TalkBox, TalkToast, FollowChip } from './ui/Talk';
import { CritterCard } from './ui/CritterCard';
import { setAmbientVolume, setSoundOn } from './audio/ambient';
import { setSpeechMuted } from './voice/tts';
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
import { ballState, freezeClock, serverNow } from './net/client';
import { InteractPrompt } from './ui/InteractPrompt';
import { UseButton, UsePrompt } from './ui/UseButton';
import { useNearest, useNearUsable, usables } from './world/usables';
import { HugButton } from './ui/HugButton';
import { toggleHug } from './world/hold';
import { NpcPanel } from './ui/NpcPanel';
import { PairPanel } from './ui/PairPanel';
import { WeatherChip } from './ui/WeatherChip';
import { ChatBox, EmoteBar, FeedbackButton, HintToast, HudButton, JumpButton, Collapsible, InviteToast, TalkButton, VoiceChatButton } from './ui/Hud';
import { SettingsButton } from './ui/SettingsPanel';
import { useKeyboardInset } from './ui/useKeyboardInset';
import { useT } from './i18n';
import { AreaChip, AreaPanel, BadgeToast, FeedingToast, SitButton } from './ui/area/AreaPanel';
import { ShoppingMini } from './ui/area/AreaTabs';
import { ItemCard } from './ui/area/ItemCard';
import { BusPanel, MapPanel } from './ui/area/Travel';
import { useArea } from './store/area';
import { useSeat } from './store/seat';
import { useFollow } from './store/follow';
import { useRestaurant } from './store/restaurant';
import { useFarm } from './store/farm';
import { useShopping } from './store/shopping';
import { useLang } from './i18n';

if (import.meta.env.DEV) {
  // Test hooks (used by the headless e2e scripts).
  (window as unknown as { __es: unknown }).__es = { useGame, usePair, useVoiceChat, cameraOrbit, localPos, CYCLISTS, cyclistAt, serverNow, freezeClock, CRITTERS, poseAt, livePos, useArea, useRestaurant, useFarm, useShopping, useLang, teleportTo, useBus, rideTo, skyDebug, sky, moveTarget, useSeat, useTalk, useFollow, useSettings, useSports, ballState, useMini, useBoats, useBooks, useTutorial, useKitchen, useJourney, useTrain, useMovie, useNearUsable, usables, useClassroom, useClinic, useFitting, useAnimalJobs, useMyRoom, useBeach, useHill, useRiverside, useOldTown, useMyFarm, useProfile, useTeamGame, useFerry, waiter, useBeachSports, useTripRides };
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
  const [confirmExit, setConfirmExit] = useState(false);
  // Zone picker shown between the name screen and the street (also after "Change zone").
  const [picker, setPicker] = useState(false);
  // ?zone=<id>[&code=…] deep link from a shared invite: join that zone straight away (code prompt if needed).
  const [deepLink] = useState(() => {
    const q = new URLSearchParams(location.search);
    const id = q.get('zone');
    return id ? { id, code: q.get('code') ?? undefined } : undefined;
  });
  const touch = isTouchDevice();
  const tutorialOn = useTutorial((s) => !!s.step);
  const stage = useRef<HTMLDivElement>(null);
  const busy = useGame((s) => s.panelNpc !== null || s.uiPanel !== null);
  const uiPanel = useGame((s) => s.uiPanel);
  const inPair = usePair((s) => !!s.state || s.loading || !!s.summaries);
  const inTalk = useTalk((s) => !!s.partner && s.open);
  useKeyboardInset();
  // Admin maintenance switch: the street is closed (staff can continue from an admin tab).
  const maintenance = useWorld((s) => s.cfg?.maintenance ?? '');
  const [maintenanceOk, setMaintenanceOk] = useState(false);

  // Load NPC definitions once; subscribe to pair-quest relay messages.
  useEffect(() => {
    initAnalytics();
    startWorldSync();
    exposeSession(() => ({ playerId: getPlayerId(), token: getToken(), apiUrl: API_URL, name: useGame.getState().playerName }));
    const offNative = onNative((e) => {
      if (e.type === 'push.token') void post('/me/push-token', { playerId: getPlayerId(), token: e.token, platform: e.platform }).catch(() => undefined);
    });
    fetchNpcs()
      .then((n) => useGame.getState().setNpcs(n))
      .catch(() => setNpcError(true));
    const off = initPairMessaging();
    const offTalk = initTalkMessaging();
    const offDm = initDm();
    const offFriends = initFriends();
    const offGroup = initGroup();
    const offHotel = initHotel();
    const offSports = initSports();
    const offBoats = initBoats();
    const offSettings = watchPlayerSettings();
    const offJourney = initJourney();
    const offMyFarm = initMyFarm();
    const offTeam = initTeamGame();
    const offWatch = initVoiceWatch();
    return () => {
      off();
      offTalk();
      offDm();
      offFriends();
      offGroup();
      offHotel();
      offSports();
      offBoats();
      offSettings();
      offTeam();
      offMyFarm();
      offJourney();
      offWatch();
      offNative();
    };
  }, []);

  // Ambient sound follows the setting; browsers only allow audio after a gesture, so (re)apply on first tap/key.
  const ambient = useSettings((s) => s.ambientVolume);
  const sound = useSettings((s) => s.sound);
  useEffect(() => {
    setSoundOn(sound);
    setSpeechMuted(!sound);
  }, [sound]);
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
  }, [conn, ambient, sound]);

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
        if (useBooks.getState().open) useBooks.getState().close();
        else if (useBoats.getState().panel) useBoats.getState().open(null);
        else if (useHotel.getState().panel) useHotel.setState({ panel: null });
        else if (area.card) area.openCard(null);
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
      } else if (!typing && (e.key === 'e' || e.key === 'E') && !s.panelNpc && !useSeat.getState().seat && useNearest()) {
        // used the nearest usable thing (door, lift, phone, ball, boat…)
      } else if (!typing && (e.key === 'e' || e.key === 'E') && !s.panelNpc && useSeat.getState().seat) {
        useSeat.getState().stand();
      } else if (!typing && (e.key === 'e' || e.key === 'E') && !s.panelNpc && useSeat.getState().near && !useRestaurant.getState().near) {
        useSeat.getState().sit(useSeat.getState().near!);
      } else if (!typing && (e.key === 'e' || e.key === 'E') && !s.panelNpc && area.nearBoard && area.current && !area.panel) {
        area.setPanel(true);
      } else if (!typing && (e.key === 'e' || e.key === 'E') && !s.panelNpc && useRestaurant.getState().near) {
        useRestaurant.getState().sit(useRestaurant.getState().near!);
        area.setPanel(true, 'menu');
      } else if (!typing && (e.key === 'm' || e.key === 'M') && !s.panelNpc) {
        s.setUiPanel(s.uiPanel === 'map' ? null : 'map');
      } else if (!typing && (e.key === 'p' || e.key === 'P') && !s.panelNpc) {
        if (s.uiPanel !== 'players') useDm.getState().open(null);
        s.setUiPanel(s.uiPanel === 'players' ? null : 'players');
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

  /** 🚪 Exit: close whatever is open, leave the room and go back to the zone picker (progress is saved). */
  function exitGame() {
    track('exit_game');
    const g = useGame.getState();
    g.closePanel();
    g.setUiPanel(null);
    if (usePair.getState().state) void usePair.getState().leave();
    if (useRestaurant.getState().seat) useRestaurant.getState().stand();
    useArea.getState().setCurrent(null);
    useFarm.getState().visit(null);
    useVoiceChat.getState().disable();
    leaveRoom();
    setChatOpen(false);
    setConfirmExit(false);
    setPicker(true);
  }

  // Phone app hooks (apps/mobile game_page.dart): menu "Exit to zone list" and the Android back button.
  useEffect(() => {
    const w = window as unknown as { __esExit?: () => void; __esBack?: () => void };
    const inGame = () => !!useGame.getState().sessionId;
    w.__esExit = () => {
      if (inGame()) setConfirmExit(true);
    };
    w.__esBack = () => {
      const g = useGame.getState();
      const area = useArea.getState();
      if (confirmExit) return setConfirmExit(false);
      const open = area.card || area.panel || g.uiPanel || g.panelNpc || usePair.getState().state || chatOpen;
      if (!inGame() || open) {
        if (chatOpen && !g.panelNpc) setChatOpen(false);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      setConfirmExit(true);
    };
    return () => {
      delete w.__esExit;
      delete w.__esBack;
    };
  }, [confirmExit, chatOpen]);

  // friends list: "Go to their zone" leaves this room and joins theirs
  useEffect(() => {
    setZoneJumper((id) => {
      if (!playerName) return;
      leaveRoom();
      void join(playerName, { mode: 'join', id });
    });
    return () => setZoneJumper(null);
  });

  async function join(name: string, zone: ZoneSelection = { mode: 'main' }) {
    setPlayerName(name);
    const prof = useProfile.getState();
    await prof.refresh();
    void useArea.getState().syncLearned();
    const avatar = JSON.stringify(avatarLook(useProfile.getState().profile?.avatar ?? AvatarSchema.parse({})));
    const ok = await connect({ name, avatar, playerId: getPlayerId(), betaPass: getBetaPass() ?? undefined, humanPass: getHumanPass() ?? undefined, token: getToken() ?? undefined }, zone)
      .then(() => true)
      .catch(() => false);
    if (!ok) {
      // guest pass missing or expired: back to the first screen for a new security check
      if ((useGame.getState().connError ?? '').includes('human_check_required')) {
        setHumanPass(null);
        setPicker(false);
      }
      return;
    }
    setPicker(false);
    if (deepLink) history.replaceState(null, '', location.pathname);
    track('join', { loggedIn: !!getToken(), level: useProfile.getState().profile?.cefrLevel ?? '', touch, app: isNativeApp(), zone: zone.mode });
    // the name a guest typed + the device (admin site: player list, device stats)
    void deviceInfo()
      .then((device) => post<{ ok: boolean; settings?: PlayerSettings; sameAs?: string; lastPos?: { x: number; z: number; rot: number } }>(`/me/hello?playerId=${encodeURIComponent(getPlayerId())}`, { playerId: getPlayerId(), name, invitedBy: localStorage.getItem('es:invitedBy') ?? undefined, device: { ...device, gfx: { quality: useSettings.getState().quality }, settings: currentPlayerSettings() } }))
      // settings an admin changed while I was away
      .then((r) => {
        // this device already has a guest: carry on as that player
        if (r?.sameAs && !getToken() && r.sameAs !== getPlayerId()) {
          adoptGuestId(r.sameAs);
          location.reload();
          return;
        }
        if (r?.settings) applyPlayerSettings(r.settings);
        // back where they left the street last time (not when a link sent them somewhere)
        const spot = !deepLink ? restoreSpot(r?.lastPos) : null;
        if (spot) teleportTo(spot.x, spot.z, spot.rot);
        // the journey needs the player to exist on the server first; opened as the installed app = the install bonus
        void useJourney.getState().load().then(() => reportInstalledApp(track));
      })
      .catch(() => undefined);
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

  if (maintenance && !maintenanceOk) return <Maintenance text={maintenance} onContinue={isStaffTab() ? () => setMaintenanceOk(true) : undefined} />;

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
        <SceneBoundary>
          <Scene playerName={playerName} />
        </SceneBoundary>
      </Suspense>

      <TutorialStarter />
      <Tutorial touch={touch} />
      {tutorialOn ? null : <HintToast touch={touch} />}
      {tutorialOn ? null : <NextStepChip touch={touch} />}
      <GuideChip />
      <JourneyToasts />
      {tutorialOn ? null : <InstallNudge touch={touch} />}
      <InstallGuide />
      {!touch && <WeatherChip compact={false} />}
      <Notices />
      <BusOverlay />
      {npcError && <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-yellow-300">{t('NPCs unavailable: API server not reachable.')}</div>}

      {touch ? (
        <>
          {/* top-right: utility buttons */}
          <div data-ui className="hud-top absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] flex flex-col items-end gap-2">
            <WeatherChip compact />
            <PlayersButton compact />
            <TeamGameButton />
            <Collapsible id="top" icon="menu" title={t('More buttons')} row>
              <VoiceChatButton compact />
              <HudButton onClick={() => useGame.getState().setUiPanel('map')} title={t('Map')}>
                <Icon name="map" />
              </HudButton>
              <SettingsButton compact />
              <FeedbackButton compact />
              <HudButton onClick={() => setConfirmExit(true)} title={t('Exit to zone list')}>
                <Icon name="exit" />
              </HudButton>
            </Collapsible>
          </div>
          {/* bottom-right: actions */}
          {!hudHidden && !chatOpen && !inTalk && (
            <div data-ui className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] flex flex-col items-end gap-3">
              <SitButton compact />
              <TalkButton compact />
              <UseButton />
              <HugButton touch />
              <Collapsible id="actions" icon="more" title={t('More actions')} reverse>
                <EmoteBar compact />
                <ShoutButton compact />
              </Collapsible>
              <JumpButton onJump={requestJump} title={t('Jump')} />
              <HudButton onClick={() => setChatOpen(true)} title={t('Nearby chat')}>
                <Icon name="chat" />
              </HudButton>
            </div>
          )}
          {!hudHidden && !chatOpen && !inTalk && <Joystick />}
          <ChatBox compact open={chatOpen} onClose={() => setChatOpen(false)} />
        </>
      ) : (
        <>
          {/* desktop: the same round line-icon buttons as on phones */}
          <div data-ui className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <EmoteBar compact />
            <VoiceChatButton compact />
            <ShoutButton compact />
            <HudButton onClick={() => useGame.getState().setUiPanel('map')} title={t('Map (M)')}>
              <Icon name="map" />
            </HudButton>
            <PlayersButton compact />
            <TeamGameButton />
            <SettingsButton compact />
            <FeedbackButton compact />
            <HudButton onClick={() => setConfirmExit(true)} title={t('Exit to zone list')}>
              <Icon name="exit" />
            </HudButton>
          </div>
          <ChatBox compact={false} open onClose={() => undefined} />
          <InteractPrompt touch={false} />
          <UsePrompt />
          <div className="pointer-events-none absolute bottom-44 left-1/2 -translate-x-1/2">
            <HugButton touch={false} />
          </div>
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2">
            <SitButton />
          </div>
        </>
      )}

      {confirmExit && <ConfirmExit onStay={() => setConfirmExit(false)} onExit={exitGame} />}
      <ProfileHud compact={touch} />
      <ZoneChip compact={touch} onChange={() => { setPicker(true); leaveRoom(); }} />
      <InviteToast />
      <TalkToast />
      <DmToast />
      <SocialToasts />
      <HotelToasts />
      <SportsHud />
      <MinigameHud />
      <BoatPanel />
      <BoatToasts />
      <FishingHud />
      <Library />
      <KitchenHud />
      <CheckoutHud />
      <MovieHud />
      <TrainHud />
      <ClassHud />
      <ClinicHud />
      <FittingHud />
      <AnimalJobsHud />
      <MyRoomHud />
      <BeachHud />
      <HillHud />
      <TripHud />
      <TripSportsHud />
      <MyFarmHud />
      <FerryChip />
      <TeamGameHud />
      <HotelPanels />
      {!hudHidden && <TalkBar />}
      <FollowChip />
      {!hudHidden && <PlayerPopup />}
      {!hudHidden && <CritterCard />}
      {!hudHidden && <TalkBox compact={touch} />}
      <AreaChip />
      {!hudHidden && <ShoppingMini />}
      <FeedingToast />
      <BadgeToast />
      <NpcPanel />
      <PairPanel />
      <UiPanels />
      <AreaPanel />
      <ItemCard />
      {uiPanel === 'bus' ? <BusPanel /> : uiPanel === 'map' ? <MapPanel /> : uiPanel === 'players' ? <PlayersPanel /> : null}
    </div>
  );
}

/** "Leave the game?" — asked before 🚪 Exit takes the player back to the zone list. */
function ConfirmExit({ onStay, onExit }: { onStay: () => void; onExit: () => void }) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onStay();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onStay]);
  return (
    <div data-ui role="dialog" aria-modal="true" className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onStay}>
      <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-3xl">🚪</div>
        <h2 className="mt-1 text-lg font-bold">{t('Leave the game?')}</h2>
        <p className="mt-1 text-sm text-gray-600">{t('You will go back to the zone list. Your progress is saved.')}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" autoFocus onClick={onStay} className="min-h-11 flex-1 rounded-lg border font-medium hover:bg-gray-50">
            {t('Stay')}
          </button>
          <button type="button" onClick={onExit} className="min-h-11 flex-1 rounded-lg bg-red-600 font-semibold text-white hover:bg-red-700">
            {t('Exit')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Starts the new-player guide once the first panels (placement test, character) are closed. */
function TutorialStarter() {
  const ready = useGame((s) => s.conn === 'connected' && !s.uiPanel && !s.panelNpc);
  useEffect(() => {
    if (!ready || !tutorialPending() || useTutorial.getState().step) return;
    const id = window.setTimeout(() => {
      if (tutorialPending() && !useTutorial.getState().step) useTutorial.getState().start();
    }, 1500);
    return () => window.clearTimeout(id);
  }, [ready]);
  return null;
}
