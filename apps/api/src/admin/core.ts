import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { LoginRequestSchema } from '@es/shared';
import { signToken as signShared, verifyToken as verifyShared } from '@es/shared/token';
import { env } from '../env';
import { prisma } from '../plugins/prisma';
import { verifyPassword } from '../auth';
import { humanCheck } from '../captcha';
import { limiter } from '../npc/ratelimit';
import { forgetStatus, isBanned, userStatus } from '../moderation';
import { checkTotp, newTotpSecret, otpauthUrl } from './totp';

export type AdminRole = 'editor' | 'admin';
export interface Actor {
  id: string;
  name: string;
  role: AdminRole;
}
declare module 'fastify' {
  interface FastifyRequest {
    admin: Actor | null;
  }
}

/** Admin sessions are short; the token carries adm=1 so a normal 30-day game token never opens the admin site. */
export const ADMIN_SESSION_S = 12 * 3600;

/** Paths only the `admin` role may use (editors manage content and read stats). */
const ADMIN_ONLY = ['/admin/users', '/admin/online', '/admin/kick', '/admin/reports', '/admin/feedback', '/admin/settings', '/admin/beta', '/admin/announcements', '/admin/audit', '/admin/budget', '/admin/llm-usage', '/admin/journey', '/admin/password-requests', '/admin/payments'];

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function actorFrom(req: FastifyRequest): Promise<Actor | null> {
  const h = req.headers.authorization ?? '';
  if (!h.startsWith('Bearer ')) return null;
  const tok = h.slice(7);
  // Scripts / first setup: the shared ADMIN_TOKEN from .env.
  if (env.ADMIN_TOKEN && sameSecret(tok, env.ADMIN_TOKEN)) return { id: 'admin-token', name: 'ADMIN_TOKEN', role: 'admin' };
  const c = verifyShared(env.AUTH_SECRET, tok);
  if (!c || c.adm !== 1) return null;
  const s = await userStatus(c.sub);
  if (!s || (s.role !== 'editor' && s.role !== 'admin') || isBanned(s) || Number(c.v ?? 0) !== s.tokenVersion) return null;
  return { id: c.sub, name: String(c.name ?? ''), role: s.role };
}

/** Writes one line to the admin audit log (never throws). */
export async function audit(req: FastifyRequest, action: string, target = '', before?: unknown, after?: unknown) {
  const a = req.admin;
  await prisma.adminAudit
    .create({ data: { actorId: a?.id ?? '?', actorName: a?.name ?? '?', action, target, before: before === undefined ? undefined : (before as object), after: after === undefined ? undefined : (after as object), ip: req.ip } })
    .catch((e: unknown) => req.log.warn({ e }, 'audit write failed'));
}

export const bad = (reply: FastifyReply, error: string, code = 400, extra: Record<string, unknown> = {}) => reply.code(code).send({ error, ...extra });

/** Hook + sign-in for every /admin route. Needs Postgres (roles, audit log). */
export function adminCore(app: FastifyInstance, dbReady: boolean) {
  app.decorateRequest('admin', null);
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0]!;
    if (!path.startsWith('/admin')) return;
    if (!(await limiter.allow(`adm:${req.ip}`, 600, 60))) return bad(reply, 'rate_limited', 429);
    if (path === '/admin/login' || path === '/admin/config') return;
    if (!dbReady && !(env.ADMIN_TOKEN && req.headers.authorization === `Bearer ${env.ADMIN_TOKEN}`)) return bad(reply, 'db_required', 503);
    req.admin = await actorFrom(req).catch(() => null);
    if (!req.admin) return bad(reply, 'forbidden', 403);
    if (req.admin.role !== 'admin' && ADMIN_ONLY.some((p) => path === p || path.startsWith(p + '/'))) return bad(reply, 'admin_only', 403);
  });

  app.get('/admin/config', async () => ({ turnstileSiteKey: env.TURNSTILE_SITE_KEY, db: dbReady }));

  app.post('/admin/login', async (req, reply) => {
    if (!(await limiter.allow(`admlogin:${req.ip}`, 8, 300))) return bad(reply, 'rate_limited', 429);
    const body = LoginRequestSchema.safeParse(req.body);
    if (!body.success) return bad(reply, 'bad_request');
    if (!dbReady) return bad(reply, 'db_required', 503);
    // the second step (one-time code) re-sends the form without a new captcha: a short-lived "captcha passed" ticket
    const ticket = (req.body as { ticket?: unknown }).ticket;
    const passed = typeof ticket === 'string' && verifyShared(env.AUTH_SECRET, ticket)?.sub === `cap:${body.data.email.toLowerCase()}`;
    if (!passed && !(await humanCheck(body.data, req.ip, env.TURNSTILE_SECRET))) return bad(reply, 'captcha_failed');
    const u = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
    const ok = !!u?.passwordHash && (await verifyPassword(body.data.password, u.passwordHash));
    if (!ok || !u || (u.role !== 'editor' && u.role !== 'admin')) {
      await prisma.adminAudit.create({ data: { actorId: u?.id ?? '?', actorName: body.data.email, action: 'login_failed', ip: req.ip } }).catch(() => undefined);
      return bad(reply, 'invalid_credentials', 401);
    }
    if (u.bannedUntil && u.bannedUntil > new Date()) return bad(reply, 'account_banned', 403);
    // two-step sign-in when the account turned it on
    if (u.totpSecret) {
      const otp = (req.body as { otp?: unknown }).otp;
      if (otp === undefined || otp === '') return bad(reply, 'otp_required', 401, { ticket: signShared(env.AUTH_SECRET, `cap:${u.email}`, 300) });
      if (!(await limiter.allow(`admotp:${u.id}`, 6, 300)) || !checkTotp(u.totpSecret, otp)) {
        await prisma.adminAudit.create({ data: { actorId: u.id, actorName: u.name, action: 'login_failed', target: 'otp', ip: req.ip } }).catch(() => undefined);
        return bad(reply, 'otp_wrong', 401);
      }
    }
    forgetStatus(u.id);
    req.admin = { id: u.id, name: u.name, role: u.role };
    await audit(req, 'login');
    return { token: signShared(env.AUTH_SECRET, u.id, ADMIN_SESSION_S, { adm: 1, v: u.tokenVersion, name: u.name }), me: req.admin, expiresIn: ADMIN_SESSION_S };
  });

  app.get('/admin/me', async (req) => {
    const u = req.admin!.id === 'admin-token' ? null : await prisma.user.findUnique({ where: { id: req.admin!.id }, select: { totpSecret: true } });
    return { ...req.admin, totp: !!u?.totpSecret };
  });

  // ---- two-step sign-in for the signed-in staff member (setup → confirm with a code; disable with a code)
  const pending = new Map<string, string>();
  app.post('/admin/me/2fa/setup', async (req, reply) => {
    if (req.admin!.id === 'admin-token') return bad(reply, 'not_an_account');
    const secret = newTotpSecret();
    pending.set(req.admin!.id, secret);
    const u = await prisma.user.findUnique({ where: { id: req.admin!.id }, select: { email: true } });
    return { secret, url: otpauthUrl(secret, u?.email ?? req.admin!.name) };
  });
  app.post('/admin/me/2fa/enable', async (req, reply) => {
    const secret = pending.get(req.admin!.id);
    if (!secret) return bad(reply, 'no_setup');
    if (!checkTotp(secret, (req.body as { code?: unknown } | undefined)?.code)) return bad(reply, 'otp_wrong');
    pending.delete(req.admin!.id);
    await prisma.user.update({ where: { id: req.admin!.id }, data: { totpSecret: secret } });
    await audit(req, '2fa.enable', req.admin!.id);
    return { ok: true };
  });
  app.post('/admin/me/2fa/disable', async (req, reply) => {
    const u = await prisma.user.findUnique({ where: { id: req.admin!.id }, select: { totpSecret: true } });
    if (!u?.totpSecret) return { ok: true };
    if (!checkTotp(u.totpSecret, (req.body as { code?: unknown } | undefined)?.code)) return bad(reply, 'otp_wrong');
    await prisma.user.update({ where: { id: req.admin!.id }, data: { totpSecret: null } });
    await audit(req, '2fa.disable', req.admin!.id);
    return { ok: true };
  });
}
