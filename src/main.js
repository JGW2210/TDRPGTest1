// Vaeldrift, the Shattered Meridian — bootstrap & interaction wiring.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, pick } from './rng.js';
import { findPath } from './hex.js';
import { generateWorld } from './worldgen.js';
import { WorldView } from './world3d.js';
import { PlayerToken } from './player.js';
import { CameraRig } from './cameraRig.js';
import { LocalView } from './localview.js';
import { ui } from './ui.js';
import { makeTrader, mysteryOutcome } from './names.js';

const WORLD_HINT = 'drag to pan · scroll to zoom · right-drag to orbit · click a hex to travel · click <b>your</b> hex to explore it';
const LOCAL_HINT = 'drag to orbit the diorama · click a site to visit it · <b>Esc</b> or ↩ to return';

// ------------------------------------------------------------------ setup ---

const world = generateWorld(CONFIG.seed);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.getElementById('app').appendChild(renderer.domElement);
const dom = renderer.domElement;

const worldScene = new THREE.Scene();
worldScene.background = new THREE.Color(0x05060f);
const worldCamera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 2500);

const worldView = new WorldView(world, worldScene);
const player = new PlayerToken(worldScene, world.start);
worldView.updateFog(world.start, { animate: false });

const worldRig = new CameraRig(worldCamera, dom, {
  focus: { x: world.start.x, z: world.start.z },
  dist: CONFIG.camera.startDist,
  minDist: CONFIG.camera.minDist,
  maxDist: CONFIG.camera.maxDist,
  minPitch: CONFIG.camera.minPitch,
  maxPitch: CONFIG.camera.maxPitch,
  pitch: CONFIG.camera.startPitch,
  bounds: worldView.worldRadius * 1.08,
});

const localCamera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
const localRig = new CameraRig(localCamera, dom, {
  dist: 14, minDist: 6, maxDist: 26,
  minPitch: 0.35, maxPitch: 1.25, pitch: 0.85,
  bounds: 3.5,
});
localRig.enabled = false;
const localView = new LocalView();

let mode = 'world';          // 'world' | 'transition' | 'local'
let activeScene = 'world';
let followPlayer = true;
let dive = null;
let shards = 10;
let exploreHintShown = false;

ui.init(world);
ui.setLocation(world.start, kingdomOf(world.start));
ui.setShards(shards);
ui.setHint(WORLD_HINT);

// ------------------------------------------------------------ interaction ---

const raycaster = new THREE.Raycaster();

function ndcFrom(cx, cy) {
  return new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
}

function pickWorld(cx, cy) {
  raycaster.setFromCamera(ndcFrom(cx, cy), worldCamera);
  const hits = raycaster.intersectObjects([worldView.tileMesh, ...worldView.hitboxes], false);
  if (!hits.length) return null;
  const h = hits[0];
  return h.object === worldView.tileMesh ? worldView.tileByIdx[h.instanceId] : h.object.userData.tile;
}

function pickLocal(cx, cy) {
  raycaster.setFromCamera(ndcFrom(cx, cy), localCamera);
  return localView.pick(raycaster);
}

function kingdomOf(tile) {
  return tile.kingdom ? world.kingdomById[tile.kingdom] : null;
}

dom.addEventListener('pointermove', e => {
  if (ui.modalOpen || mode === 'transition') return;
  if (mode === 'world') {
    if (worldRig.dragMode) { worldView.setHighlight(null); ui.tooltip(null); return; }
    const tile = pickWorld(e.clientX, e.clientY);
    if (!tile) {
      worldView.setHighlight(null); ui.tooltip(null);
      dom.style.cursor = 'default';
      return;
    }
    worldView.setHighlight(tile);
    dom.style.cursor = 'pointer';
    if (tile.fogState === 0) {
      ui.tooltip(`<div class="tt-name">Unmapped Reaches</div><div class="tt-biome">the shroud lies heavy here</div>`, e.clientX, e.clientY);
    } else {
      const k = kingdomOf(tile);
      const kHex = k ? '#' + k.color.toString(16).padStart(6, '0') : '#9aa3cf';
      const lm = tile.landmark;
      const memory = tile.fogState === 1 ? ' <span style="color:#59639e">(hazy memory)</span>' : '';
      const extra = tile === player.tile
        ? '<div class="tt-extra">✦ click to explore this hex</div>'
        : '<div class="tt-extra">click to travel here</div>';
      ui.tooltip(
        `<div class="tt-name">${tile.name}${memory}</div>` +
        `<div class="tt-biome">${lm ? lm.type + ' · ' : ''}${tile.biomeName ?? ''}${biomeName(tile)}</div>` +
        `<div class="tt-king" style="color:${kHex}">${k ? k.name : 'The Driftlands'}</div>` +
        (worldView.traderOnTile(tile) && tile.fogState >= 2 ? '<div class="tt-extra">a wandering trader rests here</div>' : '') +
        extra,
        e.clientX, e.clientY
      );
    }
  } else if (mode === 'local') {
    if (localRig.dragMode) { localView.setHighlight(null); return; }
    const data = pickLocal(e.clientX, e.clientY);
    localView.setHighlight(data);
    dom.style.cursor = data ? 'pointer' : 'default';
  }
});

function biomeName(tile) {
  const names = {
    MEADOW: 'Starlit Meadow', FOREST: 'Sighing Forest', MOUNTAIN: 'Cloudpiercers',
    VOLCANO: 'Ember Wastes', DESERT: 'Glass Dunes', TUNDRA: 'Pale Expanse',
    SEA: 'Astral Shallows', CRYSTAL: 'Prism Fields',
  };
  return names[tile.biome];
}

dom.addEventListener('pointerdown', e => {
  if (mode === 'world' && e.button === 0 && !e.shiftKey) followPlayer = false;
});

dom.addEventListener('click', e => {
  if (ui.modalOpen || mode === 'transition') return;
  if (mode === 'world') {
    if (worldRig.wasDrag) return;
    const tile = pickWorld(e.clientX, e.clientY);
    if (!tile) return;
    if (tile === player.tile && !player.isMoving) enterLocal(tile);
    else travelTo(tile);
  } else if (mode === 'local') {
    if (localRig.wasDrag) return;
    const data = pickLocal(e.clientX, e.clientY);
    if (data) openSite(data.site);
  }
});

function travelTo(target) {
  if (target.void) return;
  const from = player.hop ? player.hop.to : player.tile;
  if (from === target) return;
  const path = findPath(world.tiles, from, target);
  if (!path) { ui.toast('The rift denies passage — no road threads that stretch of void.'); return; }
  followPlayer = true;
  player.setPath(path,
    tile => { // each landing
      worldView.updateFog(tile);
      ui.setLocation(tile, kingdomOf(tile));
      if (followPlayer && !worldRig.dragMode) worldRig.panTo({ x: tile.x, z: tile.z });
    },
    tile => { // journey's end
      if (tile.landmark) ui.toast(`You arrive at <b>${tile.name}</b>.`);
      if (!exploreHintShown) {
        exploreHintShown = true;
        ui.toast('✦ Click the hex you stand on to explore it up close.', true);
      }
    });
}

// -------------------------------------------------------- local view flow ---

const delay = ms => new Promise(res => setTimeout(res, ms));

async function enterLocal(tile) {
  mode = 'transition';
  worldRig.enabled = false;
  worldView.setHighlight(null);
  ui.tooltip(null);
  dive = {
    t: 0, dur: 0.45,
    fromDist: worldRig.dist, toDist: Math.max(CONFIG.camera.minDist, 9),
    fromFocus: worldRig.focus.clone(), toFocus: new THREE.Vector3(tile.x, 0, tile.z),
  };
  ui.fade(true);
  await delay(460);
  dive = null;

  let sites = world.getSites(tile);
  if (worldView.traderOnTile(tile) && !sites.some(s => s.type === 'trader')) {
    const rng = mulberry32((world.seed + tile.q * 131 + tile.r * 197) >>> 0);
    const t = makeTrader(rng, 1, null);
    t.id = 'wander:' + tile.q + ',' + tile.r;
    sites = [t, ...sites];
  }
  localView.build(tile, world, sites);
  localRig.yaw = worldRig.yaw;
  localRig.pitch = 0.85;
  localRig.dist = 14.5;
  localRig.focus.set(0, 0, 0);
  localRig.velocity.set(0, 0, 0);
  localRig.enabled = true;
  activeScene = 'local';
  mode = 'local';
  ui.setExploring(tile.name);
  ui.setHint(LOCAL_HINT);
  ui.showReturn(true);
  ui.fade(false);
}

async function exitLocal() {
  if (mode !== 'local') return;
  if (ui.modalOpen) ui.closeModal();
  mode = 'transition';
  localRig.enabled = false;
  localView.setHighlight(null);
  ui.fade(true);
  await delay(460);
  localView.dispose();
  activeScene = 'world';
  worldRig.enabled = true;
  worldRig.dist = Math.max(16, worldRig.dist);
  mode = 'world';
  ui.setLocation(player.tile, kingdomOf(player.tile));
  ui.setHint(WORLD_HINT);
  ui.showReturn(false);
  ui.fade(false);
}

// ------------------------------------------------------------ site actions ---

const ACTION_LINES = {
  'Scout the Ground': 'You note the footing, the cover, and one suspiciously loose boulder. It will remember you too.',
  'Watch a Bout': 'Two duellists bow, clash, and settle a dispute over cheese tariffs. The crowd weeps openly.',
  'Browse Wares': 'The wares gleam. Your purse hums nervously and pretends to be empty.',
  'Gather Rumors': null, // handled specially
  'Rest': 'You rest. The stars rearrange themselves politely while you sleep.',
  'Seek an Audience': 'The court can see you at the third bell of next season. Bring a hat; the throne room has opinions.',
  'View the Relic': 'You lean close to the sun-glass. The relic taps back, twice. The curator faints on schedule.',
  'Explore': 'You wander the stones until the light changes. Something small and grateful follows you back to the path.',
  'Pay Respects': 'You bow. Far overhead, one star bows back — barely, but unmistakably.',
  'Search the Rubble': 'Beneath a cracked lintel you find a marble that shows the room behind you, three heartbeats late.',
  'Study the Warnings': 'The sixth language turns out to be a recipe. The apology, however, is sincere.',
  'Descend (soon™)': 'The stair breathes out cold air and patience. The deep places open in a later build.',
  'Take the Watch': null,
};

function handleAction(site, label, btn) {
  if (label.startsWith('⚔')) {
    ui.toast(`⚔ ${site.enemy || 'The foe'} bristles and waits — combat arrives with the next age of the world.`);
    return;
  }
  if (label === 'Haggle') {
    const win = Math.random() < 0.5;
    shards = Math.max(0, shards + (win ? 1 : -1));
    ui.setShards(shards);
    ui.toast(win
      ? 'You haggle masterfully and are up one star-shard. The trader applauds your rudeness. (+1 ☆)'
      : 'You haggle, lose the thread entirely, and somehow buy a receipt. (−1 ☆)');
    return;
  }
  if (label === 'Investigate') {
    const out = mysteryOutcome(mulberry32((Math.random() * 2 ** 31) | 0));
    shards = Math.max(0, shards + out.shards);
    ui.setShards(shards);
    ui.modalOutcome(out.text + (out.shards ? `  (${out.shards > 0 ? '+' : ''}${out.shards} ☆)` : ''));
    btn.disabled = true;
    return;
  }
  if (label === 'Gather Rumors') {
    const rumor = pick(mulberry32((Math.random() * 2 ** 31) | 0), [
      `They say ${pick(Math.random, world.dungeons).name} has started humming at night.`,
      `A caravaneer swears the Hollow Star blinked last week. Twice.`,
      `The Pale Tarot drew "The Door" three dawns running. Selenost is nervous.`,
      `Word is a wandering trader pays double for anything that glows and apologizes.`,
      `The Umbral Choir is recruiting basses. No one asks what happened to the old ones.`,
    ]);
    ui.toast('🗣 ' + rumor);
    return;
  }
  const line = ACTION_LINES[label];
  ui.toast(line || 'A story for another day — and another build.');
}

function openSite(site) {
  localRig.enabled = false;
  ui.openModal(site, {
    onAction: (label, btn) => handleAction(site, label, btn),
    onClose: () => { localRig.enabled = (mode === 'local'); },
  });
}

// ----------------------------------------------------------------- buttons ---

document.getElementById('btn-recenter').addEventListener('click', () => {
  if (mode !== 'world') return;
  followPlayer = true;
  worldRig.panTo({ x: player.group.position.x, z: player.group.position.z });
});
document.getElementById('btn-seed').addEventListener('click', () => {
  location.href = '?seed=' + Math.floor(Math.random() * 1e6);
});
document.getElementById('btn-return').addEventListener('click', exitLocal);

window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (ui.modalOpen) ui.closeModal();
    else if (mode === 'local') exitLocal();
  }
});

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [worldCamera, localCamera]) {
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
  }
});

// -------------------------------------------------------------------- loop ---

// tiny handle for automated smoke tests
window.__vael = {
  get mode() { return mode; },
  get playerTile() { return player.tile; },
  get isMoving() { return player.isMoving; },
  pickAt: (x, y) => { const t = pickWorld(x, y); return t ? { q: t.q, r: t.r, name: t.name } : null; },
  travel: (q, r) => { const t = world.tiles.get(q + ',' + r); if (t && !t.void) travelTo(t); },
  world,
};

const clock = new THREE.Clock();
let firstFrame = true;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());

  if (dive) {
    dive.t += dt;
    const k = Math.min(1, dive.t / dive.dur);
    const e = k * k * (3 - 2 * k);
    worldRig.dist = dive.fromDist + (dive.toDist - dive.fromDist) * e;
    worldRig.focus.lerpVectors(dive.fromFocus, dive.toFocus, e);
    worldRig.apply();
  }

  if (activeScene === 'world') {
    worldRig.update(dt);
    worldView.update(dt, worldCamera);
    player.layerY = worldView.layer.position.y;
    player.update(dt, worldCamera, worldRig.focus);
    renderer.render(worldScene, worldCamera);
  } else {
    localRig.update(dt);
    localView.update(dt, localCamera);
    if (localView.scene) renderer.render(localView.scene, localCamera);
  }

  if (firstFrame) {
    firstFrame = false;
    ui.loadingDone();
    ui.toast(`You wake in <b>${world.start.name}</b>, beneath the Hollow Star.`, true);
  }
}
loop();
