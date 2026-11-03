import { Client, getStateCallbacks, type Room } from '@colyseus/sdk';
import { MSG, STREET_ROOM, type JoinOptions } from '@es/shared';
import { useGame, type RemotePlayer } from '../store/game';

const WS_URL = import.meta.env.VITE_GAME_WS_URL ?? 'ws://localhost:2567';

/** Shape of the server's Player schema as seen by the client (kept schema-agnostic). */
interface PlayerLike {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  anim: string;
  bubble: string;
}
interface StreetStateLike {
  players: Map<string, PlayerLike>;
}

let room: Room<StreetStateLike> | null = null;

export function getRoom() {
  return room;
}

export async function connect(opts: JoinOptions): Promise<Room<StreetStateLike>> {
  const g = useGame.getState();
  g.setConn('connecting');
  try {
    const client = new Client(WS_URL);
    room = await client.joinOrCreate<StreetStateLike>(STREET_ROOM, opts);
    g.setSessionId(room.sessionId);
    g.setConn('connected');
    bindRoom(room);
    return room;
  } catch (err) {
    console.error('[net] connect failed', err);
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
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      rot: p.rot,
      anim: p.anim,
      bubble: p.bubble,
    });

  $(r.state).players.onAdd((p, id) => {
    sync(p, id);
    $(p).onChange(() => sync(p, id));
  });
  $(r.state).players.onRemove((_p, id) => g.removePlayer(id));

  r.onMessage<{ name: string; text: string }>(MSG.CHAT, (m) => g.pushChat(m));
  r.onLeave(() => {
    g.setConn('idle');
    g.setSessionId(null);
    room = null;
  });
}

export function sendInput(x: number, z: number, rot: number, anim: string) {
  room?.send(MSG.INPUT, { x, z, rot, anim });
}

export function sendChat(text: string) {
  room?.send(MSG.CHAT, text);
}
