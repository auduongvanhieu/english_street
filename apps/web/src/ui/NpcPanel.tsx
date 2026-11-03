import { useGame } from '../store/game';

/** Phase 1 placeholder: shows the NPC greeting and available quests. Phase 2 adds the chat. */
export function NpcPanel() {
  const id = useGame((s) => s.panelNpc);
  const npc = useGame((s) => s.npcs.find((n) => n.id === id));
  const close = useGame((s) => s.closePanel);
  if (!npc) return null;
  return (
    <div className="absolute inset-0 flex items-end justify-center bg-black/20 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{npc.name}</h2>
            <p className="text-sm text-gray-500">{npc.role}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕ <span className="hidden sm:inline">Esc</span>
          </button>
        </div>
        <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-blue-900">“{npc.greeting}”</p>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quests</h3>
        <ul className="space-y-2">
          {npc.quests.map((q) => (
            <li key={q.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <span>
                <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{q.level}</span>
                {q.title}
              </span>
              <button
                type="button"
                disabled
                title="Conversation arrives in Phase 2"
                className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white opacity-50"
              >
                Start
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
