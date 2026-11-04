import { memo } from 'react';
import type { AvatarLook } from '@es/shared';
import { Chibi } from './chibi/Chibi';
import { HeldCritter } from './Critters';
import { Dish } from './areas/Dish';

/** Chair seat height: a seated character is lifted onto it. */
const SEAT_Y = 0.3;

/** A player's character: an original chibi built from their look (see chibi/buildChibi.ts), hugging a pet if any, with their dish on the table when eating out. */
export const PlayerAvatar = memo(function PlayerAvatar({ look, anim, holding = '', prop = '' }: { look: AvatarLook; anim: string; holding?: string; prop?: string }) {
  const sit = anim === 'sit';
  return (
    <>
      <group position-y={sit ? SEAT_Y : 0}>
        <Chibi spec={look} anim={anim} hug={!!holding} />
      </group>
      {holding ? <HeldCritter id={holding} /> : null}
      {prop.startsWith('dish:') ? <Dish item={prop.slice(5)} /> : null}
    </>
  );
});
