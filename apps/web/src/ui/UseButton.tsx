import { useGame } from '../store/game';
import { useNearUsable, useNearest } from '../world/usables';
import { ActionCircle } from './Hud';

/** Touch: a round action button for the nearest usable thing (door, lift, phone…), next to Talk. */
export function UseButton() {
  const near = useNearUsable((s) => s.near);
  const talk = useGame((s) => s.interactTarget);
  if (!near || talk) return null;
  return <ActionCircle onClick={() => useNearest()} icon={near.icon} label={near.disabled ?? near.label} color={near.disabled ? 'bg-gray-300' : 'bg-sky-300'} />;
}

/** Keyboard: "E · Open the door" under the player, like the talk prompt. */
export function UsePrompt() {
  const near = useNearUsable((s) => s.near);
  const talk = useGame((s) => s.interactTarget);
  const panel = useGame((s) => s.panelNpc);
  if (!near || talk || panel) return null;
  return (
    <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2">
      <button
        type="button"
        onClick={() => useNearest()}
        className={`pointer-events-auto rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-lg ring-2 ${near.disabled ? 'bg-black/50 ring-gray-300' : 'bg-black/70 ring-sky-300'}`}
      >
        {near.disabled ? null : (
          <>
            <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono">E</kbd>{' '}
          </>
        )}
        {near.icon} {near.disabled ?? near.label}
      </button>
    </div>
  );
}
