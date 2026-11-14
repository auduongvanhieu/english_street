import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PAY_METHODS, type PayInfo, type PayMethod } from '@es/shared';
import { env } from '../env';
import { prisma } from '../plugins/prisma';
import { limiter } from '../npc/ratelimit';
import { audit, bad } from '../admin/core';
import { changeBalanceTx } from '../npc/attempts';
import { setting } from '../settings';
import { chainStatus } from './chain';
import { PayError, createOrder, expireOld, firstBonusFor, fulfil, methods, orderView, packs, payOpenFor, receive } from './core';

/** The player's side: what can be bought, start an order, watch it, cancel it. Needs Postgres. */
export function payRoutes(dbOn: boolean) {
  return async function routes(app: FastifyInstance) {
    const me = async (req: { authPlayerId: string | null }) => {
      if (!req.authPlayerId) return null;
      return prisma.user.findUnique({ where: { id: req.authPlayerId }, select: { id: true, email: true } });
    };

    app.get('/me/pay', async (req): Promise<PayInfo> => {
      const off: PayInfo = { enabled: false, needAccount: false, methods: [], packs: [], firstBonus: false, orders: [] };
      if (!dbOn) return off;
      const ms = methods();
      if (!ms.length) return off;
      const u = await me(req);
      // guests (no account): only once top-ups are open to everybody, with a "sign up first" note
      if (!u) return setting('payMode') === 'on' ? { ...off, enabled: true, needAccount: true, methods: ms, packs: packs() } : off;
      if (!payOpenFor(u)) return off;
      if (!u.email) return { ...off, enabled: true, needAccount: true, methods: ms, packs: packs() };
      await expireOld();
      const bonus = await firstBonusFor(u.id);
      const rows = await prisma.paymentOrder.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 10 });
      return { enabled: true, needAccount: false, methods: ms, packs: packs(), firstBonus: bonus, orders: await Promise.all(rows.map((o) => orderView(o, bonus))) };
    });

    app.post('/me/pay/orders', async (req, reply) => {
      if (!dbOn) return bad(reply, 'not_open', 404);
      const u = await me(req);
      if (!u) return bad(reply, 'unauthorized', 401);
      if (!(await limiter.allow(`pay:${u.id}`, 10))) return bad(reply, 'rate_limited', 429);
      const body = z.object({ pack: z.string().max(20), method: z.enum(PAY_METHODS) }).safeParse(req.body);
      if (!body.success) return bad(reply, 'bad_request');
      try {
        const o = await createOrder(u, body.data.pack, body.data.method as PayMethod);
        await prisma.event.create({ data: { name: 'pay_order', playerId: u.id, props: { code: o.code, pack: o.pack, method: o.method, amount: o.amount } } });
        return await orderView(o);
      } catch (e) {
        if (e instanceof PayError) return bad(reply, e.code, e.code === 'need_account' ? 403 : 409);
        throw e;
      }
    });

    app.get<{ Params: { code: string } }>('/me/pay/orders/:code', async (req, reply) => {
      if (!dbOn) return bad(reply, 'not_found', 404);
      const u = await me(req);
      if (!u) return bad(reply, 'unauthorized', 401);
      const o = await prisma.paymentOrder.findUnique({ where: { code: req.params.code.toUpperCase() } });
      if (!o || o.userId !== u.id) return bad(reply, 'not_found', 404);
      if (o.status === 'pending' && o.expiresAt < new Date()) await expireOld();
      return orderView((await prisma.paymentOrder.findUnique({ where: { id: o.id } }))!);
    });

    app.post<{ Params: { code: string } }>('/me/pay/orders/:code/cancel', async (req, reply) => {
      if (!dbOn) return bad(reply, 'not_found', 404);
      const u = await me(req);
      if (!u) return bad(reply, 'unauthorized', 401);
      // a cancelled order is still paid if the money arrives anyway (fulfil accepts it)
      const r = await prisma.paymentOrder.updateMany({ where: { code: req.params.code.toUpperCase(), userId: u.id, status: { in: ['pending', 'expired'] } }, data: { status: 'cancelled' } });
      return { ok: r.count > 0 };
    });

    /**
     * SePay → Webhooks: URL https://<site>/api/pay/webhook/sepay, auth "API Key" (header `Authorization: Apikey <key>`).
     * Only money coming in counts; SePay retries until it gets { success: true }.
     */
    app.post('/pay/webhook/sepay', async (req, reply) => {
      const key = env.SEPAY_API_KEY;
      const got = String(req.headers.authorization ?? '').replace(/^Apikey\s+/i, '');
      if (!key || got.length !== key.length || !timingSafeEqual(Buffer.from(got), Buffer.from(key))) return reply.code(401).send({ success: false });
      if (!dbOn) return reply.code(503).send({ success: false });
      const body = z
        .object({ id: z.union([z.number(), z.string()]), transferType: z.string(), transferAmount: z.coerce.number(), content: z.string().default(''), code: z.string().nullish(), accountNumber: z.string().nullish(), description: z.string().nullish() })
        .passthrough()
        .safeParse(req.body);
      if (!body.success) return reply.code(400).send({ success: false });
      const b = body.data;
      if (b.transferType !== 'in' || b.transferAmount <= 0) return { success: true };
      // another account linked to the same SePay: not ours
      const acc = setting('payBankAccount');
      if (acc && b.accountNumber && b.accountNumber !== acc) return { success: true };
      const r = await receive({ source: 'sepay', txRef: String(b.id), amount: Math.round(b.transferAmount), content: `${b.code ?? ''} ${b.content} ${b.description ?? ''}`.trim(), raw: req.body });
      req.log.info({ sepay: b.id, result: r.result }, 'sepay webhook');
      return { success: true };
    });
  };
}

/** Admin "Payments": money in, orders, transfers that matched nothing, manual credit and refunds. */
export function adminPayRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { days?: string } }>('/admin/payments', async (req) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86_400_000);
    await expireOld();
    const [orders, unmatched, paid] = await Promise.all([
      prisma.paymentOrder.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.paymentTx.findMany({ where: { status: 'unmatched' }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.paymentOrder.findMany({ where: { status: 'paid', paidAt: { gte: since } }, select: { paidAt: true, method: true, paidAmount: true, gems: true } }),
    ]);
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(orders.map((o) => o.userId))] } }, select: { id: true, name: true, email: true } });
    const byDay: Record<string, { vnd: number; usdt: number; gems: number; n: number }> = {};
    for (const p of paid) {
      const d = new Date(p.paidAt!.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
      const row = (byDay[d] ??= { vnd: 0, usdt: 0, gems: 0, n: 0 });
      if (p.method === 'vnd') row.vnd += p.paidAmount;
      else row.usdt += p.paidAmount;
      row.gems += p.gems;
      row.n += 1;
    }
    // 💎 where gems came from and went (gifts, items, NPC turns, coins)
    const gemRows = await prisma.coinLedger.groupBy({ by: ['reason', 'source'], where: { currency: 'gem', createdAt: { gte: since } }, _sum: { delta: true }, _count: true });
    const gemUse = gemRows.map((r) => ({ reason: r.reason, source: r.source, gems: r._sum.delta ?? 0, n: r._count })).sort((a, b) => Math.abs(b.gems) - Math.abs(a.gems));
    const held = await prisma.user.aggregate({ _sum: { gems: true, npcBonusTurns: true } });
    return {
      gemUse,
      gemsHeld: held._sum.gems ?? 0,
      bonusTurnsHeld: held._sum.npcBonusTurns ?? 0,
      orders: orders.map((o) => ({ ...o, user: users.find((u) => u.id === o.userId) ?? null })),
      unmatched,
      byDay,
      config: { mode: setting('payMode'), methods: methods(), sepayKey: !!env.SEPAY_API_KEY, chain: chainStatus },
    };
  });

  /** A transfer that matched nothing: pay an order with it, or give the gems to a player directly. */
  app.post<{ Params: { id: string } }>('/admin/payments/tx/:id/assign', async (req, reply) => {
    const body = z.object({ code: z.string().max(20).optional(), userId: z.string().max(64).optional(), gems: z.number().int().min(1).max(1_000_000).optional(), note: z.string().max(200).default('') }).safeParse(req.body);
    if (!body.success || (!body.data.code && !(body.data.userId && body.data.gems))) return bad(reply, 'bad_request');
    const b = body.data;
    const out = await prisma.$transaction(async (tx) => {
      const t = await tx.paymentTx.findUnique({ where: { id: req.params.id } });
      if (!t || t.status !== 'unmatched') return { error: 'not_unmatched' } as const;
      if (b.code) {
        const o = await tx.paymentOrder.findUnique({ where: { code: b.code.toUpperCase() } });
        if (!o) return { error: 'no_order' } as const;
        const gems = await fulfil(tx, o, t.amount, `${t.source}:${t.txRef}`, `admin: ${b.note}`.trim());
        if (gems === null) return { error: 'already_paid' } as const;
        await tx.paymentTx.update({ where: { id: t.id }, data: { status: 'manual', orderCode: o.code, note: `${t.note} → ${req.admin!.name}` } });
        return { ok: true, gems, userId: o.userId } as const;
      }
      const r = await changeBalanceTx(tx, b.userId!, 'gem', b.gems!, 'purchase', `admin:${t.source}`, t.id);
      if (!r) return { error: 'no_user' } as const;
      await tx.paymentTx.update({ where: { id: t.id }, data: { status: 'manual', note: `${t.note} → ${req.admin!.name}: ${b.gems} gems to ${b.userId}` } });
      return { ok: true, gems: b.gems!, userId: b.userId! } as const;
    });
    if ('error' in out) return bad(reply, out.error!, 409);
    await audit(req, 'pay.assign', req.params.id, null, b);
    return out;
  });

  app.post<{ Params: { id: string } }>('/admin/payments/tx/:id/ignore', async (req, reply) => {
    const note = String((req.body as { note?: unknown } | undefined)?.note ?? '').slice(0, 200);
    const r = await prisma.paymentTx.updateMany({ where: { id: req.params.id, status: 'unmatched' }, data: { status: 'ignored', note: `${note} (${req.admin!.name})` } });
    if (!r.count) return bad(reply, 'not_unmatched', 409);
    await audit(req, 'pay.ignore', req.params.id, null, { note });
    return { ok: true };
  });

  /** Money given back outside the game: take the gems back (what is left of them) and mark the order. */
  app.post<{ Params: { code: string } }>('/admin/payments/orders/:code/refund', async (req, reply) => {
    const note = String((req.body as { note?: unknown } | undefined)?.note ?? '').slice(0, 200);
    const out = await prisma.$transaction(async (tx) => {
      const o = await tx.paymentOrder.findUnique({ where: { code: req.params.code } });
      if (!o || o.status !== 'paid') return null;
      const r = await changeBalanceTx(tx, o.userId, 'gem', -o.gems, 'refund', o.method, o.code, true);
      await tx.paymentOrder.update({ where: { id: o.id }, data: { status: 'refunded', note: `${o.note} refund: ${note} (${req.admin!.name})`.trim() } });
      return { taken: -(r?.delta ?? 0) };
    });
    if (!out) return bad(reply, 'not_paid', 409);
    await audit(req, 'pay.refund', req.params.code, null, { note, ...out });
    return { ok: true, ...out };
  });
}
