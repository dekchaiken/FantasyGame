import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CLASSES, fullAppearance } from './config.js';

// Chibi 3D character built from rounded primitives. Feet at y=0, facing +z.
// Everything is driven by the appearance config, so the creator, the lab and the world all match.

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const rbox = (w, h, d, r = 0.07) =>
  new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005));
const sphere = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);

function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function ell(parent, r, sx, sy, sz, mat, x, y, z) {
  const m = mesh(parent, sphere(r), mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// Action poses. Each one runs for `dur` seconds on top of the idle/walk cycle.
// apply() receives { arms, legs, body, head, k (0..1 progress), bump (0..1..0), dt }.
export const POSES = {
  swing: { dur: 0.36, apply: ({ arms, body, bump }) => {
    arms[1].rotation.x = -2.6 * bump;
    arms[1].rotation.z = -0.3 * bump;
    body.rotation.x = 0.2 * bump;
    body.position.z = 0.25 * bump;
  } },
  // Overhead slash: the weapon arm comes down in a wide arc.
  slash: { dur: 0.5, apply: ({ arms, body, k }) => {
    const a = k < 0.4 ? -2.9 * (k / 0.4) : -2.9 + 3.6 * ((k - 0.4) / 0.6);
    arms[1].rotation.x = a;
    arms[1].rotation.z = -0.5 * Math.sin(k * Math.PI);
    body.rotation.x = 0.25 * Math.sin(k * Math.PI);
  } },
  // Lunge forward with the weapon held out.
  thrust: { dur: 0.42, apply: ({ arms, body, bump }) => {
    arms[1].rotation.x = -1.5 * bump;
    body.rotation.x = 0.35 * bump;
    body.position.z = 0.45 * bump;
  } },
  // Spin: the body turns a full circle while the arms open.
  spin: { dur: 0.65, apply: ({ arms, body, k, bump }) => {
    body.rotation.y = k * Math.PI * 2;
    arms[0].rotation.z = 1.1 * bump;
    arms[1].rotation.z = -1.1 * bump;
  } },
  // Guard: the off-hand comes up in front of the chest.
  guard: { dur: 0.8, apply: ({ arms, body, bump }) => {
    arms[0].rotation.x = -1.4 * bump;
    arms[0].rotation.z = 0.5 * bump;
    arms[1].rotation.x = -1.0 * bump;
    body.rotation.x = -0.08 * bump;
  } },
  // Nova: both arms sweep out and up, the body rises slightly.
  nova: { dur: 0.7, apply: ({ arms, body, bump }) => {
    arms[0].rotation.x = -2.8 * bump;
    arms[1].rotation.x = -2.8 * bump;
    arms[0].rotation.z = 1.4 * bump;
    arms[1].rotation.z = -1.4 * bump;
    body.position.y += 0.12 * bump;
  } },
  // Heal: both hands drawn in to the chest and held there.
  heal: { dur: 0.9, apply: ({ arms, head, bump }) => {
    arms[0].rotation.x = -1.8 * bump;
    arms[1].rotation.x = -1.8 * bump;
    arms[0].rotation.z = 0.6 * bump;
    arms[1].rotation.z = -0.6 * bump;
    head.rotation.x = -0.12 * bump;
  } },
  // Cast: both arms raised high, the head tilts back.
  cast: { dur: 0.7, apply: ({ arms, body, head, bump }) => {
    arms[0].rotation.x = -2.5 * bump;
    arms[1].rotation.x = -2.5 * bump;
    body.position.y += 0.1 * bump;
    head.rotation.x = -0.15 * bump;
  } },
  // Shout: arms spread wide and the head goes back.
  shout: { dur: 0.6, apply: ({ arms, head, bump }) => {
    arms[0].rotation.z = 1.7 * bump;
    arms[1].rotation.z = -1.7 * bump;
    head.rotation.x = -0.25 * bump;
  } },
};

// Which pose a skill plays, from its effect type. Keeps the animation in step with the visual.
export function poseFor(skill) {
  const type = skill.fx?.type;
  if (skill.heal) return 'heal';
  if (skill.shield) return 'guard';
  if (type === 'slash' || type === 'blades') return 'slash';
  if (type === 'beam' || type === 'projectile' || type === 'dash') return 'thrust';
  if (type === 'nova' || type === 'wave' && skill.aoe) return 'nova';
  if (type === 'shout' || skill.icon === 'shout') return 'shout';
  if (skill.icon === 'whirl') return 'spin';
  return 'cast';
}

export function buildCharacter(input) {
  const cfg = { gender: input.gender || 'male', classId: input.classId || 'swordsman', appearance: fullAppearance(input.appearance) };
  const a = cfg.appearance;
  const cls = CLASSES[cfg.classId] || CLASSES.swordsman;
  const female = cfg.gender === 'female';

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = std(a.skin, { roughness: 0.5 });
  const hairM = std(a.hair, { roughness: 0.4 });
  const topM = std(a.top.color);
  const bottomM = std(a.bottom.color);
  const shoeM = std(a.shoes.color, { roughness: 0.5 });
  const ink = std('#2b2b3a', { roughness: 0.35 });
  const white = std('#ffffff', { roughness: 0.3 });
  const accent = std(cls.color, { roughness: 0.5 });
  const cheek = new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.55, depthWrite: false });

  // soft blob shadow under the feet
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.01;
  root.add(blob);

  // legs (pivot at hip so they can swing)
  const legsMat = a.bottom.style === 1 ? bottomM : skin;
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.12, 0.5, 0);
    body.add(pivot);
    mesh(pivot, rbox(0.17, 0.46, 0.19), legsMat, 0, -0.23, 0);
    const shoeH = [0.14, 0.26, 0.06][a.shoes.style] ?? 0.14;
    mesh(pivot, rbox(0.21, shoeH, 0.3, 0.07), shoeM, 0, -0.46 + shoeH / 2, 0.03);
    return pivot;
  });

  // bottoms
  if (a.bottom.style === 0) mesh(body, rbox(0.44, 0.22, 0.3), bottomM, 0, 0.52, 0);
  if (a.bottom.style === 1) mesh(body, rbox(0.44, 0.16, 0.3), bottomM, 0, 0.56, 0);
  if (a.bottom.style === 2) mesh(body, new THREE.CylinderGeometry(0.22, 0.36, 0.3, 20), bottomM, 0, 0.36, 0);

  // torso
  mesh(body, rbox(0.44, 0.44, 0.28), topM, 0, 0.72, 0);
  mesh(body, rbox(0.46, 0.07, 0.3, 0.03), accent, 0, 0.5, 0); // class belt
  if (a.top.style === 1) {
    mesh(body, rbox(0.455, 0.05, 0.285, 0.02), white, 0, 0.6, 0);
    mesh(body, rbox(0.455, 0.05, 0.285, 0.02), white, 0, 0.8, 0);
  }
  if (a.top.style === 2) {
    mesh(body, rbox(0.035, 0.44, 0.03, 0.01), ink, 0, 0.72, 0.15);
    mesh(body, rbox(0.46, 0.04, 0.3, 0.02), ink, 0, 0.93, 0);
  }
  if (a.top.style === 3) {
    const disc = mesh(body, new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20), white, 0, 0.76, 0.15);
    disc.rotation.x = Math.PI / 2;
    const emb = mesh(body, new THREE.CylinderGeometry(0.08, 0.08, 0.024, 20), accent, 0, 0.76, 0.152);
    emb.rotation.x = Math.PI / 2;
  }

  // arms (pivot at shoulder)
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.3, 0.92, 0);
    body.add(pivot);
    mesh(pivot, rbox(0.17, 0.22, 0.17, 0.08), topM, 0, -0.11, 0);
    mesh(pivot, rbox(0.13, 0.2, 0.13, 0.06), skin, 0, -0.31, 0);
    mesh(pivot, sphere(0.09), skin, 0, -0.44, 0);
    return pivot;
  });
  // The weapon sits in the hand (bottom of the arm) with its blade angled forward, not up over the shoulder.
  const placeWeapon = (w) => {
    w.position.set(0, -0.26, 0.04);
    w.rotation.set(0.55, 0, 0);
    return w;
  };
  let weapon = placeWeapon(buildWeapon(cls.weapon, cls.color, accent));
  arms[1].add(weapon);

  // head (pivot at neck)
  const head = new THREE.Group();
  head.position.set(0, 1.2, 0);
  body.add(head);
  ell(head, 0.42, 1, 0.96, 0.95, skin, 0, 0, 0);
  mesh(head, sphere(0.08, 12, 10), skin, -0.42, 0, 0);
  mesh(head, sphere(0.08, 12, 10), skin, 0.42, 0, 0);
  buildFace(head, a, ink, white, cheek, hairM, female);
  head.add(buildHair(a.hairStyle, hairM, accent));
  buildAccessory(head, a.accessory, cls.color, accent, white, ink);

  const hairGroup = head.children[head.children.length - 1];

  let actKind = null;
  let actT = 0;
  let auraRainbow = false;
  const auraMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const aura = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.62, 40), auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = 0.03;
  aura.visible = false;
  root.add(aura);
  return {
    group: root,
    // swaps the weapon model (gear line) in the right hand
    setWeapon(shape, color, grade = 0) {
      arms[1].remove(weapon);
      weapon.traverse((o) => o.geometry?.dispose());
      weapon = placeWeapon(buildWeapon(shape, color, std(color)));
      weapon.scale.setScalar(1 + 0.06 * grade);
      arms[1].add(weapon);
    },
    // A glowing ring under the feet. color null hides it; rainbow cycles hues (top grade).
    setAura(color, rainbow = false) {
      auraRainbow = rainbow;
      if (!color) {
        aura.visible = false;
        return;
      }
      aura.visible = true;
      auraMat.color.set(color);
    },
    // Tints the clothes: { top, bottom, shoes } colours.
    setLook(c = {}) {
      if (c.top) topM.color.set(c.top);
      if (c.bottom) bottomM.color.set(c.bottom);
      if (c.shoes) shoeM.color.set(c.shoes);
    },
    // Plays a short action pose on top of the idle/walk cycle: 'swing' (basic attack), 'cast' (skill), 'heal'.
    act(kind) {
      actKind = kind;
      actT = 0;
    },
    update(t, moving, dt = 0) {
      const sw = moving ? Math.sin(t * 9) : 0;
      body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.05 : Math.sin(t * 2) * 0.012;
      body.rotation.x = 0;
      body.position.z = 0;
      arms[0].rotation.z = 0;
      arms[1].rotation.z = 0;
      legs[0].rotation.x = sw * 0.7;
      legs[1].rotation.x = -sw * 0.7;
      const idle = moving ? 0 : Math.sin(t * 2) * 0.03;
      arms[0].rotation.x = -sw * 0.6 + idle;
      arms[1].rotation.x = sw * 0.6 - idle;
      head.rotation.y = Math.sin(t * 0.7) * 0.05;
      hairGroup.rotation.x = Math.sin(t * 3) * 0.02;
      if (aura.visible) {
        const pulse = 0.8 + 0.2 * Math.sin(t * 4);
        aura.scale.setScalar(pulse);
        aura.material.opacity = 0.35 + 0.15 * Math.sin(t * 4);
        if (auraRainbow) auraMat.color.setHSL((t * 0.25) % 1, 0.9, 0.6);
      }
      if (moving) body.rotation.x = 0.07;
      if (actKind) {
        actT += dt;
        const pose = POSES[actKind] || POSES.cast;
        const k = Math.min(1, actT / pose.dur);
        pose.apply({ arms, legs, body, head, k, bump: Math.sin(k * Math.PI), dt });
        if (k >= 1) actKind = null;
      }
    },
    dispose() {
      root.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    },
  };
}

function buildFace(head, a, ink, white, cheek, hairM, female) {
  const iris = std(a.eyeColor, { roughness: 0.3 });
  const style = a.faceStyle;

  const eye = (x, side) => {
    const g = new THREE.Group();
    g.position.set(x, 0, 0.36);
    head.add(g);
    const big = style === 2;
    const sclH = style === 1 ? 0.6 : 1.25;
    ell(g, 0.1, 0.95, sclH, 0.25, white, 0, 0, 0);
    ell(g, 0.1, big ? 0.85 : 0.72, big ? 1.2 : style === 1 ? 0.7 : 1.0, 0.3, iris, 0.01 * side, -0.005, 0.02);
    mesh(g, sphere(0.028, 10, 8), white, 0.03 * side, 0.045, 0.035);
    if (big) mesh(g, sphere(0.015, 8, 6), white, -0.03 * side, -0.03, 0.035);
    if (style === 1) mesh(g, rbox(0.2, 0.02, 0.04, 0.008), ink, 0, 0.075, 0.03);
    if (style === 3) mesh(g, rbox(0.22, 0.08, 0.05, 0.03), skin(a), 0, 0.09, 0.03);
  };
  eye(-0.16, -1);
  eye(0.16, 1);

  // eyebrows
  for (const s of [-1, 1]) {
    const brow = mesh(head, rbox(0.12, 0.024, 0.03, 0.01), hairM, s * 0.16, 0.17, 0.37);
    brow.rotation.z = -s * 0.25;
  }

  // smile
  const mouth = mesh(head, new THREE.TorusGeometry(0.045, 0.012, 8, 20, Math.PI), std('#c2555a'), 0, -0.16, 0.39);
  mouth.rotation.z = Math.PI;

  // cheeks
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), cheek);
    c.position.set(s * 0.24, -0.06, 0.37);
    head.add(c);
  }
  void female;
}

// the skin material used for the upper eyelid of the "sleepy" face
function skin(a) {
  return std(a.skin, { roughness: 0.5 });
}

function buildHair(style, hairM, accent) {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.445, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36), hairM);
  cap.position.y = 0.03;
  cap.castShadow = true;
  g.add(cap);

  // bangs: flattened ellipsoids so they read as a soft fringe rather than bumps
  const fringe = (xs, y, z, r) => xs.forEach((x) => {
    const m = mesh(g, sphere(r, 14, 10), hairM, x, y, z);
    m.scale.set(0.9, 0.5, 0.7);
  });

  switch (style) {
    case 0:
      fringe([-0.2, 0, 0.2], 0.3, 0.33, 0.11);
      break;
    case 1:
      mesh(g, rbox(0.84, 0.9, 0.3, 0.12), hairM, 0, -0.25, -0.2);
      mesh(g, rbox(0.12, 0.42, 0.1, 0.05), hairM, -0.33, -0.08, 0.2);
      mesh(g, rbox(0.12, 0.42, 0.1, 0.05), hairM, 0.33, -0.08, 0.2);
      fringe([-0.12, 0.12], 0.3, 0.34, 0.11);
      break;
    case 2:
      mesh(g, sphere(0.15), hairM, 0, 0.22, -0.4);
      mesh(g, rbox(0.14, 0.46, 0.14, 0.06), hairM, 0, -0.05, -0.46).rotation.x = 0.25;
      mesh(g, sphere(0.05, 10, 8), accent, 0, 0.14, -0.42);
      fringe([-0.2, 0, 0.2], 0.3, 0.33, 0.1);
      break;
    case 3:
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const cone = mesh(g, new THREE.ConeGeometry(0.1, 0.32, 8), hairM, (t - 0.5) * 0.6, 0.46 - Math.abs(t - 0.5) * 0.2, 0.05);
        cone.rotation.z = -(t - 0.5) * 0.9;
      }
      break;
    case 4:
      fringe([-0.2, 0, 0.2], 0.3, 0.33, 0.11);
      for (const s of [-1, 1]) {
        mesh(g, rbox(0.14, 0.5, 0.16, 0.06), hairM, s * 0.42, -0.1, -0.02);
        mesh(g, sphere(0.05, 10, 8), accent, s * 0.42, -0.36, -0.02);
      }
      break;
    case 5:
      mesh(g, sphere(0.2), hairM, 0, 0.5, -0.05);
      fringe([-0.12, 0.12], 0.3, 0.34, 0.11);
      break;
    default:
      break;
  }
  return g;
}

function buildAccessory(head, acc, clsColor, accent, white, ink) {
  if (acc === 1) {
    const ribbon = std('#ff5c8a');
    mesh(head, sphere(0.05, 10, 8), ribbon, 0.38, 0.3, 0.06);
    mesh(head, rbox(0.12, 0.07, 0.04, 0.02), ribbon, 0.44, 0.3, 0.06).rotation.z = 0.4;
    mesh(head, rbox(0.12, 0.07, 0.04, 0.02), ribbon, 0.32, 0.3, 0.06).rotation.z = -0.4;
  }
  if (acc === 2) {
    const hat = std(clsColor, { roughness: 0.5 });
    mesh(head, new THREE.CylinderGeometry(0.52, 0.52, 0.06, 28), hat, 0, 0.36, 0);
    mesh(head, new THREE.CylinderGeometry(0.31, 0.34, 0.26, 28), hat, 0, 0.52, 0);
    mesh(head, new THREE.CylinderGeometry(0.345, 0.345, 0.05, 28), white, 0, 0.4, 0);
  }
  if (acc === 3) {
    for (const x of [-0.16, 0.16]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 24), ink);
      ring.position.set(x, 0, 0.4);
      head.add(ring);
    }
    mesh(head, rbox(0.1, 0.02, 0.02, 0.01), ink, 0, 0.02, 0.4);
  }
  void accent;
}

function buildWeapon(kind, colorHex, accent) {
  const g = new THREE.Group();
  const steel = std('#dfe9f5', { metalness: 0.6, roughness: 0.25 });
  const wood = std('#8a5a32');
  const glow = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.6 });

  if (kind === 'sword') {
    mesh(g, rbox(0.05, 0.62, 0.02, 0.01), steel, 0, 0.36, 0);
    mesh(g, rbox(0.2, 0.04, 0.05, 0.015), accent, 0, 0.06, 0);
    mesh(g, new THREE.CylinderGeometry(0.022, 0.022, 0.14, 10), wood, 0, -0.02, 0);
  } else if (kind === 'dagger') {
    mesh(g, rbox(0.03, 0.36, 0.015, 0.008), steel, 0, 0.2, 0);
    mesh(g, rbox(0.12, 0.03, 0.04, 0.01), accent, 0, 0.02, 0);
    mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.1, 10), wood, 0, -0.05, 0);
  } else if (kind === 'staff') {
    mesh(g, new THREE.CylinderGeometry(0.025, 0.025, 1.2, 10), wood, 0, 0.5, 0);
    mesh(g, sphere(0.11, 20, 16), glow, 0, 1.12, 0);
  } else if (kind === 'axe') {
    mesh(g, new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), wood, 0, 0.3, 0);
    mesh(g, rbox(0.34, 0.3, 0.05, 0.03), steel, 0.12, 0.62, 0);
  } else if (kind === 'sickle') {
    mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), wood, 0, 0.1, 0);
    const hook = mesh(g, new THREE.TorusGeometry(0.22, 0.03, 6, 16, Math.PI * 0.9), steel, 0.14, 0.52, 0);
    hook.rotation.z = Math.PI * 0.45;
  } else if (kind === 'crystal') {
    mesh(g, new THREE.CylinderGeometry(0.025, 0.025, 1.1, 8), wood, 0, 0.45, 0);
    mesh(g, new THREE.OctahedronGeometry(0.16, 0), glow, 0, 1.12, 0);
  } else if (kind === 'lantern') {
    mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), wood, 0, 0.12, 0);
    mesh(g, rbox(0.18, 0.22, 0.18, 0.04), glow, 0, 0.42, 0);
  } else if (kind === 'book') {
    mesh(g, rbox(0.3, 0.24, 0.07, 0.02), glow, 0, 0.12, 0);
    mesh(g, rbox(0.27, 0.2, 0.08, 0.01), white(), 0, 0.12, 0.005);
  }
  g.position.set(0, -0.44, 0.06);
  g.rotation.x = -0.9;
  return g;
}

function white() {
  return std('#ffffff', { roughness: 0.3 });
}
