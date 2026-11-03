import { Room, type Client } from 'colyseus';
import { MSG, PROXIMITY_RADIUS, STREET_ROOM_MAX_CLIENTS, type JoinOptions } from '@es/shared';
import { Player, StreetState } from './schema/StreetState';

const SPAWN = { x: 0, y: 0, z: 4 };
const WORLD_HALF = 40; // clamp players inside the street bounds
const BUBBLE_TTL_MS = 5000;

interface InputMsg {
  x: number;
  z: number;
  rot: number;
  anim: string;
}

export class StreetRoom extends Room<{ state: StreetState }> {
  maxClients = STREET_ROOM_MAX_CLIENTS;

  onCreate() {
    this.setState(new StreetState());
    this.setPatchRate(50); // 20 Hz state patches

    this.onMessage<InputMsg>(MSG.INPUT, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg !== 'object') return;
      // Server is authoritative: clamp to world bounds. Speed checks can be added later.
      p.x = clamp(Number(msg.x) || 0, -WORLD_HALF, WORLD_HALF);
      p.z = clamp(Number(msg.z) || 0, -WORLD_HALF, WORLD_HALF);
      p.rot = Number(msg.rot) || 0;
      p.anim = typeof msg.anim === 'string' ? msg.anim.slice(0, 16) : 'idle';
    });

    this.onMessage<string>(MSG.CHAT, (client, text) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof text !== 'string') return;
      const clean = text.trim().slice(0, 140);
      if (!clean) return;
      p.bubble = clean;
      p.bubbleAt = Date.now();
      // Deliver to nearby players only (proximity chat).
      for (const other of this.clients) {
        const q = this.state.players.get(other.sessionId);
        if (!q) continue;
        if (dist2(p, q) <= PROXIMITY_RADIUS * PROXIMITY_RADIUS) {
          other.send(MSG.CHAT, { from: p.id, name: p.name, text: clean });
        }
      }
    });

    this.setSimulationInterval(() => this.expireBubbles(), 1000);
  }

  onJoin(client: Client, options: Partial<JoinOptions>) {
    const p = new Player();
    p.id = client.sessionId;
    p.name = sanitizeName(options?.name) ?? `Guest-${client.sessionId.slice(0, 4)}`;
    p.avatar = typeof options?.avatar === 'string' ? options.avatar.slice(0, 512) : '{}';
    p.x = SPAWN.x + (Math.random() - 0.5) * 4;
    p.y = SPAWN.y;
    p.z = SPAWN.z + (Math.random() - 0.5) * 2;
    this.state.players.set(client.sessionId, p);
    console.log(`[street] ${p.name} joined (${this.clients.length}/${this.maxClients})`);
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`[street] ${p?.name ?? client.sessionId} left`);
  }

  private expireBubbles() {
    const now = Date.now();
    this.state.players.forEach((p: Player) => {
      if (p.bubble && now - p.bubbleAt > BUBBLE_TTL_MS) p.bubble = '';
    });
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function dist2(a: Player, b: Player) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}
function sanitizeName(n: unknown): string | undefined {
  if (typeof n !== 'string') return undefined;
  const s = n.replace(/[^\w\- ]/g, '').trim().slice(0, 20);
  return s.length >= 2 ? s : undefined;
}
