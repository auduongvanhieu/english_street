import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_INFO, BARN_BASE, CROP_SELL, FARM_DAY_CAP, FARM_LEVELS, MY_GROW_MS, PRODUCT_SELL, applyMyFarm, emptyMyFarm, farmLevel, makeOrder, normalizeMyFarm } from '@es/shared';

test('my farm: seeds, coins, growing, animals, the daily sale cap', () => {
  const day = '2026-11-07';
  let f = emptyMyFarm();
  // the starter kit: seeds, one hen, a little feed
  assert.equal(f.seeds.carrot, 3);
  assert.equal(f.animals.length, 1);
  // buying needs coins
  assert.equal(applyMyFarm(f, { action: 'buy', item: 'animal:chicken', qty: 1 }, 0, 10, day).error, 'coins');
  // cows need farm level 3
  assert.equal(applyMyFarm(f, { action: 'buy', item: 'animal:cow', qty: 1 }, 0, 100, day).error, 'locked');
  const cow = applyMyFarm({ ...f, farmXp: FARM_LEVELS[2]! }, { action: 'buy', item: 'animal:cow', qty: 1 }, 0, 100, day);
  assert.equal(cow.coins, -ANIMAL_INFO.cow.price);
  // planting uses a seed; no seed, no planting
  let r = applyMyFarm(f, { action: 'plant', plot: 0, crop: 'carrot' }, 1000, 0, day);
  assert.equal(r.farm.seeds.carrot, 2);
  assert.equal(applyMyFarm(r.farm, { action: 'plant', plot: 1, crop: 'pumpkin' }, 1000, 0, day).error, 'no_seed');
  f = applyMyFarm(r.farm, { action: 'water', plot: 0 }, 2000, 0, day).farm;
  assert.equal(applyMyFarm(f, { action: 'harvest', plot: 0 }, 3000, 0, day).error, 'not_ready');
  f = applyMyFarm(f, { action: 'harvest', plot: 0 }, 2000 + MY_GROW_MS.carrot, 0, day).farm;
  assert.equal(f.barn.carrot, 3);
  // the hen: feed, wait, collect an egg
  assert.equal(applyMyFarm(f, { action: 'collect', animal: 0 }, 0, 0, day).error, 'not_ready');
  f = applyMyFarm(f, { action: 'feed', animal: 0 }, 10_000, 0, day).farm;
  assert.equal(applyMyFarm(f, { action: 'feed', animal: 0 }, 10_001, 0, day).error, 'not_hungry');
  f = applyMyFarm(f, { action: 'collect', animal: 0 }, 10_000 + ANIMAL_INFO.chicken.everyMs, 0, day).farm;
  assert.equal(f.barn.egg, 1);
  // selling: everything, then nothing; the cap stops a big day
  r = applyMyFarm(f, { action: 'sell' }, 0, 0, day);
  assert.equal(r.coins, 3 * CROP_SELL.carrot + PRODUCT_SELL.egg!);
  assert.equal(applyMyFarm(r.farm, { action: 'sell' }, 0, 0, day).error, 'nothing_to_sell');
  const rich = { ...r.farm, barn: { pumpkin: 100 }, earned: [day, FARM_DAY_CAP - 10] as [string, number] };
  const capped = applyMyFarm(rich, { action: 'sell' }, 0, 0, day);
  assert.equal(capped.coins, 10);
  assert.ok((capped.farm.barn.pumpkin ?? 0) > 0);
  assert.equal(applyMyFarm(capped.farm, { action: 'sell' }, 0, 0, day).error, 'day_cap');
  // a new day: selling again
  assert.ok(applyMyFarm(capped.farm, { action: 'sell' }, 0, 0, '2026-11-08').coins > 0);
});

test('my farm: stealing takes one piece per ripe plot, a few a day; the dog', async () => {
  const { stealFrom, dogAwake, stealFine, dogLevel, STEALS_FROM_FARM_PER_DAY } = await import('@es/shared');
  const day = '2026-11-07';
  let f = emptyMyFarm();
  f = applyMyFarm(f, { action: 'plant', plot: 0, crop: 'carrot' }, 0, 0, day).farm;
  assert.deepEqual(stealFrom(f, 0, 1, day), { error: 'not_ready' });
  f = applyMyFarm(f, { action: 'water', plot: 0 }, 1, 0, day).farm;
  const ripe = 1 + MY_GROW_MS.carrot;
  const s1 = stealFrom(f, 0, ripe, day);
  assert.ok(!('error' in s1));
  if ('error' in s1) return;
  assert.equal(s1.crop, 'carrot');
  // the same plot again: taken; the owner harvests the rest
  assert.deepEqual(stealFrom(s1.farm, 0, ripe, day), { error: 'taken' });
  const h = applyMyFarm(s1.farm, { action: 'harvest', plot: 0 }, ripe, 0, day);
  assert.equal(h.farm.barn.carrot, 2);
  // a daily limit per farm
  const robbed = { ...f, robbed: [day, STEALS_FROM_FARM_PER_DAY] as [string, number] };
  assert.deepEqual(stealFrom(robbed, 0, ripe, day), { error: 'limit' });
  // the dog: bought, fed today = awake; trained = faster; the fine
  let d = applyMyFarm({ ...f, farmXp: FARM_LEVELS[1]! }, { action: 'buy', item: 'dog', qty: 1 }, 0, 100, day).farm;
  assert.ok(!dogAwake(d, day));
  d = applyMyFarm(d, { action: 'dogfeed' }, 0, 0, day).farm;
  assert.ok(dogAwake(d, day));
  assert.ok(!dogAwake(d, '2026-11-08'));
  for (let i = 0; i < 3; i++) d = applyMyFarm(d, { action: 'train', ok: true }, 0, 0, day).farm;
  assert.equal(applyMyFarm(d, { action: 'train', ok: true }, 0, 0, day).error, 'trained');
  assert.equal(dogLevel(d.dog!.train), 1);
  assert.equal(stealFine(2), 3);
  assert.equal(stealFine(500), 100);
});

test('my farm v2: levels, regrowing crops, fertilizer, the barn, orders, water / harvest all', () => {
  const day = '2026-11-08';
  let f = normalizeMyFarm(emptyMyFarm());
  assert.equal(farmLevel(f.farmXp), 1);
  assert.equal(f.orders.length, 3);
  // a farm from before v2: fertilizer and a level for what it already has
  const old = normalizeMyFarm({ ...emptyMyFarm(), v: 1, fields: 3 });
  assert.equal(old.fertilizer, emptyMyFarm().fertilizer + 5);
  assert.ok(farmLevel(old.farmXp) >= 4);
  // actions give farm XP; enough XP is a level up
  const r0 = applyMyFarm({ ...f, farmXp: FARM_LEVELS[1]! - 1 }, { action: 'plant', plot: 0, crop: 'carrot' }, 0, 0, day);
  assert.equal(r0.levelUp, 2);
  // tomatoes give three harvests, watered again each time
  f = { ...f, farmXp: FARM_LEVELS[1]!, seeds: { tomato: 1 } };
  f = applyMyFarm(f, { action: 'plant', plot: 0, crop: 'tomato' }, 0, 0, day).farm;
  for (let k = 0; k < 3; k++) {
    const t0 = 1000 + k * 10 * MY_GROW_MS.tomato;
    f = applyMyFarm(f, { action: 'water', plot: 0 }, t0, 0, day).farm;
    const h = applyMyFarm(f, { action: 'harvest', plot: 0 }, t0 + MY_GROW_MS.tomato, 0, day);
    assert.equal(h.error, undefined);
    f = h.farm;
  }
  assert.equal(f.barn.tomato, 9);
  assert.equal(f.plots[0]!.crop, null);
  // fertilizer halves the time left
  f = { ...f, seeds: { carrot: 2 }, fertilizer: 1 };
  f = applyMyFarm(f, { action: 'plant', plot: 1, crop: 'carrot' }, 0, 0, day).farm;
  f = applyMyFarm(f, { action: 'water', plot: 1 }, 1000, 0, day).farm;
  assert.equal(applyMyFarm(f, { action: 'fertilize', plot: 1 }, 1000, 0, day).farm.plots[1]!.wateredAt, 1000 - MY_GROW_MS.carrot / 2);
  // water all / harvest all
  f = applyMyFarm(f, { action: 'plant', plot: 2, crop: 'carrot' }, 0, 0, day).farm;
  const wa = applyMyFarm(f, { action: 'waterAll' }, 1000, 0, day);
  assert.equal(wa.xp, 2);
  const ha = applyMyFarm(wa.farm, { action: 'harvestAll' }, 1000 + MY_GROW_MS.carrot, 0, day);
  assert.equal(ha.farm.barn.carrot, 6);
  // a full barn stops the harvest
  const full = { ...wa.farm, barn: { pumpkin: BARN_BASE } };
  assert.equal(applyMyFarm(full, { action: 'harvestAll' }, 1000 + MY_GROW_MS.carrot, 0, day).error, 'barn_full');
  // orders: same order for the same number; deliver needs the goods and pays more than selling
  assert.deepEqual(makeOrder(5, 3, ['chicken']), makeOrder(5, 3, ['chicken']));
  const o = f.orders[0]!;
  assert.equal(applyMyFarm(f, { action: 'deliver', order: o.id }, 0, 0, day).error, 'missing');
  const stocked = { ...f, barn: { ...o.items } };
  const d = applyMyFarm(stocked, { action: 'deliver', order: o.id }, 0, 0, day);
  const value = Object.entries(o.items).reduce((s, [k, n]) => s + n * (CROP_SELL[k as keyof typeof CROP_SELL] ?? PRODUCT_SELL[k] ?? 0), 0);
  assert.equal(d.coins, o.coins);
  assert.ok(d.coins > value);
  assert.equal(d.farm.orders.length, 3);
  assert.ok(!d.farm.orders.some((x) => x.id === o.id));
  assert.ok(d.farm.earned[1] <= FARM_DAY_CAP);
});

test('my farm v2: the workshop and the farm goals', async () => {
  const { RECIPES, MACHINE_INFO, FARM_GOALS } = await import('@es/shared');
  const day = '2026-11-08';
  let f = { ...normalizeMyFarm(emptyMyFarm()), farmXp: FARM_LEVELS[2]!, barn: { wheat: 6 } };
  assert.equal(applyMyFarm(f, { action: 'craft', recipe: 'bread' }, 1000, 0, day).error, 'no_machine');
  const bought = applyMyFarm(f, { action: 'buy', item: 'machine:bakery', qty: 1 }, 1000, 500, day);
  assert.equal(bought.coins, -MACHINE_INFO.bakery.price);
  f = bought.farm;
  f = applyMyFarm(f, { action: 'craft', recipe: 'bread' }, 1000, 0, day).farm;
  assert.equal(f.barn.wheat, 3);
  assert.equal(applyMyFarm(f, { action: 'craft', recipe: 'bread' }, 1000, 0, day).error, 'machine_busy');
  assert.equal(applyMyFarm(f, { action: 'takeCraft', machine: 'bakery' }, 2000, 0, day).error, 'not_ready');
  f = applyMyFarm(f, { action: 'takeCraft', machine: 'bakery' }, 1000 + RECIPES.bread!.ms, 0, day).farm;
  assert.equal(f.barn.bread, 1);
  assert.equal(f.stats.craft, 1);
  // a goal: counted, claimed once
  const g = FARM_GOALS.find((x) => x.id === 'harvest-10')!;
  assert.equal(applyMyFarm(f, { action: 'claimGoal', goal: g.id }, 0, 0, day).error, 'not_done');
  const done = applyMyFarm({ ...f, stats: { harvest: 10 } }, { action: 'claimGoal', goal: g.id }, 0, 0, day);
  assert.equal(done.coins, g.coins);
  assert.equal(applyMyFarm(done.farm, { action: 'claimGoal', goal: g.id }, 0, 0, day).error, 'nothing');
});
