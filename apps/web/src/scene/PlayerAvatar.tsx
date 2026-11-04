import { memo } from 'react';
import type { AvatarLook } from '@es/shared';
import { Chibi } from './chibi/Chibi';
import { HeldCritter } from './Critters';

/** A player's character: an original chibi built from their look (see chibi/buildChibi.ts), hugging a pet if any. */
export const PlayerAvatar = memo(function PlayerAvatar({ look, anim, holding = '' }: { look: AvatarLook; anim: string; holding?: string }) {
  return (
    <>
      <Chibi spec={look} anim={anim} hug={!!holding} />
      {holding ? <HeldCritter id={holding} /> : null}
    </>
  );
});
