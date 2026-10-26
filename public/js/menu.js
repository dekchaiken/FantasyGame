import * as THREE from 'three';
import { buildTown } from './town.js';
import { buildCharacter } from './character.js';

// Menu scene: the island with one character standing on it. Used by login, character select,
// creator and the Character Lab. `shift` moves the view so the character sits left of the UI panel.
// The character stands on the sand path in front of the fountain (which sits at the origin).
const STAND = { x: 0, z: 6 };
const VIEWS = {
  login: { pos: [0, 7.5, 27], look: [0, 1.5, 4], fov: 40, shift: 0.1 },
  select: { pos: [0, 2.6, 12], look: [0, 1.2, STAND.z], fov: 36, shift: 0.14 },
  creator: { pos: [0, 2.4, 11.5], look: [0, 1.15, STAND.z], fov: 36, shift: 0.17 },
};

const scene = new THREE.Scene();
const town = buildTown(scene);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
let view = VIEWS.login;
let char = null;

function applyView() {
  camera.fov = view.fov;
  camera.position.set(...view.pos);
  camera.lookAt(...view.look);
  camera.updateProjectionMatrix();
}

export const Menu = {
  scene,
  camera,

  setView(name) {
    view = VIEWS[name] || VIEWS.login;
    applyView();
    this.resize(window.innerWidth, window.innerHeight);
  },

  setCharacter(cfg) {
    if (char) {
      scene.remove(char.group);
      char.dispose();
    }
    char = buildCharacter(cfg);
    char.group.position.set(STAND.x, 0, STAND.z);
    scene.add(char.group);
  },

  update(dt, time) {
    town.update(time, dt);
    if (char) char.update(time, false);
  },

  resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.setViewOffset(w, h, view.shift * w, 0, w, h);
  },
};

applyView();
