import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  AREA_IDS,
  AreaContentSchema,
  NpcPersonaSchema,
  PairQuestSchema,
  PlacementQuestionSchema,
  QuestSchema,
  WorldConfigSchema,
  type AreaContent,
  type AreaId,
  type AreaTranslations,
  type NpcPersona,
  type PairQuest,
  type PlacementQuestion,
  type Quest,
  type WorldConfig,
} from '@es/shared';

const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
export const AREA_I18N_DIR = join(CONTENT_DIR, 'areas', 'i18n');

// ---------------------------------------------------------------- base content (YAML in git)
/**
 * Content kinds. The YAML files are the base; the admin site stores edits in the database (ContentDoc) and the
 * API hands them over with setContentOverrides(). An override replaces the YAML document with the same id,
 * adds a new one, or (deleted) hides it.
 */
export const CONTENT_KINDS = ['npc', 'quest', 'pair', 'placement', 'area', 'area-tr', 'world'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** Zod schema of one document of each kind (area-tr: one language's translations, id = language code). */
export const CONTENT_SCHEMAS: Record<ContentKind, z.ZodType> = {
  npc: NpcPersonaSchema,
  quest: QuestSchema,
  pair: PairQuestSchema,
  placement: PlacementQuestionSchema,
  area: AreaContentSchema,
  'area-tr': z.record(z.string().max(120), z.string().max(2000)),
  world: WorldConfigSchema,
};

function yamlDir(dir: string): unknown[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort()
    .map((f) => parse(readFileSync(join(dir, f), 'utf8')) as unknown);
}

const baseCache = new Map<ContentKind, Map<string, unknown>>();
/** The YAML documents of a kind, by id (raw, as written in git). */
export function baseDocs(kind: ContentKind): Map<string, unknown> {
  let m = baseCache.get(kind);
  if (m) return m;
  const docs = new Map<string, unknown>();
  const add = (raw: unknown, id?: string) => docs.set(id ?? String((raw as { id?: unknown })?.id ?? ''), raw);
  if (kind === 'npc') yamlDir(join(CONTENT_DIR, 'npcs')).forEach((r) => add(r));
  else if (kind === 'quest') yamlDir(join(CONTENT_DIR, 'quests')).forEach((r) => add(r));
  else if (kind === 'pair') yamlDir(join(CONTENT_DIR, 'pair-quests')).forEach((r) => add(r));
  else if (kind === 'placement') (parse(readFileSync(join(CONTENT_DIR, 'placement.yaml'), 'utf8')) as unknown[]).forEach((r) => add(r));
  else if (kind === 'area') for (const id of AREA_IDS) add(parse(readFileSync(join(CONTENT_DIR, 'areas', `${id}.yaml`), 'utf8')), id);
  else if (kind === 'area-tr') {
    if (existsSync(AREA_I18N_DIR))
      for (const f of readdirSync(AREA_I18N_DIR).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) add(JSON.parse(readFileSync(join(AREA_I18N_DIR, f), 'utf8')), f.replace(/\.json$/, ''));
  } else if (kind === 'world') add({}, 'world');
  baseCache.set(kind, docs);
  return docs;
}
/** English source of the area strings at the last translation run in git (key → text). */
export function baseAreaSource(): Record<string, string> {
  const f = join(AREA_I18N_DIR, '_source.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Record<string, string>) : {};
}

// ---------------------------------------------------------------- overrides (database, set by the API)
export interface ContentOverride {
  kind: ContentKind;
  id: string;
  data: unknown;
  deleted: boolean;
}
let overrides = new Map<string, ContentOverride>();
let version = 0;
const listeners = new Set<() => void>();

/** Replace all overrides (after loading them from the database); clears every cache. */
export function setContentOverrides(list: ContentOverride[]) {
  overrides = new Map(list.map((o) => [`${o.kind}:${o.id}`, o]));
  version += 1;
  npcCache = questCache = pairCache = placementCache = areaCache = worldCache = undefined;
  areaTrCache.clear();
  for (const l of listeners) l();
}
/** Bumps whenever content changes (cache keys). */
export const contentVersion = () => version;
/** Called after every setContentOverrides (e.g. to drop derived caches). */
export function onContentChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const getOverride = (kind: ContentKind, id: string) => overrides.get(`${kind}:${id}`);
export const listOverrides = (kind?: ContentKind) => [...overrides.values()].filter((o) => !kind || o.kind === kind);

/** Effective documents of a kind: YAML, then overrides (replace / add / hide). Invalid database documents are skipped. */
function effective<T>(kind: ContentKind, schema: z.ZodType<T>): T[] {
  const out = new Map<string, T>();
  const put = (id: string, raw: unknown, fromDb: boolean) => {
    const r = schema.safeParse(raw);
    if (r.success) out.set(id, r.data);
    else if (!fromDb) throw new Error(`Invalid ${kind} ${id}: ${r.error.message}`);
    else console.warn(`[content] ignoring invalid ${kind} ${id} from the database: ${r.error.message}`);
  };
  for (const [id, raw] of baseDocs(kind)) put(id, raw, false);
  for (const o of overrides.values()) {
    if (o.kind !== kind) continue;
    if (o.deleted) out.delete(o.id);
    else put(o.id, o.data, true);
  }
  return [...out.values()];
}

// ---------------------------------------------------------------- loaders used by the API
let npcCache: NpcPersona[] | undefined;
let questCache: Quest[] | undefined;
let pairCache: PairQuest[] | undefined;
let placementCache: PlacementQuestion[] | undefined;
let areaCache: Map<AreaId, AreaContent> | undefined;
let worldCache: WorldConfig | undefined;

export function loadNpcs(): NpcPersona[] {
  npcCache ??= effective('npc', NpcPersonaSchema).sort((a, b) => a.id.localeCompare(b.id));
  return npcCache;
}

/** Quests in the game (disabled ones stay in the admin site only). */
export function loadQuests(): Quest[] {
  questCache ??= effective('quest', QuestSchema)
    .filter((q) => !q.disabled)
    .sort((a, b) => a.id.localeCompare(b.id));
  return questCache;
}

export function loadPairQuests(): PairQuest[] {
  pairCache ??= effective('pair', PairQuestSchema)
    .filter((q) => !q.disabled)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((q) => ({
      ...q,
      // "{{menu:restaurant}}" in a role's facts → the real price list of that area (same as the in-game panel)
      roles: q.roles.map((role) => ({ ...role, facts: role.facts.replace(/\{\{menu:([a-z]+)\}\}/g, (_, id: string) => priceList(id as AreaId)) })) as PairQuest['roles'],
    }));
  return pairCache;
}

/** "Starters: tomato soup $6, …" lines for an area's priced items, grouped by category; sold-out items last. */
export function priceList(id: AreaId): string {
  const a = loadAreas().get(id);
  if (!a) return '';
  const soldOut = new Set(loadWorld().soldOut[id] ?? []);
  const lines = a.categories
    .map((c) => {
      const items = a.items.filter((i) => i.category === c.id && i.price != null && !soldOut.has(i.id));
      return items.length ? `${c.label}: ${items.map((i) => `${i.en} $${i.price}`).join(', ')}.` : '';
    })
    .filter(Boolean);
  const gone = a.items.filter((i) => soldOut.has(i.id)).map((i) => i.en);
  if (gone.length) lines.push(`Sold out today: ${gone.join(', ')}.`);
  return lines.join('\n');
}

export const getNpc = (id: string) => loadNpcs().find((n) => n.id === id);
export const getQuest = (id: string) => loadQuests().find((q) => q.id === id);
export const getPairQuest = (id: string) => loadPairQuests().find((q) => q.id === id);
export const questsForNpc = (npcId: string) => loadQuests().filter((q) => q.npc === npcId);
export const pairQuestsForNpc = (npcId: string) => loadPairQuests().filter((q) => q.npc === npcId);

/** The placement-test questions, in id order. */
export function loadPlacement(): PlacementQuestion[] {
  placementCache ??= effective('placement', PlacementQuestionSchema).sort((a, b) => a.id.localeCompare(b.id));
  return placementCache;
}

// ---------------------------------------------------------------- themed areas (zoo, farm, restaurant, supermarket)
/** Areas as the game sees them (hidden items removed). */
export function loadAreas(): Map<AreaId, AreaContent> {
  if (!areaCache) {
    areaCache = new Map();
    for (const a of effective('area', AreaContentSchema)) areaCache.set(a.id, { ...a, items: a.items.filter((i) => !i.hidden) });
  }
  return areaCache;
}
export const getArea = (id: AreaId) => loadAreas().get(id);

/** Translations of all area strings for one language: the JSON file in git, then admin fixes on top. */
const areaTrCache = new Map<string, AreaTranslations>();
export function areaTranslations(lang: string): AreaTranslations {
  let t = areaTrCache.get(lang);
  if (!t) {
    const base = (baseDocs('area-tr').get(lang) ?? {}) as AreaTranslations;
    const o = getOverride('area-tr', lang);
    t = o && !o.deleted ? { ...base, ...(o.data as AreaTranslations) } : base;
    areaTrCache.set(lang, t);
  }
  return t;
}

/** World settings edited in the admin site: farm rules, animal names, sold-out items. */
export function loadWorld(): WorldConfig {
  if (!worldCache) {
    const o = getOverride('world', 'world');
    const r = WorldConfigSchema.safeParse(o && !o.deleted ? o.data : {});
    worldCache = r.success ? r.data : WorldConfigSchema.parse({});
  }
  return worldCache;
}

// ---------------------------------------------------------------- books (graded readers)
import { BookSchema, type Book, type BookCard } from '@es/shared';
let bookCache: Book[] | null = null;
/** Every book in content/books (validated; a broken file throws so CI catches it). */
export function getBooks(): Book[] {
  if (bookCache) return bookCache;
  const dir = join(CONTENT_DIR, 'books');
  const out: Book[] = [];
  if (existsSync(dir))
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.yaml')).sort()) {
      const r = BookSchema.safeParse(parse(readFileSync(join(dir, f), 'utf8')));
      if (!r.success) throw new Error(`books/${f}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      if (`${r.data.id}.yaml` !== f) throw new Error(`books/${f}: id must match the file name`);
      out.push(r.data);
    }
  const order = { A1: 0, A2: 1, B1: 2, B2: 3 } as const;
  bookCache = out.sort((a, b) => order[a.level] - order[b.level] || a.title.localeCompare(b.title));
  return bookCache;
}
export const getBook = (id: string) => getBooks().find((b) => b.id === id) ?? null;
const wordsOf = (b: Book) => b.chapters.reduce((n, c) => n + c.pages.reduce((m, p) => m + p.text.split(/\s+/).filter(Boolean).length, 0), 0);
export const bookCards = (): BookCard[] => getBooks().map((b) => ({ id: b.id, title: b.title, author: b.author, level: b.level, price: b.price, cover: b.cover, summary: b.summary, tags: b.tags, chapters: b.chapters.length, words: wordsOf(b) }));
