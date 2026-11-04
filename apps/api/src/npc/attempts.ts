import type { Correction, QuestAttemptStatus, ReviewGrade, VocabItem } from '@es/shared';
import { dailyQuestIds, scheduleReview, type CefrLevel } from '@es/shared';
import { loadQuests } from '@es/quests';
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

export interface UserRecord {
  id: string;
  email: string | null;
  name: string;
  passwordHash: string | null;
  cefrLevel: string;
  xp: number;
  coins: number;
  streak: number;
  lastActiveAt: Date;
  avatarConfig: unknown;
  placementDoneAt: Date | null;
  reviewsDone: number;
  nativeLang: string;
  gameState: unknown;
}

export interface VocabRecord {
  id: string;
  userId: string;
  word: string;
  meaning: string;
  lang: string;
  example: string;
  ease: number;
  intervalDays: number;
  nextReviewAt: Date;
}

export interface ReportInput {
  reporterId: string;
  targetPlayerId?: string;
  targetName: string;
  reason: string;
  details: string;
  context: unknown[];
}

export interface EventInput {
  name: string;
  playerId?: string | null;
  props?: Record<string, unknown>;
}
export interface EventRecord extends EventInput {
  createdAt: Date;
}
export interface FeedbackInput {
  playerId?: string | null;
  name: string;
  text: string;
  page: string;
  meta: Record<string, unknown>;
}

export const DAILY_BONUS_XP = 30;

export interface AttemptRepo {
  readonly name: string;
  /** Guest/anonymous or known user: upsert name, bump streak. */
  ensureUser(id: string, name: string): Promise<UserRecord>;
  getUser(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(u: { id: string; email: string; name: string; passwordHash: string }): Promise<UserRecord>;
  updateUser(id: string, patch: Partial<Pick<UserRecord, 'name' | 'cefrLevel' | 'avatarConfig' | 'placementDoneAt' | 'coins' | 'reviewsDone' | 'nativeLang' | 'gameState'>>): Promise<void>;
  /** Move a guest's attempts and vocabulary to a registered account. */
  transferGuest(guestId: string, userId: string): Promise<void>;

  create(a: Omit<AttemptRecord, 'startedAt' | 'finishedAt'>): Promise<AttemptRecord>;
  update(id: string, patch: Partial<AttemptRecord>): Promise<void>;
  listCompleted(userId: string): Promise<Pick<AttemptRecord, 'questId' | 'npcId' | 'finishedAt'>[]>;
  reward(userId: string, xp: number, coins: number): Promise<void>;
  /** Daily-board bonus if the quest is on today's board and not yet completed today. */
  dailyBonus(userId: string, questId: string): Promise<number>;

  saveVocab(userId: string, items: VocabItem[], lang: string): Promise<void>;
  listVocab(userId: string): Promise<VocabRecord[]>;
  reviewVocab(userId: string, id: string, grade: ReviewGrade): Promise<VocabRecord | null>;

  createReport(r: ReportInput): Promise<void>;
  listReports(limit: number): Promise<(ReportInput & { createdAt: Date })[]>;

  // ---- analytics / beta ----
  logEvent(e: EventInput): Promise<void>;
  listEventsSince(since: Date): Promise<EventRecord[]>;
  listAttemptsSince(since: Date): Promise<Pick<AttemptRecord, 'userId' | 'questId' | 'npcId' | 'status' | 'score' | 'turns' | 'startedAt' | 'finishedAt'>[]>;
  countUsers(): Promise<{ total: number; registered: number; activeSince: (d: Date) => Promise<number> }>;
  createFeedback(f: FeedbackInput): Promise<void>;
  listFeedback(limit: number): Promise<(FeedbackInput & { createdAt: Date })[]>;
  /** Mobile app push token (upsert; one row per device token). */
  savePushToken(playerId: string, token: string, platform: string): Promise<void>;
  listPushTokens(playerId: string): Promise<{ token: string; platform: string }[]>;
}

function bumpStreak(u: { streak: number; lastActiveAt: Date }, now = new Date()) {
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const diff = day(now) - day(u.lastActiveAt);
  if (diff === 1) u.streak += 1;
  else if (diff > 1) u.streak = 1;
  else if (u.streak === 0) u.streak = 1;
  u.lastActiveAt = now;
}

async function dailyBonusFor(repo: AttemptRepo, userId: string, questId: string): Promise<number> {
  const today = dailyQuestIds(loadQuests().map((q) => q.id), new Date());
  if (!today.includes(questId)) return 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const done = await repo.listCompleted(userId);
  // The attempt being finished is not yet marked completed, so any match is a previous completion today.
  return done.some((a) => a.questId === questId && a.finishedAt && a.finishedAt >= start) ? 0 : DAILY_BONUS_XP;
}

// ---------------------------------------------------------------- memory
export class MemoryAttemptRepo implements AttemptRepo {
  readonly name = 'memory';
  users = new Map<string, UserRecord>();
  attempts = new Map<string, AttemptRecord>();
  vocab = new Map<string, VocabRecord[]>();
  reports: (ReportInput & { createdAt: Date })[] = [];

  async ensureUser(id: string, name: string) {
    let u = this.users.get(id);
    if (!u) {
      u = { id, email: null, name, passwordHash: null, cefrLevel: 'A1', xp: 0, coins: 0, streak: 0, lastActiveAt: new Date(0), avatarConfig: {}, placementDoneAt: null, reviewsDone: 0, nativeLang: '', gameState: {} };
      this.users.set(id, u);
    }
    if (!u.email) u.name = name;
    bumpStreak(u);
    return u;
  }
  async getUser(id: string) {
    return this.users.get(id) ?? null;
  }
  async getUserByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email.toLowerCase()) ?? null;
  }
  async createUser(u: { id: string; email: string; name: string; passwordHash: string }) {
    const rec: UserRecord = { ...u, email: u.email.toLowerCase(), cefrLevel: 'A1', xp: 0, coins: 0, streak: 1, lastActiveAt: new Date(), avatarConfig: {}, placementDoneAt: null, reviewsDone: 0, nativeLang: '', gameState: {} };
    this.users.set(u.id, rec);
    return rec;
  }
  async updateUser(id: string, patch: Partial<UserRecord>) {
    const u = this.users.get(id);
    if (u) Object.assign(u, patch);
  }
  async transferGuest(guestId: string, userId: string) {
    const g = this.users.get(guestId);
    const u = this.users.get(userId);
    if (!g || !u) return;
    for (const a of this.attempts.values()) if (a.userId === guestId) a.userId = userId;
    const v = this.vocab.get(guestId);
    if (v) {
      for (const e of v) e.userId = userId;
      this.vocab.set(userId, [...(this.vocab.get(userId) ?? []), ...v]);
      this.vocab.delete(guestId);
    }
    u.xp += g.xp;
    u.coins += g.coins;
    u.cefrLevel = g.cefrLevel;
    u.placementDoneAt = g.placementDoneAt;
    this.users.delete(guestId);
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
  async listCompleted(userId: string) {
    return [...this.attempts.values()].filter((a) => a.userId === userId && a.status === 'completed');
  }
  async reward(userId: string, xp: number, coins: number) {
    const u = this.users.get(userId);
    if (u) {
      u.xp += xp;
      u.coins += coins;
    }
  }
  dailyBonus(userId: string, questId: string) {
    return dailyBonusFor(this, userId, questId);
  }

  async saveVocab(userId: string, items: VocabItem[], lang: string) {
    const list = this.vocab.get(userId) ?? [];
    for (const v of items) {
      const existing = list.find((e) => e.word.toLowerCase() === v.word.toLowerCase());
      if (existing) Object.assign(existing, { meaning: v.meaning, lang, example: v.example });
      else list.push({ id: `${userId}:${list.length + 1}`, userId, word: v.word, meaning: v.meaning, lang, example: v.example, ease: 2.5, intervalDays: 0, nextReviewAt: new Date() });
    }
    this.vocab.set(userId, list);
  }
  async listVocab(userId: string) {
    return [...(this.vocab.get(userId) ?? [])];
  }
  async reviewVocab(userId: string, id: string, grade: ReviewGrade) {
    const e = (this.vocab.get(userId) ?? []).find((x) => x.id === id);
    if (!e) return null;
    Object.assign(e, scheduleReview(grade, e.ease, e.intervalDays));
    const u = this.users.get(userId);
    if (u) u.reviewsDone += 1;
    return e;
  }

  async createReport(r: ReportInput) {
    this.reports.push({ ...r, createdAt: new Date() });
    console.warn(`[report] ${r.reporterId} reported ${r.targetName} (${r.reason}): ${r.details}`);
  }
  async listReports(limit: number) {
    return this.reports.slice(-limit).reverse();
  }

  events: EventRecord[] = [];
  feedback: (FeedbackInput & { createdAt: Date })[] = [];
  async logEvent(e: EventInput) {
    this.events.push({ ...e, createdAt: new Date() });
    if (this.events.length > 20_000) this.events.splice(0, this.events.length - 20_000);
  }
  async listEventsSince(since: Date) {
    return this.events.filter((e) => e.createdAt >= since);
  }
  async listAttemptsSince(since: Date) {
    return [...this.attempts.values()].filter((a) => a.startedAt >= since);
  }
  async countUsers() {
    const all = [...this.users.values()];
    return { total: all.length, registered: all.filter((u) => u.email).length, activeSince: async (d: Date) => all.filter((u) => u.lastActiveAt >= d).length };
  }
  async createFeedback(f: FeedbackInput) {
    this.feedback.push({ ...f, createdAt: new Date() });
  }
  async listFeedback(limit: number) {
    return this.feedback.slice(-limit).reverse();
  }
  pushTokens = new Map<string, { playerId: string; platform: string }>();
  async savePushToken(playerId: string, token: string, platform: string) {
    this.pushTokens.set(token, { playerId, platform });
  }
  async listPushTokens(playerId: string) {
    return [...this.pushTokens.entries()].filter(([, v]) => v.playerId === playerId).map(([token, v]) => ({ token, platform: v.platform }));
  }
}

// ---------------------------------------------------------------- postgres
export class PrismaAttemptRepo implements AttemptRepo {
  readonly name = 'postgres';

  async ensureUser(id: string, name: string) {
    const u = await prisma.user.upsert({ where: { id }, create: { id, name, lastActiveAt: new Date(0) }, update: {} });
    const s = { streak: u.streak, lastActiveAt: u.lastActiveAt };
    bumpStreak(s);
    const updated = await prisma.user.update({ where: { id }, data: { ...(u.email ? {} : { name }), streak: s.streak, lastActiveAt: s.lastActiveAt } });
    return updated as UserRecord;
  }
  async getUser(id: string) {
    return (await prisma.user.findUnique({ where: { id } })) as UserRecord | null;
  }
  async getUserByEmail(email: string) {
    return (await prisma.user.findUnique({ where: { email: email.toLowerCase() } })) as UserRecord | null;
  }
  async createUser(u: { id: string; email: string; name: string; passwordHash: string }) {
    return (await prisma.user.create({ data: { ...u, email: u.email.toLowerCase(), streak: 1 } })) as UserRecord;
  }
  async updateUser(id: string, patch: Parameters<AttemptRepo['updateUser']>[1]) {
    const { avatarConfig, gameState, ...rest } = patch;
    await prisma.user.update({
      where: { id },
      data: { ...rest, cefrLevel: rest.cefrLevel as CefrLevel | undefined, ...(avatarConfig !== undefined ? { avatarConfig: avatarConfig as object } : {}), ...(gameState !== undefined ? { gameState: gameState as object } : {}) },
    });
  }
  async transferGuest(guestId: string, userId: string) {
    const g = await prisma.user.findUnique({ where: { id: guestId } });
    if (!g) return;
    await prisma.$transaction([
      prisma.questAttempt.updateMany({ where: { userId: guestId }, data: { userId } }),
      prisma.vocabEntry.updateMany({ where: { userId: guestId }, data: { userId } }),
      prisma.user.update({ where: { id: userId }, data: { xp: { increment: g.xp }, coins: { increment: g.coins }, cefrLevel: g.cefrLevel, placementDoneAt: g.placementDoneAt } }),
      prisma.user.delete({ where: { id: guestId } }),
    ]);
  }

  async create(a: Omit<AttemptRecord, 'startedAt' | 'finishedAt'>) {
    const r = await prisma.questAttempt.create({
      data: { id: a.id, userId: a.userId, questId: a.questId, npcId: a.npcId, status: a.status, turns: a.turns, goalsDone: a.goalsDone, transcript: a.transcript as object, corrections: a.corrections as object[] },
    });
    return { ...r, corrections: r.corrections as Correction[] } as AttemptRecord;
  }
  async update(id: string, patch: Partial<AttemptRecord>) {
    const { transcript, corrections, ...rest } = patch;
    await prisma.questAttempt.update({
      where: { id },
      data: { ...rest, ...(transcript !== undefined ? { transcript: transcript as object } : {}), ...(corrections !== undefined ? { corrections: corrections as object[] } : {}) },
    });
  }
  async listCompleted(userId: string) {
    return prisma.questAttempt.findMany({ where: { userId, status: 'completed' }, select: { questId: true, npcId: true, finishedAt: true } });
  }
  async reward(userId: string, xp: number, coins: number) {
    await prisma.user.update({ where: { id: userId }, data: { xp: { increment: xp }, coins: { increment: coins } } });
  }
  dailyBonus(userId: string, questId: string) {
    return dailyBonusFor(this, userId, questId);
  }

  async saveVocab(userId: string, items: VocabItem[], lang: string) {
    for (const v of items) {
      await prisma.vocabEntry.upsert({
        where: { userId_word: { userId, word: v.word } },
        create: { userId, word: v.word, meaning: v.meaning, lang, example: v.example },
        update: { meaning: v.meaning, lang, example: v.example },
      });
    }
  }
  async listVocab(userId: string) {
    return prisma.vocabEntry.findMany({ where: { userId }, orderBy: { nextReviewAt: 'asc' } });
  }
  async reviewVocab(userId: string, id: string, grade: ReviewGrade) {
    const e = await prisma.vocabEntry.findFirst({ where: { id, userId } });
    if (!e) return null;
    const next = scheduleReview(grade, e.ease, e.intervalDays);
    const [updated] = await prisma.$transaction([
      prisma.vocabEntry.update({ where: { id }, data: next }),
      prisma.user.update({ where: { id: userId }, data: { reviewsDone: { increment: 1 } } }),
    ]);
    return updated;
  }

  async createReport(r: ReportInput) {
    await prisma.report.create({ data: { ...r, context: r.context as object[] } });
  }
  async listReports(limit: number) {
    const rows = await prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map((r) => ({ ...r, targetPlayerId: r.targetPlayerId ?? undefined, context: r.context as unknown[] }));
  }

  async logEvent(e: EventInput) {
    await prisma.event.create({ data: { name: e.name, playerId: e.playerId ?? null, props: (e.props ?? {}) as object } });
  }
  async listEventsSince(since: Date) {
    const rows = await prisma.event.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' }, take: 50_000 });
    return rows.map((r) => ({ name: r.name, playerId: r.playerId, props: r.props as Record<string, unknown>, createdAt: r.createdAt }));
  }
  async listAttemptsSince(since: Date) {
    return prisma.questAttempt.findMany({
      where: { startedAt: { gte: since } },
      select: { userId: true, questId: true, npcId: true, status: true, score: true, turns: true, startedAt: true, finishedAt: true },
    });
  }
  async countUsers() {
    const [total, registered] = await Promise.all([prisma.user.count(), prisma.user.count({ where: { email: { not: null } } })]);
    return { total, registered, activeSince: (d: Date) => prisma.user.count({ where: { lastActiveAt: { gte: d } } }) };
  }
  async createFeedback(f: FeedbackInput) {
    await prisma.feedback.create({ data: { ...f, playerId: f.playerId ?? null, meta: f.meta as object } });
  }
  async listFeedback(limit: number) {
    const rows = await prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map((r) => ({ ...r, meta: r.meta as Record<string, unknown> }));
  }
  async savePushToken(playerId: string, token: string, platform: string) {
    await prisma.pushToken.upsert({ where: { token }, create: { token, playerId, platform }, update: { playerId, platform } });
  }
  async listPushTokens(playerId: string) {
    return prisma.pushToken.findMany({ where: { playerId }, select: { token: true, platform: true } });
  }
}

/** Postgres if reachable within 2 s, otherwise in-memory (dev machines without a DB). */
export async function createAttemptRepo(): Promise<AttemptRepo> {
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, rej) => setTimeout(() => rej(new Error('db timeout')), 2000))]);
    return new PrismaAttemptRepo();
  } catch {
    return new MemoryAttemptRepo();
  }
}
