import { create } from 'zustand';
import type { FriendEvent, FriendList, FriendOnline } from '@es/shared';
import { fetchFriends, friendRemove, friendRequest, friendRespond } from '../net/api';
import { onFriend, sendFriend } from '../net/client';
import { getPlayerId } from '../net/player';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { useGame } from './game';

/**
 * Friends: the list lives in the API (accounts and guests, by player id); the game server tells us who is online
 * in any zone (presence) and pings the other player when a request is sent or accepted, so lists update live.
 */
interface FriendsStore {
  list: FriendList;
  loaded: boolean;
  /** Friends online right now, by player id (any zone). */
  online: Record<string, FriendOnline>;
  /** Small toast: a request arrived / was accepted. */
  toast: { kind: 'request' | 'accepted'; pid: string; name: string } | null;
  error: string | null;
  load: () => Promise<void>;
  request: (pid: string, name: string) => Promise<void>;
  respond: (pid: string, accept: boolean) => Promise<void>;
  remove: (pid: string) => Promise<void>;
  /** Status of another player for the "Add friend" button. */
  statusOf: (pid: string) => 'friend' | 'incoming' | 'outgoing' | 'none';
  dismissToast: () => void;
}

const empty: FriendList = { friends: [], incoming: [], outgoing: [] };
const myName = () => {
  const g = useGame.getState();
  return (g.sessionId && g.players[g.sessionId]?.name) || '';
};

export const useFriends = create<FriendsStore>((set, get) => ({
  list: empty,
  loaded: false,
  online: {},
  toast: null,
  error: null,
  async load() {
    try {
      set({ list: await fetchFriends(), loaded: true, error: null });
      queryPresence();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  async request(pid, name) {
    try {
      const r = await friendRequest(pid, name, myName());
      sendFriend({ op: 'ping', pid, kind: r.status === 'friends' ? 'accepted' : 'request' });
      track('friend_request', { result: r.status });
      await get().load();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  async respond(pid, accept) {
    try {
      await friendRespond(pid, accept, myName());
      if (accept) sendFriend({ op: 'ping', pid, kind: 'accepted' });
      track('friend_respond', { accept });
      if (get().toast?.pid === pid) set({ toast: null });
      await get().load();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  async remove(pid) {
    try {
      await friendRemove(pid);
      await get().load();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  statusOf(pid) {
    const l = get().list;
    if (l.friends.some((f) => f.pid === pid)) return 'friend';
    if (l.incoming.some((f) => f.pid === pid)) return 'incoming';
    if (l.outgoing.some((f) => f.pid === pid)) return 'outgoing';
    return 'none';
  },
  dismissToast: () => set({ toast: null }),
}));

function queryPresence() {
  const pids = useFriends.getState().list.friends.map((f) => f.pid);
  if (pids.length && useGame.getState().sessionId) sendFriend({ op: 'presence', pids });
}

/** Jump to another zone (App sets this: leave the room and join the friend's zone). */
let zoneJumper: ((zoneId: string) => void) | null = null;
export function setZoneJumper(fn: ((zoneId: string) => void) | null) {
  zoneJumper = fn;
}
export const jumpToZone = (zoneId: string) => zoneJumper?.(zoneId);

export function initFriends() {
  const off = onFriend((m: FriendEvent) => {
    if (m.op === 'presence') {
      useFriends.setState({
        online: Object.fromEntries(
          m.online.filter((o) => o.pid !== getPlayerId()).map((o) => [o.pid, o]),
        ),
      });
    } else if (m.op === 'ping') {
      void useFriends.getState().load();
      useFriends.setState({ toast: { kind: m.kind, pid: m.fromPid, name: m.name } });
      haptic('light');
    }
  });
  // (re)load when we join a zone, then keep presence fresh
  const offJoin = useGame.subscribe((s, prev) => {
    if (s.sessionId && s.sessionId !== prev.sessionId) void useFriends.getState().load();
  });
  if (useGame.getState().sessionId) void useFriends.getState().load();
  const iv = window.setInterval(queryPresence, 15_000);
  return () => {
    off();
    offJoin();
    window.clearInterval(iv);
  };
}

/** Pending friend requests (badge on 👥). */
export const useFriendRequests = () => useFriends((s) => s.list.incoming.length);
