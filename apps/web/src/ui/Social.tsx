import { useMyRoom } from '../store/myRoom';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GROUP_CHAT_MAX, GROUP_MAX, GROUP_NAME_MAX } from '@es/shared';
import { useGame, type RemotePlayer } from '../store/game';
import { useDm } from '../store/dm';
import { jumpToZone, useFriends } from '../store/friends';
import { setGroupViewing, useGroup, useMyGroup } from '../store/group';
import { useVoiceChat } from '../net/voicechat';
import { getToken } from '../net/player';
import { localPos } from '../scene/LocalPlayer';
import { useT } from '../i18n';
import { placeOf } from './PlayersPanel';

/**
 * Friends, groups and their notices (players panel tabs 👥). Friends are kept across visits (API); groups live in
 * this zone with a group chat and a group voice call.
 */

const dist = (p: RemotePlayer) => Math.hypot(p.x - localPos.x, p.z - localPos.z);
const initial = (name: string) => (name || '?').slice(0, 1).toUpperCase();

function Avatar({ name, tone = 'blue' }: { name: string; tone?: 'blue' | 'green' | 'gray' }) {
  const c =
    tone === 'green'
      ? 'bg-green-100 text-green-700'
      : tone === 'gray'
        ? 'bg-gray-100 text-gray-500'
        : 'bg-blue-100 text-blue-700';
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${c}`}
    >
      {initial(name)}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------- tabs */

export function PanelTabs() {
  const t = useT();
  const tab = useDm((s) => s.tab);
  const requests = useFriends((s) => s.list.incoming.length);
  const groupUnread = useGroup((s) => s.unread + (s.invite ? 1 : 0));
  const tabs = [
    ['here', `👥 ${t('Here')}`, 0],
    ['friends', `⭐ ${t('Friends')}`, requests],
    ['group', `🫂 ${t('Group')}`, groupUnread],
  ] as const;
  return (
    <div className="flex shrink-0 gap-1 border-b px-3 pt-1 sm:px-4" role="tablist">
      {tabs.map(([id, label, badge]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => useDm.getState().setTab(id)}
          className={`relative min-h-10 flex-1 rounded-t-lg px-2 text-sm font-medium ${tab === id ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          {label}
          {badge ? (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
              {badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- friends */

export function FriendsTab() {
  const t = useT();
  const list = useFriends((s) => s.list);
  const online = useFriends((s) => s.online);
  const error = useFriends((s) => s.error);
  const players = useGame((s) => s.players);
  const zone = useGame((s) => s.zone);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    void useFriends.getState().load();
  }, []);
  // friends in this zone: their live player (session id) by player id
  const here = new Map(Object.values(players).map((p) => [p.pid, p]));
  const friends = [...list.friends].sort(
    (a, b) => Number(!!online[b.pid]) - Number(!!online[a.pid]) || a.name.localeCompare(b.name),
  );
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}
      {list.incoming.length ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase text-gray-500">
            {t('Friend requests')}
          </h3>
          <div className="space-y-1.5">
            {list.incoming.map((f) => (
              <div
                key={f.pid}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2"
              >
                <Avatar name={f.name} />
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <button
                  type="button"
                  onClick={() => void useFriends.getState().respond(f.pid, true)}
                  className="min-h-9 rounded-lg bg-green-600 px-3 text-sm font-medium text-white"
                >
                  {t('Accept')}
                </button>
                <button
                  type="button"
                  onClick={() => void useFriends.getState().respond(f.pid, false)}
                  className="min-h-9 rounded-lg border px-3 text-sm"
                >
                  {t('No')}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase text-gray-500">
          {t('My friends ({count})', { count: friends.length })}
        </h3>
        {friends.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            {t('No friends yet. Open a player in the "Here" tab and tap "Add friend".')}
          </p>
        ) : null}
        <div className="space-y-1.5">
          {friends.map((f) => {
            const on = online[f.pid];
            const p = here.get(f.pid);
            const sameZone = !!p;
            const where = p ? placeOf(p.x, p.z, p.bus) : null;
            return (
              <div
                key={f.pid}
                className="flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2"
              >
                <span className="relative">
                  <Avatar name={f.name} tone={on ? 'green' : 'gray'} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${on ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {p && where ? (
                      <>
                        {where.icon} <span dir="ltr">{where.name}</span> ·{' '}
                        {t('{distance} m', { distance: Math.round(dist(p)) })}
                      </>
                    ) : on ? (
                      <>
                        {t('Online in')} <span dir="ltr">{on.zone}</span>
                        {on.locked ? ' 🔒' : ''}
                      </>
                    ) : (
                      t('Offline')
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void useMyRoom.getState().visit(f.pid);
                    useGame.getState().setUiPanel(null);
                  }}
                  title={t('Visit their room')}
                  aria-label={t('Visit their room')}
                  className="min-h-9 rounded-lg border px-2 text-sm"
                >
                  🏠
                </button>
                {sameZone ? (
                  <button
                    type="button"
                    onClick={() => useDm.getState().open(p!.id)}
                    className="min-h-9 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white"
                    title={t('Message')}
                  >
                    💬
                  </button>
                ) : on && !on.locked && on.zoneId !== zone?.id ? (
                  <button
                    type="button"
                    onClick={() => jumpToZone(on.zoneId)}
                    className="min-h-9 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white"
                  >
                    {t('Go to their zone')}
                  </button>
                ) : null}
                {confirm === f.pid ? (
                  <button
                    type="button"
                    onClick={() => {
                      void useFriends.getState().remove(f.pid);
                      setConfirm(null);
                    }}
                    className="min-h-9 rounded-lg bg-red-600 px-2 text-xs font-medium text-white"
                  >
                    {t('Remove?')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirm(f.pid)}
                    className="min-h-9 min-w-9 rounded-lg text-sm text-gray-400 hover:bg-gray-100"
                    aria-label={t('Remove friend')}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {list.outgoing.length ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase text-gray-500">
            {t('Waiting for an answer')}
          </h3>
          <div className="space-y-1.5">
            {list.outgoing.map((f) => (
              <div
                key={f.pid}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-dashed px-3 py-2 text-gray-600"
              >
                <Avatar name={f.name} tone="gray" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => void useFriends.getState().remove(f.pid)}
                  className="min-h-9 rounded-lg border px-3 text-xs"
                >
                  {t('Cancel')}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {!getToken() ? (
        <p className="text-center text-xs text-gray-400">
          {t(
            'Playing as a guest: your friends are kept on this device. Create an account to keep them everywhere.',
          )}
        </p>
      ) : null}
    </div>
  );
}

/** "Add friend" + "Invite to group" for one player (private message thread). */
export function SocialActions({ player }: { player: RemotePlayer }) {
  const t = useT();
  const status = useFriends((s) => s.statusOf(player.pid));
  useFriends((s) => s.list); // re-render when the list changes
  const group = useMyGroup();
  const canFriend = player.pid.length >= 8;
  const friendLabel =
    status === 'friend'
      ? `⭐ ${t('Friends')}`
      : status === 'outgoing'
        ? `⏳ ${t('Request sent')}`
        : status === 'incoming'
          ? `✅ ${t('Accept friend')}`
          : `➕ ${t('Add friend')}`;
  const inMyGroup = !!group && player.group === group.id;
  return (
    <div className="flex shrink-0 gap-2 border-b px-4 py-2 sm:px-5">
      {canFriend ? (
        <button
          type="button"
          disabled={status === 'friend' || status === 'outgoing'}
          onClick={() =>
            status === 'incoming'
              ? void useFriends.getState().respond(player.pid, true)
              : void useFriends.getState().request(player.pid, player.name)
          }
          className="min-h-10 flex-1 rounded-lg border border-amber-300 bg-amber-50 px-2 text-sm font-medium text-amber-900 disabled:opacity-60"
        >
          {friendLabel}
        </button>
      ) : null}
      <button
        type="button"
        disabled={inMyGroup || (!!group && group.members.length >= GROUP_MAX)}
        onClick={() =>
          group
            ? useGroup.getState().invitePlayer(player.id)
            : useGroup.getState().create(undefined, player.id)
        }
        className="min-h-10 flex-1 rounded-lg border border-violet-300 bg-violet-50 px-2 text-sm font-medium text-violet-900 disabled:opacity-60"
      >
        🫂 {inMyGroup ? t('In your group') : t('Invite to group')}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- group */

const GROUP_QUICK = [
  'Hi everyone!',
  'Where are you?',
  "Let's meet at the bus stop.",
  'Wait for me, please.',
  'See you later!',
];

export function GroupTab() {
  const t = useT();
  const group = useMyGroup();
  const invite = useGroup((s) => s.invite);
  const notice = useGroup((s) => s.notice);
  const [name, setName] = useState('');
  useEffect(() => {
    setGroupViewing(
      () => useDm.getState().tab === 'group' && useGame.getState().uiPanel === 'players',
    );
    useGroup.getState().markRead();
    return () => setGroupViewing(() => false);
  }, []);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice ? (
        <p className="mx-4 mt-2 rounded-lg bg-violet-50 px-3 py-1.5 text-xs text-violet-800">
          {notice}
        </p>
      ) : null}
      {invite ? <InviteCard /> : null}
      {group ? (
        <GroupView />
      ) : (
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <p className="text-sm text-gray-600">
            {t(
              'Make a group with players in this zone: chat together and talk in a group call, wherever you are on the map.',
            )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              useGroup.getState().create(name);
              setName('');
            }}
            className="flex gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={GROUP_NAME_MAX}
              placeholder={t('Group name (optional)')}
              className="min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm"
              dir="auto"
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white"
            >
              {t('Create group')}
            </button>
          </form>
          <p className="text-xs text-gray-400">
            {t('Up to {max} players. Invite people from the "Here" tab or from your friends.', {
              max: GROUP_MAX,
            })}
          </p>
        </div>
      )}
    </div>
  );
}

function InviteCard() {
  const t = useT();
  const invite = useGroup((s) => s.invite)!;
  return (
    <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2">
      <span className="text-xl">🫂</span>
      <span className="min-w-0 flex-1 text-sm">
        {t('{name} invites you to', { name: invite.fromName })} <b>{invite.name}</b>
      </span>
      <button
        type="button"
        onClick={() => useGroup.getState().accept()}
        className="min-h-9 rounded-lg bg-violet-600 px-3 text-sm font-medium text-white"
      >
        {t('Join')}
      </button>
      <button
        type="button"
        onClick={() => useGroup.getState().decline()}
        className="min-h-9 rounded-lg border px-3 text-sm"
      >
        {t('No')}
      </button>
    </div>
  );
}

function GroupView() {
  const t = useT();
  const group = useMyGroup()!;
  const me = useGame((s) => s.sessionId);
  const players = useGame((s) => s.players);
  const lines = useGroup((s) => s.lines);
  const vc = useVoiceChat();
  const [text, setText] = useState('');
  const [inviting, setInviting] = useState(false);
  const typing = useGroup((s) => s.typing);
  useEffect(() => () => useGroup.setState({ typing: false }), []);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
    useGroup.getState().markRead();
  }, [lines.length]);
  const others = Object.values(players).filter((p) => p.id !== me && p.group !== group.id);
  const full = group.members.length >= GROUP_MAX;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    useGroup.getState().send(text);
    setText('');
  };
  const inCall = group.members.filter((m) => m.groupCall).length;
  return (
    <>
      <div className="shrink-0 border-b px-4 py-2 sm:px-5">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate font-bold" dir="auto">
            🫂 {group.name}{' '}
            <span className="text-xs font-normal text-gray-500">
              ({group.members.length}/{GROUP_MAX})
            </span>
          </h3>
          <button
            type="button"
            onClick={() => useGroup.getState().leave()}
            className="min-h-9 rounded-lg border px-3 text-xs text-gray-600"
          >
            {t('Leave group')}
          </button>
        </div>
        {typing ? null : (
        <>
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
          {group.members.map((m) => (
            <span
              key={m.id}
              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${m.groupCall ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}
            >
              {m.id === group.owner ? '👑' : ''}
              {m.groupCall ? '🎙️' : ''}
              <span className="max-w-[7rem] truncate">{m.id === me ? t('You') : m.name}</span>
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2">
          {vc.supported ? (
            group.inCall ? (
              <button
                type="button"
                onClick={() => void useGroup.getState().setCall(false)}
                className="min-h-10 flex-1 rounded-lg bg-red-600 px-2 text-sm font-medium text-white"
              >
                📵 {t('Leave call')} ({inCall})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void useGroup.getState().setCall(true)}
                className="min-h-10 flex-1 rounded-lg bg-green-600 px-2 text-sm font-medium text-white"
              >
                📞 {inCall ? t('Join call ({count})', { count: inCall }) : t('Start group call')}
              </button>
            )
          ) : null}
          {group.inCall && vc.mic ? (
            <button
              type="button"
              onClick={() => vc.toggleMute()}
              className="min-h-10 rounded-lg border px-3 text-sm"
            >
              {vc.muted ? '🔇' : '🎙️'}
            </button>
          ) : null}
          <button
            type="button"
            disabled={full}
            onClick={() => setInviting((v) => !v)}
            className="min-h-10 flex-1 rounded-lg border border-violet-300 bg-violet-50 px-2 text-sm font-medium text-violet-900 disabled:opacity-50"
          >
            ➕ {full ? t('Group is full') : t('Invite')}
          </button>
        </div>
        {vc.error ? <p className="mt-1 text-xs text-red-600">{vc.error}</p> : null}
        {inviting && !full ? (
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {others.length === 0 ? (
              <p className="text-xs text-gray-500">{t('Nobody else here to invite.')}</p>
            ) : null}
            {others
              .sort((a, b) => dist(a) - dist(b))
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <span className="text-xs text-gray-400">
                    {t('{distance} m', { distance: Math.round(dist(p)) })}
                  </span>
                  <button
                    type="button"
                    disabled={!!p.group}
                    onClick={() => useGroup.getState().invitePlayer(p.id)}
                    className="min-h-8 rounded-lg bg-violet-600 px-2 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {p.group ? t('In a group') : t('Invite')}
                  </button>
                </div>
              ))}
          </div>
        ) : null}
        </>
        )}
      </div>
      <div ref={list} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3 sm:px-5">
        {lines.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-500">
            {t('Group chat: everyone in the group reads it, wherever they are.')}
          </p>
        ) : null}
        {lines.map((l, i) =>
          l.from === 'system' ? (
            <p key={i} className="text-center text-xs text-gray-400">
              {l.text}
            </p>
          ) : (
            <div
              key={i}
              className={`flex flex-col ${l.from === 'me' ? 'items-end' : 'items-start'}`}
            >
              {l.from === 'them' ? (
                <span className="px-1 text-[11px] text-gray-500">{l.name}</span>
              ) : null}
              <span
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${l.from === 'me' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-900'}`}
                dir="auto"
              >
                {l.text}
              </span>
            </div>
          ),
        )}
      </div>
      <div className="shrink-0 border-t px-4 pb-3 pt-2 sm:px-5">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" dir="ltr">
          {GROUP_QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onPointerDown={(e) => typing && e.preventDefault()}
              onClick={() => useGroup.getState().send(q)}
              className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={GROUP_CHAT_MAX}
            placeholder={t('Write in English…')}
            className="min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm"
            dir="auto"
            onFocus={() => useGroup.setState({ typing: true })}
            onBlur={() => useGroup.setState({ typing: false })}
          />
          <button
            type="submit"
            // keep the focus in the input so the phone keyboard stays open between messages
            onPointerDown={(e) => e.preventDefault()}
            disabled={!text.trim()}
            className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('Send')}
          </button>
        </form>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------------------------------- notices */

const openPanel = (tab: 'friends' | 'group') => {
  useDm.getState().setTab(tab);
  useGame.getState().setUiPanel('players');
};

/** Friend request / accepted, group invitation (small cards under the top bar) and the group call bar. */
export function SocialToasts() {
  const t = useT();
  const ftoast = useFriends((s) => s.toast);
  const invite = useGroup((s) => s.invite);
  const panel = useGame((s) => s.uiPanel);
  const tab = useDm((s) => s.tab);
  const group = useMyGroup();
  useEffect(() => {
    if (!ftoast) return;
    const tm = window.setTimeout(() => useFriends.getState().dismissToast(), 9000);
    return () => window.clearTimeout(tm);
  }, [ftoast]);
  const showGroupInvite = invite && !(panel === 'players' && tab === 'group');
  // the call bar hides while the players panel is open (it has the call controls itself)
  const inCall = group?.inCall && panel !== 'players' ? group.members.filter((m) => m.groupCall).length : 0;
  return (
    <div
      data-ui
      className="pointer-events-none absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+7.5rem)] z-40 flex w-[92vw] max-w-sm -translate-x-1/2 flex-col gap-2"
    >
      {ftoast ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-2xl">
          <span className="text-xl">{ftoast.kind === 'request' ? '⭐' : '🎉'}</span>
          <span className="min-w-0 flex-1 text-sm">
            {ftoast.kind === 'request'
              ? t('{name} wants to be your friend.', { name: ftoast.name })
              : t('You and {name} are now friends!', { name: ftoast.name })}
          </span>
          {ftoast.kind === 'request' ? (
            <button
              type="button"
              onClick={() => void useFriends.getState().respond(ftoast.pid, true)}
              className="min-h-9 rounded-lg bg-green-600 px-3 text-sm font-medium text-white"
            >
              {t('Accept')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openPanel('friends')}
              className="min-h-9 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white"
            >
              {t('Friends')}
            </button>
          )}
          <button
            type="button"
            onClick={() => useFriends.getState().dismissToast()}
            className="min-h-9 min-w-9 text-sm text-gray-400"
            aria-label={t('Close')}
          >
            ✕
          </button>
        </div>
      ) : null}
      {showGroupInvite ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-2xl">
          <span className="text-xl">🫂</span>
          <span className="min-w-0 flex-1 text-sm">
            {t('{name} invites you to', { name: invite.fromName })} <b dir="auto">{invite.name}</b>
          </span>
          <button
            type="button"
            onClick={() => {
              useGroup.getState().accept();
              openPanel('group');
            }}
            className="min-h-9 rounded-lg bg-violet-600 px-3 text-sm font-medium text-white"
          >
            {t('Join')}
          </button>
          <button
            type="button"
            onClick={() => useGroup.getState().decline()}
            className="min-h-9 min-w-9 text-sm text-gray-400"
            aria-label={t('No')}
          >
            ✕
          </button>
        </div>
      ) : null}
      {inCall ? (
        <div className="pointer-events-auto mx-auto flex items-center gap-2 rounded-full bg-green-600 px-3 py-1.5 text-sm text-white shadow-lg">
          <button
            type="button"
            onClick={() => openPanel('group')}
            className="flex items-center gap-1.5"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            📞 {t('Group call')} · {inCall}
          </button>
          <button
            type="button"
            onClick={() => void useGroup.getState().setCall(false)}
            className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium"
          >
            {t('Leave')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
