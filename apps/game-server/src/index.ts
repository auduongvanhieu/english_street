import { config as loadDotenv } from 'dotenv';
import { findRootEnv } from '@es/shared/loadEnv';
import { createServer } from 'node:http';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { STREET_ROOM } from '@es/shared';
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

gameServer.define(STREET_ROOM, StreetRoom);

gameServer.listen(port).then(() => {
  console.log(`[game-server] listening on ws://localhost:${port}${process.env.BETA_CODES ? ' (closed beta: invite pass required)' : ''}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    console.log(`[game-server] ${sig}: shutting down`);
    void gameServer.gracefullyShutdown(false).then(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
