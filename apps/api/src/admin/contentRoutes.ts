import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { stringify } from 'yaml';
import { AREA_IDS, LANGS, areaTrKeys, langName, type AreaContent, type PairQuest, type Quest } from '@es/shared';
import { CONTENT_KINDS, CONTENT_SCHEMAS, areaTranslations, baseDocs, getArea, getOverride, listOverrides, loadNpcs, type ContentKind } from '@es/quests';
import { prisma } from '../plugins/prisma';
import { audit, bad } from './core';
import { contentChanged } from './contentStore';
import { queueAreaTranslation, translationSource, translationStatus } from './translateJob';

const KindSchema = z.enum(CONTENT_KINDS);
const NEW_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
/** Kinds whose documents carry their own `id` field. */
const HAS_ID: ContentKind[] = ['npc', 'quest', 'pair', 'placement', 'area'];

/** The document as the game uses it: the override when present (null when hidden), else the YAML. */
export function rawDoc(kind: ContentKind, id: string): unknown {
  const o = getOverride(kind, id);
  if (o) return o.deleted ? null : o.data;
  return baseDocs(kind).get(id) ?? null;
}
function allIds(kind: ContentKind): string[] {
  const ids = new Set(baseDocs(kind).keys());
  for (const o of listOverrides(kind)) ids.add(o.id);
  if (kind === 'area-tr') for (const l of LANGS) if (l.code !== 'en') ids.add(l.code);
  return [...ids].sort();
}

function summary(kind: ContentKind, id: string, d: unknown): { title: string; sub: string; disabled?: boolean } {
  const x = (d ?? {}) as Record<string, unknown>;
  switch (kind) {
    case 'npc':
      return { title: `${x.name} — ${x.role}`, sub: String(x.shop ?? '') };
    case 'quest':
    case 'pair':
      return { title: String(x.title ?? id), sub: `${x.npc} · ${x.level}`, disabled: !!x.disabled };
    case 'placement':
      return { title: String(x.question ?? id), sub: String(x.level ?? '') };
    case 'area':
      return { title: String(x.title ?? id), sub: `${(x.items as unknown[] | undefined)?.length ?? 0} items` };
    case 'area-tr':
      return { title: langName(id as never) || id, sub: `${Object.keys(x).length} strings` };
    default:
      return { title: id, sub: '' };
  }
}

/** Cross-document checks the zod schemas can't do. Returns human-readable problems (empty = ok). */
function problems(kind: ContentKind, id: string, data: unknown): string[] {
  const out: string[] = [];
  const npcIds = new Set(allIds('npc').filter((n) => rawDoc('npc', n)));
  const dupes = (xs: string[], what: string) => {
    const seen = new Set<string>();
    for (const x of xs) {
      if (seen.has(x)) out.push(`${what} "${x}" is used twice`);
      seen.add(x);
    }
  };
  if (kind === 'quest' || kind === 'pair') {
    const q = data as Quest | PairQuest;
    if (!npcIds.has(q.npc)) out.push(`NPC "${q.npc}" does not exist`);
    if (kind === 'quest') dupes((q as Quest).goals.map((g) => g.id), 'Goal id');
    else {
      const p = q as PairQuest;
      if (p.roles[0].id === p.roles[1].id) out.push('The two roles need different ids');
      for (const r of p.roles) dupes(r.goals.map((g) => g.id), `Goal id (${r.id})`);
    }
  }
  if (kind === 'area') {
    const a = data as AreaContent;
    dupes(a.items.map((i) => i.id), 'Item id');
    dupes(a.categories.map((c) => c.id), 'Category id');
    dupes(a.quiz.map((c) => c.id), 'Quiz question id');
    const cats = new Set(a.categories.map((c) => c.id));
    const groups = new Set(a.groups.map((g) => g.id));
    for (const i of a.items) {
      if (!cats.has(i.category)) out.push(`Item "${i.id}": category "${i.category}" does not exist`);
      if (i.price != null && (i.price < 0 || i.price > 10_000)) out.push(`Item "${i.id}": price must be between 0 and 10000`);
    }
    for (const p of a.phrases) if (groups.size && !groups.has(p.group)) out.push(`Phrase "${p.en}": group "${p.group}" does not exist`);
  }
  if (kind === 'area-tr' && (!LANGS.some((l) => l.code === id) || id === 'en')) out.push(`Unknown language "${id}"`);
  if (kind === 'world' && id !== 'world') out.push('The world document id is "world"');
  return out;
}

async function save(kind: ContentKind, id: string, data: unknown, deleted: boolean, by: string) {
  const prev = await prisma.contentDoc.findUnique({ where: { kind_id: { kind, id } } });
  const version = (prev?.version ?? 0) + 1;
  await prisma.$transaction([
    prisma.contentDoc.upsert({
      where: { kind_id: { kind, id } },
      create: { kind, id, data: (data ?? {}) as object, deleted, version, updatedBy: by },
      update: { data: (data ?? {}) as object, deleted, version, updatedBy: by },
    }),
    prisma.contentRevision.create({ data: { kind, docId: id, version, data: data === null ? undefined : (data as object), deleted, updatedBy: by } }),
  ]);
  await contentChanged();
  if (kind === 'area') queueAreaTranslation();
  return version;
}

export function adminContentRoutes(app: FastifyInstance) {
  app.get('/admin/content', async () => ({
    kinds: CONTENT_KINDS.map((k) => ({ kind: k, count: allIds(k).length, modified: listOverrides(k).length })),
    translation: translationStatus(),
  }));

  app.get<{ Params: { kind: string } }>('/admin/content/:kind', async (req, reply) => {
    const kind = KindSchema.safeParse(req.params.kind);
    if (!kind.success) return bad(reply, 'unknown_kind', 404);
    const k = kind.data;
    const small = k === 'npc' || k === 'quest' || k === 'pair' || k === 'placement';
    return allIds(k).map((id) => {
      const o = getOverride(k, id);
      const d = rawDoc(k, id) ?? baseDocs(k).get(id);
      return {
        id,
        ...summary(k, id, d),
        origin: baseDocs(k).has(id) ? 'yaml' : 'new',
        modified: !!o,
        deleted: !!o?.deleted,
        data: small ? d : undefined,
      };
    });
  });

  app.get<{ Params: { kind: string; id: string } }>('/admin/content/:kind/:id', async (req, reply) => {
    const kind = KindSchema.safeParse(req.params.kind);
    if (!kind.success) return bad(reply, 'unknown_kind', 404);
    const { id } = req.params;
    const row = await prisma.contentDoc.findUnique({ where: { kind_id: { kind: kind.data, id } } });
    const base = baseDocs(kind.data).get(id) ?? null;
    if (!row && !base && kind.data !== 'area-tr' && kind.data !== 'world') return bad(reply, 'not_found', 404);
    return {
      kind: kind.data,
      id,
      base,
      override: row ? { data: row.data, deleted: row.deleted, version: row.version, updatedBy: row.updatedBy, updatedAt: row.updatedAt } : null,
      data: row ? (row.deleted ? (base ?? row.data) : row.data) : (base ?? (kind.data === 'world' || kind.data === 'area-tr' ? {} : null)),
    };
  });

  /** Create or replace a document. `baseVersion` (the version the editor loaded) guards against overwriting someone else's edit. */
  app.put<{ Params: { kind: string; id: string }; Body: { data?: unknown; baseVersion?: number } }>('/admin/content/:kind/:id', async (req, reply) => {
    const kind = KindSchema.safeParse(req.params.kind);
    if (!kind.success) return bad(reply, 'unknown_kind', 404);
    const k = kind.data;
    const { id } = req.params;
    const exists = baseDocs(k).has(id) || !!getOverride(k, id);
    if (!exists) {
      if (k === 'area' || k === 'placement') return bad(reply, 'cannot_create', 400, { detail: k === 'area' ? `Areas are fixed: ${AREA_IDS.join(', ')}` : 'The placement test always has the same 10 questions; edit them instead.' });
      if (k !== 'area-tr' && k !== 'world' && !NEW_ID.test(id)) return bad(reply, 'bad_id', 400, { detail: 'Use lowercase letters, digits and dashes (2–64).' });
    }
    const parsed = CONTENT_SCHEMAS[k].safeParse(req.body?.data);
    if (!parsed.success) return bad(reply, 'invalid', 400, { issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })) });
    if (HAS_ID.includes(k) && (parsed.data as { id?: string }).id !== id) return bad(reply, 'invalid', 400, { issues: [{ path: 'id', message: `must be "${id}"` }] });
    const errs = problems(k, id, parsed.data);
    if (errs.length) return bad(reply, 'invalid', 400, { issues: errs.map((m) => ({ path: '', message: m })) });
    const row = await prisma.contentDoc.findUnique({ where: { kind_id: { kind: k, id } } });
    if (row && req.body?.baseVersion != null && req.body.baseVersion !== row.version)
      return bad(reply, 'conflict', 409, { detail: `Changed by ${row.updatedBy} meanwhile (version ${row.version}). Reload to see it.` });
    const before = rawDoc(k, id);
    // store what the admin sent (keeps optional fields out of the YAML export), validated above
    const version = await save(k, id, req.body!.data, false, req.admin!.name);
    await audit(req, `content.${exists ? 'update' : 'create'}`, `${k}/${id}`, before, req.body!.data);
    return { ok: true, version };
  });

  /** Hide a YAML document / delete a new one. */
  app.delete<{ Params: { kind: string; id: string } }>('/admin/content/:kind/:id', async (req, reply) => {
    const kind = KindSchema.safeParse(req.params.kind);
    if (!kind.success) return bad(reply, 'unknown_kind', 404);
    const k = kind.data;
    const { id } = req.params;
    if (k === 'area' || k === 'placement' || k === 'world' || k === 'area-tr') return bad(reply, 'cannot_delete', 400);
    if (k === 'npc') {
      const uses = (kind: ContentKind) => allIds(kind).filter((q) => (rawDoc(kind, q) as { npc?: string } | null)?.npc === id);
      const used = [...uses('quest'), ...uses('pair')];
      if (used.length) return bad(reply, 'in_use', 409, { detail: `Quests still use this NPC: ${used.join(', ')}` });
    }
    const before = rawDoc(k, id);
    if (!before) return bad(reply, 'not_found', 404);
    if (baseDocs(k).has(id)) await save(k, id, null, true, req.admin!.name);
    else {
      await prisma.contentDoc.delete({ where: { kind_id: { kind: k, id } } });
      await prisma.contentRevision.create({ data: { kind: k, docId: id, version: 0, deleted: true, updatedBy: req.admin!.name } });
      await contentChanged();
    }
    await audit(req, 'content.delete', `${k}/${id}`, before, null);
    return { ok: true };
  });

  /** Back to the YAML version (drops the database override). */
  app.post<{ Params: { kind: string; id: string } }>('/admin/content/:kind/:id/revert', async (req, reply) => {
    const kind = KindSchema.safeParse(req.params.kind);
    if (!kind.success) return bad(reply, 'unknown_kind', 404);
    const k = kind.data;
    const { id } = req.params;
    const row = await prisma.contentDoc.findUnique({ where: { kind_id: { kind: k, id } } });
    if (!row) return { ok: true };
    if (!baseDocs(k).has(id) && k !== 'world' && k !== 'area-tr') return bad(reply, 'no_original', 400, { detail: 'This document only exists in the admin site; delete it instead.' });
    await prisma.contentDoc.delete({ where: { kind_id: { kind: k, id } } });
    await prisma.contentRevision.create({ data: { kind: k, docId: id, version: row.version + 1, data: (baseDocs(k).get(id) ?? undefined) as object | undefined, updatedBy: `${req.admin!.name} (revert)` } });
    await contentChanged();
    if (k === 'area') queueAreaTranslation();
    await audit(req, 'content.revert', `${k}/${id}`, row.deleted ? null : row.data, baseDocs(k).get(id) ?? null);
    return { ok: true };
  });

  app.get<{ Params: { kind: string; id: string } }>('/admin/content/:kind/:id/revisions', async (req, reply) => {
    const kind = KindSchema.safeParse(req.params.kind);
    if (!kind.success) return bad(reply, 'unknown_kind', 404);
    return prisma.contentRevision.findMany({ where: { kind: kind.data, docId: req.params.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  });

  /** The document as YAML (to copy into packages/quests/content). */
  app.get<{ Params: { kind: string; id: string } }>('/admin/content/:kind/:id/yaml', async (req, reply) => {
    const kind = KindSchema.safeParse(req.params.kind);
    if (!kind.success) return bad(reply, 'unknown_kind', 404);
    const d = rawDoc(kind.data, req.params.id);
    if (!d) return bad(reply, 'not_found', 404);
    reply.type('text/yaml; charset=utf-8');
    return kind.data === 'area-tr' ? JSON.stringify(d, null, 1) : stringify(d, { lineWidth: 0 });
  });

  app.get('/admin/translation', async () => translationStatus());
  app.post('/admin/translation/run', async (req) => {
    queueAreaTranslation(true);
    await audit(req, 'translation.run');
    return translationStatus();
  });

  /** One language's area translations: English source, effective translation, which keys were set in admin, which are stale. */
  app.get<{ Params: { lang: string } }>('/admin/translations/:lang', async (req, reply) => {
    const lang = req.params.lang;
    if (!LANGS.some((l) => l.code === lang) || lang === 'en') return bad(reply, 'unknown_lang', 404);
    const source: Record<string, string> = {};
    for (const id of AREA_IDS) {
      const a = getArea(id);
      if (a) Object.assign(source, areaTrKeys(a));
    }
    const prev = await translationSource();
    return {
      lang,
      source,
      tr: areaTranslations(lang),
      overridden: Object.keys((getOverride('area-tr', lang)?.data as Record<string, string> | undefined) ?? {}),
      stale: Object.keys(source).filter((k) => prev[k] !== undefined && prev[k] !== source[k]),
    };
  });

  /** "This translation is wrong" taps from players, per card and language (90 days). */
  app.get('/admin/translation-reports', async (req) => {
    const area = String((req.query as { area?: string }).area ?? '');
    const rows = await prisma.event.findMany({ where: { name: 'translation_report', createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, select: { props: true, createdAt: true }, take: 5000 });
    const agg = new Map<string, { item: string; lang: string; n: number; last: Date }>();
    for (const r of rows) {
      const p = (r.props ?? {}) as { area?: string; item?: string; lang?: string };
      if (area && p.area !== area) continue;
      const k = `${p.item}:${p.lang}`;
      const a = agg.get(k) ?? { item: String(p.item ?? '?'), lang: String(p.lang ?? '?'), n: 0, last: r.createdAt };
      a.n += 1;
      if (r.createdAt > a.last) a.last = r.createdAt;
      agg.set(k, a);
    }
    return [...agg.values()].sort((a, b) => b.n - a.n);
  });

  /** NPC ids + names for pickers. */
  app.get('/admin/npcs', async () => loadNpcs().map((n) => ({ id: n.id, name: n.name, role: n.role })));
}
