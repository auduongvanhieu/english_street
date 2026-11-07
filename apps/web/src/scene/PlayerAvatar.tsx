import { memo } from 'react';
import type { AvatarLook } from '@es/shared';
import { Chibi } from './chibi/Chibi';
import { HeldCritter, PetBuddy } from './Critters';
import { Dish } from './areas/Dish';
import { Trolley } from './areas/Trolley';
import { Snack } from './areas/Snack';

/** Chair seat height: a seated character is lifted onto it. */
const SEAT_Y = 0.3;
/** Swimming: sunk to the shoulders (the pool water is at about 0.2 m). */
const SWIM_Y = -0.62;

/** A player's character: an original chibi built from their look (see chibi/buildChibi.ts), hugging a pet if any, with their dish on the table when eating out. */
export const PlayerAvatar = memo(function PlayerAvatar({ look, anim, holding = '', prop = '' }: { look: AvatarLook; anim: string; holding?: string; prop?: string }) {
  const sit = anim === 'sit' || anim === 'eat';
  const swim = anim === 'swim' || anim === 'tread';
  return (
    <>
      <group position-y={sit ? SEAT_Y : swim ? SWIM_Y : 0}>
        <Chibi spec={look} anim={anim} hug={!!holding} />
      </group>
      {holding ? <HeldCritter id={holding} /> : null}
      {look.pet && look.pet !== 'none' && !swim ? <PetBuddy kind={look.pet} anim={anim} /> : null}
      {prop.startsWith('dish:') ? <Dish item={prop.slice(5)} /> : null}
      {prop.startsWith('cart:') && !sit ? <Trolley n={Number(prop.slice(5)) || 0} /> : null}
      {prop.startsWith('snack:') ? <Snack kind={prop.slice(6)} sit={sit} /> : null}
    </>
  );
});
