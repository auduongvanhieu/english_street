import { AREA_IDS } from './schemas/area';
/** Messages exchanged between client and the Colyseus street room. */

export const MSG = {
  /** client -> server: movement + animation */
  INPUT: 'input',
  /** both ways: proximity text chat */
  CHAT: 'chat',
  /** both ways: WebRTC signalling relayed to one peer */
  RTC: 'rtc',
  /** both ways: pair-quest invitations and transcript relay */
  PAIR: 'pair',
  /** both ways: one-to-one conversation (request / accept / decline / private lines / end) */
  TALK: 'talk',
  /** client -> server: text heard within SHOUT_RADIUS; server -> client as a CHAT message with shout: true */
  SHOUT: 'shout',
  /** server -> client on join: which zone this room is (ZoneMeta + id) */
  ZONE: 'zone',
  /** server -> client on join: { now } server epoch ms, so every client can run the same deterministic street life clock */
  TIME: 'time',
  /** client -> server: JSON AvatarLook after the player changed clothes (rate limited); shows up in Player.avatar */
  AVATAR: 'avatar',
  /** client -> server: id of the cat/dog the player picks up ('' = put it down); shows up in Player.holding */
  HOLD: 'hold',
  /** Something on the table in front of you: 'dish:<menu item id>' while seated in the restaurant, '' = none. */
  PROP: 'prop',
  /** client -> server: your garden plots (see encodeGarden) so other players at the farm can visit it. */
  GARDEN: 'garden',
  /** client -> server: bus ride tag "d|a:<stop>:<slot>" ('' = not riding); shows up in Player.bus */
  BUS: 'bus',
  /** private message at any distance: client -> server DmSend, server -> client DmReceived */
  DM: 'dm',
  /** server -> client: { text, level: 'info' | 'warning' } notice from the moderators (announcement, mute…) */
  NOTICE: 'notice',
  /** both ways: groups in this zone - create / invite / accept / decline / leave / chat / call (GroupSend, GroupEvent) */
  GROUP: 'group',
  /** both ways: friends - client -> server FriendSend (presence query, "I sent you a request" ping); server -> client FriendEvent */
  FRIEND: 'friend',
  /** both ways: hotel doors - knock on a room, the guest inside opens it (HotelSend / HotelEvent) */
  HOTEL: 'hotel',
  /** both ways: sports park - kick the ball, pick a team (SportSend); goals and results (SportEvent) */
  SPORT: 'sport',
  BOAT: 'boat',
  SETTINGS: 'settings',
  JOURNEY: 'journey',
  /** both ways: "My farm" - client asks where a farm is in this zone ({ op: 'slot', owner }), server answers
   * { op: 'slot', owner, slot } (slots are shared out per zone so two farms never overlap) */
  FARM: 'farm',
  /** both ways: team games (Word Relay) - TeamSend / TeamEvent (@es/shared teamGames.ts) */
  TEAM: 'team',
} as const;
export type FarmSend = { op: 'slot'; owner: string } | { op: 'chase'; ticket: string };
export type FarmEvent =
  | { op: 'slot'; owner: string; slot: number }
  /** the guard dog during a chase (10 Hz, to everybody on that farm) */
  | { op: 'dog'; slot: number; x: number; z: number; run: boolean }
  | { op: 'chase_end'; slot: number; result: 'escaped' | 'caught'; thief: string }
  /** to the farm's owner: somebody is stealing */
  | { op: 'alarm'; thief: string };

/** Close codes the server uses when it removes a player (client shows why). */
export const CLOSE_KICKED = 4105;
export const CLOSE_BANNED = 4106;

/** Critters that can be picked up and hugged (ids from apps/web/src/world/critters.ts). */
/** Synced props: a dish on the table, a shopping trolley with n things in it, cinema snacks in hand. */
export const PROP_RE = /^(dish:[a-z-]{2,24}|cart:\d{1,2}|snack:(popcorn|nachos|drink|icecream)|book:[a-z0-9-]{3,40}:\d:\d{1,2})$/;
/** Garden summary: 6 plots "crop:wateredAt" (wateredAt 0 = seeded, not watered yet), empty plots "", joined by "|". */
/** Bus ride: boarding (d) or arriving (a) at a stop in a shared bus slot (see apps/web/src/world/bus.ts). */
/** "d:<stop>:<slot>[:<to>]" boarding (with where the bus takes them, so followers can hop on), "a:<stop>:<slot>" arriving. */
export const BUS_RE = new RegExp(`^[da]:(main|${AREA_IDS.join('|')}):\\d{1,12}(:(main|${AREA_IDS.join('|')}))?$`);
export const GARDEN_RE = /^(?:[a-z]{2,12}:\d{1,13})?(?:\|(?:[a-z]{2,12}:\d{1,13})?){5}$/;
export const HOLDABLE_RE = /^(cat|dog|rabbit|duck|duckling|kid|lamb|guineapig)-\d{1,2}$/;

export interface JoinOptions {
  name: string;
  avatar: string; // JSON-encoded AvatarLook
  /** Anonymous/API player id (maps the Colyseus session to quest progress). */
  playerId: string;
  /** Closed beta: invite pass from POST /beta/verify, or the account token (either satisfies the gate). */
  betaPass?: string;
  /** Guest's human pass (POST /auth/guest after a captcha); signed-in players send `token` instead. */
  humanPass?: string;
  token?: string;
  /** Zone selection: 'main' joins/creates a public Main Street (room filter key), 'custom' creates a named zone. */
  zoneKind?: 'main' | 'custom';
  /** Custom zone name (create) — ZONE_NAME_MIN..ZONE_NAME_MAX chars, profanity-checked. */
  zoneName?: string;
  /** Private zone code: required to join a locked zone, set when creating one. */
  zoneCode?: string;
}

/** Public room metadata (visible in the zone list) + what the server sends on join (MSG.ZONE). */
export interface ZoneMeta {
  name: string;
  kind: 'main' | 'custom';
  /** Needs a code to enter. */
  locked: boolean;
}
export interface ZoneInfo extends ZoneMeta {
  id: string;
  clients: number;
  maxClients: number;
}
export type ZoneSelection = { mode: 'main' } | { mode: 'create'; name: string; code?: string } | { mode: 'join'; id: string; code?: string };

export interface InputMessage {
  x: number;
  /** Height above ground while jumping (0 on the ground). */
  y?: number;
  z: number;
  rot: number;
  anim: string;
  /** Player has proximity voice chat enabled. */
  voice: boolean;
  /** Holding the shout button: nearby players connect even beyond the normal voice radius. */
  shouting?: boolean;
}

/** Chat line as delivered by the server. */
export interface ChatDelivery {
  from: string;
  pid: string;
  name: string;
  text: string;
  shout?: boolean;
}

/** One-to-one talk. `to` is the other player's sessionId; the server adds `from` and sends `start`/`end` itself. */
export type TalkMessage = { to: string; from?: string } & (
  /** call: a voice call (any distance, mic on) instead of a text chat with someone nearby */
  | { type: 'request'; name: string; call?: boolean }
  | { type: 'accept' }
  | { type: 'decline' }
  | { type: 'start'; name: string; call?: boolean }
  | { type: 'msg'; text: string }
  | { type: 'typing' }
  | { type: 'end'; reason?: 'left' | 'distance' | 'busy' }
);

/** Private message to one player in the room (any distance). */
export interface DmSend {
  to: string;
  text: string;
}
export interface DmReceived {
  from: string;
  name: string;
  text: string;
}
export const DM_MAX = 300;

/** Relayed verbatim; `to` is the target sessionId, the server adds `from`. */
export interface RtcSignal {
  to: string;
  from?: string;
  sdp?: unknown;
  candidate?: unknown;
}

export type PairMessage = { to: string; from?: string } & (
  | { type: 'invite'; questId: string; questTitle: string; inviterPlayerId: string; inviterName: string; yourRole: string }
  | { type: 'accept'; playerId: string; name: string }
  | { type: 'decline' }
  | { type: 'start'; session: unknown }
  | { type: 'msg'; message: unknown; state: unknown; summaries?: unknown }
  | { type: 'leave' }
);

/** One-shot emotes any player can trigger (clip names exist in the character model). */
export const EMOTES = ['wave', 'dance', 'thumbsup', 'yes', 'no'] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_DURATION_MS = 2600;

/* ------------------------------------------------------------------------------------------- groups */

/** Players in one group (voice is a full WebRTC mesh, so keep it small). */
export const GROUP_MAX = 8;
export const GROUP_NAME_MAX = 24;
export const GROUP_CHAT_MAX = 300;

export type GroupSend =
  /** start a group (optionally inviting someone right away) */
  | { op: 'create'; name?: string; invite?: string }
  | { op: 'invite'; to: string }
  | { op: 'accept'; group: string }
  | { op: 'decline'; group: string }
  | { op: 'leave' }
  | { op: 'chat'; text: string }
  | { op: 'call'; on: boolean };

export type GroupEvent =
  /** someone invited you */
  | { op: 'invite'; group: string; name: string; from: string; fromName: string }
  /** your invitation was declined */
  | { op: 'declined'; by: string; byName: string }
  | { op: 'full' }
  /** a member's chat line (also echoed to the sender) */
  | { op: 'chat'; from: string; name: string; text: string; at: number }
  /** a member joined / left (system line in the group chat) */
  | { op: 'joined'; who: string; name: string }
  | { op: 'left'; who: string; name: string };

/* ------------------------------------------------------------------------------------------- friends */

/** Friend list size per player. */
export const FRIENDS_MAX = 100;

export type FriendSend =
  /** which of these player ids are online, and where (any zone) */
  | { op: 'presence'; pids: string[] }
  /** tell this player (by player id, any zone) that their friend list changed (request sent / accepted) */
  | { op: 'ping'; pid: string; kind: 'request' | 'accepted' };

export interface FriendOnline {
  pid: string;
  name: string;
  /** room id + zone name; locked zones need a code to join */
  zoneId: string;
  zone: string;
  locked: boolean;
  /** session id in that room (same zone as you: message / invite them directly) */
  sessionId: string;
}

export type FriendEvent = { op: 'presence'; online: FriendOnline[] } | { op: 'ping'; kind: 'request' | 'accepted'; fromPid: string; name: string };

/** REST: GET /friends */
export interface FriendEntry {
  pid: string;
  name: string;
  since: string;
}
export interface FriendList {
  friends: FriendEntry[];
  /** requests waiting for my answer */
  incoming: FriendEntry[];
  /** my requests they have not answered yet */
  outgoing: FriendEntry[];
}

/* ------------------------------------------------------------------------------------------- hotel doors */

export type HotelSend =
  /** knock on a room door (from the corridor) */
  | { op: 'knock'; room: number }
  /** the guest inside lets the visitor in (or not) */
  | { op: 'answer'; to: string; open: boolean };

export type HotelEvent =
  /** someone is knocking on the room you are in */
  | { op: 'knock'; from: string; name: string; room: number }
  /** the door was opened for you / not */
  | { op: 'answer'; room: number; open: boolean; name: string }
  /** nobody is in that room */
  | { op: 'empty'; room: number };
