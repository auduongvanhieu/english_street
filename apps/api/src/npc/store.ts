import Redis from 'ioredis';
import type { ChatMessage, Correction, VocabItem } from '@es/shared';
import { env } from '../env';

export interface Session {
  id: string;
  playerId: string;
  playerName: string;
  npcId: string;
  questId: string | null;
  attemptId: string | null;
  history: ChatMessage[];
  goalsDone: string[];
  turns: number;
  maxTurns: number;
  corrections: Correction[];
  vocab: VocabItem[];
  finished: boolean;
  startedAt: number;
}

export interface SessionStore {
  readonly name: string;
  get(id: string): Promise<Session | null>;
  set(s: Session): Promise<void>;
  delete(id: string): Promise<void>;
}

const TTL_SEC = 60 * 60 * 2;

export class MemorySessionStore implements SessionStore {
  readonly name = 'memory';
  private map = new Map<string, { s: Session; exp: number }>();
  async get(id: string) {
    const e = this.map.get(id);
    if (!e) return null;
    if (e.exp < Date.now()) {
      this.map.delete(id);
      return null;
    }
    return e.s;
  }
  async set(s: Session) {
    this.map.set(s.id, { s, exp: Date.now() + TTL_SEC * 1000 });
    if (this.map.size > 5000) {
      const now = Date.now();
      for (const [k, v] of this.map) if (v.exp < now) this.map.delete(k);
    }
  }
  async delete(id: string) {
    this.map.delete(id);
  }
}

export class RedisSessionStore implements SessionStore {
  readonly name = 'redis';
  constructor(private redis: Redis) {}
  async get(id: string) {
    const raw = await this.redis.get(`sess:${id}`);
    return raw ? (JSON.parse(raw) as Session) : null;
  }
  async set(s: Session) {
    await this.redis.set(`sess:${s.id}`, JSON.stringify(s), 'EX', TTL_SEC);
  }
  async delete(id: string) {
    await this.redis.del(`sess:${id}`);
  }
}

/** Redis if reachable within 1.5 s, otherwise in-memory (dev machines without Redis). */
export async function createSessionStore(): Promise<SessionStore> {
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500 });
  try {
    await redis.connect();
    await redis.ping();
    return new RedisSessionStore(redis);
  } catch {
    redis.disconnect();
    return new MemorySessionStore();
  }
}
