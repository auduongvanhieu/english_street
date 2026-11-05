import { ActionCircle } from './Hud';
import { useGame } from '../store/game';
import { CRITTERS } from '../world/critters';
import { toggleHug } from '../world/hold';
import { useT } from '../i18n';

/** "Hug Mochi" when a cat or dog is within reach, "Put Mochi down" while carrying one (F on desktop). */
const CRITTER_ICON: Record<string, string> = { cat: '🐱', shiba: '🐶', husky: '🐺', duck: '🦆', duckling: '🐤', rabbit: '🐰', kid: '🐐', lamb: '🐑', guineapig: '🐹' };

export function HugButton({ touch }: { touch: boolean }) {
  const near = useGame((s) => s.nearCritter);
  const holding = useGame((s) => (s.sessionId && s.players[s.sessionId]?.holding) || '');
  const busy = useGame((s) => s.panelNpc !== null);
  const t = useT();
  const id = holding || near;
  const c = CRITTERS.find((x) => x.id === id);
  if (!c || busy) return null;
  const label = holding ? t('Put {name} down', { name: c.name }) : t('Hug {name}', { name: c.name });
  if (touch) return <ActionCircle onClick={toggleHug} icon={holding ? '⬇️' : '🤗'} badge={CRITTER_ICON[c.kind]} label={label} color="bg-pink-400" />;
  return (
    <button type="button" onClick={toggleHug} className="pointer-events-auto rounded-full bg-pink-500/90 px-5 py-2.5 text-sm font-medium text-white shadow-lg ring-2 ring-pink-200">
      <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono">F</kbd> {holding ? '⬇️' : '🤗'} {label}
    </button>
  );
}
