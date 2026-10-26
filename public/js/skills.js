// Skill trees. Each class has three lines; each line has four tiers that unlock at levels 1, 5, 10 and 15.
// A tier needs the one before it in the same line learned. Every skill can be ranked up to 3.
//   mult: damage as a multiple of attack. heal: fraction of max HP. shield: damage taken reduction for 5 s.
//   range: px (40px = 1 world unit). aoe: hits every enemy in range. fx.type: see effects.js.
export const TIER_LEVEL = [1, 5, 10, 15];
export const MAX_RANK = 3;

// Job change: at JOB_LEVEL a hero picks one of its class's three lines as its job, once.
// Tier 1 skills stay open to everyone. Tiers 2-4 of other lines are locked to other jobs.
export const JOB_LEVEL = 20;
export const JOB_NAMES = {
  guard: 'อัศวินพิทักษ์', storm: 'นักรบพายุ', light: 'ดาบศักดิ์สิทธิ์',
  shadow: 'นักฆ่าเงา', poison: 'พิษาจารย์', wind: 'นินจาสายลม',
  fire: 'จอมเวทเพลิง', ice: 'จอมเวทน้ำแข็ง', thunder: 'จอมเวทสายฟ้า',
  holy: 'นักบวชศักดิ์สิทธิ์', mend: 'ผู้รักษาแสง', support: 'ผู้นำทางกล้าหาญ',
};

const fx = (type, color, color2, o = {}) => ({ type, color, color2, count: 24, size: 7, duration: 500, speed: 200, shake: 2, ...o });

function sk(classId, line, lineName, tier, id, name, icon, o) {
  return {
    id, classId, line, lineName, tier, name, icon,
    mult: 1, heal: 0, shield: 0, cd: 1000, mp: 5, range: 120, aoe: false,
    reqLv: TIER_LEVEL[tier - 1], key: 1, ...o,
  };
}

const TREE = {
  swordsman: [
    { line: 'guard', name: 'ผู้พิทักษ์', tiers: [
      sk('swordsman', 'guard', 'ผู้พิทักษ์', 1, 'sw_g1', 'ตีโล่', 'shield', { mult: 1, cd: 900, mp: 4, range: 110, fx: fx('slash', '#8fd8ff', '#ffffff', { size: 60 }) }),
      sk('swordsman', 'guard', 'ผู้พิทักษ์', 2, 'sw_g2', 'ยั่วยุ', 'shout', { mult: 0.6, cd: 6000, mp: 10, range: 170, aoe: true, fx: fx('wave', '#ffd166', '#ffffff', { size: 8 }) }),
      sk('swordsman', 'guard', 'ผู้พิทักษ์', 3, 'sw_g3', 'กำแพงเหล็ก', 'shield', { shield: 0.3, heal: 0.1, cd: 14000, mp: 20, range: 0, fx: fx('shield', '#8fd8ff', '#ffffff', { size: 14, duration: 900 }) }),
      sk('swordsman', 'guard', 'ผู้พิทักษ์', 4, 'sw_g4', 'ปราการอมตะ', 'shield', { shield: 0.45, heal: 0.3, cd: 30000, mp: 40, range: 0, fx: fx('shield', '#fff3a3', '#ffffff', { size: 20, duration: 1200 }) }),
    ] },
    { line: 'storm', name: 'พายุดาบ', tiers: [
      sk('swordsman', 'storm', 'พายุดาบ', 1, 'sw_s1', 'ฟันพายุ', 'whirl', { mult: 1.2, range: 120, aoe: true, fx: fx('nova', '#ff7a59', '#ffe0a3', { count: 30, size: 6, speed: 260, shake: 6 }) }),
      sk('swordsman', 'storm', 'พายุดาบ', 2, 'sw_s2', 'เฉือนสายลม', 'slash', { mult: 1.5, range: 150, aoe: true, cd: 3500, mp: 10, fx: fx('blades', '#ff9a5c', '#ffffff', { size: 90, duration: 650 }) }),
      sk('swordsman', 'storm', 'พายุดาบ', 3, 'sw_s3', 'สายฟ้าดาบ', 'bolt', { mult: 2.0, range: 200, cd: 5000, mp: 16, fx: fx('lightning', '#ffe066', '#ffffff', { size: 9, duration: 450, shake: 5 }) }),
      sk('swordsman', 'storm', 'พายุดาบ', 4, 'sw_s4', 'พายุเหนือธรณี', 'whirl', { mult: 2.8, range: 220, aoe: true, cd: 12000, mp: 30, fx: fx('blades', '#ff5d73', '#ffe0a3', { size: 120, duration: 900, count: 40, shake: 10 }) }),
    ] },
    { line: 'light', name: 'ดาบแสง', tiers: [
      sk('swordsman', 'light', 'ดาบแสง', 1, 'sw_l1', 'ฟันแสง', 'slash', { mult: 1.1, range: 110, fx: fx('slash', '#ffffff', '#fff3a3', { size: 70 }) }),
      sk('swordsman', 'light', 'ดาบแสง', 2, 'sw_l2', 'คลื่นแสง', 'wave', { mult: 1.4, range: 200, aoe: true, cd: 2500, fx: fx('wave', '#fff3a3', '#ffffff', { size: 10 }) }),
      sk('swordsman', 'light', 'ดาบแสง', 3, 'sw_l3', 'เสาแสง', 'holy', { mult: 2.2, range: 180, cd: 7000, mp: 18, fx: fx('pillar', '#fff3a3', '#ffffff', { size: 12, duration: 700, shake: 4 }) }),
      sk('swordsman', 'light', 'ดาบแสง', 4, 'sw_l4', 'พระเจ้าแห่งดาบ', 'star', { mult: 3.5, range: 240, aoe: true, cd: 16000, mp: 35, fx: fx('meteor', '#fff3a3', '#ffffff', { size: 12, duration: 800, shake: 9 }) }),
    ] },
  ],
  assassin: [
    { line: 'shadow', name: 'เงาสังหาร', tiers: [
      sk('assassin', 'shadow', 'เงาสังหาร', 1, 'as_s1', 'แทงลอบ', 'dagger', { mult: 1.1, cd: 700, mp: 3, range: 100, fx: fx('slash', '#9b8cff', '#2c3e50', { size: 55, duration: 200 }) }),
      sk('assassin', 'shadow', 'เงาสังหาร', 2, 'as_s2', 'เงาพลิ้ว', 'dash', { mult: 1.8, cd: 4000, mp: 10, range: 180, fx: fx('beam', '#5ee7ff', '#ffffff', { size: 10, duration: 350, shake: 3 }) }),
      sk('assassin', 'shadow', 'เงาสังหาร', 3, 'as_s3', 'เงาหลอก', 'slash', { mult: 2.4, range: 120, aoe: true, cd: 8000, mp: 18, fx: fx('blades', '#9b8cff', '#2c3e50', { size: 80, duration: 600 }) }),
      sk('assassin', 'shadow', 'เงาสังหาร', 4, 'as_s4', 'เงานรก', 'bolt', { mult: 3.2, range: 220, cd: 13000, mp: 28, fx: fx('lightning', '#b77bff', '#2c3e50', { size: 10, duration: 500, shake: 6 }) }),
    ] },
    { line: 'poison', name: 'พิษ', tiers: [
      sk('assassin', 'poison', 'พิษ', 1, 'as_p1', 'ฉีดพิษ', 'drop', { mult: 0.8, cd: 1000, mp: 4, range: 110, fx: fx('burst', '#7dff9b', '#ffffff', { count: 18, size: 6 }) }),
      sk('assassin', 'poison', 'พิษ', 2, 'as_p2', 'เมฆพิษ', 'drop', { mult: 1.1, range: 160, aoe: true, cd: 6000, mp: 12, fx: fx('nova', '#7dff9b', '#c6ffd6', { count: 36, size: 6, speed: 150 }) }),
      sk('assassin', 'poison', 'พิษ', 3, 'as_p3', 'ระเบิดพิษ', 'drop', { mult: 1.8, range: 200, aoe: true, cd: 9000, mp: 18, fx: fx('wave', '#7dff9b', '#ffffff', { size: 11 }) }),
      sk('assassin', 'poison', 'พิษ', 4, 'as_p4', 'กาฬพิษ', 'skull', { mult: 3.0, range: 230, aoe: true, cd: 16000, mp: 32, fx: fx('meteor', '#7dff9b', '#1a4d2e', { size: 13, duration: 800, shake: 8 }) }),
    ] },
    { line: 'wind', name: 'สายลม', tiers: [
      sk('assassin', 'wind', 'สายลม', 1, 'as_w1', 'คมลม', 'slash', { mult: 1.0, range: 110, fx: fx('slash', '#5ee7ff', '#ffffff', { size: 65 }) }),
      sk('assassin', 'wind', 'สายลม', 2, 'as_w2', 'ลมตัด', 'dash', { mult: 1.5, range: 200, cd: 2500, fx: fx('beam', '#5ee7ff', '#ffffff', { size: 8, duration: 300 }) }),
      sk('assassin', 'wind', 'สายลม', 3, 'as_w3', 'วายุวน', 'whirl', { mult: 2.1, range: 160, aoe: true, cd: 8000, mp: 16, fx: fx('blades', '#5ee7ff', '#ffffff', { size: 85, duration: 650 }) }),
      sk('assassin', 'wind', 'สายลม', 4, 'as_w4', 'ลมกรรโชก', 'wave', { mult: 3.0, range: 260, aoe: true, cd: 15000, mp: 30, fx: fx('wave', '#5ee7ff', '#ffffff', { size: 14, duration: 700, shake: 7 }) }),
    ] },
  ],
  mage: [
    { line: 'fire', name: 'เพลิง', tiers: [
      sk('mage', 'fire', 'เพลิง', 1, 'mg_f1', 'ลูกไฟ', 'fire', { mult: 1.6, range: 260, fx: fx('projectile', '#ff7a1a', '#ffe27a', { count: 22, size: 9, speed: 520 }) }),
      sk('mage', 'fire', 'เพลิง', 2, 'mg_f2', 'ลูกไฟคู่', 'fire', { mult: 1.2, range: 280, cd: 2400, mp: 10, fx: fx('projectile', '#ff9a3c', '#fff3a3', { count: 26, size: 10, speed: 560 }) }),
      sk('mage', 'fire', 'เพลิง', 3, 'mg_f3', 'ระเบิดเพลิง', 'fire', { mult: 2.0, range: 170, aoe: true, cd: 7000, mp: 18, fx: fx('nova', '#ff7a1a', '#ffe27a', { count: 40, size: 8, speed: 240, shake: 6 }) }),
      sk('mage', 'fire', 'เพลิง', 4, 'mg_f4', 'อุกกาบาต', 'fire', { mult: 3.4, range: 240, aoe: true, cd: 15000, mp: 34, fx: fx('meteor', '#ff5d1a', '#ffe27a', { size: 13, duration: 850, shake: 10 }) }),
    ] },
    { line: 'ice', name: 'น้ำแข็ง', tiers: [
      sk('mage', 'ice', 'น้ำแข็ง', 1, 'mg_i1', 'เข็มน้ำแข็ง', 'snow', { mult: 1.3, range: 240, fx: fx('projectile', '#7fd8ff', '#ffffff', { count: 18, size: 7, speed: 500 }) }),
      sk('mage', 'ice', 'น้ำแข็ง', 2, 'mg_i2', 'แช่แข็ง', 'snow', { mult: 1.2, range: 160, aoe: true, cd: 6000, mp: 16, fx: fx('nova', '#7fd8ff', '#ffffff', { count: 40, size: 5, speed: 200, shake: 5 }) }),
      sk('mage', 'ice', 'น้ำแข็ง', 3, 'mg_i3', 'พายุหิมะ', 'snow', { mult: 2.0, range: 210, aoe: true, cd: 9000, mp: 20, fx: fx('wave', '#bff0ff', '#ffffff', { size: 12, duration: 700 }) }),
      sk('mage', 'ice', 'น้ำแข็ง', 4, 'mg_i4', 'ยุคน้ำแข็ง', 'snow', { mult: 3.2, range: 220, aoe: true, cd: 16000, mp: 34, fx: fx('pillar', '#bff0ff', '#ffffff', { size: 13, duration: 800, shake: 8 }) }),
    ] },
    { line: 'thunder', name: 'สายฟ้า', tiers: [
      sk('mage', 'thunder', 'สายฟ้า', 1, 'mg_t1', 'สายฟ้าฟาด', 'bolt', { mult: 1.5, range: 240, fx: fx('lightning', '#ffe066', '#ffffff', { size: 9, duration: 400, shake: 4 }) }),
      sk('mage', 'thunder', 'สายฟ้า', 2, 'mg_t2', 'ประจุไฟฟ้า', 'bolt', { mult: 1.4, range: 140, aoe: true, cd: 3500, mp: 10, fx: fx('blades', '#ffe066', '#ffffff', { size: 70, duration: 500 }) }),
      sk('mage', 'thunder', 'สายฟ้า', 3, 'mg_t3', 'พายุไฟฟ้า', 'bolt', { mult: 2.2, range: 220, aoe: true, cd: 8000, mp: 20, fx: fx('lightning', '#ffe066', '#7fd8ff', { size: 12, duration: 600, shake: 7 }) }),
      sk('mage', 'thunder', 'สายฟ้า', 4, 'mg_t4', 'เทพอสนี', 'bolt', { mult: 3.4, range: 240, cd: 16000, mp: 36, fx: fx('pillar', '#ffe066', '#ffffff', { size: 14, duration: 800, shake: 10 }) }),
    ] },
  ],
  priest: [
    { line: 'holy', name: 'แสงศักดิ์สิทธิ์', tiers: [
      sk('priest', 'holy', 'แสงศักดิ์สิทธิ์', 1, 'pr_h1', 'แสงนำทาง', 'holy', { mult: 1.3, range: 200, fx: fx('burst', '#fff3a3', '#ffffff', { count: 28, size: 7 }) }),
      sk('priest', 'holy', 'แสงศักดิ์สิทธิ์', 2, 'pr_h2', 'ลำแสง', 'holy', { mult: 1.6, range: 220, cd: 2600, fx: fx('beam', '#ffffff', '#fff3a3', { size: 12, duration: 380 }) }),
      sk('priest', 'holy', 'แสงศักดิ์สิทธิ์', 3, 'pr_h3', 'แสงพิพากษา', 'holy', { mult: 2.3, range: 200, cd: 7000, mp: 18, fx: fx('pillar', '#fff3a3', '#ffffff', { size: 11, duration: 700, shake: 4 }) }),
      sk('priest', 'holy', 'แสงศักดิ์สิทธิ์', 4, 'pr_h4', 'รุ่งอรุณ', 'star', { mult: 3.0, range: 220, aoe: true, cd: 15000, mp: 34, fx: fx('nova', '#fff3a3', '#ffffff', { count: 44, size: 7, speed: 260, shake: 7 }) }),
    ] },
    { line: 'mend', name: 'ฟื้นฟู', tiers: [
      sk('priest', 'mend', 'ฟื้นฟู', 1, 'pr_m1', 'ฟื้นฟู', 'plus', { heal: 0.35, mp: 12, cd: 4000, fx: fx('heal', '#7dff9b', '#ffffff', { count: 26, size: 6, duration: 900, speed: 90 }) }),
      sk('priest', 'mend', 'ฟื้นฟู', 2, 'pr_m2', 'น้ำพระพร', 'drop', { heal: 0.5, mp: 22, cd: 9000, fx: fx('heal', '#7dff9b', '#ffffff', { count: 40, size: 7, duration: 1100, speed: 110 }) }),
      sk('priest', 'mend', 'ฟื้นฟู', 3, 'pr_m3', 'เทวาคุ้มครอง', 'shield', { shield: 0.3, heal: 0.25, cd: 14000, mp: 20, fx: fx('shield', '#7dff9b', '#ffffff', { size: 14, duration: 900 }) }),
      sk('priest', 'mend', 'ฟื้นฟู', 4, 'pr_m4', 'ชีวิตอมตะ', 'heart', { heal: 0.7, mp: 40, cd: 24000, fx: fx('heal', '#7dff9b', '#fff3a3', { count: 60, size: 8, duration: 1300, speed: 120 }) }),
    ] },
    { line: 'support', name: 'ค้ำจุน', tiers: [
      sk('priest', 'support', 'ค้ำจุน', 1, 'pr_s1', 'โล่ศักดิ์สิทธิ์', 'shield', { shield: 0.2, mp: 8, cd: 8000, fx: fx('shield', '#ffd166', '#ffffff', { size: 12, duration: 700 }) }),
      sk('priest', 'support', 'ค้ำจุน', 2, 'pr_s2', 'ดาบแสงนักบุญ', 'sparkle', { mult: 1.4, range: 120, fx: fx('slash', '#ffd166', '#ffffff', { size: 65 }) }),
      sk('priest', 'support', 'ค้ำจุน', 3, 'pr_s3', 'คลื่นศักดิ์สิทธิ์', 'sparkle', { mult: 1.8, range: 190, aoe: true, cd: 7000, mp: 16, fx: fx('wave', '#ffd166', '#ffffff', { size: 12 }) }),
      sk('priest', 'support', 'ค้ำจุน', 4, 'pr_s4', 'ปาฏิหาริย์', 'star', { mult: 2.8, range: 220, aoe: true, cd: 16000, mp: 30, fx: fx('pillar', '#ffd166', '#fff3a3', { size: 13, duration: 800, shake: 8 }) }),
    ] },
  ],
};

// Flat list of every built-in skill, with line names resolved.
export const SKILL_TREE = TREE;
export const BUILTIN_SKILLS = Object.values(TREE).flat().flatMap((l) => l.tiers);
export const SKILL_BY_ID = Object.fromEntries(BUILTIN_SKILLS.map((s) => [s.id, s]));

export function skillsOfClass(classId) {
  return BUILTIN_SKILLS.filter((s) => s.classId === classId);
}

// Rank scaling: each extra rank adds 20% damage and heal and cuts cooldown by 4%.
export function rankMult(skill, rank) {
  return skill.mult * (1 + 0.2 * (Math.max(1, rank) - 1));
}
export function rankCooldown(skill, rank, cdr = 0) {
  const r = 1 - 0.04 * (Math.max(1, rank) - 1);
  return skill.cd * r * (1 - Math.min(0.4, cdr / 100));
}
