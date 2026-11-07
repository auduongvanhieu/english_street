import { create } from 'zustand';
import { reportMinigame, type MinigameResult } from '../net/api';
import { sendProp, serverNow } from '../net/client';
import { track } from '../net/analytics';
import { teleportTo } from '../scene/LocalPlayer';
import { setCarrier } from '../world/carry';
import { CC_ROT, cabinAt, cabinPose, ccPlatform } from '../world/mapleHill';
import { BOAT, BRIDGE, MILL, RIVER } from '../world/riverside';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * Rides at the trip places, each with a guide talking on the way and three questions at the end:
 *  - the Maple Hill cable car (shared cabins on the server clock, world/mapleHill.ts): comparatives and superlatives;
 *  - the Riverside boat trip (your own boat, rowed by Sam): prepositions of movement (under, past, along, around).
 * Rewards: minigames 'cablecar' and 'boattrip'.
 */
export interface RideQ {
  q: string;
  options: string[];
  answer: number;
}
const shuffleQ = (q: { q: string; right: string; wrong: string[] }): RideQ => {
  const options = [q.right, ...q.wrong].sort(() => Math.random() - 0.5);
  return { q: q.q, options, answer: options.indexOf(q.right) };
};
export const TICKET_LINES = ['A return ticket to the top, please.', 'A return ticket to the top, pleased.', 'One ticket top return give.'];
const CC_TALK_UP: [number, string][] = [
  [0.08, "Welcome aboard! We're going up to the top of Maple Hill. Hold on!"],
  [0.3, "Look down! That's the lake. It's bigger than the pond in the park."],
  [0.52, "We're passing the pylon. Now we're higher than the tallest tree on the hill!"],
  [0.72, 'Can you see the campsite? The tents look very small from up here.'],
  [0.92, "Here we are! The summit is the highest place in Maple Hill. Enjoy the view!"],
];
const CC_TALK_DOWN: [number, string][] = [
  [0.08, "We're going down now. It's quicker than walking!"],
  [0.5, 'Look at the meadow. It gets bigger and bigger as we go down.'],
  [0.92, 'Here we are at the bottom. Thank you for riding with us!'],
];
const CC_QS = [
  { q: 'The lake is … than the pond in the park.', right: 'bigger', wrong: ['big', 'biggest'] },
  { q: 'The summit is the … place in Maple Hill.', right: 'highest', wrong: ['higher', 'high'] },
  { q: 'From up there, the tents look very …', right: 'small', wrong: ['smaller', 'smallest'] },
  { q: 'Going down in the cable car is … than walking.', right: 'quicker', wrong: ['quick', 'quickest'] },
];

/** The boat trip path (river centre line): west past the mill, back east under the bridge, back to the jetty. */
const RZ = (RIVER.z0 + RIVER.z1) / 2;
const TRIP: { x: number; z: number }[] = [
  { x: BOAT.x, z: BOAT.z },
  { x: -10, z: RZ },
  { x: -42, z: RZ + 1.5 },
  { x: -46, z: RZ },
  { x: -40, z: RZ - 1.5 },
  { x: 0, z: RZ - 1 },
  { x: 44, z: RZ },
  { x: 48, z: RZ + 1.5 },
  { x: 42, z: RZ + 2.5 },
  { x: BOAT.x + 4, z: BOAT.z },
  { x: BOAT.x, z: BOAT.z },
];
const TRIP_SPEED = 2.4;
const BOAT_TALK: { at: (x: number, leg: number) => boolean; text: string }[] = [
  { at: (_x, leg) => leg === 0, text: "Hello! I'm Sam. Sit down and hold on. We're going along the river." },
  { at: (x, leg) => leg >= 1 && leg <= 2 && x < MILL.x + 6, text: "We're going past the old mill. Can you see the water wheel?" },
  { at: (_x, leg) => leg === 3, text: "Now we're going around the bend and back again." },
  { at: (x, leg) => leg === 5 && x > -15, text: 'Look! The ducks are swimming next to the boat.' },
  { at: (x, leg) => leg === 5 && x > BRIDGE.x - 8, text: "Mind your head! We're going under the bridge." },
  { at: (_x, leg) => leg === 7, text: "We're turning around now, and going back to the jetty." },
];
const BOAT_QS = [
  { q: 'What did the boat go under?', right: 'the bridge', wrong: ['the mill', 'the market'] },
  { q: 'What did you go past?', right: 'the old mill', wrong: ['the station', 'the museum'] },
  { q: 'Where were the ducks?', right: 'next to the boat', wrong: ['on the bridge', 'in the mill'] },
  { q: 'Where did the trip start and end?', right: 'at the jetty', wrong: ['at the station', 'under the bridge'] },
];

interface Quiz {
  qs: RideQ[];
  picked: (number | null)[];
  result: MinigameResult | null;
}
interface TripRides {
  cable: {
    stage: 'ticket' | 'wait' | 'ride' | 'quiz';
    from: 'bottom' | 'top';
    lines: string[];
    miss: string | null;
    cabin: number;
    said: number;
    quiz: Quiz | null;
  } | null;
  boat: { stage: 'ride' | 'quiz'; said: number[]; quiz: Quiz | null } | null;
  openCable: (from: 'bottom' | 'top') => void;
  sayTicket: (line: string) => void;
  answerCable: (i: number, k: number) => void;
  closeCable: () => void;
  startBoat: () => void;
  answerBoat: (i: number, k: number) => void;
  closeBoat: () => void;
}

const guide = (t: string) => useVoice.getState().speakAs('cable-guide', t, 'en-CA');
const sam = (t: string) => useVoice.getState().speakAs('boatman', t, 'en-GB');
const pickQs = (pool: typeof CC_QS) => [...pool].sort(() => Math.random() - 0.5).slice(0, 3).map(shuffleQ);

/* ------------------------------------------------------------------------------------- cable car carrier */
let ccTimer = 0;
function cableCarrier() {
  const c = useTripRides.getState().cable;
  if (!c || c.stage !== 'ride') return null;
  const now = serverNow();
  const p = cabinPose(c.cabin, now);
  const st = cabinAt(c.cabin, now);
  // the guide talks on the way
  const talk = c.from === 'bottom' ? CC_TALK_UP : CC_TALK_DOWN;
  const prog = c.from === 'bottom' ? st.s : 1 - st.s;
  const next = talk[c.said];
  if (next && prog >= next[0] && (st.going || st.at !== c.from)) {
    useTripRides.setState({ cable: { ...c, said: c.said + 1 } });
    guide(next[1]);
  }
  // arrived at the other end: step off onto the platform
  if (st.at && st.at !== c.from) {
    window.setTimeout(() => arrive(st.at!), 0);
    return null;
  }
  return { x: p.x, y: p.y, z: p.z, rot: CC_ROT + Math.PI, anim: 'idle' };
}
function arrive(end: 'bottom' | 'top') {
  const c = useTripRides.getState().cable;
  if (!c || c.stage !== 'ride') return;
  setCarrier(null);
  const p = ccPlatform(end);
  teleportTo(p.x, p.z, end === 'bottom' ? CC_ROT : CC_ROT + Math.PI);
  useTripRides.setState({ cable: { ...c, stage: 'quiz', quiz: { qs: pickQs(c.from === 'bottom' ? CC_QS.slice(0, 3) : CC_QS), picked: [null, null, null], result: null } } });
  track('cablecar_ride', { from: c.from });
}

/* -------------------------------------------------------------------------------------- boat trip carrier */
const trip = { leg: 0, x: BOAT.x, z: BOAT.z, rot: 0, last: 0 };
function boatCarrier() {
  const b = useTripRides.getState().boat;
  if (!b || b.stage !== 'ride') return null;
  const now = performance.now();
  const dt = Math.min(0.5, (now - trip.last) / 1000);
  trip.last = now;
  let step = TRIP_SPEED * dt;
  while (step > 0 && trip.leg < TRIP.length - 1) {
    const to = TRIP[trip.leg + 1]!;
    const d = Math.hypot(to.x - trip.x, to.z - trip.z);
    if (d <= step) {
      trip.x = to.x;
      trip.z = to.z;
      trip.leg++;
      step -= d;
    } else {
      trip.x += ((to.x - trip.x) / d) * step;
      trip.z += ((to.z - trip.z) / d) * step;
      const want = Math.atan2(to.x - trip.x, to.z - trip.z);
      let dr = want - trip.rot;
      while (dr > Math.PI) dr -= 2 * Math.PI;
      while (dr < -Math.PI) dr += 2 * Math.PI;
      trip.rot += dr * Math.min(1, dt * 2);
      step = 0;
    }
  }
  BOAT_TALK.forEach((k, i) => {
    if (!b.said.includes(i) && k.at(trip.x, trip.leg)) {
      b.said.push(i);
      sam(k.text);
    }
  });
  if (trip.leg >= TRIP.length - 1) {
    window.setTimeout(endBoat, 0);
    return null;
  }
  // y: the sitting rider (lifted 0.3 by the avatar) on the passenger seat (0.24 above the waterline at 0.03)
  return { x: trip.x, y: -0.09, z: trip.z, rot: trip.rot, anim: 'sit' };
}
/** The boat while a trip is on (for drawing Sam at the oars), else null. */
export const tripBoat = () => (useTripRides.getState().boat?.stage === 'ride' ? trip : null);
function endBoat() {
  const b = useTripRides.getState().boat;
  if (!b || b.stage !== 'ride') return;
  setCarrier(null);
  sendProp('');
  teleportTo(BOAT.x, RIVER.z1 + 2, 0);
  sam('Here we are, back at the jetty. Did you enjoy the trip?');
  useTripRides.setState({ boat: { ...b, stage: 'quiz', quiz: { qs: pickQs(BOAT_QS), picked: [null, null, null], result: null } } });
  track('boattrip_ride');
}

const answer = (q: Quiz, i: number, k: number, game: 'cablecar' | 'boattrip', save: (q: Quiz) => void) => {
  if (q.picked[i] !== null) return;
  const picked = q.picked.map((p, j) => (j === i ? k : p));
  save({ ...q, picked });
  if (picked.some((p) => p === null)) return;
  const score = picked.filter((p, j) => p === q.qs[j]!.answer).length;
  track(`${game}_quiz`, { score });
  void reportMinigame(game, { score })
    .then((result) => {
      save({ ...q, picked, result });
      void useProfile.getState().refresh();
    })
    .catch(() => undefined);
};

export const useTripRides = create<TripRides>((set, get) => ({
  cable: null,
  boat: null,
  openCable(from) {
    set({ cable: { stage: 'ticket', from, lines: [...TICKET_LINES].sort(() => Math.random() - 0.5), miss: null, cabin: 0, said: 0, quiz: null } });
    guide(from === 'bottom' ? 'Hello! Would you like to go up to the summit?' : 'Hello! Would you like to go back down to the meadow?');
  },
  sayTicket(line) {
    const c = get().cable;
    if (!c || c.stage !== 'ticket') return;
    if (line !== TICKET_LINES[0]) return set({ cable: { ...c, miss: line } });
    useVoice.getState().speakAs('me', line, 'en-US');
    set({ cable: { ...c, stage: 'wait', miss: null } });
    track('cablecar_ticket');
    // wait on the platform for a cabin at this station, then step in
    const poll = () => {
      const cur = get().cable;
      if (!cur || cur.stage !== 'wait') return;
      const now = serverNow();
      const cabin = [0, 1].find((k) => {
        const st = cabinAt(k, now);
        return st.at === cur.from && st.leftIn > 2.5;
      });
      if (cabin === undefined) {
        ccTimer = window.setTimeout(poll, 500);
        return;
      }
      set({ cable: { ...cur, stage: 'ride', cabin, said: 0 } });
      setCarrier(cableCarrier);
      guide('Please step in. Mind the gap!');
    };
    window.setTimeout(() => guide("Here's your ticket. The next cabin is coming."), 1400);
    poll();
  },
  answerCable(i, k) {
    const c = get().cable;
    if (!c?.quiz) return;
    answer(c.quiz, i, k, 'cablecar', (quiz) => {
      const cur = get().cable;
      if (cur) set({ cable: { ...cur, quiz } });
    });
  },
  closeCable() {
    window.clearTimeout(ccTimer);
    const c = get().cable;
    if (c?.stage === 'ride') {
      setCarrier(null);
      const p = ccPlatform(c.from);
      teleportTo(p.x, p.z, 0);
    }
    set({ cable: null });
  },
  startBoat() {
    Object.assign(trip, { leg: 0, x: BOAT.x, z: BOAT.z, rot: -Math.PI / 2, last: performance.now() });
    set({ boat: { stage: 'ride', said: [], quiz: null } });
    sendProp('ride:rowboat');
    setCarrier(boatCarrier);
    track('boattrip_start');
  },
  answerBoat(i, k) {
    const b = get().boat;
    if (!b?.quiz) return;
    answer(b.quiz, i, k, 'boattrip', (quiz) => {
      const cur = get().boat;
      if (cur) set({ boat: { ...cur, quiz } });
    });
  },
  closeBoat() {
    const b = get().boat;
    if (b?.stage === 'ride') {
      setCarrier(null);
      sendProp('');
      teleportTo(BOAT.x, RIVER.z1 + 2, 0);
    }
    set({ boat: null });
  },
}));
