import * as THREE from 'three';
import { buildCharacter } from './character.js';

// Renders a character into a 2D canvas, used for character cards and the HUD portrait.
let renderer = null;
let scene = null;
let camera = null;

function init() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(256, 256, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8899aa', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(2, 4, 5);
  scene.add(key);
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(0, 1.25, 4.6);
  camera.lookAt(0, 0.95, 0);
}

export function drawThumb(ctx, cfg, x = 0, y = 0, w = ctx.canvas.width, h = ctx.canvas.height) {
  if (!renderer) init();
  const char = buildCharacter(cfg);
  char.group.rotation.y = 0.3;
  scene.add(char.group);
  renderer.render(scene, camera);
  ctx.drawImage(renderer.domElement, x, y, w, h);
  scene.remove(char.group);
  char.dispose();
}
