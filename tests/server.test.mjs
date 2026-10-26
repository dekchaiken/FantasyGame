// Starts server.js on a temporary database and checks the server, character, VIP and admin rules over HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-test-'));
const PORT = 3900 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'test-admin-token';
let proc;

const api = async (method, p, body, headers = {}) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const admin = (method, p, body) => api(method, p, body, { 'X-Admin-Token': ADMIN });

before(async () => {
  proc = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(PORT), DATA_FILE: path.join(dir, 'db.json'), ADMIN_TOKEN: ADMIN },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/config'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
});

after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }); });

let token;
test('a new install has one open server', async () => {
  const { data } = await api('GET', '/api/servers');
  assert.equal(data.servers.length, 1);
  assert.equal(data.servers[0].id, 's1');
  assert.equal(data.servers[0].status, 'open');
});

test('admin API refuses a missing or wrong token', async () => {
  assert.equal((await api('GET', '/api/admin/overview')).status, 401);
  assert.equal((await api('GET', '/api/admin/overview', undefined, { 'X-Admin-Token': 'nope' })).status, 401);
  assert.equal((await admin('GET', '/api/admin/overview')).status, 200);
});

test('guest login and a character on server 1', async () => {
  const g = await api('POST', '/api/auth/guest', {});
  token = g.data.token;
  const c = await api('POST', '/api/characters', { serverId: 's1', name: 'ทดสอบหนึ่ง', gender: 'male', classId: 'mage', appearance: {} }, { Authorization: 'Bearer ' + token });
  assert.equal(c.status, 201);
  assert.equal(c.data.character.serverId, 's1');
});

test('a new server can be created, and characters are filtered by server', async () => {
  const s = await admin('POST', '/api/admin/servers', { name: 'เซิร์ฟ 2' });
  assert.equal(s.data.server.id, 's2');
  const list = await api('GET', '/api/characters?server=s2', undefined, { Authorization: 'Bearer ' + token });
  assert.equal(list.data.characters.length, 0);
  const all = await api('GET', '/api/characters?server=s1', undefined, { Authorization: 'Bearer ' + token });
  assert.equal(all.data.characters.length, 1);
});

test('a closed or maintenance server refuses new characters', async () => {
  await admin('PATCH', '/api/admin/servers/s2', { status: 'closed' });
  const r = await api('POST', '/api/characters', { serverId: 's2', name: 'ทดสอบสอง', gender: 'female', classId: 'priest', appearance: {} }, { Authorization: 'Bearer ' + token });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /ปิด/);
  await admin('PATCH', '/api/admin/servers/s2', { status: 'open' });
});

test('merging moves characters and removes the old server', async () => {
  const c2 = await api('POST', '/api/characters', { serverId: 's2', name: 'ทดสอบสาม', gender: 'female', classId: 'priest', appearance: {} }, { Authorization: 'Bearer ' + token });
  assert.equal(c2.status, 201);
  const m = await admin('POST', '/api/admin/servers/s2/merge', { into: 's1' });
  assert.equal(m.data.moved, 1);
  const { data } = await api('GET', '/api/servers');
  assert.deepEqual(data.servers.map((s) => s.id), ['s1']);
  assert.equal(data.servers[0].population, 2);
});

test('a server with characters cannot be deleted; an empty one can', async () => {
  const s = await admin('POST', '/api/admin/servers', { name: 'เซิร์ฟ 3' });
  assert.equal((await admin('DELETE', '/api/admin/servers/s1')).status, 400);
  assert.equal((await admin('DELETE', `/api/admin/servers/${s.data.server.id}`)).status, 200);
});

test('VIP is granted by the admin and the client cannot switch it on', async () => {
  const list = await api('GET', '/api/characters?server=s1', undefined, { Authorization: 'Bearer ' + token });
  const id = list.data.characters[0].id;
  const granted = await admin('PATCH', `/api/admin/characters/${id}`, { vipDays: 30, gold: 500, mats: { enh_stone: 4 } });
  assert.equal(granted.status, 200);
  assert.equal(granted.data.character.progress.vip, true);
  assert.equal(granted.data.character.progress.gold, 500);
  assert.equal(granted.data.character.progress.mats.enh_stone, 4);
  // the client tries to clear its own VIP and to set a fake gold amount
  const save = await api('PUT', `/api/characters/${id}`, { progress: { ...granted.data.character.progress, vip: false, gold: 99999999 } }, { Authorization: 'Bearer ' + token });
  assert.equal(save.data.character.progress.vip, true, 'server keeps the VIP flag');
  assert.equal(save.data.character.progress.gold, 99999999, 'gold is still client-saved (see notes)');
  // admin switches VIP off
  await admin('PATCH', `/api/admin/characters/${id}`, { vipOff: true });
  const after2 = await api('GET', `/api/characters/${id}`, undefined, { Authorization: 'Bearer ' + token });
  assert.equal(after2.data.character.progress.vip, false);
});

test('announcements: an admin posts one, the game shows it for its server only', async () => {
  const a = await admin('POST', '/api/admin/announcements', { title: 'ยินดีต้อนรับ', body: 'เซิร์ฟ 1 เปิดแล้ว', serverId: 's1' });
  assert.equal(a.status, 201);
  await admin('POST', '/api/admin/announcements', { title: 'ปิดปรับปรุง', body: 'ทุกเซิร์ฟ', serverId: null });
  const s1 = await api('GET', '/api/announcements?server=s1');
  assert.equal(s1.data.announcements.length, 2);
  const s9 = await api('GET', '/api/announcements?server=s9');
  assert.equal(s9.data.announcements.length, 1);
  await admin('PATCH', `/api/admin/announcements/${a.data.announcement.id}`, { active: false });
  assert.equal((await api('GET', '/api/announcements?server=s1')).data.announcements.length, 1);
});
