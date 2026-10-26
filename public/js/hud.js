import { icon } from './icons.js';
import { CLASSES, HUD_MENUS } from './config.js';
import { MAPS, NPCS, QUESTS, MATERIALS, GEAR, RARITY } from './data.js';
import { SKILL_TREE, TIER_LEVEL, MAX_RANK } from './skills.js';
import * as P from './progress.js';
import { drawThumb } from './thumb.js';

// HUD and windows. Game state is the source of truth; this module only renders it and forwards clicks.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n).toLocaleString('th-TH');

export const Hud = {
  g: null,
  windowKind: null,
  windowData: null,
  windowHtml: '',
  tracked: null,
  bound: false,
  slots: [],
  portraitAt: 0,

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
        case 'equip': g.equip(d.uid); break;
        case 'cat': this.windowData.cat = d.cat; this.windowData.sel = null; this.refresh(g); break;
        case 'select': this.windowData.sel = d.uid; this.refresh(g); break;
        case 'craft': g.craft(d.line, Number(d.band)); break;
        case 'unequip': g.unequip(d.slot); break;
        case 'enhance': g.enhance(d.uid); break;
        case 'sell': g.sell(d.uid); break;
        case 'learn': g.learn(d.id); break;
        case 'hot': g.setHotbar(Number(d.slot), d.id || null); break;
        case 'use': g.usePotion(d.id); break;
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
    $('window').classList.toggle('wide', kind === 'skills' || kind === 'inventory');
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
    const kind = this.windowKind;
    const titles = {
      inventory: 'กระเป๋าและชุดของคุณ', skills: 'สกิล', quests: 'ภารกิจ', map: 'แผนที่', status: 'ตัวละคร',
      npc: NPCS[this.windowData.npcId]?.name || '',
    };
    const menu = HUD_MENUS.find((m) => m.id === kind);
    $('window-title').innerHTML = `${icon(menu?.icon || 'chat')}<span>${esc(titles[kind] || '')}</span>`;
    let html = '';

    if (kind === 'inventory') html = bagHtml(g, this);
    else if (kind === 'skills') html = skillsHtml(g);
    else if (kind === 'quests') html = questsHtml(g, this);
    else if (kind === 'map') html = mapHtml(g);
    else if (kind === 'status') html = statusHtml(g);
    else if (kind === 'npc') html = npcHtml(g, this.windowData.npcId);

    if (html !== this.windowHtml) {
      this.windowHtml = html;
      $('window-body').innerHTML = html;
    }
    if (kind === 'status') {
      const c = document.getElementById('status-thumb');
      if (c) drawThumb(c.getContext('2d'), g.character, 0, 0, 180, 180);
    }
    if (kind === 'inventory') {
      const c = document.getElementById('bag-thumb');
      if (c) drawThumb(c.getContext('2d'), g.character, 0, 0, c.width, c.height);
    }
    void p;
  },

  trackedFallback(g) {
    return Object.keys(g.p.quests).find((id) => g.p.quests[id].status === 'active') || null;
  },

  // ---------- per-tick refresh (state -> DOM) ----------
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

    // dock: auto, potion and the six hotbar slots
    $('dock-auto').classList.toggle('on', !!g.auto);
    $('dock-auto-label').textContent = g.auto ? 'ออโต้ เปิด' : 'ออโต้ ปิด';
    const potions = p.mats.potion_hp || 0;
    $('dock-potion-count').textContent = potions;
    $('dock-potion').disabled = potions === 0;
    const now = performance.now();
    this.slots.forEach((el, i) => {
      const sk = g.hotSkill(i + 1);
      el.classList.toggle('empty', !sk);
      if (!sk) {
        el.querySelector('.sk-ico').innerHTML = '';
        el.querySelector('.sk-name').textContent = 'ว่าง';
        el.querySelector('.sk-cd').textContent = '';
        el.classList.remove('cooling');
        el.title = 'เปิดหน้าสกิลเพื่อตั้งปุ่มนี้';
        return;
      }
      const left = (g.cooldowns[sk.id] || 0) - now;
      el.classList.toggle('cooling', left > 0);
      el.querySelector('.sk-ico').innerHTML = icon(sk.icon);
      el.querySelector('.sk-name').textContent = sk.name;
      el.querySelector('.sk-cd').textContent = left > 0 ? (left / 1000).toFixed(1) : '';
      el.title = `${sk.name} (ระดับ ${sk.rank})`;
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

  // items: [{ name, icon, color, rare }]
  loot({ name, exp, gold, items }) {
    const wrap = $('loot');
    const el = document.createElement('div');
    el.className = 'loot-card';
    const drops = items.map((it) => `<li class="${it.rare ? 'rare' : ''}" style="color:${it.color}">${icon(it.icon)}<span>${esc(it.name)}</span></li>`).join('');
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

// ---------- window content ----------
function gearLabel(g) {
  const base = GEAR[g.base];
  return `${esc(base.name)} <i class="gname" style="color:${base.gcolor}">${esc(base.epithet)}</i>${g.enh ? ` <b class="enh">+${g.enh}</b>` : ''}`;
}

function optionsHtml(g) {
  return g.opts.map((o) => `<li>${esc(P.optionLabel(o))}</li>`).join('') || '<li class="muted">ไม่มีออฟชั่นเสริม</li>';
}

const CATS = [
  { id: 'weapon', label: 'อาวุธ', icon: 'sword' },
  { id: 'armor', label: 'ชุด', icon: 'shirt' },
  { id: 'acc', label: 'เครื่องประดับ', icon: 'ring' },
  { id: 'quest', label: 'ของภารกิจ', icon: 'scroll' },
  { id: 'craft', label: 'วัสดุคราฟ', icon: 'ore' },
  { id: 'upgrade', label: 'อัปเกรด', icon: 'gem' },
  { id: 'potion', label: 'ยา', icon: 'potion' },
];
const ARMOR_SLOT_CATS = ['hat', 'shirt', 'pants', 'shoes'];
const ACC_SLOT_CATS = ['ring', 'bracelet'];
const SLOT_ICON = { weapon: 'sword', hat: 'hat', shirt: 'shirt', pants: 'pants', shoes: 'shoe', ring: 'ring', bracelet: 'bracelet' };
const SLOT_LABEL = { weapon: 'อาวุธ', hat: 'หมวก', shirt: 'เสื้อ', pants: 'กางเกง', shoes: 'รองเท้า', ring: 'แหวน', bracelet: 'กำไล' };

// Items in one bag category: gear as [uid, item] and materials as ['mat:id', item].
function itemsInCat(g, cat) {
  const p = g.p;
  if (cat === 'weapon') return p.gear.filter((x) => GEAR[x.base].slot === 'weapon').map((x) => ({ key: x.uid, gear: x }));
  if (cat === 'armor') return p.gear.filter((x) => ARMOR_SLOT_CATS.includes(GEAR[x.base].slot)).map((x) => ({ key: x.uid, gear: x }));
  if (cat === 'acc') return p.gear.filter((x) => ACC_SLOT_CATS.includes(GEAR[x.base].slot)).map((x) => ({ key: x.uid, gear: x }));
  const mat = { quest: 'quest', craft: 'craft', upgrade: 'upgrade', potion: 'potion' }[cat];
  return Object.entries(p.mats).filter(([id]) => MATERIALS[id].cat === mat).map(([id, n]) => ({ key: 'mat:' + id, mat: id, count: n }));
}

function bagHtml(g, hud) {
  const p = g.p;
  const cat = hud.windowData.cat || 'weapon';
  const sel = hud.windowData.sel;
  const doll = (slot) => {
    const item = P.findGear(p, p.equip[slot]);
    const color = item ? GEAR[item.base].gcolor : 'rgba(120,170,255,0.25)';
    return `<button class="doll-slot${item ? ' filled' : ''}" style="--gc:${color}" ${item ? `data-act="unequip" data-slot="${slot}"` : 'disabled'} title="${SLOT_LABEL[slot]}">
      <span class="doll-ico">${icon(item ? GEAR[item.base].icon : SLOT_ICON[slot])}</span>
      <small>${item ? esc(GEAR[item.base].name) : SLOT_LABEL[slot]}</small>${item ? `<em>${item.enh ? '+' + item.enh : ''}</em>` : ''}</button>`;
  };
  const dollSlots = [['weapon', 'hat'], ['shirt', 'ring'], ['pants', 'bracelet'], ['shoes']];
  const dollHtml = dollSlots.map((row) => `<div class="doll-row">${row.map(doll).join('')}</div>`).join('');
  const stats = g.stats;
  const mini = `<div class="mini-stats"><span>ATK <b>${fmt(stats.atk)}</b></span><span>DEF <b>${fmt(stats.def)}</b></span><span>HP <b>${fmt(stats.maxHp)}</b></span><span>MP <b>${fmt(stats.maxMp)}</b></span></div>`;

  const tabs = CATS.map((c) => `<button class="cat${cat === c.id ? ' on' : ''}" data-act="cat" data-cat="${c.id}" title="${c.label}">${icon(c.icon)}<span>${c.label}</span></button>`).join('');
  const items = itemsInCat(g, cat);
  const grid = items.length ? items.map((it) => {
    if (it.gear) {
      const base = GEAR[it.gear.base];
      const eq = GEAR_SLOTS_EQUIPPED(p, it.gear.uid);
      return `<button class="bag-item${sel === it.key ? ' sel' : ''}${eq ? ' eq' : ''}" style="--gc:${base.gcolor}" data-act="select" data-uid="${it.key}">
        <span class="bi-ico">${icon(base.icon)}</span>${it.gear.enh ? `<em>+${it.gear.enh}</em>` : ''}${eq ? '<i class="eq-dot"></i>' : ''}<small>${esc(base.name)}</small></button>`;
    }
    const m = MATERIALS[it.mat];
    return `<button class="bag-item mat${sel === it.key ? ' sel' : ''}" style="--gc:${RARITY[m.rarity].color}" data-act="select" data-uid="${it.key}">
      <span class="bi-ico">${icon(m.icon)}</span><b class="cnt">x${it.count}</b><small>${esc(m.name)}</small></button>`;
  }).join('') : '<div class="empty bag-empty">ไม่มีรายการในหมวดนี้</div>';

  // detail panel for the selected item
  let detail = '<div class="detail-empty">เลือกไอเท็มเพื่อดูรายละเอียด</div>';
  if (sel && sel.startsWith('mat:')) {
    const id = sel.slice(4);
    const m = MATERIALS[id];
    if (p.mats[id]) {
      const act = m.type === 'potion' ? `<button class="btn-primary" data-act="use" data-id="${id}">ใช้ (+${m.heal} HP)</button>` : '';
      detail = `<div class="detail-head"><span class="di" style="color:${RARITY[m.rarity].color}">${icon(m.icon)}</span><div><b>${esc(m.name)}</b><small>${RARITY[m.rarity].label} · จำนวน ${p.mats[id]}</small></div></div>${act}`;
    }
  } else if (sel) {
    const item = P.findGear(p, sel);
    if (item) detail = gearDetail(g, item);
  }

  return `<div class="bag-top">
      <div class="doll-panel glass-in">
        <div class="doll-thumb"><canvas id="bag-thumb" width="160" height="160"></canvas></div>
        <div class="doll">${dollHtml}</div>
        ${mini}
      </div>
      <div class="bag-main">
        <div class="cats">${tabs}</div>
        <div class="bag-grid">${grid}</div>
        <div class="bag-foot"><span>${icon('coin')} ${fmt(p.gold)}</span><span>อุปกรณ์ ${p.gear.length}/${P.BAG_MAX}</span></div>
      </div>
    </div>
    <div class="detail">${detail}</div>`;
}

function GEAR_SLOTS_EQUIPPED(p, uid) {
  return Object.values(p.equip).includes(uid);
}

function gearDetail(g, item) {
  const p = g.p;
  const base = GEAR[item.base];
  const eq = GEAR_SLOTS_EQUIPPED(p, item.uid);
  const allowed = base.slot !== 'weapon' || base.classId === g.character.classId;
  const lvOk = p.level >= base.level;
  const cost = P.enhCost(item.enh);
  const stones = P.enhStones(item.enh);
  const rate = Math.round(enhRate(item.enh) * 100);
  const stats = base.atk ? `พลังโจมตี ${base.atk}` : `ป้องกัน ${base.def} · HP ${base.hp}`;
  const btns = [];
  if (eq) btns.push(`<button class="btn-ghost sm" data-act="unequip" data-slot="${base.slot}">ถอด</button>`);
  else if (allowed) btns.push(`<button class="btn-primary sm" data-act="equip" data-uid="${item.uid}" ${lvOk ? '' : 'disabled'}>${lvOk ? 'ใส่' : `ต้องเลเวล ${base.level}`}</button>`);
  if (!eq) btns.push(`<button class="btn-ghost sm" data-act="sell" data-uid="${item.uid}">ขาย</button>`);
  const enh = item.enh >= 15 ? '<small>ตีบวกถึงขีดสุด</small>'
    : `<div class="enh-line"><span>ตีบวก +${item.enh + 1} · โอกาส ${rate}%</span><span>${icon('coin')} ${fmt(cost)} · ${icon('gem')} ${stones} (มี ${p.mats.enh_stone || 0})</span>
      <button class="btn-primary sm" data-act="enhance" data-uid="${item.uid}">ตีบวก</button></div>`;
  return `<div class="detail-head"><span class="di" style="color:${base.gcolor}">${icon(base.icon)}</span>
      <div><b>${gearLabel(item)}</b><small>${SLOT_LABEL[base.slot] || 'อาวุธ'} · ${GRADES_NAME(base.grade)} · ต้องเลเวล ${base.level} · ${stats}${base.classId ? ' · ' + (base.classId === g.character.classId ? 'สายของคุณ' : 'ของสายอาชีพอื่น') : ''}</small>
      <ul class="opts">${optionsHtml(item)}</ul></div></div>
    <div class="detail-actions">${btns.join('')}</div>${enh}`;
}

function GRADES_NAME(i) {
  return ['ธรรมดา', 'พื้นฐาน', 'หายาก', 'แรร์', 'ตำนาน', 'ขั้นสุด'][i];
}

// Mirrors the rate table in data.js so the UI can show it.
function enhRate(enh) {
  return [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.1, 0.06, 0.04, 0.02][enh + 1] ?? 0;
}

// Smith window: craft weapons of the hero's class lines for every band the hero has reached.
function craftHtml(g) {
  const p = g.p;
  const lines = [...new Set(Object.values(GEAR).filter((x) => x.slot === 'weapon' && x.classId === g.character.classId).map((x) => x.line))];
  const names = Object.fromEntries(Object.values(GEAR).filter((x) => x.slot === 'weapon').map((x) => [x.line, x.name.replace(BANDS_NAMES_RE, '')]));
  let html = '<div class="sub-title">คราฟอาวุธ (ตามเลเวลและสายอาชีพ)</div><div class="craft-list">';
  BANDS_LIST.forEach((band, b) => {
    const ok = p.level >= band.level;
    const cost = P.craftCost(b);
    const mats = Object.entries(cost.mats).map(([id, n]) => `${MATERIALS[id].name} ${n}`).join(' · ');
    html += `<div class="craft-band${ok ? '' : ' locked'}"><div class="cb-head"><b>${band.name}</b><small>เลเวล ${band.level}</small></div>`;
    html += `<div class="cb-cost">${icon('coin')} ${fmt(cost.gold)} · ${mats}</div>`;
    html += '<div class="cb-lines">' + lines.map((line) => ok
      ? `<button class="btn-primary sm" data-act="craft" data-line="${line}" data-band="${b}">${names[line]}</button>`
      : `<span class="tag lock">${icon('lock')} ${names[line]}</span>`).join('') + '</div></div>';
  });
  return html + '</div>';
}

const BANDS_LIST = [
  { level: 5, name: 'ฝึกหัด' }, { level: 10, name: 'ชำนาญ' }, { level: 15, name: 'นักรบ' },
  { level: 20, name: 'วีรบุรุษ' }, { level: 25, name: 'ราชา' }, { level: 30, name: 'เทพ' },
];
const BANDS_NAMES_RE = /(ฝึกหัด|ชำนาญ|นักรบ|วีรบุรุษ|ราชา|เทพ)$/;

function skillsHtml(g) {
  const p = g.p;
  const cls = g.character.classId;
  const pts = P.skillPoints(p);
  let html = `<div class="row-meta"><span>แต้มสกิลคงเหลือ <b class="pts">${pts}</b></span><span>+${2} แต้มต่อเลเวล</span></div>`;
  html += '<div class="sub-title">ช่องปุ่มลัด (กด 1-6)</div><div class="hotbar-edit">';
  for (let slot = 1; slot <= 6; slot++) {
    const id = p.hotbar[slot - 1];
    const s = id && g.skillMap[id];
    html += `<div class="hb-slot${s ? '' : ' empty'}"><kbd>${slot}</kbd>${s ? icon(s.icon) : ''}<span>${s ? esc(s.name) : 'ว่าง'}</span>${s ? `<button class="x" data-act="hot" data-slot="${slot}" data-id="" aria-label="เอาออก">✕</button>` : ''}</div>`;
  }
  html += '</div>';
  for (const line of SKILL_TREE[cls] || []) {
    html += `<div class="sub-title">${esc(line.name)}</div><div class="tree">`;
    for (const sk of line.tiers) {
      const rank = p.skills[sk.id] || 0;
      const reason = P.canLearn(p, sk.id);
      html += `<div class="sk-card${rank ? ' learned' : ''}${reason && !rank ? ' locked' : ''}">
        <div class="sk-top"><div class="sk-badge">${icon(sk.icon)}</div>
          <div><b>${esc(sk.name)}</b><small>ขั้น ${sk.tier} · Lv ${TIER_LEVEL[sk.tier - 1]}</small></div>
          <span class="rank">${rank}/${MAX_RANK}</span></div>
        <small class="sk-desc">${skillDesc(sk)}</small>
        ${rank ? `<div class="hot-btns">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="${p.hotbar[n - 1] === sk.id ? 'on' : ''}" data-act="hot" data-slot="${n}" data-id="${sk.id}">${n}</button>`).join('')}</div>` : ''}
        ${rank < MAX_RANK ? (reason ? `<small class="lock-note">${esc(reason)}</small>` : `<button class="btn-primary sm" data-act="learn" data-id="${sk.id}">${rank ? 'เพิ่มระดับ' : 'เรียนรู้'}</button>`) : ''}
      </div>`;
    }
    html += '</div>';
  }
  const custom = Object.values(g.skillMap).filter((s) => s.line === 'custom');
  if (custom.length) {
    html += '<div class="sub-title">สกิลกำหนดเอง</div><div class="tree">' + custom.map((sk) => {
      const rank = p.skills[sk.id] || 0;
      return `<div class="sk-card${rank ? ' learned' : ''}"><div class="sk-top"><div class="sk-badge">${icon(sk.icon)}</div><div><b>${esc(sk.name)}</b><small>สร้างจาก Skill Lab</small></div><span class="rank">${rank}/${MAX_RANK}</span></div>
      ${rank ? `<div class="hot-btns">${[1, 2, 3, 4, 5, 6].map((n) => `<button class="${p.hotbar[n - 1] === sk.id ? 'on' : ''}" data-act="hot" data-slot="${n}" data-id="${sk.id}">${n}</button>`).join('')}</div>` : `<button class="btn-primary sm" data-act="learn" data-id="${sk.id}">เรียนรู้</button>`}</div>`;
    }).join('') + '</div>';
  }
  return html;
}

function skillDesc(sk) {
  const bits = [];
  if (sk.heal) bits.push(`ฟื้น ${Math.round(sk.heal * 100)}% HP`);
  if (sk.mult) bits.push(`ดาเมจ ${Math.round(sk.mult * 100)}%`);
  if (sk.shield) bits.push(`ลดความเสียหาย ${Math.round(sk.shield * 100)}% (5 วิ)`);
  if (sk.aoe) bits.push('โจมตีทุกเป้าในระยะ');
  bits.push(`คูลดาวน์ ${(sk.cd / 1000).toFixed(1)} วิ`);
  bits.push(`MP ${sk.mp}`);
  return bits.join(' · ');
}

function questsHtml(g, hud) {
  const p = g.p;
  const tabs = [['active', 'กำลังทำ'], ['done', 'สำเร็จแล้ว'], ['open', 'ยังไม่รับ']];
  let html = `<div class="tabs">${tabs.map(([id, l]) => `<button class="tab${hud.windowData.tab === id ? ' on' : ''}" data-act="tab" data-tab="${id}">${l}</button>`).join('')}</div>`;
  const list = Object.entries(QUESTS).filter(([id]) => {
    const q = p.quests[id];
    if (hud.windowData.tab === 'open') return !q && p.level >= QUESTS[id].minLevel;
    if (hud.windowData.tab === 'done') return q?.status === 'done';
    return q?.status === 'active';
  });
  html += list.map(([id, quest]) => {
    const q = p.quests[id];
    const step = q && q.status === 'active' ? quest.steps[q.step] : null;
    const prog = P.stepProgressText(p, id);
    const pct = step && (step.type === 'kill' || step.type === 'collect') ? Math.min(100, (q.count / step.count) * 100) : 0;
    const tracked = hud.tracked === id || (!hud.tracked && hud.trackedFallback(g) === id);
    return `<div class="quest-card">
      <div class="qc-head"><b>${esc(quest.title)}</b><small>${esc(NPCS[quest.giver].name)}</small></div>
      ${step ? `<p>${esc(step.text)}</p>` : `<p>${q ? 'ภารกิจเสร็จสมบูรณ์' : 'คุยกับ ' + esc(NPCS[quest.giver].name) + ' เพื่อรับภารกิจ'}</p>`}
      ${prog ? `<div class="qc-prog"><span style="width:${pct}%"></span><em>${prog}</em></div>` : ''}
      ${q?.status === 'active' ? `<button class="btn-ghost sm" data-act="track" data-quest="${id}">${tracked ? 'กำลังติดตาม' : 'ติดตามภารกิจ'}</button>` : ''}
    </div>`;
  }).join('') || '<div class="empty">ไม่มีรายการในหมวดนี้</div>';
  return html;
}

function mapHtml(g) {
  const p = g.p;
  return Object.entries(MAPS).map(([id, m]) => {
    const ok = P.mapUnlocked(p, id);
    return `<div class="map-card${ok ? '' : ' locked'}${g.map === id ? ' here' : ''}">
      <div class="map-ico">${icon(id === 'town' ? 'shield' : id === 'forest' ? 'leaf' : 'ore')}</div>
      <div class="map-info"><b>${esc(m.name)}</b><small>${m.levelText}${ok ? '' : ' · ต้องเลเวล ' + m.minLevel}</small></div>
      ${g.map === id ? '<span class="tag">อยู่ที่นี่</span>' : ok ? `<button class="btn-primary sm" data-act="travel" data-map="${id}">${icon('arrow')} ไป</button>` : `<span class="tag lock">${icon('lock')}</span>`}
    </div>`;
  }).join('');
}

function statusHtml(g) {
  const p = g.p;
  const s = g.stats;
  return `<div class="status-head"><canvas id="status-thumb" width="180" height="180"></canvas>
    <div><b>${esc(g.character.name)}</b><small>${CLASSES[g.character.classId].name} · เลเวล ${p.level}</small>
    <div class="xp"><span style="width:${(p.exp / P.expToNext(p.level)) * 100}%"></span></div><small>${p.exp} / ${P.expToNext(p.level)} EXP</small></div></div>
    <div class="stat-list">${statRow('พลังโจมตี', s.atk)}${statRow('ป้องกัน', s.def)}${statRow('HP สูงสุด', s.maxHp)}${statRow('MP สูงสุด', s.maxMp)}${statRow('เหรียญ', fmt(p.gold))}${statRow('แต้มสกิล', P.skillPoints(p))}</div>`;
}

function npcHtml(g, npcId) {
  const p = g.p;
  const npc = NPCS[npcId];
  let html = `<div class="npc-head"><small>${esc(npc.role)}</small><p class="greet">${esc(npc.greet)}</p></div>`;
  html += Object.entries(p.quests).filter(([id, q]) => q.status === 'active' && (QUESTS[id].giver === npcId || P.currentStep(p, id)?.npc === npcId))
    .map(([id]) => `<div class="quest-card"><div class="qc-head"><b>${esc(QUESTS[id].title)}</b></div><p>${esc(P.currentStep(p, id)?.text || '')}</p></div>`).join('');
  if (npc.shop) {
    html += `<div class="sub-title">${icon('shop')} สินค้า</div><div class="shop-row">${npc.shop.map((id) => {
      const it = MATERIALS[id];
      return `<button class="shop-item" data-act="buy" data-id="${id}" style="--rc:${RARITY[it.rarity].color}">${icon(it.icon)}<span>${esc(it.name)}</span><b>${icon('coin')} ${it.price}</b></button>`;
    }).join('')}</div>`;
  }
  if (npcId === 'smith') html += craftHtml(g);
  html += `<div class="row-meta"><span>${icon('coin')} ${fmt(p.gold)} เหรียญ</span><button class="btn-ghost sm" data-act="talk" data-npc="${npcId}">คุยต่อ</button></div>`;
  return html;
}

// ---------- small render helpers ----------
function setBar(id, ratio) {
  $(id).style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
}

function statRow(label, value) {
  return `<div class="stat"><span>${label}</span><b>${typeof value === 'number' ? fmt(value) : value}</b></div>`;
}
