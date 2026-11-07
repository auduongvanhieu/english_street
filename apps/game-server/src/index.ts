import { config as loadDotenv } from 'dotenv';
import { findRootEnv } from '@es/shared/loadEnv';
import { createServer } from 'node:http';
// WebSocketTransport comes from the `colyseus` meta-package on purpose: importing it from
// `@colyseus/ws-transport` directly can resolve a second copy of @colyseus/core under pnpm, and then
// the matchmaker and the transport no longer share the room registry (every join fails with 4002).
import { Server, WebSocketTransport, matchMaker } from 'colyseus';
import { MSG, PlayerSettingsSchema, STREET_ROOM, type ZoneInfo } from '@es/shared';
import { ROOMS, StreetRoom } from './rooms/StreetRoom';
import { forget, mutes, startAdminLink, stopAdminLink } from './admin';
import { isInternalKey } from '@es/shared/token';

const envPath = findRootEnv(process.cwd());
if (envPath) loadDotenv({ path: envPath, quiet: true });

const port = Number(process.env.GAME_PORT ?? 2567);

// Colyseus owns the HTTP server and its router (/matchmake/*). Extra HTTP routes go through the
// `express` hook; a raw 'request' listener would race its router.
const httpServer = createServer();
let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
  express: (app) => {
    // Zone list for the picker (the 0.18 SDK has no room listing call). Private codes never leave the room.
    app.get('/zones', async (_req, res) => {
      const rooms = await matchMaker.query({ name: STREET_ROOM });
      const zones: ZoneInfo[] = rooms
        .map((r) => {
          const m = (r.metadata ?? {}) as Partial<ZoneInfo>;
          return { id: r.roomId, name: m.name ?? '?', kind: m.kind === 'custom' ? 'custom' : 'main', locked: !!m.locked, clients: r.clients, maxClients: r.maxClients } as ZoneInfo;
        })
        .sort((a, b) => (a.kind === b.kind ? b.clients - a.clients : a.kind === 'main' ? -1 : 1));
      res.setHeader('Cache-Control', 'no-store');
      res.json({ zones });
    });
    // Admin site (called by the API with the internal key; also reachable through nginx, hence the key).
    const internal = (req: { headers: Record<string, unknown> }) => isInternalKey(process.env.AUTH_SECRET ?? 'dev-secret-change-me', req.headers['x-internal-key']);
    app.get('/internal/online', (req, res) => {
      if (!internal(req)) return void res.status(403).json({ error: 'forbidden' });
      res.json({ players: [...ROOMS].flatMap((r) => r.listPlayers()), rooms: [...ROOMS].map((r) => ({ id: r.roomId, zone: r.zoneName(), clients: r.clients.length })) });
    });
    app.post('/internal/kick', (req, res) => {
      if (!internal(req)) return void res.status(403).json({ error: 'forbidden' });
      const q = req.query as Record<string, string | undefined>;
      const uid = String(q.uid ?? '');
      forget(uid);
      const n = uid ? [...ROOMS].reduce((s, r) => s + r.kick(uid, String(q.reason ?? 'Removed by a moderator.').slice(0, 200), q.banned === '1'), 0) : 0;
      res.json({ kicked: n });
    });
    app.post('/internal/mute', (req, res) => {
      if (!internal(req)) return void res.status(403).json({ error: 'forbidden' });
      const q = req.query as Record<string, string | undefined>;
      const uid = String(q.uid ?? '');
      const until = Number(q.until) || 0;
      if (uid) {
        forget(uid);
        if (until > Date.now()) mutes.set(uid, until);
        else mutes.delete(uid);
      }
      res.json({ ok: true });
    });
    app.post('/internal/settings', (req, res) => {
      if (!internal(req)) return void res.status(403).json({ error: 'forbidden' });
      const q = req.query as Record<string, string | undefined>;
      const uid = String(q.uid ?? '');
      let settings: unknown = null;
      try {
        settings = JSON.parse(String(q.s ?? 'null'));
      } catch {
        /* ignore */
      }
      const ok = PlayerSettingsSchema.safeParse(settings);
      const n = uid && ok.success ? [...ROOMS].reduce((s, r) => s + r.pushSettings(uid, ok.data), 0) : 0;
      res.json({ applied: n });
    });
    app.post('/internal/rename', (req, res) => {
      if (!internal(req)) return void res.status(403).json({ error: 'forbidden' });
      const q = req.query as Record<string, string | undefined>;
      const uid = String(q.uid ?? '');
      const n = uid ? [...ROOMS].reduce((s, r) => s + r.renameUser(uid, String(q.name ?? '')), 0) : 0;
      res.json({ renamed: n });
    });
    app.post('/internal/journey', (req, res) => {
      if (!internal(req)) return void res.status(403).json({ error: 'forbidden' });
      const q = req.query as Record<string, string | undefined>;
      const uid = String(q.uid ?? '');
      let ev: unknown = null;
      try {
        ev = JSON.parse(String(q.ev ?? 'null'));
      } catch {
        /* ignore */
      }
      const n = uid && ev && typeof ev === 'object' ? [...ROOMS].reduce((s, r) => s + r.sendToUser(uid, MSG.JOURNEY, ev), 0) : 0;
      res.json({ sent: n });
    });
    app.post('/internal/notice', (req, res) => {
      if (!internal(req)) return void res.status(403).json({ error: 'forbidden' });
      const q = req.query as Record<string, string | undefined>;
      const text = String(q.text ?? '').slice(0, 300);
      if (text) for (const r of ROOMS) r.notice(text, q.level === 'warning' ? 'warning' : 'info');
      res.json({ rooms: ROOMS.size });
    });
    app.get('/health', (_req, res) => {
      const stats = matchMaker.stats.local;
      const cpu = process.cpuUsage(lastCpu);
      const now = Date.now();
      const cpuPct = Math.round(((cpu.user + cpu.system) / 1000 / Math.max(1, now - lastCpuAt)) * 100);
      lastCpu = process.cpuUsage();
      lastCpuAt = now;
      res.json({ ok: true, service: 'game-server', rooms: stats.roomCount, clients: stats.ccu, uptime: Math.round(process.uptime()), rssMb: Math.round(process.memoryUsage().rss / 1048576), cpuPct });
    });
  },
});

// joinOrCreate({ zoneKind: 'main' }) only matches public Main Street rooms, never custom zones.
gameServer.define(STREET_ROOM, StreetRoom).filterBy(['zoneKind']);

// BIND_HOST=127.0.0.1 behind nginx: then only nginx can reach us and the client IP header (X-Real-IP) can't be faked.
startAdminLink();
gameServer.listen(port, process.env.BIND_HOST || '0.0.0.0').then(() => {
  console.log(`[game-server] listening on ws://localhost:${port}${process.env.BETA_CODES ? ' (closed beta: invite pass required)' : ''}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    console.log(`[game-server] ${sig}: shutting down`);
    void stopAdminLink()
      .catch(() => undefined)
      .then(() => gameServer.gracefullyShutdown(false))
      .then(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
