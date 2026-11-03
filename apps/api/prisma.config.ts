import { config as loadDotenv } from 'dotenv';
import { findRootEnv } from '@es/shared/loadEnv';

const envPath = findRootEnv(process.cwd());
if (envPath) loadDotenv({ path: envPath, quiet: true });
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://es:es@localhost:5432/english_street' },
});
