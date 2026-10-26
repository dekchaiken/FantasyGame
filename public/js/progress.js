import { ITEMS, MAPS, QUESTS } from './data.js';

// Pure progression logic (no DOM, no three.js) so it can be tested on its own.
// The saved shape is versioned. Load always goes through normalize(), which repairs or drops bad data.
export const SAVE_VERSION = 2;
export const MAX_LEVEL = 30;

export const expToNext = (lv) => Math.round(60 * Math.pow(lv, 1.4));

export function newProgress() {
  return {
    v: SAVE_VERSION,
    level: 1,
    exp: 0,
    gold: 0,
    inv: { potion_hp: 3 },
    equip: { weapon: null, armor: null },
    quests: {},
    map: 'town',
    pos: null,
  };
}

const int = (v, min, max, def) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : def);
const validPos = (p) => (Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) ? [p[0], p[1]] : null);

// Repairs any input into a valid progress object. Unknown items/quests/maps are dropped.
export function normalize(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const inv = {};
  for (const [id, n] of Object.entries(p.inv || {})) {
    if (ITEMS[id] && Number.isInteger(n) && n > 0) inv[id] = Math.min(999, n);
  }
  const quests = {};
  for (const [id, q] of Object.entries(p.quests || {})) {
    if (!QUESTS[id] || !q || typeof q !== 'object') continue;
    quests[id] = {
      status: q.status === 'done' ? 'done' : 'active',
      step: int(q.step, 0, QUESTS[id].steps.length, 0),
      count: int(q.count, 0, 9999, 0),
    };
  }
  const equip = p.equip || {};
  return {
    v: SAVE_VERSION,
    level: int(p.level, 1, MAX_LEVEL, 1),
    exp: int(p.exp, 0, 1e9, 0),
    gold: int(p.gold, 0, 1e9, 0),
    inv,
    equip: {
      weapon: ITEMS[equip.weapon]?.type === 'weapon' ? equip.weapon : null,
      armor: ITEMS[equip.armor]?.type === 'armor' ? equip.armor : null,
    },
    quests,
    map: MAPS[p.map] ? p.map : 'town',
    pos: validPos(p.pos),
  };
}

// Derived combat stats from level and equipment.
export function statsFor(p) {
  const s = { atk: 20 + p.level * 5, def: 4 + p.level * 2, maxHp: 180 + p.level * 40, maxMp: 80 + p.level * 15 };
  for (const slot of ['weapon', 'armor']) {
    const it = ITEMS[p.equip[slot]];
    if (!it) continue;
    s.atk += it.atk || 0;
    s.def += it.def || 0;
    s.maxHp += it.hp || 0;
  }
  return s;
}

// Returns how many levels were gained.
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

export function addItem(p, id, n = 1) {
  p.inv[id] = Math.min(999, (p.inv[id] || 0) + n);
}

export function removeItem(p, id, n = 1) {
  if ((p.inv[id] || 0) < n) return false;
  p.inv[id] -= n;
  if (p.inv[id] <= 0) delete p.inv[id];
  return true;
}

// Returns a list of lines to show as toasts.
export function grantReward(p, questId) {
  const r = QUESTS[questId].reward;
  const lines = [];
  const levels = addExp(p, r.exp);
  p.gold += r.gold;
  lines.push(`+${r.exp} EXP · +${r.gold} เหรียญ`);
  for (const [id, n] of Object.entries(r.items || {})) {
    addItem(p, id, n);
    lines.push(`ได้รับ ${ITEMS[id].name} x${n}`);
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
export function applyEvent(p, ev) {
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
      msgs.push(`ภารกิจสำเร็จ: ${quest.title}`, ...grantReward(p, id));
    }
  }
  return msgs;
}

// Progress count shown in the quest log: count / step.count for kill and collect, otherwise blank.
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
