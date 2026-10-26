// Balance check: for each hero level, how long a basic-attack hero takes to kill each monster,
// and how much HP it loses doing so. Run with: node tools/balance.mjs
import * as P from '../public/js/progress.js';
import { MONSTERS } from '../public/js/data.js';
import { CLASSES } from '../public/js/config.js';

const CLASS = process.argv[2] || 'swordsman';
// Each monster is checked at a hero level inside its own zone (forest 1-5, meadow 5-10, mine 10-20, ruin 20-30).
const PAIRS = [[1, 'slime'], [2, 'mushroom'], [3, 'bat'], [4, 'wolf'], [6, 'fire_slime'], [8, 'wild_wolf'], [10, 'golem'], [14, 'frost_golem'], [12, 'cave_bat'], [22, 'gold_golem']];

const cd = CLASSES[CLASS].basic.cd;
console.log(`class ${CLASS} basic cd ${cd}s`);
console.log('lv  monster        hits  kill(s)  mon hit  hp lost/kill  hero hp');
for (const [lv, id] of PAIRS) {
  const p = P.newProgress(CLASS);
  p.level = lv;
  const s = P.statsFor(p);
  const m = MONSTERS[id];
  const heroHit = Math.max(1, s.atk - m.def * 0.5);
  const hits = Math.ceil(m.hp / heroHit);
  const kill = hits * cd;
  const monHit = Math.max(1, m.atk - s.def * 0.5);
  const lost = (monHit / m.cd) * kill;
  console.log(`lv${String(lv).padStart(2)}  ${m.name.padEnd(16)} hits ${String(hits).padStart(2)}  kill ${kill.toFixed(1).padStart(5)}s  hits on you ${String(monHit).padStart(3)}  lost ${String(Math.round(lost)).padStart(4)} HP (${Math.round((lost / s.maxHp) * 100)}% of ${s.maxHp})`);
}
