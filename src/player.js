// The paper wanderer: a flat billboarded token that hops hex-to-hex,
// leaning with parallax as the camera drifts away from it, and always
// drawn on top so it can never be lost behind terrain.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makePlayerTexture, makeStarTexture } from './textures.js';

export class PlayerToken {
  constructor(scene, startTile) {
    this.tile = startTile;
    this.path = [];
    this.hop = null;
    this.time = 0;
    this.onStep = null;
    this.onDone = null;

    this.group = new THREE.Group();

    const tex = makePlayerTexture();
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.7),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, fog: false })
    );
    this.mesh.geometry.translate(0, 0.85, 0);
    this.mesh.renderOrder = 9;
    this.group.add(this.mesh);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, fog: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.renderOrder = 8;
    this.shadow = shadow;
    this.group.add(shadow);

    // a tiny pool of landing-burst stars
    this.burst = [];
    const starTex = makeStarTexture();
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: starTex, color: 0xffe9a0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      sp.scale.setScalar(0.3);
      sp.renderOrder = 9;
      this.burst.push({ sprite: sp, t: 2, vx: 0, vz: 0 });
      this.group.add(sp);
    }

    this.group.position.set(startTile.x, startTile.topY, startTile.z);
    scene.add(this.group);
  }

  get isMoving() { return this.hop !== null || this.path.length > 0; }

  setPath(path, onStep, onDone) {
    this.path = path.slice();
    this.onStep = onStep;
    this.onDone = onDone;
    if (!this.hop) this._nextHop();
  }

  _nextHop() {
    const next = this.path.shift();
    if (!next) {
      this.hop = null;
      if (this.onDone) { const cb = this.onDone; this.onDone = null; cb(this.tile); }
      return;
    }
    this.hop = { from: this.tile, to: next, t: 0 };
  }

  _spawnBurst() {
    for (const b of this.burst) {
      const a = Math.random() * Math.PI * 2;
      b.t = 0;
      b.vx = Math.cos(a) * (0.6 + Math.random() * 0.9);
      b.vz = Math.sin(a) * (0.6 + Math.random() * 0.9);
      b.sprite.position.set(0, 0.1, 0);
    }
  }

  update(dt, camera, focus) {
    this.time += dt;
    const g = this.group;
    const layerY = this.layerY || 0;   // ride the breathing hex layer

    if (this.hop) {
      this.hop.t += dt / CONFIG.hopDuration;
      const p = Math.min(1, this.hop.t);
      const { from, to } = this.hop;
      g.position.set(
        from.x + (to.x - from.x) * p,
        layerY + from.topY + (to.topY - from.topY) * p + Math.sin(p * Math.PI) * 1.05,
        from.z + (to.z - from.z) * p
      );
      // squash & stretch
      const s = 1 + Math.sin(p * Math.PI) * 0.18;
      this.mesh.scale.set(2 - s, s, 1);
      if (p >= 1) {
        this.tile = to;
        g.position.set(to.x, layerY + to.topY, to.z);
        this._spawnBurst();
        if (this.onStep) this.onStep(to);
        this._nextHop();
      }
    } else {
      // idle bob
      g.position.y = layerY + this.tile.topY + Math.sin(this.time * 2.1) * 0.045;
      this.mesh.scale.set(1, 1, 1);
    }

    // billboard toward the camera (yaw only)…
    const yaw = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
    this.mesh.rotation.set(0, yaw, 0);

    // …then the paper lean: the further the camera's focus drifts from the
    // token, the more it tilts, staying readable like a Paper-Mario cutout.
    const offX = focus.x - g.position.x, offZ = focus.z - g.position.z;
    const offLen = Math.hypot(offX, offZ);
    const lean = Math.min(1, offLen / 16) * CONFIG.maxLean;
    if (offLen > 0.001) {
      // decompose the offset into the token's camera-facing frame
      const camRightX = Math.cos(yaw), camRightZ = -Math.sin(yaw);
      const side = (offX * camRightX + offZ * camRightZ) / offLen;
      this.mesh.rotation.x = -lean * 0.55;               // tip toward the viewer
      this.mesh.rotation.z = side * lean * 0.7;          // and lean into the pan
    } else {
      this.mesh.rotation.x = Math.sin(this.time * 1.3) * 0.02;
      this.mesh.rotation.z = Math.sin(this.time * 1.7) * 0.025;
    }

    // hop-landing star burst
    for (const b of this.burst) {
      if (b.t >= 1) { b.sprite.material.opacity = 0; continue; }
      b.t += dt / 0.45;
      b.sprite.position.x += b.vx * dt;
      b.sprite.position.z += b.vz * dt;
      b.sprite.position.y += dt * 0.8;
      b.sprite.material.opacity = Math.max(0, 0.9 * (1 - b.t));
      b.sprite.scale.setScalar(0.3 * (1 - b.t * 0.5));
    }

    // shadow shrinks while airborne
    const air = this.hop ? Math.sin(Math.min(1, this.hop.t) * Math.PI) : 0;
    this.shadow.scale.setScalar(1 - air * 0.45);
    this.shadow.material.opacity = 0.4 - air * 0.2;
  }
}
