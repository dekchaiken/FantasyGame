import * as THREE from 'three';

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
};

// Returns { solids, half, spawnNorth, spawnEast } for the caller to place the hero and monsters.
export function buildField(scene, mapId, def, avoid) {
  const bio = BIOMES[def.biome];
  const solids = [];
  const half = def.size / 2;
  const n = Math.round(half / TILE);
  const rnd = seeded(mapId.length * 97 + 13);
  scene.fog = new THREE.Fog(bio.fog, 40, 110);

  // sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 32, 16),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  const top = new THREE.Color(def.biome === 'mine' ? '#1c0f14' : '#4aa6e8');
  const hor = new THREE.Color(def.sky);
  const c = new THREE.Color();
  const pos = sky.geometry.attributes.position;
  const cols = [];
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.clamp(pos.getY(i) / 150, 0, 1);
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
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);

  const groundMats = bio.ground.map((col) => std(col));
  const pathMat = std(bio.path);
  const tileGeo = new THREE.BoxGeometry(TILE - 0.06, 0.5, TILE - 0.06);
  for (let i = -n; i < n; i++) {
    for (let j = -n; j < n; j++) {
      const x = (i + 0.5) * TILE;
      const z = (j + 0.5) * TILE;
      const onPath = Math.abs(x) < 1.2 || Math.abs(z) < 1.2;
      const tile = cast(new THREE.Mesh(tileGeo, onPath ? pathMat : groundMats[Math.floor(rnd() * 3)]));
      tile.position.set(x, -0.25, z);
      scene.add(tile);
    }
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
  for (let k = 0, placed = 0; k < 400 && placed < 46; k++) {
    const x = (rnd() * 2 - 1) * (half - 2.5);
    const z = (rnd() * 2 - 1) * (half - 2.5);
    if (!avoidOk(x, z)) continue;
    placed++;
    if (def.biome === 'forest') addTree(scene, solids, x, z, 0.8 + rnd() * 0.5, rnd);
    else addSpire(scene, solids, x, z, 0.8 + rnd() * 0.7, rnd);
  }

  // boundary walls
  const edge = half - 0.5;
  for (let t = -half; t <= half; t += 2.2) {
    for (const [x, z] of [[t, -edge], [t, edge], [-edge, t], [edge, t]]) {
      if (def.biome === 'forest') addTree(scene, solids, x, z, 1.1, rnd);
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
