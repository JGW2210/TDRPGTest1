// Builds and animates the world-map scene: the cosmic base far below, the
// shattered layer of floating hex prisms, their runic glow rings, biome
// decorations, landmark structures, the fog-of-war shroud, and the
// wandering traders.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { hash2 } from './rng.js';
import { keyOf, hexDist, neighborsOf } from './hex.js';
import { BIOMES, KINGDOMS } from './names.js';
import {
  makeNebulaTexture, makeRuneRingTexture, makeMistTexture, makeStarTexture,
  makeGlowTexture, makeTraderTexture, makeLabelTexture,
} from './textures.js';

const FOG_TINT = new THREE.Color(0x2c3564);
const MEMORY_GREY = new THREE.Color(0x3c415f);
const DARK_BLUE = new THREE.Color(0x0a0d20);
const tmpColor = new THREE.Color();
const dummy = new THREE.Object3D();

export function hexRingGeometry(outer, inner) {
  const shape = new THREE.Shape();
  const hole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
    const fx = Math.cos(a), fy = Math.sin(a);
    if (i === 0) { shape.moveTo(fx * outer, fy * outer); hole.moveTo(fx * inner, fy * inner); }
    else { shape.lineTo(fx * outer, fy * outer); hole.lineTo(fx * inner, fy * inner); }
  }
  shape.closePath(); hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export class WorldView {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.explored = new Set();
    this.revealAnims = [];
    this.time = 0;

    // everything that rides the floating hex layer lives in this group,
    // so the whole layer can breathe as one
    this.layer = new THREE.Group();
    scene.add(this.layer);

    const size = CONFIG.hexSize;
    this.worldRadius = Math.sqrt(3) * size * (CONFIG.mapRadius + 1);

    this._buildLights();
    this._buildBase();
    this._buildTiles();
    this._buildDecorations();
    this._buildLandmarks();
    this._buildMist();
    this._buildTraders();
    this._buildHighlight();
  }

  // ------------------------------------------------------------- lighting ---
  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0x9aa4d8, 0.85));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
    sun.position.set(35, 60, -25);
    this.scene.add(sun);
    this.scene.fog = new THREE.FogExp2(0x0a0d24, 0.0038);
  }

  // ------------------------------------------------- the cosmic base plane ---
  _buildBase() {
    const g = new THREE.Group();
    const R = this.worldRadius;

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(R * 1.6, 72),
      new THREE.MeshBasicMaterial({ map: makeNebulaTexture(), fog: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = CONFIG.baseY;
    g.add(disc);

    this.baseRings = [];
    const ringDefs = [
      { r: R * 0.42, color: '#8f9bff', y: 0.5, speed: 0.016 },
      { r: R * 0.72, color: '#b48aff', y: 0.9, speed: -0.010 },
      { r: R * 1.02, color: '#f0c46a', y: 1.3, speed: 0.006 },
    ];
    for (const d of ringDefs) {
      const holder = new THREE.Group();
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(d.r * 2, d.r * 2),
        new THREE.MeshBasicMaterial({
          map: makeRuneRingTexture(36 + Math.floor(d.r), d.color),
          transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
          depthWrite: false, fog: false, side: THREE.DoubleSide,
        })
      );
      m.rotation.x = -Math.PI / 2;
      holder.add(m);
      holder.position.y = CONFIG.baseY + d.y;
      holder.userData.speed = d.speed;
      g.add(holder);
      this.baseRings.push(holder);
    }

    // motes of stardust drifting between base and tiles
    {
      const n = 500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * R * 1.2;
        pos[i * 3] = Math.cos(a) * rr;
        pos[i * 3 + 1] = CONFIG.baseY + 1 + Math.random() * (2 - CONFIG.baseY);
        pos[i * 3 + 2] = Math.sin(a) * rr;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
        map: makeStarTexture(), size: 0.5, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        color: 0xaab8ff, sizeAttenuation: true,
      }));
      g.add(this.dust);
    }

    // far starfield
    {
      const n = 1400;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(650 + Math.random() * 250);
        if (v.y < -80) v.y = -v.y; // keep most stars above the horizon
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({
        map: makeStarTexture(), size: 3.2, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        color: 0xdfe6ff,
      })));
    }

    // The Hollow Star — the extinguished wonder at the world's heart
    {
      const wonder = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.05, 1),
        new THREE.MeshStandardMaterial({
          color: 0x20233f, emissive: 0xf0c46a, emissiveIntensity: 0.65,
          flatShading: true, roughness: 0.4,
        })
      );
      wonder.add(core);
      this.wonderCore = core;
      for (const [rad, tilt] of [[2.0, 0.5], [2.6, -0.9]]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(rad, 0.05, 8, 48),
          new THREE.MeshBasicMaterial({
            color: 0xf0c46a, transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
          })
        );
        ring.rotation.x = Math.PI / 2 + tilt;
        wonder.add(ring);
      }
      const light = new THREE.PointLight(0xf0c46a, 40, 34, 2);
      wonder.add(light);
      wonder.position.set(0, 1.6, 0);
      g.add(wonder);
      this.wonder = wonder;
    }

    this.scene.add(g);
  }

  // -------------------------------------------------------- the hex layer ---
  _buildTiles() {
    const { world } = this;
    const size = CONFIG.hexSize;
    const land = world.land;

    const prism = new THREE.CylinderGeometry(size * 0.95, size * 0.85, 1, 6, 1, false);
    prism.translate(0, 0.5, 0);

    this.tileMesh = new THREE.InstancedMesh(
      prism,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.08, flatShading: true }),
      land.length
    );
    this.tileMesh.frustumCulled = false;

    this.ringMesh = new THREE.InstancedMesh(
      hexRingGeometry(size * 0.97, size * 0.80),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        side: THREE.DoubleSide,
      }),
      land.length
    );
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 2;
    this.ringMesh.raycast = () => {};

    this.tileByIdx = land;
    land.forEach((tile, i) => {
      tile.idx = i;
      tile.fogState = -1;

      // base biome color with per-tile variation and a soft kingdom tint
      const biome = BIOMES[tile.biome];
      const c = new THREE.Color(biome.color);
      const v = (hash2(tile.q, tile.r, 555) - 0.5) * 0.16;
      c.offsetHSL(0, 0, v * 0.5);
      const accent = new THREE.Color(biome.accent);
      if (tile.kingdom) {
        const k = world.kingdomById[tile.kingdom];
        c.lerp(new THREE.Color(k.color), 0.10);
        accent.lerp(new THREE.Color(k.color), 0.5);
      }
      tile.baseColor = c;
      tile.ringColor = accent;

      dummy.position.set(tile.x, tile.floatY, tile.z);
      dummy.scale.set(1, tile.height, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      this.tileMesh.setMatrixAt(i, dummy.matrix);
      this.tileMesh.setColorAt(i, c);

      dummy.position.set(tile.x, tile.topY + 0.02, tile.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tile.ringMatrix = dummy.matrix.clone();
      this.ringMesh.setMatrixAt(i, dummy.matrix);
      this.ringMesh.setColorAt(i, accent);
    });

    this.layer.add(this.tileMesh);
    this.layer.add(this.ringMesh);
  }

  // -------------------------------------------------- biome dressing props ---
  _buildDecorations() {
    const { world } = this;
    const size = CONFIG.hexSize;

    const defs = {
      tree: {
        geo: (() => { const g = new THREE.ConeGeometry(0.17, 0.6, 6); g.translate(0, 0.3, 0); return g; })(),
        mat: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }),
        color: 0x1d5c3c,
      },
      peak: {
        geo: (() => { const g = new THREE.ConeGeometry(0.34, 0.95, 5); g.translate(0, 0.47, 0); return g; })(),
        mat: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 }),
        color: 0xbdbad4,
      },
      cactus: {
        geo: (() => { const g = new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6); g.translate(0, 0.25, 0); return g; })(),
        mat: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }),
        color: 0x4c7a3c,
      },
      shard: {
        geo: (() => { const g = new THREE.OctahedronGeometry(0.16); g.scale(1, 2.4, 1); g.translate(0, 0.34, 0); return g; })(),
        mat: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.25, metalness: 0.1 }),
        color: 0xd7ecff,
      },
      crystal: {
        geo: (() => { const g = new THREE.OctahedronGeometry(0.19); g.scale(1, 2.8, 1); g.translate(0, 0.4, 0); return g; })(),
        mat: new THREE.MeshStandardMaterial({
          color: 0xffffff, flatShading: true, roughness: 0.2,
          emissive: 0x7a3fd4, emissiveIntensity: 0.5,
        }),
        color: 0xc79bff,
      },
      ember: {
        geo: (() => { const g = new THREE.CircleGeometry(0.34, 6, Math.PI / 6); g.rotateX(-Math.PI / 2); g.translate(0, 0.03, 0); return g; })(),
        mat: new THREE.MeshBasicMaterial({
          color: 0xffffff, blending: THREE.AdditiveBlending,
          transparent: true, opacity: 0.95, depthWrite: false, fog: false,
        }),
        color: 0xff6a2a,
      },
      grass: {
        geo: (() => { const g = new THREE.ConeGeometry(0.05, 0.24, 4); g.translate(0, 0.12, 0); return g; })(),
        mat: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 }),
        color: 0xa9cf6e,
      },
      sea: null, // seas keep their glassy tops bare
    };

    // collect placements per deco type
    const placements = {};
    for (const t of world.land) {
      if (t.landmark) continue;
      const deco = BIOMES[t.biome].deco;
      if (!deco || !defs[deco]) continue;
      const h = hash2(t.q, t.r, 901);
      const counts = { tree: 3, peak: 2, cactus: h < 0.45 ? 1 : 0, shard: h < 0.55 ? 1 : 0, crystal: 2, ember: 1, grass: h < 0.4 ? 2 : 0 };
      const n = counts[deco] ?? 1;
      for (let i = 0; i < n; i++) {
        const ha = hash2(t.q * 7 + i, t.r * 13 + i, 902);
        const hr = hash2(t.q * 3 + i, t.r * 5 + i, 903);
        const a = ha * Math.PI * 2;
        const rr = deco === 'ember' ? hr * 0.25 : 0.2 + hr * 0.5;
        (placements[deco] ??= []).push({
          tile: t,
          x: t.x + Math.cos(a) * rr * size,
          z: t.z + Math.sin(a) * rr * size,
          y: t.topY,
          s: 0.75 + hash2(t.q + i, t.r - i, 904) * 0.6,
          yaw: ha * Math.PI * 2,
        });
      }
    }

    this.decoMeshes = {};
    for (const [name, list] of Object.entries(placements)) {
      const def = defs[name];
      const mesh = new THREE.InstancedMesh(def.geo, def.mat, list.length);
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      const baseColor = new THREE.Color(def.color);
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(p.s);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        tmpColor.copy(baseColor).offsetHSL(0, 0, (hash2(i, i * 3, 905) - 0.5) * 0.1);
        mesh.setColorAt(i, tmpColor);
        p.matrix = dummy.matrix.clone();
        p.color = tmpColor.clone();
        (p.tile.decos ??= []).push({ mesh, index: i, matrix: p.matrix, color: p.color });
      });
      this.layer.add(mesh);
      this.decoMeshes[name] = mesh;
    }
  }

  // ------------------------------------------------- landmark structures ---
  _buildLandmarks() {
    const { world } = this;
    this.hitboxes = [];
    this.landmarkByTile = new Map();
    const kingdomColor = id => new THREE.Color(id ? world.kingdomById[id].color : 0x9aa3cf);

    const label = (tile, text, sub, color) => {
      const tex = makeLabelTexture(text, { sub, color });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false, fog: false,
      }));
      const s = 0.0105;
      sp.scale.set(tex.userData.w * s, tex.userData.h * s, 1);
      sp.position.set(0, 2.1, 0);
      sp.renderOrder = 10;
      return sp;
    };

    for (const tile of world.land) {
      const lm = tile.landmark;
      if (!lm) continue;
      const g = new THREE.Group();
      g.position.set(tile.x, tile.topY, tile.z);
      const kc = kingdomColor(lm.kingdom);
      const dimmables = [];
      const std = (color, opts = {}) => {
        const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7, ...opts });
        dimmables.push({ mat: m, color: m.color.clone(), emissive: m.emissive.clone(), ei: m.emissiveIntensity });
        return m;
      };

      if (lm.type === 'capital') {
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 6), std(0x3a3f68));
        spire.position.y = 0.75;
        const crown = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.3),
          std(0x222444, { emissive: kc, emissiveIntensity: 1.4, roughness: 0.3 })
        );
        crown.position.y = 1.85;
        g.add(spire, crown);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 5), std(0x323659));
          t2.position.set(Math.cos(a) * 0.62, 0.4, Math.sin(a) * 0.62);
          g.add(t2);
        }
        g.add(label(tile, lm.name, world.kingdomById[lm.kingdom].name, '#' + kc.getHexString()));
      } else if (lm.type === 'town') {
        const n = 3;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + hash2(tile.q, tile.r + i, 906) * 2;
          const hx = Math.cos(a) * 0.42, hz = Math.sin(a) * 0.42;
          const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), std(0x9a8a70));
          body.position.set(hx, 0.1, hz);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 4), std(kc.clone().multiplyScalar(0.85)));
          roof.position.set(hx, 0.3, hz);
          roof.rotation.y = a;
          g.add(body, roof);
        }
        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 6),
          std(0xffd98a, { emissive: 0xffc75a, emissiveIntensity: 2 })
        );
        lantern.position.y = 0.55;
        g.add(lantern);
        g.add(label(tile, lm.name, lm.kingdom ? null : 'free town', '#ffe9c0'));
      } else if (lm.type === 'dungeon') {
        for (const sx of [-0.3, 0.3]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), std(0x232338));
          pillar.position.set(sx, 0.42, 0);
          g.add(pillar);
        }
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.22), std(0x232338));
        lintel.position.y = 0.9;
        const portal = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, 0.72),
          new THREE.MeshBasicMaterial({
            color: 0x8a4fd9, transparent: true, opacity: 0.8,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
          })
        );
        portal.position.y = 0.45;
        dimmables.push({ mat: portal.material, color: portal.material.color.clone() });
        g.add(lintel, portal);
        g.add(label(tile, lm.name, 'dungeon', '#c9a8ff'));
      } else if (lm.type === 'shrine') {
        const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.8, 5), std(0x565a86));
        obelisk.position.y = 0.4;
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 6),
          std(0x223, { emissive: 0x9fe8ff, emissiveIntensity: 2.2 })
        );
        orb.position.y = 0.95;
        g.add(obelisk, orb);
      }

      // invisible hitbox so clicking a structure selects its tile
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 2.4, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 1.2;
      hit.userData.tile = tile;
      g.add(hit);
      this.hitboxes.push(hit);

      this.layer.add(g);
      tile.landmarkView = { group: g, dimmables, labelSprite: g.children.find(ch => ch.isSprite) };
      this.landmarkByTile.set(keyOf(tile.q, tile.r), tile.landmarkView);
    }

    // the volcano breathes
    const vol = world.volcano;
    const volLight = new THREE.PointLight(0xff5a1f, 40, 20, 2);
    volLight.position.set(vol.x, vol.topY + 2, vol.z);
    this.layer.add(volLight);
    this.volLight = volLight;
  }

  // ------------------------------------------------------- fog-of-war mist ---
  _buildMist() {
    const size = CONFIG.hexSize;
    const land = this.world.land;
    const cap = new THREE.CircleGeometry(size * 1.32, 6, Math.PI / 6);
    cap.rotateX(-Math.PI / 2);
    this.mistMesh = new THREE.InstancedMesh(
      cap,
      new THREE.MeshBasicMaterial({
        map: makeMistTexture(), color: 0x525c8f, transparent: true, opacity: 0.95,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
      }),
      land.length
    );
    this.mistMesh.frustumCulled = false;
    this.mistMesh.renderOrder = 3;
    this.mistMesh.raycast = () => {};
    land.forEach((tile, i) => {
      tile.capPos = new THREE.Vector3(tile.x, tile.topY + 0.5, tile.z);
      tile.capYaw = hash2(tile.q, tile.r, 907) * Math.PI * 2;
      this._setCapScale(i, 1);
    });
    this.layer.add(this.mistMesh);
  }

  _setCapScale(idx, s) {
    const tile = this.tileByIdx[idx];
    dummy.position.copy(tile.capPos);
    dummy.rotation.set(0, tile.capYaw, 0);
    dummy.scale.setScalar(Math.max(s, 0.0001));
    dummy.updateMatrix();
    this.mistMesh.setMatrixAt(idx, dummy.matrix);
  }

  // -------------------------------------------------------------- traders ---
  _buildTraders() {
    const tex = makeTraderTexture();
    this.traderGlow = makeGlowTexture('#ffd98a');
    this.traders = this.world.traders.map(t => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sp.scale.set(1.05, 0.92, 1);
      sp.center.set(0.5, 0.1);
      sp.renderOrder = 4;
      const tile = t.tile;
      sp.position.set(tile.x, tile.topY + 0.04, tile.z);
      this.layer.add(sp);
      return { tile, sprite: sp, timer: 2 + Math.random() * 5, hop: null };
    });
  }

  traderOnTile(tile) {
    return this.traders.some(t => t.tile === tile);
  }

  // ------------------------------------------------------- hover highlight ---
  _buildHighlight() {
    this.highlight = new THREE.Mesh(
      hexRingGeometry(CONFIG.hexSize * 1.02, CONFIG.hexSize * 0.86),
      new THREE.MeshBasicMaterial({
        color: 0xf0c46a, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
      })
    );
    this.highlight.renderOrder = 5;
    this.highlight.visible = false;
    this.highlight.raycast = () => {};
    this.layer.add(this.highlight);
  }

  setHighlight(tile) {
    if (!tile) { this.highlight.visible = false; return; }
    this.highlight.visible = true;
    this.highlight.position.set(tile.x, tile.topY + 0.06, tile.z);
  }

  // ---------------------------------------------------------- fog of war ---
  updateFog(center, { animate = true } = {}) {
    const V = CONFIG.visionRadius, RIM = CONFIG.rimRadius;
    let colorDirty = false, matrixDirty = false;

    for (const tile of this.tileByIdx) {
      const d = hexDist(tile.q, tile.r, center.q, center.r);
      const k = keyOf(tile.q, tile.r);
      if (d <= RIM) this.explored.add(k);
      const state = d <= V ? 3 : d <= RIM ? 2 : this.explored.has(k) ? 1 : 0;
      if (state === tile.fogState) continue;
      const prev = tile.fogState;
      tile.fogState = state;
      colorDirty = true;
      matrixDirty = true;

      // tile top color
      tmpColor.copy(tile.baseColor);
      if (state === 2) tmpColor.multiplyScalar(0.62).lerp(FOG_TINT, 0.12);
      else if (state === 1) tmpColor.lerp(MEMORY_GREY, 0.5).multiplyScalar(0.45);
      else if (state === 0) tmpColor.lerp(DARK_BLUE, 0.94).multiplyScalar(0.85);
      this.tileMesh.setColorAt(tile.idx, tmpColor);

      // runic edge ring
      const ringFactor = state === 3 ? 1 : state === 2 ? 0.45 : state === 1 ? 0.14 : 0;
      tmpColor.copy(tile.ringColor).multiplyScalar(ringFactor);
      this.ringMesh.setColorAt(tile.idx, tmpColor);

      // mist cap
      const wantCap = state === 0 ? 1 : 0;
      if (wantCap === 0 && prev === 0 && animate) {
        this.revealAnims.push({ idx: tile.idx, t: 0 });
      } else {
        this._setCapScale(tile.idx, wantCap);
      }

      // decorations
      if (tile.decos) {
        const f = state === 3 ? 1 : state === 2 ? 0.6 : state === 1 ? 0.35 : 0;
        for (const d2 of tile.decos) {
          if (f === 0) {
            dummy.matrix.copy(d2.matrix);
            dummy.matrix.scale(new THREE.Vector3(0.0001, 0.0001, 0.0001));
            d2.mesh.setMatrixAt(d2.index, dummy.matrix);
          } else {
            d2.mesh.setMatrixAt(d2.index, d2.matrix);
            tmpColor.copy(d2.color).multiplyScalar(f);
            if (state === 1) tmpColor.lerp(MEMORY_GREY, 0.4);
            d2.mesh.setColorAt(d2.index, tmpColor);
          }
          d2.mesh.instanceMatrix.needsUpdate = true;
          if (d2.mesh.instanceColor) d2.mesh.instanceColor.needsUpdate = true;
        }
      }

      // landmark structures + labels
      if (tile.landmarkView) {
        const lv = tile.landmarkView;
        lv.group.visible = state > 0;
        const f = state === 3 ? 1 : state === 2 ? 0.65 : 0.3;
        for (const dm of lv.dimmables) {
          dm.mat.color.copy(dm.color).multiplyScalar(f);
          if (dm.emissive) dm.mat.emissiveIntensity = dm.ei * (state === 3 ? 1 : state === 2 ? 0.5 : 0.15);
        }
        if (lv.labelSprite) lv.labelSprite.material.opacity = state === 3 ? 1 : state === 2 ? 0.85 : 0.4;
      }
    }

    if (colorDirty) {
      this.tileMesh.instanceColor.needsUpdate = true;
      this.ringMesh.instanceColor.needsUpdate = true;
    }
    if (matrixDirty) {
      this.mistMesh.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------- per-frame ---
  update(dt, camera) {
    this.time += dt;
    const t = this.time;

    for (const ring of this.baseRings) ring.rotation.y += ring.userData.speed * dt * 60 * 0.016;
    this.dust.rotation.y += dt * 0.008;
    this.wonder.rotation.y += dt * 0.25;
    this.wonderCore.rotation.x += dt * 0.4;
    this.wonder.position.y = 1.6 + Math.sin(t * 0.8) * 0.35;
    this.volLight.intensity = 40 + Math.sin(t * 2.4) * 12 + Math.sin(t * 7.1) * 5;
    this.mistMesh.material.opacity = 0.88 + Math.sin(t * 0.9) * 0.06;
    this.highlight.material.opacity = 0.65 + Math.sin(t * 5) * 0.25;

    // the whole hex layer breathes, faintly
    this.layer.position.y = Math.sin(t * 0.5) * 0.06;

    // shroud reveal animations
    if (this.revealAnims.length) {
      for (const a of this.revealAnims) {
        a.t += dt / 0.55;
        const s = Math.max(0, 1 - a.t * a.t);
        this._setCapScale(a.idx, s);
      }
      this.revealAnims = this.revealAnims.filter(a => a.t < 1);
      this.mistMesh.instanceMatrix.needsUpdate = true;
    }

    // wandering traders hop between hexes
    for (const tr of this.traders) {
      if (tr.hop) {
        tr.hop.t += dt / 0.55;
        const p = Math.min(1, tr.hop.t);
        const e = p * p * (3 - 2 * p);
        const from = tr.hop.from, to = tr.hop.to;
        tr.sprite.position.set(
          from.x + (to.x - from.x) * e,
          from.topY + (to.topY - from.topY) * e + Math.sin(p * Math.PI) * 0.7 + 0.04,
          from.z + (to.z - from.z) * e
        );
        if (p >= 1) { tr.tile = to; tr.hop = null; tr.timer = 3.5 + Math.random() * 4.5; }
      } else {
        tr.timer -= dt;
        if (tr.timer <= 0) {
          const opts = neighborsOf(tr.tile.q, tr.tile.r)
            .map(([q, r]) => this.world.tiles.get(keyOf(q, r)))
            .filter(n => n && !n.void && n.biome !== 'SEA' && !n.landmark);
          if (opts.length) tr.hop = { from: tr.tile, to: opts[Math.floor(Math.random() * opts.length)], t: 0 };
          else tr.timer = 5;
        }
      }
      tr.sprite.visible = tr.tile.fogState >= 2;
    }
  }
}
