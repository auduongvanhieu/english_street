import { create } from 'zustand';
import { TRAIN_CAR, inRect, trainCarRect } from '@es/shared';
import { serverNow } from '../net/client';
import { reportMinigame, type MinigameResult } from '../net/api';
import { track } from '../net/analytics';
import { chimeSound } from '../audio/ambient';
import { teleportTo, localPos } from '../scene/LocalPlayer';
import { useProfile } from './profile';
import { useSeat } from './seat';
import { useSettings } from './settings';
import { useVoice } from './voice';
import { FRAME, JOURNEY_MIN, TRAIN_SLOT_MS, fmtTime, service, type TrainService } from '../world/places/station';
import { RIDE, carSpot } from '../world/train';

/**
 * Riding the train: buy a ticket at the machine (where to? single or return?), board while the doors are open, ride
 * in the carriage (announcements, the ticket inspector), stop at the destination, come back and step off on
 * platform 1. Everybody on the same train shares the carriage; the script runs on the shared clock.
 */
export interface Ticket {
  dest: TrainService['dest'];
  type: 'single' | 'return';
}
export interface Ride {
  slot: number;
  dest: TrainService['dest'];
  /** real departure (timetable + delay), ms on the server clock */
  dep: number;
  /** announcements already made (keys of RIDE plus 'board', 'doors') */
  said: string[];
  check: null | { ok: number; text: string };
  result: MinigameResult | null;
  done: boolean;
}
export type MachineStep = 'dest' | 'type' | 'done';

interface TrainStore {
  ticket: Ticket | null;
  machine: { step: MachineStep; dest: TrainService['dest'] | null } | null;
  ride: Ride | null;
  /** caption of the last announcement / inspector line */
  caption: { who: 'pa' | 'inspector'; text: string; at: number } | null;
  /** the inspector is asking: show the ticket card */
  asking: boolean;
  openMachine: () => void;
  machineDest: (d: TrainService['dest']) => void;
  machineType: (t: 'single' | 'return') => void;
  closeMachine: () => void;
  board: (slot: number) => void;
  showTicket: () => void;
  leave: () => void;
}

const pa = (text: string) => {
  chimeSound(Math.max(0.3, useSettings.getState().ambientVolume));
  window.setTimeout(() => useVoice.getState().speakAs('train-pa', text, 'en-GB'), 900);
  useTrain.setState({ caption: { who: 'pa', text, at: Date.now() } });
};
const inspector = (text: string) => {
  useVoice.getState().speakAs('inspector', text, 'en-GB');
  useTrain.setState({ caption: { who: 'inspector', text, at: Date.now() } });
};
/** Platform 1, by the middle doors (where you step off). */
const platformSpot = () => {
  const [x, z] = FRAME.toWorld((Math.random() - 0.5) * 6, -14.2);
  return { x, z };
};
export const departureOf = (slot: number) => {
  const s = service(slot);
  return { s, dep: s.dep + Math.max(0, s.delay) * 60_000 };
};

export const useTrain = create<TrainStore>((set, get) => ({
  ticket: null,
  machine: null,
  ride: null,
  caption: null,
  asking: false,
  openMachine: () => set({ machine: { step: 'dest', dest: null } }),
  machineDest: (dest) => set({ machine: { step: 'type', dest } }),
  machineType(type) {
    const m = get().machine;
    if (!m?.dest) return;
    set({ ticket: { dest: m.dest, type }, machine: { ...m, step: 'done' } });
    track('station_ticket_buy', { dest: m.dest, type });
  },
  closeMachine: () => set({ machine: null }),
  board(slot) {
    if (get().ride) return;
    const { s, dep } = departureOf(slot);
    useSeat.getState().stand();
    const sp = carSpot((Math.random() - 0.5) * 4);
    teleportTo(sp.x, sp.z, Math.PI / 2);
    set({ ride: { slot, dest: s.dest, dep, said: [], check: null, result: null, done: false }, asking: false, machine: null });
    track('station_board', { dest: s.dest, ticket: !!get().ticket });
    pa(`This is the ${fmtTime(s.dep)} service to ${s.dest}. Please find a seat. Mind the gap.`);
    get().ride!.said.push('board');
  },
  showTicket() {
    const r = get().ride;
    if (!r || r.check) return;
    const tk = get().ticket;
    let ok = 0;
    let text: string;
    if (!tk) text = `You need a ticket to travel on this train. Please buy one at the machine next time. A return to ${r.dest} costs seven dollars.`;
    else if (tk.dest !== r.dest) text = `Hmm, this ticket is for ${tk.dest}, but this train goes to ${r.dest}. Always check the departures board!`;
    else if (tk.type === 'single') {
      ok = 1;
      text = `This is a single ticket to ${r.dest}. You are coming back with us, so you need a return. I'll change it for you this time.`;
    } else {
      ok = 2;
      text = `A return to ${r.dest}. That's fine, thank you. Enjoy your journey!`;
    }
    inspector(text);
    set({ ride: { ...r, check: { ok, text } }, asking: false });
    track('station_ticket_check', { ok });
  },
  leave() {
    const r = get().ride;
    set({ ride: null, asking: false, caption: null });
    if (r && inRect(trainCarRect(0.5), localPos.x, localPos.z)) {
      useSeat.getState().stand();
      const p = platformSpot();
      teleportTo(p.x, p.z, 0);
    }
  },
}));

/** Ride script, called a few times a second by the carriage scene. */
export function rideTick() {
  const st = useTrain.getState();
  const r = st.ride;
  if (!r) return;
  const now = serverNow();
  const t = (now - r.dep) / 1000;
  // left the carriage some other way (map, bus…): the ride is over
  if (t > 1 && !inRect(trainCarRect(1), localPos.x, localPos.z) && !r.done) {
    useTrain.setState({ ride: null, asking: false });
    return;
  }
  const once = (key: string, at: number, f: () => void) => {
    if (t >= at && !r.said.includes(key)) {
      r.said.push(key);
      f();
    }
  };
  const arrive = fmtTime(r.dep + JOURNEY_MIN[r.dest] * 60_000);
  once('doors', -3, () => pa('Please stand clear of the closing doors.'));
  once('welcome', RIDE.welcome, () => pa(`Welcome aboard this train to ${r.dest}. We will arrive in ${r.dest} at ${arrive}.`));
  once('inspect', RIDE.inspect, () => {
    inspector('Tickets, please!');
    useTrain.setState({ asking: true });
  });
  // nobody answered the inspector: he checks anyway
  once('inspect2', RIDE.inspect + 12, () => {
    if (!useTrain.getState().ride?.check) useTrain.getState().showTicket();
  });
  once('approach', RIDE.approach, () => pa(`We are now approaching ${r.dest}. Please take all your belongings with you.`));
  once('arrive', RIDE.arrive, () => pa(`This is ${r.dest}. This train returns to English Street Central in a few moments.`));
  once('leaveDest', RIDE.leaveDest, () => pa('This train is for English Street Central. Please stand clear of the doors.'));
  once('homeSoon', RIDE.homeSoon, () => pa('We will shortly arrive at English Street Central. Mind the gap when you leave the train.'));
  once('home', RIDE.home, () => {
    const check = useTrain.getState().ride?.check;
    const score = check?.ok ?? 0;
    track('station_train_ride', { dest: r.dest, score });
    useTrain.setState({ ticket: null, ride: { ...useTrain.getState().ride!, done: true } });
    void reportMinigame('train', { score })
      .then((result) => {
        const cur = useTrain.getState().ride;
        if (cur && cur.slot === r.slot) useTrain.setState({ ride: { ...cur, result } });
        void useProfile.getState().refresh();
      })
      .catch(() => undefined);
    useSeat.getState().stand();
    const p = platformSpot();
    teleportTo(p.x, p.z, 0);
  });
  // the result card stays a little after stepping off
  if (t > RIDE.home + 12) useTrain.setState({ ride: null, caption: null });
}

/** Someone reloading inside the carriage without a ride: put them back on the platform. */
export function strandedCheck() {
  if (useTrain.getState().ride) return;
  if (inRect(trainCarRect(0.5), localPos.x, localPos.z)) {
    const p = platformSpot();
    teleportTo(p.x, p.z, 0);
  }
}

export const trainSlotNow = () => Math.floor(serverNow() / TRAIN_SLOT_MS);
export { TRAIN_CAR };
