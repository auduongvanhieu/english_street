import { z } from 'zod';

/** Static NPC definition loaded from packages/quests/content/npcs/*.yaml */
export const NpcPersonaSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().describe('Job title, e.g. "Barista"'),
  shop: z.string().describe('Shop / location id on the street'),
  voice: z.string().default('en-US').describe('TTS voice hint'),
  personality: z.string(),
  knowledge: z.string().describe('Facts the NPC knows: menu, prices, hours…'),
  greeting: z.string(),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
});
export type NpcPersona = z.infer<typeof NpcPersonaSchema>;

export const NpcEmotionSchema = z.enum(['neutral', 'happy', 'confused', 'annoyed']);

export const CorrectionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation_vi: z.string(),
  type: z.enum(['grammar', 'vocabulary', 'spelling', 'register', 'other']),
});
export type Correction = z.infer<typeof CorrectionSchema>;

export const VocabItemSchema = z.object({
  word: z.string(),
  meaning_vi: z.string(),
  example: z.string(),
});
export type VocabItem = z.infer<typeof VocabItemSchema>;

/** Structured output returned by the LLM for one NPC turn. */
export const NpcTurnResponseSchema = z.object({
  reply: z.string(),
  /** Vietnamese translation of reply for subtitles; null unless the learner asked for subtitles. */
  reply_vi: z.string().nullable(),
  emotion: NpcEmotionSchema,
  goals_completed: z.array(z.string()),
  corrections: z.array(CorrectionSchema),
  new_vocab: z.array(VocabItemSchema),
  hint: z.string().nullable(),
});
export type NpcTurnResponse = z.infer<typeof NpcTurnResponseSchema>;

/** Request body for POST /npc/:id/chat */
export const NpcChatRequestSchema = z.object({
  questId: z.string().optional(),
  text: z.string().min(1).max(500),
  source: z.enum(['text', 'voice']).default('text'),
});
export type NpcChatRequest = z.infer<typeof NpcChatRequestSchema>;
