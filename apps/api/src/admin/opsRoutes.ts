import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BUILTIN_BAD_WORDS } from '@es/shared';
import { env } from '../env';
import { prisma } from '../plugins/prisma';
import { SETTING_DEFS, SETTING_KEYS, isDefault, saveSetting, setting, type SettingKey } from '../settings';
import { forgetAnnouncements } from '../routes/world';
import { audit, bad } from './core';
import { gameNotice } from './game';
import { contentChanged } from './contentStore';

export function adminOpsRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------- live settings
  app.get('/admin/settings', async () => ({
    settings: SETTING_KEYS.map((key) => ({ key, value: setting(key), default: SETTING_DEFS[key].def(), isDefault: isDefault(key) })),
    builtinBadWords: BUILTIN_BAD_WORDS,
    betaGate: env.BETA_CODES.length > 0,
  }));
  app.put<{ Params: { key: string } }>('/admin/settings/:key', async (req, reply) => {
    const key = req.params.key as SettingKey;
    if (!SETTING_KEYS.includes(key)) return bad(reply, 'unknown_setting', 404);
    const value = (req.body as { value?: unknown } | undefined)?.value;
    const ok = value === null || SETTING_DEFS[key].schema.safeParse(value).success;
    if (!ok) return bad(reply, 'invalid', 400, { issues: SETTING_DEFS[key].schema.safeParse(value).error?.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    const before = setting(key);
    await saveSetting(key, value ?? null, req.admin!.name);
    await audit(req, value === null ? 'setting.reset' : 'setting.update', key, before, value);
    // maintenance on/off shows up in GET /world; tell the clients now
    if (key === 'maintenance') await contentChanged();
    return { key, value: setting(key) };
  });

  // ---------------------------------------------------------------- beta invite codes (in addition to BETA_CODES)
  app.get('/admin/beta', async () => ({ gate: env.BETA_CODES.length > 0, envCodes: env.BETA_CODES.length, codes: await prisma.betaCode.findMany({ orderBy: { createdAt: 'desc' } }) }));
  app.post('/admin/beta', async (req, reply) => {
    const body = z.object({ code: z.string().trim().regex(/^[A-Za-z0-9-]{4,32}$/).optional(), label: z.string().max(80).default(''), maxUses: z.number().int().min(1).max(100_000).nullable().default(null) }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    const code = body.data.code ?? randomBytes(4).toString('hex').toUpperCase();
    const row = await prisma.betaCode.create({ data: { code, label: body.data.label, maxUses: body.data.maxUses } }).catch(() => null);
    if (!row) return bad(reply, 'code_taken', 409);
    await audit(req, 'beta.create', code, null, body.data);
    return row;
  });
  app.patch<{ Params: { code: string } }>('/admin/beta/:code', async (req, reply) => {
    const body = z.object({ revoked: z.boolean().optional(), label: z.string().max(80).optional(), maxUses: z.number().int().min(1).nullable().optional() }).safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    const row = await prisma.betaCode.update({ where: { code: req.params.code }, data: body.data }).catch(() => null);
    if (!row) return bad(reply, 'not_found', 404);
    await audit(req, 'beta.update', row.code, null, body.data);
    return row;
  });

  // ---------------------------------------------------------------- announcements
  app.get('/admin/announcements', async () => prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }));
  app.post('/admin/announcements', async (req, reply) => {
    const body = z
      .object({ text: z.string().trim().min(2).max(300), level: z.enum(['info', 'warning']).default('info'), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date(), pushNow: z.boolean().default(true) })
      .safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    const startsAt = body.data.startsAt ?? new Date();
    if (body.data.endsAt <= startsAt) return bad(reply, 'invalid', 400, { detail: 'The end must be after the start.' });
    const row = await prisma.announcement.create({ data: { text: body.data.text, level: body.data.level, startsAt, endsAt: body.data.endsAt, createdBy: req.admin!.name } });
    forgetAnnouncements();
    // shown at once to everyone on the street (and to newcomers via GET /world)
    const pushed = body.data.pushNow && startsAt <= new Date() ? await gameNotice(row.text, row.level as 'info' | 'warning') : null;
    await audit(req, 'announcement.create', row.id, null, body.data);
    return { ...row, pushed: !!pushed };
  });
  app.delete<{ Params: { id: string } }>('/admin/announcements/:id', async (req, reply) => {
    const row = await prisma.announcement.update({ where: { id: req.params.id }, data: { endsAt: new Date() } }).catch(() => null);
    if (!row) return bad(reply, 'not_found', 404);
    forgetAnnouncements();
    await audit(req, 'announcement.end', row.id);
    return { ok: true };
  });

  // ---------------------------------------------------------------- audit log
  app.get('/admin/audit', async (req) => {
    const q = req.query as { actor?: string; action?: string; target?: string; before?: string };
    return prisma.adminAudit.findMany({
      where: {
        ...(q.actor ? { actorName: { contains: q.actor, mode: 'insensitive' } } : {}),
        ...(q.action ? { action: { startsWith: q.action } } : {}),
        ...(q.target ? { target: { contains: q.target } } : {}),
        ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });
}

/** Closed beta: is `code` one of the admin-made invite codes? Counts the use. */
export async function useBetaCode(code: string): Promise<boolean> {
  const row = await prisma.betaCode.findFirst({ where: { code: { equals: code, mode: 'insensitive' }, revoked: false } }).catch(() => null);
  if (!row || (row.maxUses != null && row.uses >= row.maxUses)) return false;
  await prisma.betaCode.update({ where: { code: row.code }, data: { uses: { increment: 1 } } });
  return true;
}
