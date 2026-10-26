import { MATERIALS, GEAR, AFFIXES, OPTION_COUNT, ENH_RATE, MAX_ENH, ENH_DOWN_FROM, MAPS, QUESTS, ITEMS } from './data.js';
import { SKILL_BY_ID, BUILTIN_SKILLS, MAX_RANK, skillsOfClass } from './skills.js';

// Pure progression rules (no DOM, no three.js), so they can be unit tested.
// Save format v3. normalize() repairs any input and migrates v2 saves.
export const SAVE_VERSION = 3;
export const MAX_LEVEL = 30;
export const BAG_MAX = 80;
export const SKILL_POINTS_PER_LEVEL = 2;

export const expToNext = (lv) => Math.round(60 * Math.pow(lv, 1.4));

// v2 item ids that became gear, mapped to the new base ids.
const LEGACY_GEAR = { sword_iron: 'blade_1', sword_flame: 'blade_2', armor_leaf: 'light_0', armor_golem: 'heavy_1' };

export function newProgress(classId = 'swordsman') {
  const p = {
    v: SAVE_VERSION, level: 1, exp: 0, gold: 0,
    mats: { potion_hp: 3 }, gear: [], equip: { weapon: null, armor: null },
    skills: {}, hotbar: [null, null, null, null, null, null],
    quests: {}, map: 'town', pos: null,
  };
  // every class starts with the first tier of its first line
  const first = skillsOfClass(classId).find((s) => s.tier === 1);
  if (first) {
    p.skills[first.id] = 1;
    p.hotbar[0] = first.id;
  }
  return p;
}

const int = (v, min, max, def) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : def);
const validPos = (p) => (Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) ? [p[0], p[1]] : null);
const uidOk = (u) => typeof u === 'string' && /^[a-z0-9]{4,24}$/.test(u);
const AFFIX_KEYS = AFFIXES.map((a) => a.k);

function cleanGear(g) {
  if (!g || typeof g !== 'object' || !GEAR[g.base] || !uidOk(g.uid)) return null;
  const opts = Array.isArray(g.opts)
    ? g.opts.filter((o) => o && AFFIX_KEYS.includes(o.k) && Number.isFinite(o.v)).map((o) => ({ k: o.k, v: Math.round(o.v) })).slice(0, 4)
    : [];
  return { uid: g.uid, base: g.base, enh: int(g.enh, 0, MAX_ENH, 0), opts };
}

// Repairs any input into a valid progress object. Unknown ids are dropped.
export function normalize(raw, classId = 'swordsman') {
  const p = raw && typeof raw === 'object' ? raw : {};
  const fresh = newProgress(classId);
  if (p.v !== SAVE_VERSION) return migrateV2(p, fresh);

  const mats = {};
  for (const [id, n] of Object.entries(p.mats || {})) {
    if (MATERIALS[id] && Number.isInteger(n) && n > 0) mats[id] = Math.min(999, n);
  }
  const gear = [];
  const seen = new Set();
  for (const g of Array.isArray(p.gear) ? p.gear : []) {
    const c = cleanGear(g);
    if (c && !seen.has(c.uid) && gear.length < BAG_MAX) {
      seen.add(c.uid);
      gear.push(c);
    }
  }
  const equip = { weapon: null, armor: null };
  for (const slot of ['weapon', 'armor']) {
    const uid = p.equip?.[slot];
    const g = gear.find((x) => x.uid === uid);
    if (g && GEAR[g.base].slot === slot) equip[slot] = uid;
  }
  const skills = {};
  for (const [id, rank] of Object.entries(p.skills || {})) {
    if (typeof id === 'string' && id.length <= 60 && Number.isInteger(rank) && rank >= 1) skills[id] = Math.min(MAX_RANK, rank);
  }
  const hotbar = Array.from({ length: 6 }, (_, i) => {
    const id = Array.isArray(p.hotbar) ? p.hotbar[i] : null;
    return typeof id === 'string' && skills[id] ? id : null;
  });
  const quests = {};
  for (const [id, q] of Object.entries(p.quests || {})) {
    if (!QUESTS[id] || !q || typeof q !== 'object') continue;
    quests[id] = {
      status: q.status === 'done' ? 'done' : 'active',
      step: int(q.step, 0, QUESTS[id].steps.length, 0),
      count: int(q.count, 0, 9999, 0),
    };
  }
  return {
    v: SAVE_VERSION,
    level: int(p.level, 1, MAX_LEVEL, 1),
    exp: int(p.exp, 0, 1e9, 0),
    gold: int(p.gold, 0, 1e9, 0),
    mats, gear, equip, skills, hotbar, quests,
    map: MAPS[p.map] ? p.map : 'town',
    pos: validPos(p.pos),
  };
}

// v2 kept potions and materials in `inv` and equipment as plain item ids. Convert it.
function migrateV2(p, fresh) {
  const out = normalize({ ...fresh, v: SAVE_VERSION, gear: [], equip: { weapon: null, armor: null }, skills: fresh.skills, hotbar: fresh.hotbar }, 'swordsman');
  const rng = Math.random;
  out.level = int(p.level, 1, MAX_LEVEL, 1);
  out.exp = int(p.exp, 0, 1e9, 0);
  out.gold = int(p.gold, 0, 1e9, 0);
  out.map = MAPS[p.map] ? p.map : 'town';
  out.pos = validPos(p.pos);
  out.quests = normalize({ v: SAVE_VERSION, quests: p.quests }).quests;
  for (const [id, n] of Object.entries(p.inv || {})) {
    if (MATERIALS[id] && Number.isInteger(n) && n > 0) out.mats[id] = Math.min(999, n);
    else if (LEGACY_GEAR[id] && Number.isInteger(n)) {
      for (let i = 0; i < Math.min(n, 20); i++) out.gear.push(makeGear(LEGACY_GEAR[id], rng));
    }
  }
  for (const slot of ['weapon', 'armor']) {
    const legacy = p.equip?.[slot];
    if (LEGACY_GEAR[legacy]) {
      const g = makeGear(LEGACY_GEAR[legacy], rng);
      out.gear.push(g);
      out.equip[slot] = g.uid;
    }
  }
  return out;
}

// Derived combat stats from level, equipped gear and gear options.
export function statsFor(p) {
  const mods = { atk: 0, hp: 0, mp: 0, crit: 0, critdmg: 0, skillmg: 0, cdr: 0, exp: 0, gold: 0 };
  let wAtk = 0;
  let aDef = 0;
  let aHp = 0;
  for (const slot of ['weapon', 'armor']) {
    const g = findGear(p, p.equip[slot]);
    if (!g) continue;
    const base = GEAR[g.base];
    const m = 1 + 0.07 * g.enh;
    if (base.atk) wAtk += base.atk * m;
    if (base.def) aDef += base.def * m;
    aHp += base.hp || 0;
    for (const o of g.opts) mods[o.k] = (mods[o.k] || 0) + o.v;
  }
  return {
    atk: Math.round(20 + p.level * 5 + wAtk + mods.atk),
    def: Math.round(4 + p.level * 2 + aDef),
    maxHp: Math.round(180 + p.level * 40 + aHp + mods.hp),
    maxMp: Math.round(80 + p.level * 15 + mods.mp),
    crit: 5 + mods.crit,
    critDmg: 50 + mods.critdmg,
    skillMg: mods.skillmg,
    cdr: Math.min(40, mods.cdr),
    expMul: 1 + mods.exp / 100,
    goldMul: 1 + mods.gold / 100,
  };
}

// ---------- gear ----------
export function findGear(p, uid) {
  return uid ? p.gear.find((g) => g.uid === uid) || null : null;
}

function uidFrom(rng) {
  return 'g' + Math.floor(rng() * 36 ** 6).toString(36).padStart(5, '0') + Math.floor(rng() * 1296).toString(36);
}

// A piece of gear of a given base, with random options for its tier.
export function makeGear(baseId, rng = Math.random) {
  const base = GEAR[baseId];
  const [min, max] = OPTION_COUNT[base.tier];
  const count = min + Math.floor(rng() * (max - min + 1));
  const pool = [...AFFIXES];
  const opts = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [af] = pool.splice(idx, 1);
    const [lo, hi] = af.range[base.tier];
    opts.push({ k: af.k, v: Math.round(lo + rng() * (hi - lo)) });
  }
  return { uid: uidFrom(rng), base: baseId, enh: 0, opts };
}

// Tier roll: higher monster level raises the chance of better gear.
export function rollTier(level, rng = Math.random) {
  const r = rng();
  const p3 = 0.004 + level * 0.002;
  const p2 = p3 + 0.03 + level * 0.006;
  const p1 = p2 + 0.25 + level * 0.01;
  if (r < p3) return 3;
  if (r < p2) return 2;
  if (r < p1) return 1;
  return 0;
}

// Random gear drop for a class: 60% weapon of that class's lines, 40% armour.
export function rollDrop(classId, monsterLevel, rng = Math.random) {
  const slot = rng() < 0.6 ? 'weapon' : 'armor';
  const tier = rollTier(monsterLevel, rng);
  return rollGearOf(slot, tier, classId, rng);
}

export function rollGearOf(slot, tier, classId, rng = Math.random) {
  const ids = Object.keys(GEAR).filter((id) => GEAR[id].slot === slot && GEAR[id].tier === tier && (slot === 'armor' || GEAR[id].classId === classId));
  return makeGear(ids[Math.floor(rng() * ids.length)], rng);
}

export function addGear(p, g) {
  if (p.gear.length >= BAG_MAX) return false;
  p.gear.push(g);
  return true;
}

// Returns null on success, or a message explaining why not.
export function equipGear(p, uid, classId) {
  const g = findGear(p, uid);
  if (!g) return 'ไม่พบไอเท็ม';
  const base = GEAR[g.base];
  if (base.slot === 'weapon' && base.classId !== classId) return 'อาวุธนี้ไม่ใช่สายอาชีพของคุณ';
  p.equip[base.slot] = uid;
  return null;
}

export function unequip(p, slot) {
  p.equip[slot] = null;
}

export function sellPrice(g) {
  return Math.round([40, 120, 300, 800][GEAR[g.base].tier] * (1 + 0.25 * g.enh));
}

// Returns the gold gained, or null when the item cannot be sold.
export function sellGear(p, uid) {
  const g = findGear(p, uid);
  if (!g || p.equip.weapon === uid || p.equip.armor === uid) return null;
  const price = sellPrice(g);
  p.gear = p.gear.filter((x) => x !== g);
  p.gold += price;
  return price;
}

export function enhCost(enh) {
  return Math.round(30 * Math.pow(enh + 1, 1.5));
}

export function enhStones(enh) {
  return enh < 6 ? 1 : enh < 10 ? 2 : 3;
}

// Returns { ok, result: 'success' | 'fail' | 'down' | 'error', msg }.
export function enhance(p, uid, rng = Math.random) {
  const g = findGear(p, uid);
  if (!g) return { ok: false, result: 'error', msg: 'ไม่พบไอเท็ม' };
  if (g.enh >= MAX_ENH) return { ok: false, result: 'error', msg: 'ตีบวกถึงขีดสุดแล้ว' };
  const cost = enhCost(g.enh);
  const stones = enhStones(g.enh);
  if (p.gold < cost) return { ok: false, result: 'error', msg: `ต้องใช้ ${cost} เหรียญ` };
  if ((p.mats.enh_stone || 0) < stones) return { ok: false, result: 'error', msg: `ต้องใช้หินเสริมพลัง ${stones} ก้อน` };
  p.gold -= cost;
  removeMat(p, 'enh_stone', stones);
  if (rng() < ENH_RATE[g.enh + 1]) {
    g.enh++;
    return { ok: true, result: 'success', msg: `ตีบวกสำเร็จ เป็น +${g.enh}` };
  }
  if (g.enh >= ENH_DOWN_FROM) {
    g.enh--;
    return { ok: false, result: 'down', msg: `ล้มเหลว ระดับลดเป็น +${g.enh}` };
  }
  return { ok: false, result: 'fail', msg: 'ตีบวกล้มเหลว (ไม่เสียระดับ)' };
}

// ---------- experience and materials ----------
export function addExp(p, amount) {
  let gained = 0;
  p.exp += amount;
  while (p.level < MAX_LEVEL && p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    p.level++;
    gained++;
  }
  if (p.level >= MAX_LEVEL) p.exp = 0;
  return gained;
}

export function addMat(p, id, n = 1) {
  p.mats[id] = Math.min(999, (p.mats[id] || 0) + n);
}

export function removeMat(p, id, n = 1) {
  if ((p.mats[id] || 0) < n) return false;
  p.mats[id] -= n;
  if (p.mats[id] <= 0) delete p.mats[id];
  return true;
}

// ---------- skills ----------
// +1 covers the starter skill, so a new hero starts with no spare points.
export const skillPointsTotal = (p) => Math.max(0, (p.level - 1) * SKILL_POINTS_PER_LEVEL + 1);
export const skillPointsSpent = (p) => Object.values(p.skills).reduce((a, b) => a + b, 0);
export const skillPoints = (p) => skillPointsTotal(p) - skillPointsSpent(p);

function prevSkill(skill) {
  if (skill.tier <= 1) return null;
  return BUILTIN_SKILLS.find((s) => s.classId === skill.classId && s.line === skill.line && s.tier === skill.tier - 1) || null;
}

// Returns null when the skill can be learned, otherwise the reason.
export function canLearn(p, skillId) {
  const skill = SKILL_BY_ID[skillId];
  if (!skill) return 'ไม่รู้จักสกิลนี้';
  if (p.level < skill.reqLv) return `ต้องเลเวล ${skill.reqLv} ขึ้นไป`;
  if (skillPoints(p) < 1) return 'แต้มสกิลไม่พอ';
  const rank = p.skills[skillId] || 0;
  if (rank >= MAX_RANK) return 'เรียนรู้ระดับสูงสุดแล้ว';
  const prev = prevSkill(skill);
  if (prev && !p.skills[prev.id]) return `ต้องเรียนรู้ ${prev.name} ก่อน`;
  return null;
}

export function learnSkill(p, skillId) {
  const err = canLearn(p, skillId);
  if (err) return err;
  p.skills[skillId] = (p.skills[skillId] || 0) + 1;
  if (!p.hotbar.includes(skillId)) {
    const free = p.hotbar.indexOf(null);
    if (free >= 0) p.hotbar[free] = skillId;
  }
  return null;
}

// Puts a learned skill on a hotbar slot (0-5). id null clears the slot.
export function setHotbar(p, slot, skillId) {
  if (slot < 0 || slot > 5) return 'ช่องไม่ถูกต้อง';
  if (skillId && !p.skills[skillId]) return 'ยังไม่ได้เรียนรู้สกิลนี้';
  if (skillId) p.hotbar = p.hotbar.map((id) => (id === skillId ? null : id));
  p.hotbar[slot] = skillId || null;
  return null;
}

// ---------- quests ----------
// Returns the reward lines to show as toasts. rng and classId are used for gear rewards.
export function grantReward(p, questId, classId = 'swordsman', rng = Math.random) {
  const r = QUESTS[questId].reward;
  const lines = [];
  const levels = addExp(p, r.exp);
  p.gold += r.gold;
  lines.push(`+${r.exp} EXP · +${r.gold} เหรียญ`);
  for (const [id, n] of Object.entries(r.mats || {})) {
    addMat(p, id, n);
    lines.push(`ได้รับ ${ITEMS[id].name} x${n}`);
  }
  if (r.gear) {
    const g = rollGearOf(r.gear.slot, r.gear.tier, classId, rng);
    if (addGear(p, g)) lines.push(`ได้รับ ${ITEMS[g.base].name} (${g.opts.length} ออฟชั่น)`);
  }
  if (levels) lines.push(`เลเวลอัป! ตอนนี้เลเวล ${p.level}`);
  return lines;
}

export function availableQuests(p, npcId) {
  return Object.entries(QUESTS).filter(([id, q]) => q.giver === npcId && !p.quests[id] && p.level >= q.minLevel).map(([id]) => id);
}

export function acceptQuest(p, questId) {
  if (p.quests[questId]) return false;
  p.quests[questId] = { status: 'active', step: 0, count: 0 };
  return true;
}

export function currentStep(p, questId) {
  const q = p.quests[questId];
  if (!q || q.status !== 'active') return null;
  return QUESTS[questId].steps[q.step] || null;
}

// Applies a game event to all active quests. Returns messages for toasts.
// events: {type:'talk', npc} | {type:'kill', monster, map} | {type:'collect', item, qty} | {type:'visit', map}
export function applyEvent(p, ev, classId = 'swordsman', rng = Math.random) {
  const msgs = [];
  for (const [id, q] of Object.entries(p.quests)) {
    if (q.status !== 'active') continue;
    const quest = QUESTS[id];
    const step = quest.steps[q.step];
    if (!step || step.type !== ev.type) continue;

    let done = false;
    if (ev.type === 'talk') done = step.npc === ev.npc;
    else if (ev.type === 'visit') done = step.map === ev.map;
    else if (ev.type === 'kill' && step.monster === ev.monster && (!step.map || step.map === ev.map)) {
      q.count += 1;
      done = q.count >= step.count;
    } else if (ev.type === 'collect' && step.item === ev.item) {
      q.count += ev.qty;
      done = q.count >= step.count;
    }
    if (!done) continue;

    q.step += 1;
    q.count = 0;
    msgs.push(`${quest.title}: ${step.text} (สำเร็จ)`);
    if (q.step >= quest.steps.length) {
      q.status = 'done';
      msgs.push(`ภารกิจสำเร็จ: ${quest.title}`, ...grantReward(p, id, classId, rng));
    }
  }
  return msgs;
}

// Progress text for kill and collect steps, e.g. "2/5".
export function stepProgressText(p, questId) {
  const step = currentStep(p, questId);
  const q = p.quests[questId];
  if (!step || !q) return '';
  if (step.type === 'kill' || step.type === 'collect') return `${Math.min(q.count, step.count)}/${step.count}`;
  return '';
}

export function mapUnlocked(p, mapId) {
  return p.level >= MAPS[mapId].minLevel;
}

// Short label for a gear piece's options, e.g. "พลังโจมตี +7 · คริติคอล +2%".
export function optionLabel(o) {
  const a = AFFIXES.find((x) => x.k === o.k);
  return `${a.label} +${o.v}${a.pct ? '%' : ''}`;
}
