import { z } from 'zod';
import { CEFR_LEVELS } from '../constants';

export const AvatarConfigSchema = z.object({
  body: z.enum(['a', 'b']).default('a'),
  skin: z.string().default('#e0b090'),
  hair: z.string().default('#3a2a1a'),
  outfit: z.string().default('casual-01'),
});
export type AvatarConfig = z.infer<typeof AvatarConfigSchema>;

export const PlayerProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(20),
  cefrLevel: z.enum(CEFR_LEVELS).default('A1'),
  xp: z.number().int().nonnegative().default(0),
  coins: z.number().int().nonnegative().default(0),
  avatar: AvatarConfigSchema,
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const PlayerAnimSchema = z.enum(['idle', 'walk', 'run', 'talk', 'wave']);
export type PlayerAnim = z.infer<typeof PlayerAnimSchema>;
