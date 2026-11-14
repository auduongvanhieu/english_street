// Run against a real Postgres: DATABASE_URL=... npx tsx src/payments/payments.dbtest.ts
import assert from 'node:assert/strict';
import { prisma } from '../plugins/prisma';
import { setSettingForTest } from '../settings';
import { createOrder, receive, PayError, orderView } from './core';

setSettingForTest('payMode', 'test');
setSettingForTest('payTesters', ['pay-tester@example.com']);
setSettingForTest('payBank', 'MB');
setSettingForTest('payBankAccount', '0123456789');
setSettingForTest('payBankName', 'NGUYEN VAN A');
setSettingForTest('payTrc20Address', 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf');
setSettingForTest('payBep20Address', '0x1111111111111111111111111111111111111111');

const t = Date.now();
const id = `pay-test-${t}`;
const guest = `pay-guest-${t}`;
const other = `pay-other-${t}`;
await prisma.user.create({ data: { id, name: 'Pay test', email: 'pay-tester@example.com', coins: 10 } }).catch(async () => {
  await prisma.user.update({ where: { email: 'pay-tester@example.com' }, data: { email: null } });
  await prisma.user.create({ data: { id, name: 'Pay test', email: 'pay-tester@example.com', coins: 10 } });
});
await prisma.user.create({ data: { id: guest, name: 'Guest', coins: 0 } });
await prisma.user.create({ data: { id: other, name: 'Other', email: `other-${t}@example.com`, coins: 0 } });
const gems = async (u = id) => (await prisma.user.findUniqueOrThrow({ where: { id: u } })).gems;
const err = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof PayError ? e.code : String(e)));

// who may buy
assert.equal(await err(createOrder({ id: other, email: `other-${t}@example.com` }, 'small', 'vnd')), 'not_open');
setSettingForTest('payTesters', ['pay-tester@example.com', guest]);
assert.equal(await err(createOrder({ id: guest, email: null }, 'small', 'vnd')), 'need_account');
assert.equal(await err(createOrder({ id, email: 'pay-tester@example.com' }, 'nope', 'vnd')), 'bad_pack');

// VND: the first top-up is doubled; the same pack again shows the same order
const o1 = await createOrder({ id, email: 'pay-tester@example.com' }, 'medium', 'vnd');
const again = await createOrder({ id, email: 'pay-tester@example.com' }, 'medium', 'vnd');
assert.equal(again.code, o1.code);
assert.match(o1.code, /^ES[A-Z2-9]{6}$/);
assert.equal(o1.amount, 50_000);
const v1 = await orderView(o1);
assert.equal(v1.gems, 540, 'first top-up shows double');
assert.ok(v1.pay?.kind === 'vnd' && v1.pay.qr.includes(`addInfo=${o1.code}`));
// underpaid: nothing credited, waits for an admin
assert.deepEqual(await receive({ source: 'sepay', txRef: `a${t}`, amount: 40_000, content: `${o1.code} nap xu`, raw: {} }), { result: 'unmatched', reason: 'underpaid', code: o1.code });
assert.equal(await gems(), 0);
// paid (bank mangled the content a bit) → credited once, a repeated webhook does nothing
const content = `MBVCB.123 ${o1.code.slice(0, 4)} ${o1.code.slice(4)} chuyen tien`;
const r = await receive({ source: 'sepay', txRef: `b${t}`, amount: 50_000, content, raw: {} });
assert.deepEqual(r, { result: 'paid', code: o1.code, userId: id, gems: 540 });
assert.deepEqual(await receive({ source: 'sepay', txRef: `b${t}`, amount: 50_000, content, raw: {} }), { result: 'duplicate' });
// same webhook twice at the same moment
const both = await Promise.all([receive({ source: 'sepay', txRef: `c${t}`, amount: 50_000, content: o1.code, raw: {} }), receive({ source: 'sepay', txRef: `c${t}`, amount: 50_000, content: o1.code, raw: {} })]);
assert.ok(both.some((x) => x.result === 'duplicate'));
assert.equal(await gems(), 540, 'credited exactly once');
// no code at all
assert.equal((await receive({ source: 'sepay', txRef: `d${t}`, amount: 20_000, content: 'tien an trua', raw: {} })).result, 'unmatched');

// USDT: unique amount per network, matched by amount, second top-up not doubled
const u1 = await createOrder({ id, email: 'pay-tester@example.com' }, 'small', 'usdt_trc20');
const u2 = await createOrder({ id, email: 'pay-tester@example.com' }, 'large', 'usdt_trc20');
assert.ok(u1.amount > 1_000_000 && u1.amount < 1_300_000 && u1.amount % 1000 === 0, `amount ${u1.amount}`);
assert.notEqual(u1.amount, u2.amount);
assert.equal((await receive({ source: 'trc20', txRef: `tx${t}`, amount: u1.amount - 1000, content: 'Tsender', raw: {} })).result, 'unmatched');
const ru = await receive({ source: 'trc20', txRef: `tx2${t}`, amount: u1.amount, content: 'Tsender', raw: {} });
assert.deepEqual(ru, { result: 'paid', code: u1.code, userId: id, gems: 100 });
// the same amount on the other network is not this order
assert.equal((await receive({ source: 'bep20', txRef: `0x${t}:0`, amount: u2.amount, content: '0xabc', raw: {} })).result, 'unmatched');
assert.equal(await gems(), 540 + 100);
assert.equal((await prisma.user.findUniqueOrThrow({ where: { id } })).coins, 10, 'coins untouched');
const ledger = await prisma.coinLedger.findMany({ where: { userId: id } });
assert.deepEqual(ledger.map((l) => `${l.currency}:${l.delta}`).sort(), ['gem:100', 'gem:540']);

// clean up
await prisma.paymentTx.deleteMany({ where: { OR: [{ orderCode: { in: [o1.code, u1.code, u2.code] } }, { txRef: { contains: String(t) } }] } });
await prisma.paymentOrder.deleteMany({ where: { userId: { in: [id, guest, other] } } });
await prisma.coinLedger.deleteMany({ where: { userId: { in: [id, guest, other] } } });
await prisma.event.deleteMany({ where: { playerId: { in: [id, guest, other] } } });
await prisma.user.deleteMany({ where: { id: { in: [id, guest, other] } } });
console.log('payments ok');
await prisma.$disconnect();
