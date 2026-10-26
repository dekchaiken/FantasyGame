import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as DG from '../public/js/dungeon.js';
import * as P from '../public/js/progress.js';
import { MATERIALS, GEAR, RUNE_IDS, DUNGEONS } from '../public/js/data.js';

test('farm dungeons: daily entries count per dungeon and reset on a new day', () => {
  const p = P.newProgress();
  assert.equal(DG.entriesLeft(p, 'gold_mine', '2026-10-26'), 3);
  DG.useEntry(p, 'gold_mine', '2026-10-26');
  DG.useEntry(p, 'gold_mine', '2026-10-26');
  assert.equal(DG.entriesLeft(p, 'gold_mine', '2026-10-26'), 1);
  assert.equal(DG.entriesLeft(p, 'rune_shrine', '2026-10-26'), 2, 'other dungeons keep their own count');
  assert.equal(DG.entriesLeft(p, 'gold_mine', '2026-10-27'), 3, 'a new day resets the count');
});

test('tower: a boss every tenth floor and waves grow with the floor', () => {
  assert.ok(DG.towerWave(10).some(([id]) => id === 'tower_boss'));
  assert.ok(!DG.towerWave(11).some(([id]) => id === 'tower_boss'));
  const count = (w) => w.reduce((n, [, c]) => n + c, 0);
  assert.ok(count(DG.towerWave(90)) > count(DG.towerWave(3)));
  assert.ok(DG.towerMult(100) > DG.towerMult(10));
});

test('tower rewards: boss floors always drop gear and an extra rune', () => {
  const boss = DG.towerReward(20, () => 0.99);
  const plain = DG.towerReward(21, () => 0.99);
  assert.equal(boss.gear, 1);
  assert.equal(plain.gear, 0);
  assert.ok(boss.runes.length > plain.runes.length);
  assert.ok(boss.gold > DG.towerReward(19, () => 0.99).gold, 'deeper floors pay more');
});

test('farm reward is a roll over the dungeon table', () => {
  const rw = DG.farmReward('rune_shrine', () => 0);
  assert.equal(rw.runes.length, 1);
  assert.ok(RUNE_IDS.includes(rw.runes[0]));
  assert.ok(rw.gold >= DUNGEONS.rune_shrine.reward.gold[0]);
});

test('runes: socket into gear up to its slots, then take back out', () => {
  const p = P.newProgress('mage');
  const base = Object.keys(GEAR).find((k) => GEAR[k].slot === 'weapon' && GEAR[k].classId === 'mage' && GEAR[k].grade === 0);
  p.gear.push({ uid: 'w1', base, enh: 0, opts: [] });
  const rune = RUNE_IDS.find((id) => id.endsWith('_atk_1'));
  P.addMat(p, rune, 2);
  assert.equal(P.socketRune(p, 'w1', rune), null);
  assert.equal(p.gear[0].runes.length, 1);
  assert.equal(p.mats[rune], 1);
  assert.match(P.socketRune(p, 'w1', rune), /ช่องรูนเต็ม/, 'grade 0 gear has one slot');
  assert.equal(P.unsocketRune(p, 'w1', 0), null);
  assert.equal(p.mats[rune], 2);
  assert.equal(p.gear[0].runes.length, 0);
});

test('runes add to the gear stats', () => {
  const p = P.newProgress('mage');
  const base = Object.keys(GEAR).find((k) => GEAR[k].slot === 'weapon' && GEAR[k].classId === 'mage' && GEAR[k].grade === 0);
  p.gear.push({ uid: 'w1', base, enh: 0, opts: [] });
  p.equip.weapon = 'w1';
  const before = P.statsFor(p).atk;
  P.addMat(p, 'rune_atk_2', 1);
  P.socketRune(p, 'w1', 'rune_atk_2');
  assert.equal(P.statsFor(p).atk, before + MATERIALS.rune_atk_2.rune.v);
});

test('passives: active from the job level, second one from level 25', () => {
  const p = P.newProgress('mage');
  p.job = 'fire';
  p.level = 20;
  const list = P.passivesOf(p);
  assert.equal(list.length, 2);
  assert.equal(list[0].unlocked, true);
  assert.equal(list[1].unlocked, false);
  p.level = 25;
  assert.equal(P.passivesOf(p)[1].unlocked, true);
});

test('passives: a percentage passive raises the stat, no job means no passive', () => {
  const p = P.newProgress('mage');
  p.level = 30;
  const plain = P.statsFor(p).skillMg;
  p.job = 'fire';
  assert.ok(P.statsFor(p).skillMg > plain, 'fire gives skill damage');
  assert.equal(P.passivesOf(P.newProgress('mage')).length, 0);
});

test('dungeon progress: saved tower floor is kept and clamped', () => {
  const p = P.normalize({ ...P.newProgress('mage'), dungeon: { tower: 500, daily: { key: 'x', counts: { gold_mine: 2, nope: 9 } } } }, 'mage');
  assert.equal(p.dungeon.tower, 100);
  assert.deepEqual(p.dungeon.daily.counts, { gold_mine: 2 });
});
