import * as THREE from 'three';
import { NPCS } from './data.js';

// Field maps (forest and mine): a square tile arena with biome ground, decor and rock walls.
export const TILE = 2;

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
const cast = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

function seeded(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const BIOMES = {
  forest: {
    ground: ['#5d9b4a', '#4f8a3e', '#6aae56'], path: '#8c7b55', fog: '#b9e7d2', lava: null,
  },
  mine: {
    ground: ['#5a5560', '#4a4450', '#67606f'], path: '#3a3440', fog: '#4a2a2a', lava: '#ff6a3d',
  },
  meadow: {
    ground: ['#9ccf5f', '#8ebf55', '#b2dc73'], path: '#d6b97a', fog: '#fff0c2', lava: null,
  },
  camp: {
    ground: ['#c9a46a', '#b8935c', '#d9b47c'], path: '#8a6a3e', fog: '#f3e3c4', lava: null,
  },
  city: {
    ground: ['#b9b4c6', '#a7a2b8', '#c8c3d6'], path: '#8f8aa0', fog: '#e6e0f2', lava: null,
  },
  sky: {
    ground: ['#e9f4ff', '#dcecfa', '#f4fbff'], path: '#c9d9ea', fog: '#e9f4ff', lava: null,
  },
  herb: {
    ground: ['#7fd16a', '#6cc25a', '#93de7a'], path: '#c9b07a', fog: '#e6ffd9', lava: null,
  },
  mountain: {
    ground: ['#8c9196', '#7a8086', '#9ea4aa'], path: '#6b6358', fog: '#dbe7f0', lava: null,
  },
  dungeon: {
    ground: ['#4a3f66', '#3f3558', '#5a4d78'], path: '#2a2440', fog: '#2a2440', lava: '#c084fc',
  },
  ruin: {
    ground: ['#9e9bb0', '#8c8a9e', '#b3b0c4'], path: '#6f6b82', fog: '#e8dcff', lava: null,
  },
};

// Returns { solids, half, spawnNorth, spawnEast } for the caller to place the hero and monsters.
export function buildField(scene, mapId, def, avoid) {
  const bio = BIOMES[def.biome];
  const solids = [];
  const half = def.size / 2;
  const n = Math.round(half / TILE);
  const rnd = seeded(mapId.length * 97 + 13);
  scene.fog = new THREE.Fog(bio.fog, 70, 200);

  // sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(240, 32, 16),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  const top = new THREE.Color(def.biome === 'mine' ? '#1c0f14' : '#4aa6e8');
  const hor = new THREE.Color(def.sky);
  const c = new THREE.Color();
  const pos = sky.geometry.attributes.position;
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp(pos.getY(i) / 240, 0, 1);
    c.copy(hor).lerp(top, Math.pow(k, 0.6));
    cols.push(c.r, c.g, c.b);
  }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(def.biome === 'mine' ? '#ffcaa6' : '#e7fff4', def.biome === 'mine' ? '#5a2a1a' : '#4f7a3a', 1.2));
  const sun = new THREE.DirectionalLight(def.biome === 'mine' ? '#ffb27a' : '#fff4dc', 1.6);
  sun.position.set(-10, 22, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 110 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  const groundMats = bio.ground.map((col) => std(col));
  const pathMat = std(bio.path);
  const tileGeo = new THREE.BoxGeometry(TILE - 0.06, 0.5, TILE - 0.06);
  // Tiles are drawn as one instanced mesh per material, so a big map is a handful of draw calls.
  const byMat = new Map();
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const x = (i + 0.5) * TILE;
      const z = (j + 0.5) * TILE;
      const onPath = Math.abs(x) < 1.2 || Math.abs(z) < 1.2;
      const mat = onPath ? pathMat : groundMats[Math.floor(rnd() * 3)];
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push([x, z]);
    }
  }
  const dummy = new THREE.Object3D();
  for (const [mat, list] of byMat) {
    const im = new THREE.InstancedMesh(tileGeo, mat, list.length);
    list.forEach(([x, z], k) => {
      dummy.position.set(x, -0.25, z);
      dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    cast(im);
    scene.add(im);
  }

  if (bio.lava) {
    const lavaMat = new THREE.MeshStandardMaterial({ color: bio.lava, emissive: bio.lava, emissiveIntensity: 1.1, roughness: 0.4 });
    for (let k = 0; k < 14; k++) {
      const x = (rnd() * 2 - 1) * (half - 3);
      const z = (rnd() * 2 - 1) * (half - 3);
      if (avoid.some((a) => Math.hypot(a[0] - x, a[1] - z) < 4)) continue;
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.6 + rnd() * 0.8, 12), lavaMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.02, z);
      scene.add(pool);
    }
  }

  // decor: trees in the forest, rock spires and crystals in the mine
  const avoidOk = (x, z) => avoid.every((a) => Math.hypot(a[0] - x, a[1] - z) > 3.5) && Math.hypot(x, z) > 3;
  // scattered trees and spires only on open maps; quest towns get their own layout instead
  for (let k = 0, placed = 0; !def.layout && k < 400 && placed < 46; k++) {
    const x = (rnd() * 2 - 1) * (half - 2.5);
    const z = (rnd() * 2 - 1) * (half - 2.5);
    if (!avoidOk(x, z)) continue;
    placed++;
    if (def.biome === 'forest' || def.biome === 'herb') addTree(scene, solids, x, z, 0.8 + rnd() * 0.5, rnd);
    else addSpire(scene, solids, x, z, 0.8 + rnd() * 0.7, rnd);
  }

  if (def.layout) addLayout(scene, solids, def, half, rnd, mapId);

  // boundary walls
  const edge = half - 0.5;
  for (let t = -half; t <= half; t += 2.2) {
    for (const [x, z] of [[t, -edge], [t, edge], [-edge, t], [edge, t]]) {
      if (def.biome === 'forest' || def.biome === 'herb') addTree(scene, solids, x, z, 1.1, rnd);
      else addSpire(scene, solids, x, z, 1.2, rnd);
    }
  }

  return { solids, half };
}

function addTree(scene, solids, x, z, s, rnd) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 1.8 * s, 8), std('#6b4a2a')));
  trunk.position.y = 0.9 * s;
  g.add(trunk);
  const leaf = std(rnd() > 0.5 ? '#3f8a4a' : '#2f7a5a', { flatShading: true });
  for (const [dy, r] of [[2.3, 1.1], [3.1, 0.8]]) {
    const l = cast(new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), leaf));
    l.position.y = dy * s;
    g.add(l);
  }
  solids.push({ minX: x - 0.6 * s, maxX: x + 0.6 * s, minZ: z - 0.6 * s, maxZ: z + 0.6 * s });
}

// Quest towns. Roads (the two axes) and the spots where NPCs stand are kept clear.
function addLayout(scene, solids, def, half, rnd, mapId) {
  const npcSpots = Object.values(NPCS).filter((n) => n.map === mapId).map((n) => n.pos);
  const clear = (x, z, r = 2.5) => Math.abs(x) < 3.5 || Math.abs(z) < 3.5 || npcSpots.some((p) => Math.hypot(p[0] - x, p[1] - z) < 4 + r)
    || Math.abs(x) > half - 4 || Math.abs(z) > half - 4;
  const box = (x, y, z, w, h, d, color) => {
    const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color)));
    m.position.set(x, y + h / 2, z);
    scene.add(m);
    solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };
  if (def.layout === 'camp') {
    // tents and a bonfire
    const tent = ['#8a4a2c', '#3a6a5a', '#b8a36a'];
    for (let k = 0, placed = 0; k < 300 && placed < 16; k++) {
      const x = (rnd() * 2 - 1) * (half - 6);
      const z = (rnd() * 2 - 1) * (half - 6);
      if (clear(x, z, 3)) continue;
      placed++;
      const cone = cast(new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.8, 6), std(tent[placed % 3])));
      cone.position.set(x, 0.9, z);
      scene.add(cone);
      solids.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 1.1, maxZ: z + 1.1 });
    }
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.3, 10), std('#4a3a2c'));
    fire.position.set(-14, 0.15, -12);
    scene.add(fire);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 8), new THREE.MeshStandardMaterial({ color: '#ffb84d', emissive: '#ff8a2a', emissiveIntensity: 1.2 }));
    flame.position.set(-14, 0.9, -12);
    scene.add(flame);
  } else if (def.layout === 'city') {
    // a street grid of houses; the lanes stay open
    const roof = ['#c9605a', '#5a6fa8', '#a8905a', '#6a9a7a'];
    const wall = ['#f1e7d3', '#e8dcc5', '#ddd0bd'];
    for (let x = -half + 6; x < half - 4; x += 8) {
      for (let z = -half + 6; z < half - 4; z += 8) {
        if (rnd() < 0.12 || clear(x, z, 2)) continue;
        const w = 5 + Math.floor(rnd() * 2), d = 5 + Math.floor(rnd() * 2), h = 3 + Math.floor(rnd() * 3);
        box(x, 0, z, w, h, d, wall[Math.floor(rnd() * wall.length)]);
        box(x, h, z, w + 0.6, 0.6, d + 0.6, roof[Math.floor(rnd() * roof.length)]);
      }
    }
  } else if (def.layout === 'sky') {
    // marble pillars around a courtyard, and floating platforms
    const marble = '#f6fbff';
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const x = Math.cos(a) * 26, z = Math.sin(a) * 26;
      box(x, 0, z, 1.6, 6, 1.6, marble);
    }
    for (let k = 0, placed = 0; k < 200 && placed < 8; k++) {
      const x = (rnd() * 2 - 1) * (half - 8), z = (rnd() * 2 - 1) * (half - 8);
      if (clear(x, z, 4) || Math.hypot(x, z) < 12) continue;
      placed++;
      box(x, -0.2, z, 4 + rnd() * 3, 0.6, 4 + rnd() * 3, '#dfeaf7');
    }
  }
}

function addSpire(scene, solids, x, z, s, rnd) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  const rock = std('#3d3a46', { flatShading: true });
  const spire = cast(new THREE.Mesh(new THREE.ConeGeometry(0.9 * s, 2.6 * s, 6), rock));
  spire.position.y = 1.3 * s;
  g.add(spire);
  if (rnd() > 0.5) {
    const crystal = cast(new THREE.Mesh(new THREE.OctahedronGeometry(0.4 * s, 0), new THREE.MeshStandardMaterial({ color: '#ff8a5c', emissive: '#ff6a3d', emissiveIntensity: 0.9 })));
    crystal.position.set(0.5 * s, 0.4 * s, 0.4 * s);
    g.add(crystal);
  }
  solids.push({ minX: x - 0.9 * s, maxX: x + 0.9 * s, minZ: z - 0.9 * s, maxZ: z + 0.9 * s });
}

// glowing ring portal with a soft inner disc
export function makePortal(scene, p, color = '#5ee7ff') {
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 12, 48), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.21;
  g.add(disc);
  return {
    x: p.x,
    z: p.z,
    update(t) {
      ring.rotation.z = t * 1.2;
      disc.material.opacity = 0.14 + Math.sin(t * 3) * 0.05;
    },
  };
}
