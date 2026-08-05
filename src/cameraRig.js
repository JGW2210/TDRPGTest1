// Drag-to-pan / scroll-to-zoom / right-drag-to-orbit camera with inertia.

import * as THREE from 'three';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class CameraRig {
  constructor(camera, dom, opts = {}) {
    this.camera = camera;
    this.dom = dom;
    this.focus = new THREE.Vector3(opts.focus?.x ?? 0, 0, opts.focus?.z ?? 0);
    this.yaw = opts.yaw ?? Math.PI / 2;
    this.pitch = opts.pitch ?? 0.95;
    this.dist = opts.dist ?? 24;
    this.minDist = opts.minDist ?? 8;
    this.maxDist = opts.maxDist ?? 110;
    this.minPitch = opts.minPitch ?? 0.55;
    this.maxPitch = opts.maxPitch ?? 1.35;
    this.bounds = opts.bounds ?? 60;      // focus stays within this radius
    this.enabled = true;

    this.raycaster = new THREE.Raycaster();
    this.velocity = new THREE.Vector3();
    this.tween = null;
    this.dragMode = null;   // 'pan' | 'rotate'
    this.dragDist = 0;
    this.wasDrag = false;
    this.lastPointer = { x: 0, y: 0 };
    this.grabPoint = null;
    this.keys = new Set();

    this._bind();
    this.apply();
  }

  _bind() {
    const d = this.dom;
    d.addEventListener('contextmenu', e => e.preventDefault());
    d.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      d.setPointerCapture(e.pointerId);
      this.dragMode = (e.button === 2 || e.shiftKey) ? 'rotate' : 'pan';
      this.dragDist = 0;
      this.wasDrag = false;
      this.velocity.set(0, 0, 0);
      this.tween = null;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      if (this.dragMode === 'pan') this.grabPoint = this._groundPoint(e.clientX, e.clientY);
    });
    d.addEventListener('pointermove', e => {
      if (!this.enabled || !this.dragMode) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.dragDist += Math.abs(dx) + Math.abs(dy);
      if (this.dragDist > 5) this.wasDrag = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };

      if (this.dragMode === 'rotate') {
        this.yaw -= dx * 0.005;
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, this.minPitch, this.maxPitch);
        this.apply();
      } else if (this.grabPoint) {
        const p = this._groundPoint(e.clientX, e.clientY);
        if (p) {
          const shift = new THREE.Vector3().subVectors(this.grabPoint, p);
          this.focus.add(shift);
          this._clampFocus();
          this.velocity.copy(shift).multiplyScalar(1 / Math.max(0.016, this._dt || 0.016));
          this.apply();
        }
      }
    });
    const end = e => {
      if (this.dragMode === 'pan' && !this.wasDrag) this.velocity.set(0, 0, 0);
      this.dragMode = null;
      this.grabPoint = null;
    };
    d.addEventListener('pointerup', end);
    d.addEventListener('pointercancel', end);
    d.addEventListener('wheel', e => {
      if (!this.enabled) return;
      e.preventDefault();
      this.dist = THREE.MathUtils.clamp(this.dist * Math.exp(e.deltaY * 0.0011), this.minDist, this.maxDist);
      this.apply();
    }, { passive: false });

    window.addEventListener('keydown', e => this.keys.add(e.code));
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _groundPoint(cx, cy) {
    const ndc = new THREE.Vector2(
      (cx / this.dom.clientWidth) * 2 - 1,
      -(cy / this.dom.clientHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(groundPlane, out) ? out : null;
  }

  _clampFocus() {
    const len = Math.hypot(this.focus.x, this.focus.z);
    if (len > this.bounds) {
      this.focus.x *= this.bounds / len;
      this.focus.z *= this.bounds / len;
    }
  }

  panTo(target, { instant = false } = {}) {
    if (instant) {
      this.focus.set(target.x, 0, target.z);
      this.apply();
    } else {
      this.tween = { to: new THREE.Vector3(target.x, 0, target.z) };
    }
  }

  update(dt) {
    this._dt = dt;
    if (!this.enabled) return;

    // keyboard pan (screen-relative)
    let kx = 0, kz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kz += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (kx || kz) {
      const speed = this.dist * 0.9 * dt;
      const fwd = new THREE.Vector3(-Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      this.focus.addScaledVector(fwd, -kz * speed);
      this.focus.addScaledVector(right, -kx * speed);
      this._clampFocus();
      this.tween = null;
    }

    // inertia after a pan release
    if (!this.dragMode && this.velocity.lengthSq() > 0.0001) {
      this.focus.addScaledVector(this.velocity, dt);
      this.velocity.multiplyScalar(Math.pow(0.05, dt));
      this._clampFocus();
    }

    // smooth pan-to tween
    if (this.tween) {
      const to = this.tween.to;
      this.focus.lerp(to, 1 - Math.pow(0.002, dt));
      if (this.focus.distanceToSquared(to) < 0.01) { this.focus.copy(to); this.tween = null; }
    }

    this.apply();
  }

  apply() {
    const hd = this.dist * Math.cos(this.pitch);
    const y = this.dist * Math.sin(this.pitch);
    this.camera.position.set(
      this.focus.x + Math.cos(this.yaw) * hd,
      this.focus.y + y,
      this.focus.z + Math.sin(this.yaw) * hd
    );
    this.camera.lookAt(this.focus.x, this.focus.y + 0.5, this.focus.z);
  }
}
