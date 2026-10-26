import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { blocked } from './nav.js';

// Monsters: procedural 3D models plus a small state machine (idle -> chase -> return, and dead -> respawn).
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
};
const rbox = (w, h, d, r = 0.1) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));

function buildModel(def) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const col = new THREE.Color(def.color);
  const mats = [];
  const bodyMat = std(col, { emissive: col, emissiveIntensity: 0.05 });
  mats.push(bodyMat);
  const animParts = {};

  if (def.shape === 'slime') {
    const m = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.82, roughness: 0.2, emissive: col, emissiveIntensity: 0.25 });
    mats.push(m);
    const blob = add(body, new THREE.SphereGeometry(0.7, 24, 18), m, 0, 0.5, 0);
    blob.scale.set(1, 0.75, 1);
    for (const s of [-1, 1]) {
      add(body, new THREE.SphereGeometry(0.16, 12, 10), std('#ffffff'), s * 0.24, 0.72, 0.55);
      add(body, new THREE.SphereGeometry(0.08, 10, 8), std('#1a1a2e'), s * 0.24, 0.7, 0.66);
    }
    animParts.squash = blob;
  } else if (def.shape === 'wolf') {
    const dark = std('#4a5468');
    add(body, rbox(1.1, 0.55, 0.5), bodyMat, 0, 0.8, 0);
    add(body, rbox(0.5, 0.45, 0.45), bodyMat, 0.72, 1.02, 0);
    add(body, rbox(0.3, 0.2, 0.25, 0.06), dark, 1.0, 0.92, 0);
    add(body, new THREE.ConeGeometry(0.12, 0.3, 6), dark, 0.62, 1.4, 0.15);
    add(body, new THREE.ConeGeometry(0.12, 0.3, 6), dark, 0.62, 1.4, -0.15);
    const tail = add(body, new THREE.ConeGeometry(0.1, 0.6, 6), dark, -0.7, 1.0, 0);
    tail.rotation.z = 1.1;
    for (const [x, z] of [[0.38, 0.18], [0.38, -0.18], [-0.38, 0.18], [-0.38, -0.18]]) {
      animParts[`leg${x > 0 ? 'F' : 'B'}${z > 0 ? 'L' : 'R'}`] = add(body, rbox(0.14, 0.5, 0.14, 0.05), dark, x, 0.25, z);
    }
    for (const z of [-0.14, 0.14]) add(body, new THREE.SphereGeometry(0.06, 8, 6), std('#ff5d73', { emissive: '#ff5d73', emissiveIntensity: 1 }), 0.98, 1.0, z);
  } else if (def.shape === 'mushroom') {
    add(body, new THREE.CylinderGeometry(0.16, 0.22, 0.6, 10), std('#f3e9d2'), 0, 0.3, 0);
    add(body, new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat, 0, 0.6, 0);
    for (const [x, y, z] of [[0.22, 0.85, 0.15], [-0.2, 0.9, -0.1], [0.05, 0.98, -0.3]]) {
      add(body, new THREE.SphereGeometry(0.07, 8, 6), std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 }), x, y, z);
    }
    add(body, new THREE.SphereGeometry(0.06, 8, 6), std('#1a1a2e'), -0.12, 0.3, 0.16);
    add(body, new THREE.SphereGeometry(0.06, 8, 6), std('#1a1a2e'), 0.12, 0.3, 0.16);
  } else if (def.shape === 'bat') {
    const wing = std('#3a2f52');
    add(body, new THREE.SphereGeometry(0.28, 14, 10), bodyMat, 0, 1.0, 0);
    for (const s of [-1, 1]) {
      const w = add(body, rbox(0.95, 0.04, 0.55, 0.02), wing, s * 0.55, 1.05, 0);
      w.rotation.z = s * 0.25;
      add(body, new THREE.SphereGeometry(0.06, 8, 6), std('#ff5d73', { emissive: '#ff5d73', emissiveIntensity: 1 }), s * 0.1, 1.08, 0.22);
    }
  } else if (def.shape === 'golem') {
    const rock = std('#3d3a46', { roughness: 0.9 });
    mats.push(rock);
    add(body, rbox(1.1, 1.2, 0.8, 0.14), rock, 0, 1.5, 0);
    add(body, rbox(0.7, 0.6, 0.6, 0.14), rock, 0, 2.5, 0);
    add(body, rbox(0.35, 1.1, 0.35, 0.1), rock, -0.85, 1.4, 0);
    add(body, rbox(0.35, 1.1, 0.35, 0.1), rock, 0.85, 1.4, 0);
    add(body, rbox(0.45, 0.9, 0.5, 0.1), rock, -0.35, 0.45, 0);
    add(body, rbox(0.45, 0.9, 0.5, 0.1), rock, 0.35, 0.45, 0);
    const glow = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2 });
    mats.push(glow);
    for (const [x, y, z, w, h] of [[0.2, 1.7, 0.41, 0.08, 0.7], [-0.3, 1.1, 0.41, 0.06, 0.5], [0.05, 1.9, 0.41, 0.06, 0.9]]) {
      add(body, rbox(w, h, 0.02, 0.01), glow, x, y, z);
    }
    for (const x of [-0.16, 0.16]) add(body, new THREE.SphereGeometry(0.08, 10, 8), glow, x, 2.55, 0.32);
  }

  // remember each material's resting glow so the hit flash can restore it
  for (const m of mats) m.userData.base = m.emissiveIntensity;
  root.scale.setScalar(def.size);
  return { group: root, body, mats, animParts, bodyMat };
}

export class Monster {
  constructor(scene, id, def, home) {
    this.id = id;
    this.def = def;
    this.home = { x: home.x, z: home.z };
    this.x = home.x;
    this.z = home.z;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.alive = true;
    this.state = 'idle';
    this.angry = false;
    this.cd = 0.4;
    this.wanderT = Math.random() * 2;
    this.wander = { x: this.x, z: this.z };
    this.flashT = 0;
    this.barT = 0;
    this.deadT = 0;
    this.respawnT = 0;
    this.model = buildModel(def);
    this.group = this.model.group;
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(this.group);
    this.bar = makeBar(def.shape === 'golem' ? 3.8 : def.shape === 'wolf' ? 2.0 : def.shape === 'bat' ? 2.0 : 1.5);
    this.group.add(this.bar);
    this.phase = Math.random() * 10;
  }

  // Returns true when this hit kills the monster.
  hit(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flashT = 0.12;
    this.barT = 3;
    this.angry = true;
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dead';
      this.deadT = 0.45;
      this.respawnT = this.def.respawn;
      return true;
    }
    return false;
  }

  // Advances AI and animation. `hero` is {x, z, alive}. Returns true when the monster attacks this frame.
  update(dt, t, hero, solids = []) {
    this.solids = solids;
    this.phase += dt;
    if (!this.alive) {
      this.deadT -= dt;
      const k = Math.max(0, this.deadT / 0.45);
      this.group.scale.setScalar(this.def.size * k);
      if (this.deadT <= 0) this.group.visible = false;
      this.respawnT -= dt;
      if (this.respawnT <= 0 && !this.noRespawn) this.respawn();
      return false;
    }

    const dx = hero.alive ? hero.x - this.x : 0;
    const dz = hero.alive ? hero.z - this.z : 0;
    const dist = Math.hypot(dx, dz);
    const homeDist = Math.hypot(this.home.x - this.x, this.home.z - this.z);

    if (this.state !== 'return' && hero.alive && (dist < this.def.aggro || (this.angry && dist < 14))) this.state = 'chase';
    if (this.state === 'chase' && (dist > 16 || !hero.alive)) {
      this.state = 'return';
      this.angry = false;
    }
    if (this.state === 'return' && homeDist < 0.5) this.state = 'idle';

    let moving = false;
    let attacked = false;
    this.cd -= dt;

    if (this.state === 'chase') {
      if (dist > this.def.range * 0.9) {
        moving = this.moveToward(this.x + dx, this.z + dz, this.def.speed * dt);
      } else if (this.cd <= 0) {
        attacked = true;
        this.cd = this.def.cd;
      }
      this.faceAngle(dx, dz, dt);
    } else if (this.state === 'return') {
      moving = this.moveToward(this.home.x, this.home.z, this.def.speed * 1.4 * dt);
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2.5 + Math.random() * 2.5;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 3.5;
        this.wander = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
      }
      moving = this.moveToward(this.wander.x, this.wander.z, this.def.speed * 0.35 * dt);
      if (moving) this.faceAngle(this.wander.x - this.x, this.wander.z - this.z, dt);
    }

    this.animate(t, moving);
    return attacked;
  }

  // moves toward (tx, tz), sliding along obstacles instead of pushing into them
  moveToward(tx, tz, step) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return false;
    const s = Math.min(step, d);
    const nx = this.x + (dx / d) * s;
    const nz = this.z + (dz / d) * s;
    let moved = false;
    if (!blocked(this.solids, nx, this.z, 0.5)) { this.x = nx; moved = true; }
    if (!blocked(this.solids, this.x, nz, 0.5)) { this.z = nz; moved = true; }
    this.group.position.set(this.x, 0, this.z);
    return moved;
  }

  faceAngle(dx, dz, dt) {
    if (Math.hypot(dx, dz) < 0.01) return;
    const want = Math.atan2(dx, dz);
    let d = want - this.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.group.rotation.y += d * Math.min(1, dt * 8);
  }

  animate(t, moving) {
    const p = this.model.animParts;
    const amp = moving ? 1 : 0.25;
    if (p.squash) {
      p.squash.scale.y = 0.75 + Math.sin(t * (moving ? 9 : 3)) * 0.06 * amp;
      p.squash.scale.x = 1 - Math.sin(t * (moving ? 9 : 3)) * 0.03 * amp;
    }
    for (const key of Object.keys(p)) {
      if (key.startsWith('leg')) {
        const phase = key.endsWith('FL') || key.endsWith('BR') ? 0 : Math.PI;
        p[key].rotation.x = Math.sin(t * 10 + phase) * 0.5 * amp;
      }
    }
    this.model.body.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.06 : Math.sin(t * 2 + this.phase) * 0.02;
    if (this.flashT > 0) {
      this.flashT -= 1 / 60;
      for (const m of this.model.mats) m.emissiveIntensity = 1.5;
    } else {
      for (const m of this.model.mats) m.emissiveIntensity = m.userData.base;
    }
  }

  faceCamera(camera) {
    if (!this.alive) return;
    this.bar.visible = this.barT > 0 || this.hp < this.maxHp;
    if (this.barT > 0) this.barT -= 1 / 60;
    if (!this.bar.visible) return;
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.bar.userData.fill.scale.x = Math.max(0.001, ratio);
    this.bar.userData.fill.position.x = -0.7 * (1 - ratio);
    this.bar.quaternion.copy(camera.quaternion);
    this.bar.scale.setScalar(1 / Math.max(0.6, this.def.size));
  }

  respawn() {
    this.alive = true;
    this.hp = this.maxHp;
    this.state = 'idle';
    this.angry = false;
    this.x = this.home.x + (Math.random() - 0.5) * 2;
    this.z = this.home.z + (Math.random() - 0.5) * 2;
    this.group.position.set(this.x, 0, this.z);
    this.group.scale.setScalar(this.def.size);
    this.group.visible = true;
  }

  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
}

function makeBar(height) {
  const g = new THREE.Group();
  g.position.y = height;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16), new THREE.MeshBasicMaterial({ color: '#070b18', transparent: true, opacity: 0.8, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.1), new THREE.MeshBasicMaterial({ color: '#ff5d73', depthWrite: false }));
  fill.position.z = 0.01;
  g.add(back, fill);
  g.userData.fill = fill;
  g.visible = false;
  return g;
}
