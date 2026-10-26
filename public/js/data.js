// Game content as plain data. Add items, monsters, maps, NPCs and quests here.

export const RARITY = {
  common: { label: 'ทั่วไป', color: '#aab4c8' },
  rare: { label: 'หายาก', color: '#4fa3ff' },
  epic: { label: 'มหากาพย์', color: '#b77bff' },
  legendary: { label: 'ตำนาน', color: '#ffb84d' },
};

export const ITEMS = {
  potion_hp: { name: 'ยาฟื้นพลังชีวิต', type: 'potion', rarity: 'common', icon: 'potion', heal: 90, price: 20 },
  essence: { name: 'แก่นพลังสไลม์', type: 'material', rarity: 'common', icon: 'gem' },
  herb: { name: 'สมุนไพรป่า', type: 'material', rarity: 'common', icon: 'leaf', price: 4 },
  wolf_fang: { name: 'เขี้ยวหมาป่า', type: 'material', rarity: 'common', icon: 'fang', price: 8 },
  crystal_ore: { name: 'แร่คริสตัลลาวา', type: 'material', rarity: 'rare', icon: 'ore', price: 40 },
  sword_iron: { name: 'ดาบเหล็กกล้า', type: 'weapon', rarity: 'rare', icon: 'sword', atk: 8, price: 150 },
  sword_flame: { name: 'ดาบเปลวเพลิง', type: 'weapon', rarity: 'epic', icon: 'sword', atk: 16 },
  armor_leaf: { name: 'เกราะใบไม้', type: 'armor', rarity: 'common', icon: 'armor', def: 4, hp: 20, price: 60 },
  armor_golem: { name: 'เกราะหินโกเลม', type: 'armor', rarity: 'rare', icon: 'armor', def: 10, hp: 60 },
};

export const MONSTERS = {
  slime: {
    name: 'สไลม์ใส', level: 1, hp: 40, atk: 5, def: 0, exp: 14, gold: [3, 6], respawn: 10,
    aggro: 4.5, range: 1.3, cd: 1.4, speed: 1.7, size: 1, shape: 'slime', color: '#5ee7ff',
    drops: [['essence', 0.5], ['herb', 0.25], ['potion_hp', 0.08]],
  },
  wolf: {
    name: 'หมาป่าเงา', level: 4, hp: 95, atk: 10, def: 2, exp: 34, gold: [6, 12], respawn: 14,
    aggro: 6, range: 1.6, cd: 1.2, speed: 3.0, size: 1.1, shape: 'wolf', color: '#7d8aa6',
    drops: [['wolf_fang', 0.6], ['armor_leaf', 0.05], ['sword_iron', 0.03], ['potion_hp', 0.15]],
  },
  golem: {
    name: 'โกเลมลาวา', level: 9, hp: 280, atk: 19, def: 9, exp: 110, gold: [18, 30], respawn: 24,
    aggro: 7, range: 2.0, cd: 2.0, speed: 1.4, size: 1.5, shape: 'golem', color: '#ff6a3d',
    drops: [['crystal_ore', 0.7], ['armor_golem', 0.1], ['sword_flame', 0.025], ['potion_hp', 0.3]],
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
    name: 'พ่อค้า โคเบ', role: 'ร้านค้า', map: 'town', pos: [-5, 8], shop: ['potion_hp', 'armor_leaf', 'sword_iron'],
    look: { gender: 'male', classId: 'assassin', appearance: { hairStyle: 3, hair: '#8a2be2', top: { style: 1, color: '#f4c430' } } },
    greet: 'ของดี ราคาถูก มาดูกันก่อนได้',
  },
};

// Quest steps: talk (npc), kill (monster, optional map), collect (item), visit (map).
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
    reward: { exp: 600, gold: 200, items: { sword_iron: 1 } },
  },
  side_wolf: {
    title: 'หมาป่าที่ไม่หลับ', giver: 'hunter', minLevel: 3,
    steps: [
      { type: 'talk', npc: 'hunter', text: 'รับงานจากนายพราน ไลน์' },
      { type: 'kill', monster: 'wolf', map: 'forest', count: 4, text: 'ล่าหมาป่าเงา 4 ตัว' },
      { type: 'talk', npc: 'hunter', text: 'กลับไปรายงานนายพราน' },
    ],
    reward: { exp: 250, gold: 80, items: { armor_leaf: 1 } },
  },
  side_herb: {
    title: 'ยาของหมู่บ้าน', giver: 'healer', minLevel: 2,
    steps: [
      { type: 'talk', npc: 'healer', text: 'รับงานจากหมอมีน่า' },
      { type: 'collect', item: 'herb', count: 5, text: 'เก็บสมุนไพรป่า 5 ต้น' },
      { type: 'talk', npc: 'healer', text: 'ส่งสมุนไพรให้หมอมีน่า' },
    ],
    reward: { exp: 150, gold: 40, items: { potion_hp: 3 } },
  },
};
