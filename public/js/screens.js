import { API } from './api.js';
import { DEFAULT_APPEARANCE } from './config.js';
import { Stage } from './stage.js';
import { Menu } from './menu.js';
import { Game } from './game.js';
import { mountDesigner } from './designer.js';
import { drawThumb } from './thumb.js';
import { createPortal } from './portal.js';

// Screen flow: splash -> login -> character select -> creator -> enter loader -> world.
const $ = (id) => document.getElementById(id);
const MAX_CHARACTERS = 3;
const DEMO = { gender: 'male', classId: 'swordsman', appearance: DEFAULT_APPEARANCE };

let characters = [];
let selectedIdx = 0;
let googleTried = false;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

// ---------- splash ----------
const TIPS = [
  'กดเลข 1-6 เพื่อใช้สกิลได้ทันที',
  'คลิกพื้นเพื่อให้ตัวละครเดินไปยังจุดนั้น',
  'ออกแบบสกิลและเอฟเฟกต์ได้ที่ Skill Lab',
  'ชนะหุ่นฝึกเพื่อทำเควส "เจตนารมณ์แห่งสวรรค์"',
];

function runSplash() {
  return new Promise((resolve) => {
    const bar = $('splash-bar');
    const tip = $('splash-tip');
    const start = performance.now();
    const dur = 2600;
    let i = 0;
    const tipTimer = setInterval(() => { tip.textContent = TIPS[i++ % TIPS.length]; }, 900);
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur);
      bar.style.width = (k * 100).toFixed(1) + '%';
      if (k < 1) requestAnimationFrame(tick);
      else {
        clearInterval(tipTimer);
        setTimeout(resolve, 250);
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
    slot.innerHTML = '<button class="btn-ghost wide" disabled>Google Login (ยังไม่ได้ตั้งค่า)</button>';
    $('login-hint').textContent = API.local
      ? 'โหมดออฟไลน์: ข้อมูลเก็บในเบราว์เซอร์นี้'
      : 'ตั้งค่า GOOGLE_CLIENT_ID เพื่อเปิด Google Login';
    return;
  }
  if (googleTried) return;
  googleTried = true;
  let tries = 0;
  const tryInit = () => {
    if (window.google?.accounts?.id) {
      google.accounts.id.initialize({ client_id: clientId, callback: onGoogle });
      google.accounts.id.renderButton(slot, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 280 });
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
async function showCharSelect() {
  try {
    characters = (await API.get('/api/characters')).characters;
  } catch (e) {
    if (e.status === 401) return showLogin();
    $('charselect-error').textContent = e.message;
  }
  if (selectedIdx >= characters.length) selectedIdx = 0;
  renderCharList();
  if (characters[selectedIdx]) Menu.setCharacter(characters[selectedIdx]);
  else Menu.setCharacter(DEMO);
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
      info.innerHTML = `<b></b><span class="cls"></span><span class="lv">Lv.${c.level}</span>`;
      info.querySelector('b').textContent = c.name;
      info.querySelector('.cls').textContent = className(c.classId);
      card.appendChild(info);
      card.addEventListener('click', () => {
        selectedIdx = i;
        renderCharList();
        Menu.setCharacter(c);
      });
      card.addEventListener('dblclick', () => enterWorld(c));
    } else {
      card.className = 'char-card empty';
      card.textContent = '+ สร้างตัวละคร';
      card.addEventListener('click', () => (characters.length < MAX_CHARACTERS ? openCreator() : null));
    }
    list.appendChild(card);
  }
}

function className(id) {
  return { swordsman: 'นักดาบ', assassin: 'นักฆ่า', mage: 'นักเวทย์', priest: 'นักพรต' }[id] || id;
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

function freshCreatorState() {
  return { name: '', gender: 'male', classId: 'swordsman', appearance: structuredClone(DEFAULT_APPEARANCE) };
}

function openCreator() {
  cstate = freshCreatorState();
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
      name,
      gender: cstate.gender,
      classId: cstate.classId,
      appearance: cstate.appearance,
    });
    selectedIdx = characters.length;
    enterWorld(data.character);
  } catch (e) {
    if (e.status === 401) return showLogin();
    creatorError(e.message);
  }
}

// ---------- enter-world loader ----------
async function enterWorld(character) {
  show('enter-loader');
  $('enter-title').textContent = `กำลังเข้าสู่ ดินแดนสวรรค์`;
  const portal = createPortal(character);
  Stage.use(portal);

  let i = 0;
  $('enter-tip').textContent = TIPS[0];
  const tipTimer = setInterval(() => { $('enter-tip').textContent = TIPS[++i % TIPS.length]; }, 900);

  const start = performance.now();
  const dur = 2800;
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
  $('btn-delete-char').addEventListener('click', deleteSelected);
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
