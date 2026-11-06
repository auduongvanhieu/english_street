import { z } from 'zod';
import { LangSchema } from './i18n';

/**
 * A player's in-game settings (store/settings.ts + language + voice mute). The game reports them to the API
 * (admin site shows them); an admin can change them, and the game server pushes the change to the player's open
 * game (MSG.SETTINGS) — or the game applies it on the next join.
 */
export const PlayerSettingsSchema = z.object({
  quality: z.enum(['high', 'low']).optional(),
  lang: LangSchema.optional(),
  subtitles: z.enum(['on', 'off']).optional(),
  ipa: z.boolean().optional(),
  ttsRate: z.number().min(0.5).max(1.5).optional(),
  muted: z.boolean().optional(),
  ambientVolume: z.number().min(0).max(1).optional(),
  micMode: z.enum(['tap', 'hold']).optional(),
  skyTime: z.enum(['system', 'morning', 'noon', 'sunset', 'night']).optional(),
  skyWeather: z.enum(['system', 'clear', 'cloudy', 'rain', 'storm', 'fog']).optional(),
});
export type PlayerSettings = z.infer<typeof PlayerSettingsSchema>;
