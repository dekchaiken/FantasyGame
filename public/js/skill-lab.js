import * as THREE from 'three';
import { Effects } from './effects.js';
import { API } from './api.js';
import { CLASSES, DEFAULT_SKILLS } from './config.js';
import { buildCharacter } from './character.js';
import { icon, ICON_NAMES } from './icons.js';

// Skill Lab: design a skill and its 3D effect, preview it live, save it to the server (or this browser).
const $ = (id) => document.getElementById(id);
const UNIT = 40;
let skills = [];
let current = null;
let previewDir = { x: 1, z: 0 };

// ---------- 3D preview ----------
const canvas = $('lab-preview');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0c1430');
scene.add(new THREE.HemisphereLight('#dbe8ff', '#3a5a3a', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 1.3);
sun.position.set(4, 8, 6);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ color: '#2f5a3f' }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 3.4, 7.4);
camera.lookAt(0, 1.0, 0);
const fx = new Effects(scene);
const dummy = buildCharacter({ gender: 'male', classId: 'swordsman' });
dummy.group.position.set(2.6, 0, 0);
dummy.group.rotation.y = Math.PI;
scene.add(dummy.group);
let nextAt = 0;

function resizePreview() {
  const w = canvas.clientWidth || 520;
  const h = canvas.clientHeight || 300;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizePreview);
resizePreview();

function replay() {
  if (!current) return;
  fx.clear();
  fx.spawn(current.fx, new THREE.Vector3(0, 1.0, 0), previewDir, Math.max(1, current.range / UNIT));
  nextAt = performance.now() + current.fx.duration + 800;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (now >= nextAt && current) replay();
  fx.update(dt);
  dummy.update(now / 1000, false);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- list & form ----------
const FIELDS = { name: 'f-name', classId: 'f-class', key: 'f-key', reqLv: 'f-reqlv', cooldown: 'f-cooldown', mp: 'f-mp', mult: 'f-mult', heal: 'f-heal', range: 'f-range' };
const FX_FIELDS = { type: 'f-type', duration: 'f-duration', color: 'f-color', color2: 'f-color2', count: 'f-count', size: 'f-size', speed: 'f-speed', shake: 'f-shake' };

function blankSkill(classId = 'swordsman') {
  return {
    id: '', classId, name: 'สกิลใหม่', icon: 'star', key: 1, reqLv: 1, cooldown: 1000, mp: 5, mult: 1, heal: 0, range: 120, aoe: false,
    fx: { type: 'burst', color: '#5ee7ff', color2: '#ffffff', count: 24, size: 8, duration: 600, speed: 220, shake: 0 },
  };
}

async function loadSkills() {
  const defaults = Object.values(DEFAULT_SKILLS).flat().map((s) => ({ ...s, _builtin: true }));
  let server = [];
  try { server = (await API.get('/api/skills')).skills; } catch { /* offline: defaults only */ }
  const byId = new Map(defaults.map((s) => [s.id, s]));
  for (const s of server) byId.set(s.id, s);
  skills = [...byId.values()];
}

function fillSelects() {
  const ids = Object.keys(CLASSES);
  $('f-class').innerHTML = ids.map((c) => `<option value="${c}">${CLASSES[c].name}</option>`).join('');
  $('f-filter').innerHTML = '<option value="">ทุกอาชีพ</option>' + ids.map((c) => `<option value="${c}">${CLASSES[c].name}</option>`).join('');
  $('f-icon').innerHTML = ICON_NAMES.map((n) => `<button type="button" data-icon="${n}" title="${n}">${icon(n)}</button>`).join('');
  $('f-icon').addEventListener('click', (e) => {
    const b = e.target.closest('[data-icon]');
    if (!b) return;
    setIcon(b.dataset.icon);
  });
}

function setIcon(name) {
  for (const b of $('f-icon').querySelectorAll('[data-icon]')) b.classList.toggle('on', b.dataset.icon === name);
  if (current) current.icon = name;
}

function renderList() {
  const filter = $('f-filter').value;
  const list = $('skill-list');
  list.innerHTML = '';
  for (const s of skills.filter((x) => !filter || x.classId === filter)) {
    const el = document.createElement('div');
    el.className = 'skill-item' + (current && current.id === s.id ? ' on' : '');
    el.innerHTML = `<span class="ico-box">${icon(s.icon)}</span><div><b></b><small></small></div>`;
    el.querySelector('b').textContent = s.name;
    el.querySelector('small').textContent = `${CLASSES[s.classId].name} · ปุ่ม ${s.key} · Lv ${s.reqLv || 1}${s._builtin ? ' · ค่าเริ่มต้น' : ''}`;
    el.addEventListener('click', () => select(s));
    list.appendChild(el);
  }
}

function select(s) {
  current = JSON.parse(JSON.stringify(s));
  current._builtin = !!s._builtin;
  writeForm();
  renderList();
  $('save-msg').textContent = '';
  $('save-err').textContent = '';
}

function writeForm() {
  const s = current;
  for (const [k, id] of Object.entries(FIELDS)) $(id).value = s[k] ?? '';
  $('f-aoe').checked = !!s.aoe;
  for (const [k, id] of Object.entries(FX_FIELDS)) $(id).value = s.fx[k];
  setIcon(s.icon);
  syncLabels();
  replay();
}

function readForm() {
  const num = (id) => Number($(id).value);
  current.name = $('f-name').value.trim();
  current.classId = $('f-class').value;
  current.key = num('f-key');
  current.reqLv = num('f-reqlv');
  current.cooldown = num('f-cooldown');
  current.mp = num('f-mp');
  current.mult = num('f-mult');
  current.heal = num('f-heal');
  current.range = num('f-range');
  current.aoe = $('f-aoe').checked;
  current.fx = {
    type: $('f-type').value,
    duration: num('f-duration'),
    color: $('f-color').value,
    color2: $('f-color2').value,
    count: num('f-count'),
    size: num('f-size'),
    speed: num('f-speed'),
    shake: num('f-shake'),
  };
  return current;
}

function syncLabels() {
  $('v-count').textContent = $('f-count').value;
  $('v-size').textContent = $('f-size').value;
  $('v-speed').textContent = $('f-speed').value;
  $('v-shake').textContent = $('f-shake').value;
}

async function save(e) {
  e.preventDefault();
  $('save-msg').textContent = '';
  $('save-err').textContent = '';
  readForm();
  if (!current.name) { $('save-err').textContent = 'ต้องใส่ชื่อสกิล'; return; }
  const body = { ...current };
  delete body._builtin;
  if (!body.id) body.id = 'sk_' + Date.now().toString(36);
  try {
    const data = await API.post('/api/skills', body);
    const saved = { ...data.skill };
    const i = skills.findIndex((s) => s.id === saved.id);
    if (i >= 0) skills[i] = saved; else skills.push(saved);
    current = { ...saved };
    $('save-msg').textContent = 'บันทึกแล้ว · ใช้ในเกมเมื่อเข้าโลกครั้งถัดไป';
    renderList();
  } catch (err) {
    $('save-err').textContent = err.message;
  }
}

async function remove() {
  if (!current || !current.id) return;
  if (!confirm(`ลบสกิล "${current.name}" ?`)) return;
  try {
    await API.del('/api/skills/' + current.id);
    await loadSkills();
    select(skills[0] || blankSkill());
    $('save-msg').textContent = 'ลบแล้ว';
  } catch (err) {
    $('save-err').textContent = err.message;
  }
}

function resetDefault() {
  if (!current) return;
  const def = Object.values(DEFAULT_SKILLS).flat().find((s) => s.id === current.id);
  if (!def) { $('save-err').textContent = 'สกิลนี้ไม่มีค่าเริ่มต้น'; return; }
  select({ ...def, _builtin: true });
}

async function boot() {
  await API.init();
  fillSelects();
  await loadSkills();
  renderList();
  select(skills[0] || blankSkill());

  $('f-filter').addEventListener('change', renderList);
  $('btn-new').addEventListener('click', () => select(blankSkill($('f-filter').value || 'swordsman')));
  $('btn-delete').addEventListener('click', remove);
  $('btn-reset').addEventListener('click', resetDefault);
  $('btn-replay').addEventListener('click', replay);
  $('f-dir').addEventListener('change', () => {
    const [x, z] = $('f-dir').value.split(',').map(Number);
    previewDir = { x, z };
    replay();
  });
  $('form').addEventListener('submit', save);
  for (const id of ['f-count', 'f-size', 'f-speed', 'f-shake']) $(id).addEventListener('input', syncLabels);
  for (const id of Object.values(FX_FIELDS)) $(id).addEventListener('change', replay);
  requestAnimationFrame(frame);
}

boot();
