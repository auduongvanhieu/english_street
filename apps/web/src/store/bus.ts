import { create } from 'zustand';
import type * as THREE from 'three';
import { serverNow, sendBus } from '../net/client';
import { track } from '../net/analytics';
import { useGame } from './game';
import { BUS_STOPS } from '../world/areas';
import { DOOR_DX, DOOR_Z, T_DOORS_OPEN, T_GONE, busPose, encodeBus, kerbPoint, nearestStop, nextSlot, slotT, stopX, type StopId } from '../world/bus';

/**
 * The local player's bus ride, played as a little script on top of LocalPlayer:
 * walk to the kerb → the shared bus pulls in → walk through the door (hidden inside) → ride off (screen fades,
 * "riding to…") → the bus pulls in at the destination → step off onto the pavement.
 * Other players see all of it through Player.bus (world/bus.ts).
 */
type Stage = 'board' | 'travel' | 'arrive';
export interface Ride {
  from: StopId;
  to: StopId;
  stage: Stage;
  depSlot: number;
  arrSlot: number;
}
interface BusStore {
  ride: Ride | null;
  /** 0…1 black overlay while travelling between stops */
  fade: number;
  set: (r: Ride | null) => void;
}
export const useBus = create<BusStore>((set) => ({ ride: null, fade: 0, set: (ride) => set({ ride }) }));

const STOP_NAME: Record<StopId, string> = {
  main: 'Main Street',
  zoo: 'Sunny Hills Zoo',
  farm: 'Green Valley Farm',
  supermarket: 'FreshWay Supermarket',
  restaurant: 'The Grand Garden Restaurant',
};
export const stopName = (id: StopId) => STOP_NAME[id];

let speak: (s: string) => void = () => undefined;
/** The bus driver's lines go through the area TTS helper (set by the UI to avoid an import cycle). */
export const setBusVoice = (f: (s: string) => void) => (speak = f);

/** Start a ride from the nearest stop (players far from it are moved to the kerb first). */
export function startRide(to: StopId, from: { x: number; z: number }): { teleport?: { x: number; z: number } } {
  const fromStop = nearestStop(from.x);
  if (fromStop === to) return {};
  const kerb = kerbPoint(stopX(fromStop));
  const far = Math.hypot(from.x - kerb.x, from.z - kerb.z) > 14;
  const ride: Ride = { from: fromStop, to, stage: 'board', depSlot: nextSlot(serverNow(), far ? 3200 : 2600), arrSlot: 0 };
  useBus.setState({ ride, fade: 0 });
  sendBus(encodeBus({ phase: 'd', stop: fromStop, slot: ride.depSlot }));
  track('bus_ride', { to, from: fromStop });
  speak(`Hop on! This bus goes to ${STOP_NAME[to]}.`);
  return far ? { teleport: kerb } : {};
}

/** Give up a ride before boarding (the player walked away). */
export function cancelRide() {
  if (!useBus.getState().ride) return;
  useBus.setState({ ride: null, fade: 0 });
  sendBus('');
}

const walkTo = (g: THREE.Object3D, x: number, z: number, speed: number, dt: number) => {
  const dx = x - g.position.x;
  const dz = z - g.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return false;
  const step = Math.min(d, speed * dt);
  g.position.x += (dx / d) * step;
  g.position.z += (dz / d) * step;
  g.rotation.y = Math.atan2(dx, dz);
  return true;
};

/**
 * One frame of the ride. Returns null when no ride is running (normal controls), otherwise what LocalPlayer
 * should do: the animation, whether the avatar is hidden, and whether the camera should snap.
 * `wantsToMove` = the player pressed a direction (cancels while still waiting at the kerb).
 */
export function busStep(g: THREE.Object3D, dt: number, wantsToMove: boolean): { anim: string; hidden: boolean; snap: boolean } | null {
  const st = useBus.getState();
  const r = st.ride;
  if (!r) return null;
  // left the street mid-ride (exit, disconnect): drop the ride instead of leaving a black screen
  if (!useGame.getState().sessionId) {
    useBus.setState({ ride: null, fade: 0 });
    return null;
  }
  const now = serverNow();
  if (r.stage === 'board') {
    const t = slotT(r.depSlot, now);
    const sx = stopX(r.from);
    if (t < 0.4) {
      if (wantsToMove && t < -0.5) {
        cancelRide();
        return null;
      }
      // wait on the kerb, facing the road
      const kerb = kerbPoint(sx);
      if (walkTo(g, kerb.x, kerb.z, 3.2, dt)) return { anim: 'walk', hidden: false, snap: false };
      g.rotation.y = Math.PI;
      return { anim: 'idle', hidden: false, snap: false };
    }
    if (t < 1.5) {
      const moving = walkTo(g, sx + DOOR_DX, DOOR_Z - 0.2, 2.6, dt);
      return { anim: moving ? 'walk' : 'idle', hidden: false, snap: false };
    }
    // inside: ride along with the bus (the camera follows), fade out as it leaves
    const p = busPose(r.from, r.depSlot, now);
    g.position.set(p.x + DOOR_DX, 0, p.z);
    g.rotation.y = -Math.PI / 2;
    const fade = Math.max(0, Math.min(1, (t - (T_GONE - 1.4)) / 0.8));
    if (fade !== st.fade) useBus.setState({ fade });
    if (t >= T_GONE - 0.5) {
      const arrSlot = nextSlot(now, 3200);
      useBus.setState({ ride: { ...r, stage: 'travel', arrSlot }, fade: 1 });
      sendBus(encodeBus({ phase: 'a', stop: r.to, slot: arrSlot }));
      const a = busPose(r.to, arrSlot, now);
      g.position.set(stopX(r.to) + DOOR_DX, 0, a.z);
      return { anim: 'idle', hidden: true, snap: true };
    }
    return { anim: 'idle', hidden: true, snap: false };
  }
  // travel + arrive: inside the arriving bus until the doors open, then step off
  const t = slotT(r.arrSlot, now);
  const p = busPose(r.to, r.arrSlot, now);
  if (r.stage === 'travel') {
    // black screen until the bus shows up, then fade in while it pulls in
    const fade = t < -2.6 ? 1 : Math.max(0, 1 - (t + 2.6) / 0.8);
    if (fade !== st.fade) useBus.setState({ fade });
    if (t >= -2.6) {
      useBus.setState({ ride: { ...r, stage: 'arrive' } });
      speak(`Next stop: ${STOP_NAME[r.to]}.`);
    }
    g.position.set(p.x + DOOR_DX, 0, p.z);
    return { anim: 'idle', hidden: true, snap: true };
  }
  if (st.fade > 0) useBus.setState({ fade: Math.max(0, 1 - (t + 2.6) / 0.8) });
  if (t < T_DOORS_OPEN + 0.3) {
    g.position.set(p.x + DOOR_DX, 0, p.z);
    g.rotation.y = 0;
    return { anim: 'idle', hidden: true, snap: false };
  }
  const kerb = kerbPoint(stopX(r.to));
  const moving = walkTo(g, kerb.x + 0.6, kerb.z + 0.2, 2.6, dt);
  if (!moving || t > 2.4) {
    useBus.setState({ ride: null, fade: 0 });
    sendBus('');
    return { anim: 'idle', hidden: false, snap: false };
  }
  return { anim: 'walk', hidden: false, snap: false };
}

/** The bus tag of every rider we know of, for drawing buses (local ride included). */
export function localBusTag(): string {
  const r = useBus.getState().ride;
  if (!r) return '';
  return r.stage === 'board' ? encodeBus({ phase: 'd', stop: r.from, slot: r.depSlot }) : encodeBus({ phase: 'a', stop: r.to, slot: r.arrSlot });
}
export { BUS_STOPS };
