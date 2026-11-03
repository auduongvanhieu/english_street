import type { FastifyInstance } from 'fastify';
import { loadNpcs, loadPairQuests, loadQuests, pairQuestsForNpc, questsForNpc } from '@es/quests';
import { CEFR_LEVELS } from '@es/shared';

/** Easiest first, then alphabetical. */
const byLevel = <T extends { level: string; title: string }>(a: T, b: T) =>
  (CEFR_LEVELS as readonly string[]).indexOf(a.level) - (CEFR_LEVELS as readonly string[]).indexOf(b.level) || a.title.localeCompare(b.title);

/** Static content: NPC list and quests (served from packages/quests YAML). */
export async function contentRoutes(app: FastifyInstance) {
  app.get('/npcs', async () =>
    loadNpcs().map(({ id, name, role, shop, position, greeting, voice }) => ({
      id,
      name,
      role,
      shop,
      position,
      greeting,
      voice,
      quests: [...questsForNpc(id)].sort(byLevel).map(({ id, title, level }) => ({ id, title, level })),
      pairQuests: [...pairQuestsForNpc(id)].sort(byLevel).map(({ id, title, level, roles }) => ({ id, title, level, roles: roles.map((r) => ({ id: r.id, label: r.label })) })),
    })),
  );

  app.get('/quests', async () => loadQuests());
  app.get('/pair-quests', async () => loadPairQuests());

  app.get<{ Params: { id: string } }>('/quests/:id', async (req, reply) => {
    const q = loadQuests().find((x) => x.id === req.params.id);
    if (!q) return reply.code(404).send({ error: 'quest_not_found' });
    return q;
  });
}
