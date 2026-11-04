import { z } from 'zod';
import { CEFR_LEVELS } from '../constants';

/**
 * Themed areas along the street (zoo, farm, restaurant, supermarket). Their learning content lives in
 * packages/quests/content/areas/<id>.yaml (English, the source) and translations in
 * packages/quests/content/areas/i18n/<lang>.json (generated, see apps/api/scripts/i18n-translate.ts).
 */
export const AREA_IDS = ['zoo', 'farm', 'restaurant', 'supermarket'] as const;
export type AreaId = (typeof AREA_IDS)[number];
export const AreaIdSchema = z.enum(AREA_IDS);

export const AreaSentenceSchema = z.object({ en: z.string(), level: z.enum(CEFR_LEVELS).default('A1') });

export const AreaItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** The English word or phrase, singular. */
  en: z.string(),
  plural: z.string().optional(),
  icon: z.string().describe('Emoji used as the picture in cards and quizzes'),
  pos: z.enum(['noun', 'verb', 'adjective', 'phrase']).default('noun'),
  category: z.string(),
  /** Countable unit for groceries: "a carton of", "a bunch of"… */
  unit: z.string().optional(),
  /** Price in dollars (menu, groceries, farm market). */
  price: z.number().optional(),
  sentences: z.array(AreaSentenceSchema).min(1).max(4),
  fact: z.string().optional(),
  /** Extra notes: menu description ("grilled, with fries"), sound ("moo"), how to count… */
  note: z.string().optional(),
});
export type AreaItem = z.infer<typeof AreaItemSchema>;

export const AreaPhraseSchema = z.object({ en: z.string(), level: z.enum(CEFR_LEVELS).default('A1'), group: z.string() });

export const AreaContentSchema = z.object({
  id: AreaIdSchema,
  title: z.string(),
  intro: z.string(),
  categories: z.array(z.object({ id: z.string(), label: z.string() })),
  /** Phrase groups shown in order ("Ordering", "Paying"…). */
  groups: z.array(z.object({ id: z.string(), label: z.string() })).default([]),
  items: z.array(AreaItemSchema),
  phrases: z.array(AreaPhraseSchema).default([]),
});
export type AreaContent = z.infer<typeof AreaContentSchema>;

/** Translation of the learner-facing strings of one area, in one language (keys: see areaTrKeys). */
export type AreaTranslations = Record<string, string>;

/** Every translatable string of an area with a stable key, e.g. "zoo.item.lion.en", "zoo.item.lion.s0". */
export function areaTrKeys(a: AreaContent): Record<string, string> {
  const out: Record<string, string> = { [`${a.id}.title`]: a.title, [`${a.id}.intro`]: a.intro };
  for (const c of a.categories) out[`${a.id}.cat.${c.id}`] = c.label;
  for (const g of a.groups) out[`${a.id}.group.${g.id}`] = g.label;
  for (const it of a.items) {
    out[`${a.id}.item.${it.id}.en`] = it.en;
    it.sentences.forEach((s, i) => (out[`${a.id}.item.${it.id}.s${i}`] = s.en));
    if (it.fact) out[`${a.id}.item.${it.id}.fact`] = it.fact;
    if (it.note) out[`${a.id}.item.${it.id}.note`] = it.note;
  }
  a.phrases.forEach((p, i) => (out[`${a.id}.phrase.${i}`] = p.en));
  return out;
}

/** What GET /areas/:id?lang= returns: the English content plus translations (`tr`, '' when missing) and US IPA. */
export interface AreaItemDto extends AreaItem {
  ipa: string;
  tr: { meaning: string; sentences: string[]; fact: string; note: string };
}
export interface AreaContentDto extends Omit<AreaContent, 'items' | 'phrases'> {
  lang: string;
  titleTr: string;
  introTr: string;
  categoryTr: Record<string, string>;
  groupTr: Record<string, string>;
  items: AreaItemDto[];
  phrases: (z.infer<typeof AreaPhraseSchema> & { tr: string })[];
}
