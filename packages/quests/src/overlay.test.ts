// Content overlay (admin edits on top of the YAML): replace, add, hide, invalid data, revert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FARM, CROP_PRICE, applyFarmConfig } from '@es/shared';
import { baseDocs, getArea, getQuest, loadNpcs, loadPairQuests, loadQuests, loadWorld, priceList, setContentOverrides } from './index';

test('YAML only', () => {
  setContentOverrides([]);
  assert.ok(loadNpcs().length >= 13);
  assert.equal(loadQuests().length, baseDocs('quest').size);
});

test('replace, add, hide and disable quests', () => {
  const q = structuredClone(baseDocs('quest').get('cafe-order-01')) as Record<string, unknown>;
  q.title = 'Edited title';
  setContentOverrides([
    { kind: 'quest', id: 'cafe-order-01', data: q, deleted: false },
    { kind: 'quest', id: 'new-quest-1', data: { id: 'new-quest-1', npc: 'barista', level: 'A1', title: 'New', intro: 'x', goals: [{ id: 'a', desc: 'b' }] }, deleted: false },
    { kind: 'quest', id: 'cafe-order-02', data: {}, deleted: true },
    { kind: 'quest', id: 'bank-account-01', data: { ...(baseDocs('quest').get('bank-account-01') as object), disabled: true }, deleted: false },
  ]);
  assert.equal(getQuest('cafe-order-01')?.title, 'Edited title');
  assert.ok(getQuest('new-quest-1'));
  assert.equal(getQuest('cafe-order-02'), undefined);
  assert.equal(getQuest('bank-account-01'), undefined, 'disabled quests are not offered');
  setContentOverrides([]);
  assert.notEqual(getQuest('cafe-order-01')?.title, 'Edited title', 'revert = drop the override');
  assert.ok(getQuest('cafe-order-02'));
});

test('invalid database documents are skipped, not fatal', () => {
  setContentOverrides([{ kind: 'quest', id: 'cafe-order-01', data: { id: 'cafe-order-01', title: 42 }, deleted: false }]);
  assert.ok(getQuest('cafe-order-01'), 'falls back to nothing for that id but does not throw');
  setContentOverrides([]);
});

test('area prices flow into pair-quest menus; hidden items and sold-out dishes', () => {
  const a = structuredClone(baseDocs('area').get('restaurant')) as { items: { id: string; price?: number; hidden?: boolean }[] };
  const steak = a.items.find((i) => i.id === 'steak')!;
  steak.price = 99;
  a.items.find((i) => i.id === 'pizza')!.hidden = true;
  setContentOverrides([
    { kind: 'area', id: 'restaurant', data: a, deleted: false },
    { kind: 'world', id: 'world', data: { soldOut: { restaurant: ['burger'] } }, deleted: false },
  ]);
  assert.equal(getArea('restaurant')?.items.find((i) => i.id === 'steak')?.price, 99);
  assert.equal(getArea('restaurant')?.items.find((i) => i.id === 'pizza'), undefined);
  const menu = priceList('restaurant');
  assert.match(menu, /steak \$99/);
  assert.match(menu, /Sold out today: burger/);
  assert.doesNotMatch(menu, /burger \$/);
  assert.ok(loadPairQuests().some((p) => p.roles.some((r) => r.facts.includes('steak $99'))));
  setContentOverrides([]);
});

test('farm rules from the world document', () => {
  setContentOverrides([{ kind: 'world', id: 'world', data: { farm: { crops: { carrot: { price: 7, enabled: false } }, harvestQty: 5, plotCount: 4 } }, deleted: false }]);
  applyFarmConfig(loadWorld().farm);
  assert.equal(CROP_PRICE.carrot, 7);
  assert.equal(FARM.harvestQty, 5);
  assert.equal(FARM.plotCount, 4);
  assert.deepEqual(FARM.disabled, ['carrot']);
  setContentOverrides([]);
  applyFarmConfig(loadWorld().farm);
  assert.equal(CROP_PRICE.carrot, 1);
  assert.equal(FARM.plotCount, 6);
});
