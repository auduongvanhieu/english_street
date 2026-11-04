import { memo } from 'react';
import type { AvatarLook } from '@es/shared';
import { Chibi } from './chibi/Chibi';

/** A player's character: an original chibi built from their look (see chibi/buildChibi.ts). */
export const PlayerAvatar = memo(function PlayerAvatar({ look, anim }: { look: AvatarLook; anim: string }) {
  return <Chibi spec={look} anim={anim} />;
});
