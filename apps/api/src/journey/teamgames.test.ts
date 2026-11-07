import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUNT_PLACES, RELAY_WORDS, TEAM_GAMES, harvestTask, huntPlaces, normGuess, relayQuestion, rushOrder, sameTicket } from '@es/shared';

test('team games: generated questions are always answerable', () => {
  for (let seed = 1; seed < 60; seed++) {
    for (let n = 0; n < 12; n++) {
      const q = relayQuestion(seed, n);
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      const pair = RELAY_WORDS.find(([w, e]) => (q.kind === 'pic' ? w === q.prompt : e === q.prompt))!;
      assert.equal(q.options[q.answer], q.kind === 'pic' ? pair[1] : pair[0]);
      const h = harvestTask(seed, n);
      assert.ok(h.need >= 1 && h.need <= h.right.length, h.text);
      const o = rushOrder(seed, n);
      assert.ok(o.table >= 1 && o.table <= 6 && o.sentence.includes(`Table ${o.table}`));
      assert.ok(sameTicket(o.items, { ...o.items }));
    }
    const red = huntPlaces(seed, 'red');
    const blue = huntPlaces(seed, 'blue');
    assert.equal(red.length, TEAM_GAMES.hunt.target);
    assert.deepEqual([...red].sort(), [...blue].sort());
    assert.ok(red.every((i) => HUNT_PLACES[i]));
  }
  assert.equal(normGuess("It's a Camera!"), 'camera');
  assert.equal(normGuess('an umbrella'), normGuess('umbrella'));
});
