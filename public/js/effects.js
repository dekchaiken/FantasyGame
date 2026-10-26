import * as THREE from 'three';

// 3D skill effects. A skill's `fx` config (type, colours, count, size, duration, speed, shake)
// becomes rings, arcs, beams, orbs and particles. The Skill Lab uses the same code,
// so what you design there is what plays in the world.
//
// fx.type: burst | nova | slash | projectile | beam | heal
const ADD = THREE.AdditiveBlending;
const glow = (color, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: ADD });

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  // origin: THREE.Vector3 at the caster's chest. dir: {x, z} unit vector. range: world units.
  spawn(fx, origin, dir = { x: 0, z: 1 }, range = 3) {
    const d = new THREE.Vector3(dir.x, 0, dir.z);
    if (d.lengthSq() === 0) d.set(0, 0, 1);
    d.normalize();
    const root = new THREE.Group();
    root.position.copy(origin);
    root.rotation.y = Math.atan2(d.x, d.z);
    this.scene.add(root);
    const item = build(fx, root, range, this);
    item.age = 0;
    item.life = item.life ?? Math.max(0.15, fx.duration / 1000);
    this.items.push(item);
    return item;
  }

  update(dt) {
    for (const it of this.items) {
      if (it.removed) continue;
      it.age += dt;
      const k = Math.min(1, it.age / it.life);
      it.tick?.(dt, k);
      if (k >= 1) {
        it.done?.();
        this.remove(it);
      }
    }
    this.items = this.items.filter((it) => !it.removed);
  }

  remove(it) {
    if (it.removed) return;
    it.removed = true;
    this.scene.remove(it.root);
    it.root.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }

  clear() {
    for (const it of this.items) this.remove(it);
    this.items = [];
  }
}

function build(fx, root, range, effects) {
  const col = new THREE.Color(fx.color);
  const col2 = new THREE.Color(fx.color2);

  switch (fx.type) {
    case 'slash': {
      const sweep = new THREE.Group();
      sweep.position.y = 1.1;
      root.add(sweep);
      const outer = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 8, 32, 1.9), glow(col));
      const inner = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.04, 6, 32, 1.9), glow(col2));
      sweep.add(outer, inner);
      return {
        root,
        tick(dt, k) {
          sweep.rotation.z = -1.2 + 2.4 * k;
          sweep.scale.setScalar(0.7 + 0.5 * k);
          outer.material.opacity = 1 - k;
          inner.material.opacity = 1 - k;
        },
      };
    }

    case 'nova': {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), glow(col));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      root.add(ring);
      const p = particles(root, fx, col, col2, false);
      return {
        root,
        tick(dt, k) {
          ring.scale.setScalar(0.4 + k * Math.max(2, range) * 1.1);
          ring.material.opacity = 1 - k;
          p.tick(dt, k);
        },
      };
    }

    case 'beam': {
      const holder = new THREE.Group();
      holder.position.y = 1.0;
      root.add(holder);
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 10), glow(col, 0.9));
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), glow(col2));
      outer.rotation.x = Math.PI / 2;
      inner.rotation.x = Math.PI / 2;
      holder.add(outer, inner);
      return {
        root,
        tick(dt, k) {
          const len = Math.max(0.1, range * Math.min(1, k * 1.8));
          for (const m of [outer, inner]) {
            m.scale.y = len;
            m.position.z = len / 2;
          }
          outer.material.opacity = 0.9 * (1 - k * 0.8);
          inner.material.opacity = 1 - k * 0.8;
        },
      };
    }

    case 'projectile': {
      const speed = Math.max(2.5, fx.speed / 80);
      const flight = Math.min(2.2, Math.max(0.2, range / speed));
      const orb = new THREE.Group();
      orb.position.y = 1.0;
      root.add(orb);
      const core = new THREE.Mesh(sphere(0.22), glow(col2));
      const halo = new THREE.Mesh(sphere(0.45), glow(col, 0.45));
      orb.add(core, halo);
      return {
        root,
        life: flight,
        tick(dt, k) {
          orb.position.z = range * k;
        },
        done() {
          // impact point: range along the projectile's own facing, at chest height
          const yaw = root.rotation.y;
          const impact = new THREE.Vector3(
            root.position.x + Math.sin(yaw) * range,
            1.0,
            root.position.z + Math.cos(yaw) * range,
          );
          effects.spawn(
            { ...fx, type: 'burst', count: Math.round(fx.count * 0.6), speed: 160, duration: 450, shake: 0 },
            impact,
          );
        },
      };
    }

    case 'heal': {
      const p = particles(root, fx, col, col2, true);
      return { root, tick: (dt, k) => p.tick(dt, k) };
    }

    case 'burst':
    default: {
      const p = particles(root, fx, col, col2, false);
      return { root, tick: (dt, k) => p.tick(dt, k) };
    }
  }
}

function particles(root, fx, col, col2, upward) {
  const n = Math.max(1, fx.count);
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);
  const sp0 = Math.max(0.3, fx.speed / 90);
  for (let i = 0; i < n; i++) {
    const c = i % 2 ? col : col2;
    cols.set([c.r, c.g, c.b], i * 3);
    if (upward) {
      pos.set([(Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2], i * 3);
      vel.set([(Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.6], i * 3);
    } else {
      const a = Math.random() * Math.PI * 2;
      const sp = sp0 * (0.4 + Math.random() * 0.9);
      vel.set([Math.cos(a) * sp, (0.6 + Math.random()) * sp * 0.7, Math.sin(a) * sp], i * 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.PointsMaterial({
    size: Math.max(0.06, fx.size * 0.025),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: ADD,
  });
  root.add(new THREE.Points(geo, mat));
  const gravity = upward ? -0.5 : 4;
  return {
    tick(dt, k) {
      for (let i = 0; i < n; i++) {
        vel[i * 3 + 1] -= gravity * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - k;
    },
  };
}

function sphere(r) {
  return new THREE.SphereGeometry(r, 16, 12);
}
