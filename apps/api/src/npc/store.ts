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

/** Keyed JSON store with a TTL: NPC sessions, pair sessions. Redis in production, memory for dev. */
export interface KeyedStore<T> {
  readonly name: string;
  get(id: string): Promise<T | null>;
  set(id: string, value: T): Promise<void>;
  delete(id: string): Promise<void>;
}
export type SessionStore = KeyedStore<Session>;

const TTL_SEC = 60 * 60 * 2;

export class MemoryStore<T> implements KeyedStore<T> {
  readonly name = 'memory';
  private map = new Map<string, { v: T; exp: number }>();
  async get(id: string) {
    const e = this.map.get(id);
    if (!e) return null;
    if (e.exp < Date.now()) {
      this.map.delete(id);
      return null;
    }
    return e.v;
  }
  async set(id: string, v: T) {
    this.map.set(id, { v, exp: Date.now() + TTL_SEC * 1000 });
    if (this.map.size > 5000) {
      const now = Date.now();
      for (const [k, e] of this.map) if (e.exp < now) this.map.delete(k);
    }
  }
  async delete(id: string) {
    this.map.delete(id);
  }
}

export class RedisStore<T> implements KeyedStore<T> {
  readonly name = 'redis';
  constructor(
    private redis: Redis,
    private prefix: string,
    private ttl = TTL_SEC,
  ) {}
  async get(id: string) {
    const raw = await this.redis.get(`${this.prefix}:${id}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async set(id: string, v: T) {
    await this.redis.set(`${this.prefix}:${id}`, JSON.stringify(v), 'EX', this.ttl);
  }
  async delete(id: string) {
    await this.redis.del(`${this.prefix}:${id}`);
  }
}

/** Redis if reachable within 1.5 s, otherwise null (dev machines without Redis). */
export async function connectRedis(): Promise<Redis | null> {
  const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500 });
  try {
    await redis.connect();
    await redis.ping();
    return redis;
  } catch {
    redis.disconnect();
    return null;
  }
}

export function createStore<T>(redis: Redis | null, prefix: string, ttlSec = TTL_SEC): KeyedStore<T> {
  return redis ? new RedisStore<T>(redis, prefix, ttlSec) : new MemoryStore<T>();
}
