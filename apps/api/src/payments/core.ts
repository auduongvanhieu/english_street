import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { MICRO_USDT, type PayMethod, type PayOrderView, type PayPack, type PayStatus } from '@es/shared';
import { prisma } from '../plugins/prisma';
import { setting } from '../settings';
import { changeCoinsTx } from '../npc/attempts';

/**
 * Top-ups. An order = a coin pack + a way to pay, with a code (the bank transfer content) or, for USDT, an
 * amount nobody else is waiting for (2.137 USDT). Incoming transfers (SePay webhook, chain scan) go through
 * receive(): each transfer is stored once (unique source + txRef), matched to its order and the coins are
 * credited in the same transaction, so a repeated webhook or scan never pays twice.
 */

export const MAX_PENDING = 5;
/** USDT orders: the price plus 0.001–0.299 USDT, unique among waiting orders on that network */
const USDT_TAG_MAX = 299;
export const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const USDT_BEP20_CONTRACT = '0x55d398326f99059ff775485246999027b3197955';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /ES[A-HJ-NP-Z2-9]{6}/;

export const packs = (): PayPack[] => setting('payPacks');

/** Ways to pay that are switched on and set up. */
export function methods(): PayMethod[] {
  const m: PayMethod[] = [];
  if (setting('payVnd') && setting('payBank') && setting('payBankAccount')) m.push('vnd');
  if (setting('payUsdt') && setting('payTrc20Address')) m.push('usdt_trc20');
  if (setting('payUsdt') && setting('payBep20Address')) m.push('usdt_bep20');
  return m;
}

/** May this player see and use top-ups? (payMode: off / test = testers only / on) */
export function payOpenFor(u: { id: string; email: string | null }): boolean {
  const mode = setting('payMode');
  if (mode === 'on') return true;
  if (mode === 'test') {
    const t = setting('payTesters');
    return t.includes(u.id.toLowerCase()) || (!!u.email && t.includes(u.email.toLowerCase()));
  }
  return false;
}

export async function firstBonusFor(userId: string): Promise<boolean> {
  if (!setting('payFirstBonus')) return false;
  return (await prisma.paymentOrder.count({ where: { userId, status: { in: ['paid', 'refunded'] } } })) === 0;
}

type OrderRow = Awaited<ReturnType<typeof prisma.paymentOrder.findFirstOrThrow>>;

export async function orderView(o: OrderRow, bonus?: boolean): Promise<PayOrderView> {
  const method = o.method as PayMethod;
  const coins = o.status === 'paid' || o.status === 'refunded' ? o.coins : o.coins * ((bonus ?? (await firstBonusFor(o.userId))) ? 2 : 1);
  const v: PayOrderView = {
    code: o.code,
    pack: o.pack,
    coins,
    method,
    amount: o.amount,
    status: o.status as PayStatus,
    createdAt: o.createdAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
  };
  if (o.status === 'pending') {
    if (method === 'vnd') {
      const bank = setting('payBank');
      const account = setting('payBankAccount');
      const name = setting('payBankName');
      const qr = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-compact2.png?amount=${o.amount}&addInfo=${o.code}&accountName=${encodeURIComponent(name)}`;
      v.pay = { kind: 'vnd', bank, account, name, content: o.code, qr };
    } else {
      const address = method === 'usdt_trc20' ? setting('payTrc20Address') : setting('payBep20Address');
      v.pay = { kind: 'usdt', network: method === 'usdt_trc20' ? 'TRC20' : 'BEP20', address, qr: await QRCode.toDataURL(address, { margin: 1, width: 240 }) };
    }
  }
  return v;
}

export class PayError extends Error {
  constructor(readonly code: 'not_open' | 'need_account' | 'bad_pack' | 'bad_method' | 'too_many_pending' | 'busy') {
    super(code);
  }
}

export async function createOrder(u: { id: string; email: string | null }, packId: string, method: PayMethod) {
  if (!payOpenFor(u)) throw new PayError('not_open');
  if (!u.email) throw new PayError('need_account');
  const pack = packs().find((p) => p.id === packId);
  if (!pack) throw new PayError('bad_pack');
  if (!methods().includes(method)) throw new PayError('bad_method');
  await expireOld();
  const pending = await prisma.paymentOrder.findMany({ where: { userId: u.id, status: 'pending' }, orderBy: { createdAt: 'asc' } });
  // the same pack and way still waiting: show that one again instead of a new code
  const same = pending.find((o) => o.pack === pack.id && o.method === method);
  if (same) return same;
  if (pending.length >= MAX_PENDING) throw new PayError('too_many_pending');
  const expiresAt = new Date(Date.now() + setting('payOrderMinutes') * 60_000);
  for (let i = 0; i < 30; i++) {
    const code = 'ES' + Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
    let amount = pack.vnd;
    if (method !== 'vnd') {
      amount = Math.round(pack.usdt * MICRO_USDT) + randomInt(1, USDT_TAG_MAX + 1) * 1000;
      // another order waiting for the very same amount on this network → pick again
      const clash = await prisma.paymentOrder.count({ where: { method, amount, status: { in: ['pending', 'expired'] }, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
      if (clash) continue;
    }
    try {
      return await prisma.paymentOrder.create({ data: { code, userId: u.id, pack: pack.id, coins: pack.coins, method, amount, expiresAt } });
    } catch {
      /* code taken: try another */
    }
  }
  throw new PayError('busy');
}

/** Waiting orders past their time become expired (a late transfer still matches them). */
export async function expireOld() {
  await prisma.paymentOrder.updateMany({ where: { status: 'pending', expiresAt: { lt: new Date() } }, data: { status: 'expired' } });
}

export interface Incoming {
  source: 'sepay' | 'trc20' | 'bep20';
  txRef: string;
  /** đồng / micro-USDT */
  amount: number;
  /** transfer content (bank) or the sender's address (chain) */
  content: string;
  raw: unknown;
}
export type ReceiveResult = { result: 'duplicate' } | { result: 'paid'; code: string; userId: string; coins: number } | { result: 'unmatched'; reason: string; code?: string };

const METHOD_OF: Record<Incoming['source'], PayMethod> = { sepay: 'vnd', trc20: 'usdt_trc20', bep20: 'usdt_bep20' };

/** Find the order a transfer is for: the code in the content (bank), the exact amount (USDT). */
async function findOrder(tx: Tx, inc: Incoming) {
  const method = METHOD_OF[inc.source];
  if (inc.source === 'sepay') {
    const text = inc.content.toUpperCase();
    // banks sometimes drop or add spaces / dashes: look in the text as it is, then without them
    const code = text.match(CODE_RE)?.[0] ?? text.replace(/[^A-Z0-9]/g, '').match(CODE_RE)?.[0];
    return code ? tx.paymentOrder.findUnique({ where: { code } }) : null;
  }
  return tx.paymentOrder.findFirst({ where: { method, amount: inc.amount, status: { in: ['pending', 'expired', 'paid'] }, createdAt: { gte: new Date(Date.now() - 3 * 86_400_000) } }, orderBy: { createdAt: 'desc' } });
}
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Pay an order inside a transaction: mark it paid and credit the coins (first top-up: double). */
export async function fulfil(tx: Tx, o: OrderRow, paidAmount: number, txRef: string, note = '') {
  const first = setting('payFirstBonus') && (await tx.paymentOrder.count({ where: { userId: o.userId, status: { in: ['paid', 'refunded'] } } })) === 0;
  const coins = o.coins * (first ? 2 : 1);
  const r = await tx.paymentOrder.updateMany({ where: { id: o.id, status: { in: ['pending', 'expired', 'cancelled'] } }, data: { status: 'paid', paidAmount, txRef, paidAt: new Date(), coins, note } });
  if (!r.count) return null;
  await changeCoinsTx(tx, o.userId, coins, 'purchase', o.method, o.code);
  return coins;
}

/** One incoming transfer: store it once, match it, pay the order. */
export async function receive(inc: Incoming): Promise<ReceiveResult> {
  try {
    const out = await prisma.$transaction(async (tx): Promise<ReceiveResult> => {
      const exists = await tx.paymentTx.findUnique({ where: { source_txRef: { source: inc.source, txRef: inc.txRef } } });
      if (exists) return { result: 'duplicate' };
      const o = await findOrder(tx, inc);
      let res: ReceiveResult;
      if (!o) res = { result: 'unmatched', reason: 'no_order' };
      else if (o.method !== METHOD_OF[inc.source]) res = { result: 'unmatched', reason: 'wrong_method', code: o.code };
      else if (o.status === 'paid' || o.status === 'refunded') res = { result: 'unmatched', reason: 'already_paid', code: o.code };
      else if (inc.amount < o.amount) res = { result: 'unmatched', reason: 'underpaid', code: o.code };
      else {
        const coins = await fulfil(tx, o, inc.amount, `${inc.source}:${inc.txRef}`, inc.amount > o.amount ? 'overpaid' : '');
        res = coins === null ? { result: 'unmatched', reason: 'already_paid', code: o.code } : { result: 'paid', code: o.code, userId: o.userId, coins };
      }
      await tx.paymentTx.create({
        data: { source: inc.source, txRef: inc.txRef, amount: inc.amount, content: inc.content.slice(0, 500), orderCode: 'code' in res ? res.code : null, status: res.result === 'paid' ? 'matched' : 'unmatched', note: res.result === 'unmatched' ? res.reason : '', raw: (inc.raw ?? {}) as object },
      });
      return res;
    });
    if (out.result === 'paid') await prisma.event.create({ data: { name: 'pay_paid', playerId: out.userId, props: { code: out.code, coins: out.coins, source: inc.source, amount: inc.amount } } });
    return out;
  } catch (e) {
    // two deliveries of the same transfer at the same moment: the unique index stops the second
    if ((e as { code?: string }).code === 'P2002') return { result: 'duplicate' };
    throw e;
  }
}
