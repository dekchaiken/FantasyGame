// Dungeon rules: daily entries, tower waves and rewards. Pure functions so the tests can call them directly.
import { DUNGEONS, RUNE_IDS } from './data.js';

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

// Entries left today for a farm dungeon. The count resets when the local date changes.
export function entriesLeft(p, id, today = dayKey()) {
  const d = p.dungeon.daily;
  const used = d.key === today ? d.counts[id] || 0 : 0;
  return DUNGEONS[id].daily - used;
}

export function useEntry(p, id, today = dayKey()) {
  const d = p.dungeon.daily;
  if (d.key !== today) { d.key = today; d.counts = {}; }
  d.counts[id] = (d.counts[id] || 0) + 1;
}

const randInt = ([lo, hi], rng) => lo + Math.floor(rng() * (hi - lo + 1));

// Monsters on one tower floor: a fixed mix that grows with the floor, and a boss on every tenth floor.
export function towerWave(floor) {
  const pool = floor <= 20 ? ['slime', 'wolf']
    : floor <= 40 ? ['wild_wolf', 'fire_slime', 'golem']
      : floor <= 70 ? ['golem', 'frost_golem']
        : ['frost_golem', 'gold_golem'];
  const count = 2 + Math.floor(floor / 25);
  const mix = {};
  for (let i = 0; i < count; i++) {
    const id = pool[(i + floor) % pool.length];
    mix[id] = (mix[id] || 0) + 1;
  }
  if (floor % 10 === 0) mix.tower_boss = 1;
  return Object.entries(mix);
}

// Stat multiplier for a tower floor. Floor 100 is about 11 times the base monster.
export function towerMult(floor) {
  return 1 + (floor - 1) * 0.1;
}

// A random rune of tier 1 (I), 2 (II) or 3 (III).
export function randRune(tier, rng = Math.random) {
  const ids = RUNE_IDS.filter((id) => id.endsWith(`_${tier}`));
  return ids[Math.floor(rng() * ids.length)];
}

// Rewards for one completed farm dungeon. mats: [itemId, count]; runes: rune item ids; gear: number of gear rolls.
export function farmReward(id, rng = Math.random) {
  const r = DUNGEONS[id].reward;
  return {
    gold: randInt(r.gold, rng),
    exp: r.exp,
    mats: r.loot.filter(([, chance]) => rng() < chance).map(([mid, , n]) => [mid, n]),
    gear: rng() < r.gearChance ? 1 : 0,
    runes: r.runeChance && rng() < r.runeChance ? [randRune(1 + Math.floor(rng() * 2), rng)] : [],
  };
}

// A spirit orb whose rarity grows with the floor.
function spiritOrbFor(floor, rng) {
  const tier = floor < 30 ? 'common' : floor < 60 ? 'rare' : floor < 85 ? 'epic' : 'legendary';
  return rng() < 0.1 && floor >= 85 ? 'spirit_orb_mythic' : `spirit_orb_${tier}`;
}

// Rewards for one cleared tower floor. Boss floors always drop gear and one extra rune.
export function towerReward(floor, rng = Math.random) {
  const boss = floor % 10 === 0;
  const runes = rng() < 0.15 + floor / 120 ? [randRune(floor <= 30 ? 1 : floor <= 60 ? 2 : 3, rng)] : [];
  if (boss) runes.push(randRune(floor <= 50 ? 2 : 3, rng));
  return {
    gold: 25 + floor * 12,
    exp: 60 + floor * 20,
    mats: [
      ...(rng() < 0.4 + floor / 200 ? [['enh_stone', 1 + (floor >= 50 ? 1 : 0)]] : []),
      ...(rng() < 0.2 + floor / 300 ? [['crystal_ore', 1]] : []),
      ...(rng() < 0.03 + floor / 250 ? [[spiritOrbFor(floor, rng), 1]] : []),
    ],
    gear: boss || rng() < 0.25 + floor / 200 ? 1 : 0,
    runes,
  };
}

