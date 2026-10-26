// Game configuration that the admin panel can edit. Overrides are stored on the server and applied
// on top of the defaults in data.js and config.js, one whole entry at a time (a monster, a map, ...).
// The same module runs in the browser and on the server (dynamic import), so both sides agree on the rules.
import * as DATA from './data.js';
import * as CFG from './config.js';

// Each category: the object that holds its entries, and whether it is one object or many entries.
export const CATEGORIES = [
  { id: 'monsters', label: 'มอนสเตอร์', target: () => DATA.MONSTERS },
  { id: 'maps', label: 'แมพ', target: () => DATA.MAPS },
  { id: 'dungeons', label: 'ดันเจี้ยน', target: () => DATA.DUNGEONS },
  { id: 'quests', label: 'เควส', target: () => DATA.QUESTS },
  { id: 'npcs', label: 'NPC', target: () => DATA.NPCS },
  { id: 'classes', label: 'อาชีพ (พื้นฐานการโจมตี)', target: () => CFG.CLASSES },
  { id: 'tower', label: 'หอคอย', single: true, target: () => ({ tower: DATA.TOWER }) },
  { id: 'rates', label: 'อัตราทั่วไป', single: true, target: () => ({ rates: DATA.RATES }) },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || null;

// The defaults are copied once, when this module loads, before any override is applied.
// Later calls return these copies, so the admin always sees the shipped values.
const SNAPSHOT = Object.fromEntries(CATEGORIES.map((c) => [c.id, JSON.parse(JSON.stringify(c.target()))]));

// Defaults for one category, as plain values. Used by the admin panel and by validation.
export function defaultsOf(cat) {
  return JSON.parse(JSON.stringify(SNAPSHOT[cat] || {}));
}

// Checks a value against the shape of the default. Returns a list of problems (empty when it is fine).
// Numbers must be finite and not negative; objects may not gain keys the default does not have.
export function validateValue(def, val, path = '') {
  const errors = [];
  const here = path || 'ค่า';
  if (def === undefined) return errors;
  if (typeof def === 'number') {
    if (typeof val !== 'number' || !Number.isFinite(val)) errors.push(`${here} ต้องเป็นตัวเลข`);
    else if (val < 0) errors.push(`${here} ห้ามติดลบ`);
    return errors;
  }
  if (typeof def === 'string') {
    if (typeof val !== 'string') errors.push(`${here} ต้องเป็นข้อความ`);
    return errors;
  }
  if (typeof def === 'boolean') {
    if (typeof val !== 'boolean') errors.push(`${here} ต้องเป็น true หรือ false`);
    return errors;
  }
  if (Array.isArray(def)) {
    if (!Array.isArray(val)) return [`${here} ต้องเป็นรายการ`];
    if (!def.length) return errors;
    const tuple = Array.isArray(def[0]);
    val.forEach((x, i) => {
      if (tuple) {
        // a list of tuples such as [itemId, chance]: each position has its own type
        if (!Array.isArray(x)) errors.push(`${here}[${i}] ต้องเป็นคู่ค่า`);
        else x.forEach((y, j) => errors.push(...validateValue(def[0][j], y, `${here}[${i}][${j}]`)));
      } else {
        errors.push(...validateValue(def[0], x, `${here}[${i}]`));
      }
    });
    return errors;
  }
  if (def && typeof def === 'object') {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return [`${here} ต้องเป็นออบเจกต์`];
    for (const k of Object.keys(val)) {
      if (!(k in def)) errors.push(`${here}.${k} ไม่มีในค่าเดิม (ไม่รู้จัก field นี้)`);
      else errors.push(...validateValue(def[k], val[k], `${here}.${k}`));
    }
  }
  return errors;
}

// Checks that ids referenced by quests and maps exist in the game. Returns problems as text.
export function checkReferences(cat, key, val) {
  const errors = [];
  const monsters = Object.keys(DATA.MONSTERS);
  const npcs = Object.keys(DATA.NPCS);
  const maps = Object.keys(DATA.MAPS);
  if (cat === 'quests') {
    for (const [i, st] of (val.steps || []).entries()) {
      if (st.npc && !npcs.includes(st.npc)) errors.push(`ขั้นที่ ${i + 1}: ไม่มี NPC "${st.npc}"`);
      if (st.monster && !monsters.includes(st.monster)) errors.push(`ขั้นที่ ${i + 1}: ไม่มีมอนสเตอร์ "${st.monster}"`);
      if (st.map && !maps.includes(st.map)) errors.push(`ขั้นที่ ${i + 1}: ไม่มีแมพ "${st.map}"`);
      if (st.item && !DATA.MATERIALS[st.item]) errors.push(`ขั้นที่ ${i + 1}: ไม่มีไอเท็ม "${st.item}"`);
    }
  }
  if (cat === 'maps') {
    for (const z of val.zones || []) {
      for (const [id] of z.mons || []) if (!monsters.includes(id)) errors.push(`โซน "${z.name}": ไม่มีมอนสเตอร์ "${id}"`);
    }
    for (const [id] of val.spawns || []) if (!monsters.includes(id)) errors.push(`ไม่มีมอนสเตอร์ "${id}" ในรายการเกิด`);
  }
  if (cat === 'dungeons') {
    for (const wave of val.waves || []) for (const [id] of wave) if (!monsters.includes(id)) errors.push(`ไม่มีมอนสเตอร์ "${id}" ในคลื่นดันเจี้ยน`);
  }
  if (cat === 'monsters') {
    for (const [id] of val.drops || []) if (!DATA.MATERIALS[id]) errors.push(`ไม่มีไอเท็มดรอป "${id}"`);
  }
  void key;
  return errors;
}

// Writes an override into the live data objects. Called at startup with the server's stored overrides.
export function applyGameConfig(overrides) {
  for (const [cat, entries] of Object.entries(overrides || {})) {
    const c = categoryById(cat);
    if (!c) continue;
    const target = c.target();
    for (const [key, value] of Object.entries(entries || {})) {
      if (c.single) {
        // single objects keep their identity: the contents are replaced
        const obj = target[key];
        if (!obj) continue;
        for (const k of Object.keys(obj)) delete obj[k];
        Object.assign(obj, value);
      } else {
        target[key] = value;
      }
    }
  }
}
