// Shared game data. Appearance options are stored as indexes so the server can validate them.
export const CLASSES = {
  swordsman: { name: 'นักดาบ', color: '#e5484d', weapon: 'sword', desc: 'ถึกทน ฟันระยะใกล้ พลังโจมตีสูง' },
  assassin: { name: 'นักฆ่า', color: '#4b5d7a', weapon: 'dagger', desc: 'คล่องตัว วิ่งหลบได้ไว ดาเมจสูงจากด้านหลัง' },
  mage: { name: 'นักเวทย์', color: '#9b59d6', weapon: 'staff', desc: 'เวทระยะไกล MP สูง ป้อมน้อย' },
  priest: { name: 'นักพรต', color: '#f4a300', weapon: 'book', desc: 'รักษาและค้ำจุนทีม พลังศักดิ์สิทธิ์' },
};

export const PALETTE = ['#ffffff', '#2b2b3a', '#e5484d', '#f4c430', '#3fc27a', '#4fa3ff', '#4b5d7a', '#9b59d6', '#ff7aa2', '#ff8a3d', '#8a5a32', '#c9d6e8'];
export const HAIR_COLORS = ['#3b2a20', '#1a1a2e', '#e8c26b', '#ff7aa2', '#7fd1ff', '#9b7bd9', '#f0f0f0', '#ff8c42', '#3fc27a', '#8a2be2'];
export const SKIN_COLORS = ['#ffe0c8', '#f7c9a0', '#e0a77a', '#b97a52', '#fff0f5', '#8d5a3b'];
export const EYE_COLORS = ['#3b6fd8', '#2b2b3a', '#8a5cd6', '#3fc27a', '#e5484d', '#b97a52'];

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

// Starter skills per class. fx = visual effect (see effects.js). range is in pixels of the 2D design, converted in game.js.
export const DEFAULT_SKILLS = {
  swordsman: [
    { id: 'sw_slash', classId: 'swordsman', name: 'ฟันดาบ', icon: '⚔️', key: 1, cooldown: 900, mp: 4, damage: 40, range: 110,
      fx: { type: 'slash', color: '#ffd166', color2: '#ffffff', count: 1, size: 70, duration: 260, speed: 0, shake: 4 } },
    { id: 'sw_whirl', classId: 'swordsman', name: 'พายุดาบ', icon: '🌀', key: 2, cooldown: 4000, mp: 14, damage: 90, range: 150,
      fx: { type: 'nova', color: '#ff7a59', color2: '#ffe0a3', count: 30, size: 6, duration: 520, speed: 260, shake: 8 } },
  ],
  assassin: [
    { id: 'as_stab', classId: 'assassin', name: 'แทงลอบ', icon: '🗡️', key: 1, cooldown: 700, mp: 3, damage: 35, range: 100,
      fx: { type: 'slash', color: '#9b8cff', color2: '#2c3e50', count: 1, size: 55, duration: 200, speed: 0, shake: 2 } },
    { id: 'as_dash', classId: 'assassin', name: 'เงาพลิ้ว', icon: '💨', key: 2, cooldown: 3500, mp: 10, damage: 60, range: 180,
      fx: { type: 'beam', color: '#5ee7ff', color2: '#ffffff', count: 10, size: 10, duration: 350, speed: 0, shake: 3 } },
  ],
  mage: [
    { id: 'mg_fire', classId: 'mage', name: 'ลูกไฟ', icon: '🔥', key: 1, cooldown: 800, mp: 6, damage: 55, range: 260,
      fx: { type: 'projectile', color: '#ff7a1a', color2: '#ffe27a', count: 22, size: 9, duration: 450, speed: 520, shake: 2 } },
    { id: 'mg_frost', classId: 'mage', name: 'แช่แข็ง', icon: '❄️', key: 2, cooldown: 5000, mp: 18, damage: 80, range: 160,
      fx: { type: 'nova', color: '#7fd8ff', color2: '#ffffff', count: 40, size: 5, duration: 700, speed: 200, shake: 5 } },
  ],
  priest: [
    { id: 'pr_light', classId: 'priest', name: 'แสงศักดิ์สิทธิ์', icon: '✨', key: 1, cooldown: 900, mp: 6, damage: 45, range: 200,
      fx: { type: 'burst', color: '#fff3a3', color2: '#ffffff', count: 28, size: 7, duration: 600, speed: 180, shake: 1 } },
    { id: 'pr_heal', classId: 'priest', name: 'ฟื้นฟู', icon: '💚', key: 2, cooldown: 3000, mp: 12, damage: 0, range: 0,
      fx: { type: 'heal', color: '#7dff9b', color2: '#ffffff', count: 26, size: 6, duration: 900, speed: 90, shake: 0 } },
  ],
};

export const HUD_TOP_MENUS = [
  { id: 'event', icon: '🎁', label: 'กิจกรรม' },
  { id: 'welfare', icon: '🏆', label: 'สวัสดิการ' },
  { id: 'starter', icon: '🎒', label: 'แพ็กเริ่มต้น' },
  { id: 'shop', icon: '🏪', label: 'ร้านค้า' },
  { id: 'mail', icon: '✉️', label: 'จดหมาย' },
];

export const HUD_BOTTOM_MENUS = [
  { id: 'equip', icon: '🛡️', label: 'อุปกรณ์' },
  { id: 'skill', icon: '📖', label: 'สกิล' },
  { id: 'pet', icon: '🐾', label: 'สัตว์เลี้ยง' },
  { id: 'fashion', icon: '👗', label: 'แฟชั่น' },
  { id: 'quest', icon: '📜', label: 'เควส' },
  { id: 'team', icon: '👥', label: 'ทีม' },
  { id: 'status', icon: '📊', label: 'ตัวละคร' },
];
