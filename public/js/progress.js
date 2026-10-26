import { MATERIALS, GEAR, AFFIXES, GRADES, BANDS, GEAR_SLOTS, CRAFT_WEIGHTS, ENH_RATE, MAX_ENH, ENH_DOWN_FROM, MAPS, QUESTS, ITEMS, RUNE_IDS, DUNGEONS, SPIRIT_RARITY, SPIRIT_PASSIVES } from './data.js';
import { SKILL_BY_ID, BUILTIN_SKILLS, MAX_RANK, skillsOfClass, JOB_LEVEL, JOB_NAMES, JOB_PASSIVES, JOB_OF_LINE, JOB_IDS_OF_CLASS, PASSIVE2_LEVEL } from './skills.js';

// Pure progression rules (no DOM, no three.js), so they can be unit tested.
// Save format v4: gear has level bands, six grades and seven equipment slots.
export const SAVE_VERSION = 4;
export const MAX_LEVEL = 30;
export const BAG_MAX = 120;
export const SKILL_POINTS_PER_LEVEL = 2;

export const expToNext = (lv) => Math.round(60 * Math.pow(lv, 1.4));

// v2 item ids that became gear, mapped to v4 base ids.
const LEGACY_GEAR = { sword_iron: 'blade_0_1', sword_flame: 'blade_1_2', armor_leaf: 'shirt_0_0', armor_golem: 'shirt_1_2' };

export function newProgress(classId = 'swordsman') {
  const p = {
    v: SAVE_VERSION, level: 1, exp: 0, gold: 0,
    mats: { potion_hp: 3 }, gear: [],
    equip: Object.fromEntries(GEAR_SLOTS.map((s) => [s, null])),
    skills: {}, hotbar: [null, null, null, null, null, null],
    quests: {}, map: 'town', pos: null, job: null, vip: false,
    dungeon: { daily: { key: '', counts: {} }, tower: 0 },
    spirits: [], spirit: null,
  };
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
    ? g.opts.filter((o) => o && AFFIX_KEYS.includes(o.k) && Number.isFinite(o.v)).map((o) => ({ k: o.k, v: Math.round(o.v) })).slice(0, MAX_OPTS)
    : [];
  const runes = (Array.isArray(g.runes) ? g.runes : []).filter((id) => RUNE_IDS.includes(id)).slice(0, runeSlots(GEAR[g.base]));
  return { uid: g.uid, base: g.base, enh: int(g.enh, 0, MAX_ENH, 0), opts, runes };
}

// Rune sockets per gear piece: one at grade 0-1, two at 2-3, three at 4-5.
export function runeSlots(base) {
  return 1 + Math.floor(base.grade / 2);
}

// Repairs any input into a valid progress object. Unknown ids are dropped; older formats are migrated.
export function normalize(raw, classId = 'swordsman') {
  const p = raw && typeof raw === 'object' ? raw : {};
  if (p.v !== SAVE_VERSION && !p.mats) return migrateV2(p, classId);

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
  const equip = Object.fromEntries(GEAR_SLOTS.map((s) => [s, null]));
  for (const slot of GEAR_SLOTS) {
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
    map: MAPS[p.map] && !MAPS[p.map].hidden ? p.map : 'town',
    pos: validPos(p.pos),
    job: migrateJob(p.job, classId),
    vip: p.vip === true,
    dungeon: normalizeDungeon(p.dungeon),
    spirits: normalizeSpirits(p.spirits),
    spirit: normalizeSpirits(p.spirits).some((s) => s.uid === p.spirit) ? p.spirit : null,
  };
}

// v2 kept potions and materials in `inv` and equipment as plain item ids.
function migrateV2(p, classId) {
  const out = normalize({ v: SAVE_VERSION, mats: {}, gear: [], equip: {}, skills: {}, hotbar: [], quests: p.quests }, classId);
  const fresh = newProgress(classId);
  out.skills = fresh.skills;
  out.hotbar = fresh.hotbar;
  out.level = int(p.level, 1, MAX_LEVEL, 1);
  out.exp = int(p.exp, 0, 1e9, 0);
  out.gold = int(p.gold, 0, 1e9, 0);
  out.map = MAPS[p.map] ? p.map : 'town';
  out.pos = validPos(p.pos);
  for (const [id, n] of Object.entries(p.inv || {})) {
    if (MATERIALS[id] && Number.isInteger(n) && n > 0) out.mats[id] = Math.min(999, n);
    else if (LEGACY_GEAR[id] && Number.isInteger(n)) {
      for (let i = 0; i < Math.min(n, 20); i++) out.gear.push(makeGear(LEGACY_GEAR[id]));
    }
  }
  for (const slot of ['weapon', 'armor']) {
    const legacy = p.equip?.[slot];
    if (LEGACY_GEAR[legacy]) {
      const g = makeGear(LEGACY_GEAR[legacy]);
      out.gear.push(g);
      out.equip[GEAR[g.base].slot] = g.uid;
    }
  }
  return out;
}

// Derived combat stats from level, equipped gear (all slots) and gear options.
// Passive skills of the hero's job that are active at its level.
export function passivesOf(p) {
  const list = p.job ? JOB_PASSIVES[p.job] || [] : [];
  return list.map((ps, i) => ({ ...ps, unlocked: p.level >= (i === 0 ? JOB_LEVEL : PASSIVE2_LEVEL) }));
}

export function statsFor(p) {
  const mods = { atk: 0, hp: 0, mp: 0, crit: 0, critdmg: 0, skillmg: 0, cdr: 0, exp: 0, gold: 0, atkPct: 0, hpPct: 0, mpPct: 0 };
  for (const ps of passivesOf(p)) {
    if (ps.unlocked) for (const [k, v] of Object.entries(ps.mods)) mods[k] += v;
  }
  let wAtk = 0;
  let aDef = 0;
  let aHp = 0;
  const sp = spiritOf(p, p.spirit);
  if (sp) {
    const r = SPIRIT_RARITY.find((x) => x.id === sp.rarity);
    mods.atkPct += r.atkPct;
    aHp += r.hp;
    for (const id of sp.passives) {
      for (const [k, v] of Object.entries(SPIRIT_PASSIVES.find((x) => x.id === id).mods)) mods[k] += v;
    }
  }
  for (const slot of GEAR_SLOTS) {
    const g = findGear(p, p.equip[slot]);
    if (!g) continue;
    const base = GEAR[g.base];
    const m = enhMult(g.enh);
    if (base.atk) wAtk += base.atk * m;
    if (base.def) aDef += base.def * m;
    aHp += (base.hp || 0) * m;
    for (const o of g.opts) mods[o.k] = (mods[o.k] || 0) + o.v;
    for (const id of g.runes || []) {
      const r = MATERIALS[id]?.rune;
      if (r) mods[r.k] += r.v;
    }
  }
  return {
    atk: Math.round((20 + p.level * 5 + wAtk + mods.atk) * (1 + mods.atkPct / 100)),
    def: Math.round(4 + p.level * 2 + aDef),
    maxHp: Math.round((180 + p.level * 40 + aHp + mods.hp) * (1 + mods.hpPct / 100)),
    maxMp: Math.round((80 + p.level * 15 + mods.mp) * (1 + mods.mpPct / 100)),
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

// Magnitude of options: higher bands and grades roll bigger numbers.
export function bandMult(band) {
  return 1 + band * 0.6;
}

// A piece of gear of a given base id (`${line}_${band}_${grade}`), with random options for its grade.
export const MAX_OPTS = 6;
// Enhancing adds 15% of the base stats per level. At +3, +5 and +9 a random option is added.
export const ENH_OPTION_AT = [3, 5, 9];
export function enhMult(enh) {
  return 1 + 0.15 * enh;
}

// One random option for a piece of gear, scaled by its band and grade. Never repeats an option it already has.
export function rollOption(base, rng = Math.random, have = []) {
  const pool = AFFIXES.filter((a) => !have.includes(a.k));
  const af = pool[Math.floor(rng() * pool.length)];
  const [lo, hi] = af.base;
  const v = (lo + rng() * (hi - lo)) * bandMult(base.band) * GRADES[base.grade].mult;
  return { k: af.k, v: Math.max(1, Math.round(v)) };
}

export function makeGear(baseId, rng = Math.random) {
  const base = GEAR[baseId];
  const [min, max] = GRADES[base.grade].opts;
  const count = min + Math.floor(rng() * (max - min + 1));
  const opts = [];
  for (let i = 0; i < count; i++) opts.push(rollOption(base, rng, opts.map((o) => o.k)));
  return { uid: uidFrom(rng), base: baseId, enh: 0, opts };
}

// Weighted pick of a grade index.
export function rollGrade(weights, rng = Math.random) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let g = 0; g < weights.length; g++) {
    r -= weights[g];
    if (r < 0) return g;
  }
  return weights.length - 1;
}

// Drop band: the band of the hero's level, sometimes one lower.
export function dropBand(heroLevel, rng = Math.random) {
  let b = Math.min(BANDS.length - 1, Math.max(0, Math.floor(heroLevel / 5) - 1));
  if (b > 0 && rng() < 0.25) b--;
  return b;
}

// Random gear drop for a class: 60% weapon of one of its two lines, 40% a random armour slot.
export function rollDrop(classId, heroLevel, rng = Math.random) {
  const band = dropBand(heroLevel, rng);
  const grade = rollGrade(GRADES.map((g) => g.weight), rng);
  let baseId;
  if (rng() < 0.6) {
    const lines = [...new Set(Object.values(GEAR).filter((g) => g.slot === 'weapon' && g.classId === classId).map((g) => g.line))];
    baseId = `${lines[Math.floor(rng() * lines.length)]}_${band}_${grade}`;
  } else {
    const slots = GEAR_SLOTS.slice(1);
    baseId = `${slots[Math.floor(rng() * slots.length)]}_${band}_${grade}`;
  }
  return makeGear(baseId, rng);
}

// Gear from a fixed slot / band / grade (quest rewards). Weapons use the hero's class lines.
export function rollGearOf(slot, band, grade, classId, rng = Math.random) {
  if (slot === 'weapon') {
    const lines = [...new Set(Object.values(GEAR).filter((g) => g.slot === 'weapon' && g.classId === classId).map((g) => g.line))];
    return makeGear(`${lines[Math.floor(rng() * lines.length)]}_${band}_${grade}`, rng);
  }
  return makeGear(`${slot}_${band}_${grade}`, rng);
}

// ---------- crafting (smith) ----------
export function craftCost(band) {
  return { gold: Math.round(40 * Math.pow(band + 1, 1.5)), mats: { essence: 2 + band * 2, wolf_fang: band + 1, crystal_ore: band } };
}

// Returns { gear } or { error }.
export function craftGear(p, line, band, classId, rng = Math.random) {
  if (band < 0 || band >= BANDS.length) return { error: 'ไม่มีชุดระดับนี้' };
  if (p.level < BANDS[band].level) return { error: `ต้องเลเวล ${BANDS[band].level} ขึ้นไป` };
  const weapon = Object.values(GEAR).some((g) => g.slot === 'weapon' && g.line === line && g.classId === classId);
  if (!weapon) return { error: 'สายอาวุธนี้ไม่ใช่สายของอาชีพคุณ' };
  if (p.gear.length >= BAG_MAX) return { error: 'กระเป๋าเต็ม' };
  const cost = craftCost(band);
  if (p.gold < cost.gold) return { error: `ต้องใช้ ${cost.gold} เหรียญ` };
  for (const [id, n] of Object.entries(cost.mats)) {
    if ((p.mats[id] || 0) < n) return { error: `ต้องใช้ ${MATERIALS[id].name} ${n} ชิ้น` };
  }
  p.gold -= cost.gold;
  for (const [id, n] of Object.entries(cost.mats)) removeMat(p, id, n);
  const grade = rollGrade(CRAFT_WEIGHTS, rng);
  const gear = makeGear(`${line}_${band}_${grade}`, rng);
  p.gear.push(gear);
  return { gear };
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
  if (p.level < base.level) return `ต้องเลเวล ${base.level} ขึ้นไปจึงจะใส่ได้`;
  p.equip[base.slot] = uid;
  return null;
}

export function unequip(p, slot) {
  p.equip[slot] = null;
}

export function sellPrice(g) {
  const base = GEAR[g.base];
  return Math.round((30 + base.band * 40) * GRADES[base.grade].mult * (1 + 0.25 * g.enh));
}

// Returns the gold gained, or null when the item cannot be sold (or is equipped).
export function sellGear(p, uid) {
  const g = findGear(p, uid);
  if (!g || GEAR_SLOTS.some((s) => p.equip[s] === uid)) return null;
  const price = sellPrice(g);
  for (const id of g.runes || []) addMat(p, id, 1);
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
    const msg = `ตีบวกสำเร็จ เป็น +${g.enh}`;
    if (ENH_OPTION_AT.includes(g.enh) && g.opts.length < MAX_OPTS) {
      const o = rollOption(GEAR[g.base], rng, g.opts.map((x) => x.k));
      g.opts.push(o);
      return { ok: true, result: 'success', msg: `${msg} · ได้ออฟชั่นใหม่: ${optionLabel(o)}`, option: o };
    }
    return { ok: true, result: 'success', msg };
  }
  if (g.enh >= ENH_DOWN_FROM) {
    g.enh--;
    return { ok: false, result: 'down', msg: `ล้มเหลว ระดับลดเป็น +${g.enh}` };
  }
  return { ok: false, result: 'fail', msg: 'ตีบวกล้มเหลว (ไม่เสียระดับ)' };
}

// ---------- spirits (ภูติ) ----------
export const MAX_SPIRITS = 20;
const SPIRIT_IDS = SPIRIT_RARITY.map((r) => r.id);

function normalizeSpirits(list) {
  const out = [];
  const seen = new Set();
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || typeof s.uid !== 'string' || seen.has(s.uid) || !SPIRIT_IDS.includes(s.rarity)) continue;
    const passives = (Array.isArray(s.passives) ? s.passives : []).filter((id) => SPIRIT_PASSIVES.some((x) => x.id === id));
    seen.add(s.uid);
    out.push({ uid: s.uid.slice(0, 20), rarity: s.rarity, passives: [...new Set(passives)].slice(0, 3) });
  }
  return out.slice(0, MAX_SPIRITS);
}

export function spiritOf(p, uid) {
  return (p.spirits || []).find((s) => s.uid === uid) || null;
}

// Turns one spirit orb from the bag into a spirit. The first spirit is equipped automatically.
export function summonSpirit(p, orbId, rng = Math.random) {
  const rarityId = MATERIALS[orbId]?.spirit;
  if (!rarityId) return { error: 'ไม่ใช่ลูกแก้วภูติ' };
  if (p.spirits.length >= MAX_SPIRITS) return { error: `เก็บภูติได้สูงสุด ${MAX_SPIRITS} ตัว` };
  if (!removeMat(p, orbId, 1)) return { error: 'ไม่มีลูกแก้วนี้ในกระเป๋า' };
  const rarity = SPIRIT_RARITY.find((r) => r.id === rarityId);
  const pool = SPIRIT_PASSIVES.map((x) => x.id);
  const passives = [];
  while (passives.length < rarity.passives && pool.length) {
    passives.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  const spirit = { uid: `s${Math.random().toString(36).slice(2, 10)}`, rarity: rarityId, passives };
  p.spirits.push(spirit);
  if (!p.spirit) p.spirit = spirit.uid;
  return { spirit };
}

export function equipSpirit(p, uid) {
  if (uid && !spiritOf(p, uid)) return 'ไม่พบภูติตัวนี้';
  p.spirit = uid || null;
  return null;
}

// ---------- dungeon progress ----------
function normalizeDungeon(d) {
  const src = d && typeof d === 'object' ? d : {};
  const counts = {};
  for (const [id, n] of Object.entries(src.daily?.counts || {})) {
    if (DUNGEONS[id] && Number.isInteger(n) && n > 0) counts[id] = Math.min(99, n);
  }
  return {
    daily: { key: typeof src.daily?.key === 'string' ? src.daily.key.slice(0, 20) : '', counts },
    tower: Number.isInteger(src.tower) ? Math.max(0, Math.min(100, src.tower)) : 0,
  };
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
  const jobLock = skillJobLock(p, skillId);
  if (jobLock) return jobLock;
  if (skillPoints(p) < 1) return 'แต้มสกิลไม่พอ';
  const rank = p.skills[skillId] || 0;
  if (rank >= MAX_RANK) return 'เรียนรู้ระดับสูงสุดแล้ว';
  const prev = prevSkill(skill);
  if (prev && !p.skills[prev.id]) return `ต้องเรียนรู้ ${prev.name} ก่อน`;
  return null;
}

// Why a skill needs a job the hero does not have, or null when it is open.
export function skillJobLock(p, skillId) {
  const skill = SKILL_BY_ID[skillId];
  if (!skill || !skill.tier || skill.tier === 1) return null;
  const owner = JOB_OF_LINE[skill.line];
  if (!owner || p.job === owner) return null;
  return `ต้องเป็น${JOB_NAMES[owner]} ก่อน`;
}

// A skill can be cast when it is learned and its job (if any) is held.
export function skillUsable(p, skillId) {
  return !!p.skills[skillId] && !skillJobLock(p, skillId);
}

// The two jobs a class can become at JOB_LEVEL.
export function jobsOfClass(classId) {
  return JOB_IDS_OF_CLASS[classId] || [];
}

// Saves from before the job split stored a skill line as the job. Map it to its job when it belongs to the class.
function migrateJob(job, classId) {
  const id = JOB_NAMES[job] ? job : JOB_OF_LINE[job];
  return jobsOfClass(classId).includes(id) ? id : null;
}

// Picks the first job. Returns an error message, or null when it worked.
export function chooseJob(p, jobId, classId) {
  if (p.job) return 'เลือกอาชีพไปแล้ว เปลี่ยนไม่ได้';
  if (p.level < JOB_LEVEL) return `ต้องถึงเลเวล ${JOB_LEVEL} ก่อน`;
  if (!jobsOfClass(classId).includes(jobId)) return 'อาชีพนี้ไม่ใช่ของคลาสของคุณ';
  p.job = jobId;
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

// Socket a rune from the bag into a gear piece. Returns an error message, or null.
export function socketRune(p, uid, runeId) {
  const g = findGear(p, uid);
  if (!g) return 'ไม่พบไอเท็ม';
  if (!RUNE_IDS.includes(runeId)) return 'ไม่ใช่รูน';
  g.runes = g.runes || [];
  const slots = runeSlots(GEAR[g.base]);
  if (g.runes.length >= slots) return `ช่องรูนเต็มแล้ว (${slots} ช่อง)`;
  if (!removeMat(p, runeId, 1)) return 'ไม่มีรูนนี้ในกระเป๋า';
  g.runes.push(runeId);
  return null;
}

// Take a rune back out into the bag. Returns an error message, or null.
export function unsocketRune(p, uid, index) {
  const g = findGear(p, uid);
  if (!g || !g.runes?.[index]) return 'ไม่มีรูนในช่องนี้';
  const [id] = g.runes.splice(index, 1);
  addMat(p, id, 1);
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
// Returns reward lines to show as toasts.
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
    const g = rollGearOf(r.gear.slot, r.gear.band, r.gear.grade, classId, rng);
    if (addGear(p, g)) lines.push(`ได้รับ ${ITEMS[g.base].name} (${GRADES[GEAR[g.base].grade].name})`);
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

export function optionLabel(o) {
  const a = AFFIXES.find((x) => x.k === o.k);
  return `${a.label} +${o.v}${a.pct ? '%' : ''}`;
}

// Grade of the strongest equipped piece (drives the aura).
export function topGrade(p) {
  let best = -1;
  for (const slot of GEAR_SLOTS) {
    const g = findGear(p, p.equip[slot]);
    if (g) best = Math.max(best, GEAR[g.base].grade);
  }
  return best;
}
