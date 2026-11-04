import { HOLDABLE_RE } from '@es/shared';
import { useGame } from '../store/game';
import { sendHold } from '../net/client';
import { critterSound } from '../audio/ambient';
import { useSettings } from '../store/settings';
import { CRITTERS } from './critters';
import { track } from '../net/analytics';

/** Critters currently in someone's arms (refreshed every frame by Critters.tsx). */
export const heldCritters = new Set<string>();

/** Hug reach (m) from the player's centre to the critter's centre (ducks: reach into the water from the bank). */
export const HUG_RADIUS = 1.7;
export const hugRadius = (id: string) => (id.startsWith('duck') ? 2.6 : HUG_RADIUS);

export const holdable = (id: string) => HOLDABLE_RE.test(id);

/** Player (session id) hugging this critter, if any. */
export function holderOf(critterId: string): string | null {
  const players = useGame.getState().players;
  for (const id in players) if (players[id]!.holding === critterId) return id;
  return null;
}

/** What the local player is hugging ('' = nothing). */
export function myHolding(): string {
  const s = useGame.getState();
  return (s.sessionId && s.players[s.sessionId]?.holding) || '';
}

/** F / the Hug button: pick up the nearby cat or dog, or put down the one in your arms. */
export function toggleHug() {
  const held = myHolding();
  if (held) {
    sendHold('');
    return;
  }
  const id = useGame.getState().nearCritter;
  if (!id || holderOf(id)) return;
  sendHold(id);
  const c = CRITTERS.find((x) => x.id === id);
  if (c) critterSound(c.sound, Math.max(0.3, useSettings.getState().ambientVolume));
  track('critter_hug', { id });
}
