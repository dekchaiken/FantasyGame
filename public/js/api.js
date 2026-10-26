import { CLASSES } from './config.js';
import { SAVE_VERSION, normalize } from './progress.js';

// Talks to server.js when it is running. When there is no API (static hosting such as Vercel),
// it falls back to the same routes kept in this browser's localStorage.
const LS_DB = 'sr_local_db';
const LS_TOKEN = 'sr_token';

const rid = (p) => p + Math.random().toString(36).slice(2, 10);
const httpErr = (status, message) => Object.assign(new Error(message), { status });
const emptyDb = () => ({ users: [], characters: [], skills: [], sessions: {} });

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_DB)) || emptyDb(); } catch { return emptyDb(); }
}

function saveLocal(db) {
  try { localStorage.setItem(LS_DB, JSON.stringify(db)); } catch { /* storage blocked: data lasts this session */ }
}

function localHandle(method, url, body, token) {
  const db = loadLocal();
  const path = url.pathname;
  const user = token && db.sessions[token] ? db.users.find((u) => u.id === db.sessions[token]) : null;
  const requireUser = () => {
    if (!user) throw httpErr(401, 'กรุณาเข้าสู่ระบบก่อน');
    return user;
  };
  const pub = (u) => ({ id: u.id, name: u.name, type: u.type });

  if (path === '/api/config') {
    return { googleClientId: '', classes: Object.keys(CLASSES), genders: ['male', 'female'], maxCharacters: 3, local: true };
  }
  if (path === '/api/auth/guest' && method === 'POST') {
    const u = { id: rid('u_'), name: 'Guest-' + Math.random().toString(16).slice(2, 6), type: 'guest' };
    const newToken = rid('t_') + rid('');
    db.users.push(u);
    db.sessions[newToken] = u.id;
    saveLocal(db);
    return { token: newToken, user: pub(u) };
  }
  if (path === '/api/auth/logout' && method === 'POST') {
    if (token) delete db.sessions[token];
    saveLocal(db);
    return { ok: true };
  }
  if (path === '/api/me') return { user: pub(requireUser()) };

  if (path === '/api/characters' && method === 'GET') {
    const u = requireUser();
    return { characters: db.characters.filter((c) => c.userId === u.id) };
  }
  if (path === '/api/characters' && method === 'POST') {
    const u = requireUser();
    if (db.characters.filter((c) => c.userId === u.id).length >= 3) throw httpErr(400, 'สร้างตัวละครได้สูงสุด 3 ตัว');
    const name = String(body.name || '').trim().slice(0, 12);
    if (name.length < 2) throw httpErr(400, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร');
    if (db.characters.some((c) => c.name === name)) throw httpErr(400, 'ชื่อนี้ถูกใช้แล้ว');
    const ch = {
      id: rid('c_'),
      userId: u.id,
      name,
      gender: body.gender === 'female' ? 'female' : 'male',
      classId: CLASSES[body.classId] ? body.classId : 'swordsman',
      appearance: body.appearance || {},
      progress: normalize({}),
    };
    db.characters.push(ch);
    saveLocal(db);
    return { character: ch };
  }

  const charMatch = path.match(/^\/api\/characters\/([\w-]+)$/);
  if (charMatch) {
    const u = requireUser();
    const ch = db.characters.find((c) => c.id === charMatch[1] && c.userId === u.id);
    if (!ch) throw httpErr(404, 'ไม่พบตัวละคร');
    if (method === 'DELETE') {
      db.characters = db.characters.filter((c) => c !== ch);
      saveLocal(db);
      return { ok: true };
    }
    if (method === 'PUT') {
      if (body.appearance) ch.appearance = body.appearance;
      if (body.progress) ch.progress = normalize(body.progress);
      saveLocal(db);
    }
    return { character: ch };
  }

  if (path === '/api/skills' && method === 'GET') {
    const cls = url.searchParams.get('classId');
    return { skills: db.skills.filter((s) => !cls || s.classId === cls) };
  }
  if (path === '/api/skills' && method === 'POST') {
    requireUser();
    const s = { ...body, id: body.id || rid('sk_') };
    const i = db.skills.findIndex((x) => x.id === s.id);
    if (i >= 0) db.skills[i] = s; else db.skills.push(s);
    saveLocal(db);
    return { skill: s };
  }
  const skillMatch = path.match(/^\/api\/skills\/([\w-]+)$/);
  if (skillMatch && method === 'DELETE') {
    requireUser();
    db.skills = db.skills.filter((s) => s.id !== skillMatch[1]);
    saveLocal(db);
    return { ok: true };
  }
  throw httpErr(404, 'ไม่พบ API นี้');
}

export const API = {
  token: null,
  local: false,
  config: null,
  version: SAVE_VERSION,

  async init() {
    try { this.token = localStorage.getItem(LS_TOKEN); } catch { this.token = null; }
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('no api');
      this.config = await r.json();
    } catch {
      this.local = true;
      this.config = localHandle('GET', new URL('/api/config', location.origin), undefined, null);
    }
    return this.config;
  },

  setToken(t) {
    this.token = t;
    try {
      if (t) localStorage.setItem(LS_TOKEN, t);
      else localStorage.removeItem(LS_TOKEN);
    } catch { /* storage blocked */ }
  },

  async req(method, path, body) {
    const url = new URL(path, location.origin);
    if (this.local) return localHandle(method, url, body, this.token);
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw httpErr(res.status, data.error || 'HTTP ' + res.status);
    return data;
  },

  get(p) { return this.req('GET', p); },
  post(p, b) { return this.req('POST', p, b ?? {}); },
  put(p, b) { return this.req('PUT', p, b ?? {}); },
  del(p) { return this.req('DELETE', p); },
};
