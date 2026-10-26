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
  potion_hp: { name: 'ยาฟื้นพลังชีวิต', type: 'potion', rarity: 'common', icon: 'potion', heal: 90, price: 20 },
  essence: { name: 'แก่นพลังสไลม์', type: 'material', rarity: 'common', icon: 'gem', price: 6 },
  herb: { name: 'สมุนไพรป่า', type: 'material', rarity: 'common', icon: 'leaf', price: 4 },
  wolf_fang: { name: 'เขี้ยวหมาป่า', type: 'material', rarity: 'common', icon: 'fang', price: 8 },
  crystal_ore: { name: 'แร่คริสตัลลาวา', type: 'material', rarity: 'rare', icon: 'ore', price: 40 },
  enh_stone: { name: 'หินเสริมพลัง', type: 'material', rarity: 'rare', icon: 'gem', price: 40 },
};

// Gear lines. Weapons belong to one class; armour fits every class.
// Each line has four tiers (common -> legendary), so a weapon's line and tier are its identity.
const TIER_ATK = [10, 20, 34, 52];
const TIER_DEF = [5, 11, 18, 28];
const TIER_HP = [20, 50, 90, 140];
const WEAPON_LINES = {
  swordsman: [
    { line: 'blade', shape: 'sword', color: '#cfd8e3', icon: 'sword', names: ['ดาบสนิม', 'ดาบเหล็กกล้า', 'ดาบเปลวเพลิง', 'ดาบรุ่งอรุณ'], fx: { type: 'slash', color: '#ffd166', color2: '#ffffff' } },
    { line: 'axe', shape: 'axe', color: '#9aa5b1', icon: 'axe', names: ['ขวานไม้', 'ขวานหินโกเลม', 'ขวานปฐพี', 'ขวานมหาภัย'], fx: { type: 'wave', color: '#ff8a5c', color2: '#ffe0a3' } },
  ],
  assassin: [
    { line: 'dagger', shape: 'dagger', color: '#c9d6e8', icon: 'dagger', names: ['มีดสั้นเหล็ก', 'มีดพิษงู', 'มีดเงาคืนชีพ', 'มีดสายลมดำ'], fx: { type: 'slash', color: '#9b8cff', color2: '#ffffff' } },
    { line: 'sickle', shape: 'sickle', color: '#8fd8ff', icon: 'sickle', names: ['เคียวชาวนา', 'เคียวจันทรา', 'เคียวเงาดำ', 'เคียวแห่งความตาย'], fx: { type: 'slash', color: '#5ee7ff', color2: '#ffffff' } },
  ],
  mage: [
    { line: 'staff', shape: 'staff', color: '#8a5a32', icon: 'staff', names: ['คทาไม้ก่อ', 'คทาไฟ', 'คทาเพลิงนรก', 'คทาดวงอาทิตย์'], fx: { type: 'projectile', color: '#ff7a1a', color2: '#ffe27a' } },
    { line: 'crystal', shape: 'crystal', color: '#7fd8ff', icon: 'gem', names: ['คทาคริสตัลฟ้า', 'คทาน้ำแข็ง', 'คทาหิมะนิรันดร์', 'คทาหัวใจแช่แข็ง'], fx: { type: 'projectile', color: '#7fd8ff', color2: '#ffffff' } },
  ],
  priest: [
    { line: 'book', shape: 'book', color: '#c0392b', icon: 'book', names: ['คัมภีร์เก่า', 'คัมภีร์แสง', 'คัมภีร์นักบุญ', 'คัมภีร์แห่งสวรรค์'], fx: { type: 'burst', color: '#fff3a3', color2: '#ffffff' } },
    { line: 'lantern', shape: 'lantern', color: '#ffd166', icon: 'sparkle', names: ['ตะเกียงทองแดง', 'ตะเกียงศักดิ์สิทธิ์', 'ตะเกียงดวงดาว', 'ตะเกียงรุ่งอรุณ'], fx: { type: 'burst', color: '#7dff9b', color2: '#ffffff' } },
  ],
};
const ARMOR_LINES = [
  { line: 'light', color: '#8a6a4a', names: ['เสื้อหนัง', 'เสื้อหนังรัดกุม', 'เสื้อหนังเงา', 'เสื้อหนังนาคา'] },
  { line: 'heavy', color: '#9aa5b1', names: ['เกราะเหล็ก', 'เกราะโกเลม', 'เกราะปฐพี', 'เกราะอัศวิน'] },
  { line: 'robe', color: '#7b5cc7', names: ['ชุดคลุมฝึกหัด', 'ชุดคลุมจันทรา', 'ชุดคลุมดาว', 'ชุดคลุมเทพ'] },
];

// GEAR[id] = base item. id is `${line}_${tier}`.
export const GEAR = {};
for (const [classId, lines] of Object.entries(WEAPON_LINES)) {
  for (const L of lines) {
    L.names.forEach((name, tier) => {
      GEAR[`${L.line}_${tier}`] = {
        name, slot: 'weapon', classId, line: L.line, tier, rarity: TIER_RARITY[tier], atk: TIER_ATK[tier],
        shape: L.shape, color: L.color, icon: L.icon, fx: L.fx,
      };
    });
  }
}
for (const L of ARMOR_LINES) {
  L.names.forEach((name, tier) => {
    GEAR[`${L.line}_${tier}`] = {
      name, slot: 'armor', line: L.line, tier, rarity: TIER_RARITY[tier], def: TIER_DEF[tier], hp: TIER_HP[tier],
      color: L.color, icon: 'armor',
    };
  });
}
export const WEAPON_LINE_NAMES = Object.fromEntries(Object.values(WEAPON_LINES).flat().map((L) => [L.line, L.names[0]]));

// Items shown in lookups (materials and gear together).
export const ITEMS = { ...MATERIALS, ...GEAR };

// Random options rolled on gear. range[tier] is [min, max]. pct options are percentage points.
export const AFFIXES = [
  { k: 'atk', label: 'พลังโจมตี', pct: false, range: [[3, 5], [5, 9], [9, 14], [14, 22]] },
  { k: 'hp', label: 'HP สูงสุด', pct: false, range: [[15, 25], [25, 45], [45, 70], [70, 110]] },
  { k: 'mp', label: 'MP สูงสุด', pct: false, range: [[8, 12], [12, 20], [20, 30], [30, 45]] },
  { k: 'crit', label: 'โอกาสคริติคอล', pct: true, range: [[1, 2], [2, 3], [3, 4], [4, 6]] },
  { k: 'critdmg', label: 'ดาเมจคริติคอล', pct: true, range: [[5, 10], [10, 18], [18, 28], [28, 40]] },
  { k: 'skillmg', label: 'ดาเมจสกิล', pct: true, range: [[3, 6], [6, 10], [10, 16], [16, 24]] },
  { k: 'cdr', label: 'ลดคูลดาวน์', pct: true, range: [[2, 4], [4, 7], [7, 10], [10, 14]] },
  { k: 'exp', label: 'EXP เพิ่ม', pct: true, range: [[3, 6], [6, 10], [10, 15], [15, 22]] },
  { k: 'gold', label: 'เหรียญเพิ่ม', pct: true, range: [[5, 10], [10, 18], [18, 28], [28, 40]] },
];
// How many options each tier rolls: [min, max].
export const OPTION_COUNT = [[0, 1], [1, 2], [2, 3], [3, 4]];

// Enhancement: success rate per target level, gold cost and stones needed.
export const ENH_RATE = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.06, 0.04, 0.02];
export const MAX_ENH = 15;
export const ENH_DOWN_FROM = 7; // a failed attempt at this level or higher drops one level

// Monster stats. drops: [itemId, chance]. gearChance: chance for a gear piece on kill.
export const MONSTERS = {
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
  golem: {
    name: 'โกเลมลาวา', level: 9, hp: 280, atk: 19, def: 9, exp: 110, gold: [18, 30], respawn: 24,
    aggro: 7, range: 2.0, cd: 2.0, speed: 1.4, size: 1.5, shape: 'golem', color: '#ff6a3d',
    drops: [['crystal_ore', 0.7], ['potion_hp', 0.3], ['enh_stone', 0.35]], gearChance: 0.2,
  },
};

// size: world units, spawns: [monsterId, count]
export const MAPS = {
  town: { name: 'ดินแดนสวรรค์', levelText: 'เมืองหลัก', minLevel: 1, safe: true, sky: '#bfe9ff' },
  forest: {
    name: 'ป่าวิญญาณ', levelText: 'เลเวล 1-6', minLevel: 1, size: 36, biome: 'forest', sky: '#c8f0e0',
    spawns: [['slime', 9], ['wolf', 4]],
  },
  mine: {
    name: 'เหมืองลาวาร้อน', levelText: 'เลเวล 8-14', minLevel: 8, size: 36, biome: 'mine', sky: '#3a1d1d',
    spawns: [['golem', 5], ['wolf', 2]],
  },
};

// Portals: walk into one to travel. `arrive` is where you appear on the destination map.
export const PORTALS = {
  town: [{ x: 0, z: -17.5, to: 'forest', arrive: [0, -13], label: 'ป่าวิญญาณ' }],
  forest: [
    { x: 0, z: -16.5, to: 'town', arrive: [0, -14], label: 'ดินแดนสวรรค์' },
    { x: 16.5, z: 0, to: 'mine', arrive: [-13, 0], label: 'เหมืองลาวาร้อน' },
  ],
  mine: [{ x: -16.5, z: 0, to: 'forest', arrive: [13, 0], label: 'ป่าวิญญาณ' }],
};

export const NPCS = {
  elder: {
    name: 'ผู้อาวุโส อาเธอร์', role: 'ผู้ดูแลหมู่บ้าน', map: 'town', pos: [-4, 2],
    look: { gender: 'male', classId: 'priest', appearance: { hairStyle: 5, hair: '#f0f0f0', top: { style: 0, color: '#8a6cff' } } },
    greet: 'ดินแดนนี้กำลังสั่นคลอน... เจ้าอาจเป็นผู้ที่ช่วยเราได้',
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
// reward.gear = { slot, tier } rolls a random piece of gear for the hero's class.
export const QUESTS = {
  main_1: {
    title: 'เจตนารมณ์แห่งสวรรค์', giver: 'elder', minLevel: 1,
    steps: [
      { type: 'talk', npc: 'elder', text: 'พบผู้อาวุโส อาเธอร์ เพื่อรับภารกิจ' },
      { type: 'kill', monster: 'slime', map: 'forest', count: 5, text: 'กำจัดสไลม์ในป่าวิญญาณ 5 ตัว' },
      { type: 'collect', item: 'essence', count: 3, text: 'รวบรวมแก่นพลังสไลม์ 3 ชิ้น' },
      { type: 'talk', npc: 'smith', text: 'นำแก่นพลังไปให้ช่างตีเหล็ก บอริส' },
      { type: 'kill', monster: 'golem', map: 'mine', count: 3, text: 'ปราบโกเลมลาวา 3 ตัวในเหมือง' },
      { type: 'talk', npc: 'elder', text: 'รายงานผลต่อผู้อาวุโส อาเธอร์' },
    ],
    reward: { exp: 600, gold: 200, gear: { slot: 'weapon', tier: 1 } },
  },
  side_wolf: {
    title: 'หมาป่าที่ไม่หลับ', giver: 'hunter', minLevel: 3,
    steps: [
      { type: 'talk', npc: 'hunter', text: 'รับงานจากนายพราน ไลน์' },
      { type: 'kill', monster: 'wolf', map: 'forest', count: 4, text: 'ล่าหมาป่าเงา 4 ตัว' },
      { type: 'talk', npc: 'hunter', text: 'กลับไปรายงานนายพราน' },
    ],
    reward: { exp: 250, gold: 80, gear: { slot: 'armor', tier: 0 } },
  },
  side_herb: {
    title: 'ยาของหมู่บ้าน', giver: 'healer', minLevel: 2,
    steps: [
      { type: 'talk', npc: 'healer', text: 'รับงานจากหมอมีน่า' },
      { type: 'collect', item: 'herb', count: 5, text: 'เก็บสมุนไพรป่า 5 ต้น' },
      { type: 'talk', npc: 'healer', text: 'ส่งสมุนไพรให้หมอมีน่า' },
    ],
    reward: { exp: 150, gold: 40, mats: { potion_hp: 3 } },
  },
};
