/** Messages exchanged between client and the Colyseus street room. */

export type ClientToServer =
  | { type: 'input'; x: number; z: number; rot: number; anim: string }
  | { type: 'chat'; text: string }
  | { type: 'emote'; name: string };

export const MSG = {
  INPUT: 'input',
  CHAT: 'chat',
  EMOTE: 'emote',
} as const;

export interface JoinOptions {
  name: string;
  avatar: string; // JSON-encoded AvatarConfig
}
