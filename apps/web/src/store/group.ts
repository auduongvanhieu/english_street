import { create } from 'zustand';
import { GROUP_CHAT_MAX, type GroupEvent } from '@es/shared';
import { onGroup, sendGroup } from '../net/client';
import { useVoiceChat } from '../net/voicechat';
import { track } from '../net/analytics';
import { haptic } from '../native/bridge';
import { t } from '../i18n';
import { useGame, type RemotePlayer } from './game';

/**
 * Groups in this zone (MSG.GROUP): up to GROUP_MAX players with a group chat and a group voice call. Membership is
 * synced state (Player.group / Player.groupCall); invitations, chat lines and join/leave notes are events.
 */
export interface GroupLine {
  from: 'me' | 'them' | 'system';
  name: string;
  text: string;
  at: number;
}

interface GroupStore {
  /** Someone invited me. */
  invite: { group: string; name: string; from: string; fromName: string } | null;
  lines: GroupLine[];
  unread: number;
  /** The group chat input has focus (phones: the panel hides its controls so the input stays above the keyboard). */
  typing: boolean;
  /** Short status (declined, full…) for a few seconds. */
  notice: string | null;
  create: (name?: string, invite?: string) => void;
  invitePlayer: (to: string) => void;
  accept: () => void;
  decline: () => void;
  leave: () => void;
  send: (text: string) => void;
  /** Join / leave the group's voice call (switches the mic on for the call). */
  setCall: (on: boolean) => Promise<void>;
  markRead: () => void;
}

/** The mic was switched on for the group call (not before): switch it off again afterwards. */
let micByCall = false;
let noticeTimer: number | null = null;

export const useGroup = create<GroupStore>((set, get) => ({
  invite: null,
  typing: false,
  lines: [],
  unread: 0,
  notice: null,
  create(name, invite) {
    sendGroup({ op: 'create', name: name?.trim() || undefined, invite });
    if (invite)
      setNotice(
        t('Invitation sent to {name}.', { name: useGame.getState().players[invite]?.name ?? '' }),
      );
    track('group_create');
  },
  invitePlayer(to) {
    sendGroup({ op: 'invite', to });
    const name = useGame.getState().players[to]?.name ?? '';
    setNotice(t('Invitation sent to {name}.', { name }));
  },
  accept() {
    const inv = get().invite;
    if (!inv) return;
    sendGroup({ op: 'accept', group: inv.group });
    set({ invite: null, lines: [], unread: 0 });
    track('group_join');
  },
  decline() {
    const inv = get().invite;
    if (!inv) return;
    sendGroup({ op: 'decline', group: inv.group });
    set({ invite: null });
  },
  leave() {
    void get().setCall(false);
    sendGroup({ op: 'leave' });
    set({ lines: [], unread: 0 });
  },
  send(text) {
    const msg = text.trim().slice(0, GROUP_CHAT_MAX);
    if (!msg) return;
    sendGroup({ op: 'chat', text: msg });
    track('group_chat', { len: msg.length });
  },
  async setCall(on) {
    const vc = useVoiceChat.getState();
    if (on) {
      if (!vc.supported) return;
      if (!vc.mic) {
        micByCall = true;
        await vc.enable();
        if (!useVoiceChat.getState().mic) return; // permission denied
      }
      sendGroup({ op: 'call', on: true });
      track('group_call');
    } else {
      sendGroup({ op: 'call', on: false });
      if (micByCall) vc.disable();
      micByCall = false;
    }
  },
  markRead: () => set({ unread: 0 }),
}));

function setNotice(notice: string | null) {
  useGroup.setState({ notice });
  if (noticeTimer) window.clearTimeout(noticeTimer);
  if (notice) noticeTimer = window.setTimeout(() => useGroup.setState({ notice: null }), 4000);
}

/** My group id ('' = none) and its members (me first). */
export function useMyGroup(): {
  id: string;
  name: string;
  owner: string;
  members: RemotePlayer[];
  inCall: boolean;
} | null {
  const me = useGame((s) => (s.sessionId ? s.players[s.sessionId] : undefined));
  const players = useGame((s) => s.players);
  const meta = useGame((s) => (me?.group ? s.groups[me.group] : undefined));
  if (!me?.group || !meta) return null;
  const members = Object.values(players)
    .filter((p) => p.group === me.group)
    .sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : a.name.localeCompare(b.name)));
  return { id: me.group, name: meta.name, owner: meta.owner, members, inCall: me.groupCall };
}

/** Is the group tab on screen right now? (no unread then) */
let viewing = () => false;
export function setGroupViewing(fn: () => boolean) {
  viewing = fn;
}

const add = (line: GroupLine) =>
  useGroup.setState((s) => ({
    lines: [...s.lines.slice(-149), line],
    unread: line.from === 'them' && !viewing() ? s.unread + 1 : s.unread,
  }));

export function initGroup() {
  const off = onGroup((m: GroupEvent) => {
    const me = useGame.getState().sessionId;
    switch (m.op) {
      case 'invite':
        useGroup.setState({
          invite: { group: m.group, name: m.name, from: m.from, fromName: m.fromName },
        });
        haptic('light');
        break;
      case 'declined':
        setNotice(t('{name} said no to the group.', { name: m.byName }));
        break;
      case 'full':
        setNotice(t('The group is full.'));
        break;
      case 'chat':
        add({ from: m.from === me ? 'me' : 'them', name: m.name, text: m.text, at: m.at });
        if (m.from !== me && !viewing()) haptic('light');
        break;
      case 'joined':
        add({
          from: 'system',
          name: m.name,
          text:
            m.who === me
              ? t('You joined the group.')
              : t('{name} joined the group.', { name: m.name }),
          at: Date.now(),
        });
        break;
      case 'left':
        add({
          from: 'system',
          name: m.name,
          text: t('{name} left the group.', { name: m.name }),
          at: Date.now(),
        });
        break;
    }
  });
  // left the zone or the group: forget the chat, end my side of the call
  const offRoom = useGame.subscribe((s, prev) => {
    const now = s.sessionId ? (s.players[s.sessionId]?.group ?? '') : '';
    const before = prev.sessionId ? (prev.players[prev.sessionId]?.group ?? '') : '';
    if (before && !now) {
      useGroup.setState({ lines: [], unread: 0 });
      if (micByCall && !s.sessionId) useVoiceChat.getState().disable();
      if (!s.sessionId) micByCall = false;
    }
    if (prev.zone && !s.zone) useGroup.setState({ invite: null, lines: [], unread: 0 });
  });
  return () => {
    off();
    offRoom();
  };
}
