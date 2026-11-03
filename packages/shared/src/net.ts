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
} as const;

export interface JoinOptions {
  name: string;
  avatar: string; // JSON-encoded AvatarConfig
  /** Anonymous/API player id (maps the Colyseus session to quest progress). */
  playerId: string;
  /** Closed beta: invite pass from POST /beta/verify, or the account token (either satisfies the gate). */
  betaPass?: string;
  token?: string;
}

export interface InputMessage {
  x: number;
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
