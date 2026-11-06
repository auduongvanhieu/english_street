import Fastify from 'fastify';
import cors from '@fastify/cors';
import { isBetaPass, isHumanPass } from '@es/shared/token';
import { env, isProd, webOrigins } from './env';
import { healthRoutes } from './routes/health';
import { contentRoutes } from './routes/content';
import { areaRoutes } from './routes/areas';
import { playRoutes } from './routes/play';
import { npcRoutes } from './routes/npc';
import { pairRoutes } from './routes/pair';
import { adminRoutes } from './routes/admin';
import { internalRoutes } from './routes/internal';
import { startStatsJob } from './admin/stats';
import { telemetryRoutes } from './routes/telemetry';
import { dictRoutes } from './routes/dict';
import { PairService, type PairSession } from './npc/pairService';
import { createNpcLlm } from './npc/llm';
import { registerAuth } from './auth';
import { accountRoutes } from './routes/account';
import { connectRedis, createStore, type Session } from './npc/store';
import { createAttemptRepo } from './npc/attempts';
import { MemoryFriendRepo, PrismaFriendRepo, setFriendRepo } from './friends';
import { friendRoutes } from './routes/friends';
import { NpcService } from './npc/service';
import { budget } from './npc/budget';
import { captcha } from './captcha';
import { limiter } from './npc/ratelimit';
import { enableModeration } from './moderation';
import { onSettingsChange, setting, startSettings } from './settings';
import { setProfanityWords } from '@es/shared';
import { startContent } from './admin/contentStore';
import { initTranslationJob } from './admin/translateJob';
import { enableAnnouncements, worldRoutes } from './routes/world';

// forceCloseConnections: a restart (tsx watch, systemd) must free the port immediately instead of waiting for keep-alive sockets.
const app = Fastify({ logger: isProd ? { level: 'info' } : true, trustProxy: env.TRUST_PROXY, forceCloseConnections: true });

const [redis, attempts] = await Promise.all([connectRedis(), createAttemptRepo()]);
const sessions = createStore<Session>(redis, 'sess');
const pairs = createStore<PairSession>(redis, 'pair');
const translations = createStore<{ text?: string; vi?: string }>(redis, 'tr', 30 * 24 * 3600); // translation cache: 30 days
const dbOn = attempts.name === 'postgres';
setFriendRepo(dbOn ? new PrismaFriendRepo() : new MemoryFriendRepo());
enableModeration(dbOn);
enableAnnouncements(dbOn);
onSettingsChange(() => setProfanityWords(setting('extraBannedWords'), setting('allowedWords')));
await startSettings(redis, dbOn);
await startContent(redis, dbOn);
if (dbOn) await initTranslationJob().catch(() => undefined);
budget.useRedis(redis);
limiter.useRedis(redis);
captcha.useRedis(redis);
const llm = createNpcLlm();
app.log.info({ llm: llm.name, sessions: sessions.name, attempts: attempts.name, betaGate: env.BETA_CODES.length > 0 }, 'npc backend');
if (llm.name === 'mock') app.log.warn('NPC provider is MOCK — set ANTHROPIC_API_KEY (and NPC_PROVIDER=claude) for real conversations');
if (env.AUTH_SECRET === 'dev-secret-change-me') app.log.warn('AUTH_SECRET is the default dev value — set a real secret in .env');
if (isProd && (sessions.name !== 'redis' || attempts.name !== 'postgres')) app.log.warn({ sessions: sessions.name, attempts: attempts.name }, 'production without Redis/Postgres: data is lost on restart');

await app.register(cors, { origin: webOrigins.length > 1 ? webOrigins : (webOrigins[0] ?? true) });
registerAuth(app);

// Closed beta: every write except sign-in needs a beta pass (x-beta-pass) or a signed-in account.
if (env.BETA_CODES.length > 0) {
  const open = new Set(['/auth/login', '/auth/guest', '/beta/verify', '/events', '/feedback']);
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0]!;
    if (req.method !== 'POST' || open.has(path) || path.startsWith('/admin') || path.startsWith('/internal')) return;
    if (req.authPlayerId || isBetaPass(env.AUTH_SECRET, req.headers['x-beta-pass'])) return;
    return reply.code(403).send({ error: 'beta_pass_required' });
  });
}

// Anti-spam: writes need a signed-in account or a guest human pass (captcha), so bots can't burn the
// NPC budget or fill the database. Sign-in / sign-up / the guest pass itself carry their own captcha.
{
  const open = new Set(['/auth/login', '/auth/register', '/auth/guest', '/beta/verify', '/events', '/me/push-token']);
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0]!;
    if (req.method !== 'POST' || open.has(path) || path.startsWith('/admin') || path.startsWith('/internal')) return;
    if (req.authPlayerId || isHumanPass(env.AUTH_SECRET, req.headers['x-human-pass'])) return;
    return reply.code(403).send({ error: 'human_check_required' });
  });
}

await app.register(healthRoutes);
await app.register(telemetryRoutes(attempts));
await app.register(accountRoutes(attempts));
await app.register(contentRoutes);
await app.register(friendRoutes);
await app.register(areaRoutes);
await app.register(worldRoutes);
await app.register(playRoutes(attempts));
const npcService = new NpcService(llm, sessions, attempts);
await app.register(npcRoutes(npcService));
await app.register(pairRoutes(new PairService(llm, attempts, pairs), attempts));
await app.register(dictRoutes(llm, translations, attempts));
await app.register(adminRoutes(attempts, npcService));
startStatsJob(dbOn);
await app.register(internalRoutes(dbOn));

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    app.log.info({ sig }, 'shutting down');
    void app.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}

app.listen({ port: env.API_PORT, host: env.BIND_HOST }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
