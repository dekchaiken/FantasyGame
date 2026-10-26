// Game platform server: static files + JSON API. No dependencies (Node 18+).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const MAX_CHARACTERS = 3;
// Admin panel access: set ADMIN_TOKEN to enable it. Without it the admin API refuses every request.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const SERVER_STATUSES = ['open', 'maintenance', 'closed'];
const DAY = 24 * 60 * 60 * 1000;

const CLASS_IDS = ['swordsman', 'assassin', 'mage', 'priest'];
const GENDERS = ['male', 'female'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---------- storage ----------
function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { users: [], characters: [], skills: [], sessions: {} };
  }
}

// Fills in what older saves lack: the first server, server ids on characters, the announcements list.
function migrateDb(d) {
  d.servers ||= [];
  d.announcements ||= [];
  if (!d.servers.length) d.servers.push({ id: 's1', name: 'เซิร์ฟเวอร์ 1', status: 'open', createdAt: Date.now() });
  for (const c of d.characters || []) c.serverId ||= d.servers[0].id;
  return d;
}

let db = migrateDb(loadDb());

function saveDb() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const uid = (prefix) => prefix + crypto.randomBytes(8).toString('hex');

// ---------- helpers ----------
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 200 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function authUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const userId = token && db.sessions[token];
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
}

function requireUser(req, res) {
  const user = authUser(req);
  if (!user) send(res, 401, { error: 'กรุณาเข้าสู่ระบบก่อน' });
  return user;
}

// VIP is granted by the admin with an end date. The server decides it; the client cannot set it.
function refreshVip(ch) {
  if (!ch.progress) return;
  ch.progress.vip = !!ch.vipUntil && Date.now() < ch.vipUntil;
  if (!ch.progress.vip) ch.vipUntil = null;
}

function serverById(id) {
  return db.servers.find((s) => s.id === id) || null;
}

function population(serverId) {
  return db.characters.filter((c) => c.serverId === serverId).length;
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    send(res, 503, { error: 'ยังไม่ได้ตั้งค่า ADMIN_TOKEN ในเซิร์ฟเวอร์' });
    return false;
  }
  const given = Buffer.from(String(req.headers['x-admin-token'] || ''));
  const want = Buffer.from(ADMIN_TOKEN);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    send(res, 401, { error: 'รหัสผู้ดูแลไม่ถูกต้อง' });
    return false;
  }
  return true;
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = userId;
  saveDb();
  return token;
}

function publicUser(u) {
  return { id: u.id, name: u.name, type: u.type };
}

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const clampInt = (v, min, max, def) => {
  const n = Number.isInteger(v) ? v : def;
  return Math.min(max, Math.max(min, n));
};

// Progress rules live in public/js/progress.js and are shared with the client, so the server
// validates saves with exactly the same code. Loaded once at startup (the file is an ES module).
let progressLib = null;
const progressReady = import(path.join(__dirname, 'public', 'js', 'progress.js')).then((m) => { progressLib = m; });

// Keep in sync with public/js/config.js (OPTIONS and DEFAULT_APPEARANCE).
function sanitizeAppearance(a = {}) {
  const part = (p, styles, defColor) => ({
    style: clampInt(p?.style, 0, styles - 1, 0),
    color: isHex(p?.color) ? p.color : defColor,
  });
  return {
    hairStyle: clampInt(a.hairStyle, 0, 5, 0),
    hair: isHex(a.hair) ? a.hair : '#9b7bd9',
    faceStyle: clampInt(a.faceStyle, 0, 3, 0),
    eyeColor: isHex(a.eyeColor) ? a.eyeColor : '#3b6fd8',
    skin: isHex(a.skin) ? a.skin : '#ffe0c8',
    top: part(a.top, 4, '#ffffff'),
    bottom: part(a.bottom, 3, '#6a4fb0'),
    shoes: part(a.shoes, 3, '#4fa3ff'),
    accessory: clampInt(a.accessory, 0, 3, 0),
  };
}

function sanitizeFx(fx = {}) {
  const types = ['burst', 'nova', 'slash', 'projectile', 'beam', 'heal'];
  return {
    type: types.includes(fx.type) ? fx.type : 'burst',
    color: isHex(fx.color) ? fx.color : '#ffcc00',
    color2: isHex(fx.color2) ? fx.color2 : '#ffffff',
    count: clampInt(fx.count, 1, 200, 24),
    size: clampInt(fx.size, 1, 60, 8),
    duration: clampInt(fx.duration, 100, 5000, 600),
    speed: clampInt(fx.speed, 10, 1000, 220),
    shake: clampInt(fx.shake, 0, 20, 0),
  };
}

// Icon names come from public/js/icons.js (SVG, no emoji).
const SKILL_ICONS = ['sword', 'dagger', 'staff', 'book', 'fire', 'snow', 'holy', 'plus', 'slash', 'whirl', 'dash', 'star', 'heart', 'bolt', 'shield', 'gem', 'leaf', 'potion', 'skull', 'portal'];

function sanitizeSkill(s = {}) {
  if (!CLASS_IDS.includes(s.classId)) throw Object.assign(new Error('classId ไม่ถูกต้อง'), { status: 400 });
  const name = clean(s.name, 40);
  if (!name) throw Object.assign(new Error('ต้องใส่ชื่อสกิล'), { status: 400 });
  return {
    id: clean(s.id, 60) || uid('sk_'),
    classId: s.classId,
    name,
    icon: SKILL_ICONS.includes(s.icon) ? s.icon : 'star',
    key: clampInt(s.key, 1, 6, 1),
    cooldown: clampInt(s.cooldown, 100, 60000, 1000),
    mp: clampInt(s.mp, 0, 999, 5),
    damage: clampInt(s.damage, 0, 99999, 10),
    range: clampInt(s.range, 20, 800, 120),
    fx: sanitizeFx(s.fx),
    updatedAt: Date.now(),
  };
}

// ---------- auth ----------
async function verifyGoogleCredential(credential) {
  if (!GOOGLE_CLIENT_ID) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID'), { status: 503 });
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) throw Object.assign(new Error('Google token ไม่ถูกต้อง'), { status: 401 });
  const info = await r.json();
  if (info.aud !== GOOGLE_CLIENT_ID) throw Object.assign(new Error('Google client ไม่ตรงกัน'), { status: 401 });
  return info;
}

// ---------- admin API (requires X-Admin-Token) ----------
async function handleAdmin(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (p === '/api/admin/overview' && m === 'GET') {
    return send(res, 200, {
      servers: db.servers.map((s) => ({ ...s, population: population(s.id) })),
      users: db.users.length,
      characters: db.characters.length,
      announcements: db.announcements.length,
    });
  }

  if (p === '/api/admin/servers' && m === 'POST') {
    const body = await readBody(req);
    const name = clean(body.name, 30);
    if (name.length < 2) return send(res, 400, { error: 'ชื่อเซิร์ฟเวอร์ต้องมีอย่างน้อย 2 ตัวอักษร' });
    const n = db.servers.reduce((max, s) => Math.max(max, Number(s.id.slice(1)) || 0), 0) + 1;
    const server = { id: `s${n}`, name, status: 'open', createdAt: Date.now() };
    db.servers.push(server);
    saveDb();
    return send(res, 201, { server });
  }

  const serverMatch = p.match(/^\/api\/admin\/servers\/(s\d+)$/);
  if (serverMatch) {
    const server = serverById(serverMatch[1]);
    if (!server) return send(res, 404, { error: 'ไม่พบเซิร์ฟเวอร์' });
    if (m === 'PATCH') {
      const body = await readBody(req);
      if (body.name !== undefined) {
        const name = clean(body.name, 30);
        if (name.length < 2) return send(res, 400, { error: 'ชื่อเซิร์ฟเวอร์ต้องมีอย่างน้อย 2 ตัวอักษร' });
        server.name = name;
      }
      if (body.status !== undefined) {
        if (!SERVER_STATUSES.includes(body.status)) return send(res, 400, { error: 'สถานะไม่ถูกต้อง' });
        server.status = body.status;
      }
      saveDb();
      return send(res, 200, { server: { ...server, population: population(server.id) } });
    }
    if (m === 'DELETE') {
      if (population(server.id) > 0) return send(res, 400, { error: 'ต้องย้ายตัวละครออกก่อน (ใช้รวมเซิร์ฟเวอร์)' });
      if (db.servers.length === 1) return send(res, 400, { error: 'ต้องมีเซิร์ฟเวอร์อย่างน้อย 1 เซิร์ฟเวอร์' });
      db.servers = db.servers.filter((s) => s !== server);
      saveDb();
      return send(res, 200, { ok: true });
    }
  }

  // Merge: every character on one server moves to another, then the old server is removed.
  const mergeMatch = p.match(/^\/api\/admin\/servers\/(s\d+)\/merge$/);
  if (mergeMatch && m === 'POST') {
    const from = serverById(mergeMatch[1]);
    const body = await readBody(req);
    const into = serverById(body.into);
    if (!from || !into) return send(res, 404, { error: 'ไม่พบเซิร์ฟเวอร์' });
    if (from === into) return send(res, 400, { error: 'เลือกเซิร์ฟเวอร์ปลายทางคนละเซิร์ฟเวอร์' });
    let moved = 0;
    for (const c of db.characters) {
      if (c.serverId === from.id) { c.serverId = into.id; moved++; }
    }
    db.servers = db.servers.filter((s) => s !== from);
    saveDb();
    return send(res, 200, { moved, into: into.id });
  }

  if (p === '/api/admin/characters' && m === 'GET') {
    const server = url.searchParams.get('server');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const list = db.characters
      .filter((c) => (!server || c.serverId === server) && (!q || c.name.toLowerCase().includes(q)))
      .slice(0, 200)
      .map((c) => {
        const user = db.users.find((u) => u.id === c.userId);
        return {
          id: c.id, name: c.name, classId: c.classId, serverId: c.serverId, userName: user?.name || '?',
          level: c.progress?.level || 1, gold: c.progress?.gold || 0, job: c.progress?.job || null,
          vipUntil: c.vipUntil || null, createdAt: c.createdAt,
        };
      });
    return send(res, 200, { characters: list });
  }

  const charMatch = p.match(/^\/api\/admin\/characters\/([\w-]+)$/);
  if (charMatch) {
    const ch = db.characters.find((c) => c.id === charMatch[1]);
    if (!ch) return send(res, 404, { error: 'ไม่พบตัวละคร' });
    if (m === 'DELETE') {
      db.characters = db.characters.filter((c) => c !== ch);
      saveDb();
      return send(res, 200, { ok: true });
    }
    if (m === 'PATCH') {
      if (!progressLib) return send(res, 503, { error: 'ระบบความคืบหน้ายังไม่พร้อม ลองใหม่อีกครั้ง' });
      const body = await readBody(req);
      const prog = ch.progress || progressLib.normalize({}, ch.classId);
      if (Number.isInteger(body.gold)) prog.gold = Math.max(0, prog.gold + body.gold);
      if (body.mats && typeof body.mats === 'object') {
        for (const [id, n] of Object.entries(body.mats)) {
          if (Number.isInteger(n) && n > 0) prog.mats[id] = Math.min(999, (prog.mats[id] || 0) + n);
        }
      }
      if (Number.isInteger(body.vipDays) && body.vipDays > 0) {
        ch.vipUntil = Math.max(Date.now(), ch.vipUntil || 0) + body.vipDays * DAY;
      }
      if (body.vipOff === true) ch.vipUntil = null;
      ch.progress = progressLib.normalize(prog, ch.classId);
      refreshVip(ch);
      saveDb();
      return send(res, 200, { character: ch });
    }
  }

  if (p === '/api/admin/announcements' && m === 'GET') {
    return send(res, 200, { announcements: db.announcements.sort((a, b) => b.createdAt - a.createdAt) });
  }
  if (p === '/api/admin/announcements' && m === 'POST') {
    const body = await readBody(req);
    const title = clean(body.title, 60);
    const text = clean(body.body, 400);
    if (!title || !text) return send(res, 400, { error: 'ต้องใส่หัวข้อและเนื้อหา' });
    const a = { id: uid('a_'), title, body: text, serverId: body.serverId || null, active: body.active !== false, createdAt: Date.now() };
    db.announcements.push(a);
    saveDb();
    return send(res, 201, { announcement: a });
  }
  const annMatch = p.match(/^\/api\/admin\/announcements\/([\w-]+)$/);
  if (annMatch) {
    const a = db.announcements.find((x) => x.id === annMatch[1]);
    if (!a) return send(res, 404, { error: 'ไม่พบประกาศ' });
    if (m === 'PATCH') {
      const body = await readBody(req);
      if (body.active !== undefined) a.active = !!body.active;
      saveDb();
      return send(res, 200, { announcement: a });
    }
    if (m === 'DELETE') {
      db.announcements = db.announcements.filter((x) => x !== a);
      saveDb();
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'ไม่พบ API ผู้ดูแลนี้' });
}

// ---------- routes ----------
async function handleApi(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  if (p === '/api/config' && m === 'GET') {
    return send(res, 200, { googleClientId: GOOGLE_CLIENT_ID, classes: CLASS_IDS, genders: GENDERS, maxCharacters: MAX_CHARACTERS });
  }

  if (p === '/api/auth/guest' && m === 'POST') {
    const user = { id: uid('u_'), name: 'Guest-' + crypto.randomBytes(2).toString('hex'), type: 'guest', createdAt: Date.now() };
    db.users.push(user);
    const token = createSession(user.id);
    return send(res, 200, { token, user: publicUser(user) });
  }

  if (p === '/api/auth/google' && m === 'POST') {
    const body = await readBody(req);
    const info = await verifyGoogleCredential(String(body.credential || ''));
    let user = db.users.find((u) => u.type === 'google' && u.googleSub === info.sub);
    if (!user) {
      user = { id: uid('u_'), name: clean(info.name, 30) || 'Player', type: 'google', googleSub: info.sub, createdAt: Date.now() };
      db.users.push(user);
    }
    const token = createSession(user.id);
    saveDb();
    return send(res, 200, { token, user: publicUser(user) });
  }

  if (p === '/api/auth/logout' && m === 'POST') {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (token && db.sessions[token]) {
      delete db.sessions[token];
      saveDb();
    }
    return send(res, 200, { ok: true });
  }

  if (p === '/api/me' && m === 'GET') {
    const user = requireUser(req, res);
    if (!user) return;
    return send(res, 200, { user: publicUser(user) });
  }

  if (p === '/api/servers' && m === 'GET') {
    return send(res, 200, { servers: db.servers.map((s) => ({ id: s.id, name: s.name, status: s.status, population: population(s.id) })) });
  }

  if (p === '/api/announcements' && m === 'GET') {
    const server = url.searchParams.get('server');
    const list = db.announcements
      .filter((a) => a.active && (!a.serverId || a.serverId === server))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10)
      .map(({ id, title, body, createdAt }) => ({ id, title, body, createdAt }));
    return send(res, 200, { announcements: list });
  }

  if (p === '/api/characters' && m === 'GET') {
    const user = requireUser(req, res);
    if (!user) return;
    const server = url.searchParams.get('server');
    const mine = db.characters.filter((c) => c.userId === user.id && (!server || c.serverId === server));
    mine.forEach(refreshVip);
    return send(res, 200, { characters: mine });
  }

  if (p === '/api/characters' && m === 'POST') {
    const user = requireUser(req, res);
    if (!user) return;
    const mine = db.characters.filter((c) => c.userId === user.id);
    if (mine.length >= MAX_CHARACTERS) return send(res, 400, { error: `สร้างตัวละครได้สูงสุด ${MAX_CHARACTERS} ตัว` });
    const body = await readBody(req);
    const server = serverById(body.serverId);
    if (!server) return send(res, 400, { error: 'ไม่พบเซิร์ฟเวอร์นี้' });
    if (server.status !== 'open') return send(res, 400, { error: `เซิร์ฟเวอร์นี้ ${server.status === 'maintenance' ? 'กำลังปรับปรุง' : 'ปิดแล้ว'}` });
    const name = clean(body.name, 12);
    if (name.length < 2) return send(res, 400, { error: 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร' });
    if (db.characters.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return send(res, 400, { error: 'ชื่อนี้ถูกใช้แล้ว' });
    }
    if (!GENDERS.includes(body.gender)) return send(res, 400, { error: 'เพศไม่ถูกต้อง' });
    if (!CLASS_IDS.includes(body.classId)) return send(res, 400, { error: 'อาชีพไม่ถูกต้อง' });
    const ch = {
      id: uid('c_'),
      userId: user.id,
      name,
      gender: body.gender,
      classId: body.classId,
      appearance: sanitizeAppearance(body.appearance),
      serverId: server.id,
      level: 1,
      createdAt: Date.now(),
    };
    db.characters.push(ch);
    saveDb();
    return send(res, 201, { character: ch });
  }

  const charMatch = p.match(/^\/api\/characters\/([\w-]+)$/);
  if (charMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const ch = db.characters.find((c) => c.id === charMatch[1] && c.userId === user.id);
    if (!ch) return send(res, 404, { error: 'ไม่พบตัวละคร' });
    if (m === 'DELETE') {
      db.characters = db.characters.filter((c) => c !== ch);
      saveDb();
      return send(res, 200, { ok: true });
    }
    if (m === 'PUT') {
      const body = await readBody(req);
      if (body.appearance) ch.appearance = sanitizeAppearance(body.appearance);
      if (body.progress) {
        const vip = !!ch.vipUntil && Date.now() < ch.vipUntil;
        ch.progress = progressLib ? progressLib.normalize(body.progress, ch.classId) : body.progress;
        ch.progress.vip = vip;
      }
      saveDb();
      return send(res, 200, { character: ch });
    }
    if (m === 'GET') {
      refreshVip(ch);
      return send(res, 200, { character: ch });
    }
  }

  if (p === '/api/skills' && m === 'GET') {
    const classId = url.searchParams.get('classId');
    const list = db.skills.filter((s) => !classId || s.classId === classId);
    return send(res, 200, { skills: list });
  }

  if (p === '/api/skills' && m === 'POST') {
    const user = requireUser(req, res);
    if (!user) return;
    const skill = sanitizeSkill(await readBody(req));
    const i = db.skills.findIndex((s) => s.id === skill.id);
    if (i >= 0) db.skills[i] = skill;
    else db.skills.push(skill);
    saveDb();
    return send(res, 200, { skill });
  }

  const skillMatch = p.match(/^\/api\/skills\/([\w-]+)$/);
  if (skillMatch && m === 'DELETE') {
    const user = requireUser(req, res);
    if (!user) return;
    db.skills = db.skills.filter((s) => s.id !== skillMatch[1]);
    saveDb();
    return send(res, 200, { ok: true });
  }

  if (p.startsWith('/api/admin/')) {
    if (!requireAdmin(req, res)) return;
    return handleAdmin(req, res, url);
  }

  return send(res, 404, { error: 'ไม่พบ API นี้' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  } catch (err) {
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
    if (!err.status) console.error(err);
  }
});

progressReady.then(() => server.listen(PORT, () => {
  console.log(`Game platform running on http://localhost:${PORT}`);
  if (!GOOGLE_CLIENT_ID) console.log('GOOGLE_CLIENT_ID not set: Google login disabled, guest login only.');
}));
