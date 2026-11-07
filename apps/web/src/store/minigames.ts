import { create } from 'zustand';
import { fetchMinigameBoard, reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { localPos, teleportTo } from '../scene/LocalPlayer';
import { COURT, FRAME, TRACK } from '../world/places/sports';
import { useGame } from './game';
import { useProfile } from './profile';
import { coachSay } from './sports';

/**
 * Sports park solo minigames, played in the 3D park (not in a panel):
 *  - hoops: 10 throws from the free-throw spot, a timing meter decides each throw;
 *  - race: a 32 m sprint on the track against the clock (countdown, timer, today's best times);
 *  - coach: "Coach says" for real: jump, wave, dance, run to a coloured cone… but only when Coach says so!
 * Results go to /me/minigame (XP and coins, capped per day, best scores kept on the server).
 */
export type MiniGame = 'hoops' | 'race' | 'coach' | 'pingpong';
/** Hoops: a sports word before each throw (right = you get the ball). */
export const SPORT_WORDS: [string, string][] = [
  ['basketball', '🏀'], ['football', '⚽'], ['tennis', '🎾'], ['swimming', '🏊'], ['cycling', '🚴'], ['skiing', '⛷️'],
  ['boxing', '🥊'], ['golf', '⛳'], ['volleyball', '🏐'], ['baseball', '⚾'], ['table tennis', '🏓'], ['running', '🏃'],
  ['surfing', '🏄'], ['climbing', '🧗'], ['skating', '⛸️'], ['bowling', '🎳'],
];
export interface HoopsQuestion {
  word: string;
  options: string[];
  answer: number;
}
const hoopsQuestion = (): HoopsQuestion => {
  const pool = [...SPORT_WORDS].sort(() => Math.random() - 0.5).slice(0, 4);
  const answer = Math.floor(Math.random() * 4);
  return { word: pool[answer]![0], options: pool.map((p) => p[1]), answer };
};
/** Table tennis in the sports hall: where the ball goes (the call) and the button for it. */
export const PP_CALLS = [
  { call: 'Left!', key: 'left' },
  { call: 'Right!', key: 'right' },
  { call: 'Short!', key: 'short' },
  { call: 'Long!', key: 'long' },
] as const;
export type PPKey = (typeof PP_CALLS)[number]['key'];
export const PP_TO = 7;
const NUMBER = ['love', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export type ConeColor = 'red' | 'blue' | 'yellow';

const ccz = (COURT.z0 + COURT.z1) / 2;
/** Hoop rings (local): ring centre 1.1 m in from each pole, 2.75 m up. */
export const HOOPS_LOCAL = [
  { x: COURT.x0 - 0.05 + 1.1, z: ccz, toward: 1 },
  { x: COURT.x1 + 0.05 - 1.1, z: ccz, toward: -1 },
];
export const RIM_Y = 2.75;
export const HOOP_SPOT_LOCAL = { x: HOOPS_LOCAL[0]!.x + 4.2, z: ccz };
export const RACE_START_LOCAL = { x: TRACK.x0 + 2, z: (TRACK.z0 + TRACK.z1) / 2 };
export const RACE_FINISH_X = TRACK.x1 - 2;
export const CONES_LOCAL: Record<ConeColor, { x: number; z: number }> = {
  red: { x: 3.5, z: -10.8 },
  blue: { x: 6.2, z: -10.8 },
  yellow: { x: 8.9, z: -10.8 },
};
export const COACH_SPOT_LOCAL = { x: 6.2, z: -8.4 };

const HOOPS_THROWS = 10;
const COACH_ROUNDS = 8;
const w = (p: { x: number; z: number }) => FRAME.toWorld(p.x, p.z);

export interface Shot {
  from: [number, number, number];
  to: [number, number, number];
  made: boolean;
  t0: number;
}
interface CoachRound {
  text: string;
  /** what to do (checked live); `says` false = a trick, do nothing */
  kind: 'jump' | 'emote' | 'cone';
  emote?: string;
  cone?: ConeColor;
  says: boolean;
  t0: number;
  ms: number;
  done: boolean | null;
}

interface MiniStore {
  game: MiniGame | null;
  phase: 'intro' | 'countdown' | 'play' | 'done';
  // hoops
  throws: number;
  made: number;
  shot: Shot | null;
  meterT0: number;
  // race
  raceT0: number;
  raceMs: number;
  // coach
  round: number;
  correct: number;
  coachRound: CoachRound | null;
  hoopsQ: HoopsQuestion | null;
  // table tennis
  pp: { me: number; coach: number; call: PPKey | null; callAt: number; window: number; hits: number } | null;
  // results
  note: string | null;
  result: MinigameResult | null;
  board: { name: string; score: number }[];
  start: (g: MiniGame) => void;
  stop: () => void;
  throwBall: () => void;
  answerHoops: (i: number) => void;
  hitPP: (k: PPKey) => void;
}

let timers: number[] = [];
const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
const clearTimers = () => {
  timers.forEach((t) => window.clearTimeout(t));
  timers = [];
};
let poll: number | null = null;
const stopPoll = () => {
  if (poll) window.clearInterval(poll);
  poll = null;
};

/** Timing meter position 0…1 (a smooth back-and-forth, 1.5 s per sweep). */
export const meterAt = (t0: number, now = performance.now()) => 0.5 - 0.5 * Math.cos(((now - t0) / 1500) * Math.PI);
/** The green zone of the meter (centre 0.5). */
export const METER_GOOD = 0.1;

async function finish(game: MiniGame, score: number) {
  track('minigame_done', { game, score });
  try {
    const r = await reportMinigame(game, { score });
    useMini.setState({ result: r });
    void useProfile.getState().refresh();
  } catch {
    /* offline: no reward */
  }
  if (game !== 'coach' && game !== 'pingpong') {
    try {
      const b = await fetchMinigameBoard(game);
      useMini.setState({ board: b.board.slice(0, 5) });
    } catch {
      /* ignore */
    }
  }
}

export const useMini = create<MiniStore>((set, get) => ({
  game: null,
  phase: 'intro',
  throws: 0,
  made: 0,
  shot: null,
  meterT0: 0,
  raceT0: 0,
  raceMs: 0,
  round: 0,
  correct: 0,
  coachRound: null,
  hoopsQ: null,
  pp: null,
  note: null,
  result: null,
  board: [],
  start(game) {
    clearTimers();
    stopPoll();
    set({ game, phase: 'countdown', throws: 0, made: 0, shot: null, raceT0: 0, raceMs: 0, round: 0, correct: 0, coachRound: null, hoopsQ: null, pp: null, note: null, result: null, board: [] });
    track('minigame_start', { game });
    if (game === 'hoops') startHoops();
    else if (game === 'race') startRace();
    else if (game === 'pingpong') startPingpong();
    else startCoach();
  },
  stop() {
    clearTimers();
    stopPoll();
    set({ game: null, shot: null, coachRound: null, hoopsQ: null, pp: null, note: null });
  },
  throwBall() {
    const s = get();
    if (s.game !== 'hoops' || s.phase !== 'play' || s.shot || s.hoopsQ) return;
    const m = meterAt(s.meterT0);
    const off = Math.abs(m - 0.5);
    const made = off < METER_GOOD;
    const hoop = HOOPS_LOCAL[0]!;
    const [hx, hz] = FRAME.toWorld(hoop.x, hoop.z);
    // a miss lands short or long, a little to the side
    const miss = off < 0.25 ? 0.35 : 0.8;
    const dir = m < 0.5 ? -1 : 1; // too early: short; too late: long
    const [mx, mz] = FRAME.toWorld(hoop.x + (made ? 0 : dir * miss * (hoop.toward > 0 ? -1 : 1)), hoop.z + (made ? 0 : (Math.random() - 0.5) * 0.5));
    set({ shot: { from: [localPos.x, 1.6, localPos.z], to: [made ? hx : mx, RIM_Y, made ? hz : mz], made, t0: performance.now() } });
    useGame.getState().playEmote('wave');
    later(1000, () => {
      const throws = get().throws + 1;
      const madeN = get().made + (made ? 1 : 0);
      set({ throws, made: madeN, note: made ? 'Nice shot!' : off < 0.25 ? 'So close!' : m < 0.5 ? 'Too short!' : 'Too long!' });
      coachSay(made ? (madeN % 3 === 0 ? `Great! That's ${madeN} baskets.` : 'Nice shot!') : off < 0.25 ? 'So close!' : 'Try again!');
      if (made) haptic('light');
      later(900, () => {
        set({ shot: null, meterT0: performance.now(), hoopsQ: throws < HOOPS_THROWS ? hoopsQuestion() : null });
        if (throws >= HOOPS_THROWS) {
          set({ phase: 'done' });
          coachSay(`Well done! You scored ${madeN} out of ${HOOPS_THROWS}.`);
          void finish('hoops', madeN);
        }
      });
    });
  },
  answerHoops(i) {
    const s = get();
    const q = s.hoopsQ;
    if (s.game !== 'hoops' || s.phase !== 'play' || !q) return;
    if (i === q.answer) {
      coachSay(`Yes, ${q.word}! Here's the ball.`);
      set({ hoopsQ: null, meterT0: performance.now(), note: null });
      return;
    }
    // a wrong word: no ball this time (the throw counts as a miss)
    const throws = s.throws + 1;
    coachSay(`No, that's not ${q.word}. No ball this time!`);
    set({ throws, note: `✗ ${q.word} = ${SPORT_WORDS.find((w) => w[0] === q.word)?.[1] ?? ''}`, hoopsQ: throws < HOOPS_THROWS ? hoopsQuestion() : null });
    if (throws >= HOOPS_THROWS) {
      set({ phase: 'done' });
      coachSay(`Well done! You scored ${s.made} out of ${HOOPS_THROWS}.`);
      void finish('hoops', s.made);
    }
  },
  hitPP(k) {
    const s = get();
    const p = s.pp;
    if (s.game !== 'pingpong' || s.phase !== 'play' || !p || !p.call) return;
    const inTime = performance.now() - p.callAt <= p.window;
    if (k === p.call && inTime) {
      const hits = p.hits + 1;
      if (hits >= 3) return ppPoint(true);
      set({ pp: { ...p, call: null, hits } });
      later(450, ppCall);
      return;
    }
    ppPoint(false);
  },
}));

function startPingpong() {
  coachSay("Welcome to the sports hall! Listen: left, right, short or long. Hit the right button. First to seven wins!");
  useMini.setState({ pp: { me: 0, coach: 0, call: null, callAt: 0, window: 1800, hits: 0 } });
  later(3200, () => {
    useMini.setState({ phase: 'play' });
    ppCall();
  });
}
function ppCall() {
  const s = useMini.getState();
  if (s.game !== 'pingpong' || !s.pp) return;
  const c = PP_CALLS[Math.floor(Math.random() * PP_CALLS.length)]!;
  const window = Math.max(1000, 1900 - 70 * (s.pp.me + s.pp.coach));
  useMini.setState({ pp: { ...s.pp, call: c.key, callAt: performance.now(), window } });
  coachSay(c.call);
  // too slow: the coach wins the point
  const at = useMini.getState().pp!.callAt;
  later(window + 50, () => {
    const p = useMini.getState().pp;
    if (p && p.call && p.callAt === at) ppPoint(false);
  });
}
function ppPoint(won: boolean) {
  const s = useMini.getState();
  if (!s.pp) return;
  const me = s.pp.me + (won ? 1 : 0);
  const coach = s.pp.coach + (won ? 0 : 1);
  useMini.setState({ pp: { ...s.pp, me, coach, call: null, hits: 0 }, note: won ? 'Your point!' : 'Coach scores.' });
  if (won) haptic('light');
  if (me >= PP_TO || coach >= PP_TO) {
    useMini.setState({ phase: 'done' });
    coachSay(me > coach ? `Game! You win ${NUMBER[me]} – ${NUMBER[coach]}. Great table tennis!` : `Game to me, ${NUMBER[coach]} – ${NUMBER[me]}. Good try!`);
    void finish('pingpong', me);
    return;
  }
  coachSay(`${NUMBER[me]} – ${NUMBER[coach]}.`);
  later(1600, ppCall);
}

function startHoops() {
  const [x, z] = w(HOOP_SPOT_LOCAL);
  const [hx, hz] = w(HOOPS_LOCAL[0]!);
  teleportTo(x, z, Math.atan2(hx - x, hz - z));
  coachSay('Ten throws. Press throw when the marker is in the green!');
  later(1800, () => useMini.setState({ phase: 'play', meterT0: performance.now(), hoopsQ: hoopsQuestion() }));
}

function startRace() {
  const [x, z] = w({ x: RACE_START_LOCAL.x - 1, z: RACE_START_LOCAL.z });
  teleportTo(x, z, FRAME.yaw(Math.PI / 2));
  const say = (t: string, ms: number) => later(ms, () => coachSay(t));
  say('On your marks.', 600);
  say('Ready.', 1900);
  say('Steady.', 3000);
  later(4100, () => {
    // moved over the line before "Go!": a false start
    if (FRAME.toLocal(localPos.x, localPos.z)[0] > RACE_START_LOCAL.x + 0.2) {
      useMini.setState({ phase: 'done', note: 'False start!' });
      coachSay('False start! Wait for "Go!" and try again.');
      return;
    }
    coachSay('Go!');
    haptic('medium');
    useMini.setState({ phase: 'play', raceT0: performance.now() });
    poll = window.setInterval(() => {
      const [lx, lz] = FRAME.toLocal(localPos.x, localPos.z);
      const s = useMini.getState();
      const ms = performance.now() - s.raceT0;
      if (lx >= RACE_FINISH_X) {
        stopPoll();
        const raceMs = Math.round(ms);
        useMini.setState({ phase: 'done', raceMs });
        coachSay(`Finished! Your time is ${(raceMs / 1000).toFixed(1)} seconds.`);
        void finish('race', raceMs);
      } else if (ms > 45_000 || lz > TRACK.z1 + 4 || lz < TRACK.z0 - 4 || lx < TRACK.x0 - 3) {
        stopPoll();
        useMini.setState({ phase: 'done', note: 'You left the track.' });
        coachSay('You left the track. Try again!');
      }
    }, 50);
  });
}

// ---- Coach says ------------------------------------------------------------------------------------------------
const MOVES: Omit<CoachRound, 'says' | 't0' | 'ms' | 'done'>[] = [
  { text: 'jump', kind: 'jump' },
  { text: 'wave your hand', kind: 'emote', emote: 'wave' },
  { text: 'dance', kind: 'emote', emote: 'dance' },
  { text: 'give me a thumbs up', kind: 'emote', emote: 'thumbsup' },
  { text: 'nod your head', kind: 'emote', emote: 'yes' },
  { text: 'shake your head', kind: 'emote', emote: 'no' },
  { text: 'run to the red cone', kind: 'cone', cone: 'red' },
  { text: 'run to the blue cone', kind: 'cone', cone: 'blue' },
  { text: 'run to the yellow cone', kind: 'cone', cone: 'yellow' },
];

function startCoach() {
  const [x, z] = w(COACH_SPOT_LOCAL);
  teleportTo(x, z, FRAME.yaw(Math.PI));
  coachSay('Listen carefully! Only do it when I say "Coach says". Ready?');
  later(4200, () => nextRound());
}

function nextRound() {
  const s = useMini.getState();
  if (s.round >= COACH_ROUNDS) {
    useMini.setState({ phase: 'done', coachRound: null });
    coachSay(`Good job! You got ${s.correct} out of ${COACH_ROUNDS}.`);
    void finish('coach', s.correct);
    return;
  }
  const prev = s.coachRound;
  // never the same move twice in a row, and never the cone you are standing at
  const atCone = (c?: ConeColor) => {
    if (!c) return false;
    const [cx, cz] = w(CONES_LOCAL[c]);
    return Math.hypot(localPos.x - cx, localPos.z - cz) < 2;
  };
  const pool = MOVES.filter((m) => m.text !== prev?.text && !atCone(m.cone));
  const move = pool[Math.floor(Math.random() * pool.length)]!;
  const says = s.round < 2 || Math.random() > 0.3;
  const ms = Math.max(4000, 7000 - s.round * 400);
  const round: CoachRound = { ...move, says, t0: performance.now(), ms, done: null };
  const said = `${says ? 'Coach says, ' : ''}${move.text}!`;
  useMini.setState({ phase: 'play', round: s.round + 1, coachRound: { ...round, text: said[0]!.toUpperCase() + said.slice(1) } });
  coachSay(said);
  const startEmote = useGame.getState().emote;
  stopPoll();
  poll = window.setInterval(() => {
    const st = useMini.getState();
    const r = st.coachRound;
    if (!r || r.done !== null) return;
    const em = useGame.getState().emote;
    let did = false;
    if (r.kind === 'jump') did = localPos.y > 0.35;
    else if (r.kind === 'emote') did = !!em && em !== startEmote && em.name === r.emote;
    else if (r.kind === 'cone') {
      const [cx, cz] = w(CONES_LOCAL[r.cone!]);
      did = Math.hypot(localPos.x - cx, localPos.z - cz) < 1.3;
    }
    const over = performance.now() - r.t0 > r.ms;
    if (!did && !over) return;
    const right = r.says ? did : !did;
    stopPoll();
    useMini.setState({ coachRound: { ...r, done: right }, correct: st.correct + (right ? 1 : 0) });
    coachSay(right ? (r.says ? 'Well done!' : "Good! I didn't say Coach says!") : r.says ? 'Too slow!' : "Oops! I didn't say Coach says!");
    if (right) haptic('light');
    later(2200, nextRound);
  }, 100);
}
