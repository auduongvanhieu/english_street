import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { STREET_ROOM } from '@es/shared';
import { StreetRoom } from './rooms/StreetRoom';

const port = Number(process.env.GAME_PORT ?? 2567);

// Colyseus owns the HTTP server: it serves matchmaking routes (/matchmake/*) itself.
// Do NOT attach a custom request listener here; it would shadow those routes.
const httpServer = createServer();

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(STREET_ROOM, StreetRoom);

gameServer.listen(port).then(() => {
  console.log(`[game-server] listening on ws://localhost:${port}`);
});
