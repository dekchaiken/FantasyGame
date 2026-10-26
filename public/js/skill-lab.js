import * as THREE from 'three';
import { Effects } from './effects.js';
import { API } from './api.js';
import { CLASSES, DEFAULT_SKILLS } from './config.js';
import { buildCharacter } from './character.js';

// Skill Lab: design a skill and its 3D effect, preview it live, save it to the server (or this browser).
const $ = (id) => document.getElementById(id);
let skills = [];
let current = null;
const UNIT = 40;

// ---------- 3D preview ----------
const canvas = $('lab-preview');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dff4ff');
scene.add(new THREE.HemisphereLight('#ffffff', '#6fae52', 1.6));
const sun = new THREE.DirectionalLight('#fff2d6', 1.4);
sun.position.set(4, 8, 6);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(7, 48), new THREE.MeshStandardMaterial({ color: '#8fd16b' }));
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
let previewDir = { x: 1, z: 0 };

function resizePreview() {
  const w = canvas.clientWidth || 520;
  const h = canvas.clientHeight || 280;
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

// ---------- skill list & form ----------
const FIELDS = { name: 'f-name', icon: 'f-icon', classId: 'f-class', key: 'f-key', cooldown: 'f-cooldown', mp: 'f-mp', damage: 'f-damage', range: 'f-range' };
const FX_FIELDS = { type: 'f-type', duration: 'f-duration', color: 'f-color', color2: 'f-color2', count: 'f-count', size: 'f-size', speed: 'f-speed', shake: 'f-shake' };

function blankSkill(classId = 'swordsman') {
  return {
    id: '', classId, name: 'สกิลใหม่', icon: '✦', key: 1, cooldown: 1000, mp: 5, damage: 20, range: 120,
    fx: { type: 'burst', color: '#ffcc00', color2: '#ffffff', count: 24, size: 8, duration: 600, speed: 220, shake: 0 },
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
}

function renderList() {
  const filter = $('f-filter').value;
  const list = $('skill-list');
  list.innerHTML = '';
  for (const s of skills.filter((x) => !filter || x.classId === filter)) {
    const el = document.createElement('div');
    el.className = 'skill-item' + (current && current.id === s.id ? ' on' : '');
    el.innerHTML = '<span style="font-size:22px"></span><div><b></b><div class="note"></div></div>';
    el.children[0].textContent = s.icon;
    el.querySelector('b').textContent = s.name;
    el.querySelector('.note').textContent = `${CLASSES[s.classId].name} · ปุ่ม ${s.key}${s._builtin ? ' · ค่าเริ่มต้น' : ''}`;
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
  for (const [k, id] of Object.entries(FIELDS)) $(id).value = s[k];
  for (const [k, id] of Object.entries(FX_FIELDS)) $(id).value = s.fx[k];
  syncLabels();
  replay();
}

function readForm() {
  const num = (id) => Number($(id).value);
  current.name = $('f-name').value.trim();
  current.icon = $('f-icon').value.trim() || '✦';
  current.classId = $('f-class').value;
  current.key = num('f-key');
  current.cooldown = num('f-cooldown');
  current.mp = num('f-mp');
  current.damage = num('f-damage');
  current.range = num('f-range');
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
