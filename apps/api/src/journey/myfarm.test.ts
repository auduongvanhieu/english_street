import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_INFO, FARM_DAY_CAP, GROW_MS, applyMyFarm, emptyMyFarm } from '@es/shared';

test('my farm: seeds, coins, growing, animals, the daily sale cap', () => {
  const day = '2026-11-07';
  let f = emptyMyFarm();
  // the starter kit: seeds, one hen, a little feed
  assert.equal(f.seeds.carrot, 3);
  assert.equal(f.animals.length, 1);
  // buying needs coins
  assert.equal(applyMyFarm(f, { action: 'buy', item: 'animal:cow', qty: 1 }, 0, 10, day).error, 'coins');
  const cow = applyMyFarm(f, { action: 'buy', item: 'animal:cow', qty: 1 }, 0, 100, day);
  assert.equal(cow.coins, -ANIMAL_INFO.cow.price);
  // planting uses a seed; no seed, no planting
  let r = applyMyFarm(f, { action: 'plant', plot: 0, crop: 'carrot' }, 1000, 0, day);
  assert.equal(r.farm.seeds.carrot, 2);
  assert.equal(applyMyFarm(r.farm, { action: 'plant', plot: 1, crop: 'pumpkin' }, 1000, 0, day).error, 'no_seed');
  f = applyMyFarm(r.farm, { action: 'water', plot: 0 }, 2000, 0, day).farm;
  assert.equal(applyMyFarm(f, { action: 'harvest', plot: 0 }, 3000, 0, day).error, 'not_ready');
  f = applyMyFarm(f, { action: 'harvest', plot: 0 }, 2000 + GROW_MS.carrot, 0, day).farm;
  assert.equal(f.barn.carrot, 3);
  // the hen: feed, wait, collect an egg
  assert.equal(applyMyFarm(f, { action: 'collect', animal: 0 }, 0, 0, day).error, 'not_ready');
  f = applyMyFarm(f, { action: 'feed', animal: 0 }, 10_000, 0, day).farm;
  assert.equal(applyMyFarm(f, { action: 'feed', animal: 0 }, 10_001, 0, day).error, 'not_hungry');
  f = applyMyFarm(f, { action: 'collect', animal: 0 }, 10_000 + ANIMAL_INFO.chicken.everyMs, 0, day).farm;
  assert.equal(f.barn.egg, 1);
  // selling: everything, then nothing; the cap stops a big day
  r = applyMyFarm(f, { action: 'sell' }, 0, 0, day);
  assert.equal(r.coins, 3 * 2 + 3);
  assert.equal(applyMyFarm(r.farm, { action: 'sell' }, 0, 0, day).error, 'nothing_to_sell');
  const rich = { ...r.farm, barn: { pumpkin: 100 }, earned: [day, FARM_DAY_CAP - 10] as [string, number] };
  const capped = applyMyFarm(rich, { action: 'sell' }, 0, 0, day);
  assert.equal(capped.coins, 10);
  assert.ok((capped.farm.barn.pumpkin ?? 0) > 0);
  assert.equal(applyMyFarm(capped.farm, { action: 'sell' }, 0, 0, day).error, 'day_cap');
  // a new day: selling again
  assert.ok(applyMyFarm(capped.farm, { action: 'sell' }, 0, 0, '2026-11-08').coins > 0);
});
