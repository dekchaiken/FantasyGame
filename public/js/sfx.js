// Synthesised sound effects (WebAudio, no asset files). Browsers only start audio after a user gesture,
// and every call here is made from a click, so the context is created on first use.
const KEY = 'sr_sfx_muted';
let ctx = null;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

function audio() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// One note: a short oscillator with a fast attack and exponential release.
function tone(freq, start, dur, { type = 'triangle', vol = 0.18, slide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// A bright rising arpeggio for success; more notes and a higher top at higher enhancement levels.
const SOUNDS = {
  click: () => tone(880, 0, 0.06, { type: 'sine', vol: 0.12 }),
  tab: () => tone(620, 0, 0.05, { type: 'sine', vol: 0.1 }),
  enhance: () => [0, 0.06, 0.12].forEach((t, i) => tone(330 + i * 60, t, 0.09, { type: 'square', vol: 0.05 })),
  success: (lv = 0) => {
    const base = 523 + Math.min(lv, 15) * 18;
    [0, 4, 7, 12].forEach((n, i) => tone(base * Math.pow(2, n / 12), i * 0.07, 0.28, { type: 'triangle', vol: 0.2 }));
    tone(base * 2, 0.3, 0.5, { type: 'sine', vol: 0.12 });
  },
  fail: () => tone(260, 0, 0.35, { type: 'sawtooth', vol: 0.09, slide: 0.6 }),
  down: () => {
    tone(480, 0, 0.18, { type: 'square', vol: 0.08, slide: 0.5 });
    tone(300, 0.16, 0.3, { type: 'square', vol: 0.07, slide: 0.45 });
  },
  learn: () => [0, 5, 9].forEach((n, i) => tone(660 * Math.pow(2, n / 12), i * 0.09, 0.3, { type: 'triangle', vol: 0.16 })),
  error: () => { tone(200, 0, 0.12, { type: 'square', vol: 0.06 }); tone(170, 0.14, 0.14, { type: 'square', vol: 0.06 }); },
};

export const Sfx = {
  get muted() { return muted; },
  play(name, arg) {
    const fn = SOUNDS[name];
    if (fn) fn(arg);
  },
  setMuted(on) {
    muted = !!on;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
    if (!muted) audio();
  },
};
