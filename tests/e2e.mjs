// End-to-end playthrough in headless Chromium.
// Setup once:  npm i -D playwright && npx playwright install chromium
// Run:         BASE=http://localhost:3000 node tests/e2e.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('console: ' + m.text()); });

const steps = [];
const step = async (name, fn) => {
  try { await fn(); steps.push(['PASS', name]); }
  catch (e) { steps.push(['FAIL', name + ': ' + e.message]); throw e; }
};
const state = (fn) => page.evaluate(fn);

try {
  await step('open login and enter as guest', async () => {
    await page.goto(BASE + '/?debug');
    await page.waitForSelector('#login.active', { timeout: 20000 });
    await page.click('#btn-guest');
    await page.waitForSelector('#charselect.active', { timeout: 15000 });
  });

  await step('create a character', async () => {
    await page.click('#char-list .char-card.empty');
    await page.waitForSelector('#creator.active');
    // unique name so the test can run again against the same server
    await page.fill('#designer .name-input', 'ลูนา' + Date.now().toString().slice(-4));
    await page.click('#designer [data-act="gender"][data-val="female"]');
    await page.click('#designer [data-act="class"][data-val="mage"]');
    await page.click('#designer [data-act="confirm"]');
    await page.waitForSelector('#game.active', { timeout: 30000 });
    await page.waitForTimeout(1200);
    assert.equal(await state(() => __SR.map), 'town');
  });

  await step('talking to the elder accepts the main quest', async () => {
    await state(() => __SR.talkTo('elder'));
    await page.keyboard.press('Escape');
    assert.equal(await state(() => __SR.p.quests.main_1.step), 1);
  });

  await step('portal travel to the forest works and shows the banner', async () => {
    await state(() => __SR.enterMap('forest', null));
    await page.waitForTimeout(1200);
    assert.equal(await state(() => __SR.map), 'forest');
    assert.equal(await page.textContent('#banner-title'), 'ป่าวิญญาณ');
  });

  await step('auto-battle kills slimes, gains exp and drops items', async () => {
    await state(() => __SR.setAuto(true));
    const t0 = Date.now();
    let st;
    while (Date.now() - t0 < 90000) {
      await page.waitForTimeout(2500);
      st = await state(() => ({ exp: __SR.p.exp, lv: __SR.p.level, q: __SR.p.quests.main_1 }));
      if (st.q.step >= 2) break;
    }
    assert.ok(st.q.step >= 2, 'quest step 2 (collect essence) should be reached');
    assert.ok(st.lv >= 2 || st.exp > 0, 'should gain exp');
    assert.ok(await state(() => (__SR.p.inv.essence || 0) > 0), 'should have dropped essence');
  });

  await step('the inventory window opens and lists drops', async () => {
    await page.keyboard.press('i');
    await page.waitForTimeout(300);
    assert.equal(await page.isVisible('#window'), true);
    assert.ok((await page.textContent('#window-body')).includes('แก่นพลังสไลม์'));
    await shot(page, 'inventory');
    await page.keyboard.press('Escape');
  });

  await step('the quest log window opens', async () => {
    await page.keyboard.press('j');
    await page.waitForTimeout(250);
    assert.ok((await page.textContent('#window-body')).includes('เจตนารมณ์แห่งสวรรค์'));
    await page.keyboard.press('Escape');
  });

  await step('progress saves to the account and comes back after reload', async () => {
    await state(() => __SR.save());
    await page.waitForTimeout(600);
    // with server.js the progress lives on the server; on static hosting it lives in this browser
    const saved = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/characters', { headers: { Authorization: 'Bearer ' + localStorage.getItem('sr_token') } });
        if (r.ok) return (await r.json()).characters[0].progress;
      } catch { /* no API */ }
      return JSON.parse(localStorage.getItem('sr_local_db')).characters[0].progress;
    });
    assert.equal(saved.map, 'forest');
    assert.ok(saved.quests.main_1.step >= 2);
    await page.reload();
    await page.waitForSelector('#charselect.active', { timeout: 20000 });
    await page.dblclick('#char-list .char-card.selected');
    await page.waitForSelector('#game.active', { timeout: 30000 });
    await page.waitForTimeout(800);
    assert.equal(await state(() => __SR.map), 'forest');
    assert.equal(await state(() => __SR.p.quests.main_1.step), saved.quests.main_1.step);
  });

  await step('the mine is locked below level 8', async () => {
    await state(() => __SR.enterMap('mine', null));
    await page.waitForTimeout(500);
    assert.equal(await state(() => __SR.map), 'forest');
  });

  await step('dying sends the hero back to town', async () => {
    await state(() => { __SR.hero.hp = 0; });
    await page.waitForTimeout(1500);
    assert.equal(await state(() => __SR.map), 'town');
  });

  await shot(page, 'final');
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  for (const [status, name] of steps) console.log(status, name);
  console.log(errors.length ? 'console errors: ' + errors.slice(0, 10).join(' | ') : 'console errors: none');
  if (errors.length) process.exitCode = 1;
  await browser.close();
}
