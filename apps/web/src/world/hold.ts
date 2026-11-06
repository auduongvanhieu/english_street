import { HOLDABLE_RE } from '@es/shared';
import { useGame } from '../store/game';
import { sendHold } from '../net/client';
import { critterSound } from '../audio/ambient';
import { useSettings } from '../store/settings';
import { CRITTERS } from './critters';
import { track } from '../net/analytics';
import { localHeading, localPos } from '../scene/LocalPlayer';
import { CHOMP_MS, enclosureAt, predatorPen } from './spots';
import { useWorld } from '../store/world';
import { t } from '../i18n';

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
    // in front of me; standing at a zoo fence, reach over it into the enclosure
    const sx = Math.sin(localHeading.y);
    const sz = Math.cos(localHeading.y);
    let d = 0.75;
    if (!enclosureAt(localPos.x, localPos.z) && enclosureAt(localPos.x + sx * 1.6, localPos.z + sz * 1.6)) d = 1.6;
    const x = localPos.x + sx * d;
    const z = localPos.z + sz * d;
    sendHold(`@${x.toFixed(2)},${z.toFixed(2)}`);
    const pen = predatorPen(x, z);
    const c = CRITTERS.find((k) => k.id === held);
    if (pen && c) {
      track('critter_eaten', { id: held, by: pen.item });
      window.setTimeout(() => useWorld.getState().pushLive({ text: t('Oh no! {animal} ate {name}!', { animal: `${pen.names[0]} the ${pen.item}`, name: c.name }), level: 'warning' }), CHOMP_MS);
    }
    return;
  }
  const id = useGame.getState().nearCritter;
  if (!id || holderOf(id)) return;
  sendHold(id);
  const c = CRITTERS.find((x) => x.id === id);
  if (c) critterSound(c.sound, Math.max(0.3, useSettings.getState().ambientVolume));
  track('critter_hug', { id });
}
