// Game content as plain data: materials, gear, affixes, skill trees, monsters, maps, NPCs, quests.

export const RARITY = {
  common: { label: 'ทั่วไป', color: '#aab4c8' },
  rare: { label: 'หายาก', color: '#4fa3ff' },
  epic: { label: 'มหากาพย์', color: '#b77bff' },
  legendary: { label: 'ตำนาน', color: '#ffb84d' },
};
export const TIER_RARITY = ['common', 'rare', 'epic', 'legendary'];
export const TIER_NAME = ['ทั่วไป', 'หายาก', 'มหากาพย์', 'ตำนาน'];

// Stackable materials and potions. Counted in progress.mats.
export const MATERIALS = {
  potion_hp: { name: 'ยาฟื้นพลังชีวิต', type: 'potion', rarity: 'common', icon: 'potion', heal: 90, price: 20 , cat: 'potion' },
  essence: { name: 'แก่นพลังสไลม์', type: 'material', rarity: 'common', icon: 'gem', price: 6 , cat: 'quest' },
  herb: { name: 'สมุนไพรป่า', type: 'material', rarity: 'common', icon: 'leaf', price: 4 , cat: 'quest' },
  wolf_fang: { name: 'เขี้ยวหมาป่า', type: 'material', rarity: 'common', icon: 'fang', price: 8 , cat: 'craft' },
  crystal_ore: { name: 'แร่คริสตัลลาวา', type: 'material', rarity: 'rare', icon: 'ore', price: 40 , cat: 'craft' },
  enh_stone: { name: 'หินเสริมพลัง', type: 'material', rarity: 'rare', icon: 'gem', price: 40 , cat: 'upgrade' },
};

// Level bands: every 5 levels there is a full set of gear, with six grades in each band.
export const BANDS = [
  { level: 5, name: 'ฝึกหัด' },
  { level: 10, name: 'ชำนาญ' },
  { level: 15, name: 'นักรบ' },
  { level: 20, name: 'วีรบุรุษ' },
  { level: 25, name: 'ราชา' },
  { level: 30, name: 'เทพ' },
];
// Grades. weight = drop chance weight, opts = [min, max] random options, aura = glow colour.
// Runes: socketed into gear for a stat bonus. One bag item per kind and tier (I-III).
const RUNE_KINDS = {
  atk: { name: 'รูนพลัง', values: [4, 8, 14], label: 'พลังโจมตี' },
  hp: { name: 'รูนชีวิต', values: [30, 60, 100], label: 'HP' },
  mp: { name: 'รูนปราณ', values: [15, 30, 50], label: 'MP' },
  crit: { name: 'รูนจุดตาย', values: [2, 4, 7], label: 'คริติคอล %' },
  critdmg: { name: 'รูนโทษสังหาร', values: [5, 10, 18], label: 'ดาเมจคริติคอล %' },
  skillmg: { name: 'รูนเวทย์', values: [3, 6, 10], label: 'ดาเมจสกิล %' },
  cdr: { name: 'รูนเวลา', values: [2, 4, 6], label: 'ลดคูลดาวน์ %' },
  exp: { name: 'รูนปัญญา', values: [5, 10, 15], label: 'EXP %' },
  gold: { name: 'รูนโชคลาภ', values: [5, 10, 15], label: 'เหรียญ %' },
};
const RUNE_TIER_NAME = ['I', 'II', 'III'];
const RUNE_TIER_RARITY = ['common', 'rare', 'epic'];
for (const [k, kind] of Object.entries(RUNE_KINDS)) {
  kind.values.forEach((v, t) => {
    MATERIALS[`rune_${k}_${t + 1}`] = {
      name: `${kind.name} ${RUNE_TIER_NAME[t]}`, type: 'rune', rarity: RUNE_TIER_RARITY[t], icon: 'gem', price: 0,
      cat: 'rune', rune: { k, v, label: kind.label },
    };
  });
}
export const RUNE_IDS = Object.keys(MATERIALS).filter((id) => MATERIALS[id].cat === 'rune');


// Spirits (ภูติ): companions that give stats and passives. Each rarity is a spirit orb item.
// passives: how many passives a spirit of this rarity gets. rainbow: the orb cycles through colours.
export const SPIRIT_RARITY = [
  { id: 'common', name: 'ธรรมดา', color: '#cfd8e8', atkPct: 3, hp: 40, passives: 1 },
  { id: 'rare', name: 'หายาก', color: '#4fa3ff', atkPct: 6, hp: 90, passives: 1 },
  { id: 'epic', name: 'มหากาพย์', color: '#b77bff', atkPct: 10, hp: 170, passives: 2 },
  { id: 'legendary', name: 'ตำนาน', color: '#ffb84d', atkPct: 15, hp: 280, passives: 2 },
  { id: 'mythic', name: 'เทพปกรณัม', color: '#ff5d73', atkPct: 22, hp: 450, passives: 3, rainbow: true },
];
export const SPIRIT_PASSIVES = [
  { id: 'sp_crit', name: 'ตาเหยี่ยว', desc: 'คริติคอล +4%', mods: { crit: 4 } },
  { id: 'sp_cdmg', name: 'คมแสง', desc: 'ดาเมจคริติคอล +12%', mods: { critdmg: 12 } },
  { id: 'sp_skill', name: 'ประกายเวทย์', desc: 'ดาเมจสกิล +8%', mods: { skillmg: 8 } },
  { id: 'sp_cdr', name: 'นาฬิกาดาว', desc: 'ลดคูลดาวน์ +5%', mods: { cdr: 5 } },
  { id: 'sp_mp', name: 'บ่อปราณ', desc: 'MP สูงสุด +12%', mods: { mpPct: 12 } },
  { id: 'sp_hp', name: 'ผิวหินกึ่งชีวิต', desc: 'HP สูงสุด +10%', mods: { hpPct: 10 } },
  { id: 'sp_gold', name: 'เสน่ห์เหรียญ', desc: 'เหรียญ +12%', mods: { gold: 12 } },
  { id: 'sp_exp', name: 'ดวงตาปัญญา', desc: 'EXP +10%', mods: { exp: 10 } },
];
for (const r of SPIRIT_RARITY) {
  MATERIALS[`spirit_orb_${r.id}`] = {
    name: `ลูกแก้วภูติ${r.name}`, type: 'spirit', rarity: r.id === 'mythic' ? 'legendary' : r.id, icon: 'gem', price: 0,
    cat: 'spirit', spirit: r.id,
  };
}

export const GRADES = [
  { name: 'ธรรมดา', color: '#7b8aa8', mult: 1, opts: [0, 1], aura: null, weight: 45, epithet: '' },
  { name: 'พื้นฐาน', color: '#35b87a', mult: 1.25, opts: [1, 1], aura: '#ffffff', weight: 25, epithet: 'อย่างดี' },
  { name: 'หายาก', color: '#4fa3ff', mult: 1.6, opts: [1, 2], aura: '#4fa3ff', weight: 15, epithet: 'ชั้นเยี่ยม' },
  { name: 'แรร์', color: '#b77bff', mult: 2.0, opts: [2, 3], aura: '#b77bff', weight: 9, epithet: 'ชั้นวิเศษ' },
  { name: 'ตำนาน', color: '#ffb84d', mult: 2.6, opts: [3, 4], aura: '#ffb84d', weight: 5, epithet: 'แห่งตำนาน' },
  { name: 'ขั้นสุด', color: '#ff5d73', mult: 3.4, opts: [4, 4], aura: 'rainbow', weight: 1, epithet: 'ขั้นสุด' },
];
export const GRADE_COLOR = GRADES.map((g) => g.color);

// Crafted gear never comes out as common.
export const CRAFT_WEIGHTS = [0, 30, 26, 18, 16, 7, 3];

// Equipment slots. Weapons belong to one class line; the rest fit everyone.
export const GEAR_SLOTS = ['weapon', 'hat', 'shirt', 'pants', 'shoes', 'ring', 'bracelet'];
export const ARMOR_SLOTS = GEAR_SLOTS.slice(1);
export const SLOT_NAME = { weapon: 'อาวุธ', hat: 'หมวก', shirt: 'เสื้อ', pants: 'กางเกง', shoes: 'รองเท้า', ring: 'แหวน', bracelet: 'กำไล' };
const SLOT_NOUN = { hat: 'หมวก', shirt: 'เสื้อ', pants: 'กางเกง', shoes: 'รองเท้า', ring: 'แหวน', bracelet: 'กำไล' };
const SLOT_ICON = { hat: 'hat', shirt: 'shirt', pants: 'pants', shoes: 'shoe', ring: 'ring', bracelet: 'bracelet' };

// Weapon lines: two per class.
const WEAPON_LINES = {
  swordsman: [
    { line: 'blade', noun: 'ดาบ', shape: 'sword', color: '#cfd8e3', icon: 'sword', fx: { type: 'slash', color: '#ffd166', color2: '#ffffff' } },
    { line: 'axe', noun: 'ขวาน', shape: 'axe', color: '#9aa5b1', icon: 'axe', fx: { type: 'wave', color: '#ff8a5c', color2: '#ffe0a3' } },
  ],
  assassin: [
    { line: 'dagger', noun: 'มีดสั้น', shape: 'dagger', color: '#c9d6e8', icon: 'dagger', fx: { type: 'slash', color: '#9b8cff', color2: '#ffffff' } },
    { line: 'sickle', noun: 'เคียว', shape: 'sickle', color: '#8fd8ff', icon: 'sickle', fx: { type: 'slash', color: '#5ee7ff', color2: '#ffffff' } },
  ],
  mage: [
    { line: 'staff', noun: 'คทาไม้', shape: 'staff', color: '#8a5a32', icon: 'staff', fx: { type: 'projectile', color: '#ff7a1a', color2: '#ffe27a' } },
    { line: 'crystal', noun: 'คทาคริสตัล', shape: 'crystal', color: '#7fd8ff', icon: 'gem', fx: { type: 'projectile', color: '#7fd8ff', color2: '#ffffff' } },
  ],
  priest: [
    { line: 'book', noun: 'คัมภีร์', shape: 'book', color: '#c0392b', icon: 'book', fx: { type: 'burst', color: '#fff3a3', color2: '#ffffff' } },
    { line: 'lantern', noun: 'ตะเกียง', shape: 'lantern', color: '#ffd166', icon: 'sparkle', fx: { type: 'burst', color: '#7dff9b', color2: '#ffffff' } },
  ],
};
const ARMOR_ICON_BY_SLOT = SLOT_ICON;

// Base stats per band (grade multiplies them).
const BAND_ATK = [12, 28, 50, 80, 120, 170];
const BAND_DEF = [6, 14, 24, 38, 56, 80];
const BAND_HP = [20, 50, 90, 140, 200, 270];

export const GEAR = {};
for (const [classId, lines] of Object.entries(WEAPON_LINES)) {
  for (const L of lines) {
    BANDS.forEach((band, b) => GRADES.forEach((gr, g) => {
      GEAR[`${L.line}_${b}_${g}`] = {
        name: `${L.noun}${band.name}`, epithet: gr.epithet, slot: 'weapon', classId, line: L.line, band: b, grade: g,
        level: band.level, rarity: GRADES[g].name, gcolor: gr.color, atk: Math.round(BAND_ATK[b] * gr.mult),
        shape: L.shape, color: L.color, icon: L.icon, fx: L.fx,
      };
    }));
  }
}
for (const slot of ARMOR_SLOTS) {
  BANDS.forEach((band, b) => GRADES.forEach((gr, g) => {
    GEAR[`${slot}_${b}_${g}`] = {
      name: `${SLOT_NOUN[slot]}${band.name}`, epithet: gr.epithet, slot, line: slot, band: b, grade: g,
      level: band.level, rarity: GRADES[g].name, gcolor: gr.color,
      def: Math.round(BAND_DEF[b] * gr.mult), hp: Math.round(BAND_HP[b] * gr.mult), color: gr.color, icon: ARMOR_ICON_BY_SLOT[slot],
    };
  }));
}
export const WEAPON_LINE_IDS = Object.values(WEAPON_LINES).flat().map((L) => L.line);

// Items shown in lookups (materials and gear together).
export const ITEMS = { ...MATERIALS, ...GEAR };

// Random options rolled on gear. range[tier] is [min, max]. pct options are percentage points.
export const AFFIXES = [
  { k: 'atk', label: 'พลังโจมตี', pct: false, base: [3, 5] },
  { k: 'hp', label: 'HP สูงสุด', pct: false, base: [15, 25] },
  { k: 'mp', label: 'MP สูงสุด', pct: false, base: [8, 12] },
  { k: 'crit', label: 'โอกาสคริติคอล', pct: true, base: [1, 2] },
  { k: 'critdmg', label: 'ดาเมจคริติคอล', pct: true, base: [5, 10] },
  { k: 'skillmg', label: 'ดาเมจสกิล', pct: true, base: [3, 6] },
  { k: 'cdr', label: 'ลดคูลดาวน์', pct: true, base: [2, 4] },
  { k: 'exp', label: 'EXP เพิ่ม', pct: true, base: [3, 6] },
  { k: 'gold', label: 'เหรียญเพิ่ม', pct: true, base: [5, 10] },
];

// Enhancement: success rate per target level, gold cost and stones needed.
export const ENH_RATE = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.06, 0.04, 0.02];
export const MAX_ENH = 15;
export const ENH_DOWN_FROM = 7; // a failed attempt at this level or higher drops one level

// Monster stats. drops: [itemId, chance]. gearChance: chance for a gear piece on kill.
export const MONSTERS = {
  mushroom: {
    name: 'เห็ดเรืองแสง', level: 2, hp: 55, atk: 6, def: 1, exp: 22, gold: [4, 8], respawn: 10,
    aggro: 3.5, range: 1.2, cd: 1.6, speed: 1.1, size: 0.9, shape: 'mushroom', color: '#9be36b',
    drops: [['herb', 0.4], ['essence', 0.3], ['potion_hp', 0.1], ['enh_stone', 0.04]], gearChance: 0.02,
  },
  bat: {
    name: 'ค้างคาวป่า', level: 3, hp: 60, atk: 8, def: 1, exp: 30, gold: [5, 9], respawn: 12,
    aggro: 6, range: 1.4, cd: 1.0, speed: 3.4, size: 0.9, shape: 'bat', color: '#5b4b7a',
    drops: [['wolf_fang', 0.25], ['herb', 0.2], ['potion_hp', 0.1], ['spirit_orb_common', 0.01]], gearChance: 0.04,
  },
  cave_bat: {
    name: 'ค้างคาวถ้ำ', level: 11, hp: 240, atk: 17, def: 6, exp: 130, gold: [16, 26], respawn: 18,
    aggro: 6.5, range: 1.5, cd: 1.0, speed: 3.6, size: 1, shape: 'bat', color: '#b77bff',
    drops: [['crystal_ore', 0.3], ['enh_stone', 0.2], ['potion_hp', 0.15], ['spirit_orb_rare', 0.05]], gearChance: 0.1,
  },
  slime: {
    name: 'สไลม์ใส', level: 1, hp: 40, atk: 5, def: 0, exp: 14, gold: [3, 6], respawn: 10,
    aggro: 4.5, range: 1.3, cd: 1.4, speed: 1.7, size: 1, shape: 'slime', color: '#5ee7ff',
    drops: [['essence', 0.5], ['herb', 0.25], ['potion_hp', 0.08], ['enh_stone', 0.05]], gearChance: 0.03,
  },
  wolf: {
    name: 'หมาป่าเงา', level: 4, hp: 95, atk: 10, def: 2, exp: 34, gold: [6, 12], respawn: 14,
    aggro: 6, range: 1.6, cd: 1.2, speed: 3.0, size: 1.1, shape: 'wolf', color: '#7d8aa6',
    drops: [['wolf_fang', 0.6], ['potion_hp', 0.15], ['enh_stone', 0.12]], gearChance: 0.07,
  },
  fire_slime: {
    name: 'สไลม์ไฟ', level: 6, hp: 120, atk: 11, def: 2, exp: 52, gold: [8, 14], respawn: 12,
    aggro: 5, range: 1.3, cd: 1.3, speed: 2.0, size: 1, shape: 'slime', color: '#ff8a4c',
    drops: [['essence', 0.5], ['herb', 0.2], ['potion_hp', 0.1], ['enh_stone', 0.1]], gearChance: 0.05,
  },
  wild_wolf: {
    name: 'หมาป่าทุ่ง', level: 8, hp: 170, atk: 15, def: 4, exp: 70, gold: [10, 16], respawn: 14,
    aggro: 6.5, range: 1.6, cd: 1.1, speed: 3.2, size: 1.1, shape: 'wolf', color: '#c9a36b',
    drops: [['wolf_fang', 0.6], ['potion_hp', 0.15], ['enh_stone', 0.15]], gearChance: 0.08,
  },
  frost_golem: {
    name: 'โกเลมน้ำแข็ง', level: 14, hp: 460, atk: 28, def: 14, exp: 210, gold: [28, 44], respawn: 26,
    aggro: 7, range: 2.0, cd: 1.9, speed: 1.5, size: 1.5, shape: 'golem', color: '#8fe3ff',
    drops: [['crystal_ore', 0.8], ['potion_hp', 0.3], ['enh_stone', 0.4], ['spirit_orb_rare', 0.03]], gearChance: 0.22,
  },
  gold_golem: {
    name: 'โกเลมทองคำ', level: 22, hp: 760, atk: 40, def: 22, exp: 360, gold: [45, 70], respawn: 30,
    aggro: 7.5, range: 2.1, cd: 1.8, speed: 1.6, size: 1.6, shape: 'golem', color: '#ffd166',
    drops: [['crystal_ore', 0.9], ['potion_hp', 0.35], ['enh_stone', 0.5], ['spirit_orb_epic', 0.03]], gearChance: 0.28,
  },
  tower_boss: {
    name: 'ผู้พิทักษ์หอคอย', level: 10, hp: 900, atk: 30, def: 12, exp: 300, gold: [60, 90], respawn: 9999,
    aggro: 8, range: 2.4, cd: 1.6, speed: 1.8, size: 2.2, shape: 'golem', color: '#c084fc',
    drops: [['crystal_ore', 1], ['enh_stone', 1], ['spirit_orb_legendary', 0.5]], gearChance: 1,
  },
  golem: {
    name: 'โกเลมลาวา', level: 9, hp: 280, atk: 19, def: 9, exp: 110, gold: [18, 30], respawn: 24,
    aggro: 7, range: 2.0, cd: 2.0, speed: 1.4, size: 1.5, shape: 'golem', color: '#ff6a3d',
    drops: [['crystal_ore', 0.7], ['potion_hp', 0.3], ['enh_stone', 0.35]], gearChance: 0.2,
  },
};

// size: world units, spawns: [monsterId, count]
export const MAPS = {
  town: { name: 'ดินแดนสวรรค์', kind: 'quest', levelText: 'เมืองหลัก', minLevel: 1, safe: true, sky: '#bfe9ff' },
  forest: {
    kind: 'hunt', name: 'ป่าวิญญาณ', levelText: 'เลเวล 1-5', minLevel: 1, size: 114, biome: 'forest', sky: '#c8f0e0',
    zones: [
      { name: 'ทุ่งเห็ดเรืองแสง', x: -36, z: -28, r: 11, mons: [['mushroom', 5]] },
      { name: 'ลานสไลม์', x: 24, z: -16, r: 13, mons: [['slime', 6]] },
      { name: 'ป่าทึบ', x: 32, z: 28, r: 13, mons: [['wolf', 3], ['bat', 3]] },
      { name: 'ริมธาร', x: -32, z: 28, r: 10, mons: [['slime', 4]] },
    ],
  },
  meadow: {
    kind: 'hunt', name: 'ทุ่งแสงทอง', levelText: 'เลเวล 5-10', minLevel: 5, size: 114, biome: 'meadow', sky: '#fff0c2',
    zones: [
      { name: 'ทุ่งกกทอง', x: -32, z: 0, r: 13, mons: [['wild_wolf', 4]] },
      { name: 'บ่อน้ำพุร้อน', x: 28, z: -24, r: 10, mons: [['fire_slime', 6]] },
      { name: 'เนินหญ้าใต้', x: 20, z: 28, r: 11, mons: [['wild_wolf', 2], ['fire_slime', 3], ['mushroom', 2]] },
    ],
  },
  mine: {
    kind: 'hunt', name: 'เหมืองลาวาร้อน', levelText: 'เลเวล 10-20', minLevel: 10, size: 114, biome: 'mine', sky: '#3a1d1d',
    zones: [
      { name: 'ปล่องลาวา', x: -32, z: -24, r: 13, mons: [['golem', 4]] },
      { name: 'โพรงน้ำแข็ง', x: 32, z: 20, r: 11, mons: [['frost_golem', 4], ['cave_bat', 3]] },
    ],
  },
  ruin: {
    kind: 'hunt', name: 'ซากปรักสวรรค์', levelText: 'เลเวล 20-30', minLevel: 20, size: 114, biome: 'ruin', sky: '#e8dcff',
    zones: [
      { name: 'ลานซากเทพ', x: -28, z: -24, r: 13, mons: [['gold_golem', 3]] },
      { name: 'ศาลาร้าง', x: 28, z: 24, r: 11, mons: [['frost_golem', 2], ['cave_bat', 4]] },
    ],
  },
  herbfield: {
    kind: 'gather', name: 'ทุ่งสมุนไพร', levelText: 'เลเวล 1-10', minLevel: 1, size: 114, biome: 'herb', sky: '#e6ffd9',
    spawns: [], nodes: [['herb', 22], ['essence', 8]],
  },
  mountain: {
    kind: 'hunt', name: 'ไหล่เขาหินเทือก', levelText: 'เลเวล 15-25', minLevel: 15, size: 114, biome: 'mountain', sky: '#dbe7f0',
    zones: [
      { name: 'เส้นทางเขา', x: -36, z: 0, r: 13, mons: [['golem', 4], ['bat', 3]] },
      { name: 'โพรงหิน', x: 36, z: 26, r: 13, mons: [['frost_golem', 3], ['cave_bat', 4]] },
      { name: 'ยอดเขา', x: 30, z: -30, r: 12, mons: [['gold_golem', 2], ['cave_bat', 3]] },
    ],
    spawns: [], nodes: [['crystal_ore', 14]],
  },
  dungeon: { name: 'ดันเจี้ยน', levelText: '', minLevel: 1, size: 36, biome: 'dungeon', sky: '#2a2440', spawns: [], hidden: true },
};

// Farm dungeons: fixed waves, a daily entry limit, and a reward roll at the end.
// loot: [itemId, chance, count]. runeChance: chance of one rune of tier 1-2.
export const DUNGEONS = {
  gold_mine: {
    name: 'ลานหินทอง', desc: 'ล่าโกเลมเพื่อเหรียญและหินเสริมพลัง', minLevel: 5, daily: 3,
    waves: [[['slime', 4], ['wolf', 2]], [['golem', 3]], [['golem', 4], ['frost_golem', 1]]],
    reward: { gold: [120, 200], exp: 400, loot: [['enh_stone', 0.8, 2], ['crystal_ore', 0.5, 1]], gearChance: 0.4 },
  },
  forge_vault: {
    name: 'คลังช่างตีเหล็ก', desc: 'วัสดุอัปเกรดและหินเสริมพลังจำนวนมาก', minLevel: 10, daily: 3,
    waves: [[['golem', 4]], [['frost_golem', 3]], [['frost_golem', 4], ['gold_golem', 1]]],
    reward: { gold: [60, 100], exp: 500, loot: [['enh_stone', 1, 3], ['crystal_ore', 0.9, 2]], gearChance: 0.5 },
  },
  relic_cave: {
    name: 'ถ้ำอาวุธโบราณ', desc: 'ของสวมใส่และอาวุธจากยุคเก่า', minLevel: 12, daily: 3,
    waves: [[['wild_wolf', 4], ['fire_slime', 4]], [['frost_golem', 3]], [['gold_golem', 2]]],
    reward: { gold: [80, 120], exp: 600, loot: [['wolf_fang', 0.9, 2], ['spirit_orb_common', 0.25, 1]], gearChance: 1 },
  },
  rune_shrine: {
    name: 'ศาลาหินรูน', desc: 'ศาลาโบราณที่ซ่อนรูนไว้ เข้าได้วันละ 2 ครั้ง', minLevel: 15, daily: 2,
    waves: [[['frost_golem', 4]], [['gold_golem', 2], ['frost_golem', 2]]],
    reward: { gold: [40, 80], exp: 500, loot: [], gearChance: 0.2, runeChance: 1 },
  },
};

// Endless tower: one wave per floor, a boss every 10 floors. Each cleared floor pays out at once.
export const TOWER = {
  name: 'หอคอยแห่งสวรรค์', minLevel: 15, floors: 100,
  desc: 'ขึ้นชั้นทีละชั้น บอสทุก 10 ชั้น ชั้นที่ผ่านแล้วได้รางวัลทันที',
};

// Portals: walk into one to travel. `arrive` is where you appear on the destination map.
export const PORTALS = {
  dungeon: [{ x: 0, z: -16.5, to: 'town', arrive: [2, -12], label: 'ออกจากดันเจี้ยน' }],
  town: [{ x: 0, z: -17.5, to: 'forest', arrive: [0, -13], label: 'ป่าวิญญาณ' }],
  forest: [
    { x: 0, z: -55, to: 'town', arrive: [0, -14], label: 'ดินแดนสวรรค์' },
    { x: -55, z: 0, to: 'herbfield', arrive: [52, 0], label: 'ทุ่งสมุนไพร' },
    { x: 55, z: 0, to: 'meadow', arrive: [-52, 0], label: 'ทุ่งแสงทอง' },
  ],
  herbfield: [{ x: 55, z: 0, to: 'forest', arrive: [-52, 0], label: 'ป่าวิญญาณ' }],
  mountain: [{ x: 0, z: -55, to: 'meadow', arrive: [0, 52], label: 'ทุ่งแสงทอง' }],
  meadow: [
    { x: 0, z: 55, to: 'mountain', arrive: [0, -52], label: 'ไหล่เขาหินเทือก' },
    { x: -55, z: 0, to: 'forest', arrive: [52, 0], label: 'ป่าวิญญาณ' },
    { x: 55, z: 0, to: 'mine', arrive: [-52, 0], label: 'เหมืองลาวาร้อน' },
  ],
  mine: [
    { x: -55, z: 0, to: 'meadow', arrive: [52, 0], label: 'ทุ่งแสงทอง' },
    { x: 55, z: 0, to: 'ruin', arrive: [-52, 0], label: 'ซากปรักสวรรค์' },
  ],
  ruin: [{ x: -55, z: 0, to: 'mine', arrive: [52, 0], label: 'เหมืองลาวาร้อน' }],
};

export const NPCS = {
  dungeonmaster: {
    name: 'ผู้คุมดันเจี้ยน เรนน่า', role: 'ผู้คุมดันเจี้ยน', map: 'town', pos: [-8, 4],
    look: { gender: 'female', classId: 'priest', appearance: { hairStyle: 3, hair: '#2b2b44', top: { style: 2, color: '#ff6f9c' } } },
    greet: 'ดันเจี้ยนเปิดแล้ว เข้าได้วันละจำนวนจำกัด หอคอยไม่มีวันปิด',
  },
  elder: {
    name: 'ผู้อาวุโส อาเธอร์', role: 'ผู้ดูแลหมู่บ้าน', map: 'town', pos: [-4, 2],
    look: { gender: 'male', classId: 'priest', appearance: { hairStyle: 5, hair: '#f0f0f0', top: { style: 0, color: '#8a6cff' } } },
    greet: 'ดินแดนนี้กำลังสั่นคลอน... เจ้าอาจเป็นผู้ที่ช่วยเราได้',
  },
  jobmaster: {
    name: 'ครูฝึก มาร์ธา', role: 'ครูฝึกอาชีพ', map: 'town', pos: [-4, -4],
    look: { gender: 'female', classId: 'mage', appearance: { hairStyle: 2, hair: '#5b3ca8', top: { style: 1, color: '#ffb84d' } } },
    greet: 'เมื่อถึงเลเวล 20 เจ้าจะเลือกเส้นทางอาชีพได้ ระวังไว้ว่าเลือกแล้วเปลี่ยนไม่ได้',
  },
  smith: {
    name: 'ช่างตีเหล็ก บอริส', role: 'ช่างตีเหล็ก', map: 'town', pos: [4, 2],
    look: { gender: 'male', classId: 'swordsman', appearance: { hairStyle: 0, hair: '#3b2a20', top: { style: 2, color: '#4b5d7a' } } },
    greet: 'เอาแก่นพลังมาให้ข้าดูหน่อย แล้วข้าจะหลอมให้เป็นอาวุธ',
  },
  hunter: {
    name: 'นายพราน ไลน์', role: 'นายพรานประจำหมู่บ้าน', map: 'town', pos: [-2, -12.5],
    look: { gender: 'female', classId: 'assassin', appearance: { hairStyle: 2, hair: '#ff8c42', top: { style: 0, color: '#3fc27a' } } },
    greet: 'หมาป่าเงากำลังออกล่าชาวบ้าน ช่วยกำจัดมันให้ที',
  },
  healer: {
    name: 'หมอสมุนไพร มีน่า', role: 'หมอสมุนไพร', map: 'town', pos: [5, 8],
    look: { gender: 'female', classId: 'priest', appearance: { hairStyle: 1, hair: '#7fd1ff', top: { style: 0, color: '#ffffff' } } },
    greet: 'สมุนไพรในป่าช่วยรักษาคนได้มากนัก ถ้าเจ้าเก็บมาให้ข้า',
  },
  merchant: {
    name: 'พ่อค้า โคเบ', role: 'ร้านค้า', map: 'town', pos: [-5, 8], shop: ['potion_hp', 'enh_stone'],
    look: { gender: 'male', classId: 'assassin', appearance: { hairStyle: 3, hair: '#8a2be2', top: { style: 1, color: '#f4c430' } } },
    greet: 'ของดี ราคาถูก มาดูกันก่อนได้ ซื้อหินเสริมพลังไปตีบวกอาวุธได้',
  },
};

// Quest steps: talk (npc), kill (monster, optional map), collect (item), visit (map).
// reward.gear = { slot, band, grade } gives a random piece of that band and grade.
export const QUESTS = {
  main_1: {
    title: 'เจตนารมณ์แห่งสวรรค์', giver: 'elder', minLevel: 1,
    steps: [
      { type: 'talk', npc: 'elder', text: 'พบผู้อาวุโส อาเธอร์ เพื่อรับภารกิจ' },
      { type: 'kill', monster: 'slime', map: 'forest', count: 5, text: 'กำจัดสไลม์ในป่าวิญญาณ 5 ตัว' },
      { type: 'collect', item: 'essence', map: 'forest', count: 3, text: 'รวบรวมแก่นพลังสไลม์ 3 ชิ้น' },
      { type: 'talk', npc: 'smith', text: 'นำแก่นพลังไปให้ช่างตีเหล็ก บอริส' },
      { type: 'kill', monster: 'golem', map: 'mine', count: 3, text: 'ปราบโกเลมลาวา 3 ตัวในเหมือง' },
      { type: 'talk', npc: 'elder', text: 'รายงานผลต่อผู้อาวุโส อาเธอร์' },
    ],
    reward: { exp: 600, gold: 200, gear: { slot: 'weapon', band: 0, grade: 1 } },
  },
  side_wolf: {
    title: 'หมาป่าที่ไม่หลับ', giver: 'hunter', minLevel: 3,
    steps: [
      { type: 'talk', npc: 'hunter', text: 'รับงานจากนายพราน ไลน์' },
      { type: 'kill', monster: 'wolf', map: 'forest', count: 4, text: 'ล่าหมาป่าเงา 4 ตัว' },
      { type: 'talk', npc: 'hunter', text: 'กลับไปรายงานนายพราน' },
    ],
    reward: { exp: 250, gold: 80, gear: { slot: 'shirt', band: 0, grade: 0 } },
  },
  side_herb: {
    title: 'ยาของหมู่บ้าน', giver: 'healer', minLevel: 2,
    steps: [
      { type: 'talk', npc: 'healer', text: 'รับงานจากหมอมีน่า' },
      { type: 'collect', item: 'herb', map: 'forest', count: 5, text: 'เก็บสมุนไพรป่า 5 ต้น' },
      { type: 'talk', npc: 'healer', text: 'ส่งสมุนไพรให้หมอมีน่า' },
    ],
    reward: { exp: 150, gold: 40, mats: { potion_hp: 3 } },
  },
};
