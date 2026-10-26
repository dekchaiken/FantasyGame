import * as THREE from 'three';
import { buildTown } from './town.js';
import { buildNav, findPath, blocked } from './nav.js';
import { buildField, makePortal } from './field.js';
import { buildCharacter, poseFor } from './character.js';
import { Effects } from './effects.js';
import { Monster } from './monster.js';
import { Hud } from './hud.js';
import { API } from './api.js';
import { CLASSES } from './config.js';
import { JOB_NAMES } from './skills.js';
import { Sfx } from './sfx.js';
import { MAPS, PORTALS, NPCS, MONSTERS, QUESTS, MATERIALS, GEAR, RARITY, GRADES, DUNGEONS, TOWER } from './data.js';
import * as DG from './dungeon.js';
import { SPIRIT_RARITY } from './data.js';
import { SKILL_BY_ID, rankMult, rankCooldown } from './skills.js';
import * as P from './progress.js';
import { Stage } from './stage.js';

const SPEED = 4.2;
const RADIUS = 0.35;
const UNIT = 40; // 40px of skill range = 1 world unit
const TOWN_LIMIT = 19;
const NPC_RANGE = 2.6;
const SAVE_EVERY = 6;
const PORTAL_RANGE = 1.3;
const PORTAL_COLOR = { town: '#ffd166', forest: '#5ee7ff', meadow: '#9be36b', mine: '#ff6a3d', ruin: '#c58bff', herbfield: '#7fd16a', mountain: '#b8c4cc', camp: '#d9a45c', city: '#c9bfe6', sky: '#9fd8ff' };
const NODE_RESPAWN = 25; // seconds before a harvested gathering node comes back
const NODE_COLOR = { herb: '#7fe05a', essence: '#7dd3ff', crystal_ore: '#ffd166' };
const SHIELD_TIME = 5;
const FX_BASIC_DEFAULT = {
  swordsman: { type: 'slash', color: '#ffd166', color2: '#ffffff', count: 1, size: 70, duration: 240, speed: 0, shake: 1 },
  assassin: { type: 'slash', color: '#9b8cff', color2: '#ffffff', count: 1, size: 60, duration: 180, speed: 0, shake: 1 },
  mage: { type: 'projectile', color: '#4fd1ff', color2: '#ffffff', count: 12, size: 6, duration: 400, speed: 600, shake: 0 },
  priest: { type: 'burst', color: '#ffd166', color2: '#ffffff', count: 14, size: 5, duration: 380, speed: 140, shake: 0 },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// First portal on the shortest chain of portals from one map to another (null when already there or unreachable).
function routeHop(from, to) {
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length && !(to in prev)) {
    const m = queue.shift();
    for (const e of PORTALS[m] || []) {
      if (!(e.to in prev)) { prev[e.to] = { from: m, portal: e }; queue.push(e.to); }
    }
  }
  if (!(to in prev)) return null;
  let hop = null;
  for (let cur = to; prev[cur]; cur = prev[cur].from) hop = prev[cur].portal;
  return hop;
}
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};
const $ = (id) => document.getElementById(id);

export const Game = {
  p: null,
  character: null,
  hero: null,
  stats: null,
  map: null,
  scene: null,
  camera: new THREE.PerspectiveCamera(40, 1, 0.1, 340),
  world: null,
  fx: null,
  nav: null,
  path: null,
  pathGoal: null,
  pathT: 0,
  keys: {},
  skillMap: {},
  cooldowns: {},
  cdBasic: 0,
  auto: false,
  exploreT: 0,
  questAuto: false,
  run: null,
  moveTarget: null,
  targetMon: null,
  interactNpc: null,
  camPos: new THREE.Vector3(),
  raycaster: new THREE.Raycaster(),
  ground: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  labelEls: [],
  floats: [],
  dirty: false,
  saveT: 0,
  shakeUntil: 0,
  shakeAmt: 0,
  transitioning: false,
  dying: false,
  time: 0,
  bound: false,

  async start(character) {
    if (location.search.includes('debug')) window.__SR = this;
    this.character = character;
    this.p = P.normalize(character.progress, character.classId);
    this.skillMap = await loadSkillMap(character.classId);
    this.cooldowns = {};
    this.cdBasic = 0;
    this.auto = false;
    this.moveTarget = null;
    this.targetMon = null;
    this.interactNpc = null;
    this.dying = false;

    const ch = buildCharacter(character);
    this.hero = { char: ch, group: ch.group, rot: 0, moving: false, hp: 1, mp: 1, flash: 0, shield: 0, shieldT: 0 };
    this.refreshStats(true);
    this.syncWeapon();
    this.bindInput();
    Hud.init(this);

    const start = this.p.map;
    const ok = await this.enterMap(MAPS[start] && P.mapUnlocked(this.p, start) ? start : 'town', this.p.pos, { silent: true });
    if (!ok) await this.enterMap('town', null, { silent: true });

    this.dirty = false;
    showGameScreen();
    Stage.use(this);
    Hud.refresh(this);
    Hud.toast(`ยินดีต้อนรับสู่ ${MAPS[this.map].name}`);
  },

  // ---------- stats and gear ----------
  refreshStats(fill) {
    this.stats = P.statsFor(this.p);
    const h = this.hero;
    if (fill) {
      h.hp = this.stats.maxHp;
      h.mp = this.stats.maxMp;
    } else {
      h.hp = Math.min(h.hp, this.stats.maxHp);
      h.mp = Math.min(h.mp, this.stats.maxMp);
    }
  },

  // The hero's look follows the equipped gear: weapon model and grade, aura, clothing tint.
  syncWeapon() {
    const base = this.equippedBase('weapon');
    const cls = CLASSES[this.character.classId];
    const grade = P.topGrade(this.p);
    this.hero.char.setWeapon(base ? base.shape : cls.weapon, base ? base.color : cls.color, base ? base.grade : 0);
    this.hero.char.setAura(grade >= 1 ? GRADES[grade].aura : null, grade === GRADES.length - 1);
    const app = this.character.appearance || {};
    const shirt = this.equippedBase('shirt');
    const pants = this.equippedBase('pants');
    const shoes = this.equippedBase('shoes');
    this.hero.char.setLook({
      top: shirt ? shirt.color : app.top?.color,
      bottom: pants ? pants.color : app.bottom?.color,
      shoes: shoes ? shoes.color : app.shoes?.color,
    });
  },

  equippedBase(slot) {
    const g = P.findGear(this.p, this.p.equip[slot]);
    return g ? GEAR[g.base] : null;
  },

  // Skills on the hotbar, with their ranks. Empty slots are null.
  // Changes the hero's job once, at JOB_LEVEL or above.
  chooseJob(jobId) {
    const err = P.chooseJob(this.p, jobId, this.character.classId);
    if (err) { Hud.toast(err, 'warn'); Sfx.play('error'); return; }
    Hud.toast(`เปลี่ยนอาชีพเป็น ${JOB_NAMES[jobId]}!`, 'gold');
    Sfx.play('learn');
    this.aura(CLASSES[this.character.classId].color, 2.4);
    this.dirty = true;
    Hud.refresh(this);
  },

  hotSkill(slot) {
    const id = this.p.hotbar[slot - 1];
    const s = id && this.skillMap[id];
    return s ? { ...s, rank: this.p.skills[id] || 1 } : null;
  },

  // ---------- maps ----------
  async enterMap(id, at, opts = {}) {
    if (this.transitioning) return false;
    if (!P.mapUnlocked(this.p, id)) {
      Hud.toast(`ต้องเลเวล ${MAPS[id].minLevel} ขึ้นไปจึงเข้า${MAPS[id].name}ได้`, 'warn');
      return false;
    }
    if (id !== 'dungeon') this.run = null;
    this.transitioning = true;
    if (!opts.silent) {
      Hud.fade(true);
      await wait(280);
    }
    this.disposeWorld();

    const def = MAPS[id];
    this.map = id;
    this.scene = new THREE.Scene();
    this.fx = new Effects(this.scene);
    const world = { solids: [], portals: [], npcs: [], monsters: [], labels: [], update: null, spawn: { x: 0, z: 7 }, limit: TOWN_LIMIT, round: true };

    if (id === 'town') {
      const t = buildTown(this.scene);
      world.solids = t.solids;
      world.update = t.update;
      world.spawn = t.spawn;
    } else {
      const exits = PORTALS[id] || [];
      const f = buildField(this.scene, id, def, exits.map((e) => [e.x, e.z]));
      world.solids = f.solids;
      world.limit = f.half - 1.2;
      world.round = false;
      world.spawn = { x: exits[0]?.arrive[0] ?? 0, z: exits[0]?.arrive[1] ?? 0 };
    }

    for (const e of PORTALS[id] || []) {
      const color = PORTAL_COLOR[e.to] || '#5ee7ff';
      world.portals.push({ ...e, view: makePortal(this.scene, e, color) });
      world.labels.push({ x: e.x, y: 2.6, z: e.z, text: e.label, kind: 'portal' });
    }

    for (const [npcId, npc] of Object.entries(NPCS)) {
      if (npc.map !== id) continue;
      const ch = buildCharacter({ gender: npc.look.gender, classId: npc.look.classId, appearance: npc.look.appearance });
      ch.group.position.set(npc.pos[0], 0, npc.pos[1]);
      ch.group.rotation.y = Math.PI;
      this.scene.add(ch.group);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffd166', emissiveIntensity: 0.9 }));
      marker.position.set(npc.pos[0], 3.3, npc.pos[1]);
      this.scene.add(marker);
      world.npcs.push({ id: npcId, def: npc, x: npc.pos[0], z: npc.pos[1], char: ch, marker, state: '' });
      world.labels.push({ x: npc.pos[0], y: 2.5, z: npc.pos[1], text: npc.name, kind: 'npc', npc: npcId });
    }

    // Monsters live in habitat zones: each kind keeps to its own part of the map.
    for (const z of def.zones || []) {
      for (const [mid, count] of z.mons) {
        for (let i = 0; i < count; i++) world.monsters.push(new Monster(this.scene, mid, MONSTERS[mid], zoneSpot(world, z)));
      }
    }
    for (const [mid, count] of def.spawns || []) {
      for (let i = 0; i < count; i++) world.monsters.push(new Monster(this.scene, mid, MONSTERS[mid], freeSpot(world)));
    }
    // gathering nodes: harvested with E, back after NODE_RESPAWN seconds
    world.nodes = [];
    for (const [item, count] of def.nodes || []) {
      for (let i = 0; i < count; i++) {
        const { x, z } = freeSpot(world);
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: NODE_COLOR[item], emissive: NODE_COLOR[item], emissiveIntensity: 0.8 }));
        mesh.position.set(x, 0.5, z);
        this.scene.add(mesh);
        world.nodes.push({ item, x, z, mesh, ready: true, t: 0 });
      }
    }

    const g = this.hero.group;
    if (g.parent) g.parent.remove(g);
    this.scene.add(g);
    const sx = at ? at[0] : world.spawn.x;
    const sz = at ? at[1] : world.spawn.z;
    g.position.set(sx, 0, sz);
    this.hero.rot = 0;
    g.rotation.y = 0;
    this.camPos.set(sx, 9.5, sz + 12);

    this.world = world;
    this.nav = buildNav(world.solids, world.limit, RADIUS, world.round);
    this.path = null;
    this.pathGoal = null;
    this.buildLabels();
    this.targetMon = null;
    this.moveTarget = null;
    this.interactNpc = null;
    this.p.map = id;
    this.syncSpirit();
    this.p.pos = [sx, sz];
    this.dirty = true;

    const msgs = P.applyEvent(this.p, { type: 'visit', map: id }, this.character.classId);
    if (!opts.silent) {
      Hud.banner(def.name, def.levelText);
      Hud.fade(false);
    }
    msgs.forEach((m) => Hud.toast(m, 'quest'));
    this.transitioning = false;
    return true;
  },

  disposeWorld() {
    if (!this.scene) return;
    this.world?.monsters.forEach((m) => m.dispose());
    this.fx?.clear();
    for (const el of this.labelEls) el.remove();
    this.labelEls = [];
    for (const f of this.floats) f.el.remove();
    this.floats = [];
    this.hero.group.parent?.remove(this.hero.group);
  },

  buildLabels() {
    const layer = $('float-layer');
    for (const l of this.world.labels) {
      const el = document.createElement('div');
      el.className = 'label ' + l.kind;
      el.innerHTML = '<span></span>';
      el.querySelector('span').textContent = l.text;
      layer.appendChild(el);
      this.labelEls.push(el);
      l.el = el;
    }
  },

  // ---------- input ----------
  bindInput() {
    if (this.bound) return;
    this.bound = true;

    // Keys are read by physical position (e.code), so WASD and number keys still work with a Thai or other input layout.
    const keyName = (e) => {
      if (/^Key[A-Z]$/.test(e.code)) return e.code[3].toLowerCase();
      if (/^Digit[0-9]$/.test(e.code)) return e.code[5];
      if (e.code === 'Space') return ' ';
      return e.key.toLowerCase();
    };
    window.addEventListener('keydown', (e) => {
      if (!$('game').classList.contains('active')) return;
      const chat = $('chat-input');
      if (document.activeElement === chat) {
        if (e.key === 'Enter') Hud.sendChat();
        if (e.key === 'Escape') chat.blur();
        return;
      }
      if (e.target.matches && e.target.matches('input, select, textarea')) return;
      if (e.key === 'Enter') { Hud.focusChat(); e.preventDefault(); return; }
      if (e.key === 'Escape') { Hud.close(); return; }
      const k = keyName(e);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (e.repeat && !['a', 'd', 'w', 's'].includes(k) && !k.startsWith('arrow')) return;
      this.keys[k] = true;
      if (/^[1-6]$/.test(k)) this.useSkill(Number(k));
      else if (k === ' ') this.basicNearest();
      else if (k === 'q') this.usePotion('potion_hp');
      else if (k === 'e') this.interactNearest();
      else if (k === 't') this.setAuto(!this.auto);
      else {
        const menu = Hud.menuForKey(k);
        if (menu) Hud.toggle(menu);
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[keyName(e)] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });

    const el = Stage.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      if (!this.world || !this.hero) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const ray = this.raycaster.ray;
      const near = (x, y, z, rad) => ray.distanceToPoint(new THREE.Vector3(x, y, z)) < rad;

      const m = this.world.monsters.find((mm) => mm.alive && near(mm.x, mm.def.size, mm.z, 1.2 * mm.def.size));
      if (m) { this.targetMon = m; this.moveTarget = null; this.interactNpc = null; return; }
      const npc = this.world.npcs.find((n) => near(n.x, 1.2, n.z, 1.1));
      if (npc) { this.interactNpc = npc; this.moveTarget = { x: npc.x, z: npc.z }; this.targetMon = null; return; }
      const hit = new THREE.Vector3();
      if (ray.intersectPlane(this.ground, hit)) {
        this.moveTarget = { x: hit.x, z: hit.z };
        this.targetMon = null;
        this.interactNpc = null;
      }
    });

    setInterval(() => { if (this.hero && this.dirty && !this.transitioning) this.save(); }, SAVE_EVERY * 1000);
  },

  // ---------- main loop ----------
  update(dt, t) {
    const h = this.hero;
    if (!h || !this.world || this.transitioning) return;
    this.time = t;
    const g = h.group;
    const p = g.position;
    const w = this.world;

    // keyboard moves freely; otherwise follow a route (A*) to the target / monster / NPC
    let ix = 0;
    let iz = 0;
    if (this.keys.a || this.keys.arrowleft) ix -= 1;
    if (this.keys.d || this.keys.arrowright) ix += 1;
    if (this.keys.w || this.keys.arrowup) iz -= 1;
    if (this.keys.s || this.keys.arrowdown) iz += 1;
    const manual = ix || iz;
    if (manual) {
      this.moveTarget = null;
      this.interactNpc = null;
      this.targetMon = null;
      this.path = null;
    }
    const range = this.attackRange();
    if (!manual) {
      let gx = null;
      let gz = null;
      let stop = 0;
      if (this.targetMon) {
        const tm = this.targetMon;
        if (!tm.alive) this.targetMon = null;
        else { gx = tm.x; gz = tm.z; stop = range * 0.85; }
      }
      if (gx === null && this.interactNpc) {
        gx = this.interactNpc.x;
        gz = this.interactNpc.z;
        stop = NPC_RANGE * 0.8;
      }
      if (gx === null && this.moveTarget) {
        gx = this.moveTarget.x;
        gz = this.moveTarget.z;
        stop = 0.15;
      }
      if (gx !== null) {
        const dx = gx - p.x;
        const dz = gz - p.z;
        const d = Math.hypot(dx, dz);
        if (d <= stop) {
          if (this.targetMon) this.face(dx, dz, dt);
          if (this.interactNpc) {
            const n = this.interactNpc;
            this.interactNpc = null;
            this.moveTarget = null;
            this.path = null;
            this.face(dx, dz, dt);
            this.talkTo(n.id);
          } else if (this.moveTarget && !this.targetMon) {
            this.moveTarget = null;
            this.path = null;
          }
        } else {
          const dir = this.routeDir(gx, gz, t);
          if (dir) {
            ix = dir.x;
            iz = dir.z;
          } else {
            // no route: drop this goal and skip the monster for a while
            if (this.targetMon) this.targetMon.unreachableUntil = t + 6;
            if (!this.auto) Hud.toast('ไปไม่ถึงจุดนั้น', 'warn');
            this.targetMon = null;
            this.interactNpc = null;
            this.moveTarget = null;
            this.path = null;
          }
        }
      }
    }
    if (this.auto) this.autoTick(dt);
    if (this.questAuto) this.questTick(dt);
    this.runTick(dt);
    this.updateSpirit();
    this.updateNodes(dt);

    const len = Math.hypot(ix, iz);
    h.moving = len > 0;
    if (len > 0) {
      ix /= len;
      iz /= len;
      const step = SPEED * dt;
      if (!blocked(w.solids, p.x + ix * step, p.z, RADIUS)) p.x += ix * step;
      if (!blocked(w.solids, p.x, p.z + iz * step, RADIUS)) p.z += iz * step;
      const r = Math.hypot(p.x, p.z);
      if (w.limit && r > w.limit) { p.x *= w.limit / r; p.z *= w.limit / r; }
      this.face(ix, iz, dt);
    }

    // basic attack when a target is in range
    this.cdBasic -= dt;
    if (this.pendingHit) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) {
        const { m } = this.pendingHit;
        this.pendingHit = null;
        if (m.alive) this.hitMonster(m, 1.0, 0);
      }
    }
    const tm = this.targetMon;
    if (tm && tm.alive && this.cdBasic <= 0 && Math.hypot(tm.x - p.x, tm.z - p.z) <= range + 0.3) {
      this.performBasic(tm);
    }

    // monsters act
    for (const m of w.monsters) {
      const attacked = m.update(dt, t, { x: p.x, z: p.z, alive: h.hp > 0 }, w.solids);
      if (attacked && h.hp > 0) this.hurtHero(m);
      m.faceCamera(this.camera);
    }

    // regen and timers
    h.mp = Math.min(this.stats.maxMp, h.mp + 3 * dt);
    h.flash = Math.max(0, h.flash - dt);
    h.shieldT = Math.max(0, h.shieldT - dt);

    // portals
    for (const e of w.portals) {
      if (Math.hypot(e.x - p.x, e.z - p.z) < PORTAL_RANGE) {
        Sfx.play('portal');
        this.enterMap(e.to, e.arrive);
        break;
      }
    }

    if (h.hp <= 0 && !this.dying) this.die();

    // world animation
    w.update?.(t, dt);
    for (const e of w.portals) e.view.update(t);
    for (const n of w.npcs) {
      n.marker.position.y = 3.3 + Math.sin(t * 3 + n.x) * 0.12;
      n.marker.rotation.y = t * 1.5;
      n.char.update(t, false);
    }
    this.updateMarkers(t);
    this.fx.update(dt);

    // camera follows the hero
    const look = new THREE.Vector3(p.x, 1.0, p.z);
    const desired = new THREE.Vector3(p.x, 9.5, p.z + 12);
    this.camPos.lerp(desired, Math.min(1, dt * 5));
    this.camera.position.copy(this.camPos);
    if (performance.now() < this.shakeUntil) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
    }
    this.camera.lookAt(look);

    if (h.moving && !this.dying) {
      this.stepT = (this.stepT || 0) + dt;
      if (this.stepT > 0.36) { this.stepT = 0; Sfx.play('step'); }
    } else {
      this.stepT = 0;
    }
    h.char.update(t, h.moving, dt);
    this.updateOverlays(dt);

    this.saveT += dt;
    if (this.saveT > SAVE_EVERY && this.dirty) {
      this.saveT = 0;
      this.save();
    }
  },

  face(dx, dz, dt) {
    if (Math.hypot(dx, dz) < 0.001) return;
    this.hero.rot = lerpAngle(this.hero.rot, Math.atan2(dx, dz), Math.min(1, dt * 12));
    this.hero.group.rotation.y = this.hero.rot;
  },

  facing() {
    return { x: Math.sin(this.hero.rot), z: Math.cos(this.hero.rot) };
  },

  attackRange() {
    return CLASSES[this.character.classId].basic.range;
  },

  // Next step along an A* route to (gx, gz), or null when there is no route.
  routeDir(gx, gz, t) {
    const p = this.hero.group.position;
    const goalMoved = !this.pathGoal || Math.hypot(this.pathGoal.x - gx, this.pathGoal.z - gz) > 0.6;
    if (!this.path || goalMoved || t - this.pathT > 0.8) {
      this.path = findPath(this.nav, p.x, p.z, gx, gz);
      this.pathT = t;
      this.pathGoal = { x: gx, z: gz };
      if (!this.path) return null;
    }
    while (this.path.length > 1 && Math.hypot(this.path[0].x - p.x, this.path[0].z - p.z) < 0.3) this.path.shift();
    const wp = this.path[0];
    const dx = wp.x - p.x;
    const dz = wp.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d };
  },

  updateMarkers(t) {
    if (!this.world) return;
    for (const n of this.world.npcs) {
      const avail = P.availableQuests(this.p, n.id).length > 0;
      const turnIn = Object.entries(this.p.quests).some(([qid, q]) => {
        const step = P.currentStep(this.p, qid);
        return step && step.type === 'talk' && step.npc === n.id && q.status === 'active';
      });
      const state = avail || turnIn ? 'gold' : Object.keys(this.p.quests).some((qid) => QUESTS[qid].steps.some((s) => s.npc === n.id)) ? 'cyan' : '';
      if (state !== n.state) {
        n.state = state;
        const col = state === 'cyan' ? '#5ee7ff' : '#ffd166';
        n.marker.material.color.set(col);
        n.marker.material.emissive.set(col);
        n.marker.visible = !!state;
      }
      n.status = avail ? 'มีภารกิจใหม่' : turnIn ? 'ส่งภารกิจ' : '';
    }
    void t;
  },

  updateOverlays(dt) {
    void dt;
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    const project = (x, y, z) => {
      const v = new THREE.Vector3(x, y, z).project(this.camera);
      return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * hgt, v.z < 1];
    };
    for (const l of this.world.labels) {
      const [sx, sy, visible] = project(l.x, l.y, l.z);
      const npc = l.npc ? this.world.npcs.find((n) => n.id === l.npc) : null;
      if (npc) {
        let em = l.el.querySelector('em');
        if (npc.status && !em) {
          em = document.createElement('em');
          l.el.appendChild(em);
        }
        if (em) {
          if (npc.status) em.textContent = npc.status;
          else em.remove();
        }
      }
      l.el.style.display = visible ? '' : 'none';
      l.el.style.transform = `translate(${sx}px, ${sy}px)`;
    }
    const now = performance.now();
    this.floats = this.floats.filter((f) => {
      const age = (now - f.born) / 900;
      if (age >= 1) { f.el.remove(); return false; }
      const [sx, sy] = project(f.x, f.y + age * 0.8, f.z);
      f.el.style.transform = `translate(${sx}px, ${sy}px)`;
      f.el.style.opacity = String(1 - age);
      return true;
    });
  },

  floatText(x, y, z, str, color, big) {
    const el = document.createElement('div');
    el.className = 'float' + (big ? ' big' : '');
    el.style.color = color;
    el.textContent = str;
    $('float-layer').appendChild(el);
    this.floats.push({ el, x, y, z, born: performance.now() });
  },

  // ---------- combat ----------
  // Damage = attack * multiplier - defence / 2, with a crit roll from gear.
  calcDamage(mult, def) {
    const base = this.stats.atk * mult - def * 0.5;
    const crit = Math.random() * 100 < this.stats.crit;
    const critMul = 1 + this.stats.critDmg / 100;
    const dmg = Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2) * (crit ? critMul : 1)));
    return { dmg, crit };
  },

  weaponFx() {
    const base = this.equippedBase('weapon');
    if (base?.fx) return base.fx;
    return FX_BASIC_DEFAULT[this.character.classId];
  },

  performBasic(m) {
    const c = CLASSES[this.character.classId].basic;
    this.cdBasic = c.cd;
    this.hero.char.act('swing');
    this.aura(CLASSES[this.character.classId].color, 1.6);
    const p = this.hero.group.position;
    this.fx.spawn(this.weaponFx(), new THREE.Vector3(p.x, 1.0, p.z), this.facing(), c.range);
    Sfx.play('swing', this.character.classId);
    // the hit lands at the contact point of the swing, so the damage matches what is seen
    this.pendingHit = { m, t: 0.14 };
  },

  hitMonster(m, mult, knock = 0.4) {
    const { dmg, crit } = this.calcDamage(mult, m.def.def);
    Sfx.play(crit ? 'crit' : 'hit');
    this.floatText(m.x, 1.8 * m.def.size, m.z, (crit ? 'คริติคอล ' : '') + dmg, crit ? '#ffd166' : '#ffffff', crit);
    if (crit) {
      this.shakeAmt = 0.08;
      this.shakeUntil = performance.now() + 120;
    }
    // knock the monster back a little, away from the hero
    const p = this.hero.group.position;
    const d = Math.hypot(m.x - p.x, m.z - p.z) || 1;
    if (knock && !blocked(this.world.solids, m.x + ((m.x - p.x) / d) * knock, m.z + ((m.z - p.z) / d) * knock, 0.5)) {
      m.x += ((m.x - p.x) / d) * knock;
      m.z += ((m.z - p.z) / d) * knock;
      m.group.position.set(m.x, 0, m.z);
    }
    this.impact(m);
    const dead = m.hit(dmg);
    Sfx.play(dead ? 'monsterDie' : 'monsterHurt', m.id === 'tower_boss' ? 'boss' : m.def.shape);
    if (dead) this.onKill(m);
  },

  hurtHero(m) {
    const h = this.hero;
    Sfx.play('heroHurt');
    let dmg = Math.max(1, Math.round((m.def.atk - this.stats.def * 0.5) * (0.9 + Math.random() * 0.2)));
    if (h.shieldT > 0) dmg = Math.max(1, Math.round(dmg * (1 - h.shield)));
    h.hp -= dmg;
    h.flash = 0.3;
    Hud.hurt();
    const p = h.group.position;
    this.floatText(p.x, 2.4, p.z, '-' + dmg, '#ff5d73', false);
  },

  onKill(m) {
    const d = m.def;
    const diff = this.p.level - d.level;
    let exp = d.exp;
    if (diff >= 6) exp = Math.round(exp * 0.3);
    else if (diff >= 3) exp = Math.round(exp * 0.6);
    exp = Math.round(exp * this.stats.expMul);
    const gold = Math.round(rand(d.gold[0], d.gold[1]) * this.stats.goldMul);
    this.p.gold += gold;

    const items = [];
    const msgs = [];
    for (const [id, chance] of d.drops) {
      if (Math.random() < chance) {
        P.addMat(this.p, id, 1);
        items.push({ name: MATERIALS[id].name, icon: MATERIALS[id].icon, color: RARITY[MATERIALS[id].rarity].color });
        msgs.push(...P.applyEvent(this.p, { type: 'collect', item: id, qty: 1 }, this.character.classId));
      }
    }
    if (Math.random() < d.gearChance) {
      const gear = P.rollDrop(this.character.classId, this.p.level);
      if (P.addGear(this.p, gear)) {
        const base = GEAR[gear.base];
        items.push({ name: `${base.name} ${base.epithet}`.trim(), icon: base.icon, color: base.gcolor, rare: base.grade >= 2 });
      } else {
        Hud.toast('กระเป๋าเต็ม ของที่ตกหายไป', 'warn');
      }
    }
    msgs.unshift(...P.applyEvent(this.p, { type: 'kill', monster: m.id, map: this.map }, this.character.classId));
    const levels = P.addExp(this.p, exp);
    this.floatText(m.x, 2.2 * m.def.size, m.z, `+${exp} EXP`, '#c79bff', true);
    if (levels) {
      this.refreshStats(true);
      Hud.toast(`เลเวลอัป! ตอนนี้เลเวล ${this.p.level} · ได้ ${2} แต้มสกิล`, 'gold');
    }
    Sfx.play(items.length ? 'pickup' : 'coin');
    if (levels) Sfx.play('levelup');
    Hud.loot({ name: d.name, exp, gold, items });
    msgs.forEach((t) => Hud.toast(t, 'quest'));
    if (this.targetMon === m) this.targetMon = null;
    this.dirty = true;
    Hud.refresh(this);
  },

  // Monsters a skill hits: every one in range for AoE, otherwise the focused target or the nearest.
  monstersInRange(rangeU, aoe) {
    const p = this.hero.group.position;
    const dir = this.facing();
    const list = this.world.monsters
      .filter((m) => m.alive)
      .map((m) => ({ m, dx: m.x - p.x, dz: m.z - p.z }))
      .map((o) => ({ ...o, d: Math.hypot(o.dx, o.dz) }))
      .filter((o) => o.d <= rangeU + 0.6 && (o.d < 1.2 || (o.dx * dir.x + o.dz * dir.z) / o.d > -0.3))
      .sort((a, b) => a.d - b.d)
      .map((o) => o.m);
    if (aoe) return list;
    const focused = this.targetMon && list.includes(this.targetMon) ? this.targetMon : list[0];
    return focused ? [focused] : [];
  },

  // Uses the skill on hotbar slot `slot` (1-6).
  useSkill(slot) {
    const s = this.hotSkill(slot);
    if (!s || !this.hero) {
      if (!s) Hud.toast('ยังไม่ได้ตั้งสกิลในช่องนี้ (เปิดหน้าสกิลเพื่อตั้งปุ่ม)', 'warn');
      return;
    }
    const lock = P.skillJobLock(this.p, s.id);
    if (lock) { Hud.toast(`${s.name}: ${lock}`, 'warn'); Sfx.play('error'); return; }
    const now = performance.now();
    if ((this.cooldowns[s.id] || 0) > now) return;
    const h = this.hero;
    if (h.mp < s.mp) { Hud.toast('MP ไม่พอ', 'warn'); return; }
    const p = h.group.position;
    const dir = this.facing();
    const rangeU = Math.max(1, s.range / UNIT);
    const cdMs = rankCooldown(s, s.rank, this.stats.cdr);
    const mult = rankMult(s, s.rank) * (1 + this.stats.skillMg / 100);

    if (s.heal || s.shield) {
      if (s.heal) {
        const amount = Math.round(this.stats.maxHp * s.heal);
        h.hp = Math.min(this.stats.maxHp, h.hp + amount);
        this.floatText(p.x, 2.4, p.z, `+${amount}`, '#7dff9b', true);
      }
      if (s.shield) {
        h.shield = s.shield;
        h.shieldT = SHIELD_TIME;
      }
      h.mp -= s.mp;
      this.cooldowns[s.id] = now + cdMs;
      h.char.act(poseFor(s));
      Sfx.play('cast', s.heal ? 'heal' : s.shield ? 'guard' : 'cast');
      this.fx.spawn(s.fx, new THREE.Vector3(p.x, 0.2, p.z), dir, 0);
      this.aura(s.heal ? '#7dff9b' : '#8fd8ff', 2.4);
      return;
    }

    const targets = this.monstersInRange(rangeU, s.aoe);
    if (!targets.length) { Hud.toast('ไม่มีเป้าหมายในระยะ', 'warn'); return; }
    h.mp -= s.mp;
    this.cooldowns[s.id] = now + cdMs;
    h.char.act(poseFor(s));
    Sfx.play('cast', s.heal ? 'heal' : s.shield ? 'guard' : 'cast');
    this.aura(CLASSES[this.character.classId].color, 2.4);
    this.fx.spawn(s.fx, new THREE.Vector3(p.x, 1.0, p.z), dir, rangeU);
    if (s.fx.shake) {
      this.shakeAmt = s.fx.shake * 0.03;
      this.shakeUntil = now + 200;
    }
    for (const m of targets) this.hitMonster(m, mult);
  },

  // A ring at the hero's feet so every attack and cast reads clearly from the camera.
  aura(color, size) {
    const p = this.hero.group.position;
    this.fx.spawn(
      { type: 'nova', color, color2: '#ffffff', count: 8, size: 4, duration: 320, speed: 90, shake: 0 },
      new THREE.Vector3(p.x, 0.12, p.z),
      { x: 0, z: 1 },
      size,
    );
  },

  // Sparks where a hit lands, in the monster's colour.
  impact(m) {
    this.fx.spawn(
      { type: 'burst', color: m.def.color, color2: '#ffffff', count: 16, size: 6, duration: 380, speed: 150, shake: 0 },
      new THREE.Vector3(m.x, m.def.size, m.z),
      { x: 0, z: 1 },
      0,
    );
  },

  basicNearest() {
    const range = this.attackRange();
    const p = this.hero.group.position;
    if (this.targetMon?.alive) return;
    const near = this.world.monsters.filter((m) => m.alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (near && Math.hypot(near.x - p.x, near.z - p.z) <= range + 6) this.targetMon = near;
  },

  autoTick(dt) {
    const p = this.hero.group.position;
    const now = performance.now() / 1000;
    if (!this.targetMon || !this.targetMon.alive) {
      this.targetMon = this.world.monsters
        .filter((m) => m.alive && (m.unreachableUntil || 0) < now)
        .map((m) => ({ m, d: Math.hypot(m.x - p.x, m.z - p.z) }))
        .filter((o) => o.d < 22)
        .sort((a, b) => a.d - b.d)[0]?.m || null;
    }
    if (!this.targetMon) {
      // no monsters close by: wander the map so the bot keeps finding fights
      this.exploreT -= dt;
      if (this.exploreT <= 0 && !this.moveTarget) {
        this.exploreT = 4 + Math.random() * 3;
        const r = this.world.limit * 0.7;
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * r;
        this.moveTarget = { x: Math.cos(a) * d, z: Math.sin(a) * d };
      }
      return;
    }
    this.exploreT = 0;
    const tm = this.targetMon;
    const dist = Math.hypot(tm.x - p.x, tm.z - p.z);
    const ready = (s) => (this.cooldowns[s.id] || 0) <= performance.now() && this.hero.mp >= s.mp;
    for (let slot = 1; slot <= 6; slot++) {
      const s = this.hotSkill(slot);
      if (!s || !ready(s) || P.skillJobLock(this.p, s.id)) continue;
      if (s.heal) {
        if (this.hero.hp < this.stats.maxHp * 0.6) { this.useSkill(slot); break; }
        continue;
      }
      if (s.shield) {
        if (this.hero.shieldT <= 0 && dist < 8) { this.useSkill(slot); break; }
        continue;
      }
      if (dist <= Math.max(1, s.range / UNIT) + 0.6) { this.useSkill(slot); break; }
    }
    if (this.hero.hp < this.stats.maxHp * 0.35 && (this.p.mats.potion_hp || 0) > 0) this.usePotion('potion_hp');
  },

  die() {
    this.dying = true;
    Hud.toast('พ่ายแพ้... ฟื้นคืนชีพที่ดินแดนสวรรค์', 'warn');
    this.setAuto(false);
    this.enterMap('town', null).then(() => {
      this.refreshStats(false);
      this.hero.hp = Math.round(this.stats.maxHp * 0.3);
      this.dying = false;
      this.dirty = true;
    });
  },

  setAuto(on) {
    this.auto = on;
    this.targetMon = on ? this.targetMon : null;
    Hud.setAuto(on);
    Hud.toast(on ? 'เปิดออโต้: ล่ามอนสเตอร์อัตโนมัติ' : 'ปิดออโต้', on ? 'gold' : '');
  },

  // ---------- items, gear and skills ----------
  usePotion(id) {
    if (!P.removeMat(this.p, id, 1)) { Hud.toast('ไม่มียาในกระเป๋า', 'warn'); return; }
    const heal = MATERIALS[id].heal || 0;
    const before = this.hero.hp;
    this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + heal);
    const p = this.hero.group.position;
    this.floatText(p.x, 2.4, p.z, `+${Math.round(this.hero.hp - before)}`, '#7dff9b', false);
    this.dirty = true;
    Hud.refresh(this);
  },

  equip(uid) {
    const err = P.equipGear(this.p, uid, this.character.classId);
    if (err) { Hud.toast(err, 'warn'); return; }
    const g = P.findGear(this.p, uid);
    this.refreshStats(false);
    this.syncWeapon();
    Hud.toast(`สวมใส่ ${GEAR[g.base].name} ${GRADES[GEAR[g.base].grade].name}${g.enh ? ' +' + g.enh : ''}`);
    this.dirty = true;
    Hud.refresh(this);
  },

  unequip(slot) {
    P.unequip(this.p, slot);
    this.refreshStats(false);
    this.syncWeapon();
    this.dirty = true;
    Hud.refresh(this);
  },

  enhance(uid) {
    const r = P.enhance(this.p, uid);
    Hud.toast(r.msg, r.ok ? 'gold' : r.result === 'error' ? 'warn' : r.result === 'down' ? 'warn' : '');
    if (r.result === 'success' || r.result === 'down') this.refreshStats(false);
    this.dirty = true;
    Hud.refresh(this);
    return r;
  },

  sell(uid) {
    const gold = P.sellGear(this.p, uid);
    if (gold === null) { Hud.toast('ขายไม่ได้ (ถอดอุปกรณ์ก่อน)', 'warn'); return; }
    Hud.toast(`ขายได้ ${gold} เหรียญ`, 'gold');
    this.dirty = true;
    Hud.refresh(this);
  },

  buy(itemId) {
    const it = MATERIALS[itemId];
    if (!it?.price) return;
    if (this.p.gold < it.price) { Hud.toast('เหรียญไม่พอ', 'warn'); return; }
    this.p.gold -= it.price;
    P.addMat(this.p, itemId, 1);
    Hud.toast(`ซื้อ ${it.name} แล้ว`);
    this.dirty = true;
    Hud.refresh(this);
  },

  // Crafts a weapon or armour piece at the smith. band and line come from the window.
  craft(line, band) {
    const r = P.craftGear(this.p, line, band, this.character.classId);
    if (r.error) { Hud.toast(r.error, 'warn'); return; }
    const base = GEAR[r.gear.base];
    Hud.toast(`คราฟสำเร็จ: ${base.name} ${GRADES[base.grade].name}`, 'gold');
    this.dirty = true;
    Hud.refresh(this);
  },

  learn(skillId) {
    const err = P.learnSkill(this.p, skillId);
    if (err) { Hud.toast(err, 'warn'); return; }
    const s = this.skillMap[skillId];
    Hud.toast(`เรียนรู้ ${s.name} (ระดับ ${this.p.skills[skillId]})`, 'gold');
    this.dirty = true;
    Hud.refresh(this);
  },

  setHotbar(slot, skillId) {
    const err = P.setHotbar(this.p, slot - 1, skillId);
    if (err) Hud.toast(err, 'warn');
    this.dirty = true;
    Hud.refresh(this);
  },

  // ---------- quest guidance and VIP auto quest ----------
  // Where the tracked quest needs the hero: { map, x, z, npc, text }. x/z are the nearest matching monster
  // on that map, or null when none is loaded there.
  questGuide() {
    const qid = Hud.activeQuest(this);
    const step = qid && P.currentStep(this.p, qid);
    if (!step) return null;
    if (step.type === 'talk') {
      const n = NPCS[step.npc];
      return { map: n.map, x: n.pos[0], z: n.pos[1], npc: step.npc, text: step.text };
    }
    const guide = { map: step.map, x: null, z: null, text: step.text };
    const p = this.hero?.group.position;
    if (!p || this.p.map !== step.map) return guide;
    const hits = (this.world?.monsters || []).filter((m) => m.alive && (step.type === 'kill'
      ? m.id === step.monster
      : m.def.drops.some(([id]) => id === step.item)));
    const near = hits.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (near) { guide.x = near.x; guide.z = near.z; }
    return guide;
  },

  // Screen-world point the guide arrow should point at: the spot itself, or the portal that starts the route.
  guideTarget(guide) {
    if (!guide) return null;
    if (guide.map === this.p.map) return guide.x === null ? null : { x: guide.x, z: guide.z };
    const hop = routeHop(this.p.map, guide.map);
    return hop ? { x: hop.x, z: hop.z, to: hop.to } : null;
  },

  // VIP only. Free players get the arrow; VIP players also walk, talk and fight their way through the quest.
  setQuestAuto(on) {
    if (on && !this.p.vip) {
      Hud.toast('ออโต้เควสเป็นสิทธิพิเศษของสมาชิก VIP', 'warn');
      Sfx.play('error');
      return;
    }
    this.questAuto = on && !!this.questGuide();
    if (!this.questAuto) this.moveTarget = null;
    Hud.toast(this.questAuto ? 'เปิดออโต้เควส: กำลังไปทำภารกิจ' : 'ปิดออโต้เควส', this.questAuto ? 'gold' : '');
    Sfx.play(this.questAuto ? 'click' : 'tab');
    Hud.refresh(this);
  },

  questTick(dt) {
    const guide = this.questGuide();
    if (!guide || !this.guideTarget(guide)) { this.setQuestAuto(false); return; }
    const p = this.hero.group.position;
    if (guide.map !== this.p.map) {
      const t = this.guideTarget(guide);
      this.moveTarget = { x: t.x, z: t.z };
      return;
    }
    if (guide.npc) {
      if (Math.hypot(guide.x - p.x, guide.z - p.z) < NPC_RANGE * 0.8) {
        this.moveTarget = null;
        this.talkTo(guide.npc);
      } else {
        this.moveTarget = { x: guide.x, z: guide.z };
      }
      return;
    }
    if (!this.auto) this.autoTick(dt);
  },

  // ---------- spirits (ภูติ) ----------
  // One spirit orb floats beside the hero. Its colour follows the spirit's rarity; mythic cycles through colours.
  syncSpirit() {
    if (!this.hero) return;
    const sp = P.spiritOf(this.p, this.p.spirit);
    if (!this.spiritOrb) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ emissiveIntensity: 1.1, transparent: true, opacity: 0.95 }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }));
      orb.add(halo);
      this.hero.group.add(orb);
      this.spiritOrb = orb;
    }
    this.spiritOrb.visible = !!sp;
    if (!sp) return;
    this.spiritRarity = SPIRIT_RARITY.find((r) => r.id === sp.rarity);
    const color = this.spiritRarity.rainbow ? '#ffffff' : this.spiritRarity.color;
    this.spiritOrb.material.color.set(color);
    this.spiritOrb.material.emissive.set(color);
    this.spiritOrb.children[0].material.color.set(color);
  },

  updateSpirit() {
    const o = this.spiritOrb;
    if (!o || !o.visible) return;
    const t = performance.now() / 1000;
    const a = t * 1.4;
    o.position.set(Math.cos(a) * 0.95, 2.05 + Math.sin(t * 2.2) * 0.12, Math.sin(a) * 0.95);
    if (this.spiritRarity?.rainbow) {
      const c = new THREE.Color().setHSL((t * 0.18) % 1, 0.9, 0.6);
      o.material.color.copy(c);
      o.material.emissive.copy(c);
      o.children[0].material.color.copy(c);
    }
  },

  summonSpirit(orbId) {
    const r = P.summonSpirit(this.p, orbId);
    if (r.error) { Hud.toast(r.error, 'warn'); Sfx.play('error'); return; }
    const rarity = SPIRIT_RARITY.find((x) => x.id === r.spirit.rarity);
    Hud.toast(`ได้ภูติ${rarity.name}!`, 'gold');
    Sfx.play('success', SPIRIT_RARITY.indexOf(rarity));
    this.aura(rarity.rainbow ? '#ff9ad5' : rarity.color, 2.4);
    this.syncSpirit();
    this.refreshStats(false);
    this.dirty = true;
    Hud.refresh(this);
  },

  equipSpirit(uid) {
    const err = P.equipSpirit(this.p, uid);
    if (err) { Hud.toast(err, 'warn'); return; }
    Sfx.play('click');
    this.syncSpirit();
    this.refreshStats(false);
    this.dirty = true;
    Hud.refresh(this);
  },

  // ---------- dungeons and tower ----------
  async enterDungeon(id) {
    const tower = id === 'tower';
    const d = tower ? TOWER : DUNGEONS[id];
    const floor = tower ? this.p.dungeon.tower + 1 : 0;
    if (this.p.level < d.minLevel) { Hud.toast(`ต้องเลเวล ${d.minLevel} ขึ้นไป`, 'warn'); Sfx.play('error'); return; }
    if (!tower && DG.entriesLeft(this.p, id) <= 0) { Hud.toast('วันนี้เข้าดันเจี้ยนนี้ครบแล้ว', 'warn'); Sfx.play('error'); return; }
    if (tower && floor > TOWER.floors) { Hud.toast('ผ่านหอคอยครบทุกชั้นแล้ว', 'gold'); return; }
    if (!tower) DG.useEntry(this.p, id);
    if (!(await this.enterMap('dungeon', [0, 6]))) return;
    this.run = { id, kind: tower ? 'tower' : 'farm', waves: tower ? null : d.waves, idx: 0, floor, pause: 1.2, waveOn: false, done: false };
    Hud.toast(tower ? `หอคอย เริ่มชั้น ${floor}` : d.name, 'gold');
    Sfx.play('learn');
    this.dirty = true;
    Hud.refresh(this);
  },

  // Drives a run: waves spawn after a short pause, and the next one follows when the field is clear.
  runTick(dt) {
    const r = this.run;
    if (!r || r.done || this.map !== 'dungeon' || !this.world) return;
    if (r.pause > 0) {
      r.pause -= dt;
      if (r.pause <= 0) this.runSpawn();
      return;
    }
    if (!r.waveOn || this.world.monsters.some((m) => m.alive)) return;
    r.waveOn = false;
    if (r.kind === 'tower') {
      this.grantTowerFloor(r.floor);
      r.floor += 1;
      if (r.floor > TOWER.floors) { this.runFinish(); return; }
    } else if (r.idx >= r.waves.length) {
      this.runFinish();
      return;
    }
    r.pause = 2.2;
  },

  runSpawn() {
    const r = this.run;
    if (r.kind === 'tower') {
      this.spawnWave(DG.towerWave(r.floor), DG.towerMult(r.floor));
      Hud.toast(r.floor % 10 === 0 ? `ชั้น ${r.floor} · บอสมาแล้ว!` : `ชั้น ${r.floor}`, r.floor % 10 === 0 ? 'warn' : '');
    } else {
      this.spawnWave(r.waves[r.idx]);
      r.idx += 1;
      Hud.toast(`ด่าน ${r.idx} / ${r.waves.length}`);
    }
    r.waveOn = true;
  },

  // Dungeon monsters use the scaled stats and never respawn. Tower monsters keep the hero's level so exp is not cut.
  spawnWave(wave, mult = 1) {
    for (const [mid, count] of wave) {
      const base = MONSTERS[mid];
      const boss = mid === 'tower_boss' ? 1.6 : 1; // bosses hit harder and take more hits
      const def = mult === 1 ? base : {
        ...base, hp: Math.round(base.hp * mult * boss), atk: Math.round(base.atk * mult * boss), def: Math.round(base.def * (1 + (mult - 1) * 0.5)),
        exp: Math.round(base.exp * mult), gold: base.gold.map((v) => Math.round(v * mult)), level: Math.max(base.level, this.p.level),
      };
      for (let i = 0; i < count; i++) {
        const m = new Monster(this.scene, mid, def, freeSpot(this.world));
        m.noRespawn = true;
        this.world.monsters.push(m);
      }
    }
  },

  grantTowerFloor(floor) {
    this.p.dungeon.tower = Math.max(this.p.dungeon.tower, floor);
    this.grantReward(DG.towerReward(floor), `ชั้น ${floor} สำเร็จ`);
  },

  runFinish() {
    const r = this.run;
    r.done = true;
    if (r.kind === 'farm') this.grantReward(DG.farmReward(r.id), `${DUNGEONS[r.id].name} สำเร็จ`);
    else Hud.toast('ผ่านหอคอยครบ 100 ชั้นแล้ว', 'gold');
  },

  // Gold, exp, materials, runes and gear from a reward roll, shown in the loot card.
  grantReward(rw, title) {
    const gold = Math.round(rw.gold * this.stats.goldMul);
    const exp = Math.round(rw.exp * this.stats.expMul);
    this.p.gold += gold;
    const items = [];
    const view = (id) => ({ name: MATERIALS[id].name, icon: MATERIALS[id].icon, color: RARITY[MATERIALS[id].rarity].color });
    for (const [id, n] of rw.mats) { P.addMat(this.p, id, n); items.push(view(id)); }
    for (const id of rw.runes) { P.addMat(this.p, id, 1); items.push(view(id)); }
    for (let i = 0; i < rw.gear; i++) {
      const gear = P.rollDrop(this.character.classId, this.p.level);
      if (P.addGear(this.p, gear)) {
        const base = GEAR[gear.base];
        items.push({ name: `${base.name} ${base.epithet}`.trim(), icon: base.icon, color: base.gcolor, rare: base.grade >= 2 });
      } else {
        Hud.toast('กระเป๋าเต็ม ของที่ตกหายไป', 'warn');
      }
    }
    if (P.addExp(this.p, exp)) {
      this.refreshStats(true);
      Hud.toast(`เลเวลอัป! ตอนนี้เลเวล ${this.p.level}`, 'gold');
    }
    Hud.loot({ name: title, exp, gold, items });
    Sfx.play('success', 0);
    this.dirty = true;
    Hud.refresh(this);
  },

  socketRune(uid, runeId) {
    const err = P.socketRune(this.p, uid, runeId);
    if (err) { Hud.toast(err, 'warn'); Sfx.play('error'); return; }
    Hud.toast('ฝังรูนแล้ว', 'gold');
    Sfx.play('learn');
    this.refreshStats(false);
    this.dirty = true;
    Hud.refresh(this);
  },

  unsocketRune(uid, index) {
    const err = P.unsocketRune(this.p, uid, index);
    if (err) { Hud.toast(err, 'warn'); return; }
    Hud.toast('ถอดรูนแล้ว กลับเข้ากระเป๋า');
    Sfx.play('click');
    this.refreshStats(false);
    this.dirty = true;
    Hud.refresh(this);
  },

  // ---------- NPCs ----------
  interactNearest() {
    const p = this.hero.group.position;
    const node = (this.world.nodes || []).find((x) => x.ready && Math.hypot(x.x - p.x, x.z - p.z) < NPC_RANGE);
    if (node) { this.harvest(node); return; }
    const n = this.world.npcs.find((x) => Math.hypot(x.x - p.x, x.z - p.z) < NPC_RANGE);
    if (n) this.talkTo(n.id);
  },

  harvest(node) {
    const mat = MATERIALS[node.item];
    const n = 1 + Math.floor(Math.random() * 2);
    P.addMat(this.p, node.item, n);
    const exp = 8 + this.p.level * 2;
    node.ready = false;
    node.t = NODE_RESPAWN;
    node.mesh.visible = false;
    this.floatText(node.x, 1.2, node.z, `+${n} ${mat.name}`, '#8fe39a', true);
    if (P.addExp(this.p, exp)) { this.refreshStats(true); Hud.toast(`เลเวลอัป! ตอนนี้เลเวล ${this.p.level}`, 'gold'); }
    Sfx.play('pickup');
    this.dirty = true;
    Hud.refresh(this);
  },

  updateNodes(dt) {
    for (const node of this.world?.nodes || []) {
      if (node.ready) continue;
      node.t -= dt;
      if (node.t <= 0) { node.ready = true; node.mesh.visible = true; }
    }
  },

  talkTo(npcId) {
    const msgs = [];
    for (const qid of P.availableQuests(this.p, npcId)) {
      if (P.acceptQuest(this.p, qid)) msgs.push(`รับภารกิจ: ${QUESTS[qid].title}`);
    }
    msgs.push(...P.applyEvent(this.p, { type: 'talk', npc: npcId }, this.character.classId));
    msgs.forEach((m) => Hud.toast(m, 'quest'));
    this.dirty = true;
    Hud.openNpc(npcId);
    Hud.refresh(this);
  },

  // ---------- saving ----------
  async save() {
    if (!this.character?.id || !this.p) return;
    this.dirty = false;
    try {
      await API.put('/api/characters/' + this.character.id, { progress: this.p });
    } catch {
      this.dirty = true;
      Hud.toast('บันทึกไม่สำเร็จ จะลองใหม่อัตโนมัติ', 'warn');
    }
  },

  async leave() {
    await this.save();
    this.disposeWorld();
    Stage.use(null);
  },
};

// ---------- helpers ----------
// Built-in skills plus the custom ones saved from the Skill Lab for this class.
async function loadSkillMap(classId) {
  const map = { ...Object.fromEntries(Object.entries(SKILL_BY_ID).filter(([, s]) => s.classId === classId)) };
  try {
    const data = await API.get('/api/skills?classId=' + encodeURIComponent(classId));
    for (const s of data.skills || []) {
      if (s.classId === classId && !SKILL_BY_ID[s.id]) map[s.id] = { ...s, tier: 1, line: 'custom', lineName: 'กำหนดเอง', reqLv: 1 };
    }
  } catch { /* offline: built-in skills only */ }
  return map;
}

// Random point inside the map that is not on a solid, a portal or an NPC.
// A free point inside a habitat zone, falling back to any free spot when the zone is crowded.
function zoneSpot(world, z) {
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * z.r;
    const x = z.x + Math.cos(a) * d;
    const zz = z.z + Math.sin(a) * d;
    if (Math.abs(x) > world.limit || Math.abs(zz) > world.limit) continue;
    if (blocked(world.solids, x, zz, 1.2)) continue;
    if (world.portals.some((e) => Math.hypot(e.x - x, e.z - zz) < 5)) continue;
    return { x, z: zz };
  }
  return freeSpot(world);
}

function freeSpot(world) {
  const limit = world.limit ?? TOWN_LIMIT;
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() * 2 - 1) * limit * 0.9;
    const z = (Math.random() * 2 - 1) * limit * 0.9;
    if (Math.hypot(x, z) < 3) continue;
    if (blocked(world.solids, x, z, 1.2)) continue;
    if (world.portals.some((e) => Math.hypot(e.x - x, e.z - z) < 5)) continue;
    if (world.npcs.some((n) => Math.hypot(n.x - x, n.z - z) < 4)) continue;
    return { x, z };
  }
  return { x: 0, z: 6 };
}

function showGameScreen() {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'game'));
}
