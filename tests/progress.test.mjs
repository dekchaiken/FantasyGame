// Unit tests for the progression rules. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../public/js/progress.js';
import { GEAR, GRADES, BANDS, GEAR_SLOTS, AFFIXES, QUESTS, MAX_ENH } from '../public/js/data.js';
import { skillsOfClass, SKILL_BY_ID } from '../public/js/skills.js';

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('exp curve grows with level and level-ups carry over', () => {
  for (let lv = 2; lv < P.MAX_LEVEL; lv++) assert.ok(P.expToNext(lv) > P.expToNext(lv - 1));
  const p = P.newProgress();
  assert.equal(P.addExp(p, P.expToNext(1) + P.expToNext(2) + 5), 2);
  assert.equal(p.level, 3);
  assert.equal(p.exp, 5);
});

test('every class starts with its first skill learned and on the hotbar', () => {
  for (const c of ['swordsman', 'assassin', 'mage', 'priest']) {
    const p = P.newProgress(c);
    const first = skillsOfClass(c).find((s) => s.tier === 1);
    assert.equal(p.skills[first.id], 1);
    assert.equal(p.hotbar[0], first.id);
  }
});

test('the gear table has six bands, six grades, seven slots and class-only weapons', () => {
  assert.equal(BANDS.length, 6);
  assert.equal(GRADES.length, 6);
  assert.deepEqual(GRADES.map((g) => g.name), ['ธรรมดา', 'พื้นฐาน', 'หายาก', 'แรร์', 'ตำนาน', 'ขั้นสุด']);
  assert.equal(GEAR_SLOTS.length, 7);
  for (const id of Object.keys(GEAR)) {
    const g = GEAR[id];
    if (g.slot === 'weapon') assert.ok(g.classId, id);
    assert.equal(g.level, BANDS[g.band].level);
  }
  // names differ between bands
  assert.notEqual(GEAR.blade_0_0.name, GEAR.blade_1_0.name);
});

test('weapons only drop for their own class', () => {
  const rng = seeded(7);
  for (let i = 0; i < 300; i++) {
    const g = P.rollDrop('mage', 12, rng);
    if (GEAR[g.base].slot === 'weapon') assert.equal(GEAR[g.base].classId, 'mage', g.base);
  }
});

test('option counts follow the grade and options scale with band and grade', () => {
  const rng = seeded(11);
  for (const id of Object.keys(GEAR)) {
    const g = GEAR[id];
    const [min, max] = GRADES[g.grade].opts;
    for (let i = 0; i < 10; i++) {
      const gear = P.makeGear(id, rng);
      assert.ok(gear.opts.length >= min && gear.opts.length <= max, `${id} option count`);
      assert.equal(new Set(gear.opts.map((o) => o.k)).size, gear.opts.length);
    }
  }
  // a higher band rolls bigger numbers for the same affix
  const lo = P.makeGear('shirt_0_3', seeded(1)).opts.reduce((a, o) => a + o.v, 0);
  const hi = P.makeGear('shirt_5_3', seeded(1)).opts.reduce((a, o) => a + o.v, 0);
  assert.ok(hi > lo);
  assert.ok(AFFIXES.length >= 9);
});

test('drop grades follow the weights', () => {
  const rng = seeded(9);
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6000; i++) counts[P.rollGrade(GRADES.map((g) => g.weight), rng)]++;
  assert.ok(counts[0] > counts[1] && counts[1] > counts[2] && counts[4] > counts[5]);
});

test('crafting needs the level, the class line, gold and materials', () => {
  const p = P.newProgress('swordsman');
  assert.match(P.craftGear(p, 'blade', 1, 'swordsman').error, /ต้องเลเวล/);
  p.level = 10;
  assert.match(P.craftGear(p, 'staff', 0, 'swordsman').error, /สายอาวุธ/);
  assert.match(P.craftGear(p, 'blade', 0, 'swordsman').error, /เหรียญ/);
  p.gold = 100000;
  assert.match(P.craftGear(p, 'blade', 0, 'swordsman').error, /ชิ้น/);
  p.mats = { essence: 50, wolf_fang: 50, crystal_ore: 50 };
  const r = P.craftGear(p, 'blade', 0, 'swordsman', () => 0.5);
  assert.ok(r.gear, 'craft succeeds');
  assert.ok(GEAR[r.gear.base].grade >= 1, 'crafted gear is never common');
  assert.equal(p.gear.length, 1);
});

test('equipping checks class, slot and level', () => {
  const p = P.newProgress('assassin');
  P.addGear(p, { uid: 'gstaf01', base: 'staff_0_1', enh: 0, opts: [] });
  assert.ok(P.equipGear(p, 'gstaf01', 'assassin'), 'other class weapon refused');
  P.addGear(p, { uid: 'ghat001', base: 'hat_1_0', enh: 0, opts: [] });
  assert.match(P.equipGear(p, 'ghat001', 'assassin'), /ต้องเลเวล 10/);
  p.level = 10;
  assert.equal(P.equipGear(p, 'ghat001', 'assassin'), null);
  assert.equal(p.equip.hat, 'ghat001');
});

test('all seven slots add to the stats', () => {
  const p = P.newProgress('swordsman');
  p.level = 30;
  const base = P.statsFor(p);
  const ids = { hat: 'hat_5_5', shirt: 'shirt_5_5', pants: 'pants_5_5', shoes: 'shoes_5_5', ring: 'ring_5_5', bracelet: 'bracelet_5_5' };
  for (const [slot, base_] of Object.entries(ids)) {
    P.addGear(p, { uid: 'g' + slot + '01', base: base_, enh: 0, opts: [] });
    P.equipGear(p, 'g' + slot + '01', 'swordsman');
  }
  const geared = P.statsFor(p);
  assert.ok(geared.def > base.def && geared.maxHp > base.maxHp);
});

test('enhancement can succeed, fail or downgrade, and refuses when short', () => {
  const p = P.newProgress();
  p.gold = 1e6;
  p.mats.enh_stone = 50;
  P.addGear(p, { uid: 'genh01', base: 'shirt_0_0', enh: 0, opts: [] });
  assert.equal(P.enhance(p, 'genh01', () => 0).result, 'success');
  assert.equal(P.findGear(p, 'genh01').enh, 1);
  assert.equal(P.enhance(p, 'genh01', () => 0.999).result, 'fail');
  P.findGear(p, 'genh01').enh = 8;
  assert.equal(P.enhance(p, 'genh01', () => 0.999).result, 'down');
  assert.equal(P.findGear(p, 'genh01').enh, 7);
  P.findGear(p, 'genh01').enh = MAX_ENH;
  assert.equal(P.enhance(p, 'genh01', () => 0).result, 'error');
});

test('selling pays gold and refuses equipped items', () => {
  const p = P.newProgress();
  p.level = 10;
  P.addGear(p, { uid: 'gsell1', base: 'pants_1_2', enh: 2, opts: [] });
  P.equipGear(p, 'gsell1', 'swordsman');
  assert.equal(P.sellGear(p, 'gsell1'), null);
  P.unequip(p, 'pants');
  const gold = p.gold;
  const price = P.sellGear(p, 'gsell1');
  assert.ok(price > 0);
  assert.equal(p.gold, gold + price);
});

test('skill points: one per level, tiers need their line, ranks cap at three', () => {
  const p = P.newProgress('mage');
  assert.equal(P.skillPoints(p), 0);
  P.addExp(p, P.expToNext(1) + P.expToNext(2) + P.expToNext(3) + P.expToNext(4));
  assert.equal(P.skillPoints(p), 2 * (p.level - 1));
  assert.match(P.canLearn(p, 'mg_f2'), /ต้องเป็น/, 'tier 2 needs the job');
  p.job = 'fire';
  assert.equal(P.canLearn(p, 'mg_f2'), null, 'tier 2 is open once the job is held');
  assert.match(P.canLearn(p, 'mg_i2'), /ต้องเรียนรู้|ต้องเป็น/);
  assert.equal(P.learnSkill(p, 'mg_f1'), null);
  assert.equal(p.skills.mg_f1, 2);
  p.level = 30;
  p.skills = { mg_f1: 3 };
  assert.equal(P.canLearn(p, 'mg_f1'), 'เรียนรู้ระดับสูงสุดแล้ว');
  assert.equal(P.learnSkill(p, 'mg_f2'), null);
  assert.equal(p.skills.mg_f2, 1);
  assert.ok(SKILL_BY_ID.mg_f2.reqLv === 5);
});

test('learning fills the hotbar and setHotbar keeps one slot per skill', () => {
  const p = P.newProgress('priest');
  p.level = 10;
  P.learnSkill(p, 'pr_h1');
  assert.ok(p.hotbar.includes('pr_h1'));
  assert.equal(P.setHotbar(p, 4, 'pr_h1'), null);
  assert.equal(p.hotbar[4], 'pr_h1');
  assert.equal(p.hotbar.filter((x) => x === 'pr_h1').length, 1);
  assert.ok(P.setHotbar(p, 5, 'pr_h4'));
});

test('normalize repairs bad saves and keeps only known data', () => {
  const p = P.normalize({
    v: 4, level: 999, exp: -5, gold: 'lots',
    mats: { potion_hp: 3, fake: 9, herb: -1, essence: 2000 },
    gear: [{ uid: 'gbad001', base: 'nope', enh: 1, opts: [] }, { uid: 'gok0001', base: 'shirt_0_0', enh: 99, opts: [{ k: 'bogus', v: 1 }, { k: 'atk', v: 4 }] }],
    equip: { weapon: 'gok0001', shirt: 'gok0001' },
    skills: { mg_f1: 1, mg_f2: 99, x: 'y' },
    hotbar: ['mg_f1', 'ghost', null],
    quests: { main_1: { status: 'done', step: 99, count: -4 }, nope: { status: 'done' } },
    map: 'dungeon', pos: [1, 'x'],
  }, 'mage');
  assert.equal(p.level, P.MAX_LEVEL);
  assert.equal(p.gold, 0);
  assert.deepEqual(p.mats, { potion_hp: 3, essence: 999 });
  assert.equal(p.gear.length, 1);
  assert.equal(p.gear[0].enh, MAX_ENH);
  assert.equal(p.equip.weapon, null);
  assert.equal(p.equip.shirt, 'gok0001');
  assert.equal(p.skills.mg_f2, 3);
  assert.equal(p.quests.main_1.step, QUESTS.main_1.steps.length);
  assert.equal(p.map, 'town');
});

test('a v2 save migrates potions, materials and equipment', () => {
  const p = P.normalize({
    level: 4, exp: 10, gold: 50, map: 'forest',
    inv: { potion_hp: 2, essence: 3, armor_leaf: 1 },
    equip: { weapon: 'sword_iron', armor: null },
    quests: { main_1: { status: 'active', step: 2, count: 1 } },
  }, 'swordsman');
  assert.equal(p.v, 4);
  assert.equal(p.mats.potion_hp, 2);
  assert.equal(p.mats.essence, 3);
  assert.equal(p.gear.length, 2);
  assert.equal(GEAR[P.findGear(p, p.equip.weapon).base].slot, 'weapon');
  assert.equal(p.quests.main_1.step, 2);
});

test('a quest reward gives gear of the reward band and grade', () => {
  const p = P.newProgress('assassin');
  const lines = P.grantReward(p, 'main_1', 'assassin', seeded(5));
  assert.ok(lines.some((l) => l.includes('ได้รับ')));
  const w = p.gear.find((g) => GEAR[g.base].slot === 'weapon');
  assert.equal(GEAR[w.base].classId, 'assassin');
  assert.equal(GEAR[w.base].band, 0);
  assert.equal(GEAR[w.base].grade, 1);
});

test('kill events advance the kill step only after enough kills', () => {
  const p = P.newProgress();
  P.acceptQuest(p, 'main_1');
  P.applyEvent(p, { type: 'talk', npc: 'elder' });
  for (let i = 0; i < 4; i++) P.applyEvent(p, { type: 'kill', monster: 'slime', map: 'forest' });
  assert.equal(p.quests.main_1.step, 1);
  P.applyEvent(p, { type: 'kill', monster: 'slime', map: 'forest' });
  assert.equal(p.quests.main_1.step, 2);
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
});

test('each level band has its own map', () => {
  const p = P.newProgress();
  assert.equal(P.mapUnlocked(p, 'meadow'), false);
  p.level = 5;
  assert.equal(P.mapUnlocked(p, 'meadow'), true);
  assert.equal(P.mapUnlocked(p, 'mine'), false);
  p.level = 10;
  assert.equal(P.mapUnlocked(p, 'mine'), true);
  assert.equal(P.mapUnlocked(p, 'ruin'), false);
  p.level = 20;
  assert.equal(P.mapUnlocked(p, 'ruin'), true);
});

test('job: chosen once at level 20, from the class own lines', () => {
  const p = P.newProgress('mage');
  assert.match(P.chooseJob(p, 'fire', 'mage'), /ต้องถึงเลเวล 20/);
  p.level = 20;
  assert.match(P.chooseJob(p, 'holy', 'mage'), /ไม่ใช่ของคลาส/);
  assert.equal(P.chooseJob(p, 'fire', 'mage'), null);
  assert.equal(p.job, 'fire');
  assert.match(P.chooseJob(p, 'ice', 'mage'), /เปลี่ยนไม่ได้/);
});

test('job: other lines tier 2+ are locked, tier 1 stays open', () => {
  const p = P.newProgress('mage');
  p.level = 30;
  p.job = 'fire';
  p.skills = { mg_f1: 1 };
  assert.equal(P.skillUsable(p, 'mg_f1'), true);
  assert.equal(P.skillUsable(p, 'mg_i1'), false, 'learned skills need the job too');
  assert.equal(P.skillJobLock(p, 'mg_i1'), null, 'tier 1 of another line is always open');
  assert.match(P.skillJobLock(p, 'mg_i2'), /ต้องเป็นจอมเวทน้ำแข็ง/);
});

test('normalize keeps a job only when it belongs to the class', () => {
  const p = P.normalize({ ...P.newProgress('mage'), job: 'holy' }, 'mage');
  assert.equal(p.job, null);
  const q = P.normalize({ ...P.newProgress('mage'), job: 'fire' }, 'mage');
  assert.equal(q.job, 'fire');
});
