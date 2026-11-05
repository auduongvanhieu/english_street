import { z } from 'zod';
import { CEFR_LEVELS } from '../constants';

export const QuestGoalSchema = z.object({
  id: z.string(),
  desc: z.string(),
});
export type QuestGoal = z.infer<typeof QuestGoalSchema>;

export const QuestSchema = z.object({
  id: z.string(),
  npc: z.string(),
  level: z.enum(CEFR_LEVELS),
  title: z.string(),
  intro: z.string().describe('Shown to the player before starting'),
  goals: z.array(QuestGoalSchema).min(1),
  target_vocab: z.array(z.string()).default([]),
  target_phrases: z.array(z.string()).default([]),
  max_turns: z.number().int().positive().default(12),
  reward: z.object({ xp: z.number().int(), coins: z.number().int() }).default({ xp: 50, coins: 10 }),
  /** Switched off in the admin site: kept, but not offered in the game. */
  disabled: z.boolean().optional(),
});
export type Quest = z.infer<typeof QuestSchema>;

export const QuestAttemptStatusSchema = z.enum(['active', 'completed', 'failed', 'abandoned']);
export type QuestAttemptStatus = z.infer<typeof QuestAttemptStatusSchema>;
