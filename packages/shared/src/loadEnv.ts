// (Node only) Load the monorepo root .env, then an app-local .env if present.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Walk up from `from` until a .env file is found; returns its path or null. */
export function findRootEnv(from: string): string | null {
  let dir = resolve(from);
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
