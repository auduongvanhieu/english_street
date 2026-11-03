import type { Correction, QuestAttemptStatus, VocabItem } from '@es/shared';
import { prisma } from '../plugins/prisma';

export interface AttemptRecord {
  id: string;
  userId: string;
  questId: string;
  npcId: string;
  status: QuestAttemptStatus;
  score: number | null;
  turns: number;
  goalsDone: string[];
  transcript: unknown;
  corrections: Correction[];
  startedAt: Date;
  finishedAt: Date | null;
}

export interface AttemptRepo {
  readonly name: string;
  ensureUser(id: string, name: string): Promise<{ cefrLevel: string; xp: number; coins: number }>;
  create(a: Omit<AttemptRecord, 'startedAt' | 'finishedAt'>): Promise<AttemptRecord>;
  update(id: string, patch: Partial<AttemptRecord>): Promise<void>;
  reward(userId: string, xp: number, coins: number): Promise<void>;
  saveVocab(userId: string, items: VocabItem[]): Promise<void>;
}

export class MemoryAttemptRepo implements AttemptRepo {
  readonly name = 'memory';
  users = new Map<string, { name: string; cefrLevel: string; xp: number; coins: number }>();
  attempts = new Map<string, AttemptRecord>();
  vocab = new Map<string, Map<string, VocabItem>>();

  async ensureUser(id: string, name: string) {
    const u = this.users.get(id) ?? { name, cefrLevel: 'A1', xp: 0, coins: 0 };
    u.name = name;
    this.users.set(id, u);
    return u;
  }
  async create(a: Omit<AttemptRecord, 'startedAt' | 'finishedAt'>) {
    const rec: AttemptRecord = { ...a, startedAt: new Date(), finishedAt: null };
    this.attempts.set(a.id, rec);
    return rec;
  }
  async update(id: string, patch: Partial<AttemptRecord>) {
    const r = this.attempts.get(id);
    if (r) Object.assign(r, patch);
  }
  async reward(userId: string, xp: number, coins: number) {
    const u = this.users.get(userId);
    if (u) {
      u.xp += xp;
      u.coins += coins;
    }
  }
  async saveVocab(userId: string, items: VocabItem[]) {
    const m = this.vocab.get(userId) ?? new Map();
    for (const v of items) m.set(v.word.toLowerCase(), v);
    this.vocab.set(userId, m);
  }
}

export class PrismaAttemptRepo implements AttemptRepo {
  readonly name = 'postgres';
  async ensureUser(id: string, name: string) {
    const u = await prisma.user.upsert({
      where: { id },
      create: { id, name },
      update: { name, lastActiveAt: new Date() },
      select: { cefrLevel: true, xp: true, coins: true },
    });
    return u;
  }
  async create(a: Omit<AttemptRecord, 'startedAt' | 'finishedAt'>) {
    const r = await prisma.questAttempt.create({
      data: {
        id: a.id,
        userId: a.userId,
        questId: a.questId,
        npcId: a.npcId,
        status: a.status,
        turns: a.turns,
        goalsDone: a.goalsDone,
        transcript: a.transcript as object,
        corrections: a.corrections as object[],
      },
    });
    return { ...r, corrections: r.corrections as Correction[] } as AttemptRecord;
  }
  async update(id: string, patch: Partial<AttemptRecord>) {
    const { transcript, corrections, ...rest } = patch;
    await prisma.questAttempt.update({
      where: { id },
      data: {
        ...rest,
        ...(transcript !== undefined ? { transcript: transcript as object } : {}),
        ...(corrections !== undefined ? { corrections: corrections as object[] } : {}),
      },
    });
  }
  async reward(userId: string, xp: number, coins: number) {
    await prisma.user.update({ where: { id: userId }, data: { xp: { increment: xp }, coins: { increment: coins } } });
  }
  async saveVocab(userId: string, items: VocabItem[]) {
    for (const v of items) {
      await prisma.vocabEntry.upsert({
        where: { userId_word: { userId, word: v.word } },
        create: { userId, word: v.word, meaningVi: v.meaning_vi, example: v.example },
        update: { meaningVi: v.meaning_vi, example: v.example },
      });
    }
  }
}

/** Postgres if reachable within 2 s, otherwise in-memory (dev machines without a DB). */
export async function createAttemptRepo(): Promise<AttemptRepo> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('db timeout')), 2000)),
    ]);
    return new PrismaAttemptRepo();
  } catch {
    return new MemoryAttemptRepo();
  }
}
