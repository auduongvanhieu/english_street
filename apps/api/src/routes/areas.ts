import type { FastifyInstance } from 'fastify';
import { areaTranslations, getArea } from '@es/quests';
import { AreaIdSchema, toLang, type AreaContentDto } from '@es/shared';
import { ipaForWords } from '../dict/ipa';

const dtoCache = new Map<string, AreaContentDto>();

/** Learning content of a themed area in the learner's language: English source + translations + US IPA. */
export function areaDto(id: Parameters<typeof getArea>[0], lang: string): AreaContentDto | null {
  const key = `${id}:${lang}`;
  const hit = dtoCache.get(key);
  if (hit) return hit;
  const a = getArea(id);
  if (!a) return null;
  const tr = lang === 'en' ? {} : areaTranslations(lang);
  const g = (k: string) => tr[`${a.id}.${k}`] ?? '';
  const ipaOf = (en: string) => {
    const words = en.toLowerCase().match(/[a-z']+/g) ?? [];
    const map = ipaForWords(words);
    return words.map((w) => map[w] ?? '').every(Boolean) ? words.map((w) => map[w]).join(' ') : '';
  };
  const dto: AreaContentDto = {
    ...a,
    lang,
    titleTr: g('title'),
    introTr: g('intro'),
    categoryTr: Object.fromEntries(a.categories.map((c) => [c.id, g(`cat.${c.id}`)])),
    groupTr: Object.fromEntries(a.groups.map((x) => [x.id, g(`group.${x.id}`)])),
    items: a.items.map((it) => ({
      ...it,
      ipa: ipaOf(it.en),
      tr: {
        meaning: g(`item.${it.id}.en`),
        sentences: it.sentences.map((_, i) => g(`item.${it.id}.s${i}`)),
        fact: it.fact ? g(`item.${it.id}.fact`) : '',
        note: it.note ? g(`item.${it.id}.note`) : '',
      },
    })),
    phrases: a.phrases.map((p, i) => ({ ...p, tr: g(`phrase.${i}`) })),
  };
  dtoCache.set(key, dto);
  return dto;
}

export async function areaRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { lang?: string } }>('/areas/:id', async (req, reply) => {
    const id = AreaIdSchema.safeParse(req.params.id);
    if (!id.success) return reply.code(404).send({ error: 'area_not_found' });
    reply.header('cache-control', 'public, max-age=300');
    return areaDto(id.data, toLang(req.query.lang, 'en'));
  });
}
