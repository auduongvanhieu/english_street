import { Icon } from './icons';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AREA_INFO, DM_MAX, INTERIOR_BOUNDS, SUNNY_BAY, clinicRoomAt, hotelRoomAt, inRect, myRoomAt, trainCarRect } from '@es/shared';
import { Sheet, SheetHeader } from './Sheet';
import { HudButton } from './Hud';
import { useGame, type RemotePlayer } from '../store/game';
import { useDm, useDmUnread } from '../store/dm';
import { useFollow } from '../store/follow';
import { useTalk } from '../store/talk';
import { useVoiceChat } from '../net/voicechat';
import { localPos } from '../scene/LocalPlayer';
import { CORRIDOR_MAX_Z, SOUTH_MIN_Z, areaAt } from '../world/areas';
import { t as tr, useT } from '../i18n';
import { useFriendRequests, useFriends } from '../store/friends';
import { useGroup } from '../store/group';
import { FriendsTab, GroupTab, PanelTabs, SocialActions } from './Social';

/** Where a player is, in words: the area, the bus, the river, the south bank or the main street. */
export function placeOf(x: number, z: number, bus = ''): { icon: string; name: string } {
  if (bus) return { icon: '🚌', name: tr('On the bus') };
  if (inRect(SUNNY_BAY, x, z, 5)) return { icon: '🏖️', name: 'Sunny Bay' };
  if (inRect(trainCarRect(1), x, z)) return { icon: '🚆', name: tr('On the train') };
  if (myRoomAt(x, z) >= 0) return { icon: '🏠', name: tr('In a room at home') };
  if (clinicRoomAt(x, z) >= 0) return { icon: '🩺', name: 'City Hospital' };
  if (inRect(INTERIOR_BOUNDS, x, z)) {
    const room = hotelRoomAt(x, z);
    return { icon: '🏨', name: room ? `Riverside Hotel · Room ${room}` : 'Riverside Hotel' };
  }
  const a = areaAt(x, z, 0.5);
  if (a) return { icon: AREA_INFO[a].icon, name: AREA_INFO[a].short };
  if (z >= SOUTH_MIN_Z - 1) return { icon: '🌳', name: tr('South bank') };
  if (z > CORRIDOR_MAX_Z) return { icon: '🌉', name: tr('By the river') };
  return { icon: '🏙️', name: 'Main Street' };
}
/** The same place as an English phrase for "I'm at …" messages. */
function placePhrase(x: number, z: number): string {
  const a = areaAt(x, z, 0.5);
  if (a) return `the ${AREA_INFO[a].short.toLowerCase()}`;
  if (z >= SOUTH_MIN_Z - 1) return 'the south bank';
  if (z > CORRIDOR_MAX_Z) return 'the river';
  return 'Main Street';
}

const dist = (p: RemotePlayer) => Math.hypot(p.x - localPos.x, p.z - localPos.z);

/** Re-render every `ms` (positions change all the time; the store only holds the latest sync). */
function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => set((n) => n + 1), ms);
    return () => window.clearInterval(iv);
  }, [ms]);
}

/** 👥 button with the number of players here and a badge for unread private messages. */
export function PlayersButton({ compact }: { compact: boolean }) {
  const t = useT();
  const count = useGame((s) => Object.keys(s.players).length);
  const unread = useDmUnread() + useFriendRequests() + useGroup((s) => s.unread + (s.invite ? 1 : 0));
  const open = () => {
    useDm.getState().open(null);
    useGame.getState().setUiPanel('players');
  };
  const badge = unread ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unread}</span> : null;
  if (compact)
    return (
      <span className="relative">
        <HudButton onClick={open} title={t('Players')}>
          <Icon name="users" />
        </HudButton>
        {badge}
      </span>
    );
  return (
    <button type="button" onClick={open} className="relative rounded-lg bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60" title={t('Players (P)')}>
      👥 {t('Players')} ({count})
      {badge}
    </button>
  );
}

/** 👥 Everyone in this zone, where they are, and private messages at any distance. */
export function PlayersPanel() {
  const t = useT();
  const openId = useDm((s) => s.openId);
  const tab = useDm((s) => s.tab);
  const groupTyping = useGroup((s) => s.typing);
  const close = () => useGame.getState().setUiPanel(null);
  return (
    <Sheet onClose={close} label={t('Players')}>
      {openId ? (
        <Thread id={openId} onClose={close} />
      ) : (
        <>
          {/* typing in the group chat on a phone: the list header and tabs make room for the keyboard */}
          {groupTyping && tab === 'group' ? null : <List onClose={close} tab={tab} />}
          {tab === 'friends' ? <FriendsTab /> : tab === 'group' ? <GroupTab /> : null}
        </>
      )}
    </Sheet>
  );
}

function List({ onClose, tab }: { onClose: () => void; tab: 'here' | 'friends' | 'group' }) {
  const t = useT();
  useTick(1000);
  const me = useGame((s) => s.sessionId);
  const players = useGame((s) => s.players);
  const threads = useDm((s) => s.threads);
  const friendPids = new Set(useFriends((s) => s.list.friends).map((f) => f.pid));
  const myGroup = useGame((s) => (s.sessionId ? s.players[s.sessionId]?.group : '')) ?? '';
  const others = Object.values(players)
    .filter((p) => p.id !== me)
    .sort((a, b) => (threads[b.id]?.unread ?? 0) - (threads[a.id]?.unread ?? 0) || dist(a) - dist(b));
  const here = placeOf(localPos.x, localPos.z);
  return (
    <>
      <SheetHeader>
        <div>
          <h2 className="text-lg font-bold">👥 {t('Players here ({count})', { count: others.length + 1 })}</h2>
          <p className="text-xs text-gray-500">
            {t('You are at')} {here.icon} <span dir="ltr">{here.name}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      <PanelTabs />
      {tab !== 'here' ? null : (
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3 sm:px-5">
        {others.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">{t('Nobody else is here yet. Invite a friend!')}</p> : null}
        {others.map((p) => {
          const where = placeOf(p.x, p.z, p.bus);
          const th = threads[p.id];
          const last = th?.lines[th.lines.length - 1];
          return (
            <button key={p.id} type="button" onClick={() => useDm.getState().open(p.id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-gray-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {p.name}
                  {friendPids.has(p.pid) ? ' ⭐' : ''}
                  {myGroup && p.group === myGroup ? ' 🫂' : ''}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {where.icon} <span dir="ltr">{where.name}</span> · {t('{distance} m', { distance: Math.round(dist(p)) })}
                  {p.talkWith ? ` · ${t('in a conversation')}` : ''}
                </span>
                {last ? (
                  <span className={`block truncate text-xs ${th!.unread ? 'font-semibold text-gray-900' : 'text-gray-400'}`} dir="auto">
                    {last.from === 'me' ? `${t('You')}: ` : ''}
                    {last.text}
                  </span>
                ) : null}
              </span>
              {th?.unread ? <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">{th.unread}</span> : <span className="text-gray-400">💬</span>}
            </button>
          );
        })}
      </div>
      )}
    </>
  );
}

/** Ready-made English lines for finding each other (learners practise them; any text works too). */
const QUICK = ['Where are you?', "I'm coming!", 'Wait for me, please.', "Let's meet at the bus stop."];

function Thread({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  useTick(1000);
  const p = useGame((s) => s.players[id]);
  const thread = useDm((s) => s.threads[id]);
  const following = useFollow((s) => s.target?.id === id);
  const talk = useTalk();
  const vc = useVoiceChat();
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const name = p?.name ?? thread?.name ?? '';
  const lines = thread?.lines ?? [];
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [lines.length]);
  // reading the thread clears its unread count
  useEffect(() => {
    if (thread?.unread) useDm.getState().open(id);
  }, [thread?.unread, id]);
  const send = (msg: string) => {
    if (!p) return;
    useDm.getState().send(id, msg);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
    setText('');
  };
  const where = p ? placeOf(p.x, p.z, p.bus) : null;
  const busy = !!p?.talkWith || !!talk.partner || !!talk.pendingTo;
  return (
    <>
      <SheetHeader>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => useDm.getState().open(null)} className="min-h-9 min-w-9 rounded-lg text-lg text-gray-600 hover:bg-gray-100" aria-label={t('Back to the players list')}>
            ←
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{name}</h2>
            <p className="truncate text-xs text-gray-500">
              {p && where ? (
                <>
                  {where.icon} <span dir="ltr">{where.name}</span> · {t('{distance} m', { distance: Math.round(dist(p)) })}
                </>
              ) : (
                t('Left this zone')
              )}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="min-h-9 min-w-9 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={t('Close')}>
          ✕
        </button>
      </SheetHeader>
      {p ? (
        <div className="flex shrink-0 flex-wrap gap-2 border-b px-4 py-2 sm:px-5">
          <button
            type="button"
            onClick={() => {
              if (following) useFollow.getState().stop();
              else {
                useFollow.getState().start(p.id, p.name);
                onClose();
              }
            }}
            className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-medium ${following ? 'border border-gray-300 text-gray-700' : 'bg-emerald-600 text-white'}`}
          >
            🚶 {following ? t('Stop going') : t('Go to them')}
          </button>
          <button type="button" onClick={() => useDm.getState().showOnMap(p.id)} className="min-h-10 flex-1 rounded-lg border px-2 text-sm">
            🗺️ {t('Show on map')}
          </button>
          {vc.supported ? (
            <button type="button" disabled={busy} onClick={() => talk.request(p.id, p.name, true)} className="min-h-10 flex-1 rounded-lg bg-green-600 px-2 text-sm font-medium text-white disabled:opacity-50">
              📞 {t('Call')}
            </button>
          ) : null}
        </div>
      ) : null}
      {p ? <SocialActions player={p} /> : null}
      <div ref={list} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3 sm:px-5">
        {lines.length === 0 ? <p className="py-4 text-center text-xs text-gray-500">{t('Send {name} a private message. Only they can read it, wherever they are.', { name })}</p> : null}
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <span className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${l.from === 'me' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`} dir="auto">
              {l.text}
            </span>
          </div>
        ))}
      </div>
      {p ? (
        <div className="shrink-0 border-t px-4 pb-3 pt-2 sm:px-5">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1" dir="ltr">
            <button type="button" onClick={() => send(`I'm at ${placePhrase(localPos.x, localPos.z)}.`)} className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">
              📍 I'm at {placePhrase(localPos.x, localPos.z)}.
            </button>
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => send(q)} className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800">
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={DM_MAX} placeholder={t('Write in English…')} className="min-h-11 min-w-0 flex-1 rounded-lg border px-3 text-sm" dir="auto" />
            <button type="submit" disabled={!text.trim()} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">
              {t('Send')}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

/** A private message arrived while its thread was not open: a small toast with Reply. */
export function DmToast() {
  const t = useT();
  const toast = useDm((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const tm = window.setTimeout(() => useDm.getState().dismissToast(), 7000);
    return () => window.clearTimeout(tm);
  }, [toast]);
  if (!toast) return null;
  return (
    <div data-ui className="absolute left-1/2 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-40 flex w-[92vw] max-w-sm -translate-x-1/2 items-center gap-2 rounded-xl bg-white p-2.5 shadow-2xl">
      <span className="text-xl">💬</span>
      <span className="min-w-0 flex-1 text-sm">
        <b>{toast.name}</b>
        <span className="block truncate text-gray-700" dir="auto">
          {toast.text}
        </span>
      </span>
      <button
        type="button"
        onClick={() => {
          useDm.getState().open(toast.from);
          useGame.getState().setUiPanel('players');
        }}
        className="min-h-9 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white"
      >
        {t('Reply')}
      </button>
      <button type="button" onClick={() => useDm.getState().dismissToast()} className="min-h-9 min-w-9 text-sm text-gray-400" aria-label={t('Close')}>
        ✕
      </button>
    </div>
  );
}
