import { useGame } from '../store/game';

export function InteractPrompt({ touch }: { touch: boolean }) {
  const target = useGame((s) => s.interactTarget);
  const panel = useGame((s) => s.panelNpc);
  const npc = useGame((s) => s.npcs.find((n) => n.id === target));
  const open = useGame((s) => s.openPanel);
  if (!npc || panel) return null;
  return (
    <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2">
      <button
        type="button"
        onClick={() => open(npc.id)}
        className="pointer-events-auto rounded-full bg-black/70 px-5 py-2.5 text-sm font-medium text-white shadow-lg ring-2 ring-yellow-300"
      >
        {touch ? 'Tap to talk to' : <><kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono">E</kbd> Talk to</>}{' '}
        <b>{npc.name}</b> <span className="opacity-70">· {npc.role}</span>
      </button>
    </div>
  );
}
