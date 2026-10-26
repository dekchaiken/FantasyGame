import * as THREE from 'three';
import { buildTown, blocked } from './town.js';
import { buildCharacter } from './character.js';
import { Effects } from './effects.js';
import { API } from './api.js';
import { CLASSES, DEFAULT_SKILLS, HUD_TOP_MENUS, HUD_BOTTOM_MENUS } from './config.js';
import { Stage } from './stage.js';
import { drawThumb } from './thumb.js';

const $ = (id) => document.getElementById(id);
const SPEED = 4.2; // world units per second
const RADIUS = 0.35; // player collision radius
const LIMIT = 19; // stay on the island
const UNIT = 40; // skill range is authored in pixels; 40px = 1 world unit
const QUEST_GOAL = 5;

export const Game = {
  scene: null,
  camera: null,
  town: null,
  fx: null,
  hero: null,
  dummies: [],
  skills: [],
  cooldowns: {},
  keys: {},
  target: null,
  quest: { hits: 0, goal: QUEST_GOAL },
  shakeAmt: 0,
  shakeUntil: 0,
  camPos: new THREE.Vector3(),
  floats: [],
  raycaster: new THREE.Raycaster(),
  ground: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hudTimer: 0,
  portraitTimer: 0,
  bound: false,
  time: 0,

  async start(character) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    this.town = buildTown(this.scene);
    this.fx = new Effects(this.scene);
    this.skills = await loadSkills(character.classId);
    this.cooldowns = {};
    this.quest = { hits: 0, goal: QUEST_GOAL };
    this.target = null;

    const char = buildCharacter(character);
    char.group.position.set(this.town.spawn.x, 0, this.town.spawn.z);
    this.scene.add(char.group);
    const maxHp = 200 + character.level * 40;
    const maxMp = 80 + character.level * 15;
    this.hero = { character, char, group: char.group, rot: 0, moving: false, hp: maxHp, maxHp, mp: maxMp, maxMp };

    this.dummies = [makeDummy(this.scene, -7, 2.5), makeDummy(this.scene, -7, -1.5)];

    this.camPos.set(this.hero.group.position.x, 9.5, this.hero.group.position.z + 12);
    buildHud();
    this.resetFloats();
    addChat('ระบบ', 'ยินดีต้อนรับสู่ ดินแดนสวรรค์!');
    addChat('ระบบ', 'WASD / ลูกศร เดิน · คลิกพื้นเพื่อเดินไป · กดเลข 1-6 ใช้สกิล · Enter พิมพ์แชต');

    this.bindInput();
    showGameScreen();
    Stage.use(this);
  },

  resetFloats() {
    for (const f of this.floats) f.el.remove();
    this.floats = [];
  },

  bindInput() {
    if (this.bound) return;
    this.bound = true;

    window.addEventListener('keydown', (e) => {
      if (!$('game').classList.contains('active')) return;
      const chat = $('chat-input');
      if (document.activeElement === chat) {
        if (e.key === 'Enter') sendChat();
        if (e.key === 'Escape') { chat.blur(); chat.classList.remove('show'); }
        return;
      }
      if (e.key === 'Enter') { chat.classList.add('show'); chat.focus(); e.preventDefault(); return; }
      if (e.key === 'Escape') { closeWindow(); return; }
      this.keys[e.key.toLowerCase()] = true;
      if (/^[1-6]$/.test(e.key)) this.useSkill(Number(e.key));
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    // click the ground to walk there (raycast onto the y=0 plane)
    const el = Stage.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      if (!this.hero) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.ground, hit)) this.target = hit;
    });

    $('window-close').addEventListener('click', closeWindow);
    $('chat-input').addEventListener('blur', () => {
      setTimeout(() => $('chat-input').classList.remove('show'), 0);
    });
  },

  update(dt, t) {
    this.time = t;
    const h = this.hero;
    if (!h) return;
    const g = h.group;
    const p = g.position;

    // movement: keys first, otherwise walk toward the clicked point
    let ix = 0;
    let iz = 0;
    if (this.keys.a || this.keys.arrowleft) ix -= 1;
    if (this.keys.d || this.keys.arrowright) ix += 1;
    if (this.keys.w || this.keys.arrowup) iz -= 1;
    if (this.keys.s || this.keys.arrowdown) iz += 1;
    if (ix || iz) {
      this.target = null;
    } else if (this.target) {
      const dx = this.target.x - p.x;
      const dz = this.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) this.target = null;
      else { ix = dx / d; iz = dz / d; }
    }

    const len = Math.hypot(ix, iz);
    h.moving = len > 0;
    if (len > 0) {
      ix /= len;
      iz /= len;
      const step = SPEED * dt;
      if (!blocked(this.town.solids, p.x + ix * step, p.z, RADIUS)) p.x += ix * step;
      if (!blocked(this.town.solids, p.x, p.z + iz * step, RADIUS)) p.z += iz * step;
      const r = Math.hypot(p.x, p.z);
      if (r > LIMIT) { p.x *= LIMIT / r; p.z *= LIMIT / r; }
      h.rot = lerpAngle(h.rot, Math.atan2(ix, iz), Math.min(1, dt * 12));
      g.rotation.y = h.rot;
    }

    h.char.update(t, h.moving);
    h.hp = Math.min(h.maxHp, h.hp + 2 * dt);
    h.mp = Math.min(h.maxMp, h.mp + 4 * dt);

    for (const d of this.dummies) d.update(this.camera, dt);
    this.town.update(t, dt);
    this.fx.update(dt);

    // third-person camera that follows the hero
    const look = new THREE.Vector3(p.x, 1.0, p.z);
    const desired = new THREE.Vector3(p.x, 9.5, p.z + 12);
    this.camPos.lerp(desired, Math.min(1, dt * 5));
    this.camera.position.copy(this.camPos);
    if (performance.now() < this.shakeUntil) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
    }
    this.camera.lookAt(look);

    this.updateFloats();

    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      updateHud(this);
    }
    this.portraitTimer += dt;
    if (this.portraitTimer > 1.5) {
      this.portraitTimer = 0;
      drawPortrait(this.hero.character);
    }
  },

  useSkill(key) {
    const h = this.hero;
    const s = this.skills.find((x) => x.key === key);
    if (!h || !s) return;
    const now = performance.now();
    if ((this.cooldowns[s.id] || 0) > now) return;
    if (h.mp < s.mp) { showToast('MP ไม่พอ'); return; }
    h.mp -= s.mp;
    this.cooldowns[s.id] = now + s.cooldown;

    const p = h.group.position;
    const dir = { x: Math.sin(h.rot), z: Math.cos(h.rot) };
    const rangeU = Math.max(1, s.range / UNIT);
    this.fx.spawn(s.fx, new THREE.Vector3(p.x, 1.0, p.z), dir, rangeU);
    if (s.fx.shake) {
      this.shakeAmt = s.fx.shake * 0.02;
      this.shakeUntil = now + 200;
    }

    if (s.fx.type === 'heal') {
      h.hp = Math.min(h.maxHp, h.hp + 60);
      this.floatText(p.x, 2.4, p.z, '+60', '#7dff9b', true);
      return;
    }
    if (s.damage <= 0) return;

    let hits = 0;
    for (const d of this.dummies) {
      if (d.hp <= 0) continue;
      const dx = d.x - p.x;
      const dz = d.z - p.z;
      const dist = Math.hypot(dx, dz);
      const inFront = (dx * dir.x + dz * dir.z) / (dist || 1) > -0.3;
      if (dist <= rangeU + 0.6 && (inFront || dist < 1.2)) {
        const crit = Math.random() < 0.2;
        const dmg = Math.round(s.damage * (crit ? 1.8 : 1) * (0.9 + Math.random() * 0.2));
        d.hit(dmg);
        this.floatText(d.x, 2.7, d.z, (crit ? 'Crit! ' : '') + dmg, crit ? '#ffd166' : '#ffffff', crit);
        if (d.hp <= 0) this.floatText(d.x, 3.3, d.z, 'ล้มแล้ว!', '#ffb3c1', true);
        hits++;
      }
    }
    if (hits) {
      this.quest.hits = Math.min(this.quest.goal, this.quest.hits + 1);
      if (this.quest.hits === this.quest.goal) addChat('ระบบ', 'เควสสำเร็จ: เจตนารมณ์แห่งสวรรค์ (ฝึกฝนครบ)');
    }
  },

  floatText(x, y, z, str, color, big) {
    const el = document.createElement('div');
    el.className = 'float' + (big ? ' big' : '');
    el.style.color = color;
    el.textContent = str;
    $('float-layer').appendChild(el);
    this.floats.push({ el, pos: new THREE.Vector3(x, y, z), born: performance.now() });
  },

  updateFloats() {
    const now = performance.now();
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    this.floats = this.floats.filter((f) => {
      const age = (now - f.born) / 900;
      if (age >= 1) { f.el.remove(); return false; }
      const v = f.pos.clone().project(this.camera);
      f.el.style.left = ((v.x + 1) / 2) * w + 'px';
      f.el.style.top = ((1 - v.y) / 2) * hgt - age * 40 + 'px';
      f.el.style.opacity = String(1 - age);
      return true;
    });
  },
};

async function loadSkills(classId) {
  const byId = new Map((DEFAULT_SKILLS[classId] || []).map((s) => [s.id, s]));
  try {
    const data = await API.get('/api/skills?classId=' + encodeURIComponent(classId));
    for (const s of data.skills || []) byId.set(s.id, s);
  } catch { /* offline: defaults only */ }
  return [...byId.values()].sort((a, b) => a.key - b.key);
}

// Straw training dummy with a red HP bar that always faces the camera.
function makeDummy(scene, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a32' });
  const straw = new THREE.MeshStandardMaterial({ color: '#f3d27a' });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 10), wood);
  post.position.y = 0.7;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.18), wood);
  bar.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), straw);
  head.position.y = 1.85;
  group.add(post, bar, head);
  post.castShadow = head.castShadow = bar.castShadow = true;

  const hpGroup = new THREE.Group();
  hpGroup.position.y = 2.6;
  group.add(hpGroup);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: '#000' }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.1), new THREE.MeshBasicMaterial({ color: '#ff5a6e' }));
  fill.position.z = 0.01;
  hpGroup.add(back, fill);

  const d = {
    x,
    z,
    hp: 300,
    maxHp: 300,
    downT: 0,
    hurtT: 0,
    hit(dmg) {
      this.hp -= dmg;
      this.hurtT = 0.25;
      if (this.hp <= 0) this.downT = 0;
    },
    update(camera, dt) {
      hpGroup.quaternion.copy(camera.quaternion);
      const frac = Math.max(0, this.hp / this.maxHp);
      fill.scale.x = Math.max(0.001, frac);
      fill.position.x = -0.6 * (1 - frac);
      if (this.hp <= 0) {
        group.visible = false;
        this.downT += dt;
        if (this.downT > 3) { this.hp = this.maxHp; group.visible = true; }
      }
      if (this.hurtT > 0) {
        this.hurtT -= dt;
        head.position.x = Math.sin(this.hurtT * 60) * 0.06;
      } else {
        head.position.x = 0;
      }
    },
  };
  return d;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ---------- HUD ----------
function showGameScreen() {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'game'));
}

function buildHud() {
  const h = Game.hero;
  const tr = $('hud-topright');
  tr.innerHTML = '';
  for (const m of HUD_TOP_MENUS) tr.appendChild(menuButton(m));

  const bl = $('hud-bottomleft');
  bl.innerHTML = '';
  for (const m of HUD_BOTTOM_MENUS) bl.appendChild(menuButton(m));

  const sk = $('hud-skills');
  sk.innerHTML = '';
  for (let i = 1; i <= 6; i++) {
    const s = Game.skills.find((x) => x.key === i);
    const b = document.createElement('button');
    b.className = 'skill-slot' + (s ? '' : ' empty');
    b.dataset.slot = i;
    b.innerHTML = `<span class="k">${i}</span><span class="ico">${s ? s.icon : '·'}</span>` +
      `<span class="name">${s ? escapeHtml(s.name) : 'ว่าง'}</span><span class="cd"></span>`;
    b.addEventListener('click', () => Game.useSkill(i));
    sk.appendChild(b);
  }

  $('hud-name').textContent = h.character.name;
  $('hud-lv').textContent = 'Lv.' + h.character.level;
  $('hud-class').textContent = CLASSES[h.character.classId].name;
  drawPortrait(h.character);
}

function drawPortrait(character) {
  const c = $('portrait');
  drawThumb(c.getContext('2d'), character, 0, 0, c.width, c.height);
}

function menuButton(m) {
  const b = document.createElement('button');
  b.className = 'icon-btn';
  b.innerHTML = `<span class="ico">${m.icon}</span><span>${m.label}</span>`;
  b.addEventListener('click', () => openMenu(m.id));
  return b;
}

function openMenu(id) {
  const label = [...HUD_TOP_MENUS, ...HUD_BOTTOM_MENUS].find((m) => m.id === id)?.label || '';
  const h = Game.hero;
  let body;
  if (id === 'status') {
    const c = h.character;
    body = `<table>
      <tr><td>ชื่อ</td><td>${escapeHtml(c.name)}</td></tr>
      <tr><td>อาชีพ</td><td>${CLASSES[c.classId].name}</td></tr>
      <tr><td>เลเวล</td><td>${c.level}</td></tr>
      <tr><td>HP</td><td>${Math.round(h.hp)} / ${h.maxHp}</td></tr>
      <tr><td>MP</td><td>${Math.round(h.mp)} / ${h.maxMp}</td></tr></table>`;
  } else if (id === 'skill') {
    body = Game.skills.length
      ? '<table>' + Game.skills.map((s) => `<tr><td>${s.icon} ${escapeHtml(s.name)}</td><td>ปุ่ม ${s.key} · ${(s.cooldown / 1000).toFixed(1)}s · MP ${s.mp}</td></tr>`).join('') + '</table>'
      : '<div class="empty-note">ยังไม่มีสกิลสำหรับอาชีพนี้</div>';
  } else if (id === 'quest') {
    body = `<table><tr><td>📜 เส้นหลัก: เจตนารมณ์แห่งสวรรค์</td><td>${Game.quest.hits}/${Game.quest.goal}</td></tr></table>`;
  } else {
    body = `<div class="empty-note">${label} · อยู่ระหว่างพัฒนา</div>`;
  }
  openWindow(label, body);
}

function openWindow(title, html) {
  $('window-title').textContent = title;
  $('window-body').innerHTML = html;
  $('window').hidden = false;
}

function closeWindow() {
  $('window').hidden = true;
}

function addChat(who, msg) {
  const log = $('chat-log');
  const d = document.createElement('div');
  d.innerHTML = `<b>${escapeHtml(who)}:</b> ${escapeHtml(msg)}`;
  log.appendChild(d);
  while (log.children.length > 6) log.removeChild(log.firstChild);
}

function sendChat() {
  const input = $('chat-input');
  const text = input.value.trim();
  input.value = '';
  input.classList.remove('show');
  input.blur();
  if (text && Game.hero) addChat(Game.hero.character.name, text);
}

let toastTimer = 0;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
}

function updateHud(g) {
  const h = g.hero;
  $('bar-hp').style.width = (h.hp / h.maxHp) * 100 + '%';
  $('bar-mp').style.width = (h.mp / h.maxMp) * 100 + '%';
  $('txt-hp').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
  $('txt-mp').textContent = `${Math.ceil(h.mp)} / ${h.maxMp}`;
  $('quest-step').textContent = `ฝึกฝนกับหุ่นฝึก ${Math.min(g.quest.hits, g.quest.goal)}/${g.quest.goal}`;

  const now = performance.now();
  document.querySelectorAll('.skill-slot[data-slot]').forEach((el) => {
    const s = g.skills.find((x) => x.key === Number(el.dataset.slot));
    if (!s) return;
    const left = (g.cooldowns[s.id] || 0) - now;
    el.classList.toggle('cooling', left > 0);
    el.querySelector('.cd').textContent = left > 0 ? (left / 1000).toFixed(1) : '';
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export { showToast };
