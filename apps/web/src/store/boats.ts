import { create } from 'zustand';
import * as THREE from 'three';
import { BOAT_AREA, BOAT_MAX_SPEED, BOAT_SEATS, FERRY, PIERS, WATER_Y, ferryPose, type BoatKind, type BoatSeat, type Pier } from '@es/shared';
import { boatStates, getRoom, onBoatEvent, onBoatState, sendBoat, serverNow } from '../net/client';
import { fetchBoat, hireBoat } from '../net/api';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { localPos, teleportTo } from '../scene/LocalPlayer';
import { t } from '../i18n';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * River boats (client): hiring at the kiosk, getting in / out of a boat (rower or passenger), steering it, and
 * riding the ferry. LocalPlayer calls boatStep() every frame: while it returns a pose, the boat moves the player.
 */
/** How low the body sits: the sitting pose puts the seat of the trousers this far above the root. */
const SIT_H = 0.42;

interface BoatStore {
  until: number;
  price: number;
  minutes: number;
  free: boolean;
  loaded: boolean;
  panel: 'hire' | null;
  error: string | null;
  notice: string | null;
  /** the boat I am in */
  mine: { id: string; seat: BoatSeat } | null;
  /** riding the ferry: where I got on, my spot on the deck */
  ferry: { from: 'north' | 'south'; dx: number; dz: number } | null;
  /** occupancy, for the usables */
  seats: Record<string, { driver: string; passenger: string }>;
  load: () => Promise<void>;
  open: (p: 'hire' | null) => void;
  hire: () => Promise<boolean>;
  board: (id: string, seat: BoatSeat) => void;
  leave: () => void;
  boardFerry: () => void;
  setNotice: (n: string | null) => void;
}

export const boatSay = (text: string) => useVoice.getState().speakAs('boat', text, 'en-US');
let noticeTimer: number | null = null;

export const useBoats = create<BoatStore>((set, get) => ({
  until: 0,
  price: 3,
  minutes: 10,
  free: true,
  loaded: false,
  panel: null,
  error: null,
  notice: null,
  mine: null,
  ferry: null,
  seats: {},
  async load() {
    try {
      const r = await fetchBoat();
      set({ until: r.until, price: r.price, minutes: r.minutes, free: r.free, loaded: true });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  open(panel) {
    set({ panel, error: null });
    if (panel) void get().load();
  },
  async hire() {
    try {
      const r = await hireBoat();
      set({ until: r.until, free: false, error: null });
      void useProfile.getState().refresh();
      track('boat_hire', { free: r.free });
      return true;
    } catch (e) {
      set({ error: (e as Error).message });
      return false;
    }
  },
  board(id, seat) {
    const b = boatStates.get(id);
    if (!b) return;
    if (seat === 'driver' && get().until < Date.now()) {
      get().setNotice(t('Hire a boat at the kiosk first.'));
      return;
    }
    sendBoat({ op: 'board', id, seat });
    set({ mine: { id, seat } });
    pred.id = '';
    haptic('light');
    track('boat_board', { seat, kind: b.kind });
  },
  leave() {
    const m = get().mine;
    if (!m) return;
    sendBoat({ op: 'leave' });
    set({ mine: null });
    // step onto the nearest pier deck
    const p = nearestPier(localPos.x, localPos.z);
    const z = Math.max(p.minZ + 0.6, Math.min(p.maxZ - 0.6, localPos.z));
    teleportTo(p.x, z, p.out > 0 ? Math.PI : 0);
  },
  boardFerry() {
    const f = ferryPose(serverNow());
    if (f.stage !== 'north' && f.stage !== 'south') return;
    // a free spot on the deck strip (|x| < 0.7, along the middle)
    set({ ferry: { from: f.stage, dx: (Math.random() - 0.5) * 1.2, dz: (Math.random() - 0.5) * 4 } });
    boatSay(f.leavesIn > 5 ? `Welcome aboard! We leave in ${Math.round(f.leavesIn)} seconds.` : 'Welcome aboard! We are leaving now.');
    track('ferry_board', { from: f.stage });
  },
  setNotice(notice) {
    set({ notice });
    if (noticeTimer) window.clearTimeout(noticeTimer);
    if (notice) noticeTimer = window.setTimeout(() => set({ notice: null }), 4500);
  },
}));

export function nearestPier(x: number, z: number): Pier {
  let best: Pier = PIERS.boatN;
  let bd = Infinity;
  for (const p of Object.values(PIERS)) {
    const dx = Math.max(p.minX - x, 0, x - p.maxX);
    const dz = Math.max(p.minZ - z, 0, z - p.maxZ);
    const d = Math.hypot(dx, dz);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}
/** Distance from (x, z) to the nearest pier deck. */
export function pierDistance(x: number, z: number) {
  const p = nearestPier(x, z);
  return Math.hypot(Math.max(p.minX - x, 0, x - p.maxX), Math.max(p.minZ - z, 0, z - p.maxZ));
}

/** Local prediction of the boat I am rowing. */
const pred = { id: '', x: 0, z: 0, rot: 0, v: 0, turn: 0, send: 0, oar: 0 };
/** Rowing stroke phase (read by the oars), 0 when resting. */
export const rowing = { phase: 0, power: 0 };
const smooth = new THREE.Vector3();

function seatWorld(kind: BoatKind, seat: BoatSeat, x: number, z: number, rot: number) {
  const s = BOAT_SEATS[kind][seat];
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  return { x: x + s.x * c + s.z * sn, z: z - s.x * sn + s.z * c, y: WATER_Y + s.y - SIT_H };
}

/** Would a boat at (x, z) hit a pier or the bank? */
function blocked(x: number, z: number) {
  if (x < BOAT_AREA.minX || x > BOAT_AREA.maxX || z < BOAT_AREA.minZ || z > BOAT_AREA.maxZ) return true;
  for (const p of Object.values(PIERS)) if (x > p.minX - 0.55 && x < p.maxX + 0.55 && z > p.minZ - 0.6 && z < p.maxZ + 0.6) return true;
  return false;
}

/**
 * Called by LocalPlayer every frame. `ix` / `iz`: raw input (iz < 0 = forward). Returns where the player is (seated
 * or standing on the ferry) or null when not in a boat.
 */
export function boatStep(dt: number, ix: number, iz: number): { x: number; y: number; z: number; rot: number; anim: string } | null {
  const st = useBoats.getState();
  // ---- the ferry ----
  if (st.ferry) {
    const f = ferryPose(serverNow());
    const arrived = (st.ferry.from === 'north' && f.stage === 'south') || (st.ferry.from === 'south' && f.stage === 'north');
    if (arrived) {
      const p = f.stage === 'south' ? PIERS.ferryS : PIERS.ferryN;
      useBoats.setState({ ferry: null });
      boatSay(f.stage === 'south' ? 'We have arrived on the south bank. Mind your step!' : 'We have arrived on the north bank. Mind your step!');
      teleportTo(p.x, p.tipZ - p.out * 1.2, p.out > 0 ? Math.PI : 0);
      return null;
    }
    const c = Math.cos(f.rot);
    const s = Math.sin(f.rot);
    const { dx, dz } = st.ferry;
    return { x: f.x + dx * c + dz * s, z: f.z - dx * s + dz * c, y: WATER_Y + FERRY.deckY, rot: f.rot, anim: 'idle' };
  }
  // ---- a hired boat ----
  const m = st.mine;
  if (!m) return null;
  const b = boatStates.get(m.id);
  const sid = getRoom()?.sessionId;
  if (!b || !sid) {
    useBoats.setState({ mine: null });
    return null;
  }
  const kind = (b.kind === 'duck' ? 'duck' : 'row') as BoatKind;
  const driving = b.driver === sid;
  if (!driving && b.passenger !== sid) {
    // not (yet) confirmed by the server: wait a moment, give up if the seat went to someone else
    if (m.seat === 'driver' ? b.driver && b.driver !== sid : b.passenger && b.passenger !== sid) {
      useBoats.setState({ mine: null });
      useBoats.getState().setNotice(t('Someone else took that seat.'));
      return null;
    }
  }
  if (driving || m.seat === 'driver') {
    if (pred.id !== m.id) Object.assign(pred, { id: m.id, x: b.x, z: b.z, rot: b.rot, v: 0, turn: 0, send: 0 });
    // hire over: back to the pier
    if (useBoats.getState().until < Date.now() && pierDistance(pred.x, pred.z) < 4) {
      useBoats.getState().setNotice(t('Your boat time is over. Please bring the boat back.'));
    }
    const want = -iz * BOAT_MAX_SPEED * (kind === 'duck' ? 0.8 : 1);
    pred.v += (want - pred.v) * Math.min(1, dt * (Math.abs(want) > Math.abs(pred.v) ? 1.2 : 0.7));
    pred.turn += (-ix * 1.1 - pred.turn) * Math.min(1, dt * 3);
    pred.rot += pred.turn * dt * (0.4 + Math.min(1, Math.abs(pred.v) / 1.2) * 0.6);
    const nx = pred.x + Math.sin(pred.rot) * pred.v * dt;
    const nz = pred.z + Math.cos(pred.rot) * pred.v * dt;
    if (!blocked(nx, nz)) {
      pred.x = nx;
      pred.z = nz;
    } else pred.v *= -0.2; // bump
    rowing.power = Math.min(1, Math.abs(pred.v) / BOAT_MAX_SPEED + Math.abs(pred.turn) * 0.3);
    rowing.phase += dt * (1.6 + rowing.power * 1.2) * (rowing.power > 0.05 ? 1 : 0);
    b.x = pred.x;
    b.z = pred.z;
    b.rot = pred.rot;
    b.at = performance.now();
    pred.send += dt;
    if (pred.send > 0.1) {
      pred.send = 0;
      sendBoat({ op: 'move', x: pred.x, z: pred.z, rot: pred.rot });
    }
    const p = seatWorld(kind, 'driver', pred.x, pred.z, pred.rot);
    return { ...p, rot: pred.rot, anim: 'sit' };
  }
  // passenger: follow the boat smoothly
  smooth.set(smooth.x + (b.x - smooth.x) * Math.min(1, dt * 10), 0, smooth.z + (b.z - smooth.z) * Math.min(1, dt * 10));
  if (Math.hypot(b.x - smooth.x, b.z - smooth.z) > 3) smooth.set(b.x, 0, b.z);
  const p = seatWorld(kind, 'passenger', smooth.x, smooth.z, b.rot);
  return { ...p, rot: b.rot, anim: 'sit' };
}

export function initBoats() {
  const offState = onBoatState((id, b) => {
    useBoats.setState((s) => {
      const seats = { ...s.seats };
      if (b) seats[id] = { driver: b.driver, passenger: b.passenger };
      else delete seats[id];
      return { seats };
    });
    // my boat: the rower left and I was the passenger -> I take the oars (server swaps us)
    const m = useBoats.getState().mine;
    const sid = getRoom()?.sessionId;
    if (m && m.id === id && b && sid) {
      if (m.seat === 'passenger' && b.driver === sid) {
        useBoats.setState({ mine: { id, seat: 'driver' } });
        pred.id = '';
        useBoats.getState().setNotice(t('You have the oars now.'));
      }
    }
  });
  const offEv = onBoatEvent((m) => {
    if (m.op === 'denied') {
      useBoats.setState({ mine: null });
      useBoats.getState().setNotice(m.reason === 'taken' ? t('Someone else took that seat.') : m.reason === 'far' ? t('Walk closer to the boat.') : t('The boat needs someone to row it first.'));
    }
  });
  return () => {
    offState();
    offEv();
  };
}

/** A teleport (map, bus, lift…) far from my boat / the ferry takes me out of it. */
export function boatTeleported(x: number, z: number) {
  const s = useBoats.getState();
  if (s.mine) {
    const b = boatStates.get(s.mine.id);
    if (!b || Math.hypot(b.x - x, b.z - z) > 5) {
      sendBoat({ op: 'leave' });
      useBoats.setState({ mine: null });
    }
  }
  if (s.ferry) {
    const f = ferryPose(serverNow());
    if (Math.hypot(f.x - x, f.z - z) > 8) useBoats.setState({ ferry: null });
  }
}
