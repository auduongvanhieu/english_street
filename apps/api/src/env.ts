import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { findRootEnv } from '@es/shared/loadEnv';

// Load the nearest .env walking up from the API folder (the monorepo root in dev).
const envPath = findRootEnv(process.cwd());
if (envPath) loadDotenv({ path: envPath, quiet: true });

const csv = (s: string | undefined) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().default('postgresql://es:es@localhost:5432/english_street'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  /** Allowed browser origins (comma-separated). */
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  /** Set when running behind a reverse proxy (Caddy/nginx) so req.ip is the real client address. */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((s) => s === 'true' || s === '1'),
  ANTHROPIC_API_KEY: z.string().optional(),
  NPC_MODEL: z.string().default('claude-opus-5-5'),
  /** claude | mock | auto (claude when a real key is present, otherwise mock) */
  NPC_PROVIDER: z.enum(['claude', 'mock', 'auto']).default('auto'),
  /** Max NPC turns per player per minute */
  NPC_RATE_PER_MIN: z.coerce.number().default(20),
  /** Cheaper model for A1–A2 quests and free chat (set equal to NPC_MODEL to disable routing). */
  NPC_MODEL_BASIC: z.string().default('claude-haiku-5-5'),
  /** Model for translating the UI and the learning content (scripts/i18n-translate.ts, admin auto-translate). */
  TRANSLATE_MODEL: z.string().default('claude-sonnet-5-5'),
  /** Anti-abuse: NPC turns per player per day, and a global daily spend ceiling (USD, estimated from usage). */
  NPC_DAILY_TURNS_PER_PLAYER: z.coerce.number().default(60),
  NPC_DAILY_BUDGET_USD: z.coerce.number().default(5),
  /** How many recent messages are sent to the model (older ones are dropped). */
  NPC_HISTORY_MAX: z.coerce.number().default(10),
  /** Secret for signing auth tokens and beta passes (shared with the game server). */
  AUTH_SECRET: z.string().default('dev-secret-change-me'),
  /** Bearer token for /admin/* routes. Unset = admin routes open in development, closed in production. */
  ADMIN_TOKEN: z.string().optional(),
  /** Closed beta: comma-separated invite codes. Empty = open to everyone. */
  BETA_CODES: z.string().optional().transform(csv),
  /** Cloudflare Turnstile (sign-in / sign-up). Without them the built-in image captcha is used. */
  TURNSTILE_SITE_KEY: z.string().default(''),
  TURNSTILE_SECRET: z.string().default(''),
  /** Password-reset codes by e-mail: SMTP (e.g. Gmail with an app password) or Resend (https://resend.com). */
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('English Street <no-reply@englishstreet.coffeesos.online>'),
  /** 127.0.0.1 behind a reverse proxy (only it can reach the API; client IP headers can't be faked). */
  BIND_HOST: z.string().default('0.0.0.0'),
  /** Guest passes (POST /auth/guest) one IP may get per hour / per day. */
  GUEST_PASSES_PER_IP_HOUR: z.coerce.number().int().positive().default(10),
  GUEST_PASSES_PER_IP_DAY: z.coerce.number().int().positive().default(30),
});

export const env = EnvSchema.parse(process.env);
export const isProd = env.NODE_ENV === 'production';
export const webOrigins = csv(env.WEB_ORIGIN);

if (isProd && env.AUTH_SECRET === 'dev-secret-change-me') {
  console.error('[api] refusing to start in production with the default AUTH_SECRET');
  process.exit(1);
}

export const hasRealApiKey = () =>
  !!env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.startsWith('sk-ant-') && env.ANTHROPIC_API_KEY.length > 20;
