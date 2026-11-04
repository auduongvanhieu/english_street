import { memo, Suspense, useMemo } from 'react';
import type { AvatarLook } from '@es/shared';
import { Character } from './Character';
import { Human } from './Human';
import { lookToHuman } from './playerLook';

/** A player's character: a recoloured Quaternius human with accessories, or the classic robot. */
export const PlayerAvatar = memo(function PlayerAvatar({ look, anim }: { look: AvatarLook; anim: string }) {
  const human = useMemo(() => lookToHuman(look), [look]);
  return (
    <Suspense fallback={null}>
      {human ? <Human key={human.model} look={human} anim={anim} /> : <Character anim={anim} tint={look.top} />}
    </Suspense>
  );
});
