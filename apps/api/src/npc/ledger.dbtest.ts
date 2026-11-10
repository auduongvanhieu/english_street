// Run against a real Postgres: DATABASE_URL=... npx tsx src/npc/ledger.dbtest.ts
import assert from 'node:assert/strict';
import { prisma } from '../plugins/prisma';
import { PrismaAttemptRepo } from './attempts';

const repo = new PrismaAttemptRepo();
const id = `ledger-test-${Date.now()}`;
await prisma.user.create({ data: { id, name: 'Ledger test', coins: 100 } });
const jobs: Promise<unknown>[] = [];
for (let i = 0; i < 40; i++) {
  jobs.push(repo.spend(id, 5, 'test'));
  jobs.push(repo.addCoins(id, 5, 'purchase', 'test', `t${i}`));
  jobs.push(repo.reward(id, 1, 1, 'test'));
}
const res = await Promise.all(jobs);
const u = await prisma.user.findUniqueOrThrow({ where: { id } });
const rows = await prisma.coinLedger.findMany({ where: { userId: id } });
const sum = rows.reduce((s, r) => s + r.delta, 0);
const failed = res.filter((r) => r === null).length;
console.log({ coins: u.coins, ledgerSum: sum, rows: rows.length, failedSpends: failed, xp: u.xp });
assert.equal(u.coins, 100 + sum, 'balance = start + ledger');
assert.ok(rows.every((r) => r.balanceAfter >= 0), 'never below 0');
assert.equal(u.coins, 100 + 40 * 5 + 40 - (40 - failed) * 5);
// not enough coins: refused, nothing changes
const before = u.coins;
assert.equal(await repo.spend(id, before + 1, 'test'), null);
// upTo takes what there is
const r = await repo.spend(id, before + 50, 'test', { upTo: true });
assert.deepEqual(r, { balance: 0, paid: before });
await prisma.coinLedger.deleteMany({ where: { userId: id } });
await prisma.event.deleteMany({ where: { playerId: id } });
await prisma.user.delete({ where: { id } });
console.log('ledger ok');
await prisma.$disconnect();
