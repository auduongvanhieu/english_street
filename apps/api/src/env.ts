import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { findRootEnv } from '@es/shared/loadEnv';

// Load the nearest .env walking up from the API folder (the monorepo root in dev).
const envPath = findRootEnv(process.cwd());
if (envPath) loadDotenv({ path: envPath, quiet: true });

const EnvSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://es:es@localhost:5432/english_street'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  ANTHROPIC_API_KEY: z.string().optional(),
  NPC_MODEL: z.string().default('claude-opus-5-5'),
  /** claude | mock | auto (claude when a real key is present, otherwise mock) */
  NPC_PROVIDER: z.enum(['claude', 'mock', 'auto']).default('auto'),
  /** Max NPC turns per player per minute */
  NPC_RATE_PER_MIN: z.coerce.number().default(20),
});

export const env = EnvSchema.parse(process.env);

export const hasRealApiKey = () =>
  !!env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.startsWith('sk-ant-') && env.ANTHROPIC_API_KEY.length > 20;
