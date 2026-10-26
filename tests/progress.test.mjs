// Unit tests for the pure progression logic. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../public/js/progress.js';
import { QUESTS } from '../public/js/data.js';

test('exp curve grows with level', () => {
  let prev = 0;
  for (let lv = 1; lv < P.MAX_LEVEL; lv++) {
    const need = P.expToNext(lv);
    assert.ok(need > prev, `level ${lv} needs more exp than level ${lv - 1}`);
    prev = need;
  }
});

test('addExp levels up across several levels and caps at max level', () => {
  const p = P.newProgress();
  const gained = P.addExp(p, P.expToNext(1) + P.expToNext(2) + 5);
  assert.equal(gained, 2);
  assert.equal(p.level, 3);
  assert.equal(p.exp, 5);

  const max = P.newProgress();
  P.addExp(max, 1e9);
  assert.equal(max.level, P.MAX_LEVEL);
  assert.equal(max.exp, 0);
});

test('normalize repairs bad saves instead of trusting them', () => {
  const p = P.normalize({
    level: 999,
    exp: -5,
    gold: 'lots',
    inv: { potion_hp: 3, fake_item: 9, herb: -1, essence: 2000 },
    equip: { weapon: 'potion_hp', armor: 'armor_leaf' },
    quests: { main_1: { status: 'done', step: 99, count: -4 }, nope: { status: 'done' } },
    map: 'dungeon',
    pos: [1, 'x'],
  });
  assert.equal(p.level, P.MAX_LEVEL);
  assert.equal(p.exp, 0);
  assert.equal(p.gold, 0);
  assert.deepEqual(p.inv, { potion_hp: 3, essence: 999 });
  assert.equal(p.equip.weapon, null);
  assert.equal(p.equip.armor, 'armor_leaf');
  assert.equal(p.quests.main_1.step, QUESTS.main_1.steps.length);
  assert.equal(p.quests.main_1.count, 0);
  assert.equal(p.quests.nope, undefined);
  assert.equal(p.map, 'town');
  assert.equal(p.pos, null);
});

test('normalize accepts undefined and returns a fresh start', () => {
  const p = P.normalize(undefined);
  assert.equal(p.level, 1);
  assert.equal(p.map, 'town');
  assert.deepEqual(p.inv, {});
});

test('equipment adds to derived stats', () => {
  const p = P.newProgress();
  const base = P.statsFor(p);
  p.equip.weapon = 'sword_iron';
  p.equip.armor = 'armor_leaf';
  const geared = P.statsFor(p);
  assert.equal(geared.atk, base.atk + 8);
  assert.equal(geared.def, base.def + 4);
  assert.equal(geared.maxHp, base.maxHp + 20);
});

test('removeItem only removes what exists', () => {
  const p = P.newProgress();
  assert.equal(P.removeItem(p, 'potion_hp', 2), true);
  assert.equal(p.inv.potion_hp, 1);
  assert.equal(P.removeItem(p, 'potion_hp', 5), false);
  assert.equal(p.inv.potion_hp, 1);
});

test('kill events advance the kill step only after enough kills', () => {
  const p = P.newProgress();
  P.acceptQuest(p, 'main_1');
  P.applyEvent(p, { type: 'talk', npc: 'elder' });
  assert.equal(p.quests.main_1.step, 1);
  for (let i = 0; i < 4; i++) P.applyEvent(p, { type: 'kill', monster: 'slime', map: 'forest' });
  assert.equal(p.quests.main_1.step, 1);
  assert.equal(p.quests.main_1.count, 4);
  P.applyEvent(p, { type: 'kill', monster: 'slime', map: 'forest' });
  assert.equal(p.quests.main_1.step, 2);
  assert.equal(p.quests.main_1.count, 0);
});

test('kills on the wrong map or of the wrong monster do not count', () => {
  const p = P.newProgress();
  P.acceptQuest(p, 'main_1');
  P.applyEvent(p, { type: 'talk', npc: 'elder' });
  for (let i = 0; i < 10; i++) {
    P.applyEvent(p, { type: 'kill', monster: 'slime', map: 'mine' });
    P.applyEvent(p, { type: 'kill', monster: 'wolf', map: 'forest' });
  }
  assert.equal(p.quests.main_1.step, 1);
  assert.equal(p.quests.main_1.count, 0);
});

test('collect events accumulate and talk completes the quest with rewards', () => {
  const p = P.newProgress();
  P.acceptQuest(p, 'side_herb');
  P.applyEvent(p, { type: 'talk', npc: 'healer' });
  for (let i = 0; i < 5; i++) P.applyEvent(p, { type: 'collect', item: 'herb', qty: 1 });
  const msgs = P.applyEvent(p, { type: 'talk', npc: 'healer' });
  assert.equal(p.quests.side_herb.status, 'done');
  assert.ok(msgs.some((m) => m.includes('ภารกิจสำเร็จ')));
  assert.equal(p.gold, QUESTS.side_herb.reward.gold);
  assert.equal(p.inv.potion_hp, 3 + 3);
});

test('a quest cannot be accepted twice and is locked by level', () => {
  const p = P.newProgress();
  assert.equal(P.acceptQuest(p, 'main_1'), true);
  assert.equal(P.acceptQuest(p, 'main_1'), false);
  assert.deepEqual(P.availableQuests(p, 'hunter'), []);
  p.level = 3;
  assert.deepEqual(P.availableQuests(p, 'hunter'), ['side_wolf']);
});

test('the mine is gated by level 8', () => {
  const p = P.newProgress();
  assert.equal(P.mapUnlocked(p, 'forest'), true);
  assert.equal(P.mapUnlocked(p, 'mine'), false);
  p.level = 8;
  assert.equal(P.mapUnlocked(p, 'mine'), true);
});
