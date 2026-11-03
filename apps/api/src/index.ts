import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env';
import { healthRoutes } from './routes/health';
import { contentRoutes } from './routes/content';

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.WEB_ORIGIN });
await app.register(healthRoutes);
await app.register(contentRoutes);

app.listen({ port: env.API_PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
