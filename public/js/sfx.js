// Synthesised sound effects (WebAudio, no asset files). Browsers only start audio after a user gesture,
// and the first sound is played from a click or a key press, so the context is created on first use.
const KEY = 'sr_sfx_muted';
const MAX_VOICES = 18; // at most this many sounds at once, so a crowd does not turn into noise
let ctx = null;
let master = null;
let noise = null;
let voices = 0;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

function audio() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A sound starts only when there is room; the voice count drops when it ends.
function claim(a, dur) {
  if (voices >= MAX_VOICES) return false;
  voices++;
  setTimeout(() => { voices--; }, dur * 1000 + 30);
  return true;
}

// One note: a short oscillator with a fast attack and exponential release.
function tone(freq, start, dur, { type = 'triangle', vol = 0.18, slide = 0 } = {}) {
  const a = audio();
  if (!a || !claim(a, dur + start)) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Filtered white noise: the basis of footsteps, impacts and whooshes.
function hiss(dur, { freq = 1200, q = 0.8, type = 'bandpass', vol = 0.2, start = 0, sweep = 0 } = {}) {
  const a = audio();
  if (!a || !claim(a, dur + start)) return;
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate * 1, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = a.currentTime + start;
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0, Math.random() * 0.5, dur + 0.05);
  src.stop(t0 + dur + 0.05);
}

// Monster voices by body shape. A death sound is the same voice dropping away.
const VOICE = {
  slime: { type: 'sine', from: 520, to: 260, dur: 0.22 },
  mushroom: { type: 'triangle', from: 700, to: 420, dur: 0.16 },
  wolf: { type: 'sawtooth', from: 180, to: 110, dur: 0.3 },
  bat: { type: 'square', from: 1300, to: 900, dur: 0.12 },
  golem: { type: 'square', from: 110, to: 70, dur: 0.35 },
  boss: { type: 'sawtooth', from: 90, to: 50, dur: 0.6 },
};

const SOUNDS = {
  click: () => tone(880, 0, 0.06, { type: 'sine', vol: 0.12 }),
  tab: () => tone(620, 0, 0.05, { type: 'sine', vol: 0.1 }),
  error: () => { tone(200, 0, 0.12, { type: 'square', vol: 0.06 }); tone(170, 0.14, 0.14, { type: 'square', vol: 0.06 }); },

  // movement and combat
  step: () => hiss(0.07, { freq: 900 + Math.random() * 400, q: 1.2, vol: 0.09, type: 'lowpass' }),
  swing: (cls) => {
    if (cls === 'mage' || cls === 'priest') tone(660, 0, 0.14, { type: 'sine', vol: 0.09, slide: 1.6 });
    else hiss(0.16, { freq: 2600, q: 0.7, vol: 0.14, sweep: 0.5 });
  },
  hit: () => { hiss(0.09, { freq: 300, q: 0.9, type: 'lowpass', vol: 0.3 }); tone(150, 0, 0.08, { type: 'triangle', vol: 0.12, slide: 0.6 }); },
  crit: () => {
    hiss(0.12, { freq: 1800, q: 0.9, vol: 0.2 });
    [1046, 1318, 1568].forEach((f, i) => tone(f, i * 0.04, 0.16, { type: 'triangle', vol: 0.12 }));
  },
  monsterHurt: (shape = 'slime') => {
    const v = VOICE[shape] || VOICE.slime;
    tone(v.from, 0, v.dur * 0.6, { type: v.type, vol: 0.09, slide: v.to / v.from });
  },
  monsterDie: (shape = 'slime') => {
    const v = VOICE[shape] || VOICE.slime;
    tone(v.from, 0, v.dur, { type: v.type, vol: 0.12, slide: 0.25 });
    hiss(0.18, { freq: 500, q: 0.6, vol: 0.12, sweep: 0.3 });
  },
  heroHurt: () => { tone(330, 0, 0.18, { type: 'square', vol: 0.12, slide: 0.5 }); hiss(0.12, { freq: 400, type: 'lowpass', vol: 0.15 }); },
  cast: (kind = 'cast') => {
    if (kind === 'heal') {
      [660, 830, 990].forEach((f, i) => tone(f, i * 0.07, 0.22, { type: 'sine', vol: 0.12 }));
    } else if (kind === 'guard') {
      tone(330, 0, 0.3, { type: 'triangle', vol: 0.14, slide: 1.5 });
    } else {
      hiss(0.35, { freq: 500, q: 0.8, vol: 0.12, sweep: 3 });
      tone(440, 0.05, 0.3, { type: 'sine', vol: 0.09, slide: 1.8 });
    }
  },

  // world and items
  pickup: () => [880, 1175].forEach((f, i) => tone(f, i * 0.05, 0.14, { type: 'sine', vol: 0.12 })),
  coin: () => [1318, 1760].forEach((f, i) => tone(f, i * 0.06, 0.1, { type: 'triangle', vol: 0.08 })),
  portal: () => { hiss(0.6, { freq: 300, q: 1.2, vol: 0.14, sweep: 4 }); tone(260, 0.1, 0.4, { type: 'sine', vol: 0.08, slide: 3 }); },
  levelup: () => [0, 4, 7, 12, 16].forEach((n, i) => tone(523 * Math.pow(2, n / 12), i * 0.09, 0.36, { type: 'triangle', vol: 0.16 })),

  // enhancement, learning and results (used by the UI)
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
