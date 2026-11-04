import { z } from 'zod';
import { CorrectionSchema, NpcTurnResponseSchema, VocabItemSchema } from './npc';
import { LangSchema } from '../i18n';
import { QuestGoalSchema, QuestAttemptStatusSchema } from './quest';

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  /** Subtitle (learner's language) for assistant lines (when subtitles were on for that turn). */
  content_tr: z.string().optional(),
  corrections: z.array(CorrectionSchema).optional(),
  goalsCompleted: z.array(z.string()).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** POST /quests/:id/start and POST /npc/:id/talk (free chat) */
export const StartSessionRequestSchema = z.object({
  /** Guest id; ignored when a bearer token identifies the player. */
  playerId: z.string().min(8).max(64).optional(),
  playerName: z.string().min(2).max(20),
});
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  npcId: z.string(),
  questId: z.string().nullable(),
  goals: z.array(QuestGoalSchema),
  goalsDone: z.array(z.string()),
  turns: z.number().int(),
  maxTurns: z.number().int(),
  messages: z.array(ChatMessageSchema),
  finished: z.boolean(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

/** POST /sessions/:id/chat */
export const SessionChatRequestSchema = z.object({
  playerId: z.string().min(8).max(64).optional(),
  text: z.string().min(1).max(500),
  source: z.enum(['text', 'voice']).default('text'),
  /** Ask the NPC to include a translation of its reply (reply_tr). */
  subtitles: z.boolean().optional(),
  /** Learner's language for explanations/meanings/subtitles; defaults to the profile's. */
  lang: LangSchema.optional(),
});
export type SessionChatRequest = z.infer<typeof SessionChatRequestSchema>;

export const AttemptSummarySchema = z.object({
  status: QuestAttemptStatusSchema,
  score: z.number().int(),
  goalsDone: z.array(z.string()),
  goalsTotal: z.number().int(),
  turns: z.number().int(),
  corrections: z.array(CorrectionSchema),
  vocab: z.array(VocabItemSchema),
  reward: z.object({ xp: z.number().int(), coins: z.number().int() }),
});
export type AttemptSummary = z.infer<typeof AttemptSummarySchema>;

export const SessionChatResponseSchema = z.object({
  turn: NpcTurnResponseSchema,
  state: SessionStateSchema,
  summary: AttemptSummarySchema.nullable(),
});
export type SessionChatResponse = z.infer<typeof SessionChatResponseSchema>;
