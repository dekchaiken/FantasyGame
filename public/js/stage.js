import * as THREE from 'three';

// One full-screen WebGL canvas sits behind all the UI. Each "mode" (menu, world, portal)
// is an object with { scene, camera, update(dt, time), resize?(w, h) } that the stage renders.
export const Stage = {
  renderer: null,
  mod: null,
  time: 0,

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    window.addEventListener('resize', () => this.resize());
    this.resize();

    const clock = new THREE.Clock();
    const loop = () => {
      const dt = Math.min(0.05, clock.getDelta());
      this.time += dt;
      if (this.mod) {
        this.mod.update(dt, this.time);
        this.renderer.render(this.mod.scene, this.mod.camera);
      }
      requestAnimationFrame(loop);
    };
    loop();
  },

  use(mod) {
    this.mod = mod;
    this.resize();
  },

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.mod) {
      this.mod.camera.aspect = w / h;
      this.mod.camera.updateProjectionMatrix();
      this.mod.resize?.(w, h);
    }
  },
};
