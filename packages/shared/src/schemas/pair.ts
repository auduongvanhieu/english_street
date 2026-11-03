import { z } from 'zod';
import { CEFR_LEVELS } from '../constants';
import { QuestGoalSchema } from './quest';
import { CorrectionSchema, NpcTurnResponseSchema } from './npc';
import { AttemptSummarySchema } from './session';

export const PairRoleSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** What this player is told before starting (their side of the situation). */
  brief: z.string(),
  /** Facts only this role knows (e.g. the waiter knows the menu). */
  facts: z.string().default(''),
  goals: z.array(QuestGoalSchema).min(1),
});
export type PairRole = z.infer<typeof PairRoleSchema>;

/** A two-player role-play judged by an NPC (packages/quests/content/pair-quests). */
export const PairQuestSchema = z.object({
  id: z.string(),
  npc: z.string(),
  level: z.enum(CEFR_LEVELS),
  title: z.string(),
  intro: z.string(),
  roles: z.tuple([PairRoleSchema, PairRoleSchema]),
  target_vocab: z.array(z.string()).default([]),
  target_phrases: z.array(z.string()).default([]),
  /** Max lines per player. */
  max_turns: z.number().int().positive().default(8),
  reward: z.object({ xp: z.number().int(), coins: z.number().int() }).default({ xp: 80, coins: 20 }),
});
export type PairQuest = z.infer<typeof PairQuestSchema>;

export const PairPlayerSchema = z.object({ playerId: z.string(), name: z.string(), role: z.string() });

export const PairLineSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  role: z.string(),
  content: z.string(),
  corrections: z.array(CorrectionSchema).optional(),
  goalsCompleted: z.array(z.string()).optional(),
  /** Short aside from the judging NPC, if any. */
  judge: z.string().nullable().optional(),
});
export type PairLine = z.infer<typeof PairLineSchema>;

export const PairSessionStateSchema = z.object({
  sessionId: z.string(),
  questId: z.string(),
  npcId: z.string(),
  players: z.tuple([PairPlayerSchema, PairPlayerSchema]),
  roles: z.tuple([PairRoleSchema, PairRoleSchema]),
  /** role id -> goal ids done */
  goalsDone: z.record(z.string(), z.array(z.string())),
  /** playerId -> lines spoken */
  turns: z.record(z.string(), z.number().int()),
  maxTurns: z.number().int(),
  messages: z.array(PairLineSchema),
  finished: z.boolean(),
});
export type PairSessionState = z.infer<typeof PairSessionStateSchema>;

export const PairStartRequestSchema = z.object({
  questId: z.string(),
  players: z.tuple([
    z.object({ playerId: z.string().min(8), name: z.string().min(2).max(20) }),
    z.object({ playerId: z.string().min(8), name: z.string().min(2).max(20) }),
  ]),
});

export const PairChatResponseSchema = z.object({
  turn: NpcTurnResponseSchema,
  state: PairSessionStateSchema,
  summaries: z.record(z.string(), AttemptSummarySchema).nullable(),
});
export type PairChatResponse = z.infer<typeof PairChatResponseSchema>;

export const ReportRequestSchema = z.object({
  reporterId: z.string().min(8).max(64),
  targetName: z.string().min(1).max(40),
  targetPlayerId: z.string().max(64).optional(),
  reason: z.enum(['harassment', 'spam', 'inappropriate', 'cheating', 'other']),
  details: z.string().max(500).default(''),
  context: z.array(z.object({ name: z.string(), text: z.string() })).max(20).default([]),
});
export type ReportRequest = z.infer<typeof ReportRequestSchema>;
