import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../public/js/progress.js';
import { SPIRIT_RARITY, SPIRIT_PASSIVES } from '../public/js/data.js';

test('summon: an orb becomes a spirit, uses up the orb, and the first spirit is equipped', () => {
  const p = P.newProgress('mage');
  P.addMat(p, 'spirit_orb_rare', 2);
  const r = P.summonSpirit(p, 'spirit_orb_rare', () => 0);
  assert.equal(r.spirit.rarity, 'rare');
  assert.equal(p.mats.spirit_orb_rare, 1);
  assert.equal(p.spirit, r.spirit.uid, 'first spirit is equipped');
  P.summonSpirit(p, 'spirit_orb_rare', () => 0);
  assert.notEqual(p.spirit, p.spirits[1].uid, 'second spirit does not take over');
});

test('summon: passives per rarity and no duplicates', () => {
  const p = P.newProgress('mage');
  for (const r of SPIRIT_RARITY) P.addMat(p, `spirit_orb_${r.id}`, 1);
  for (const r of SPIRIT_RARITY) {
    const s = P.summonSpirit(p, `spirit_orb_${r.id}`, Math.random).spirit;
    assert.equal(s.passives.length, r.passives, `${r.id} passives`);
    assert.equal(new Set(s.passives).size, s.passives.length);
  }
});

test('summon: errors for a non-orb item and a missing orb', () => {
  const p = P.newProgress('mage');
  assert.match(P.summonSpirit(p, 'potion_hp').error, /ไม่ใช่ลูกแก้ว/);
  assert.match(P.summonSpirit(p, 'spirit_orb_common').error, /ไม่มีลูกแก้ว/);
});

test('stats: an equipped spirit adds its rarity bonus and passives', () => {
  const p = P.newProgress('mage');
  p.level = 20;
  const before = P.statsFor(p);
  P.addMat(p, 'spirit_orb_mythic', 1);
  P.summonSpirit(p, 'spirit_orb_mythic', () => 0);
  const after = P.statsFor(p);
  assert.ok(after.maxHp > before.maxHp, 'hp bonus from the spirit');
  assert.ok(after.atk > before.atk, 'attack bonus from the spirit');
  P.equipSpirit(p, null);
  assert.equal(P.statsFor(p).atk, before.atk, 'unequipped spirit gives nothing');
});

test('equip: rejects a spirit the hero does not own', () => {
  const p = P.newProgress('mage');
  assert.match(P.equipSpirit(p, 'nope'), /ไม่พบ/);
});

test('normalize: drops spirits with bad rarity or unknown passives', () => {
  const p = P.normalize({
    ...P.newProgress('mage'),
    spirits: [
      { uid: 'a1', rarity: 'rare', passives: ['sp_crit', 'bogus'] },
      { uid: 'a2', rarity: 'godly', passives: [] },
    ],
    spirit: 'a2',
  }, 'mage');
  assert.equal(p.spirits.length, 1);
  assert.deepEqual(p.spirits[0].passives, ['sp_crit']);
  assert.equal(p.spirit, null, 'an equipped spirit that was dropped is cleared');
  assert.ok(SPIRIT_PASSIVES.length >= 8);
});
