// Shared config: classes, appearance options, skills. Appearance is stored as indexes so the server can validate it.
export const CLASSES = {
  swordsman: {
    name: 'นักดาบ', color: '#ff5d73', weapon: 'sword', icon: 'sword',
    desc: 'ถึกทน ฟันระยะใกล้ พลังโจมตีสูง',
    basic: { range: 2.1, cd: 0.9, fx: 'slash' },
  },
  assassin: {
    name: 'นักฆ่า', color: '#8b7bff', weapon: 'dagger', icon: 'dagger',
    desc: 'คล่องตัว โจมตีรวดเร็ว ดาเมจสูงจากด้านหลัง',
    basic: { range: 1.8, cd: 0.6, fx: 'slash' },
  },
  mage: {
    name: 'นักเวทย์', color: '#4fd1ff', weapon: 'staff', icon: 'staff',
    desc: 'เวทระยะไกล MP สูง ป้อมน้อย',
    basic: { range: 7, cd: 1.0, fx: 'projectile' },
  },
  priest: {
    name: 'นักพรต', color: '#ffd166', weapon: 'book', icon: 'book',
    desc: 'รักษาและค้ำจุนตัวเอง พลังศักดิ์สิทธิ์',
    basic: { range: 4.5, cd: 1.1, fx: 'burst' },
  },
};

export const PALETTE = ['#ffffff', '#2b2b3a', '#ff5d73', '#ffd166', '#3fc27a', '#4fa3ff', '#4b5d7a', '#8b7bff', '#ff7aa2', '#ff8a3d', '#8a5a32', '#c9d6e8'];
export const HAIR_COLORS = ['#3b2a20', '#1a1a2e', '#e8c26b', '#ff7aa2', '#7fd1ff', '#9b7bd9', '#f0f0f0', '#ff8c42', '#3fc27a', '#8a2be2'];
export const SKIN_COLORS = ['#ffe0c8', '#f7c9a0', '#e0a77a', '#b97a52', '#fff0f5', '#8d5a3b'];
export const EYE_COLORS = ['#3b6fd8', '#2b2b3a', '#8a5cd6', '#3fc27a', '#ff5d73', '#b97a52'];

export const OPTIONS = {
  hairStyle: ['สั้นทรงเก๋', 'ยาวตรง', 'หางม้า', 'ชี้ฟู', 'หางแฝด', 'มวยผม'],
  faceStyle: ['กลมน่ารัก', 'ตาเรียว', 'ตาใส', 'ตาง่วง'],
  topStyle: ['เสื้อยืด', 'เสื้อลายแถบ', 'แจ็กเก็ต', 'เสื้อเอมบเลม'],
  bottomStyle: ['กางเกงขาสั้น', 'กางเกงขายาว', 'กระโปรง'],
  shoeStyle: ['สนีกเกอร์', 'บู้ต', 'รองเท้าแตะ'],
  accessory: ['ไม่มี', 'ริบบิ้น', 'หมวก', 'แว่นตา'],
};

export const DEFAULT_APPEARANCE = {
  hairStyle: 0,
  hair: '#9b7bd9',
  faceStyle: 0,
  eyeColor: '#3b6fd8',
  skin: '#ffe0c8',
  top: { style: 0, color: '#ffffff' },
  bottom: { style: 0, color: '#6a4fb0' },
  shoes: { style: 0, color: '#4fa3ff' },
  accessory: 0,
};

// Fills in any missing appearance fields (older saved characters, partial data).
export function fullAppearance(a = {}) {
  const d = DEFAULT_APPEARANCE;
  return {
    ...d,
    ...a,
    top: { ...d.top, ...a.top },
    bottom: { ...d.bottom, ...a.bottom },
    shoes: { ...d.shoes, ...a.shoes },
  };
}

// mult: damage as a multiple of attack. range in px (40px = 1 world unit). heal: fraction of max HP.
export const DEFAULT_SKILLS = {
  swordsman: [
    { id: 'sw_slash', classId: 'swordsman', name: 'ฟันดาบ', icon: 'slash', key: 1, cooldown: 900, mp: 4, mult: 1.0, range: 110, reqLv: 1, aoe: false,
      fx: { type: 'slash', color: '#ffd166', color2: '#ffffff', count: 1, size: 70, duration: 260, speed: 0, shake: 4 } },
    { id: 'sw_whirl', classId: 'swordsman', name: 'พายุดาบ', icon: 'whirl', key: 2, cooldown: 5000, mp: 14, mult: 1.7, range: 120, reqLv: 5, aoe: true,
      fx: { type: 'nova', color: '#ff7a59', color2: '#ffe0a3', count: 30, size: 6, duration: 520, speed: 260, shake: 8 } },
  ],
  assassin: [
    { id: 'as_stab', classId: 'assassin', name: 'แทงลอบ', icon: 'dagger', key: 1, cooldown: 700, mp: 3, mult: 1.1, range: 100, reqLv: 1, aoe: false,
      fx: { type: 'slash', color: '#9b8cff', color2: '#2c3e50', count: 1, size: 55, duration: 200, speed: 0, shake: 2 } },
    { id: 'as_dash', classId: 'assassin', name: 'เงาพลิ้ว', icon: 'dash', key: 2, cooldown: 4000, mp: 10, mult: 1.8, range: 180, reqLv: 4, aoe: false,
      fx: { type: 'beam', color: '#5ee7ff', color2: '#ffffff', count: 10, size: 10, duration: 350, speed: 0, shake: 3 } },
  ],
  mage: [
    { id: 'mg_fire', classId: 'mage', name: 'ลูกไฟ', icon: 'fire', key: 1, cooldown: 800, mp: 6, mult: 1.6, range: 260, reqLv: 1, aoe: false,
      fx: { type: 'projectile', color: '#ff7a1a', color2: '#ffe27a', count: 22, size: 9, duration: 450, speed: 520, shake: 2 } },
    { id: 'mg_frost', classId: 'mage', name: 'แช่แข็ง', icon: 'snow', key: 2, cooldown: 7000, mp: 18, mult: 1.2, range: 160, reqLv: 8, aoe: true,
      fx: { type: 'nova', color: '#7fd8ff', color2: '#ffffff', count: 40, size: 5, duration: 700, speed: 200, shake: 5 } },
  ],
  priest: [
    { id: 'pr_light', classId: 'priest', name: 'แสงศักดิ์สิทธิ์', icon: 'holy', key: 1, cooldown: 900, mp: 6, mult: 1.3, range: 200, reqLv: 1, aoe: false,
      fx: { type: 'burst', color: '#fff3a3', color2: '#ffffff', count: 28, size: 7, duration: 600, speed: 180, shake: 1 } },
    { id: 'pr_heal', classId: 'priest', name: 'ฟื้นฟู', icon: 'plus', key: 2, cooldown: 4000, mp: 12, mult: 0, heal: 0.35, range: 0, reqLv: 3, aoe: false,
      fx: { type: 'heal', color: '#7dff9b', color2: '#ffffff', count: 26, size: 6, duration: 900, speed: 90, shake: 0 } },
  ],
};

export const HUD_MENUS = [
  { id: 'inventory', icon: 'bag', label: 'กระเป๋า', key: 'I' },
  { id: 'equip', icon: 'shield', label: 'อุปกรณ์', key: 'O' },
  { id: 'skills', icon: 'star', label: 'สกิล', key: 'K' },
  { id: 'quests', icon: 'scroll', label: 'ภารกิจ', key: 'J' },
  { id: 'map', icon: 'map', label: 'แผนที่', key: 'M' },
  { id: 'status', icon: 'user', label: 'ตัวละคร', key: 'C' },
];
