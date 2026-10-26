import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// "ดินแดนสวรรค์" starter town: a floating island with houses, a windmill, a fountain and a rainbow.
export const TILE = 2;
const R = 10; // island radius in tiles

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
const cast = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const sphere = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}


export function buildTown(scene) {
  const solids = [];
  const anim = [];
  const rnd = seeded(42);
  const solid = (x, z, w, d) => solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  const add = (parent, mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  scene.fog = new THREE.Fog('#cfeeff', 55, 140);

  // sky dome: gradient from the horizon up to blue
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 16),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  const topCol = new THREE.Color('#3aa8ff');
  const horCol = new THREE.Color('#e4f7ff');
  const c = new THREE.Color();
  const pos = sky.geometry.attributes.position;
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp(pos.getY(i) / 150, 0, 1);
    c.copy(horCol).lerp(topCol, Math.pow(k, 0.6));
    cols.push(c.r, c.g, c.b);
  }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(sky);

  // light
  scene.add(new THREE.HemisphereLight('#e7f6ff', '#6fae52', 1.25));
  const sun = new THREE.DirectionalLight('#fff2d6', 1.7);
  sun.position.set(12, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);

  // island ground: grass tiles, sand paths and a plaza, dirt cliffs around the edge
  const grassMats = ['#8fd16b', '#7fc35e', '#a4dd7a'].map((col) => std(col));
  const sandMat = std('#f3d590');
  const dirtMat = std('#b9834e', { roughness: 1 });
  const tileGeo = new THREE.BoxGeometry(TILE - 0.06, 0.5, TILE - 0.06);
  const cliffGeo = new THREE.BoxGeometry(TILE - 0.06, 1.6, TILE - 0.06);
  for (let i = -R; i <= R; i++) {
    for (let j = -R; j <= R; j++) {
      const d2 = i * i + j * j;
      if (d2 > R * R) continue;
      const x = i * TILE;
      const z = j * TILE;
      const sandy = d2 <= 2 || i === 0 || j === 0;
      const mat = sandy ? sandMat : grassMats[Math.floor(rnd() * 3)];
      add(scene, cast(new THREE.Mesh(tileGeo, mat)), x, -0.25, z);
      if (d2 > (R - 1) * (R - 1)) add(scene, new THREE.Mesh(cliffGeo, dirtMat), x, -1.05, z);
    }
  }

  // water around the island
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(70, 48),
    std('#5cc8ff', { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.3;
  scene.add(water);
  anim.push((t) => { water.position.y = -2.3 + Math.sin(t * 0.8) * 0.05; });

  // fountain in the plaza
  {
    const stone = std('#e9eef5');
    const g = new THREE.Group();
    scene.add(g);
    add(g, cast(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.8, 32), stone)), 0, 0.4, 0);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.05, 32), std('#5cc8ff', { roughness: 0.2 })), 0, 0.8, 0);
    add(g, cast(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.4, 16), stone)), 0, 1.5, 0);
    add(g, cast(new THREE.Mesh(sphere(0.35), stone)), 0, 2.3, 0);
    solid(0, 0, 4.4, 4.4);
  }

  // houses
  function house(x, z, wall, roof) {
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(x, 0, z);
    add(g, cast(new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.2, 2.8, 3, 0.12), std(wall))), 0, 1.1, 0);
    const r = cast(new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.6, 4), std(roof)));
    r.rotation.y = Math.PI / 4;
    add(g, r, 0, 3.0, 0);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), std('#7a4a2a')), 0, 0.6, 1.42);
    for (const s of [-0.9, 0.9]) {
      add(g, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), std('#bfeaff', { roughness: 0.2 })), s, 1.3, 1.42);
    }
    solid(x, z, 3.4, 3.0);
  }
  house(-9, -7, '#ffb3c1', '#c0392b');
  house(-4.5, -9, '#b8e0ff', '#3f7fd6');
  house(4.5, -9, '#c7f5c9', '#3fae6a');
  house(9, -6, '#ffe6a7', '#e67e22');
  house(9, 6, '#e0c3ff', '#8a5cd6');
  house(-9, 6, '#ffd0a0', '#c0392b');

  // windmill with turning blades
  {
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(-14, 0, -2);
    add(g, cast(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 4.5, 16), std('#fff5e1'))), 0, 2.25, 0);
    add(g, cast(new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.4, 16), std('#d8553d'))), 0, 5.2, 0);
    const blades = add(g, new THREE.Group(), 0, 4, 1.2);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group();
      arm.rotation.z = (k * Math.PI) / 2;
      add(arm, cast(new THREE.Mesh(new RoundedBoxGeometry(0.5, 3.2, 0.1, 2, 0.04), std('#fffdf5'))), 0, 1.7, 0);
      blades.add(arm);
    }
    anim.push((t) => { blades.rotation.z = t * 0.8; });
    solid(-14, -2, 2.4, 2.4);
  }

  // market stalls with striped awnings
  function stall(x, z, color) {
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(x, 0, z);
    add(g, cast(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 1.2), std('#a0703f'))), 0, 0.5, 0);
    for (let i = 0; i < 6; i++) {
      const s = add(g, cast(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 2.0), std(i % 2 ? '#ffffff' : color))), -1.1 + i * 0.44, 2.1, 0);
      s.rotation.x = -0.15;
    }
    solid(x, z, 2.4, 1.2);
  }
  stall(-9, 1.5, '#ff8fa3');
  stall(9, 1.5, '#8fd8ff');

  // trees
  function tree(x, z, s = 1) {
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(x, 0, z);
    add(g, cast(new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.3 * s, 1.6 * s, 10), std('#7a5230'))), 0, 0.8 * s, 0);
    const leaf = std('#4cbb6b', { flatShading: true, roughness: 0.9 });
    for (const [dx, dy, dz, r] of [[0, 2.3, 0, 1.0], [0.5, 2.9, -0.3, 0.7], [-0.4, 2.7, 0.4, 0.75]]) {
      add(g, cast(new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), leaf)), dx * s, dy * s, dz * s);
    }
    solid(x, z, 0.7 * s, 0.7 * s);
  }
  for (const [x, z] of [[-13, 6], [-12, -12], [13, -3], [14, 3], [-6, -14], [6, -14], [-16, -6], [16, -6], [-14, 13], [14, -13]]) {
    tree(x, z, 0.9 + rnd() * 0.4);
  }

  // lanterns that pulse
  const orbs = [];
  for (const [x, z] of [[2.5, 2.5], [-2.5, 2.5], [2.5, -2.5], [-2.5, -2.5], [1.2, -10], [-1.2, 10]]) {
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(x, 0, z);
    add(g, cast(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), std('#4a3a2a'))), 0, 0.9, 0);
    orbs.push(add(g, new THREE.Mesh(sphere(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ffd166', emissiveIntensity: 0.9 })), 0, 1.9, 0));
  }
  anim.push((t) => orbs.forEach((o, i) => { o.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 3 + i); }));

  // flowers scattered on the grass
  const flowerCols = ['#ff7aa2', '#ffe066', '#ffffff', '#c9b6ff'].map((col) => std(col));
  const flowerGeo = sphere(0.12, 8, 6);
  for (let n = 0; n < 140; n++) {
    const i = Math.floor((rnd() * 2 - 1) * (R - 1));
    const j = Math.floor((rnd() * 2 - 1) * (R - 1));
    if (i === 0 || j === 0 || i * i + j * j <= 9 || i * i + j * j > (R - 1) * (R - 1)) continue;
    add(scene, new THREE.Mesh(flowerGeo, flowerCols[Math.floor(rnd() * 4)]), i * TILE + (rnd() - 0.5), 0.1, j * TILE + (rnd() - 0.5));
  }

  // rainbow standing on the water behind the island
  ['#ff5a5a', '#ffb35a', '#ffe65a', '#5ae07a', '#5ab4ff', '#a25aff'].forEach((col, k) => {
    add(scene, new THREE.Mesh(
      new THREE.TorusGeometry(22 - k * 0.7, 0.45, 8, 80, Math.PI),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, fog: false }),
    ), 0, 0, -34);
  });

  // soft clouds drifting overhead
  for (const [x, y, z, s] of [[-18, 14, -20, 1.4], [16, 16, -26, 1.8], [0, 18, -40, 2], [-30, 15, -6, 1.5], [28, 13, 8, 1.2]]) {
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(x, y, z);
    for (const [dx, dy, r] of [[0, 0, 1.6], [1.4, 0.2, 1.2], [-1.3, -0.1, 1.1], [0.4, 0.8, 1.0]]) {
      add(g, new THREE.Mesh(sphere(r * s, 14, 10), std('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.12 })), dx * s, dy * s, 0);
    }
    anim.push((t) => { g.position.x = x + Math.sin(t * 0.05 + x) * 3; });
  }

  return {
    solids,
    spawn: { x: 0, z: 7 },
    update(t, dt) {
      for (const f of anim) f(t, dt);
    },
  };
}
