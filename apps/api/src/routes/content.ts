import type { FastifyInstance } from 'fastify';
import { loadNpcs, loadQuests, questsForNpc } from '@es/quests';

/** Static content: NPC list and quests (served from packages/quests YAML). */
export async function contentRoutes(app: FastifyInstance) {
  app.get('/npcs', async () =>
    loadNpcs().map(({ id, name, role, shop, position, greeting }) => ({
      id,
      name,
      role,
      shop,
      position,
      greeting,
      quests: questsForNpc(id).map(({ id, title, level }) => ({ id, title, level })),
    })),
  );

  app.get('/quests', async () => loadQuests());

  app.get<{ Params: { id: string } }>('/quests/:id', async (req, reply) => {
    const q = loadQuests().find((x) => x.id === req.params.id);
    if (!q) return reply.code(404).send({ error: 'quest_not_found' });
    return q;
  });
}
