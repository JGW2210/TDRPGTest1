// The granular view: click your own hex and the camera dives into a floating
// diorama of that hex — its sites (battles, traders, ruins, shrines,
// mysteries) arranged as little paper-and-prism vignettes you can click.

import * as THREE from 'three';
import { mulberry32, hash2 } from './rng.js';
import { BIOMES } from './names.js';
import { hexRingGeometry } from './world3d.js';
import {
  makeNebulaTexture, makeRuneRingTexture, makeLabelTexture, makeGlowTexture,
  makeEnemyTexture, makeTraderTexture, makeMysteryTexture, makePlayerTexture,
} from './textures.js';

const TYPE_STYLE = {
  battle: { glow: '#ff8a5a', pedestal: 0x6e3226, label: '#ffb894', tag: 'battle' },
  trader: { glow: '#ffd98a', pedestal: 0x6e5a26, label: '#ffe2a8', tag: 'trader' },
  side:   { glow: '#8fa8ff', pedestal: 0x2e3a6e, label: '#b8c8ff', tag: 'curiosity' },
  pedestal: { glow: '#f0c46a', pedestal: 0x5e4a1e, label: '#ffe2a8', tag: 'item pedestal' },
};

export class LocalView {
  constructor() {
    this.scene = null;
    this.hitboxes = [];
    this.billboards = [];
    this.markers = [];
    this.time = 0;
    this._tex = {};
  }

  _shared(name, maker) { return this._tex[name] ??= maker(); }

  build(tile, world, sites) {
    this.dispose();
    const scene = new THREE.Scene();
    this.scene = scene;
    this.hitboxes = [];
    this.billboards = [];
    this.markers = [];
    const rng = mulberry32(Math.floor(hash2(tile.q, tile.r, world.seed + 991) * 0xffffffff));
    const biome = BIOMES[tile.biome];

    scene.fog = new THREE.FogExp2(0x0a0d24, 0.012);
    scene.add(new THREE.AmbientLight(0x9aa4d8, 0.8));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.7);
    sun.position.set(12, 20, -8);
    scene.add(sun);

    // cosmic floor far below
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(60, 48),
      new THREE.MeshBasicMaterial({ map: this._shared('neb', makeNebulaTexture), fog: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -9;
    scene.add(disc);

    const ringHolder = new THREE.Group();
    const runeRing = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({
        map: this._shared('ring', () => makeRuneRingTexture(28, '#8f9bff')),
        transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
      })
    );
    runeRing.rotation.x = -Math.PI / 2;
    ringHolder.add(runeRing);
    ringHolder.position.y = -7.5;
    scene.add(ringHolder);
    this.runeRing = ringHolder;

    // the hex itself, writ large
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(7.4, 6.7, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: biome.color, flatShading: true, roughness: 0.9 })
    );
    platform.position.y = -0.6;
    scene.add(platform);

    const edge = new THREE.Mesh(
      hexRingGeometry(7.35, 7.0),
      new THREE.MeshBasicMaterial({
        color: biome.accent, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
      })
    );
    edge.position.y = 0.03;
    scene.add(edge);

    // place site markers first, then scatter dressing around them
    const taken = [];
    sites.forEach((site, i) => {
      const a = i * 2.4 + rng() * 0.7;
      const r = Math.min(5.6, 2.7 + (i % 2) * 1.5 + rng() * 0.8);
      const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      taken.push(pos);
      this._buildMarker(site, pos, tile, rng);
    });

    this._scatterDressing(tile, rng, taken);

    // your paper self, camped at the hex's heart
    const token = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.45),
      new THREE.MeshBasicMaterial({
        map: this._shared('player', makePlayerTexture),
        transparent: true, depthTest: false, fog: false,
      })
    );
    token.geometry.translate(0, 0.72, 0);
    token.renderOrder = 9;
    token.position.set(0, 0, 0);
    scene.add(token);
    this.billboards.push(token);
    this.token = token;

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    scene.add(shadow);

    return scene;
  }

  _buildMarker(site, pos, tile, rng) {
    const style = TYPE_STYLE[site.type] || TYPE_STYLE.side;
    const g = new THREE.Group();
    g.position.copy(pos);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.82, 0.24, 6),
      new THREE.MeshStandardMaterial({ color: style.pedestal, flatShading: true, roughness: 0.7 })
    );
    pedestal.position.y = 0.12;
    g.add(pedestal);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._shared('glow_' + site.type, () => makeGlowTexture(style.glow)),
      color: 0xffffff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(2.4);
    glow.position.y = 0.35;
    g.add(glow);

    const top = new THREE.Group();
    top.position.y = 0.24;
    g.add(top);
    this._buildVignette(site, top, tile, rng);

    const tex = makeLabelTexture(site.name, {
      sub: site.cleared ? style.tag + ' · resolved' : style.tag,
      color: site.cleared ? '#6a7099' : style.label,
    });
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, fog: false,
      opacity: site.cleared ? 0.55 : 1,
    }));
    const s = 0.0082;
    label.scale.set(tex.userData.w * s, tex.userData.h * s, 1);
    label.position.y = 2.1;
    label.renderOrder = 10;
    g.add(label);
    if (site.cleared) {
      glow.material.opacity = 0.12;
      top.traverse(o => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { if (m.color) m.color.multiplyScalar(0.45); if (m.emissiveIntensity) m.emissiveIntensity *= 0.2; }
      });
    }

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 3.0, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 1.5;
    hit.userData.site = site;
    hit.userData.glow = glow;
    g.add(hit);
    this.hitboxes.push(hit);

    this.scene.add(g);
    this.markers.push({ group: g, top, glow, baseY: pos.y, phase: rng() * Math.PI * 2 });
  }

  _buildVignette(site, parent, tile, rng) {
    const std = (color, opts = {}) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...opts });

    const billboardPlane = (texture, w, h) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, fog: false })
      );
      m.geometry.translate(0, h / 2, 0);
      this.billboards.push(m);
      return m;
    };

    if (site.type === 'battle') {
      const biome = BIOMES[tile.biome];
      const body = '#' + new THREE.Color(biome.color).offsetHSL(0, 0.1, -0.12).getHexString();
      const tex = makeEnemyTexture(body, '#ffd24a', 1 + Math.floor(rng() * 3), rng());
      parent.add(billboardPlane(tex, 1.5, 1.5));
      return;
    }
    if (site.type === 'trader') {
      if (site.subtype === 'wandering') {
        parent.add(billboardPlane(this._shared('cart', makeTraderTexture), 1.6, 1.4));
      } else {
        // a stall: counter + striped canopy
        const counter = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), std(0x6b4f2a));
        counter.position.y = 0.2;
        const poles = new THREE.Group();
        for (const sx of [-0.55, 0.55]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1), std(0x4a3820));
          p.position.set(sx, 0.55, -0.2);
          poles.add(p);
        }
        const canopy = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.06, 0.9),
          std(site.subtype === 'market' ? 0xd94f8e : 0xc8973f)
        );
        canopy.position.set(0, 1.12, -0.05);
        canopy.rotation.x = -0.18;
        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 6),
          std(0xffd98a, { emissive: 0xffc75a, emissiveIntensity: 2 })
        );
        lantern.position.set(0.6, 0.9, 0.3);
        parent.add(counter, poles, canopy, lantern);
      }
      return;
    }
    if (site.type === 'pedestal') {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 6), std(0x4a4468));
      column.position.y = 0.45;
      const gift = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22),
        std(0x2a2410, { emissive: 0xf0c46a, emissiveIntensity: site.cleared ? 0.1 : 1.8, roughness: 0.3 })
      );
      gift.position.y = 1.25;
      parent.add(column, gift);
      return;
    }
    // side areas by subtype
    switch (site.subtype) {
      case 'cache': {
        for (const [dx, dz, ry] of [[-0.25, 0, 0.3], [0.28, 0.1, -0.2], [0, -0.3, 0.8]]) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), std(0x6b4f2a));
          crate.position.set(dx, 0.2, dz);
          crate.rotation.y = ry;
          parent.add(crate);
        }
        const gleam = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.12),
          std(0x2a2410, { emissive: 0xffd98a, emissiveIntensity: 2 })
        );
        gleam.position.y = 0.62;
        parent.add(gleam);
        break;
      }
      case 'mystery': {
        parent.add(billboardPlane(this._shared('mystery', makeMysteryTexture), 1.15, 1.15));
        break;
      }
      case 'shrine': {
        const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 1.1, 5), std(0x565a86));
        ob.position.y = 0.55;
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 10, 8),
          std(0x223, { emissive: 0x9fe8ff, emissiveIntensity: 2.4 })
        );
        orb.position.y = 1.3;
        parent.add(ob, orb);
        break;
      }
      case 'ruin': case 'gate': {
        for (const [sx, tilt] of [[-0.4, 0.12], [0.42, -0.08]]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.1, 0.24), std(0x3c3c58));
          p.position.set(sx, 0.5, 0);
          p.rotation.z = tilt;
          parent.add(p);
        }
        if (site.subtype === 'gate') {
          const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.28), std(0x32324a));
          lintel.position.y = 1.12;
          const portal = new THREE.Mesh(
            new THREE.PlaneGeometry(0.66, 0.95),
            new THREE.MeshBasicMaterial({
              color: 0x8a4fd9, transparent: true, opacity: 0.85,
              blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
            })
          );
          portal.position.y = 0.55;
          this.billboards.push(portal);
          parent.add(lintel, portal);
        } else {
          const fallen = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), std(0x34344e));
          fallen.position.set(0.1, 0.13, 0.5);
          fallen.rotation.set(Math.PI / 2.2, 0, 0.7);
          parent.add(fallen);
        }
        break;
      }
      case 'camp': {
        const tent = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 4), std(0x7a5a38));
        tent.position.y = 0.35;
        tent.rotation.y = Math.PI / 4;
        const fire = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 8, 6),
          std(0x431, { emissive: 0xff8a3a, emissiveIntensity: 2.6 })
        );
        fire.position.set(0.6, 0.1, 0.35);
        parent.add(tent, fire);
        break;
      }
      case 'tavern': case 'palace': {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), std(0x9a8a70));
        body.position.y = 0.3;
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(0.7, 0.55, 4),
          std(site.subtype === 'palace' ? 0xf0c46a : 0x8a4030)
        );
        roof.position.y = 0.88;
        roof.rotation.y = Math.PI / 4;
        parent.add(body, roof);
        if (site.subtype === 'palace') {
          const crown = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.16),
            std(0x222444, { emissive: 0xf0c46a, emissiveIntensity: 1.6 })
          );
          crown.position.y = 1.35;
          parent.add(crown);
        }
        break;
      }
      case 'vista': {
        const tripod = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 3), std(0x4a4a68));
        tripod.position.y = 0.35;
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.6), std(0xb08a4a));
        scope.position.y = 0.8;
        scope.rotation.z = Math.PI / 3;
        parent.add(tripod, scope);
        break;
      }
      default: {
        const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), std(0x565a86));
        stone.position.y = 0.3;
        parent.add(stone);
      }
    }
  }

  _scatterDressing(tile, rng, taken) {
    const biome = BIOMES[tile.biome];
    const std = c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9 });
    const makers = {
      tree: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.0, 6), std(0x1d5c3c)); m.position.y = 0.5; return m; },
      peak: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 5), std(0xbdbad4)); m.position.y = 0.65; return m; },
      cactus: () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 6), std(0x4c7a3c)); m.position.y = 0.4; return m; },
      shard: () => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), std(0xd7ecff)); m.scale.y = 2.4; m.position.y = 0.5; return m; },
      crystal: () => {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), new THREE.MeshStandardMaterial({
          color: 0xc79bff, flatShading: true, roughness: 0.2, emissive: 0x7a3fd4, emissiveIntensity: 0.5,
        }));
        m.scale.y = 2.6; m.position.y = 0.55; return m;
      },
      ember: () => {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 6), new THREE.MeshBasicMaterial({
          color: 0xff6a2a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
        }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.03; return m;
      },
      grass: () => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), std(0xa9cf6e)); m.position.y = 0.2; return m; },
      sea: () => {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 8), new THREE.MeshBasicMaterial({
          color: 0x6f9bff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.03; return m;
      },
    };
    const maker = makers[biome.deco] || makers.grass;
    let placed = 0, guard = 0;
    while (placed < 13 && guard++ < 80) {
      const a = rng() * Math.PI * 2;
      const r = 1.6 + rng() * 4.6;
      const p = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (taken.some(tp => tp.distanceTo(p) < 1.6)) continue;
      const m = maker();
      const s = 0.6 + rng() * 0.7;
      m.scale.multiplyScalar(s);
      m.position.x = p.x; m.position.z = p.z;
      m.position.y *= s;
      m.rotation.y = rng() * Math.PI * 2;
      this.scene.add(m);
      placed++;
    }
  }

  pick(raycaster) {
    const hits = raycaster.intersectObjects(this.hitboxes, false);
    return hits.length ? hits[0].object.userData : null;
  }

  setHighlight(hit) {
    for (const h of this.hitboxes) {
      const on = hit && h.userData.site === hit.site;
      h.userData.glow.material.opacity = on ? 1.0 : 0.55;
      h.userData.glow.scale.setScalar(on ? 3.1 : 2.4);
    }
  }

  update(dt, camera) {
    if (!this.scene) return;
    this.time += dt;
    const t = this.time;
    this.runeRing.rotation.y += dt * 0.05;
    for (const m of this.markers) {
      m.top.position.y = 0.24 + Math.sin(t * 1.8 + m.phase) * 0.07;
    }
    if (this.token) this.token.position.y = Math.sin(t * 2.1) * 0.04;
    for (const b of this.billboards) {
      const wp = b.getWorldPosition(new THREE.Vector3());
      b.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
    }
  }

  dispose() {
    if (!this.scene) return;
    const shared = new Set(Object.values(this._tex));
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.map && !shared.has(m.map)) m.map.dispose();
        m.dispose();
      }
    });
    this.scene = null;
    this.hitboxes = [];
    this.billboards = [];
    this.markers = [];
  }
}
