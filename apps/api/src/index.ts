import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { contentRoutes } from './routes/content';
import { npcRoutes } from './routes/npc';
import { createNpcLlm } from './npc/llm';
import { createSessionStore } from './npc/store';
import { createAttemptRepo } from './npc/attempts';
import { NpcService } from './npc/service';

const app = Fastify({ logger: true });

const [sessions, attempts] = await Promise.all([createSessionStore(), createAttemptRepo()]);
const llm = createNpcLlm();
app.log.info({ llm: llm.name, sessions: sessions.name, attempts: attempts.name }, 'npc backend');
if (llm.name === 'mock') app.log.warn('NPC provider is MOCK — set ANTHROPIC_API_KEY (and NPC_PROVIDER=claude) for real conversations');

await app.register(cors, { origin: env.WEB_ORIGIN });
await app.register(healthRoutes);
await app.register(contentRoutes);
await app.register(npcRoutes(new NpcService(llm, sessions, attempts)));

app.listen({ port: env.API_PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
