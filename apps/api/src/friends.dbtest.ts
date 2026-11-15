// Run against a real Postgres: DATABASE_URL=... npx tsx src/friends.dbtest.ts
import assert from 'node:assert/strict';
import { FRIEND_MSG_KEEP } from '@es/shared';
import { prisma } from './plugins/prisma';
import { MemoryFriendRepo, PrismaFriendRepo, type FriendRepo } from './friends';

const t = Date.now();
for (const [label, repo] of [['memory', new MemoryFriendRepo()], ['prisma', new PrismaFriendRepo()]] as [string, FriendRepo][]) {
  const a = `fm-a-${label}-${t}`;
  const b = `fm-b-${label}-${t}`;
  const c = `fm-c-${label}-${t}`;
  // b is offline: messages wait, unread by sender
  await repo.addMessage(a, b, 'Hello!');
  await repo.addMessage(a, b, 'Are you there?');
  await repo.addMessage(c, b, 'Hi from C');
  assert.deepEqual(await repo.unread(b), { [a]: 2, [c]: 1 });
  assert.deepEqual(await repo.unread(a), {});
  // a reads its own thread: nothing of b's changes
  const mine = await repo.thread(a, b, 100);
  assert.deepEqual(mine.map((m) => m.text), ['Hello!', 'Are you there?']);
  assert.equal(mine[0]!.read, false);
  assert.deepEqual(await repo.unread(b), { [a]: 2, [c]: 1 });
  // b opens it: marked read (the reply shows as read for a)
  await repo.thread(b, a, 100);
  assert.deepEqual(await repo.unread(b), { [c]: 1 });
  await repo.addMessage(b, a, 'Yes!');
  const again = await repo.thread(a, b, 100);
  assert.deepEqual(again.map((m) => [m.from, m.read]), [[a, true], [a, true], [b, false]]); // b's reply is read by this very call
  // limit keeps the newest, oldest first
  assert.deepEqual((await repo.thread(a, b, 2)).map((m) => m.text), ['Are you there?', 'Yes!']);
  // pruned past FRIEND_MSG_KEEP per pair
  for (let i = 0; i < FRIEND_MSG_KEEP + 5; i++) await repo.addMessage(a, c, `n${i}`);
  const kept = await repo.thread(c, a, 1000);
  assert.equal(kept.length, FRIEND_MSG_KEEP);
  assert.equal(kept[0]!.text, 'n5');
  // a guest signs up: their messages move to the account
  const acct = `fm-acct-${label}-${t}`;
  await repo.transfer(b, acct);
  assert.deepEqual(await repo.unread(acct), { [c]: 1 });
  assert.equal((await repo.thread(a, acct, 100)).length, 3);
  if (label === 'prisma') await prisma.friendMessage.deleteMany({ where: { OR: [a, b, c, acct].flatMap((x) => [{ fromId: x }, { toId: x }]) } });
  console.log(`friend messages ok (${label})`);
}
await prisma.$disconnect();
