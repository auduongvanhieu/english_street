import { useCallback, useEffect } from 'react';
import type { AvatarLook } from '@es/shared';
import { useArea } from '../store/area';
import { useFitting } from '../store/fitting';
import { Wardrobe } from './area/activities/Clothes';
import { useT } from '../i18n';

/** In a fitting room: the wardrobe card on the side; what you pick is on your character, in the mirror. */
export function FittingHud() {
  const t = useT();
  const room = useFitting((s) => s.room);
  const content = useArea((s) => s.content.clothes);
  useEffect(() => {
    if (room !== null && !content) void useArea.getState().load('clothes');
  }, [room, content]);
  const onLook = useCallback((l: AvatarLook) => useFitting.getState().setLook(l), []);
  if (room === null || !content) return null;
  return (
    <div data-ui className="pointer-events-none absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)] right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-30 flex w-[min(22rem,58vw)] flex-col">
      <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white/95 px-3 shadow-2xl">
        <p className="pt-2 text-xs text-gray-500">🪞 {t('Look in the mirror! Pick clothes, then wear them or leave.')}</p>
        <Wardrobe content={content} compact onLook={onLook} onExit={() => useFitting.getState().leave()} />
      </div>
    </div>
  );
}
