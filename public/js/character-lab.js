import { Stage } from './stage.js';
import { Menu } from './menu.js';
import { mountDesigner } from './designer.js';
import { DEFAULT_APPEARANCE } from './config.js';

// Standalone character designer. Same panel and 3D model as the in-game creator,
// without an account. Output is JSON you can paste into a character record.
const $ = (id) => document.getElementById(id);

const freshState = () => ({ name: 'ตัวอย่าง', gender: 'female', classId: 'mage', appearance: structuredClone(DEFAULT_APPEARANCE) });
const state = freshState();

function refreshJson() {
  const { name, gender, classId, appearance } = state;
  $('export-json').value = JSON.stringify({ name, gender, classId, appearance }, null, 2);
}

function mount() {
  mountDesigner($('designer'), {
    state,
    showName: true,
    backText: 'รีเซ็ต',
    confirmText: 'คัดลอก JSON',
    onChange: (s) => {
      Menu.setCharacter(s);
      refreshJson();
    },
    onBack: () => {
      Object.assign(state, freshState());
      Menu.setCharacter(state);
      mount();
      refreshJson();
    },
    onConfirm: async () => {
      refreshJson();
      try { await navigator.clipboard.writeText($('export-json').value); } catch { /* clipboard blocked: text is in the box */ }
      $('export-json').select();
    },
  });
}

Stage.init($('bg-canvas'));
Menu.setView('creator');
Menu.setCharacter(state);
Stage.use(Menu);
mount();
refreshJson();
