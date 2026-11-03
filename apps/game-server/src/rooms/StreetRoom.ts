import { Room, type Client } from 'colyseus';
import {
  MSG,
  PROXIMITY_RADIUS,
  STREET_ROOM_MAX_CLIENTS,
  WORLD_BOUNDS,
  maskProfanity,
  type InputMessage,
  type JoinOptions,
  type PairMessage,
  type RtcSignal,
} from '@es/shared';
import { Player, StreetState } from './schema/StreetState';

const SPAWN = { x: 0, y: 0, z: 4 };
const BUBBLE_TTL_MS = 5000;
/** Relay (voice signalling, pair quests) only works between players reasonably close to each other. */
const RELAY_RADIUS = PROXIMITY_RADIUS * 2;

export class StreetRoom extends Room<{ state: StreetState }> {
  maxClients = STREET_ROOM_MAX_CLIENTS;

  onCreate() {
    this.setState(new StreetState());
    this.setPatchRate(50); // 20 Hz state patches

    this.onMessage<InputMessage>(MSG.INPUT, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg !== 'object') return;
      // Server is authoritative: clamp to world bounds. Speed checks can be added later.
      p.x = clamp(Number(msg.x) || 0, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
      p.z = clamp(Number(msg.z) || 0, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);
      p.rot = Number(msg.rot) || 0;
      p.anim = typeof msg.anim === 'string' ? msg.anim.slice(0, 16) : 'idle';
      p.voice = msg.voice === true;
    });

    this.onMessage<string>(MSG.CHAT, (client, text) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof text !== 'string') return;
      const clean = maskProfanity(text.trim().slice(0, 140));
      if (!clean) return;
      p.bubble = clean;
      p.bubbleAt = Date.now();
      // Deliver to nearby players only (proximity chat).
      for (const other of this.clients) {
        const q = this.state.players.get(other.sessionId);
        if (!q) continue;
        if (dist2(p, q) <= PROXIMITY_RADIUS * PROXIMITY_RADIUS) {
          other.send(MSG.CHAT, { from: p.id, pid: p.pid, name: p.name, text: clean });
        }
      }
    });

    // WebRTC signalling: forward to one nearby peer, stamping the sender.
    this.onMessage<RtcSignal>(MSG.RTC, (client, msg) => {
      const target = this.relayTarget(client, msg?.to);
      if (!target) return;
      target.send(MSG.RTC, { ...msg, from: client.sessionId });
    });

    // Pair-quest coordination: invitations and transcript relay between two nearby players.
    this.onMessage<PairMessage>(MSG.PAIR, (client, msg) => {
      const target = this.relayTarget(client, msg?.to);
      if (!target) return;
      target.send(MSG.PAIR, { ...msg, from: client.sessionId });
    });

    this.setSimulationInterval(() => this.expireBubbles(), 1000);
  }

  onJoin(client: Client, options: Partial<JoinOptions>) {
    const p = new Player();
    p.id = client.sessionId;
    p.pid = typeof options?.playerId === 'string' ? options.playerId.slice(0, 64) : '';
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

  /** Resolve a relay target: must exist, not be the sender, and be within RELAY_RADIUS. */
  private relayTarget(from: Client, to: unknown): Client | null {
    if (typeof to !== 'string' || to === from.sessionId) return null;
    const a = this.state.players.get(from.sessionId);
    const b = this.state.players.get(to);
    if (!a || !b || dist2(a, b) > RELAY_RADIUS * RELAY_RADIUS) return null;
    return this.clients.find((c) => c.sessionId === to) ?? null;
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
  const s = maskProfanity(n.replace(/[^\w\- ]/g, '').trim().slice(0, 20));
  return s.length >= 2 ? s : undefined;
}
