import { create } from 'zustand';
import { FURNITURE_MAX, MY_ROOM, MY_ROOM_SLOTS, footprint, furniture, myRoom, myRoomSlot, type Placed, type Rect } from '@es/shared';
import { get, post } from '../net/api';
import { getPlayerId } from '../net/player';
import { track } from '../net/analytics';
import { localPos, teleportTo } from '../scene/LocalPlayer';
import { registerBlockers } from '../world/layout';
import { FRAME as HOME_FRAME } from '../world/places/home';
import { useProfile } from './profile';
import { useVoice } from './voice';

/**
 * "My room" (@es/shared home.ts): your own room off the map. Buy furniture, carry a piece (a ghost in front of you),
 * turn it and put it down; move or put away what is there. Friends can visit (read-only).
 */
interface Ghost {
  id: string;
  r: number;
  /** room-local position the piece would go to (updated by the scene each frame) */
  x: number;
  z: number;
  ok: boolean;
}
interface MyRoomStore {
  /** whose room is shown: my id, a friend's id, or null (not in a room) */
  owner: string | null;
  ownerName: string;
  slot: number;
  items: Placed[];
  owned: Record<string, number>;
  ghost: Ghost | null;
  panel: 'shop' | 'bag' | null;
  note: string | null;
  enter: () => Promise<void>;
  visit: (id: string) => Promise<void>;
  leave: () => void;
  setPanel: (p: 'shop' | 'bag' | null) => void;
  buy: (id: string) => Promise<void>;
  carry: (id: string) => void;
  pickUp: (index: number) => void;
  rotate: () => void;
  place: () => void;
  putAway: () => void;
  cancel: () => void;
}

const say = (t: string) => useVoice.getState().speakAs('me', t, 'en-US');
const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const save = (items: Placed[]) => post<{ items: Placed[] }>(`/me/room/save?playerId=${encodeURIComponent(getPlayerId())}`, { playerId: getPlayerId(), items }).catch(() => undefined);
const isMine = () => useMyRoom.getState().owner === getPlayerId();

export const useMyRoom = create<MyRoomStore>((set, getS) => ({
  owner: null,
  ownerName: '',
  slot: -1,
  items: [],
  owned: {},
  ghost: null,
  panel: null,
  note: null,
  async enter() {
    const id = getPlayerId();
    const slot = myRoomSlot(id);
    const r = myRoom(slot);
    set({ owner: id, ownerName: useProfile.getState().profile?.name ?? '', slot, ghost: null, panel: null, note: null });
    teleportTo(r.entry.x, r.entry.z, Math.PI);
    track('home_room_enter');
    try {
      const s = await get<{ items: Placed[]; owned: Record<string, number> }>(`/me/room?playerId=${encodeURIComponent(id)}`);
      set({ items: s.items, owned: s.owned });
      if (!Object.keys(s.owned).length) set({ panel: 'shop' });
    } catch {
      /* offline */
    }
  },
  async visit(id) {
    try {
      const s = await get<{ name: string; items: Placed[] }>(`/rooms/${encodeURIComponent(id)}`);
      const slot = myRoomSlot(id);
      const r = myRoom(slot);
      set({ owner: id, ownerName: s.name, slot, items: s.items, owned: {}, ghost: null, panel: null, note: null });
      teleportTo(r.entry.x, r.entry.z, Math.PI);
      track('home_room_visit');
    } catch {
      /* not found */
    }
  },
  leave() {
    set({ owner: null, ghost: null, panel: null });
    const [x, z] = HOME_FRAME.toWorld(0, -6.5);
    teleportTo(x, z, HOME_FRAME.yaw(0));
  },
  setPanel: (panel) => set({ panel }),
  async buy(id) {
    const f = furniture(id);
    if (!f || !isMine()) return;
    try {
      const s = await post<{ owned: Record<string, number>; coins: number }>(`/me/room/buy?playerId=${encodeURIComponent(getPlayerId())}`, { playerId: getPlayerId(), item: id });
      set({ owned: s.owned, note: null });
      say(`I bought ${article(f.en)} ${f.en}.`);
      void useProfile.getState().refresh();
      getS().carry(id);
    } catch (e) {
      set({ note: (e as Error).message });
    }
  },
  carry(id) {
    if (!isMine()) return;
    const placed = getS().items.filter((p) => p.id === id).length;
    if (placed >= (getS().owned[id] ?? 0)) return;
    const f = furniture(id)!;
    set({ ghost: { id, r: 0, x: 0, z: 0, ok: true }, panel: null });
    say(`${article(f.en)} ${f.en}`);
  },
  pickUp(index) {
    if (!isMine() || getS().ghost) return;
    const p = getS().items[index];
    if (!p) return;
    const items = getS().items.filter((_, i) => i !== index);
    set({ items, ghost: { id: p.id, r: p.r, x: p.x, z: p.z, ok: true } });
  },
  rotate() {
    const g = getS().ghost;
    if (g) set({ ghost: { ...g, r: (g.r + 1) % 4 } });
  },
  place() {
    const g = getS().ghost;
    if (!g || !g.ok) return;
    const items = [...getS().items, { id: g.id, x: g.x, z: g.z, r: g.r }];
    set({ items, ghost: null });
    const f = furniture(g.id)!;
    say(`The ${f.en} is here.`);
    track('home_place', { item: g.id });
    void save(items);
  },
  putAway() {
    set({ ghost: null });
    void save(getS().items);
  },
  cancel() {
    // carrying a piece that was standing somewhere: it goes back to the bag (saved without it)
    set({ ghost: null });
    void save(getS().items);
  },
}));

/** Pieces of each kind not placed yet. */
export function inBag(s: { items: Placed[]; owned: Record<string, number> }) {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(s.owned)) {
    const left = n - s.items.filter((p) => p.id === id).length;
    if (left > 0) out[id] = left;
  }
  return out;
}
export const canBuyMore = (owned: Record<string, number>, id: string) => (owned[id] ?? 0) < FURNITURE_MAX;

/** Where the carried piece goes: in front of you, snapped to 25 cm, inside the room; wall pieces against a wall. */
export function ghostTick(rot: number) {
  const s = useMyRoom.getState();
  const g = s.ghost;
  if (!g || s.slot < 0) return;
  const r = myRoom(s.slot);
  const f = furniture(g.id)!;
  const reach = Math.max(f.w, f.d) / 2 + 0.7;
  let x = localPos.x - r.cx + Math.sin(rot) * reach;
  let z = localPos.z - r.cz + Math.cos(rot) * reach;
  const snap = (v: number) => Math.round(v * 4) / 4;
  let rr = g.r;
  if (f.wallY) {
    // the nearest wall, facing into the room
    const d = [MY_ROOM.w / 2 - x, x + MY_ROOM.w / 2, MY_ROOM.d / 2 - z, z + MY_ROOM.d / 2];
    const k = d.indexOf(Math.min(...d));
    if (k === 0) [x, rr] = [MY_ROOM.w / 2 - 0.06, 3];
    else if (k === 1) [x, rr] = [-MY_ROOM.w / 2 + 0.06, 1];
    else if (k === 2) [z, rr] = [MY_ROOM.d / 2 - 0.06, 2];
    else [z, rr] = [-MY_ROOM.d / 2 + 0.06, 0];
  }
  const [w, d] = rr % 2 ? [f.d, f.w] : [f.w, f.d];
  x = Math.max(-MY_ROOM.w / 2 + w / 2, Math.min(MY_ROOM.w / 2 - w / 2, snap(x)));
  z = Math.max(-MY_ROOM.d / 2 + d / 2, Math.min(MY_ROOM.d / 2 - d / 2, snap(z)));
  const me: Rect = footprint({ id: g.id, x, z, r: rr });
  const hit = (a: Rect, b: Rect) => a.minX < b.maxX - 0.01 && a.maxX > b.minX + 0.01 && a.minZ < b.maxZ - 0.01 && a.maxZ > b.minZ + 0.01;
  // rugs lie under things; wall pieces only clash with other wall pieces
  const ok = s.items.every((p) => {
    const o = furniture(p.id)!;
    if (f.flat || o.flat) return !(f.flat && o.flat) || !hit(me, footprint(p));
    if (!!f.wallY !== !!o.wallY) return true;
    return !hit(me, footprint(p));
  });
  if (x !== g.x || z !== g.z || rr !== g.r || ok !== g.ok) useMyRoom.setState({ ghost: { ...g, x, z, r: rr, ok } });
}

// walls of every room slot
const walls: Rect[] = [];
for (let i = 0; i < MY_ROOM_SLOTS; i++) {
  const { minX, maxX, minZ, maxZ } = myRoom(i).rect;
  walls.push(
    { minX: minX - 0.2, maxX: maxX + 0.2, minZ: minZ - 0.2, maxZ: minZ },
    { minX: minX - 0.2, maxX: maxX + 0.2, minZ: maxZ, maxZ: maxZ + 0.2 },
    { minX: minX - 0.2, maxX: minX, minZ, maxZ },
    { minX: maxX, maxX: maxX + 0.2, minZ, maxZ },
  );
}
registerBlockers(walls);
