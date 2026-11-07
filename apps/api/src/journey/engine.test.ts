import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AREA_STEPS, MAIN_STEPS, dailyFor, weekKey, weeklyFor, type JourneyState } from '@es/shared';
import { applyEvent, chapterOf, stampsOf, today } from './engine';

const fresh = (daily: string[] = []): JourneyState => ({ done: [], prog: {}, day: '2026-11-06', daily, dailyDone: [], dailyProg: {}, dailyBonus: false, tracked: [] });

test('main chapters go in order, only the current one counts', () => {
  const st = fresh();
  // chapter 2's event first: nothing (chapter 1 is current)
  assert.equal(applyEvent(st, 'avatar_save', {}).done.length, 0);
  assert.deepEqual(applyEvent(st, 'npc_open', { npc: 'guide' }).done.map((s) => s.id), ['m01-hello']);
  assert.equal(chapterOf(st), 1);
  assert.equal(applyEvent(st, 'quest_end', { npc: 'barista', status: 'completed' }).done.length, 0);
  assert.deepEqual(applyEvent(st, 'avatar_save', {}).done.map((s) => s.id), ['m03-look']);
  // the same event again pays nothing
  assert.equal(applyEvent(st, 'avatar_save', {}).done.length, 0);
});

test('counts, lists of values, area stamps', () => {
  const st = fresh();
  for (let i = 0; i < 4; i++) assert.equal(applyEvent(st, 'word_card_open', { area: 'zoo' }).done.length, 0);
  assert.deepEqual(applyEvent(st, 'word_card_open', { area: 'zoo' }).done.map((s) => s.id), ['a-zoo-cards']);
  applyEvent(st, 'quiz_done', { area: 'zoo' });
  const r = applyEvent(st, 'quest_end', { npc: 'zookeeper', status: 'completed' });
  assert.equal(r.stamp, 'zoo');
  assert.deepEqual(stampsOf(st), ['zoo']);
  // tip must be 10/15/20 and right
  assert.equal(applyEvent(st, 'restaurant_pay', { tip: 0, ok: true }).done.length, 0);
  assert.equal(applyEvent(st, 'restaurant_pay', { tip: 15, ok: false }).done.length, 0);
  assert.ok(applyEvent(st, 'restaurant_pay', { tip: 15, ok: true }).done.some((s) => s.id === 'a-restaurant-tip'));
});

test('six stamps finish the last chapter when it is current', () => {
  const st = fresh();
  st.done = MAIN_STEPS.slice(0, 11).map((s) => s.id);
  const areas = ['zoo', 'farm', 'school', 'clothes', 'station', 'hospital'];
  st.done.push(...AREA_STEPS.filter((s) => areas.slice(0, 5).includes(s.area!)).map((s) => s.id));
  st.done.push(...AREA_STEPS.filter((s) => s.area === 'hospital').slice(0, 2).map((s) => s.id));
  const r = applyEvent(st, 'quest_end', { npc: 'doctor', status: 'completed' });
  assert.equal(r.stamp, 'hospital');
  assert.ok(r.done.some((s) => s.id === 'm12-citizen'));
});

test('daily tasks and the bonus', () => {
  const st = fresh(['d-hug', 'd-quiz', 'd-farm']);
  applyEvent(st, 'critter_hug', {});
  applyEvent(st, 'quiz_done', { area: 'farm' });
  const r = applyEvent(st, 'farm_action', { action: 'harvest' });
  assert.ok(r.dailyBonus);
  assert.equal(applyEvent(st, 'critter_hug', {}).dailyBonus, false);
});

test('daily picks and weekly are stable', () => {
  assert.deepEqual(dailyFor('player-1', '2026-11-06'), dailyFor('player-1', '2026-11-06'));
  assert.equal(new Set(dailyFor('player-1', '2026-11-06')).size, 3);
  assert.match(weekKey(Date.UTC(2026, 10, 6)), /^2026-W4[45]$/);
  assert.ok(weeklyFor('2026-W45').id.startsWith('w-'));
});

test('a day in English Street: steps in order, bonus once, new every day', () => {
  const st: JourneyState = { done: [], prog: {}, day: today(), daily: [], dailyDone: [], dailyProg: {}, dailyBonus: false, tracked: [] };
  // out of order: the class does not count before breakfast
  assert.ok(applyEvent(st, 'minigame_done', { game: 'class' }).done.length === 0);
  assert.ok(applyEvent(st, 'npc_open', { npc: 'barista' }).done.some((s) => s.id === 's1-morning'));
  assert.ok(applyEvent(st, 'bus_ride', { to: 'school' }).done.some((s) => s.id === 's2-bus'));
  for (const [n, p] of [['minigame_done', { game: 'class' }], ['restaurant_order', {}], ['shopping_done', {}], ['minigame_done', { game: 'hoops' }], ['minigame_done', { game: 'movie' }]] as const) applyEvent(st, n, p);
  const last = applyEvent(st, 'home_room_enter', {});
  assert.ok(last.storyBonus && st.story === 8);
  assert.ok(!applyEvent(st, 'home_room_enter', {}).storyBonus);
});
