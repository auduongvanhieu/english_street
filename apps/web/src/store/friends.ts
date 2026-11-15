import { create } from 'zustand';
import { FRIEND_MSG_MAX, type FriendEvent, type FriendList, type FriendMessage, type FriendOnline } from '@es/shared';
import { fetchFriendMessages, fetchFriends, friendRemove, friendRequest, friendRespond, sendFriendMessage } from '../net/api';
import { onFriend, sendFriend } from '../net/client';
import { getPlayerId } from '../net/player';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { useGame } from './game';
import { useDm } from './dm';

/**
 * Friends: the list lives in the API (accounts and guests, by player id); the game server tells us who is online
 * in any zone (presence) and pings the other player when a request is sent or accepted, so lists update live.
 */
interface FriendsStore {
  list: FriendList;
  loaded: boolean;
  /** Friends online right now, by player id (any zone). */
  online: Record<string, FriendOnline>;
  /** Small toast: a request arrived / was accepted / a friend sent a message. */
  toast: { kind: 'request' | 'accepted' | 'message'; pid: string; name: string } | null;
  /** Friend chat open in the Friends tab (player id), its messages, sending state. Works when they are offline. */
  chat: string | null;
  messages: FriendMessage[];
  chatError: string | null;
  sending: boolean;
  openChat: (pid: string | null) => void;
  loadChat: () => Promise<void>;
  sendMessage: (text: string) => Promise<boolean>;
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
  chat: null,
  messages: [],
  chatError: null,
  sending: false,
  openChat(pid) {
    set((s) => ({
      chat: pid,
      messages: pid === s.chat ? s.messages : [],
      chatError: null,
      toast: s.toast?.kind === 'message' && s.toast.pid === pid ? null : s.toast,
    }));
    if (pid) void get().loadChat();
  },
  async loadChat() {
    const pid = get().chat;
    if (!pid) return;
    try {
      const { messages } = await fetchFriendMessages(pid);
      if (get().chat !== pid) return;
      // opening the chat marked them read: clear this friend's unread count
      set((s) => {
        const unread = { ...(s.list.unread ?? {}) };
        delete unread[pid];
        return { messages, chatError: null, list: { ...s.list, unread } };
      });
    } catch (e) {
      set({ chatError: (e as Error).message });
    }
  },
  async sendMessage(text) {
    const pid = get().chat;
    const msg = text.trim().slice(0, FRIEND_MSG_MAX);
    if (!pid || !msg || get().sending) return false;
    set({ sending: true, chatError: null });
    try {
      const { message } = await sendFriendMessage(pid, msg);
      if (get().chat === pid) set((s) => ({ messages: [...s.messages, message].slice(-100) }));
      sendFriend({ op: 'ping', pid, kind: 'message' });
      track('friend_message', { len: msg.length, online: !!get().online[pid] });
      return true;
    } catch (e) {
      set({ chatError: (e as Error).message });
      return false;
    } finally {
      set({ sending: false });
    }
  },
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
      if (m.kind === 'message') {
        const s = useFriends.getState();
        // reading this chat right now: just fetch the new message, no toast
        if (s.chat === m.fromPid && useGame.getState().uiPanel === 'players' && useDm.getState().tab === 'friends') {
          void s.loadChat();
          return;
        }
      }
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

/** Pending friend requests + unread friend messages (badge on 👥). */
export const useFriendRequests = () => useFriends((s) => s.list.incoming.length + friendUnread(s.list));
/** Unread friend messages, all friends. */
export const friendUnread = (l: FriendList) => Object.values(l.unread ?? {}).reduce((n, x) => n + x, 0);
