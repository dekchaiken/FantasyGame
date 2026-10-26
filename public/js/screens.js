import { API } from './api.js';
import { CLASSES, DEFAULT_APPEARANCE } from './config.js';
import { MAPS } from './data.js';
import { Stage } from './stage.js';
import { Menu } from './menu.js';
import { Game } from './game.js';
import { mountDesigner } from './designer.js';
import { drawThumb } from './thumb.js';
import { createPortal } from './portal.js';
import { icon } from './icons.js';

// Screen flow: splash -> login -> character select -> creator -> enter loader -> world.
const $ = (id) => document.getElementById(id);
const MAX_CHARACTERS = 3;
const DEMO = { gender: 'male', classId: 'swordsman', appearance: DEFAULT_APPEARANCE };
const TIPS = [
  'กด 1-6 ใช้สกิล · Space โจมตีเป้าหมายที่ใกล้ที่สุด · Q ใช้ยาฟื้นพลัง',
  'กด T เปิดออโต้ ตัวละครจะล่ามอนสเตอร์ใกล้ตัวให้เอง',
  'เดินเข้าพอร์ทเพื่อย้ายแมพ เหมืองลาวาร้อนต้องเลเวล 8 ขึ้นไป',
  'คุยกับ NPC ที่มีเครื่องหมายสีทองเพื่อรับภารกิจ',
];

let characters = [];
let servers = [];
let serverId = null;
let selectedIdx = 0;
let googleTried = false;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

// ---------- splash ----------
function runSplash() {
  return new Promise((resolve) => {
    const bar = $('splash-bar');
    const tip = $('splash-tip');
    const start = performance.now();
    const dur = 2400;
    let i = 0;
    const tipTimer = setInterval(() => { tip.textContent = TIPS[i++ % TIPS.length]; }, 1000);
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur);
      bar.style.width = (k * 100).toFixed(1) + '%';
      if (k < 1) requestAnimationFrame(tick);
      else {
        clearInterval(tipTimer);
        setTimeout(resolve, 200);
      }
    };
    requestAnimationFrame(tick);
  });
}

// ---------- login ----------
function loginError(msg) {
  $('login-error').textContent = msg || '';
}

function loadGoogle() {
  const slot = $('google-btn');
  const clientId = API.config?.googleClientId;
  if (!clientId) {
    slot.innerHTML = '<button class="btn-ghost wide" disabled>เข้าสู่ระบบด้วย Google (ยังไม่เปิดใช้งาน)</button>';
    $('login-hint').textContent = API.local ? 'โหมดออฟไลน์: บันทึกข้อมูลในเบราว์เซอร์นี้' : 'ตั้งค่า GOOGLE_CLIENT_ID เพื่อเปิดใช้งาน';
    return;
  }
  if (googleTried) return;
  googleTried = true;
  let tries = 0;
  const tryInit = () => {
    if (window.google?.accounts?.id) {
      google.accounts.id.initialize({ client_id: clientId, callback: onGoogle });
      google.accounts.id.renderButton(slot, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 300 });
    } else if (tries++ < 40) {
      setTimeout(tryInit, 150);
    } else {
      slot.innerHTML = '<span class="hint">โหลด Google ไม่สำเร็จ</span>';
    }
  };
  tryInit();
}

async function onGoogle(resp) {
  loginError('');
  try {
    const data = await API.post('/api/auth/google', { credential: resp.credential });
    API.setToken(data.token);
    await showCharSelect();
  } catch (e) {
    loginError(e.message);
  }
}

async function guestLogin() {
  loginError('');
  try {
    const data = await API.post('/api/auth/guest');
    API.setToken(data.token);
    await showCharSelect();
  } catch (e) {
    loginError(e.message);
  }
}

function showLogin() {
  API.setToken(null);
  loginError('');
  Menu.setCharacter(DEMO);
  Menu.setView('login');
  Stage.use(Menu);
  show('login');
}

// ---------- character select ----------
// Server picker: the server chosen last time when it is still listed, else the first open one.
async function loadServers() {
  servers = (await API.get('/api/servers')).servers;
  const saved = localStorage.getItem('sr_server');
  const pick = servers.find((s) => s.id === saved) || servers.find((s) => s.status === 'open') || servers[0];
  serverId = pick ? pick.id : null;
  $('server-select').innerHTML = servers.map((s) =>
    `<option value="${s.id}" ${s.id === serverId ? 'selected' : ''}>${s.name} · ${s.status === 'open' ? 'เปิด' : s.status === 'maintenance' ? 'ปรับปรุง' : 'ปิด'} (${s.population})</option>`).join('');
}

async function loadAnnouncements() {
  const { announcements } = await API.get('/api/announcements?server=' + encodeURIComponent(serverId || ''));
  $('announce').hidden = !announcements.length;
  $('announce').innerHTML = announcements.map((a) => `<div class="announce-item"><b>${escHtml(a.title)}</b><p>${escHtml(a.body)}</p></div>`).join('');
}

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function showCharSelect() {
  try {
    await loadServers();
    loadAnnouncements().catch(() => {});
    characters = (await API.get('/api/characters?server=' + encodeURIComponent(serverId || ''))).characters;
  } catch (e) {
    if (e.status === 401) return showLogin();
    $('charselect-error').textContent = e.message;
  }
  if (selectedIdx >= characters.length) selectedIdx = 0;
  renderCharList();
  Menu.setCharacter(characters[selectedIdx] || DEMO);
  Menu.setView('select');
  Stage.use(Menu);
  show('charselect');
  $('btn-start').disabled = !characters.length;
  $('btn-delete-char').disabled = !characters.length;
}

function renderCharList() {
  const list = $('char-list');
  list.innerHTML = '';
  const slots = Math.min(MAX_CHARACTERS, characters.length + 1);
  for (let i = 0; i < slots; i++) {
    const c = characters[i];
    const card = document.createElement('div');
    if (c) {
      card.className = 'char-card' + (i === selectedIdx ? ' selected' : '');
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 120;
      drawThumb(canvas.getContext('2d'), c, 0, 0, 120, 120);
      card.appendChild(canvas);
      const info = document.createElement('div');
      info.className = 'char-info';
      const lv = c.progress?.level || 1;
      const map = MAPS[c.progress?.map || 'town']?.name || '';
      info.innerHTML = `<b></b><span class="cls"></span><span class="map"></span><span class="lv"></span>`;
      info.querySelector('b').textContent = c.name;
      info.querySelector('.cls').textContent = CLASSES[c.classId].name;
      info.querySelector('.map').textContent = map;
      info.querySelector('.lv').textContent = 'LV ' + lv;
      card.appendChild(info);
      card.addEventListener('click', () => {
        selectedIdx = i;
        renderCharList();
        Menu.setCharacter(c);
      });
      card.addEventListener('dblclick', () => enterWorld(c));
    } else {
      card.className = 'char-card empty';
      card.innerHTML = `${icon('plus')}<span>สร้างตัวละคร</span>`;
      card.addEventListener('click', () => (characters.length < MAX_CHARACTERS ? openCreator() : null));
    }
    list.appendChild(card);
  }
}

async function deleteSelected() {
  const c = characters[selectedIdx];
  if (!c || !confirm(`ลบตัวละคร "${c.name}" ? การลบนี้กู้คืนไม่ได้`)) return;
  try {
    await API.del('/api/characters/' + c.id);
    selectedIdx = 0;
    await showCharSelect();
  } catch (e) {
    $('charselect-error').textContent = e.message;
  }
}

// ---------- creator ----------
let cstate = null;

function openCreator() {
  cstate = { name: '', gender: 'male', classId: 'swordsman', appearance: structuredClone(DEFAULT_APPEARANCE) };
  Menu.setCharacter(cstate);
  Menu.setView('creator');
  Stage.use(Menu);
  mountDesigner($('designer'), {
    state: cstate,
    showName: true,
    backText: 'ย้อนกลับ',
    confirmText: 'สร้างตัวละคร',
    onChange: (s) => Menu.setCharacter(s),
    onBack: () => showCharSelect(),
    onConfirm: createCharacter,
  });
  show('creator');
}

function creatorError(msg) {
  const el = document.querySelector('#designer .d-error');
  if (el) el.textContent = msg;
}

async function createCharacter() {
  const name = (cstate.name || '').trim();
  creatorError('');
  if (name.length < 2) return creatorError('ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
  try {
    const data = await API.post('/api/characters', {
      serverId,
      name,
      gender: cstate.gender,
      classId: cstate.classId,
      appearance: cstate.appearance,
    });
    characters.push(data.character);
    selectedIdx = characters.length - 1;
    enterWorld(data.character);
  } catch (e) {
    if (e.status === 401) return showLogin();
    creatorError(e.message);
  }
}

// ---------- enter-world loader ----------
async function enterWorld(character) {
  show('enter-loader');
  $('enter-title').textContent = `กำลังเข้าสู่ ${MAPS[character.progress?.map || 'town'].name}`;
  const portal = createPortal(character);
  Stage.use(portal);

  let i = 0;
  $('enter-tip').textContent = TIPS[0];
  const tipTimer = setInterval(() => { $('enter-tip').textContent = TIPS[++i % TIPS.length]; }, 1100);

  const start = performance.now();
  const dur = 2600;
  await new Promise((resolve) => {
    const frame = (now) => {
      const k = Math.min(1, (now - start) / dur);
      portal.state.progress = k;
      $('enter-bar').style.width = k * 100 + '%';
      if (k < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
  clearInterval(tipTimer);
  await Game.start(character);
}

async function backToSelect() {
  await Game.leave();
  await showCharSelect();
}

async function logout() {
  try { await API.post('/api/auth/logout'); } catch { /* ignore */ }
  showLogin();
}

// ---------- boot ----------
async function boot() {
  await API.init();
  Stage.init($('bg-canvas'));

  $('btn-guest').addEventListener('click', guestLogin);
  $('btn-logout').addEventListener('click', logout);
  $('btn-start').addEventListener('click', () => characters[selectedIdx] && enterWorld(characters[selectedIdx]));
  $('server-select').addEventListener('change', (e) => {
    serverId = e.target.value;
    localStorage.setItem('sr_server', serverId);
    selectedIdx = 0;
    showCharSelect();
  });
  $('btn-delete-char').addEventListener('click', deleteSelected);
  $('btn-back-select').addEventListener('click', backToSelect);
  $('btn-new-char').addEventListener('click', () => (characters.length < MAX_CHARACTERS ? openCreator() : null));

  await runSplash();
  loadGoogle();

  if (API.token) {
    try {
      await API.get('/api/me');
      return showCharSelect();
    } catch {
      API.setToken(null);
    }
  }
  showLogin();
}

boot();
