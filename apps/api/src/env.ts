import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://es:es@localhost:5432/english_street'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  ANTHROPIC_API_KEY: z.string().optional(),
  NPC_MODEL: z.string().default('claude-opus-5-5'),
});

export const env = EnvSchema.parse(process.env);
