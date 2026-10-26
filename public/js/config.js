import { skillsOfClass } from './skills.js';
// Shared config: classes, appearance options, HUD menus. Appearance is stored as indexes so the server can validate it.
export const CLASSES = {
  swordsman: {
    name: 'นักดาบ', color: '#ff5d73', weapon: 'sword', icon: 'sword',
    desc: 'ถึกทน ฟันระยะใกล้ พลังโจมตีสูง',
    basic: { range: 2.1, cd: 1.2, fx: 'slash' },
  },
  assassin: {
    name: 'นักฆ่า', color: '#8b7bff', weapon: 'dagger', icon: 'dagger',
    desc: 'คล่องตัว โจมตีรวดเร็ว ดาเมจสูงจากด้านหลัง',
    basic: { range: 1.8, cd: 0.85, fx: 'slash' },
  },
  mage: {
    name: 'นักเวทย์', color: '#4fd1ff', weapon: 'staff', icon: 'staff',
    desc: 'เวทระยะไกล MP สูง ป้อมน้อย',
    basic: { range: 7, cd: 1.4, fx: 'projectile' },
  },
  priest: {
    name: 'นักพรต', color: '#ffd166', weapon: 'book', icon: 'book',
    desc: 'รักษาและค้ำจุนตัวเอง พลังศักดิ์สิทธิ์',
    basic: { range: 4.5, cd: 1.5, fx: 'burst' },
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

// Built-in skills grouped by class, for the Skill Lab defaults.
export const DEFAULT_SKILLS = Object.fromEntries(Object.keys(CLASSES).map((c) => [c, skillsOfClass(c)]));

export const HUD_MENUS = [
  { id: 'inventory', icon: 'bag', label: 'กระเป๋า/ชุด', key: 'I' },
  { id: 'skills', icon: 'star', label: 'สกิล', key: 'K' },
  { id: 'quests', icon: 'scroll', label: 'ภารกิจ', key: 'J' },
  { id: 'map', icon: 'map', label: 'แผนที่', key: 'M' },
  { id: 'status', icon: 'user', label: 'ตัวละคร', key: 'C' },
];
