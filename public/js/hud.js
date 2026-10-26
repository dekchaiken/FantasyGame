import { icon } from './icons.js';
import { CLASSES } from './config.js';
import { HUD_MENUS } from './config.js';
import { ITEMS, MAPS, NPCS, QUESTS, RARITY } from './data.js';
import * as P from './progress.js';
import { drawThumb } from './thumb.js';

// HUD and windows. The game state is the source of truth; this module only renders it.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const Hud = {
  g: null,
  windowKind: null,
  windowData: null,
  windowHtml: '',
  tracked: null,
  bound: false,
  slots: [],
  toastTimer: 0,

  init(game) {
    this.g = game;
    this.bindOnce();
    $('hud-menu').innerHTML = HUD_MENUS.map((m) =>
      `<button class="menu-btn" data-act="menu" data-menu="${m.id}" aria-label="${m.label}" title="${m.label} (${m.key})">` +
      `${icon(m.icon)}<span>${m.label}</span><kbd>${m.key}</kbd></button>`).join('');

    const dock = $('dock-skills');
    dock.innerHTML = '';
    this.slots = [];
    for (let k = 1; k <= 6; k++) {
      const b = document.createElement('button');
      b.className = 'skill';
      b.dataset.act = 'skill';
      b.dataset.key = k;
      b.innerHTML = `<kbd>${k}</kbd><i class="sk-ico"></i><span class="sk-name"></span><em class="sk-cd"></em>`;
      dock.appendChild(b);
      this.slots.push(b);
    }
  },

  bindOnce() {
    if (this.bound) return;
    this.bound = true;
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !this.g) return;
      const d = el.dataset;
      const g = this.g;
      switch (d.act) {
        case 'menu': this.toggle(d.menu); break;
        case 'close': this.close(); break;
        case 'auto': g.setAuto(!g.auto); break;
        case 'potion': g.usePotion('potion_hp'); break;
        case 'skill': g.useSkill(Number(d.key)); break;
        case 'equip': g.equip(d.id); break;
        case 'unequip': g.unequip(d.slot); break;
        case 'use': if (ITEMS[d.id]?.type === 'potion') g.usePotion(d.id); break;
        case 'buy': g.buy(d.id); break;
        case 'travel': this.close(); g.enterMap(d.map, null); break;
        case 'talk': this.close(); g.talkTo(d.npc); break;
        case 'track': this.tracked = d.quest; this.refresh(g); break;
        case 'tab': this.windowData.tab = d.tab; this.refresh(g); break;
        default: break;
      }
    });
    $('window-close').addEventListener('click', () => this.close());
    $('chat-input').addEventListener('blur', () => setTimeout(() => $('chat-input').classList.remove('show'), 0));
  },

  menuForKey(key) {
    const m = HUD_MENUS.find((x) => x.key === key.toUpperCase());
    return m ? m.id : null;
  },

  // ---------- windows ----------
  toggle(kind) {
    if (this.windowKind === kind) this.close();
    else this.open(kind);
  },

  open(kind, data = {}) {
    this.windowKind = kind;
    this.windowData = { tab: 'active', ...data };
    this.windowHtml = '';
    $('window').hidden = false;
    this.refresh(this.g);
  },

  close() {
    this.windowKind = null;
    this.windowData = null;
    $('window').hidden = true;
  },

  openNpc(npcId) {
    this.open('npc', { npcId });
  },

  renderWindow(g) {
    const p = g.p;
    const stats = g.stats;
    const kind = this.windowKind;
    const titles = {
      inventory: 'กระเป๋า', equip: 'อุปกรณ์', skills: 'สกิล', quests: 'ภารกิจ', map: 'แผนที่', status: 'ตัวละคร', npc: NPCS[this.windowData.npcId]?.name || '', shop: 'ร้านค้า',
    };
    $('window-title').innerHTML = `${icon(HUD_MENUS.find((m) => m.id === kind)?.icon || 'chat')}<span>${esc(titles[kind] || '')}</span>`;
    let html = '';

    if (kind === 'inventory') {
      const items = Object.entries(p.inv);
      html += `<div class="row-meta"><span>${icon('coin')} ${p.gold.toLocaleString('th-TH')} เหรียญ</span><span>${items.length} ชนิด</span></div>`;
      html += items.length ? `<div class="grid">${items.map(([id, n]) => itemTile(id, n, true)).join('')}</div>`
        : '<div class="empty">กระเป๋าว่างเปล่า ออกไปล่ามอนสเตอร์เพื่อหาของกัน</div>';
    } else if (kind === 'equip') {
      html += '<div class="slots">';
      for (const slot of ['weapon', 'armor']) {
        const id = p.equip[slot];
        const it = id ? ITEMS[id] : null;
        html += `<div class="slot-card${it ? '' : ' empty'}" data-act="${it ? 'unequip' : ''}" data-slot="${slot}">
          <div class="slot-ico" style="color:${it ? RARITY[it.rarity].color : 'var(--muted)'}">${icon(it ? it.icon : slot === 'weapon' ? 'sword' : 'armor')}</div>
          <div><b>${slot === 'weapon' ? 'อาวุธ' : 'ชุดเกราะ'}</b><small>${it ? esc(it.name) : 'ว่าง'}</small></div></div>`;
      }
      html += '</div>';
      html += `<div class="stat-list">${statRow('พลังโจมตี', stats.atk)}${statRow('ป้องกัน', stats.def)}${statRow('HP สูงสุด', stats.maxHp)}${statRow('MP สูงสุด', stats.maxMp)}</div>`;
      html += '<div class="hint">แตะช่องที่สวมใส่อยู่เพื่อถอด หรือกดไอเท็มในกระเป๋าเพื่อสวมใส่</div>';
    } else if (kind === 'skills') {
      html += g.skills.map((s) => {
        const locked = p.level < s.reqLv;
        return `<div class="skill-row${locked ? ' locked' : ''}">
          <div class="sk-badge">${icon(s.icon)}</div>
          <div class="sk-info"><b>${esc(s.name)}</b><small>ปุ่ม ${s.key} · คูลดาวน์ ${(s.cooldown / 1000).toFixed(1)} วิ · MP ${s.mp}${s.heal ? ' · ฟื้นฟู ' + Math.round(s.heal * 100) + '% HP' : ' · ดาเมจ ' + Math.round(s.mult * 100) + '%'}${s.aoe ? ' · โจมตีกลุ่ม' : ''}</small></div>
          <div class="sk-lv">${locked ? icon('lock') + ' Lv ' + s.reqLv : icon('check')}</div></div>`;
      }).join('') || '<div class="empty">ยังไม่มีสกิลสำหรับอาชีพนี้</div>';
    } else if (kind === 'quests') {
      const tabs = [['active', 'กำลังทำ'], ['done', 'สำเร็จแล้ว'], ['open', 'ยังไม่รับ']];
      html += `<div class="tabs">${tabs.map(([id, l]) => `<button class="tab${this.windowData.tab === id ? ' on' : ''}" data-act="tab" data-tab="${id}">${l}</button>`).join('')}</div>`;
      const entries = Object.entries(QUESTS);
      const list = entries.filter(([id]) => {
        const q = p.quests[id];
        if (this.windowData.tab === 'open') return !q && p.level >= QUESTS[id].minLevel;
        if (this.windowData.tab === 'done') return q?.status === 'done';
        return q?.status === 'active';
      });
      html += list.map(([id, quest]) => {
        const q = p.quests[id];
        const step = q && q.status === 'active' ? quest.steps[q.step] : null;
        const prog = P.stepProgressText(p, id);
        const tracked = this.tracked === id || (!this.tracked && this.trackedFallback(g) === id);
        return `<div class="quest-card">
          <div class="qc-head"><b>${esc(quest.title)}</b><small>${esc(NPCS[quest.giver].name)}</small></div>
          ${step ? `<p>${esc(step.text)}</p>` : `<p>${q ? 'ภารกิจเสร็จสมบูรณ์' : 'คุยกับ ' + esc(NPCS[quest.giver].name) + ' เพื่อรับภารกิจ'}</p>`}
          ${prog ? `<div class="qc-prog"><span style="width:${progressPct(p, id)}%"></span><em>${prog}</em></div>` : ''}
          ${q?.status === 'active' ? `<button class="btn-ghost sm" data-act="track" data-quest="${id}">${tracked ? 'กำลังติดตาม' : 'ติดตามภารกิจ'}</button>` : ''}
        </div>`;
      }).join('') || '<div class="empty">ไม่มีรายการในหมวดนี้</div>';
    } else if (kind === 'map') {
      html += Object.entries(MAPS).map(([id, m]) => {
        const ok = P.mapUnlocked(p, id);
        return `<div class="map-card${ok ? '' : ' locked'}${g.map === id ? ' here' : ''}">
          <div class="map-ico">${icon(id === 'town' ? 'shield' : id === 'forest' ? 'leaf' : 'ore')}</div>
          <div class="map-info"><b>${esc(m.name)}</b><small>${m.levelText}${ok ? '' : ' · ต้องเลเวล ' + m.minLevel}</small></div>
          ${g.map === id ? '<span class="tag">อยู่ที่นี่</span>' : ok ? `<button class="btn-primary sm" data-act="travel" data-map="${id}">${icon('arrow')} ไป</button>` : `<span class="tag lock">${icon('lock')}</span>`}
        </div>`;
      }).join('');
    } else if (kind === 'status') {
      html += `<div class="status-head"><canvas id="status-thumb" width="180" height="180"></canvas>
        <div><b>${esc(g.character.name)}</b><small>${CLASSES[g.character.classId].name} · เลเวล ${p.level}</small>
        <div class="xp"><span style="width:${(p.exp / P.expToNext(p.level)) * 100}%"></span></div><small>${p.exp} / ${P.expToNext(p.level)} EXP</small></div></div>`;
      html += `<div class="stat-list">${statRow('พลังโจมตี', stats.atk)}${statRow('ป้องกัน', stats.def)}${statRow('HP สูงสุด', stats.maxHp)}${statRow('MP สูงสุด', stats.maxMp)}${statRow('เหรียญ', p.gold)}</div>`;
    } else if (kind === 'npc') {
      const npc = NPCS[this.windowData.npcId];
      html += `<div class="npc-head"><small>${esc(npc.role)}</small><p class="greet">${esc(npc.greet)}</p></div>`;
      const mine = Object.entries(p.quests).filter(([id, q]) => q.status === 'active' && QUESTS[id].giver === this.windowData.npcId || (q.status === 'active' && P.currentStep(p, id)?.npc === this.windowData.npcId));
      html += mine.map(([id]) => `<div class="quest-card"><div class="qc-head"><b>${esc(QUESTS[id].title)}</b></div><p>${esc(P.currentStep(p, id)?.text || '')}</p></div>`).join('');
      if (npc.shop) {
        html += `<div class="sub-title">${icon('shop')} สินค้า</div><div class="grid">${npc.shop.map((id) => shopTile(id)).join('')}</div>`;
      }
      html += `<div class="row-meta"><span>${icon('coin')} ${p.gold.toLocaleString('th-TH')} เหรียญ</span><button class="btn-ghost sm" data-act="talk" data-npc="${this.windowData.npcId}">คุยต่อ</button></div>`;
    }

    if (kind === 'status' && this.windowHtml !== html) this.windowHtml = html;
    if (html !== this.windowHtml) {
      this.windowHtml = html;
      $('window-body').innerHTML = html;
    }
    if (kind === 'status') {
      const c = document.getElementById('status-thumb');
      if (c) drawThumb(c.getContext('2d'), g.character, 0, 0, 180, 180);
    }
  },

  trackedFallback(g) {
    return Object.keys(g.p.quests).find((id) => g.p.quests[id].status === 'active') || null;
  },

  // ---------- per-tick refresh (state → DOM) ----------
  refresh(g) {
    if (!g || !g.hero) return;
    const p = g.p;
    const h = g.hero;
    const s = g.stats;
    $('hud-name').textContent = g.character.name;
    $('hud-class').textContent = CLASSES[g.character.classId].name;
    $('hud-lv').textContent = 'Lv.' + p.level;
    setBar('bar-hp', h.hp / s.maxHp);
    setBar('bar-mp', h.mp / s.maxMp);
    setBar('bar-exp', p.exp / P.expToNext(p.level));
    $('txt-hp').textContent = `${Math.ceil(Math.max(0, h.hp))} / ${s.maxHp}`;
    $('txt-mp').textContent = `${Math.ceil(h.mp)} / ${s.maxMp}`;
    $('txt-exp').textContent = `${Math.floor((p.exp / P.expToNext(p.level)) * 100)}%`;
    if (!this.portraitAt || performance.now() - this.portraitAt > 2000) {
      this.portraitAt = performance.now();
      const c = $('hud-portrait');
      drawThumb(c.getContext('2d'), g.character, 0, 0, c.width, c.height);
    }

    // quest tracker
    const qid = this.tracked && p.quests[this.tracked]?.status === 'active' ? this.tracked : this.trackedFallback(g);
    if (qid) {
      const step = P.currentStep(p, qid);
      $('q-title').textContent = QUESTS[qid].title;
      $('q-step').textContent = step ? step.text : '';
      $('q-count').textContent = P.stepProgressText(p, qid);
      $('hud-quest').hidden = false;
    } else {
      const next = Object.keys(QUESTS).find((id) => !p.quests[id] && p.level >= QUESTS[id].minLevel);
      if (next) {
        $('q-title').textContent = QUESTS[next].title;
        $('q-step').textContent = 'คุยกับ ' + NPCS[QUESTS[next].giver].name + ' เพื่อรับภารกิจ';
        $('q-count').textContent = '';
        $('hud-quest').hidden = false;
      } else {
        $('hud-quest').hidden = true;
      }
    }

    // target frame
    const t = g.targetMon;
    if (t && t.alive) {
      $('hud-target').hidden = false;
      $('t-name').textContent = t.def.name;
      $('t-lv').textContent = 'Lv.' + t.def.level;
      setBar('t-bar', t.hp / t.maxHp);
    } else {
      $('hud-target').hidden = true;
    }

    // dock
    $('dock-auto').classList.toggle('on', !!g.auto);
    $('dock-auto-label').textContent = g.auto ? 'ออโต้ เปิด' : 'ออโต้ ปิด';
    const potions = p.inv.potion_hp || 0;
    $('dock-potion-count').textContent = potions;
    $('dock-potion').disabled = potions === 0;
    const now = performance.now();
    g.skills.forEach((sk, i) => {
      const el = this.slots[sk.key - 1];
      if (!el) return;
      const left = (g.cooldowns[sk.id] || 0) - now;
      const locked = p.level < sk.reqLv;
      el.classList.toggle('locked', locked);
      el.classList.toggle('cooling', left > 0);
      el.querySelector('.sk-ico').innerHTML = icon(sk.icon);
      el.querySelector('.sk-name').textContent = locked ? `Lv ${sk.reqLv}` : sk.name;
      el.querySelector('.sk-cd').textContent = left > 0 ? (left / 1000).toFixed(1) : '';
      el.title = sk.name;
    });
    this.slots.forEach((el, i) => {
      if (g.skills.some((sk) => sk.key === i + 1)) return;
      el.classList.add('empty');
      el.querySelector('.sk-name').textContent = 'ว่าง';
    });

    this.drawMinimap(g);
    if (this.windowKind) this.renderWindow(g);
  },

  drawMinimap(g) {
    const c = $('minimap');
    const ctx = c.getContext('2d');
    const size = c.width;
    const extent = g.map === 'town' ? 22 : 19;
    const k = size / (extent * 2);
    const tx = (x) => size / 2 + x * k;
    const tz = (z) => size / 2 + z * k;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = g.map === 'mine' ? 'rgba(60,20,20,0.85)' : g.map === 'forest' ? 'rgba(20,60,40,0.85)' : 'rgba(20,50,90,0.85)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    if (!g.world) return;
    for (const e of g.world.portals) {
      ctx.fillStyle = '#5ee7ff';
      ctx.beginPath(); ctx.arc(tx(e.x), tz(e.z), 4, 0, Math.PI * 2); ctx.fill();
    }
    for (const n of g.world.npcs) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(tx(n.x), tz(n.z), 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const m of g.world.monsters) {
      if (!m.alive) continue;
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.arc(tx(m.x), tz(m.z), 2.4, 0, Math.PI * 2); ctx.fill();
    }
    const p = g.hero.group.position;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(tx(p.x), tz(p.z), 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx(p.x), tz(p.z));
    ctx.lineTo(tx(p.x) + Math.sin(g.hero.rot) * 9, tz(p.z) + Math.cos(g.hero.rot) * 9);
    ctx.stroke();
    $('map-name').textContent = MAPS[g.map].name;
  },

  // ---------- feedback ----------
  toast(msg, tone = '') {
    const wrap = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + tone;
    el.textContent = msg;
    wrap.appendChild(el);
    while (wrap.children.length > 4) wrap.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  },

  loot({ name, exp, gold, items }) {
    const wrap = $('loot');
    const el = document.createElement('div');
    el.className = 'loot-card';
    const drops = items.map((id) => `<li style="color:${RARITY[ITEMS[id].rarity].color}">${icon(ITEMS[id].icon)}<span>${esc(ITEMS[id].name)}</span></li>`).join('');
    el.innerHTML = `<div class="lc-head"><b>${esc(name)}</b><small>+${exp} EXP · +${gold} ${icon('coin')}</small></div>${drops ? `<ul>${drops}</ul>` : '<div class="lc-none">ไม่มีของตก</div>'}`;
    wrap.appendChild(el);
    while (wrap.children.length > 5) wrap.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4300);
  },

  banner(title, sub) {
    const b = $('banner');
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  },

  fade(on) {
    $('fade').classList.toggle('on', on);
  },

  hurt() {
    const v = $('vignette');
    v.classList.remove('hit');
    void v.offsetWidth;
    v.classList.add('hit');
  },

  setAuto(on) {
    $('dock-auto').classList.toggle('on', on);
  },

  focusChat() {
    const input = $('chat-input');
    input.classList.add('show');
    input.focus();
  },

  sendChat() {
    const input = $('chat-input');
    const text = input.value.trim();
    input.value = '';
    input.classList.remove('show');
    input.blur();
    if (!text || !this.g) return;
    const log = $('chat-log');
    const d = document.createElement('div');
    d.innerHTML = `<b>${esc(this.g.character.name)}</b> ${esc(text)}`;
    log.appendChild(d);
    while (log.children.length > 6) log.firstChild.remove();
  },
};

// ---------- small render helpers ----------
function setBar(id, ratio) {
  $(id).style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
}

function statRow(label, value) {
  return `<div class="stat"><span>${label}</span><b>${typeof value === 'number' ? value.toLocaleString('th-TH') : value}</b></div>`;
}

function progressPct(p, id) {
  const step = P.currentStep(p, id);
  const q = p.quests[id];
  if (!step || !q) return 0;
  return Math.min(100, (q.count / step.count) * 100);
}

function itemTile(id, n, actionable) {
  const it = ITEMS[id];
  const color = RARITY[it.rarity].color;
  const act = it.type === 'potion' ? `data-act="use" data-id="${id}"` : ['weapon', 'armor'].includes(it.type) ? `data-act="equip" data-id="${id}"` : '';
  return `<button class="tile" ${actionable && act ? act : 'disabled'} style="--rc:${color}" title="${esc(it.name)}">
    <i>${icon(it.icon)}</i><span class="count">${n > 1 ? n : ''}</span><small>${esc(it.name)}</small></button>`;
}

function shopTile(id) {
  const it = ITEMS[id];
  return `<button class="tile shop" data-act="buy" data-id="${id}" style="--rc:${RARITY[it.rarity].color}" title="${esc(it.name)}">
    <i>${icon(it.icon)}</i><small>${esc(it.name)}</small><b class="price">${icon('coin')} ${it.price}</b></button>`;
}
