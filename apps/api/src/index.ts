import Fastify from 'fastify';
import cors from '@fastify/cors';
import { isBetaPass } from '@es/shared/token';
import { env, isProd, webOrigins } from './env';
import { healthRoutes } from './routes/health';
import { contentRoutes } from './routes/content';
import { npcRoutes } from './routes/npc';
import { pairRoutes } from './routes/pair';
import { adminRoutes } from './routes/admin';
import { telemetryRoutes } from './routes/telemetry';
import { dictRoutes } from './routes/dict';
import { PairService, type PairSession } from './npc/pairService';
import { createNpcLlm } from './npc/llm';
import { registerAuth } from './auth';
import { accountRoutes } from './routes/account';
import { connectRedis, createStore, type Session } from './npc/store';
import { createAttemptRepo } from './npc/attempts';
import { NpcService } from './npc/service';
import { budget } from './npc/budget';
import { limiter } from './npc/ratelimit';

// forceCloseConnections: a restart (tsx watch, systemd) must free the port immediately instead of waiting for keep-alive sockets.
const app = Fastify({ logger: isProd ? { level: 'info' } : true, trustProxy: env.TRUST_PROXY, forceCloseConnections: true });

const [redis, attempts] = await Promise.all([connectRedis(), createAttemptRepo()]);
const sessions = createStore<Session>(redis, 'sess');
const pairs = createStore<PairSession>(redis, 'pair');
const translations = createStore<{ vi: string }>(redis, 'tr', 30 * 24 * 3600); // translation cache: 30 days
budget.useRedis(redis);
limiter.useRedis(redis);
const llm = createNpcLlm();
app.log.info({ llm: llm.name, sessions: sessions.name, attempts: attempts.name, betaGate: env.BETA_CODES.length > 0 }, 'npc backend');
if (llm.name === 'mock') app.log.warn('NPC provider is MOCK — set ANTHROPIC_API_KEY (and NPC_PROVIDER=claude) for real conversations');
if (env.AUTH_SECRET === 'dev-secret-change-me') app.log.warn('AUTH_SECRET is the default dev value — set a real secret in .env');
if (isProd && (sessions.name !== 'redis' || attempts.name !== 'postgres')) app.log.warn({ sessions: sessions.name, attempts: attempts.name }, 'production without Redis/Postgres: data is lost on restart');

await app.register(cors, { origin: webOrigins.length > 1 ? webOrigins : (webOrigins[0] ?? true) });
registerAuth(app);

// Closed beta: every write except sign-in needs a beta pass (x-beta-pass) or a signed-in account.
if (env.BETA_CODES.length > 0) {
  const open = new Set(['/auth/login', '/beta/verify', '/events', '/feedback']);
  app.addHook('onRequest', async (req, reply) => {
    if (req.method !== 'POST' || open.has(req.url.split('?')[0]!)) return;
    if (req.authPlayerId || isBetaPass(env.AUTH_SECRET, req.headers['x-beta-pass'])) return;
    return reply.code(403).send({ error: 'beta_pass_required' });
  });
}

await app.register(healthRoutes);
await app.register(telemetryRoutes(attempts));
await app.register(accountRoutes(attempts));
await app.register(contentRoutes);
await app.register(npcRoutes(new NpcService(llm, sessions, attempts)));
await app.register(pairRoutes(new PairService(llm, attempts, pairs), attempts));
await app.register(dictRoutes(llm, translations, attempts));
await app.register(adminRoutes(attempts));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    app.log.info({ sig }, 'shutting down');
    void app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}

app.listen({ port: env.API_PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
