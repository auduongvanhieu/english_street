import { config as loadDotenv } from 'dotenv';
import { findRootEnv } from '@es/shared/loadEnv';
import { createServer } from 'node:http';
// WebSocketTransport comes from the `colyseus` meta-package on purpose: importing it from
// `@colyseus/ws-transport` directly can resolve a second copy of @colyseus/core under pnpm, and then
// the matchmaker and the transport no longer share the room registry (every join fails with 4002).
import { Server, WebSocketTransport, matchMaker } from 'colyseus';
import { STREET_ROOM, type ZoneInfo } from '@es/shared';
import { StreetRoom } from './rooms/StreetRoom';

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
gameServer.listen(port, process.env.BIND_HOST || '0.0.0.0').then(() => {
  console.log(`[game-server] listening on ws://localhost:${port}${process.env.BETA_CODES ? ' (closed beta: invite pass required)' : ''}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    console.log(`[game-server] ${sig}: shutting down`);
    void gameServer.gracefullyShutdown(false).then(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
