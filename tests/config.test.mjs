import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateValue, checkReferences, applyGameConfig, defaultsOf } from '../public/js/config-apply.js';
import * as DATA from '../public/js/data.js';

test('validation: numbers, strings and arrays keep their shape', () => {
  assert.deepEqual(validateValue(5, 7), []);
  assert.match(validateValue(5, 'x')[0], /ตัวเลข/);
  assert.match(validateValue(5, -1)[0], /ติดลบ/);
  assert.match(validateValue('ชื่อ', 3)[0], /ข้อความ/);
  assert.deepEqual(validateValue([1, 2], [3, 4, 5]), []);
  assert.match(validateValue([1, 2], [3, 'x'])[0], /ตัวเลข/);
});

test('validation: an object may not gain keys the default does not have', () => {
  const def = { hp: 10, name: 'a' };
  assert.deepEqual(validateValue(def, { hp: 3, name: 'b' }), []);
  assert.match(validateValue(def, { hp: 3, name: 'b', cheat: 1 })[0], /ไม่รู้จัก/);
});

test('references: a quest must point at real npcs, monsters and maps', () => {
  const bad = { steps: [{ type: 'kill', monster: 'nope', map: 'forest', count: 1 }, { type: 'talk', npc: 'ghost' }] };
  const errs = checkReferences('quests', 'x', bad);
  assert.equal(errs.length, 2);
  assert.deepEqual(checkReferences('quests', 'camp_1', DATA.QUESTS.camp_1), []);
});

test('applying an override changes the live data and a reset puts it back', () => {
  const original = DATA.MONSTERS.slime.hp;
  applyGameConfig({ monsters: { slime: { ...DATA.MONSTERS.slime, hp: 999 } } });
  assert.equal(DATA.MONSTERS.slime.hp, 999);
  applyGameConfig({ monsters: { slime: defaultsOf('monsters').slime } });
  assert.equal(DATA.MONSTERS.slime.hp, original);
});

test('single-object categories keep their identity when overridden', () => {
  const ref = DATA.RATES;
  applyGameConfig({ rates: { rates: { dropScale: 0.9, nodeRespawn: 10 } } });
  assert.equal(DATA.RATES, ref);
  assert.equal(DATA.RATES.dropScale, 0.9);
  applyGameConfig({ rates: { rates: defaultsOf('rates').rates } });
  assert.equal(DATA.RATES.dropScale, 0.55);
});
