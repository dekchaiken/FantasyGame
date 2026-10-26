import * as THREE from 'three';
import { buildCharacter } from './character.js';

// Enter-world animation: the character rises out of a glowing portal on the grass.
// The loader sets `state.progress` (0..1) and the scene does the rest.
export function createPortal(character) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe9ff');
  scene.fog = new THREE.Fog('#bfe9ff', 12, 30);
  scene.add(new THREE.HemisphereLight('#e7f6ff', '#6fae52', 1.3));
  const sun = new THREE.DirectionalLight('#fff2d6', 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);

  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 64), new THREE.MeshStandardMaterial({ color: '#8fd16b' }));
  disc.rotation.x = -Math.PI / 2;
  scene.add(disc);

  const ringMat = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.1, 12, 64), ringMat('#ffd166'));
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.05;
  scene.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 12, 64), ringMat('#8ee3ff'));
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.06;
  scene.add(ring2);

  const char = buildCharacter(character);
  char.group.position.set(0, -1.8, 0);
  scene.add(char.group);

  const n = 140;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 2.2;
    pos.set([Math.cos(a) * r, Math.random() * 3, Math.sin(a) * r], i * 3);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparkles = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: '#fff3a3', size: 0.09, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  scene.add(sparkles);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 2.6, 7.5);
  camera.lookAt(0, 1, 0);

  const state = { progress: 0 };
  return {
    scene,
    camera,
    state,
    update(dt, t) {
      const k = state.progress;
      char.group.position.y = -1.8 + Math.min(1, k * 1.4) * 1.8;
      char.group.rotation.y = Math.sin(t * 0.6) * 0.6;
      char.update(t, false);
      ring1.rotation.z += dt * 1.5;
      ring2.rotation.z -= dt * 2;
      sparkles.rotation.y = t * 0.6;
      sparkles.position.y = k * 1.5;
    },
  };
}
