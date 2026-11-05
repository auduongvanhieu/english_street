/**
 * Database backup without pg_dump: every table → one gzipped JSON-lines file ({"t":table,"r":row}), newest 14 kept.
 *
 *   pnpm --filter @es/api db:backup                 → $BACKUP_DIR (default ~/backups/english-street)
 *   pnpm --filter @es/api db:restore <file> --yes   → replaces every table with the file's rows
 *
 * Restore uses json_populate_record, so column types come from the live schema (run migrations first).
 */
import { createGzip, createGunzip } from 'node:zlib';
import { createReadStream, createWriteStream, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import pg from 'pg';
import { env } from '../src/env';

const KEEP = 14;
const PAGE = 2000;

async function tables(c: pg.Client): Promise<string[]> {
  const r = await c.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`);
  return r.rows.map((x) => x.tablename);
}

async function backup() {
  const dir = process.env.BACKUP_DIR || join(homedir(), 'backups', 'english-street');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const file = join(dir, `es-${stamp}.jsonl.gz`);
  const c = new pg.Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  const gz = createGzip();
  const out = createWriteStream(file, { mode: 0o600 });
  gz.pipe(out);
  const counts: Record<string, number> = {};
  // one snapshot for every table
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  for (const t of await tables(c)) {
    counts[t] = 0;
    for (let off = 0; ; off += PAGE) {
      const r = await c.query(`SELECT row_to_json(x) AS j FROM "${t}" x ORDER BY ctid LIMIT ${PAGE} OFFSET ${off}`);
      for (const row of r.rows) if (!gz.write(`{"t":${JSON.stringify(t)},"r":${JSON.stringify(row.j)}}\n`)) await once(gz, 'drain');
      counts[t] += r.rows.length;
      if (r.rows.length < PAGE) break;
    }
  }
  await c.query('COMMIT');
  await c.end();
  gz.end();
  await once(out, 'finish');
  const old = readdirSync(dir).filter((f) => /^es-.*\.jsonl\.gz$/.test(f)).sort().reverse().slice(KEEP);
  for (const f of old) rmSync(join(dir, f));
  console.log(`backup ${file}`, counts);
}

async function restore(file: string) {
  if (!process.argv.includes('--yes')) {
    console.error('This replaces EVERY table with the backup. Add --yes to go ahead.');
    process.exit(1);
  }
  const c = new pg.Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  await c.query('BEGIN');
  const all = await tables(c);
  await c.query(`TRUNCATE ${all.map((t) => `"${t}"`).join(', ')} CASCADE`);
  const counts: Record<string, number> = {};
  // parents first: users before the rows that point at them
  const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()) });
  const deferred: { t: string; r: unknown }[] = [];
  for await (const line of lines) {
    if (!line) continue;
    const { t, r } = JSON.parse(line) as { t: string; r: unknown };
    if (!all.includes(t)) continue;
    if (t !== 'User') {
      deferred.push({ t, r });
      continue;
    }
    await c.query(`INSERT INTO "User" SELECT * FROM json_populate_record(null::"User", $1)`, [JSON.stringify(r)]);
    counts.User = (counts.User ?? 0) + 1;
  }
  for (const { t, r } of deferred) {
    await c.query(`INSERT INTO "${t}" SELECT * FROM json_populate_record(null::"${t}", $1)`, [JSON.stringify(r)]);
    counts[t] = (counts[t] ?? 0) + 1;
  }
  await c.query('COMMIT');
  await c.end();
  console.log('restored', counts);
}

const [cmd, file] = process.argv.slice(2);
if (cmd === 'restore') await restore(file!);
else await backup();
