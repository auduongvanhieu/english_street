/**
 * Interface translations for the web app (gettext style: the English string is the key).
 *
 *   pnpm --filter @es/api i18n:translate          extract t('…') keys, translate what is missing (Claude)
 *   pnpm --filter @es/api i18n:translate --check  fail if any catalog misses a key (no API calls)
 *   … --only=es,ja                                limit to some languages
 *   … --content                                   area learning content instead (packages/quests/content/areas/i18n)
 *
 * Keys: every literal first argument of t('…') / t("…") in apps/web/src. Catalogs:
 * apps/web/src/i18n/locales/<code>.json (sorted, stale keys removed). Placeholders like {name} must survive.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { translate } from '../src/i18n/translate';
import { AREA_IDS, LANGS, areaTrKeys, BADGES } from '@es/shared';
import { AREA_I18N_DIR, getArea } from '@es/quests';
import { env } from '../src/env';

const ROOT = resolve(import.meta.dirname, '../../..');
const SRC = join(ROOT, 'apps/web/src');
const OUT = join(SRC, 'i18n/locales');
const args = process.argv.slice(2);
const check = args.includes('--check');
const content = args.includes('--content');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mts)$/.test(f)) out.push(p);
  }
  return out;
}

const KEY_RE = /\btk?\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g;
function extract(): string[] {
  const keys = new Set<string>();
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(KEY_RE)) keys.add(m[2]!.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n'));
  }
  // badge names and descriptions come from the shared table (shown with t(b.name) / t(b.desc))
  for (const b of BADGES) keys.add(b.name).add(b.desc);
  return [...keys].filter((k) => k.trim()).sort();
}

async function main() {
  if (content) return mainContent();
  const keys = extract();
  writeFileSync(join(SRC, 'i18n/keys.json'), JSON.stringify(keys, null, 1) + '\n');
  console.log(`${keys.length} keys`);
  const client = check ? null : new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let missingTotal = 0;
  for (const l of LANGS) {
    if (l.code === 'en' || (only && !only.includes(l.code))) continue;
    const file = join(OUT, `${l.code}.json`);
    const cat: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    const missing = keys.filter((k) => !cat[k]);
    missingTotal += missing.length;
    if (missing.length && client) {
      console.log(`${l.code}: translating ${missing.length}`);
      Object.assign(cat, await translate(client, l.code, missing));
    }
    const sorted: Record<string, string> = {};
    for (const k of keys) if (cat[k]) sorted[k] = cat[k]!;
    if (!check) writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
    const still = keys.filter((k) => !sorted[k]).length;
    console.log(`${l.code}: ${keys.length - still}/${keys.length}`);
  }
  if (check && missingTotal) {
    console.error(`missing translations: ${missingTotal} — run pnpm --filter @es/api i18n:translate`);
    process.exit(1);
  }
}

/** Area content: keys like "zoo.item.lion.s0" → English source text. */
async function mainContent() {
  const src: Record<string, string> = {};
  for (const id of AREA_IDS) Object.assign(src, areaTrKeys(getArea(id)!));
  const keys = Object.keys(src).sort();
  console.log(`${keys.length} content strings`);
  const client = check ? null : new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let missingTotal = 0;
  // Source changed since the last run → retranslate (hash of the English kept in a sidecar file).
  const srcFile = join(AREA_I18N_DIR, '_source.json');
  const prevSrc: Record<string, string> = existsSync(srcFile) ? JSON.parse(readFileSync(srcFile, 'utf8')) : {};
  const changed = new Set(keys.filter((k) => prevSrc[k] !== undefined && prevSrc[k] !== src[k]));
  for (const l of LANGS) {
    if (l.code === 'en' || (only && !only.includes(l.code))) continue;
    const file = join(AREA_I18N_DIR, `${l.code}.json`);
    const cat: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    const missing = keys.filter((k) => !cat[k] || changed.has(k));
    missingTotal += missing.length;
    if (missing.length && client) {
      console.log(`${l.code}: translating ${missing.length}`);
      Object.assign(cat, await translate(client, l.code, missing, src));
    }
    const sorted: Record<string, string> = {};
    for (const k of keys) if (cat[k]) sorted[k] = cat[k]!;
    if (!check) writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
    console.log(`${l.code}: ${Object.keys(sorted).length}/${keys.length}`);
  }
  if (!check && !only) writeFileSync(srcFile, JSON.stringify(Object.fromEntries(keys.map((k) => [k, src[k]])), null, 1) + '\n');
  if (check && missingTotal) {
    console.error(`missing content translations: ${missingTotal}`);
    process.exit(1);
  }
}

await main();
