import { Client, getStateCallbacks, type Room } from '@colyseus/sdk';
import { CLOSE_BANNED, CLOSE_KICKED } from '@es/shared';
import { useWorld } from '../store/world';
import { t } from '../i18n';
import { MSG, STREET_ROOM, type AvatarLook, type ChatDelivery, type JoinOptions, type PairMessage, type RtcSignal, type TalkMessage, type ZoneInfo, type ZoneSelection } from '@es/shared';
import { useGame, type RemotePlayer } from '../store/game';

const WS_URL = import.meta.env.VITE_GAME_WS_URL ?? 'ws://localhost:2567';

/** Shape of the server's Player schema as seen by the client (kept schema-agnostic). */
interface PlayerLike {
  id: string;
  pid: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  anim: string;
  voice: boolean;
  shouting: boolean;
  talkWith: string;
  avatar: string;
  bubble: string;
  holding?: string;
  prop?: string;
  garden?: string;
  bus?: string;
}
interface StreetStateLike {
  players: Map<string, PlayerLike>;
}

let room: Room<StreetStateLike> | null = null;
/** Last garden summary sent to the current room (re-sent after reconnecting). */
let lastGarden = '';

/** Subscribers for relayed messages (voice chat signalling, pair quests). */
const rtcHandlers = new Set<(m: RtcSignal & { from: string }) => void>();
const pairHandlers = new Set<(m: PairMessage & { from: string }) => void>();
const talkHandlers = new Set<(m: TalkMessage & { from: string }) => void>();
export const onTalk = (fn: (m: TalkMessage & { from: string }) => void) => (talkHandlers.add(fn), () => talkHandlers.delete(fn));
export const onRtc = (fn: (m: RtcSignal & { from: string }) => void) => (rtcHandlers.add(fn), () => rtcHandlers.delete(fn));
export const onPair = (fn: (m: PairMessage & { from: string }) => void) => (pairHandlers.add(fn), () => pairHandlers.delete(fn));

export function getRoom() {
  return room;
}

/** Server clock: Date.now() - offset ≈ the game server's Date.now() (set from the TIME message on join). */
let clockOffset = 0;
/** Dev/e2e only: pin the server clock so schedule-driven things (critters, cyclists, boats) hold still for screenshots. */
let frozenNow: number | null = null;
export const freezeClock = (t: number | null) => (frozenNow = t);
export const serverNow = () => frozenNow ?? Date.now() - clockOffset;

/** Zones = Colyseus rooms of the street type; the listing carries our metadata (name, kind, locked). */
export async function listZones(): Promise<ZoneInfo[]> {
  const res = await fetch(`${WS_URL.replace(/^ws/, 'http')}/zones`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`zones ${res.status}`);
  return ((await res.json()) as { zones: ZoneInfo[] }).zones;
}

function joinZone(client: Client, opts: JoinOptions, zone: ZoneSelection) {
  if (zone.mode === 'create') return client.create<StreetStateLike>(STREET_ROOM, { ...opts, zoneKind: 'custom', zoneName: zone.name, zoneCode: zone.code || undefined });
  if (zone.mode === 'join') return client.joinById<StreetStateLike>(zone.id, { ...opts, zoneCode: zone.code || undefined });
  return client.joinOrCreate<StreetStateLike>(STREET_ROOM, { ...opts, zoneKind: 'main' });
}

export function leaveRoom() {
  const r = room;
  room = null;
  if (r) void r.leave(true);
  const g = useGame.getState();
  g.resetRoom();
  g.setSessionId(null);
  g.setConn('idle');
}

/** In-flight join, so a double call (React StrictMode effects, impatient taps) never opens two seats. */
let connecting: Promise<Room<StreetStateLike>> | null = null;

export function connect(opts: JoinOptions, zone: ZoneSelection = { mode: 'main' }): Promise<Room<StreetStateLike>> {
  if (connecting) return connecting;
  if (room) leaveRoom();
  connecting = doConnect(opts, zone).finally(() => (connecting = null));
  return connecting;
}

async function doConnect(opts: JoinOptions, zone: ZoneSelection): Promise<Room<StreetStateLike>> {
  const g = useGame.getState();
  g.setConn('connecting');
  g.setConnError(null);
  try {
    const client = new Client(WS_URL);
    try {
      room = await joinZone(client, opts, zone);
    } catch (err) {
      // Slow devices/networks can miss the matchmaking seat window; one retry fixes almost all of these.
      if (!/seat reservation expired/i.test((err as Error)?.message ?? '')) throw err;
      room = await joinZone(client, opts, zone);
    }
    g.setSessionId(room.sessionId);
    lastGarden = '';
    g.setConn('connected');
    bindRoom(room);
    return room;
  } catch (err) {
    console.error('[net] connect failed', err);
    g.setConnError((err as Error)?.message ?? 'connect_failed');
    g.setConn('error');
    throw err;
  }
}

function bindRoom(r: Room<StreetStateLike>) {
  const g = useGame.getState();
  const $ = getStateCallbacks(r);

  const sync = (p: PlayerLike, id: string) =>
    g.upsertPlayer(<RemotePlayer>{
      id,
      pid: p.pid,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      rot: p.rot,
      anim: p.anim,
      voice: p.voice,
      shouting: p.shouting,
      talkWith: p.talkWith,
      avatar: p.avatar,
      bubble: p.bubble,
      holding: p.holding ?? '',
      prop: p.prop ?? '',
      garden: p.garden ?? '',
      bus: p.bus ?? '',
    });

  $(r.state).players.onAdd((p, id) => {
    sync(p, id);
    $(p).onChange(() => sync(p, id));
  });
  $(r.state).players.onRemove((_p, id) => g.removePlayer(id));

  r.onMessage<ChatDelivery>(MSG.CHAT, (m) => g.pushChat(m));
  r.onMessage<ZoneInfo>(MSG.ZONE, (z) => g.setZone({ ...z, clients: 0, maxClients: 0 }));
  r.onMessage<{ now: number }>(MSG.TIME, (m) => {
    if (typeof m?.now === 'number') clockOffset = Date.now() - m.now;
  });
  r.onMessage<TalkMessage & { from: string }>(MSG.TALK, (m) => talkHandlers.forEach((h) => h(m)));
  r.onMessage<RtcSignal & { from: string }>(MSG.RTC, (m) => rtcHandlers.forEach((h) => h(m)));
  r.onMessage<PairMessage & { from: string }>(MSG.PAIR, (m) => pairHandlers.forEach((h) => h(m)));
  r.onMessage<{ text: string; level: 'info' | 'warning'; code?: string }>(MSG.NOTICE, (m) => {
    if (!m || typeof m.text !== 'string') return;
    useWorld.getState().pushLive({ text: m.code === 'muted' ? t('A moderator has muted your chat for now.') : m.text, level: m.level === 'warning' ? 'warning' : 'info' });
  });
  r.onLeave((code) => {
    if (room !== r) return; // we left on purpose (leaveRoom already reset the store)
    room = null;
    g.resetRoom();
    g.setSessionId(null);
    // removed by a moderator: say why on the start screen
    if (code === CLOSE_KICKED || code === CLOSE_BANNED) {
      g.setConnError(code === CLOSE_BANNED ? 'account_banned' : 'kicked');
      g.setConn('error');
    } else g.setConn('idle');
  });
}

export function sendInput(x: number, y: number, z: number, rot: number, anim: string, voice: boolean, shouting = false) {
  room?.send(MSG.INPUT, { x, y, z, rot, anim, voice, shouting });
}

/** Pick up a cat/dog by id, or put it down with ''. */
export function sendHold(id: string) {
  room?.send(MSG.HOLD, id);
}

/** Restaurant: the dish on the table in front of me ('dish:steak'), '' = none. */
/** Bus ride tag (world/bus.ts encodeBus), '' when not riding. */
export function sendBus(tag: string) {
  room?.send(MSG.BUS, tag);
}

export function sendGarden(garden: string) {
  if (!room || garden === lastGarden) return;
  lastGarden = garden;
  room.send(MSG.GARDEN, garden);
}

export function sendProp(prop: string) {
  room?.send(MSG.PROP, prop);
}

/** Tell the room about new clothes (the server re-validates and rate limits). */
export function sendAvatar(look: AvatarLook) {
  room?.send(MSG.AVATAR, JSON.stringify(look));
}

export function sendChat(text: string) {
  room?.send(MSG.CHAT, text);
}

export function sendShout(text: string) {
  room?.send(MSG.SHOUT, text);
}

export function sendTalk(msg: TalkMessage) {
  room?.send(MSG.TALK, msg);
}

export function sendRtc(signal: RtcSignal) {
  room?.send(MSG.RTC, signal);
}

export function sendPair(msg: PairMessage) {
  room?.send(MSG.PAIR, msg);
}
