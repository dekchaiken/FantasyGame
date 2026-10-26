import { CLASSES, OPTIONS, PALETTE, HAIR_COLORS, SKIN_COLORS, EYE_COLORS } from './config.js';
import { icon } from './icons.js';

// Character designer panel. Used by the in-game creator and by the Character Lab page.
// `root` is re-rendered on every change. `opts.state` is mutated in place.
const TABS = [
  ['hair', 'ทรงผม', 'hair'],
  ['face', 'หน้า', 'face'],
  ['skin', 'ผิว', 'skin'],
  ['top', 'เสื้อ', 'shirt'],
  ['bottom', 'กางเกง', 'pants'],
  ['shoes', 'รองเท้า', 'shoe'],
  ['acc', 'เสริม', 'sparkle'],
];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const setPath = (obj, path, v) => {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = v;
};

export function mountDesigner(root, opts) {
  root._opts = opts;
  root._tab = root._tab || 'hair';
  if (!root._bound) {
    root._bound = true;
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const o = root._opts;
      const s = o.state;
      const { act, val, key } = el.dataset;
      if (act === 'back') return o.onBack?.();
      if (act === 'confirm') return o.onConfirm?.();
      if (act === 'tab') root._tab = val;
      else if (act === 'gender') {
        s.gender = val;
        if (val === 'male' && s.appearance.bottom.style === 2) s.appearance.bottom.style = 0;
      } else if (act === 'class') s.classId = val;
      else if (act === 'opt') setPath(s.appearance, key, Number(val));
      else if (act === 'color') setPath(s.appearance, key, val);
      else if (act === 'rand') randomize(s);
      else return;
      render(root);
      o.onChange?.(s);
    });
    root.addEventListener('input', (e) => {
      if (e.target.matches('[data-field="name"]')) root._opts.state.name = e.target.value;
    });
  }
  render(root);
}

function randomize(s) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const ri = (n) => Math.floor(Math.random() * n);
  s.gender = Math.random() < 0.5 ? 'male' : 'female';
  s.classId = pick(Object.keys(CLASSES));
  s.appearance = {
    hairStyle: ri(OPTIONS.hairStyle.length),
    hair: pick(HAIR_COLORS),
    faceStyle: ri(OPTIONS.faceStyle.length),
    eyeColor: pick(EYE_COLORS),
    skin: pick(SKIN_COLORS),
    top: { style: ri(OPTIONS.topStyle.length), color: pick(PALETTE) },
    bottom: { style: ri(s.gender === 'female' ? 3 : 2), color: pick(PALETTE) },
    shoes: { style: ri(OPTIONS.shoeStyle.length), color: pick(PALETTE) },
    accessory: ri(OPTIONS.accessory.length),
  };
}

function render(root) {
  const o = root._opts;
  const s = o.state;
  const a = s.appearance;
  const tab = root._tab;

  const tiles = (key, items, cur) =>
    `<div class="tiles">${items.map((label, i) =>
      `<button class="tile${cur === i ? ' on' : ''}" data-act="opt" data-key="${key}" data-val="${i}">${esc(label)}</button>`).join('')}</div>`;
  const swatches = (key, colors, cur) =>
    `<div class="swatches">${colors.map((c) =>
      `<button class="swatch${cur === c ? ' on' : ''}" style="background:${c}" data-act="color" data-key="${key}" data-val="${c}" aria-label="${c}"></button>`).join('')}</div>`;
  const sub = (t) => `<div class="sub">${t}</div>`;

  let body = '';
  switch (tab) {
    case 'hair':
      body = tiles('hairStyle', OPTIONS.hairStyle, a.hairStyle) + sub('สีผม') + swatches('hair', HAIR_COLORS, a.hair);
      break;
    case 'face':
      body = tiles('faceStyle', OPTIONS.faceStyle, a.faceStyle) + sub('สีตา') + swatches('eyeColor', EYE_COLORS, a.eyeColor);
      break;
    case 'skin':
      body = sub('สีผิว') + swatches('skin', SKIN_COLORS, a.skin);
      break;
    case 'top':
      body = tiles('top.style', OPTIONS.topStyle, a.top.style) + sub('สีเสื้อ') + swatches('top.color', PALETTE, a.top.color);
      break;
    case 'bottom': {
      const styles = s.gender === 'female' ? OPTIONS.bottomStyle : OPTIONS.bottomStyle.slice(0, 2);
      body = tiles('bottom.style', styles, a.bottom.style) + sub('สีกางเกง / กระโปรง') + swatches('bottom.color', PALETTE, a.bottom.color);
      break;
    }
    case 'shoes':
      body = tiles('shoes.style', OPTIONS.shoeStyle, a.shoes.style) + sub('สีรองเท้า') + swatches('shoes.color', PALETTE, a.shoes.color);
      break;
    case 'acc':
      body = tiles('accessory', OPTIONS.accessory, a.accessory);
      break;
    default:
      break;
  }

  const classChips = Object.keys(CLASSES).map((id) =>
    `<button class="chip${s.classId === id ? ' on' : ''}" style="--c:${CLASSES[id].color}" data-act="class" data-val="${id}">${icon(CLASSES[id].icon)}<span>${CLASSES[id].name}</span></button>`).join('');

  root.innerHTML = `
    <div class="d-top">
      <div class="gender">
        <button class="gbtn${s.gender === 'male' ? ' on' : ''}" data-act="gender" data-val="male">ชาย</button>
        <button class="gbtn${s.gender === 'female' ? ' on' : ''}" data-act="gender" data-val="female">หญิง</button>
      </div>
      <button class="btn-ghost sm" data-act="rand">สุ่มหน้าตา</button>
    </div>
    ${o.showName ? `<input class="name-input" data-field="name" maxlength="12" placeholder="ชื่อตัวละคร (2-12 ตัวอักษร)" value="${esc(s.name || '')}">` : ''}
    <div class="classes">${classChips}</div>
    <div class="d-tabs">${TABS.map(([id, label, ic]) =>
      `<button class="dtab${tab === id ? ' on' : ''}" data-act="tab" data-val="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</div>
    <div class="d-body">${body}</div>
    <p class="error d-error"></p>
    <div class="d-foot">
      <button class="btn-ghost" data-act="back">${esc(o.backText || 'ย้อนกลับ')}</button>
      <button class="btn-primary" data-act="confirm">${esc(o.confirmText || 'ยืนยัน')}</button>
    </div>`;
}
