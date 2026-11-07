import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { sendProp } from '../net/client';
import { track } from '../net/analytics';
import { teleportTo } from '../scene/LocalPlayer';
import { setCarrier } from '../world/carry';
import { SHORE_Z, SURF_START, VOLLEY_SPOT } from '../world/sunnyBay';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Sunny Bay sports.
 *  - Beach volleyball: your teammate calls what to do with the ball ("The ball is low. Bump it!"); pick the move in
 *    time to win the rally; the score is said in English after every point; first to 7. Reward: minigame 'volley'.
 *  - Surf lesson: rent a board at the surf school (say it right), then out at sea Jack calls "Paddle!", "Pop up!",
 *    "Lean left!"…; do the right thing in time and ride the wave in to the beach. Reward: minigame 'surf'.
 */
export type VolleyMove = 'bump' | 'set' | 'spike' | 'block';
export const VOLLEY_MOVES: { id: VolleyMove; icon: string; en: string; how: string }[] = [
  { id: 'bump', icon: '🙌', en: 'Bump', how: 'forearms, low ball' },
  { id: 'set', icon: '👐', en: 'Set', how: 'fingertips, up for a friend' },
  { id: 'spike', icon: '💥', en: 'Spike', how: 'jump and hit down hard' },
  { id: 'block', icon: '✋', en: 'Block', how: 'hands up at the net' },
];
const CALLS: Record<VolleyMove, string[]> = {
  bump: ['The ball is low. Bump it!', 'Use your forearms. Bump it!', 'Low ball! Bump it up!'],
  set: ['Set it up for me!', 'Use your fingertips and set it!', 'Set the ball, I will hit it!'],
  spike: ['The ball is high by the net. Spike it!', 'Jump and spike it!', 'Hit it down hard. Spike!'],
  block: ["They're going to spike! Block it!", 'Jump at the net and block!', 'Hands up! Block!'],
};
const NUM = ['love', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const WIN = 7;
const CALL_MS = 7000;

export interface SurfCall {
  id: string;
  icon: string;
  en: string;
  say: string;
}
export const SURF_CALLS: SurfCall[] = [
  { id: 'paddle', icon: '🏊', en: 'Paddle', say: 'Lie on your board and paddle! Paddle hard!' },
  { id: 'popup', icon: '🏄', en: 'Stand up', say: 'Here comes a wave! Pop up and stand up now!' },
  { id: 'knees', icon: '🦵', en: 'Bend your knees', say: 'Bend your knees and keep low!' },
  { id: 'left', icon: '⬅️', en: 'Lean left', say: 'Lean to the left!' },
  { id: 'right', icon: '➡️', en: 'Lean right', say: 'Lean to the right!' },
  { id: 'down', icon: '🛌', en: 'Lie down', say: "That wave is too big! Lie down on your board!" },
];
export const RENT_LINES = ['Can I rent a surfboard, please?', 'Can I renting a surfboard, please?', 'I want rent surfboard.'];
const SURF_STEPS = 6;

interface BeachSports {
  volley: {
    ours: number;
    theirs: number;
    call: VolleyMove | null;
    text: string;
    until: number;
    last: { ok: boolean; move: VolleyMove } | null;
    /** the ball flies to this side (the scene animates it from ballAt) */
    ballTo: 'us' | 'them';
    ballAt: number;
    done: boolean;
    result: MinigameResult | null;
  } | null;
  surf: {
    stage: 'rent' | 'ride' | 'done';
    lines: string[];
    miss: string | null;
    step: number;
    call: SurfCall | null;
    until: number;
    ok: number;
    /** standing on the board (after "Pop up!") */
    up: boolean;
    last: { ok: boolean; id: string } | null;
    result: MinigameResult | null;
  } | null;
  startVolley: () => void;
  pickVolley: (m: VolleyMove) => void;
  closeVolley: () => void;
  openSurf: () => void;
  sayRent: (line: string) => void;
  pickSurf: (id: string) => void;
  closeSurf: () => void;
}

const coach = (t: string) => useVoice.getState().speakAs('volley-mate', t, 'en-AU');
const jack = (t: string) => useVoice.getState().speakAs('surf-coach', t, 'en-AU');
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
let timer = 0;
const later = (ms: number, f: () => void) => {
  window.clearTimeout(timer);
  timer = window.setTimeout(f, ms);
};

/* --------------------------------------------------------------------------------------------- the surfer */
const surfPos = { x: SURF_START.x, z: SURF_START.z, tz: SURF_START.z, lean: 0 };
function surfCarrier() {
  const s = useBeachSports.getState().surf;
  if (!s || s.stage !== 'ride') return null;
  surfPos.z += (surfPos.tz - surfPos.z) * 0.04;
  surfPos.x += surfPos.lean * 0.03;
  return { x: surfPos.x, y: 0.12, z: surfPos.z, rot: Math.PI + surfPos.lean * 0.3, anim: s.up ? 'idle' : 'sit' };
}

export const useBeachSports = create<BeachSports>((set, get) => {
  const nextRally = () => {
    const v = get().volley;
    if (!v || v.done) return;
    const call = pick(VOLLEY_MOVES).id;
    const text = pick(CALLS[call]);
    coach(text);
    set({ volley: { ...v, call, text, until: Date.now() + CALL_MS, last: null, ballTo: 'us', ballAt: Date.now() } });
    later(CALL_MS, () => get().volley?.call === call && get().pickVolley('' as VolleyMove));
  };
  const nextSurf = () => {
    const s = get().surf;
    if (!s || s.stage !== 'ride') return;
    if (s.step >= SURF_STEPS) {
      // ride the last wave in to the beach
      set({ surf: { ...s, stage: 'done', call: null } });
      setCarrier(null);
      sendProp('');
      teleportTo(surfPos.x, SHORE_Z + 2.5, 0);
      jack(s.ok >= 4 ? "Awesome! You're a natural surfer!" : 'Good try! Surfing is hard. Come back and practise!');
      track('surf_done', { ok: s.ok });
      void reportMinigame('surf', { score: s.ok })
        .then((result) => {
          const cur = get().surf;
          if (cur) set({ surf: { ...cur, result } });
          void useProfile.getState().refresh();
        })
        .catch(() => undefined);
      return;
    }
    // paddle first, then pop up, then the rest (a "lie down" only before standing up again)
    const call = s.step === 0 ? SURF_CALLS[0]! : s.step === 1 ? SURF_CALLS[1]! : pick(SURF_CALLS.slice(2, s.up ? 5 : 6));
    jack(call.say);
    set({ surf: { ...s, call, until: Date.now() + CALL_MS, last: null } });
    later(CALL_MS, () => get().surf?.call === call && get().pickSurf(''));
  };
  return {
    volley: null,
    surf: null,
    startVolley() {
      teleportTo(VOLLEY_SPOT.x, VOLLEY_SPOT.z, Math.PI);
      set({ volley: { ours: 0, theirs: 0, call: null, text: '', until: 0, last: null, ballTo: 'them', ballAt: Date.now(), done: false, result: null } });
      coach("Let's play! Listen to me and do what I say. First to seven wins!");
      track('volley_start');
      later(3500, nextRally);
    },
    pickVolley(m) {
      const v = get().volley;
      if (!v || !v.call || v.done) return;
      const ok = m === v.call;
      const ours = v.ours + (ok ? 1 : 0);
      const theirs = v.theirs + (ok ? 0 : 1);
      const done = ours >= WIN || theirs >= WIN;
      if (m) useVoice.getState().speakAs('me', VOLLEY_MOVES.find((x) => x.id === m)!.en + '!', 'en-US');
      set({ volley: { ...v, ours, theirs, call: null, last: { ok, move: v.call }, ballTo: ok ? 'them' : 'us', ballAt: Date.now(), done } });
      window.setTimeout(() => coach(done ? (ours > theirs ? `Seven ${NUM[theirs]}. We won! Great game!` : `${NUM[ours]} seven. They won. Good game!`) : `${ok ? 'Our point!' : 'Their point.'} ${NUM[ours]}, ${NUM[theirs]}.`), 900);
      if (done) {
        track('volley_done', { ours, theirs });
        void reportMinigame('volley', { score: ours })
          .then((result) => {
            const cur = get().volley;
            if (cur) set({ volley: { ...cur, result } });
            void useProfile.getState().refresh();
          })
          .catch(() => undefined);
        return;
      }
      later(3600, nextRally);
    },
    closeVolley() {
      window.clearTimeout(timer);
      set({ volley: null });
    },
    openSurf() {
      set({ surf: { stage: 'rent', lines: shuffle(RENT_LINES), miss: null, step: 0, call: null, until: 0, ok: 0, up: false, last: null, result: null } });
      jack("G'day! Welcome to the surf school. How can I help you?");
    },
    sayRent(line) {
      const s = get().surf;
      if (!s || s.stage !== 'rent') return;
      if (line !== RENT_LINES[0]) return set({ surf: { ...s, miss: line } });
      useVoice.getState().speakAs('me', line, 'en-US');
      Object.assign(surfPos, { x: SURF_START.x, z: SURF_START.z, tz: SURF_START.z, lean: 0 });
      setCarrier(surfCarrier);
      sendProp('ride:surf');
      set({ surf: { ...s, stage: 'ride', miss: null } });
      window.setTimeout(() => jack("Sure! Here's your board. Let's go out to the waves. Listen to me!"), 1500);
      track('surf_start');
      later(5000, nextSurf);
    },
    pickSurf(id) {
      const s = get().surf;
      if (!s || s.stage !== 'ride' || !s.call) return;
      const ok = id === s.call.id;
      let up = s.up;
      if (ok && s.call.id === 'popup') up = true;
      if (ok && s.call.id === 'down') up = false;
      if (!ok && up) up = false; // fell off
      surfPos.tz = ok ? SURF_START.z + ((SHORE_Z - 3 - SURF_START.z) * (s.step + 1)) / SURF_STEPS : surfPos.tz;
      surfPos.lean = ok && s.call.id === 'left' ? -1 : ok && s.call.id === 'right' ? 1 : 0;
      window.setTimeout(() => (surfPos.lean = 0), 1500);
      if (id) useVoice.getState().speakAs('me', SURF_CALLS.find((c) => c.id === id)?.en ?? '', 'en-US');
      set({ surf: { ...s, step: s.step + 1, ok: s.ok + (ok ? 1 : 0), up, call: null, last: { ok, id: s.call.id } } });
      if (!ok) window.setTimeout(() => jack('Whoops! You fell off. Climb back on!'), 900);
      later(3200, nextSurf);
    },
    closeSurf() {
      window.clearTimeout(timer);
      const s = get().surf;
      if (s?.stage === 'ride') {
        setCarrier(null);
        sendProp('');
        teleportTo(surfPos.x, SHORE_Z + 2.5, 0);
      }
      set({ surf: null });
    },
  };
});
