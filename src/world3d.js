// Builds and animates the world-map scene: the cosmic base far below, the
// rift-carved layer of floating hex prisms, runic glow rings, decorations,
// landmarks, warded gates, star-bridges and satellites, the fog-of-war
// shroud, site glints, secret-hex cracks, and the wandering traders.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { hash2 } from './rng.js';
import { keyOf, hexDist, neighborsOf } from './hex.js';
import { BIOMES, CELESTIALS } from './names.js';
import { run } from './run.js';
import {
  makeNebulaTexture, makeRuneRingTexture, makeMistTexture, makeStarTexture,
  makeGlowTexture, makeTraderTexture, makeLabelTexture, makeEnemyTexture,
} from './textures.js';

const FOG_TINT = new THREE.Color(0x2c3564);
const MEMORY_GREY = new THREE.Color(0x3c415f);
const DARK_BLUE = new THREE.Color(0x0a0d20);
const tmpColor = new THREE.Color();
const dummy = new THREE.Object3D();

export const TIER_COLORS = [0x9aa3cf, 0x6fe0c8, 0xf0c46a, 0xff7a45, 0xd94f8e, 0xb48aff];

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
    this.popAnims = [];
    this.time = 0;

    this.layer = new THREE.Group();
    scene.add(this.layer);

    const size = CONFIG.hexSize;
    this.worldRadius = Math.sqrt(3) * size * (CONFIG.mapRadius + 1);
    // secret hexes render too (hidden until revealed), so they get slots
    this.renderTiles = [...world.land, ...world.secrets];

    this._buildLights();
    this._buildBase();
    this._buildCelestials();
    this._buildTiles();
    this._buildDecorations();
    this._buildLandmarks();
    this._buildMist();
    this._buildGlints();
    this._buildCracks();
    this._buildTraders();
    this._buildHighlight();
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0x9aa4d8, 0.85));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
    sun.position.set(35, 60, -25);
    this.scene.add(sun);
    this.scene.fog = new THREE.FogExp2(0x0a0d24, 0.0026);
  }

  // ------------------------------------------------- the cosmic base plane ---
  _buildBase() {
    const g = new THREE.Group();
    const R = this.worldRadius;

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(R * 1.7, 72),
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
      { r: R * 1.32, color: '#6f9bff', y: 1.7, speed: -0.004 },
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

    // motes of stardust
    {
      const n = 600;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * R * 1.4;
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
      const n = 1600;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(900 + Math.random() * 300);
        if (v.y < -100) v.y = -v.y;
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({
        map: makeStarTexture(), size: 3.6, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        color: 0xdfe6ff,
      })));
    }

    // Vael, the Undying Sun — blazing in the crater at the world's heart
    {
      const sun = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.7, 1),
        new THREE.MeshStandardMaterial({
          color: 0x804a10, emissive: 0xffb63a, emissiveIntensity: 1.6,
          flatShading: true, roughness: 0.35,
        })
      );
      sun.add(core);
      this.sunCore = core;
      const corona = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('#ffcf6a'), transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      corona.scale.setScalar(11);
      sun.add(corona);
      this.sunCorona = corona;
      for (const [rad, tilt] of [[2.6, 0.5], [3.4, -0.9]]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(rad, 0.05, 8, 48),
          new THREE.MeshBasicMaterial({
            color: 0xffc75a, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
          })
        );
        ring.rotation.x = Math.PI / 2 + tilt;
        sun.add(ring);
      }
      sun.add(new THREE.PointLight(0xffc05a, 90, 46, 2));
      sun.position.set(0, 2.0, 0);
      g.add(sun);
      this.sun = sun;
    }

    // faint nebula pads beneath each satellite
    for (const sat of this.world.satellites) {
      const { x, z } = sat.center;
      const pad = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('#5a6aff'), transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      pad.scale.setScalar(16);
      pad.position.set(x, CONFIG.baseY + 2.5, z);
      g.add(pad);
    }

    this.scene.add(g);
  }

  // ---------------------------------------------- cosmic landmark objects ---
  // Sky-layer scenery, never fogged: planet bodies looming over the
  // satellites, constellations and shattered moons above the rifts, a
  // sleeping giant beyond the rim, and a comet that never stops orbiting.
  _buildCelestials() {
    const g = new THREE.Group();
    this.scene.add(g);
    this.celestialSpinners = [];
    const R = this.worldRadius;
    const seed = this.world.seed;
    const rng = (a, b) => hash2(a | 0, b | 0, seed + 8888);

    const skyLabel = (text, sub, color = '#c9d2ff', scale = 0.02, opacity = 0.75) => {
      const tex = makeLabelTexture(text, { sub, color });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity, depthTest: false, fog: false,
      }));
      sp.scale.set(tex.userData.w * scale, tex.userData.h * scale, 1);
      sp.renderOrder = 10;
      return sp;
    };
    const glowSprite = (color, size, opacity = 0.5) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(color), transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sp.scale.setScalar(size);
      return sp;
    };

    // --- planet bodies over the three satellites --------------------------
    for (const sat of this.world.satellites) {
      const { x, z } = sat.center;
      const holder = new THREE.Group();
      holder.position.set(x, 7.2, z);

      if (sat.def.id === 'luna') {
        // the Pale Daughter: a cratered silver moon in a halo of dust
        const body = new THREE.Mesh(
          new THREE.IcosahedronGeometry(2.4, 1),
          new THREE.MeshStandardMaterial({
            color: 0xd8dcee, flatShading: true, roughness: 0.9,
            emissive: 0x9aa4d8, emissiveIntensity: 0.25,
          })
        );
        holder.add(body);
        for (let i = 0; i < 7; i++) {
          const crater = new THREE.Mesh(
            new THREE.CircleGeometry(0.2 + rng(i, 1) * 0.3, 8),
            new THREE.MeshBasicMaterial({ color: 0x8a90b8, side: THREE.DoubleSide })
          );
          const dir = new THREE.Vector3().randomDirection();
          crater.position.copy(dir).multiplyScalar(2.42);
          crater.lookAt(crater.position.clone().multiplyScalar(2));
          holder.add(crater);
        }
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(3.4, 0.04, 6, 48),
          new THREE.MeshBasicMaterial({
            color: 0xe8ecff, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
          })
        );
        halo.rotation.x = Math.PI / 2 - 0.25;
        holder.add(halo, glowSprite('#c9d2ff', 9, 0.4));
        holder.add(new THREE.PointLight(0xc9d2ff, 25, 30, 2));
        this.celestialSpinners.push({ obj: body, speed: 0.05 });
      } else if (sat.def.id === 'rubidus') {
        // Rubidus: a rust wanderer wearing double rings of red dust
        const body = new THREE.Mesh(
          new THREE.IcosahedronGeometry(2.6, 1),
          new THREE.MeshStandardMaterial({
            color: 0xa8503c, flatShading: true, roughness: 0.85,
            emissive: 0x662418, emissiveIntensity: 0.5,
          })
        );
        holder.add(body);
        for (const [rad, op] of [[3.6, 0.5], [4.3, 0.28]]) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(rad, 0.09, 6, 56),
            new THREE.MeshBasicMaterial({
              color: 0xff8a5a, transparent: true, opacity: op,
              blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
            })
          );
          ring.rotation.x = Math.PI / 2 + 0.42;
          holder.add(ring);
        }
        holder.add(glowSprite('#ff8a5a', 9, 0.35));
        holder.add(new THREE.PointLight(0xff7a4a, 25, 30, 2));
        this.celestialSpinners.push({ obj: body, speed: 0.08 });
      } else {
        // the Viridian Comet: a green head streaming a long frozen tail
        const body = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.9, 0),
          new THREE.MeshStandardMaterial({
            color: 0x3c8a5e, flatShading: true, roughness: 0.4,
            emissive: 0x2affa0, emissiveIntensity: 0.6,
          })
        );
        holder.add(body);
        const away = new THREE.Vector3(x, 0, z).normalize(); // tail points away from the sun
        for (let i = 1; i <= 6; i++) {
          const puff = glowSprite('#8affc4', 3.4 - i * 0.42, 0.4 - i * 0.05);
          puff.position.copy(away).multiplyScalar(i * 1.7);
          puff.position.y += i * 0.35;
          holder.add(puff);
        }
        holder.add(glowSprite('#8affc4', 8, 0.45));
        holder.add(new THREE.PointLight(0x6affb4, 25, 30, 2));
        this.celestialSpinners.push({ obj: body, speed: 0.3 });
      }
      const lbl = skyLabel(sat.def.name, 'wandering world', '#c9d2ff', 0.014);
      lbl.position.y = 4.6;
      holder.add(lbl);
      holder.userData.baseY = holder.position.y;
      holder.userData.bobPhase = rng(x | 0, z | 0) * Math.PI * 2;
      (this.planetBodies ??= []).push(holder);
      g.add(holder);
    }

    // --- helper: find spots over the void, spread apart -------------------
    const voidSpots = [];
    {
      const cands = this.world.list
        .filter(t => t.void && !t.secret && t.cDist > 10 && t.cDist < CONFIG.mapRadius - 4)
        .sort((a, b) => hash2(b.q, b.r, seed + 9100) - hash2(a.q, a.r, seed + 9100));
      for (const t of cands) {
        if (voidSpots.length >= 6) break;
        if (voidSpots.some(s => hexDist(s.q, s.r, t.q, t.r) < 18)) continue;
        voidSpots.push(t);
      }
    }

    // --- constellations drifting over the rifts ---------------------------
    this.constellations = [];
    CELESTIALS.constellations.forEach((def, ci) => {
      const spot = voidSpots[ci];
      if (!spot) return;
      const holder = new THREE.Group();
      holder.position.set(spot.x, 4.2, spot.z);
      const pts = [];
      let px = 0, pz = 0;
      const n = 5 + Math.floor(rng(ci, 77) * 3);
      for (let i = 0; i < n; i++) {
        pts.push(new THREE.Vector3(px, (rng(ci * 31 + i, 5) - 0.5) * 1.6, pz));
        const a = rng(ci * 17 + i, 9) * Math.PI * 2;
        px += Math.cos(a) * (1.4 + rng(ci, i) * 1.2);
        pz += Math.sin(a) * (1.4 + rng(ci, i) * 1.2);
      }
      const center = pts.reduce((v, p) => v.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      for (const p of pts) p.sub(center);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lines = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
        color: 0x8fa4ff, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      holder.add(lines);
      for (const p of pts) {
        const star = glowSprite('#dfe6ff', 0.9, 0.85);
        star.position.copy(p);
        holder.add(star);
      }
      const lbl = skyLabel(def.name, def.sub, '#8fa4ff', 0.013, 0.55);
      lbl.position.y = -1.8;
      holder.add(lbl);
      this.constellations.push({ holder, lines, phase: ci * 1.7 });
      g.add(holder);
    });

    // --- shattered moons hanging in the rifts ------------------------------
    CELESTIALS.shattermoons.forEach((def, mi) => {
      const spot = voidSpots[4 + mi];
      if (!spot) return;
      const holder = new THREE.Group();
      holder.position.set(spot.x, 3.4, spot.z);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xb8bcd8, flatShading: true, roughness: 0.9, emissive: 0x585e88, emissiveIntensity: 0.2,
      });
      const nChunks = 7 + Math.floor(rng(mi, 55) * 3);
      for (let i = 0; i < nChunks; i++) {
        const chunk = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25 + rng(mi * 9 + i, 3) * 0.55, 0), mat);
        const a = rng(mi * 13 + i, 4) * Math.PI * 2;
        const rr = 0.6 + rng(mi * 7 + i, 6) * 2.2;
        chunk.position.set(Math.cos(a) * rr, (rng(mi + i, 8) - 0.5) * 1.6, Math.sin(a) * rr);
        chunk.rotation.set(rng(i, 1) * 3, rng(i, 2) * 3, 0);
        holder.add(chunk);
      }
      holder.add(glowSprite('#aab4e8', 6, 0.25));
      const lbl = skyLabel(def.name, def.sub, '#b8c2e8', 0.012, 0.5);
      lbl.position.y = -2.4;
      holder.add(lbl);
      this.celestialSpinners.push({ obj: holder, speed: 0.04 + mi * 0.02 });
      g.add(holder);
    });

    // --- Thal-Vaur, the sleeping giant beyond the rim ----------------------
    {
      const holder = new THREE.Group();
      const a = -1.0; // a gap between the satellites
      holder.position.set(Math.cos(a) * R * 1.6, 5, Math.sin(a) * R * 1.6);
      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(8.5, 1),
        new THREE.MeshStandardMaterial({
          color: 0x3c3466, flatShading: true, roughness: 0.7,
          emissive: 0x241d48, emissiveIntensity: 0.6,
        })
      );
      holder.add(body);
      for (const [rad, op, tilt] of [[12, 0.35, 0.5], [14.5, 0.18, 0.5]]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(rad, 0.16, 6, 64),
          new THREE.MeshBasicMaterial({
            color: 0x8f7ae0, transparent: true, opacity: op,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
          })
        );
        ring.rotation.x = Math.PI / 2 + tilt;
        holder.add(ring);
      }
      holder.add(glowSprite('#8f7ae0', 26, 0.22));
      const lbl = skyLabel(CELESTIALS.giant.name, CELESTIALS.giant.sub, '#a89ae8', 0.022, 0.7);
      lbl.position.y = 12.5;
      holder.add(lbl);
      this.celestialSpinners.push({ obj: body, speed: 0.012 });
      g.add(holder);
    }

    // --- the Errand: a comet forever circling the disc ---------------------
    {
      const holder = new THREE.Group();
      const head = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color: 0x9fe8ff, flatShading: true, emissive: 0x9fe8ff, emissiveIntensity: 1.6, roughness: 0.3,
        })
      );
      holder.add(head, glowSprite('#9fe8ff', 4.5, 0.7));
      const lbl = skyLabel(CELESTIALS.comet.name, CELESTIALS.comet.sub, '#9fe8ff', 0.011, 0.55);
      lbl.position.y = 2.0;
      holder.add(lbl);
      this.cometTail = [];
      for (let i = 0; i < 12; i++) {
        const puff = glowSprite('#9fe8ff', 2.6 - i * 0.18, 0.4 * (1 - i / 13));
        this.scene.add(puff);
        this.cometTail.push(puff);
      }
      this.comet = { holder, angle: rng(3, 3) * Math.PI * 2, radius: R * 1.12, y: 7.5, speed: (Math.PI * 2) / 150 };
      g.add(holder);
    }
  }

  // -------------------------------------------------------- the hex layer ---
  _buildTiles() {
    const { world } = this;
    const size = CONFIG.hexSize;
    const rts = this.renderTiles;

    const prism = new THREE.CylinderGeometry(size * 0.95, size * 0.85, 1, 6, 1, false);
    prism.translate(0, 0.5, 0);

    this.tileMesh = new THREE.InstancedMesh(
      prism,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.08, flatShading: true }),
      rts.length
    );
    this.tileMesh.frustumCulled = false;

    this.ringMesh = new THREE.InstancedMesh(
      hexRingGeometry(size * 0.97, size * 0.80),
      new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        side: THREE.DoubleSide,
      }),
      rts.length
    );
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 2;
    this.ringMesh.raycast = () => {};

    this.tileByIdx = rts;
    rts.forEach((tile, i) => {
      tile.idx = i;
      tile.fogState = -1;
      this._styleTile(tile);
      this._setTileMatrix(tile, tile.void ? 0 : 1);
      this.tileMesh.setColorAt(i, tile.baseColor);
      this.ringMesh.setColorAt(i, tile.ringColor);
    });

    this.layer.add(this.tileMesh);
    this.layer.add(this.ringMesh);
  }

  _styleTile(tile) {
    const { world } = this;
    const biome = BIOMES[tile.biome] || BIOMES.CRYSTAL;
    const c = new THREE.Color(biome.color);
    const v = (hash2(tile.q, tile.r, 555) - 0.5) * 0.16;
    c.offsetHSL(0, 0, v * 0.5);
    const accent = new THREE.Color(biome.accent);
    if (tile.kingdom) {
      const k = world.kingdomById[tile.kingdom];
      c.lerp(new THREE.Color(k.color), 0.10);
      accent.lerp(new THREE.Color(k.color), 0.5);
    }
    if (tile.gate) accent.set(TIER_COLORS[Math.min(tile.gate.tier, TIER_COLORS.length - 1)]);
    tile.baseColor = c;
    tile.ringColor = accent;
  }

  _setTileMatrix(tile, scale) {
    const flat = tile.biome === 'BRIDGE' ? 0.55 : 1;
    dummy.position.set(tile.x, tile.floatY, tile.z);
    dummy.scale.set(flat * scale || 0.0001, (tile.height || 1) * (scale || 0.0001), flat * scale || 0.0001);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    this.tileMesh.setMatrixAt(tile.idx, dummy.matrix);
    dummy.position.set(tile.x, tile.topY + 0.02, tile.z);
    dummy.scale.set(flat * scale || 0.0001, 1, flat * scale || 0.0001);
    dummy.updateMatrix();
    this.ringMesh.setMatrixAt(tile.idx, dummy.matrix);
  }

  // -------------------------------------------------- biome dressing props ---
  _buildDecorations() {
    const { world } = this;
    const size = CONFIG.hexSize;

    const defs = {
      tree: { geo: cone(0.17, 0.6, 6), mat: stdMat(), color: 0x1d5c3c },
      peak: { geo: cone(0.34, 0.95, 5), mat: stdMat({ roughness: 0.95 }), color: 0xbdbad4 },
      cactus: { geo: cyl(0.07, 0.1, 0.5), mat: stdMat(), color: 0x4c7a3c },
      shard: { geo: octa(0.16, 2.4), mat: stdMat({ roughness: 0.25, metalness: 0.1 }), color: 0xd7ecff },
      crystal: { geo: octa(0.19, 2.8), mat: stdMat({ roughness: 0.2, emissive: 0x7a3fd4, emissiveIntensity: 0.5 }), color: 0xc79bff },
      ember: {
        geo: (() => { const g = new THREE.CircleGeometry(0.34, 6, Math.PI / 6); g.rotateX(-Math.PI / 2); g.translate(0, 0.03, 0); return g; })(),
        mat: new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false, fog: false }),
        color: 0xff6a2a,
      },
      grass: { geo: cone(0.05, 0.24, 4), mat: stdMat({ roughness: 0.95 }), color: 0xa9cf6e },
      sea: null,
    };
    function stdMat(opts = {}) { return new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9, ...opts }); }
    function cone(r, h, s) { const g = new THREE.ConeGeometry(r, h, s); g.translate(0, h / 2, 0); return g; }
    function cyl(r1, r2, h) { const g = new THREE.CylinderGeometry(r1, r2, h, 6); g.translate(0, h / 2, 0); return g; }
    function octa(r, sy) { const g = new THREE.OctahedronGeometry(r); g.scale(1, sy, 1); g.translate(0, r * sy * 0.9, 0); return g; }

    const placements = {};
    for (const t of world.land) {
      if (t.landmark || t.gate) continue;
      const deco = (BIOMES[t.biome] || {}).deco;
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
    for (const [name, listP] of Object.entries(placements)) {
      const def = defs[name];
      const mesh = new THREE.InstancedMesh(def.geo, def.mat, listP.length);
      mesh.frustumCulled = false;
      mesh.raycast = () => {};
      const baseColor = new THREE.Color(def.color);
      listP.forEach((p, i) => {
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
    this.gateViews = new Map();
    const kingdomColor = id => new THREE.Color(id ? world.kingdomById[id].color : 0x9aa3cf);

    const label = (text, sub, color, y = 2.1) => {
      const tex = makeLabelTexture(text, { sub, color });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false, fog: false,
      }));
      const s = 0.0105;
      sp.scale.set(tex.userData.w * s, tex.userData.h * s, 1);
      sp.position.set(0, y, 0);
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
        g.add(label(lm.name, world.kingdomById[lm.kingdom].name, '#' + kc.getHexString(), 2.3));
      } else if (lm.type === 'town') {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + hash2(tile.q, tile.r + i, 906) * 2;
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
        g.add(label(lm.name, lm.kingdom ? null : 'free town', '#ffe9c0'));
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
        g.add(label(lm.name, 'dungeon', '#c9a8ff'));
      } else if (lm.type === 'shrine') {
        const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.8, 5), std(0x565a86));
        obelisk.position.y = 0.4;
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 8, 6),
          std(0x223, { emissive: 0x9fe8ff, emissiveIntensity: 2.2 })
        );
        orb.position.y = 0.95;
        g.add(obelisk, orb);
      } else if (lm.type === 'gate') {
        const tierC = new THREE.Color(TIER_COLORS[Math.min(lm.tier, TIER_COLORS.length - 1)]);
        for (const sx of [-0.55, 0.55]) {
          const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.7, 5), std(0x1e2038));
          pylon.position.set(sx, 0.85, 0);
          g.add(pylon);
          const tip = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.14),
            std(0x1a1c30, { emissive: tierC, emissiveIntensity: 1.8 })
          );
          tip.position.set(sx, 1.8, 0);
          g.add(tip);
        }
        const barrier = new THREE.Mesh(
          new THREE.PlaneGeometry(1.0, 1.6),
          new THREE.MeshBasicMaterial({
            color: tierC, transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
          })
        );
        barrier.position.y = 0.85;
        g.add(barrier);
        const skulls = '☠'.repeat(Math.min(5, lm.tier));
        g.add(label(lm.name.split(',')[0], `${skulls} warded gate · tier ${lm.tier}`, '#' + tierC.getHexString(), 2.5));
        this.gateViews.set(keyOf(tile.q, tile.r), { barrier, tierC, dimmables });
      } else if (lm.type === 'satboss') {
        const throne = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 4), std(0x241a38));
        throne.position.y = 0.8;
        throne.rotation.y = Math.PI / 4;
        const eye = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.28),
          std(0x140f24, { emissive: 0xff4a6a, emissiveIntensity: 2.2 })
        );
        eye.position.y = 1.9;
        g.add(throne, eye);
        const satDef = world.satellites.find(s => s.def.id === lm.satellite)?.def;
        g.add(label(satDef?.name || 'The Deep Sky', '☠☠☠☠ optional boss', '#ff9ab0', 2.9));
      }

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
    }

    const vol = world.volcano;
    const volLight = new THREE.PointLight(0xff5a1f, 40, 20, 2);
    volLight.position.set(vol.x, vol.topY + 2, vol.z);
    this.layer.add(volLight);
    this.volLight = volLight;
  }

  openGate(tile) {
    const gv = this.gateViews.get(keyOf(tile.q, tile.r));
    if (gv) {
      gv.barrier.visible = false;
      for (const dm of gv.dimmables) {
        if (dm.mat.emissive) { dm.mat.emissive.set(0xf0c46a); dm.emissive = new THREE.Color(0xf0c46a); }
      }
    }
  }

  // ------------------------------------------------------- fog-of-war mist ---
  _buildMist() {
    const size = CONFIG.hexSize;
    const rts = this.renderTiles;
    const cap = new THREE.CircleGeometry(size * 1.32, 6, Math.PI / 6);
    cap.rotateX(-Math.PI / 2);
    this.mistMesh = new THREE.InstancedMesh(
      cap,
      new THREE.MeshBasicMaterial({
        map: makeMistTexture(), color: 0x525c8f, transparent: true, opacity: 0.95,
        depthWrite: false, fog: false, side: THREE.DoubleSide,
      }),
      rts.length
    );
    this.mistMesh.frustumCulled = false;
    this.mistMesh.renderOrder = 3;
    this.mistMesh.raycast = () => {};
    rts.forEach((tile, i) => {
      tile.capPos = new THREE.Vector3(tile.x, tile.topY + 0.5, tile.z);
      tile.capYaw = hash2(tile.q, tile.r, 907) * Math.PI * 2;
      // unrevealed secrets hide entirely: no cap, no prism
      this._setCapScale(i, tile.secret ? 0 : 1);
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

  // -------------------------------------------------- site glints & cracks ---
  _buildGlints() {
    const { world } = this;
    // budgeted site hexes shimmer so the sparse map reads
    const glintTiles = world.land.filter(t => t.hasSite && !t.landmark && !t.gate);
    // secrets get a slot too, for when they open
    const capacity = glintTiles.length + world.secrets.length;
    const geo = new THREE.OctahedronGeometry(0.11);
    geo.scale(1, 1.6, 1);
    this.glintMesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x453a10, emissive: 0xf0c46a, emissiveIntensity: 1.6,
        flatShading: true, roughness: 0.3,
      }),
      capacity
    );
    this.glintMesh.frustumCulled = false;
    this.glintMesh.raycast = () => {};
    this.glintIdx = new Map();
    let i = 0;
    for (const t of [...glintTiles, ...world.secrets]) {
      this.glintIdx.set(keyOf(t.q, t.r), i);
      t.hasGlint = !t.secret;
      dummy.position.set(t.x, t.topY + 0.55, t.z);
      dummy.rotation.set(0, hash2(t.q, t.r, 908) * Math.PI, 0.3);
      dummy.scale.setScalar(0.0001); // revealed by fog updates
      dummy.updateMatrix();
      this.glintMesh.setMatrixAt(i, dummy.matrix);
      i++;
    }
    this.layer.add(this.glintMesh);
  }

  setGlint(tile, on) {
    tile.hasGlint = on;
    this._applyGlint(tile);
  }

  _applyGlint(tile) {
    const gi = this.glintIdx.get(keyOf(tile.q, tile.r));
    if (gi == null) return;
    const show = tile.hasGlint && tile.fogState >= 2 && !tile.void;
    dummy.position.set(tile.x, tile.topY + 0.55, tile.z);
    dummy.rotation.set(0, hash2(tile.q, tile.r, 908) * Math.PI, 0.3);
    dummy.scale.setScalar(show ? 1 : 0.0001);
    dummy.updateMatrix();
    this.glintMesh.setMatrixAt(gi, dummy.matrix);
    this.glintMesh.instanceMatrix.needsUpdate = true;
  }

  _buildCracks() {
    // hairline gold runes on tiles adjacent to sealed secrets
    const tex = makeLabelTexture('⚡', { color: '#f0c46a' });
    this.crackSprites = [];
    for (const t of this.world.land) {
      if (!t.crackHint) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('#f0c46a'), transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sp.scale.setScalar(0.5);
      sp.position.set(t.x + 0.3, t.topY + 0.12, t.z - 0.2);
      this.layer.add(sp);
      t.crackSprite = sp;
      this.crackSprites.push(sp);
    }
  }

  // ------------------------------------------------------- secret reveals ---
  revealSecretTile(tile) {
    // called after world.revealSecret(tile): pop the prism in
    this._styleTile(tile);
    this.tileMesh.setColorAt(tile.idx, tile.baseColor);
    this.ringMesh.setColorAt(tile.idx, tile.ringColor);
    this.tileMesh.instanceColor.needsUpdate = true;
    this.ringMesh.instanceColor.needsUpdate = true;
    tile.capPos = new THREE.Vector3(tile.x, tile.topY + 0.5, tile.z);
    tile.hasGlint = true;
    tile.fogState = -1; // force fog restyle
    this.popAnims.push({ tile, t: 0 });
    // neighboring crack hints fade
    for (const [nq, nr] of neighborsOf(tile.q, tile.r)) {
      const n = this.world.tiles.get(keyOf(nq, nr));
      if (n?.crackSprite) { n.crackHint = false; n.crackSprite.material.opacity = 0; }
    }
  }

  // -------------------------------------------------------------- traders ---
  _buildTraders() {
    const tex = makeTraderTexture();
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

  traderOnTile(tile) { return this.traders.some(t => t.tile === tile); }

  // -------------------------------------------------------- roaming packs ---
  // Sprites for the RoamerSystem: hop animation when a pack steps, fog-aware
  // visibility, and a snap on respawn. Textures cached per biome+dread band.
  attachRoamers(sys) {
    this._roamerTex = {};
    this.roamerSprites = sys.roamers.map(r => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._roamerTexture(r), transparent: true }));
      const size = 1.0 + r.count * 0.18 + (r.tier >= 3 ? 0.15 : 0);
      sp.scale.set(size, size, 1);
      sp.center.set(0.5, 0.1);
      sp.renderOrder = 4;
      sp.position.set(r.tile.x, r.tile.topY + 0.04, r.tile.z);
      this.layer.add(sp);
      return { r, sprite: sp, hop: null };
    });
    sys.onMove = (r, from, to) => {
      const rs = this.roamerSprites.find(x => x.r === r);
      if (rs) rs.hop = { from, to, t: 0 };
    };
    sys.onRespawn = r => {
      const rs = this.roamerSprites.find(x => x.r === r);
      if (rs) {
        rs.hop = null;
        rs.sprite.position.set(r.tile.x, r.tile.topY + 0.04, r.tile.z);
      }
    };
    this.roamerSystem = sys;
  }

  _roamerTexture(r) {
    const dread = r.tier >= 3;
    const key = r.biome + (dread ? ':d' : '');
    if (!this._roamerTex[key]) {
      const base = '#' + new THREE.Color((BIOMES[r.biome] || BIOMES.MEADOW).color)
        .offsetHSL(0, 0.1, dread ? -0.16 : -0.08).getHexString();
      this._roamerTex[key] = makeEnemyTexture({
        base, eye: dread ? '#ff5a7a' : '#ffd24a', seed: hash2(r.r, r.q, 56),
        role: ['brute', 'swift', 'guard'][hash2(r.q, r.r, 55) * 3 | 0],
        accent: '#' + new THREE.Color((BIOMES[r.biome] || BIOMES.MEADOW).accent).getHexString(),
      });
    }
    return this._roamerTex[key];
  }

  roamerOnTile(tile) { return !!this.roamerSystem?.at(tile); }

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
    const bonus = run.flags?.visionPlus || 0;
    const V = CONFIG.visionRadius + bonus, RIM = CONFIG.rimRadius + bonus;
    let colorDirty = false, matrixDirty = false, glintDirty = false;

    for (const tile of this.tileByIdx) {
      if (tile.secret) continue;       // sealed secrets stay invisible
      if (tile.void) continue;
      const d = hexDist(tile.q, tile.r, center.q, center.r);
      const k = keyOf(tile.q, tile.r);
      if (d <= RIM) this.explored.add(k);
      const state = d <= V ? 3 : d <= RIM ? 2 : this.explored.has(k) ? 1 : 0;
      if (state === tile.fogState) continue;
      const prev = tile.fogState;
      tile.fogState = state;
      colorDirty = true;
      matrixDirty = true;
      glintDirty = true;

      tmpColor.copy(tile.baseColor);
      if (state === 2) tmpColor.multiplyScalar(0.62).lerp(FOG_TINT, 0.12);
      else if (state === 1) tmpColor.lerp(MEMORY_GREY, 0.5).multiplyScalar(0.45);
      else if (state === 0) tmpColor.lerp(DARK_BLUE, 0.94).multiplyScalar(0.85);
      this.tileMesh.setColorAt(tile.idx, tmpColor);

      const ringFactor = state === 3 ? 1 : state === 2 ? 0.45 : state === 1 ? 0.14 : 0;
      tmpColor.copy(tile.ringColor).multiplyScalar(ringFactor);
      this.ringMesh.setColorAt(tile.idx, tmpColor);

      const wantCap = state === 0 ? 1 : 0;
      if (wantCap === 0 && prev === 0 && animate) {
        this.revealAnims.push({ idx: tile.idx, t: 0 });
      } else {
        this._setCapScale(tile.idx, wantCap);
      }

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

      if (tile.crackSprite) {
        const sense = run.flags?.crackSense;
        tile.crackSprite.material.opacity =
          tile.crackHint && (state === 3 || (sense && state >= 1)) ? (sense ? 0.55 : 0.35) : 0;
      }
      this._applyGlint(tile);
    }

    if (colorDirty) {
      this.tileMesh.instanceColor.needsUpdate = true;
      this.ringMesh.instanceColor.needsUpdate = true;
    }
    if (matrixDirty) this.mistMesh.instanceMatrix.needsUpdate = true;
    if (glintDirty) this.glintMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------- per-frame ---
  update(dt, camera) {
    this.time += dt;
    const t = this.time;

    for (const ring of this.baseRings) ring.rotation.y += ring.userData.speed * dt;
    this.dust.rotation.y += dt * 0.008;
    this.sun.rotation.y += dt * 0.2;
    this.sunCore.rotation.x += dt * 0.35;
    this.sunCorona.material.opacity = 0.75 + Math.sin(t * 1.7) * 0.12;
    this.sun.position.y = 2.0 + Math.sin(t * 0.8) * 0.3;
    this.volLight.intensity = 40 + Math.sin(t * 2.4) * 12 + Math.sin(t * 7.1) * 5;
    this.mistMesh.material.opacity = 0.9 + Math.sin(t * 0.9) * 0.05;
    this.highlight.material.opacity = 0.65 + Math.sin(t * 5) * 0.25;
    this.glintMesh.material.emissiveIntensity = 1.3 + Math.sin(t * 3.2) * 0.7;
    this.layer.position.y = Math.sin(t * 0.5) * 0.06;

    // cosmic landmarks
    for (const s of this.celestialSpinners) s.obj.rotation.y += s.speed * dt;
    for (const p of this.planetBodies || []) {
      p.position.y = p.userData.baseY + Math.sin(t * 0.5 + p.userData.bobPhase) * 0.5;
    }
    for (const c of this.constellations) {
      c.lines.material.opacity = 0.3 + Math.sin(t * 0.8 + c.phase) * 0.15;
      c.holder.rotation.y += dt * 0.015;
      c.holder.position.y = 4.2 + Math.sin(t * 0.4 + c.phase) * 0.4;
    }
    if (this.comet) {
      const cm = this.comet;
      cm.angle += cm.speed * dt;
      cm.holder.position.set(
        Math.cos(cm.angle) * cm.radius,
        cm.y + Math.sin(cm.angle * 3) * 1.5,
        Math.sin(cm.angle) * cm.radius
      );
      for (let i = 0; i < this.cometTail.length; i++) {
        const back = cm.angle - (i + 1) * 0.022;
        this.cometTail[i].position.set(
          Math.cos(back) * cm.radius,
          cm.y + Math.sin(back * 3) * 1.5,
          Math.sin(back) * cm.radius
        );
      }
    }

    if (this.revealAnims.length) {
      for (const a of this.revealAnims) {
        a.t += dt / 0.55;
        this._setCapScale(a.idx, Math.max(0, 1 - a.t * a.t));
      }
      this.revealAnims = this.revealAnims.filter(a => a.t < 1);
      this.mistMesh.instanceMatrix.needsUpdate = true;
    }

    if (this.popAnims.length) {
      for (const a of this.popAnims) {
        a.t += dt / 0.5;
        const p = Math.min(1, a.t);
        const s = p < 0.7 ? p / 0.7 * 1.15 : 1.15 - (p - 0.7) / 0.3 * 0.15;
        this._setTileMatrix(a.tile, s);
      }
      this.popAnims = this.popAnims.filter(a => a.t < 1);
      this.tileMesh.instanceMatrix.needsUpdate = true;
      this.ringMesh.instanceMatrix.needsUpdate = true;
    }

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
            .filter(n => n && !n.void && !n.landmark && !n.gate
              && !['SEA', 'ROAD', 'BRIDGE'].includes(n.biome));
          if (opts.length) tr.hop = { from: tr.tile, to: opts[Math.floor(Math.random() * opts.length)], t: 0 };
          else tr.timer = 5;
        }
      }
      tr.sprite.visible = tr.tile.fogState >= 2;
    }

    for (const rs of this.roamerSprites || []) {
      const r = rs.r;
      if (rs.hop) {
        rs.hop.t += dt / 0.4;
        const p = Math.min(1, rs.hop.t);
        const e = p * p * (3 - 2 * p);
        const { from, to } = rs.hop;
        rs.sprite.position.set(
          from.x + (to.x - from.x) * e,
          from.topY + (to.topY - from.topY) * e + Math.sin(p * Math.PI) * 0.55 + 0.04,
          from.z + (to.z - from.z) * e
        );
        if (p >= 1) rs.hop = null;
      } else {
        rs.sprite.position.set(r.tile.x, r.tile.topY + 0.04 + Math.sin(t * 2.3 + r.id) * 0.05, r.tile.z);
      }
      const fogTile = rs.hop ? rs.hop.from : r.tile;
      rs.sprite.visible = !r.dead && fogTile.fogState >= 2;
    }
  }
}
