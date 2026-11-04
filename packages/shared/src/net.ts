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
} as const;

/** Critters that can be picked up and hugged (ids from apps/web/src/world/critters.ts). */
export const PROP_RE = /^dish:[a-z-]{2,24}$/;
export const HOLDABLE_RE = /^(cat|dog|rabbit|duck|duckling)-\d{1,2}$/;

export interface JoinOptions {
  name: string;
  avatar: string; // JSON-encoded AvatarLook
  /** Anonymous/API player id (maps the Colyseus session to quest progress). */
  playerId: string;
  /** Closed beta: invite pass from POST /beta/verify, or the account token (either satisfies the gate). */
  betaPass?: string;
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
  | { type: 'request'; name: string }
  | { type: 'accept' }
  | { type: 'decline' }
  | { type: 'start'; name: string }
  | { type: 'msg'; text: string }
  | { type: 'typing' }
  | { type: 'end'; reason?: 'left' | 'distance' | 'busy' }
);

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
