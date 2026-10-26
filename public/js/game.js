import * as THREE from 'three';
import { buildTown, blocked } from './town.js';
import { buildField, makePortal } from './field.js';
import { buildCharacter } from './character.js';
import { Effects } from './effects.js';
import { Monster } from './monster.js';
import { Hud } from './hud.js';
import { API } from './api.js';
import { CLASSES, DEFAULT_SKILLS } from './config.js';
import { MAPS, PORTALS, NPCS, MONSTERS, ITEMS, QUESTS } from './data.js';
import * as P from './progress.js';
import { Stage } from './stage.js';

const SPEED = 4.2;
const RADIUS = 0.35;
const UNIT = 40; // 40px of skill range = 1 world unit
const TOWN_LIMIT = 19;
const NPC_RANGE = 2.6;
const SAVE_EVERY = 6;
const PORTAL_RANGE = 1.3;
const FX_BASIC = {
  slash: { type: 'slash', color: '#e8f1ff', color2: '#ffffff', count: 1, size: 60, duration: 200, speed: 0, shake: 1 },
  projectile: { type: 'projectile', color: '#4fd1ff', color2: '#ffffff', count: 12, size: 6, duration: 400, speed: 600, shake: 0 },
  burst: { type: 'burst', color: '#ffd166', color2: '#ffffff', count: 14, size: 5, duration: 380, speed: 140, shake: 0 },
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
  camera: new THREE.PerspectiveCamera(40, 1, 0.1, 300),
  world: null,
  fx: null,
  keys: {},
  skills: [],
  cooldowns: {},
  cdBasic: 0,
  auto: false,
  exploreT: 0,
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
    this.p = P.normalize(character.progress);
    this.skills = await loadSkills(character.classId);
    this.cooldowns = {};
    this.cdBasic = 0;
    this.auto = false;
    this.moveTarget = null;
    this.targetMon = null;
    this.interactNpc = null;
    this.dying = false;

    const ch = buildCharacter(character);
    this.hero = { char: ch, group: ch.group, rot: 0, moving: false, hp: 1, mp: 1, flash: 0 };
    this.refreshStats(true);
    this.bindInput();
    Hud.init(this);

    const start = this.p.map;
    const at = this.p.pos;
    const ok = await this.enterMap(MAPS[start] && P.mapUnlocked(this.p, start) ? start : 'town', at, { silent: true });
    if (!ok) await this.enterMap('town', null, { silent: true });

    this.dirty = false;
    showGameScreen();
    Stage.use(this);
    Hud.refresh(this);
    Hud.toast(`ยินดีต้อนรับสู่ ${MAPS[this.map].name}`);
  },

  // ---------- stats ----------
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

  // ---------- maps ----------
  async enterMap(id, at, opts = {}) {
    if (this.transitioning) return false;
    if (!P.mapUnlocked(this.p, id)) {
      Hud.toast(`ต้องเลเวล ${MAPS[id].minLevel} ขึ้นไปจึงเข้า${MAPS[id].name}ได้`, 'warn');
      return false;
    }
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
    const world = { solids: [], portals: [], npcs: [], monsters: [], labels: [], update: null, spawn: { x: 0, z: 7 }, limit: TOWN_LIMIT };

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
      world.spawn = { x: exits[0]?.arrive[0] ?? 0, z: exits[0]?.arrive[1] ?? 0 };
    }

    for (const e of PORTALS[id] || []) {
      const color = e.to === 'town' ? '#ffd166' : e.to === 'mine' ? '#ff6a3d' : '#5ee7ff';
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

    for (const [mid, count] of def.spawns || []) {
      for (let i = 0; i < count; i++) {
        const home = freeSpot(world, def, this.scene);
        world.monsters.push(new Monster(this.scene, mid, MONSTERS[mid], home));
      }
    }

    // hero
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
    this.buildLabels();
    this.targetMon = null;
    this.moveTarget = null;
    this.interactNpc = null;
    this.p.map = id;
    this.p.pos = [sx, sz];
    this.dirty = true;

    const msgs = P.applyEvent(this.p, { type: 'visit', map: id });
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
      el.innerHTML = `<span></span>`;
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
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (e.repeat && !['a', 'd', 'w', 's'].includes(k) && !k.startsWith('arrow')) return;
      this.keys[k] = true;
      if (/^[1-6]$/.test(e.key)) this.useSkill(Number(e.key));
      else if (k === ' ') this.basicNearest();
      else if (k === 'q') this.usePotion('potion_hp');
      else if (k === 'e') this.interactNearest();
      else if (k === 't') Hud.setAuto(!this.auto);
      else {
        const menu = Hud.menuForKey(e.key);
        if (menu) Hud.toggle(menu);
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
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

    // keyboard movement, otherwise walk to target / monster / NPC
    let ix = 0;
    let iz = 0;
    if (this.keys.a || this.keys.arrowleft) ix -= 1;
    if (this.keys.d || this.keys.arrowright) ix += 1;
    if (this.keys.w || this.keys.arrowup) iz -= 1;
    if (this.keys.s || this.keys.arrowdown) iz += 1;
    if (ix || iz) {
      this.moveTarget = null;
      this.interactNpc = null;
      this.targetMon = null;
    }
    const range = this.attackRange();
    if (!ix && !iz && this.targetMon) {
      const tm = this.targetMon;
      if (!tm.alive) this.targetMon = null;
      else {
        const dx = tm.x - p.x;
        const dz = tm.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d > range * 0.85) { ix = dx / d; iz = dz / d; }
        else this.face(dx, dz, dt);
      }
    }
    if (!ix && !iz && this.interactNpc) {
      const n = this.interactNpc;
      const dx = n.x - p.x;
      const dz = n.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < NPC_RANGE) {
        this.interactNpc = null;
        this.moveTarget = null;
        this.face(dx, dz, dt);
        this.talkTo(n.id);
      } else { ix = dx / d; iz = dz / d; }
    }
    if (!ix && !iz && this.moveTarget) {
      const dx = this.moveTarget.x - p.x;
      const dz = this.moveTarget.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) this.moveTarget = null;
      else { ix = dx / d; iz = dz / d; }
    }
    if (this.auto) this.autoTick(dt, t);

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
    const tm = this.targetMon;
    if (tm && tm.alive && this.cdBasic <= 0 && Math.hypot(tm.x - p.x, tm.z - p.z) <= range + 0.3) {
      this.performBasic(tm);
    }

    // monsters act
    for (const m of w.monsters) {
      const attacked = m.update(dt, t, { x: p.x, z: p.z, alive: h.hp > 0 });
      if (attacked && h.hp > 0) this.hurtHero(m);
      m.faceCamera(this.camera);
    }

    // regen and feedback timers
    h.mp = Math.min(this.stats.maxMp, h.mp + 3 * dt);
    h.flash = Math.max(0, h.flash - dt);

    // portals
    if (!this.transitioning) {
      for (const e of w.portals) {
        if (Math.hypot(e.x - p.x, e.z - p.z) < PORTAL_RANGE) {
          this.enterMap(e.to, e.arrive);
          break;
        }
      }
    }

    // death
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

    h.char.update(t, h.moving);
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
  },

  updateOverlays(dt) {
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
  calcDamage(mult, def) {
    const base = this.stats.atk * mult - def * 0.5;
    const crit = Math.random() < 0.15;
    const dmg = Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2) * (crit ? 1.6 : 1)));
    return { dmg, crit };
  },

  performBasic(m) {
    const c = CLASSES[this.character.classId].basic;
    this.cdBasic = c.cd;
    const p = this.hero.group.position;
    const dir = this.facing();
    this.fx.spawn(FX_BASIC[c.fx], new THREE.Vector3(p.x, 1.0, p.z), dir, c.range);
    this.hitMonster(m, 1.0);
  },

  hitMonster(m, mult) {
    const { dmg, crit } = this.calcDamage(mult, m.def.def);
    this.floatText(m.x, 1.8 * m.def.size, m.z, (crit ? 'คริติคอล ' : '') + dmg, crit ? '#ffd166' : '#ffffff', crit);
    if (m.hit(dmg)) this.onKill(m);
  },

  hurtHero(m) {
    const h = this.hero;
    const dmg = Math.max(1, Math.round((m.def.atk - this.stats.def * 0.5) * (0.9 + Math.random() * 0.2)));
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
    const gold = rand(d.gold[0], d.gold[1]);
    const loot = [];
    for (const [id, chance] of d.drops) {
      if (Math.random() < chance) loot.push(id);
    }
    this.p.gold += gold;
    const msgs = [];
    for (const id of loot) {
      P.addItem(this.p, id, 1);
      msgs.push(...P.applyEvent(this.p, { type: 'collect', item: id, qty: 1 }));
    }
    msgs.unshift(...P.applyEvent(this.p, { type: 'kill', monster: m.id, map: this.map }));
    const levels = P.addExp(this.p, exp);
    this.floatText(m.x, 2.2 * m.def.size, m.z, `+${exp} EXP`, '#c79bff', true);
    if (levels) {
      this.refreshStats(true);
      Hud.toast(`เลเวลอัป! ตอนนี้เลเวล ${this.p.level}`, 'gold');
    }
    Hud.loot({ name: d.name, exp, gold, items: loot });
    msgs.forEach((t) => Hud.toast(t, 'quest'));
    if (this.targetMon === m) this.targetMon = null;
    this.dirty = true;
    Hud.refresh(this);
  },

  // Single or AoE skill. Returns the monsters that were hit.
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

  useSkill(key) {
    const s = this.skills.find((x) => x.key === key);
    if (!s || !this.hero) return;
    if (this.p.level < s.reqLv) {
      Hud.toast(`ปลดล็อกที่เลเวล ${s.reqLv}`, 'warn');
      return;
    }
    const now = performance.now();
    if ((this.cooldowns[s.id] || 0) > now) return;
    const h = this.hero;
    if (h.mp < s.mp) { Hud.toast('MP ไม่พอ', 'warn'); return; }
    const p = h.group.position;
    const dir = this.facing();
    const rangeU = Math.max(1, s.range / UNIT);

    if (s.heal) {
      h.mp -= s.mp;
      this.cooldowns[s.id] = now + s.cooldown;
      const amount = Math.round(this.stats.maxHp * s.heal);
      h.hp = Math.min(this.stats.maxHp, h.hp + amount);
      this.fx.spawn(s.fx, new THREE.Vector3(p.x, 0.2, p.z), dir, 0);
      this.floatText(p.x, 2.4, p.z, `+${amount}`, '#7dff9b', true);
      return;
    }

    const targets = this.monstersInRange(rangeU, s.aoe);
    if (!targets.length) { Hud.toast('ไม่มีเป้าหมายในระยะ', 'warn'); return; }
    h.mp -= s.mp;
    this.cooldowns[s.id] = now + s.cooldown;
    this.fx.spawn(s.fx, new THREE.Vector3(p.x, 1.0, p.z), dir, rangeU);
    if (s.fx.shake) {
      this.shakeAmt = s.fx.shake * 0.03;
      this.shakeUntil = now + 200;
    }
    for (const m of targets) this.hitMonster(m, s.mult);
  },

  basicNearest() {
    const range = this.attackRange();
    const p = this.hero.group.position;
    if (this.targetMon?.alive) return;
    const near = this.world.monsters.filter((m) => m.alive).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (near && Math.hypot(near.x - p.x, near.z - p.z) <= range + 6) this.targetMon = near;
  },

  autoTick(dt, t) {
    const p = this.hero.group.position;
    if (!this.targetMon || !this.targetMon.alive) {
      this.targetMon = this.world.monsters
        .filter((m) => m.alive)
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
    const rangeU = (s) => Math.max(1, s.range / UNIT);
    const dist = Math.hypot(tm.x - p.x, tm.z - p.z);
    for (const s of this.skills) {
      if (this.p.level < s.reqLv || this.hero.mp < s.mp) continue;
      if ((this.cooldowns[s.id] || 0) > performance.now()) continue;
      if (s.heal) {
        if (this.hero.hp < this.stats.maxHp * 0.6) { this.useSkill(s.key); break; }
        continue;
      }
      if (dist <= rangeU(s) + 0.6) { this.useSkill(s.key); break; }
    }
    if (this.hero.hp < this.stats.maxHp * 0.35 && (this.p.inv.potion_hp || 0) > 0) this.usePotion('potion_hp');
  },

  die() {
    this.dying = true;
    Hud.toast('พ่ายแพ้... ฟื้นคืนชีพที่ดินแดนสวรรค์', 'warn');
    this.auto = false;
    Hud.setAuto(false);
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

  // ---------- items ----------
  usePotion(id) {
    if (!P.removeItem(this.p, id, 1)) { Hud.toast('ไม่มียาในกระเป๋า', 'warn'); return; }
    const heal = ITEMS[id].heal || 0;
    const before = this.hero.hp;
    this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + heal);
    const p = this.hero.group.position;
    this.floatText(p.x, 2.4, p.z, `+${Math.round(this.hero.hp - before)}`, '#7dff9b', false);
    this.dirty = true;
    Hud.refresh(this);
  },

  equip(id) {
    const it = ITEMS[id];
    if (!it || !['weapon', 'armor'].includes(it.type)) return;
    if (!P.removeItem(this.p, id, 1)) return;
    const old = this.p.equip[it.type];
    if (old) P.addItem(this.p, old, 1);
    this.p.equip[it.type] = id;
    this.refreshStats(false);
    Hud.toast(`สวมใส่ ${it.name}`);
    this.dirty = true;
    Hud.refresh(this);
  },

  unequip(slot) {
    const id = this.p.equip[slot];
    if (!id) return;
    P.addItem(this.p, id, 1);
    this.p.equip[slot] = null;
    this.refreshStats(false);
    this.dirty = true;
    Hud.refresh(this);
  },

  buy(itemId) {
    const it = ITEMS[itemId];
    if (!it?.price) return;
    if (this.p.gold < it.price) { Hud.toast('เหรียญไม่พอ', 'warn'); return; }
    this.p.gold -= it.price;
    P.addItem(this.p, itemId, 1);
    Hud.toast(`ซื้อ ${it.name} แล้ว`);
    this.dirty = true;
    Hud.refresh(this);
  },

  // ---------- NPCs ----------
  interactNearest() {
    const p = this.hero.group.position;
    const n = this.world.npcs.find((x) => Math.hypot(x.x - p.x, x.z - p.z) < NPC_RANGE);
    if (n) this.talkTo(n.id);
  },

  talkTo(npcId) {
    const msgs = [];
    for (const qid of P.availableQuests(this.p, npcId)) {
      if (P.acceptQuest(this.p, qid)) msgs.push(`รับภารกิจ: ${QUESTS[qid].title}`);
    }
    msgs.push(...P.applyEvent(this.p, { type: 'talk', npc: npcId }));
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
async function loadSkills(classId) {
  const byId = new Map((DEFAULT_SKILLS[classId] || []).map((s) => [s.id, s]));
  try {
    const data = await API.get('/api/skills?classId=' + encodeURIComponent(classId));
    for (const s of data.skills || []) byId.set(s.id, s);
  } catch { /* offline: defaults only */ }
  return [...byId.values()].sort((a, b) => a.key - b.key);
}

// Random point inside the map that is not on a solid, a portal or an NPC.
function freeSpot(world, def, scene) {
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
