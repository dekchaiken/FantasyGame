// Unit tests for the progression rules. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../public/js/progress.js';
import { GEAR, AFFIXES, OPTION_COUNT, MAX_ENH, QUESTS } from '../public/js/data.js';
import { skillsOfClass, SKILL_BY_ID } from '../public/js/skills.js';

// deterministic random source for repeatable rolls
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('exp curve grows with level and level-ups carry over', () => {
  for (let lv = 2; lv < P.MAX_LEVEL; lv++) assert.ok(P.expToNext(lv) > P.expToNext(lv - 1));
  const p = P.newProgress();
  assert.equal(P.addExp(p, P.expToNext(1) + P.expToNext(2) + 5), 2);
  assert.equal(p.level, 3);
  assert.equal(p.exp, 5);
  const max = P.newProgress();
  P.addExp(max, 1e9);
  assert.equal(max.level, P.MAX_LEVEL);
});

test('every class starts with its first skill learned and on the hotbar', () => {
  for (const c of ['swordsman', 'assassin', 'mage', 'priest']) {
    const p = P.newProgress(c);
    const first = skillsOfClass(c).find((s) => s.tier === 1);
    assert.equal(p.skills[first.id], 1);
    assert.equal(p.hotbar[0], first.id);
  }
});

test('weapons only come from their own class lines', () => {
  const rng = seeded(7);
  for (let i = 0; i < 300; i++) {
    const g = P.rollDrop('mage', 9, rng);
    const base = GEAR[g.base];
    if (base.slot === 'weapon') assert.equal(base.classId, 'mage', g.base);
  }
});

test('gear rolls respect the tier option counts and affix ranges', () => {
  const rng = seeded(11);
  for (const id of Object.keys(GEAR)) {
    for (let i = 0; i < 20; i++) {
      const g = P.makeGear(id, rng);
      const base = GEAR[id];
      const [min, max] = OPTION_COUNT[base.tier];
      assert.ok(g.opts.length >= min && g.opts.length <= max, `${id} option count`);
      assert.equal(new Set(g.opts.map((o) => o.k)).size, g.opts.length, 'options are distinct');
      for (const o of g.opts) {
        const af = AFFIXES.find((a) => a.k === o.k);
        const [lo, hi] = af.range[base.tier];
        assert.ok(o.v >= lo && o.v <= hi, `${o.k}=${o.v} outside ${lo}-${hi}`);
      }
    }
  }
});

test('higher monster levels roll better tiers more often', () => {
  const rng = seeded(3);
  const count = (lvl) => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[P.rollTier(lvl, rng)]++;
    return counts;
  };
  const low = count(1);
  const high = count(12);
  assert.ok(high[2] + high[3] > low[2] + low[3]);
  assert.ok(low[0] > low[1]);
});

test('equipped gear changes stats and enhancement scales them', () => {
  const p = P.newProgress('swordsman');
  const base = P.statsFor(p);
  const g = { uid: 'gtest1', base: 'blade_2', enh: 0, opts: [{ k: 'atk', v: 10 }, { k: 'crit', v: 3 }] };
  P.addGear(p, g);
  assert.equal(P.equipGear(p, 'gtest1', 'swordsman'), null);
  const geared = P.statsFor(p);
  assert.equal(geared.atk, base.atk + GEAR.blade_2.atk + 10);
  assert.equal(geared.crit, base.crit + 3);
  g.enh = 10;
  assert.ok(P.statsFor(p).atk > geared.atk, 'enhancement raises attack');
});

test('a weapon of another class cannot be equipped', () => {
  const p = P.newProgress('priest');
  P.addGear(p, { uid: 'gmage1', base: 'staff_0', enh: 0, opts: [] });
  assert.ok(P.equipGear(p, 'gmage1', 'priest'));
  assert.equal(p.equip.weapon, null);
});

test('enhancement spends gold and stones and can succeed, fail or downgrade', () => {
  const p = P.newProgress();
  p.gold = 1e6;
  p.mats.enh_stone = 50;
  P.addGear(p, { uid: 'genh01', base: 'light_0', enh: 0, opts: [] });
  // always succeed
  const win = P.enhance(p, 'genh01', () => 0);
  assert.equal(win.result, 'success');
  assert.equal(P.findGear(p, 'genh01').enh, 1);
  assert.equal(p.mats.enh_stone, 49);
  // a failed attempt below the downgrade threshold keeps the level
  const miss = P.enhance(p, 'genh01', () => 0.999);
  assert.equal(miss.result, 'fail');
  assert.equal(P.findGear(p, 'genh01').enh, 1);
  // at or above the threshold a failure drops one level
  P.findGear(p, 'genh01').enh = 8;
  const down = P.enhance(p, 'genh01', () => 0.999);
  assert.equal(down.result, 'down');
  assert.equal(P.findGear(p, 'genh01').enh, 7);
});

test('enhancement refuses without gold or stones and stops at the max level', () => {
  const p = P.newProgress();
  P.addGear(p, { uid: 'genh02', base: 'light_0', enh: 0, opts: [] });
  assert.equal(P.enhance(p, 'genh02', () => 0).result, 'error'); // no gold, no stones
  p.gold = 1e6;
  assert.equal(P.enhance(p, 'genh02', () => 0).result, 'error'); // no stones
  p.mats.enh_stone = 1;
  P.findGear(p, 'genh02').enh = MAX_ENH;
  assert.equal(P.enhance(p, 'genh02', () => 0).result, 'error');
});

test('selling a worn item pays gold and removes it', () => {
  const p = P.newProgress();
  P.addGear(p, { uid: 'gsell1', base: 'light_1', enh: 2, opts: [] });
  const gold = p.gold;
  const price = P.sellGear(p, 'gsell1');
  assert.equal(price, P.sellPrice({ base: 'light_1', enh: 2 }));
  assert.equal(p.gold, gold + price);
  assert.equal(P.findGear(p, 'gsell1'), null);
});

test('skill points: one per level, tiers need their line, ranks cap at three', () => {
  const p = P.newProgress('mage');
  assert.equal(P.skillPoints(p), 0);
  P.addExp(p, P.expToNext(1) + P.expToNext(2) + P.expToNext(3) + P.expToNext(4));
  assert.equal(P.skillPoints(p), 2 * (p.level - 1));
  const t2 = 'mg_f2';
  assert.equal(P.canLearn(p, t2), null, 'tier 2 is open because tier 1 is learned');
  assert.match(P.canLearn(p, 'mg_i2') ?? '', /ต้องเรียนรู้/, 'another line needs its own tier 1');
  assert.equal(P.learnSkill(p, 'mg_f1'), null, 'a learned skill can be ranked up');
  assert.equal(p.skills.mg_f1, 2);
  p.level = 30;
  p.skills = { mg_f1: 3 };
  assert.equal(P.canLearn(p, 'mg_f1'), 'เรียนรู้ระดับสูงสุดแล้ว');
  assert.equal(P.learnSkill(p, t2), null);
  assert.equal(p.skills[t2], 1);
});

test('learning fills the first free hotbar slot and setHotbar moves skills', () => {
  const p = P.newProgress('priest');
  p.level = 10;
  P.learnSkill(p, 'pr_h1');
  assert.ok(p.hotbar.includes('pr_h1'));
  assert.equal(P.setHotbar(p, 4, 'pr_h1'), null);
  assert.equal(p.hotbar[4], 'pr_h1');
  assert.equal(p.hotbar.filter((x) => x === 'pr_h1').length, 1, 'a skill sits on one slot only');
  assert.ok(P.setHotbar(p, 5, 'pr_h4'), 'an unlearned skill cannot go on the hotbar');
});

test('normalize repairs bad saves and keeps only known data', () => {
  const p = P.normalize({
    v: 3, level: 999, exp: -5, gold: 'lots',
    mats: { potion_hp: 3, fake: 9, herb: -1, essence: 2000 },
    gear: [{ uid: 'gbad001', base: 'nope', enh: 1, opts: [] }, { uid: 'gok0001', base: 'light_0', enh: 99, opts: [{ k: 'bogus', v: 1 }, { k: 'atk', v: 4 }] }],
    equip: { weapon: 'gok0001', armor: 'gok0001' },
    skills: { 'mg_f1': 1, 'mg_f2': 99, 'x': 'y' },
    hotbar: ['mg_f1', 'ghost', null],
    quests: { main_1: { status: 'done', step: 99, count: -4 }, nope: { status: 'done' } },
    map: 'dungeon', pos: [1, 'x'],
  }, 'mage');
  assert.equal(p.level, P.MAX_LEVEL);
  assert.equal(p.exp, 0);
  assert.equal(p.gold, 0);
  assert.deepEqual(p.mats, { potion_hp: 3, essence: 999 });
  assert.equal(p.gear.length, 1);
  assert.equal(p.gear[0].enh, MAX_ENH);
  assert.deepEqual(p.gear[0].opts, [{ k: 'atk', v: 4 }]);
  assert.equal(p.equip.weapon, null, 'armour cannot sit in the weapon slot');
  assert.equal(p.equip.armor, 'gok0001');
  assert.equal(p.skills.mg_f2, 3);
  assert.equal(p.skills.x, undefined);
  assert.equal(p.hotbar[0], 'mg_f1');
  assert.equal(p.hotbar[1], null);
  assert.equal(p.quests.main_1.step, QUESTS.main_1.steps.length);
  assert.equal(p.map, 'town');
});

test('a v2 save migrates potions, materials and equipment to v3', () => {
  const p = P.normalize({
    level: 4, exp: 10, gold: 50, map: 'forest',
    inv: { potion_hp: 2, essence: 3, armor_leaf: 1 },
    equip: { weapon: 'sword_iron', armor: null },
    quests: { main_1: { status: 'active', step: 2, count: 1 } },
  }, 'swordsman');
  assert.equal(p.v, 3);
  assert.equal(p.level, 4);
  assert.equal(p.mats.potion_hp, 2);
  assert.equal(p.mats.essence, 3);
  assert.equal(p.gear.length, 2);
  assert.equal(GEAR[P.findGear(p, p.equip.weapon).base].name, 'ดาบเหล็กกล้า');
  assert.equal(p.quests.main_1.step, 2);
  assert.equal(p.map, 'forest');
  assert.ok(p.hotbar[0], 'starter skill is kept');
});

test('a quest reward can roll gear for the hero class', () => {
  const p = P.newProgress('assassin');
  const lines = P.grantReward(p, 'main_1', 'assassin', seeded(5));
  assert.ok(lines.some((l) => l.includes('ได้รับ')));
  const weapon = p.gear.find((g) => GEAR[g.base].slot === 'weapon');
  assert.equal(GEAR[weapon.base].classId, 'assassin');
  assert.equal(GEAR[weapon.base].tier, 1);
});

test('kill events advance the kill step only after enough kills', () => {
  const p = P.newProgress();
  P.acceptQuest(p, 'main_1');
  P.applyEvent(p, { type: 'talk', npc: 'elder' });
  assert.equal(p.quests.main_1.step, 1);
  for (let i = 0; i < 4; i++) P.applyEvent(p, { type: 'kill', monster: 'slime', map: 'forest' });
  assert.equal(p.quests.main_1.step, 1);
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
