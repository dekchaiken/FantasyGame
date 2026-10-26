import { icon } from './icons.js';
import { CLASSES, HUD_MENUS } from './config.js';
import { MAPS, NPCS, QUESTS, MATERIALS, GEAR, RARITY, MAX_ENH, ENH_DOWN_FROM, DUNGEONS, TOWER } from './data.js';
import { SKILL_TREE, TIER_LEVEL, MAX_RANK, JOB_LEVEL, JOB_NAMES, JOBS, PASSIVE2_LEVEL, rankMult, rankCooldown } from './skills.js';
import * as DG from './dungeon.js';
import { SPIRIT_RARITY, SPIRIT_PASSIVES } from './data.js';
import { Sfx } from './sfx.js';
import * as P from './progress.js';
import { ENH_OPTION_AT, enhMult } from './progress.js';
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
    // Drag a learned skill onto a hotbar slot.
    document.addEventListener('dragstart', (e) => {
      const el = e.target.closest('[data-drag]');
      if (!el) return;
      e.dataTransfer.setData('text/plain', el.dataset.drag);
      e.dataTransfer.effectAllowed = 'copy';
    });
    document.addEventListener('dragover', (e) => {
      if (e.target.closest('[data-drop]')) e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
      const el = e.target.closest('[data-drop]');
      if (!el || !this.g) return;
      e.preventDefault();
      this.g.setHotbar(Number(el.dataset.drop), e.dataTransfer.getData('text/plain'));
    });
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !this.g) return;
      const d = el.dataset;
      const g = this.g;
      if (d.act !== 'enh-do') Sfx.play('click');
      switch (d.act) {
        case 'sfx': Sfx.setMuted(!Sfx.muted); this.refresh(g); break;
        case 'sk-sel': this.windowData.sk = d.id; this.refresh(g); break;
        case 'enh-open': this.open('enhance', { uid: d.uid }); this.refresh(g); break;
        case 'enh-do': this.enhanceFrom(g, d.uid); break;
        case 'menu': this.toggle(d.menu); break;
        case 'close': this.close(); break;
        case 'auto': g.setAuto(!g.auto); break;
        case 'potion': g.usePotion('potion_hp'); break;
        case 'skill': g.useSkill(Number(d.key)); break;
        case 'equip': g.equip(d.uid); break;
        case 'cat': this.windowData.cat = d.cat; this.windowData.sel = null; this.refresh(g); break;
        case 'select': {
          // A rune is picked as the socket source and does not replace the gear being viewed.
          const rune = d.uid.startsWith('mat:') && MATERIALS[d.uid.slice(4)]?.rune ? d.uid.slice(4) : null;
          if (rune) this.windowData.rune = this.windowData.rune === rune ? null : rune;
          else this.windowData.sel = d.uid;
          this.refresh(g);
          break;
        }
        case 'craft': g.craft(d.line, Number(d.band)); break;
        case 'job': g.chooseJob(d.job); break;
        case 'summon': g.summonSpirit(d.id); break;
        case 'equip-spirit': g.equipSpirit(d.uid || null); break;
        case 'dungeon': this.close(); g.enterDungeon(d.id); break;
        case 'socket': g.socketRune(d.uid, d.rune); break;
        case 'unsocket': g.unsocketRune(d.uid, Number(d.index)); break;
        case 'unequip': g.unequip(d.slot); break;
        case 'sell': g.sell(d.uid); break;
        case 'learn': {
          const was = g.p.skills[d.id] || 0;
          g.learn(d.id);
          Sfx.play((g.p.skills[d.id] || 0) > was ? 'learn' : 'error');
          break;
        }
        case 'hot': g.setHotbar(Number(d.slot), d.id || null); break;
        case 'use': g.usePotion(d.id); break;
        case 'buy': g.buy(d.id); break;
        case 'travel': this.close(); g.enterMap(d.map, null); break;
        case 'talk': this.close(); g.talkTo(d.npc); break;
        case 'track': this.tracked = d.quest; this.refresh(g); break;
        case 'qauto': g.setQuestAuto(!g.questAuto); break;
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
  // Runs one enhancement attempt from the enhancement screen and plays its result animation and sound.
  enhanceFrom(g, uid) {
    const r = g.enhance(uid);
    const item = P.findGear(g.p, uid);
    Sfx.play(FX_SOUND[r.result] || 'error', item ? item.enh : 0);
    if (this.windowKind === 'enhance') {
      this.windowData.fx = { result: r.result, n: Date.now() };
      this.refresh(g);
      clearTimeout(this.fxTimer);
      this.fxTimer = setTimeout(() => {
        if (this.windowKind === 'enhance') { this.windowData.fx = null; this.refresh(g); }
      }, 1400);
    }
  },

  toggle(kind) {
    if (this.windowKind === kind) this.close();
    else this.open(kind);
  },

  open(kind, data = {}) {
    this.windowKind = kind;
    this.windowData = { tab: 'active', ...data };
    this.windowHtml = '';
    $('window').hidden = false;
    $('window').classList.toggle('wide', kind === 'skills' || kind === 'inventory' || kind === 'enhance');
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
    else if (kind === 'skills') html = skillsHtml(g, this.windowData);
    else if (kind === 'enhance') html = enhHtml(g, this.windowData);
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
    if (kind === 'skills') {
      const c = document.getElementById('skill-thumb');
      if (c) drawThumb(c.getContext('2d'), g.character, 0, 0, c.width, c.height);
    }
    if (kind === 'inventory') {
      const c = document.getElementById('bag-thumb');
      if (c) drawThumb(c.getContext('2d'), g.character, 0, 0, c.width, c.height);
    }
    void p;
  },

  // Quest list in the left panel, in three groups: in progress, not taken yet, and done.
  renderQuestList(g, trackedId) {
    const p = g.p;
    const groups = { active: [], open: [], done: [] };
    for (const id of Object.keys(QUESTS)) {
      const q = p.quests[id];
      if (q?.status === 'done') groups.done.push(id);
      else if (q) groups.active.push(id);
      else groups.open.push(id);
    }
    const row = (id, cls, note) => `<div class="qt-row ${cls}${id === trackedId ? ' tracked' : ''}">
        <span class="qt-mark"></span><span class="qt-name">${esc(QUESTS[id].title)}</span><small>${note}</small></div>`;
    const section = (title, cls, ids, fn) => ids.length ? `<div class="qt-group ${cls}"><div class="qt-gtitle">${title} · ${ids.length}</div>${ids.map(fn).join('')}</div>` : '';
    $('q-list').innerHTML =
      section('กำลังทำ', 'in-progress', groups.active, (id) => row(id, 'active', P.currentStep(p, id) ? `ขั้นที่ ${p.quests[id].step + 1}` : '')) +
      section('ยังไม่ได้รับ', 'not-taken', groups.open, (id) => row(id, 'open', p.level >= QUESTS[id].minLevel ? `รับที่ ${NPCS[QUESTS[id].giver].name}` : `ต้องเลเวล ${QUESTS[id].minLevel}`)) +
      section('สำเร็จแล้ว', 'completed', groups.done, (id) => row(id, 'done', 'เสร็จสิ้น'));
  },

  activeQuest(g) {
    return this.tracked && g.p.quests[this.tracked]?.status === 'active' ? this.tracked : this.trackedFallback(g);
  },

  // Guide arrow around the hero and the quest tracker's distance line and VIP button.
  guideRefresh(g) {
    const guide = g.questGuide();
    const tgt = g.guideTarget(guide);
    const arrow = $('quest-arrow');
    const pos = g.hero.group.position;
    const dist = tgt ? Math.hypot(tgt.x - pos.x, tgt.z - pos.z) : 0;
    arrow.hidden = !tgt || dist < 2.5;
    if (tgt) arrow.style.setProperty('--a', Math.atan2(tgt.x - pos.x, -(tgt.z - pos.z)) + 'rad');
    if (!guide) $('q-dist').textContent = '';
    else if (guide.map !== g.p.map) $('q-dist').textContent = `ไปที่ ${MAPS[tgt ? tgt.to : guide.map].name}`;
    else $('q-dist').textContent = tgt ? `ระยะ ${Math.round(dist)}` : 'ตามหาในแมพนี้';
    const btn = $('q-auto');
    btn.disabled = !g.p.vip && !g.questAuto;
    btn.innerHTML = g.p.vip
      ? `${icon('arrowup')} ${g.questAuto ? 'หยุดออโต้' : 'ออโต้ไปเควส'}`
      : `${icon('lock')} ออโต้ (VIP)`;
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
    $('hud-class').textContent = p.job ? JOB_NAMES[p.job] : CLASSES[g.character.classId].name;
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
    const qid = this.activeQuest(g);
    this.guideRefresh(g);
    this.renderQuestList(g, qid);
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
  { id: 'rune', label: 'รูน', icon: 'gem' },
  { id: 'spirit', label: 'ภูติ', icon: 'star' },
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
  const mat = { quest: 'quest', craft: 'craft', upgrade: 'upgrade', potion: 'potion', rune: 'rune', spirit: 'spirit' }[cat];
  const orbs = Object.entries(p.mats).filter(([id]) => MATERIALS[id].cat === mat).map(([id, n]) => ({ key: 'mat:' + id, mat: id, count: n }));
  if (cat !== 'spirit') return orbs;
  return [...(p.spirits || []).map((s) => ({ key: 'sp:' + s.uid, spirit: s })), ...orbs];
}

function bagHtml(g, hud) {
  const p = g.p;
  const cat = hud.windowData.cat || 'weapon';
  const sel = hud.windowData.sel;
  const runeSel = hud.windowData.rune && p.mats[hud.windowData.rune] ? hud.windowData.rune : null;
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
        <span class="bi-lv" style="--bc:${bandColor(base.level)}">Lv${base.level}</span>
        <span class="bi-ico">${icon(base.icon)}</span>${it.gear.enh ? `<em>+${it.gear.enh}</em>` : ''}${eq ? '<i class="eq-dot"></i>' : ''}<small>${esc(base.name)}</small></button>`;
    }
    if (it.spirit) {
      const r = SPIRIT_RARITY.find((x) => x.id === it.spirit.rarity);
      return `<button class="bag-item spirit${sel === it.key ? ' sel' : ''}${p.spirit === it.spirit.uid ? ' eq' : ''}" style="--gc:${r.color}" data-act="select" data-uid="${it.key}">
        <span class="bi-lv" style="--bc:${r.color}">${r.name}</span><span class="bi-ico">${icon('star')}</span>${p.spirit === it.spirit.uid ? '<i class="eq-dot"></i>' : ''}<small>ภูติ ${it.spirit.passives.length} พาสซีพ</small></button>`;
    }
    const m = MATERIALS[it.mat];
    return `<button class="bag-item mat${sel === it.key || runeSel === it.mat ? ' sel' : ''}" style="--gc:${RARITY[m.rarity].color}" data-act="select" data-uid="${it.key}">
      <span class="bi-ico">${icon(m.icon)}</span><b class="cnt">x${it.count}</b><small>${esc(m.name)}</small></button>`;
  }).join('') : '<div class="empty bag-empty">ไม่มีรายการในหมวดนี้</div>';

  // detail panel for the selected item
  let detail = '<div class="detail-empty">เลือกไอเท็มเพื่อดูรายละเอียด</div>';
  if (sel && sel.startsWith('mat:')) {
    const id = sel.slice(4);
    const m = MATERIALS[id];
    if (p.mats[id]) {
      const act = m.type === 'potion' ? `<button class="btn-primary" data-act="use" data-id="${id}">ใช้ (+${m.heal} HP)</button>`
        : m.cat === 'spirit' ? `<button class="btn-primary" data-act="summon" data-id="${id}">ปลุกภูติ</button>` : '';
      detail = `<div class="detail-head"><span class="di" style="color:${RARITY[m.rarity].color}">${icon(m.icon)}</span><div><b>${esc(m.name)}</b><small>${RARITY[m.rarity].label} · จำนวน ${p.mats[id]}</small></div></div>${act}`;
    }
  } else if (sel && sel.startsWith('sp:')) {
    const sp = (p.spirits || []).find((s) => s.uid === sel.slice(3));
    if (sp) detail = spiritDetail(sp, p.spirit === sp.uid);
  } else if (sel) {
    const item = P.findGear(p, sel);
    if (item) detail = gearDetail(g, item, runeSel);
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

function gearDetail(g, item, runeSel) {
  const p = g.p;
  const base = GEAR[item.base];
  const eq = GEAR_SLOTS_EQUIPPED(p, item.uid);
  const allowed = base.slot !== 'weapon' || base.classId === g.character.classId;
  const lvOk = p.level >= base.level;
  const stats = base.atk ? `พลังโจมตี ${base.atk}` : `ป้องกัน ${base.def} · HP ${base.hp}`;
  const btns = [];
  if (eq) btns.push(`<button class="btn-ghost sm" data-act="unequip" data-slot="${base.slot}">ถอด</button>`);
  else if (allowed) btns.push(`<button class="btn-primary sm" data-act="equip" data-uid="${item.uid}" ${lvOk ? '' : 'disabled'}>${lvOk ? 'ใส่' : `ต้องเลเวล ${base.level}`}</button>`);
  if (!eq) btns.push(`<button class="btn-ghost sm" data-act="sell" data-uid="${item.uid}">ขาย</button>`);
  const enh = `<div class="enh-line"><span>ตีบวก +${item.enh}${item.enh >= MAX_ENH ? ' (สูงสุด)' : ''}</span>
      ${item.enh >= MAX_ENH ? '' : `<button class="btn-primary sm" data-act="enh-open" data-uid="${item.uid}">ไปหน้าตีบวก</button>`}</div>`;
  return `<div class="detail-head"><span class="di" style="color:${base.gcolor}">${icon(base.icon)}</span>
      <div>${frameRow(base)}<b>${gearLabel(item)}</b><small>${SLOT_LABEL[base.slot] || 'อาวุธ'} · ${GRADES_NAME(base.grade)} · ต้องเลเวล ${base.level} · ${stats}${base.classId ? ' · ' + (base.classId === g.character.classId ? 'สายของคุณ' : 'ของสายอาชีพอื่น') : ''}</small>
      <ul class="opts">${optionsHtml(item)}</ul></div></div>
    <div class="detail-actions">${btns.join('')}</div>${enh}${runeRow(item, base, runeSel)}`;
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

const KIND_LABEL = { hunt: 'ตีมอน', quest: 'เควส/เมือง', gather: 'เก็บเลเวล' };

function mapHtml(g) {
  const p = g.p;
  return Object.entries(MAPS).filter(([, m]) => !m.hidden).map(([id, m]) => {
    const ok = P.mapUnlocked(p, id);
    return `<div class="map-card${ok ? '' : ' locked'}${g.map === id ? ' here' : ''}">
      <div class="map-ico">${icon(id === 'town' ? 'shield' : id === 'forest' ? 'leaf' : 'ore')}</div>
      <div class="map-info"><b>${esc(m.name)}</b><small>${KIND_LABEL[m.kind] || ''} · ${m.levelText}${ok ? '' : ' · ต้องเลเวล ' + m.minLevel}</small></div>
      ${g.map === id ? '<span class="tag">อยู่ที่นี่</span>' : ok ? `<button class="btn-primary sm" data-act="travel" data-map="${id}">${icon('arrow')} ไป</button>` : `<span class="tag lock">${icon('lock')}</span>`}
    </div>`;
  }).join('');
}

function statusHtml(g) {
  const p = g.p;
  const s = g.stats;
  const sp = P.spiritOf(p, p.spirit);
  const spLine = sp ? `${SPIRIT_RARITY.find((r) => r.id === sp.rarity).name} · ${sp.passives.map((id) => SPIRIT_PASSIVES.find((x) => x.id === id).name).join(' · ') || 'ไม่มีพาสซีพ'}` : 'ยังไม่มีภูติ';
  const job = p.job ? JOB_NAMES[p.job] : `ยังไม่เปลี่ยนอาชีพ (Lv ${JOB_LEVEL})`;
  const pct = (v) => `${Math.round(v)}%`;
  const section = (title, rows) => `<div class="sub-title">${title}</div><div class="stat-list">${rows.map(([l, v]) => statRow(l, v)).join('')}</div>`;
  return `<div class="status-head"><canvas id="status-thumb" width="180" height="180"></canvas>
    <div><b>${esc(g.character.name)}</b><small>${CLASSES[g.character.classId].name} · ${esc(job)}</small>
    <small>เลเวล ${p.level} · ${fmt(p.gold)} เหรียญ</small>
    <div class="xp"><span style="width:${(p.exp / P.expToNext(p.level)) * 100}%"></span></div><small>${p.exp} / ${P.expToNext(p.level)} EXP</small></div></div>
    ${section('การโจมตี', [['พลังโจมตี', s.atk], ['คริติคอล', pct(s.crit)], ['ดาเมจคริติคอล', pct(s.critDmg)], ['ดาเมจสกิล', `+${s.skillMg}%`], ['ลดคูลดาวน์', `${s.cdr}%`]])}
    ${section('การป้องกันและทรัพยากร', [['ป้องกัน', s.def], ['HP สูงสุด', s.maxHp], ['MP สูงสุด', s.maxMp]])}
    ${section('โบนัส', [['EXP ที่ได้', `+${pct((s.expMul - 1) * 100)}`], ['เหรียญที่ได้', `+${pct((s.goldMul - 1) * 100)}`]])}
    <div class="sub-title">ภูติ</div><small class="spirit-line">${esc(spLine)}</small>
    <div class="sub-title">พาสซีพอาชีพ</div>${passiveHtml(p)}`;
}

// Detail panel for an owned spirit: rarity, passives, and the equip button.
function spiritDetail(sp, equipped) {
  const r = SPIRIT_RARITY.find((x) => x.id === sp.rarity);
  const passives = sp.passives.map((id) => {
    const x = SPIRIT_PASSIVES.find((y) => y.id === id);
    return `<li><b>${esc(x.name)}</b> · ${esc(x.desc)}</li>`;
  }).join('') || '<li class="muted">ไม่มีพาสซีพ</li>';
  const bonus = `ATK +${Math.round(r.atkPct)}% · HP +${r.hp}`;
  return `<div class="detail-head"><span class="di" style="background:${r.color};${r.rainbow ? 'background:linear-gradient(120deg,#ff5d73,#ffb84d,#58e39a,#4fa3ff,#b77bff)' : ''}">${icon('star')}</span>
      <div><b>ภูติ${esc(r.name)}</b><small>${bonus} · พาสซีพ ${sp.passives.length} ตัว</small><ul class="opts">${passives}</ul></div></div>
    <div class="detail-actions">${equipped ? '<span class="tag">กำลังใช้งาน</span>'
      : `<button class="btn-primary sm" data-act="equip-spirit" data-uid="${sp.uid}">ให้ภูติตัวนี้ติดตาม</button>`}
      ${equipped ? '<button class="btn-ghost sm" data-act="equip-spirit" data-uid="">เลิกให้ติดตาม</button>' : ''}</div>`;
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
  if (npcId === 'jobmaster') html += jobHtml(g);
  if (npcId === 'dungeonmaster') html += dungeonHtml(g);
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

// ---------- skill board: a grid of lines (columns) x tiers (rows), with a detail panel ----------
const LINE_COLORS = ['#ff7a9c', '#4aa8ff', '#34c79a', '#ffb020', '#a58bff'];
const sfxBtn = () => `<button class="sfx-btn" data-act="sfx" aria-label="เสียง">${icon(Sfx.muted ? 'mute' : 'sound')}</button>`;


// What a skill does with the hero's current stats, plus the rank-up table.
function skillDetail(g, sk, color) {
  const p = g.p;
  const rank = p.skills[sk.id] || 0;
  const st = g.stats;
  const kind = sk.heal ? 'ฮีลตัวเอง' : sk.shield ? 'ป้องกันตัวเอง' : 'โจมตี';
  const target = sk.heal || sk.shield ? 'ตัวเอง' : sk.aoe ? 'ทุกเป้าในระยะ' : 'เป้าเดี่ยว';
  const reason = rank ? null : P.canLearn(p, sk.id);
  const dmg = (r) => Math.round(st.atk * rankMult(sk, r) * (1 + st.skillMg / 100));
  const cd = (r) => (rankCooldown(sk, r, st.cdr) / 1000).toFixed(1);
  const rows = [];
  rows.push(['ประเภท', kind], ['เป้าหมาย', target]);
  rows.push(['ใช้ MP', sk.mp], ['คูลดาวน์', `${cd(Math.max(1, rank))} วิ`]);
  if (!sk.heal && !sk.shield) rows.push(['ระยะ', `${Math.round(sk.range / 40 * 10) / 10} ม.`]);
  if (sk.heal) rows.push(['ฮีล', `${Math.round(sk.heal * 100)}% ของ HP สูงสุด (${fmt(Math.round(st.maxHp * sk.heal))})`]);
  if (sk.shield) rows.push(['ลดความเสียหาย', `${Math.round(sk.shield * 100)}% นาน 5 วิ`]);
  const table = sk.mult ? `<div class="sk-ranks">${[1, 2, 3].map((r) => `<div class="${r === rank ? 'cur' : ''}${r > rank + 1 ? ' future' : ''}">
      <span>ระดับ ${r}</span><b>${fmt(dmg(r))} ดาเมจ</b><small>คูลดาวน์ ${cd(r)} วิ</small></div>`).join('')}</div>` : '';
  const btn = rank < MAX_RANK
    ? (reason ? `<small class="lock-note">${esc(reason)}</small>`
      : `<button class="btn-primary" data-act="learn" data-id="${sk.id}">${rank ? `อัปเป็นระดับ ${rank + 1}` : 'เรียนรู้สกิลนี้'}</button>`)
    : '<span class="tag">ระดับสูงสุดแล้ว</span>';
  const hot = `<div class="sk-assign"><span>${rank ? 'ตั้งปุ่มลัด' : 'เรียนรู้ก่อนจึงตั้งปุ่มลัดได้'}</span>${[1, 2, 3, 4, 5, 6].map((n) => `<button class="${p.hotbar[n - 1] === sk.id ? 'on' : ''}" data-act="hot" data-slot="${n}" data-id="${sk.id}" ${rank ? '' : 'disabled'}>${n}</button>`).join('')}</div>`;
  return `<div class="sk-head">
      <span class="sk-big" style="color:${color}">${icon(sk.icon)}</span>
      <div><b>${esc(sk.name)}</b><small>${esc(sk.lineName || 'สกิลกำหนดเอง')} · ${sk.tier ? `ขั้น ${sk.tier} · ต้องเลเวล ${sk.reqLv}` : 'สร้างจาก Skill Lab'}</small>
        <p>${esc(skillDesc(sk))}</p></div>
      <div class="sk-rank"><b>${rank}</b><small>/${MAX_RANK}</small></div>
    </div>
    <div class="sk-grid2">
      <div class="sk-facts">${rows.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <div class="sk-scale"><div class="sub-title">ค่าสเตตัสที่ใช้คำนวณ</div>
        <div class="sk-stat"><span>ATK</span><b>${fmt(st.atk)}</b></div>
        <div class="sk-stat"><span>สกิลดาเมจ</span><b>+${st.skillMg}%</b></div>
        <div class="sk-stat"><span>ลดคูลดาวน์</span><b>${st.cdr}%</b></div>
        <div class="sk-stat"><span>HP สูงสุด</span><b>${fmt(st.maxHp)}</b></div>
      </div>
    </div>
    ${table}
    <div class="sk-actions">${btn}</div>${hot}`;
}

// ---------- enhancement screen ----------
const FX_TEXT = { success: 'สำเร็จ!', fail: 'ไม่สำเร็จ', down: 'ลดระดับ', error: '' };
const FX_SOUND = { success: 'success', fail: 'fail', down: 'down', error: 'error' };

function enhHtml(g, w) {
  const p = g.p;
  const item = P.findGear(p, w.uid);
  if (!item) return '<div class="empty">ไม่พบไอเท็มนี้แล้ว</div><div class="sk-actions"><button class="btn-ghost" data-act="menu" data-menu="inventory">กลับกระเป๋า</button></div>';
  const base = GEAR[item.base];
  const max = item.enh >= MAX_ENH;
  const cost = P.enhCost(item.enh);
  const stones = P.enhStones(item.enh);
  const have = p.mats.enh_stone || 0;
  const rate = Math.round(enhRate(item.enh) * 100);
  const canAfford = p.gold >= cost && have >= stones;
  const pips = Array.from({ length: MAX_ENH }, (_, i) =>
    `<i class="pip${i < item.enh ? ' on' : ''}${i === item.enh && !max ? ' next' : ''}${i >= ENH_DOWN_FROM ? ' risk' : ''}"></i>`).join('');
  const fx = w.fx;
  const sparks = Array.from({ length: 12 }, (_, i) => `<i class="spark" style="--a:${i * 30}deg"></i>`).join('');
  const fxHtml = fx && FX_TEXT[fx.result]
    ? `<div class="enh-fx ${fx.result}" data-n="${fx.n}">${fx.result === 'success' ? `<div class="ring"></div><div class="ring r2"></div>${sparks}` : ''}
         <span>${FX_TEXT[fx.result]}${fx.result === 'success' ? ` +${item.enh}` : ''}</span></div>`
    : '';
  const stageCls = fx ? ` anim-${fx.result}` : '';
  const btnLabel = max ? 'ตีบวกถึงขีดสุดแล้ว' : !canAfford ? (p.gold < cost ? 'เหรียญไม่พอ' : 'หินเสริมพลังไม่พอ') : 'ตีบวก';
  const opts = item.opts.length ? item.opts.map((o) => `<li>${esc(P.optionLabel(o))}</li>`).join('') : '<li class="muted">ไม่มีออฟชั่นเสริม</li>';
  const stat = base.atk ? `พลังโจมตี ${base.atk}` : `ป้องกัน ${base.def} · HP ${base.hp}`;
  // What the next level adds, and whether it brings a new option
  const next = item.enh + 1;
  const gain = (v) => Math.round(v * (enhMult(next) - enhMult(item.enh)) * 10) / 10;
  const preview = max ? '' : `<div class="enh-preview"><span>ระดับถัดไป +${next}:</span>
      ${base.atk ? `<b>พลังโจมตี +${gain(base.atk)}</b>` : `<b>ป้องกัน +${gain(base.def)} · HP +${gain(base.hp)}</b>`}
      ${ENH_OPTION_AT.includes(next) ? '<em>+ ได้ออฟชั่นใหม่ 1 รายการ</em>' : ''}</div>`;

  return `<div class="enh-wrap">
    <div class="enh-left">
      <div class="enh-stage${stageCls}" style="--gc:${base.gcolor}">
        <div class="enh-aura"></div><div class="enh-aura a2"></div>
        <div class="enh-item">${icon(base.icon)}</div>
        ${fxHtml}
      </div>
      <div class="enh-level"><span>+${item.enh}</span>${max ? '' : `<i>→</i><span class="next">+${item.enh + 1}</span>`}</div>
      <div class="enh-name"><b>${gearLabel(item)}</b><small>${GRADES_NAME(base.grade)} · ${stat}</small></div>
      <ul class="opts">${opts}</ul>
      ${preview}
    </div>
    <div class="enh-right">
      <div class="enh-card">
        <div class="enh-rate"><div><small>โอกาสสำเร็จ</small><b>${max ? '—' : rate + '%'}</b></div>
          <div class="enh-bar"><span style="width:${max ? 100 : rate}%"></span></div></div>
        <div class="enh-costs">
          <div class="${p.gold < cost ? 'short' : ''}">${icon('coin')}<span>ค่าตีบวก</span><b>${fmt(cost)}</b></div>
          <div class="${have < stones ? 'short' : ''}">${icon('gem')}<span>หินเสริมพลัง</span><b>${stones} <small>(มี ${have})</small></b></div>
          <div>${icon('coin')}<span>เหรียญของคุณ</span><b>${fmt(p.gold)}</b></div>
        </div>
        <button class="enh-go${max || !canAfford ? ' off' : ''}" data-act="enh-do" data-uid="${item.uid}" ${max || !canAfford ? 'disabled' : ''}>${btnLabel}</button>
        ${max ? '' : `<small class="enh-note">ตั้งแต่ +${ENH_DOWN_FROM} ขึ้นไป ถ้าล้มเหลวจะลดลง 1 ระดับ</small>`}
      </div>
      <div class="enh-ladder">${pips}</div>
      <div class="enh-foot">
        <button class="btn-ghost sm" data-act="menu" data-menu="inventory">${icon('back')} กลับกระเป๋า</button>
        ${sfxBtn()}
      </div>
    </div>
  </div>`;
}

// ---------- level bands, item frames and job ----------
const BAND_COLORS = ['#7ad7ff', '#7be39a', '#ffd166', '#ff9a6b', '#c58bff', '#ff6f9c'];
const bandIndex = (level) => Math.max(0, Math.min(BAND_COLORS.length - 1, level / 5 - 1));
const bandColor = (level) => BAND_COLORS[bandIndex(level)];
const bandName = (level) => BANDS_LIST[bandIndex(level)].name;

// Frame line above an item's name: its level band and its grade.
function frameRow(base) {
  return `<div class="frame-row">
      <span class="lv-chip" style="--bc:${bandColor(base.level)}">เลเวล ${base.level} · ${bandName(base.level)}</span>
      <span class="gr-chip" style="--gc:${base.gcolor}">${GRADES_NAME(base.grade)}</span></div>`;
}

function jobTagHtml(p) {
  return p.job
    ? `<span class="job-tag">${icon('star')} ${esc(JOB_NAMES[p.job])}</span>`
    : `<span class="job-tag off">ยังไม่มีอาชีพขั้นที่ 1 (เลเวล ${JOB_LEVEL})</span>`;
}

// Job master window: at JOB_LEVEL pick one of the class's two jobs. Each job shows the skills it unlocks.
function jobHtml(g) {
  const p = g.p;
  if (p.job) return `<div class="job-note">อาชีพปัจจุบันของคุณคือ <b>${esc(JOB_NAMES[p.job])}</b> สกิลของอาชีพอื่นจะใช้ไม่ได้</div>`;
  if (p.level < JOB_LEVEL) return `<div class="job-note">กลับมาหาข้าเมื่อถึงเลเวล ${JOB_LEVEL} เพื่อเลือกอาชีพขั้นที่ 2 (เลือกได้ครั้งเดียว)</div>`;
  const cls = g.character.classId;
  const lineByID = Object.fromEntries((SKILL_TREE[cls] || []).map((l) => [l.line, l]));
  return `<div class="sub-title">${icon('star')} เลือกอาชีพขั้นที่ 2</div><div class="job-list">${(JOBS[cls] || []).map((job, i) => `
    <div class="job-card" style="--lc:${LINE_COLORS[i]}">
      <b>${esc(job.name)}</b>
      <small>สาย${job.lines.map((l) => esc(lineByID[l]?.name || l)).join(' + ')}</small>
      <ul class="job-skills">${job.lines.flatMap((l) => (lineByID[l]?.tiers || []).map((s) => `<li>${esc(s.name)} <em>Lv ${s.reqLv}</em></li>`)).join('')}</ul>
      <button class="btn-primary sm" data-act="job" data-job="${job.id}">เลือกอาชีพนี้</button>
    </div>`).join('')}</div>`;
}

// ---------- skill window: hero panel on the left, skill tree and detail on the right ----------
function skillsHtml(g, w) {
  const p = g.p;
  const st = g.stats;
  const cls = g.character.classId;
  const cols = (SKILL_TREE[cls] || []).map((line, i) => ({ name: line.name, color: LINE_COLORS[i], tiers: line.tiers }));
  const custom = Object.values(g.skillMap).filter((s) => s.line === 'custom');
  if (custom.length) cols.push({ name: 'สกิลกำหนดเอง', color: LINE_COLORS[4], tiers: custom });
  const all = cols.flatMap((c) => c.tiers);
  const selId = w.sk && g.skillMap[w.sk] ? w.sk : all[0]?.id;
  const selCol = cols.find((c) => c.tiers.some((s) => s.id === selId));

  const node = (sk, color) => {
    const rank = p.skills[sk.id] || 0;
    const locked = !rank && P.canLearn(p, sk.id);
    const jobLocked = !!P.skillJobLock(p, sk.id);
    const cls2 = ['sk-node', rank ? 'learned' : '', locked ? 'locked' : '', jobLocked ? 'jlock' : '', sk.id === selId ? 'sel' : ''].join(' ');
    return `<button class="${cls2}" style="--lc:${color};--pct:${(rank / MAX_RANK) * 100}%" data-act="sk-sel" data-id="${sk.id}"
      draggable="${rank ? 'true' : 'false'}" data-drag="${rank ? sk.id : ''}" title="${rank ? 'ลากไปวางที่ปุ่มลัด' : ''}">
      <span class="sk-orb">${icon(sk.icon)}<em>${rank}/${MAX_RANK}</em></span>
      <span class="sk-nm">${esc(sk.name)}</span>
      <span class="sk-lv">${sk.tier ? `ขั้น ${sk.tier} · Lv ${TIER_LEVEL[sk.tier - 1]}` : 'กำหนดเอง'}</span></button>`;
  };
  const board = cols.map((c) => `<div class="sk-col" style="--lc:${c.color}">
      <div class="sk-col-head"><b>${esc(c.name)}</b><small>${c.tiers.length} ขั้น</small></div>
      ${c.tiers.map((sk, i) => node(sk, c.color) + (i < c.tiers.length - 1 ? '<div class="sk-link"></div>' : '')).join('')}
    </div>`).join('');

  const slots = [1, 2, 3, 4, 5, 6].map((n) => {
    const s = p.hotbar[n - 1] && g.skillMap[p.hotbar[n - 1]];
    return `<button class="hb-row${s ? '' : ' empty'}" data-act="hot" data-slot="${n}" data-id="" data-drop="${n}"
      title="${s ? 'กดเพื่อเอาออก' : 'ลากสกิลมาวางที่นี่'}"><kbd>${n}</kbd>${s ? icon(s.icon) : '<i></i>'}<span>${s ? esc(s.name) : 'ลากสกิลมาวาง'}</span></button>`;
  }).join('');

  const hero = `<aside class="sk-hero">
      <canvas id="skill-thumb" width="180" height="180"></canvas>
      <b class="sk-hname">${esc(g.character.name)}</b>
      <div class="sk-hsub">${esc(CLASSES[cls].name)}</div>
      ${jobTagHtml(p)}
      <div class="sk-points"><span>แต้มสกิล</span><b>${P.skillPoints(p)}</b><small>+2 ต่อเลเวล</small></div>
      <div class="sub-title">ปุ่มลัด 1-6</div>
      <div class="hb-list">${slots}</div>
      <div class="sub-title">พาสซีพอาชีพ</div>${passiveHtml(p)}
      <div class="sub-title">สเตตัส</div>
      <div class="sk-hstats">${[['ATK', fmt(st.atk)], ['DEF', fmt(st.def)], ['HP', fmt(st.maxHp)], ['MP', fmt(st.maxMp)], ['สกิลดาเมจ', `+${st.skillMg}%`], ['ลดคูลดาวน์', `${st.cdr}%`]]
        .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      ${sfxBtn()}
    </aside>`;

  const detail = selId ? skillDetail(g, g.skillMap[selId], selCol?.color || LINE_COLORS[0]) : '<div class="empty">ไม่มีสกิล</div>';
  return `<div class="sk-layout">${hero}
    <section class="sk-main">
      <div class="sk-tree">${board}</div>
      <div class="sk-detail" style="--lc:${selCol?.color || LINE_COLORS[0]}">${detail}</div>
    </section></div>`;
}

// ---------- rune sockets, passives and dungeons ----------
// Sockets on a gear piece. A rune selected in the bag can be socketed into an empty one.
function runeRow(item, base, runeSel) {
  const slots = P.runeSlots(base);
  const socketed = item.runes || [];
  const cells = Array.from({ length: slots }, (_, i) => {
    const id = socketed[i];
    if (id) {
      return `<button class="rune-slot filled" style="--gc:${RARITY[MATERIALS[id].rarity].color}" data-act="unsocket" data-uid="${item.uid}" data-index="${i}" title="กดเพื่อถอดรูน">${icon('gem')}<span>${esc(MATERIALS[id].name)}</span></button>`;
    }
    return `<button class="rune-slot" data-act="socket" data-uid="${item.uid}" data-rune="${runeSel || ''}" ${runeSel ? '' : 'disabled'} title="${runeSel ? 'ฝังรูนที่เลือกในกระเป๋า' : 'เลือกรูนในกระเป๋าก่อน'}">${icon('gem')}<span>${runeSel ? 'ฝังรูนที่เลือก' : 'ช่องว่าง'}</span></button>`;
  }).join('');
  const bonus = socketed.map((id) => `+${MATERIALS[id].rune.v} ${MATERIALS[id].rune.label}`).join(' · ');
  return `<div class="rune-box"><div class="sub-title">${icon('gem')} รูน ${socketed.length}/${slots}</div>
    <div class="rune-row">${cells}</div>${bonus ? `<small class="rune-bonus">${esc(bonus)}</small>` : ''}</div>`;
}

function passiveHtml(p) {
  const list = P.passivesOf(p);
  if (!list.length) return '<small class="muted">ปลดพาสซีพเมื่อเลือกอาชีพขั้นที่ 1 แล้ว</small>';
  return list.map((ps, i) => `<div class="passive${ps.unlocked ? ' on' : ''}"><b>${esc(ps.name)}</b><small>${esc(ps.desc)}</small>
    <em>${ps.unlocked ? 'ทำงานอยู่' : `ปลดที่เลเวล ${i === 0 ? JOB_LEVEL : PASSIVE2_LEVEL}`}</em></div>`).join('');
}

// Dungeon master window: farm dungeons with daily entries, and the endless tower.
function dungeonHtml(g) {
  const p = g.p;
  const today = DG.dayKey();
  const farms = Object.entries(DUNGEONS).map(([id, d]) => {
    const locked = p.level < d.minLevel;
    const left = DG.entriesLeft(p, id, today);
    return `<div class="dg-card${locked ? ' locked' : ''}">
      <div class="dg-info"><b>${esc(d.name)}</b><small>${esc(d.desc)}</small>
        <div class="dg-meta"><span>เลเวล ${d.minLevel}+</span><span>${d.waves.length} ด่าน</span><span>วันนี้เหลือ ${left}/${d.daily}</span></div></div>
      ${locked ? `<span class="tag lock">${icon('lock')} เลเวล ${d.minLevel}</span>`
        : `<button class="btn-primary sm" data-act="dungeon" data-id="${id}" ${left > 0 ? '' : 'disabled'}>เข้า</button>`}
    </div>`;
  }).join('');
  const towerLocked = p.level < TOWER.minLevel;
  const full = p.dungeon.tower >= TOWER.floors;
  const tower = `<div class="dg-card tower${towerLocked ? ' locked' : ''}">
      <div class="dg-info"><b>${esc(TOWER.name)}</b><small>${esc(TOWER.desc)}</small>
        <div class="dg-meta"><span>${TOWER.floors} ชั้น</span><span>ผ่านแล้ว ${p.dungeon.tower} ชั้น</span></div></div>
      ${towerLocked ? `<span class="tag lock">${icon('lock')} เลเวล ${TOWER.minLevel}</span>`
        : `<button class="btn-primary sm" data-act="dungeon" data-id="tower" ${full ? 'disabled' : ''}>${full ? 'ผ่านครบแล้ว' : `เข้าชั้น ${p.dungeon.tower + 1}`}</button>`}
    </div>`;
  return `<div class="sub-title">${icon('shield')} ดันเจี้ยนประจำวัน</div><div class="dg-list">${farms}</div>
    <div class="sub-title">${icon('star')} หอคอย</div><div class="dg-list">${tower}</div>`;
}
