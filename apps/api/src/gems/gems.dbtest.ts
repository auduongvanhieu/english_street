// Run against a real Postgres: DATABASE_URL=... npx tsx src/gems/gems.dbtest.ts
import assert from 'node:assert/strict';
import { prisma } from '../plugins/prisma';
import { setSettingForTest } from '../settings';
import { PrismaAttemptRepo } from '../npc/attempts';
import { budget } from '../npc/budget';
import { GemError, buyNpcTurns, exchangeGems, gemInfo, gemPrice, giftGems, giveBackBonusTurn, spendGems, takeBonusTurn, bonusTurnsOf } from './core';

const t = Date.now();
const id = `gem-test-${t}`;
const guest = `gem-guest-${t}`;
await prisma.user.create({ data: { id, name: 'Gem test', email: `gem-${t}@example.com`, coins: 5, gems: 100 } });
await prisma.user.create({ data: { id: guest, name: 'Guest', gems: 0 } });
const u = async () => prisma.user.findUniqueOrThrow({ where: { id } });
const err = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof GemError ? e.code : String(e)));

// prices: defaults, admin change wins
assert.equal(gemPrice('tag:diamond'), 50);
assert.equal(gemPrice('royal-bed'), 40);
setSettingForTest('gemPrices', { 'royal-bed': 35 });
assert.equal(gemPrice('royal-bed'), 35);
assert.equal(gemPrice('tag:gold'), null, 'coin items are not gem items');

// gems → coins (one way), at the rate
setSettingForTest('gemRate', 10);
assert.deepEqual(await exchangeGems(id, 3), { gems: 97, coins: 35, got: 30 });
assert.equal(await err(exchangeGems(id, 98)), 'not_enough_gems');
assert.equal(await err(exchangeGems(id, 0)), 'bad_request');

// extra NPC turns: 10 buys at once with gems for only 4 → exactly 4 succeed, never below 0
setSettingForTest('gemTurnPack', { turns: 20, gems: 20 });
await prisma.user.update({ where: { id }, data: { gems: 80 } });
const buys = await Promise.all(Array.from({ length: 10 }, () => buyNpcTurns(id).then(() => 1, () => 0)));
assert.equal(buys.reduce<number>((a, b) => a + b, 0), 4);
assert.equal((await u()).gems, 0);
assert.equal((await u()).npcBonusTurns, 80);

// bought turns: 100 used at once with 80 left → 80 succeed; giving one back works
const takes = await Promise.all(Array.from({ length: 100 }, () => takeBonusTurn(id)));
assert.equal(takes.filter(Boolean).length, 80);
assert.equal(await bonusTurnsOf(id), 0);
await giveBackBonusTurn(id);
assert.equal(await bonusTurnsOf(id), 1);

// the budget: past the free turns a bought turn is used, then refused
budget.useBonusTurns({ take: takeBonusTurn, giveBack: giveBackBonusTurn, count: bonusTurnsOf });
setSettingForTest('npcDailyTurnsPerPlayer', 0);
assert.deepEqual(await budget.check(id, '127.0.0.9'), { bonus: false }, 'only looks (dictionary)');
assert.equal(await bonusTurnsOf(id), 1);
assert.deepEqual(await budget.check(id, '127.0.0.9', true), { bonus: true });
assert.equal(await bonusTurnsOf(id), 0);
await assert.rejects(budget.check(id, '127.0.0.9', true), /daily_quota_exhausted/);

// gem items
await prisma.user.update({ where: { id }, data: { gems: 30 } });
assert.equal(await spendGems(id, 35, 'furniture', 'royal-bed'), null);
assert.equal(await spendGems(id, 25, 'furniture', 'crystal-lamp'), 5);

// gifts: signed-up players only
assert.equal(await giftGems(guest, 5, 'streak'), 0);
assert.equal(await giftGems(id, 10, 'journey', 'm01-hello'), 10);
assert.equal((await u()).gems, 15);

// a 7th day in a row gives the streak gift once, even with two requests at the same moment
setSettingForTest('gemGiftStreak', 5);
const repo = new PrismaAttemptRepo();
await prisma.user.update({ where: { id }, data: { streak: 6, lastActiveAt: new Date(Date.now() - 86_400_000) } });
await Promise.all([repo.ensureUser(id, 'Gem test'), repo.ensureUser(id, 'Gem test')]);
assert.equal((await u()).streak, 7);
assert.equal((await u()).gems, 20, 'streak gift once');

const info = await gemInfo(id);
assert.equal(info.gems, 20);
assert.equal(info.prices['royal-bed'], 35);

// ledger: every gem change has a row and the balance matches
const rows = await prisma.coinLedger.findMany({ where: { userId: id, currency: 'gem' }, orderBy: { createdAt: 'asc' } });
assert.ok(rows.every((r) => r.balanceAfter >= 0));
assert.equal(rows.at(-1)!.balanceAfter, 20);
const coinRows = await prisma.coinLedger.findMany({ where: { userId: id, currency: 'coin' } });
assert.deepEqual(coinRows.map((r) => [r.reason, r.delta]), [['exchange', 30]]);

await prisma.coinLedger.deleteMany({ where: { userId: { in: [id, guest] } } });
await prisma.event.deleteMany({ where: { playerId: { in: [id, guest] } } });
await prisma.user.deleteMany({ where: { id: { in: [id, guest] } } });
console.log('gems ok');
await prisma.$disconnect();
process.exit(0);
