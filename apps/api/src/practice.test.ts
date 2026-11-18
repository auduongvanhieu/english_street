import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LISTEN_COUNT, SHADOW_COUNT, dailyFor, shadowScore } from '@es/shared';
import { buildPractice, sentencePool } from './practice';

test('every day has a listening and a shadowing lesson, plus 2 picked tasks', () => {
  const d = dailyFor('p1', '2026-11-18');
  assert.equal(d.length, 4);
  assert.deepEqual(d.slice(0, 2), ['d-listen', 'd-shadow']);
  assert.equal(new Set(d).size, 4);
});

test('lessons: same player/day/round = same lesson; options hold the answer', () => {
  assert.ok(sentencePool('vi').length > 200);
  assert.ok(sentencePool('vi').some((s) => s.tr));
  const o = { playerId: 'p1', day: '2026-11-18', round: 0, level: 'A2' as const, lang: 'vi' };
  const a = buildPractice('listen', o);
  assert.deepEqual(a, buildPractice('listen', o));
  assert.notDeepEqual(a.questions, buildPractice('listen', { ...o, round: 1 }).questions);
  assert.equal(a.questions.length, LISTEN_COUNT);
  assert.ok(a.questions.some((q) => q.type === 'gap'));
  for (const q of a.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    if (q.type === 'pick') assert.equal(q.options[q.answer], q.s.en);
    else assert.equal(q.options[q.answer], q.s.en.split(/\s+/)[q.gap]!.replace(/[^A-Za-z']/g, '').toLowerCase());
    assert.ok(['A1', 'A2'].includes(q.s.level));
  }
  const s = buildPractice('shadow', { ...o, level: 'A1' });
  assert.equal(s.sentences.length, SHADOW_COUNT);
  for (const x of s.sentences) assert.equal(x.level, 'A1');
});

test('shadowing score: word order, punctuation, numbers, contractions', () => {
  assert.equal(shadowScore("I'd like two coffees, please.", 'I would like 2 coffees please').score >= 0.75, true);
  assert.equal(shadowScore('The cat is on the table.', 'the cat is on the table').score, 1);
  const half = shadowScore('The cat is on the table.', 'the dog is under a chair');
  assert.ok(half.score < 0.7);
  assert.deepEqual(half.words.map((w) => w.ok), [true, false, true, false, false, false]);
  assert.equal(shadowScore('Hello there', '').score, 0);
  assert.equal(shadowScore("It's sunny today.", 'it is sunny today').score >= 0.75, true);
});
