// Vaeldrift, run two — bootstrap & interaction wiring: world map, gated
// travel, local dioramas, diorama battles, blind item draws, secrets, death.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, hash2, pick } from './rng.js';
import { findPath, keyOf, neighborsOf, hexDist } from './hex.js';
import { generateWorld } from './worldgen.js';
import { WorldView, TIER_COLORS } from './world3d.js';
import { PlayerToken } from './player.js';
import { CameraRig } from './cameraRig.js';
import { LocalView } from './localview.js';
import { BattleSystem } from './battle.js';
import { ui } from './ui.js';
import { makeTrader, mysteryOutcome, BIOMES, FOES } from './names.js';
import { drawItem, CONSUMABLES } from './items.js';
import { run } from './run.js';
import { saveRun, loadRun, clearSave, applySave } from './save.js';
import { audio } from './audio.js';
import { meta } from './meta.js';

const WORLD_HINT = 'drag to pan · scroll to zoom · click a hex to travel · click <b>your</b> hex to explore it · <b>I</b> inventory';
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
const worldCamera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 3000);

const worldView = new WorldView(world, worldScene);
const player = new PlayerToken(worldScene, world.start);
worldView.updateFog(world.start, { animate: false });
run.hexesVisited.add(keyOf(world.start.q, world.start.r));

const worldRig = new CameraRig(worldCamera, dom, {
  focus: { x: world.start.x, z: world.start.z },
  dist: CONFIG.camera.startDist,
  minDist: CONFIG.camera.minDist,
  maxDist: CONFIG.camera.maxDist,
  minPitch: CONFIG.camera.minPitch,
  maxPitch: CONFIG.camera.maxPitch,
  pitch: CONFIG.camera.startPitch,
  bounds: worldView.worldRadius * 1.4,
});

const localCamera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
const localRig = new CameraRig(localCamera, dom, {
  dist: 14, minDist: 6, maxDist: 26,
  minPitch: 0.35, maxPitch: 1.25, pitch: 0.85,
  bounds: 3.5,
});
localRig.enabled = false;
const localView = new LocalView();
const battle = new BattleSystem(renderer);

let mode = 'world';          // 'world' | 'transition' | 'local' | 'battle' | 'dead'
let activeScene = 'world';   // 'world' | 'local' | 'battle'
let followPlayer = true;
let dive = null;
let currentLocalTile = null;
let battleReturn = null;     // { scene: 'world'|'local', tile }
let exploreHintShown = false;
let restoredRun = false;

// ---- resume a saved run for this seed, if one survives -----------------
{
  const saved = loadRun(world);
  if (saved) {
    const tile = applySave(saved, world, worldView);
    player.tile = tile;
    player.group.position.set(tile.x, tile.topY, tile.z);
    worldRig.panTo({ x: tile.x, z: tile.z }, { instant: true });
    worldView.updateFog(tile, { animate: false });
    for (const sid of run.clearedSites) {
      const t = world.tiles.get(sid.split(':')[0]);
      if (t) checkGlint(t);
    }
    restoredRun = true;
    exploreHintShown = true;
  }
}

let lastSave = 0;
function saveNow(force = false) {
  const now = performance.now();
  if (!force && now - lastSave < 1200) return;
  lastSave = now;
  saveRun(world, player, worldView);
}

ui.init(world);
refreshHud(player.tile);
ui.setHint(WORLD_HINT);

function refreshHud(tile) {
  ui.setLocation(tile, kingdomOf(tile));
  const reg = world.regionOf(tile);
  ui.setRegion(reg);
  ui.setShards(run.shards);
  ui.setStats(run);
  audio.setRegionMusic({
    biome: reg.dominantBiome, tier: reg.tier, id: reg.id, seed: world.seed,
    town: tile.landmark?.type === 'town' || tile.landmark?.type === 'capital',
  });
  announceFeats(meta.bump(s => {
    s.maxItems = Math.max(s.maxItems, run.items.length);
    s.maxShards = Math.max(s.maxShards, run.shards);
  }));
}

function announceFeats(news) {
  for (const { feat, unlockedItems } of news) {
    audio.sfxFeat();
    ui.toast(`✴ ECHO INSCRIBED — <b>${feat.name}</b>: ${unlockedItems.length} new relics join the pools, forever.`, true);
  }
}

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
  const tile = h.object === worldView.tileMesh ? worldView.tileByIdx[h.instanceId] : h.object.userData.tile;
  return tile && !tile.void && !tile.secret ? tile : null;
}

function pickLocal(cx, cy) {
  raycaster.setFromCamera(ndcFrom(cx, cy), localCamera);
  return localView.pick(raycaster);
}

function kingdomOf(tile) {
  return tile.kingdom ? world.kingdomById[tile.kingdom] : null;
}

const gateLocked = t => t.gate && !run.openedGates.has(keyOf(t.q, t.r));

function biomeName(tile) { return (BIOMES[tile.biome] || {}).name || '—'; }

function expectedPower(tier) { return 10 + tier * 13; }

dom.addEventListener('pointermove', e => {
  if (ui.modalOpen || mode === 'transition' || mode === 'battle') return;
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
    } else if (gateLocked(tile)) {
      const g = tile.gate;
      const c = '#' + new THREE.Color(TIER_COLORS[Math.min(g.tier, TIER_COLORS.length - 1)]).getHexString();
      const ready = run.power >= expectedPower(g.tier);
      ui.tooltip(
        `<div class="tt-name">${tile.landmark.name.split(',')[0]}</div>` +
        `<div class="tt-biome">warded causeway into ${world.regions[g.into].name}</div>` +
        `<div class="tt-king" style="color:${c}">${'☠'.repeat(Math.min(5, g.tier))} tier ${g.tier} warden</div>` +
        `<div class="tt-extra">${ready ? 'your power feels equal to this' : 'this ward is beyond your current strength…'} (you: ${run.power} · foe: ~${expectedPower(g.tier)})</div>`,
        e.clientX, e.clientY
      );
    } else {
      const k = kingdomOf(tile);
      const kHex = k ? '#' + k.color.toString(16).padStart(6, '0') : '#9aa3cf';
      const lm = tile.landmark;
      const reg = world.regionOf(tile);
      const memory = tile.fogState === 1 ? ' <span style="color:#59639e">(hazy memory)</span>' : '';
      const extra = tile === player.tile
        ? '<div class="tt-extra">✦ click to explore this hex</div>'
        : '<div class="tt-extra">click to travel here</div>';
      ui.tooltip(
        `<div class="tt-name">${tile.name}${memory}</div>` +
        `<div class="tt-biome">${lm ? lm.type + ' · ' : ''}${biomeName(tile)} · ${reg.name}</div>` +
        `<div class="tt-king" style="color:${kHex}">${k ? k.name : 'The Driftlands'}</div>` +
        (worldView.traderOnTile(tile) && tile.fogState >= 2 ? '<div class="tt-extra">a wandering trader rests here</div>' : '') +
        (tile.hasGlint && tile.fogState >= 2 ? '<div class="tt-extra">✦ something glimmers here</div>' : '') +
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

dom.addEventListener('pointerdown', e => {
  if (mode === 'world' && e.button === 0 && !e.shiftKey) followPlayer = false;
});

dom.addEventListener('click', e => {
  if (ui.modalOpen || mode === 'transition' || mode === 'battle') return;
  if (mode === 'world') {
    if (worldRig.wasDrag) return;
    const tile = pickWorld(e.clientX, e.clientY);
    if (!tile) return;
    if (tile === player.tile && !player.isMoving) {
      enterLocal(tile);
    } else if (gateLocked(tile)) {
      approachGate(tile);
    } else {
      travelTo(tile);
    }
  } else if (mode === 'local') {
    if (localRig.wasDrag) return;
    const data = pickLocal(e.clientX, e.clientY);
    if (data) openSite(data.site);
  }
});

// ---------------------------------------------------------------- travel ---

function travelTo(target, onArrive = null) {
  if (target.void) return;
  const from = player.hop ? player.hop.to : player.tile;
  if (from === target) { if (onArrive) onArrive(); return; }
  const path = findPath(world.tiles, from, target, gateLocked);
  if (!path) {
    ui.toast(world.gates.some(g => gateLocked(g))
      ? 'No open road leads there — a warden bars the way.'
      : 'The rift denies passage — no road threads that stretch of void.');
    return;
  }
  followPlayer = true;
  const fast = run.flags.fastTravel || path.length > CONFIG.fastPathLen;
  player.hopTime = fast ? CONFIG.hopDurationFast : CONFIG.hopDuration;
  player.setPath(path,
    tile => {
      run.hexesVisited.add(keyOf(tile.q, tile.r));
      audio.sfxHop();
      worldView.updateFog(tile);
      if (run.flags.revealRegion) revealRegionMemory(tile);
      announceFeats(meta.bump(s => {
        s.hexes++;
        if (tile.region >= 100) {
          const satId = world.satellites[tile.region - 100]?.def.id;
          if (satId && !s.visitedSats.includes(satId)) s.visitedSats.push(satId);
        }
      }));
      refreshHud(tile);
      if (followPlayer && !worldRig.dragMode) worldRig.panTo({ x: tile.x, z: tile.z });
    },
    tile => {
      if (tile.landmark && tile.landmark.type !== 'gate') ui.toast(`You arrive at <b>${tile.name}</b>.`);
      if (!exploreHintShown) {
        exploreHintShown = true;
        ui.toast('✦ Click the hex you stand on to explore it up close.', true);
      }
      saveNow(true);
      if (onArrive) onArrive();
    });
}

const revealedRegions = new Set();
function revealRegionMemory(tile) {
  const reg = world.regionOf(tile);
  if (reg.id >= 100 || revealedRegions.has(reg.id)) return;
  revealedRegions.add(reg.id);
  for (const t of reg.tiles || []) worldView.explored.add(keyOf(t.q, t.r));
  worldView.updateFog(tile, { animate: false });
  ui.toast(`The Meridian Compass charts ${reg.name} into memory.`, true);
}

// ----------------------------------------------------------------- gates ---

function approachGate(gateTile) {
  const adj = neighborsOf(gateTile.q, gateTile.r)
    .map(([q, r]) => world.tiles.get(keyOf(q, r)))
    .filter(t => t && !t.void && !gateLocked(t))
    .sort((a, b) => hexDist(a.q, a.r, player.tile.q, player.tile.r) - hexDist(b.q, b.r, player.tile.q, player.tile.r));
  if (!adj.length) { ui.toast('No path reaches the gate’s threshold.'); return; }
  const here = adj.find(t => t === player.tile);
  if (here) { challengeGate(gateTile); return; }
  travelTo(adj[0], () => challengeGate(gateTile));
}

function challengeGate(gateTile) {
  const g = gateTile.gate;
  const ready = run.power >= expectedPower(g.tier);
  ui.openModal({
    type: 'battle', subtype: 'warden',
    name: gateTile.landmark.name,
    flavor: `The causeway into ${world.regions[g.into].name} is sealed behind folded starlight. The Warden unfolds to meet you — ${'☠'.repeat(Math.min(5, g.tier))} tier ${g.tier}. ` +
      (ready ? 'Your power feels equal to this.' : 'Your power does not yet feel equal to this. It will let you try anyway.'),
    actions: ['⚔ Challenge the Warden', 'Withdraw'],
  }, {
    onAction: label => {
      if (label.startsWith('⚔')) {
        ui.closeModal();
        startBattle({
          team: { biome: g.biome, tier: g.tier, count: 1, boss: true, bossName: gateTile.landmark.name },
          title: gateTile.landmark.name,
          onWin: () => {
            run.openedGates.add(keyOf(gateTile.q, gateTile.r));
            worldView.openGate(gateTile);
            audio.sfxGate();
            ui.toast(`⚑ The ward shatters — ${world.regions[g.into].name} lies open.`, true);
            announceFeats(meta.bump(s => { s.wardens++; if (g.tier >= 3) s.deepWarden = true; }));
            const bossDraw = drawItem(
              mulberry32(hash2(gateTile.q, gateTile.r, world.seed + 777) * 0xffffffff | 0),
              'BOSS', run.ownedIds, { source: 'boss', tier: g.tier, unlocked: meta.unlockedIds });
            if (bossDraw) grantItem(bossDraw);
          },
        });
      } else ui.closeModal();
    },
    onClose: () => {},
  });
}

// -------------------------------------------------------- local view flow ---

const delay = ms => new Promise(res => setTimeout(res, ms));

function sitesFor(tile) {
  let sites = world.getSites(tile);
  if (worldView.traderOnTile(tile) && !sites.some(s => s.type === 'trader')) {
    const rng = mulberry32((world.seed + tile.q * 131 + tile.r * 197) >>> 0);
    const t = makeTrader(rng, 1, null);
    t.id = 'wander:' + tile.q + ',' + tile.r;
    sites = [t, ...sites];
  }
  for (const s of sites) s.cleared = run.clearedSites.has(s.id);
  return sites;
}

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

  const sites = sitesFor(tile);
  localView.build(tile, world, sites);
  localRig.yaw = worldRig.yaw;
  localRig.pitch = 0.85;
  localRig.dist = 14.5;
  localRig.focus.set(0, 0, 0);
  localRig.velocity.set(0, 0, 0);
  localRig.enabled = true;
  activeScene = 'local';
  mode = 'local';
  currentLocalTile = tile;
  ui.setExploring(tile.name + (sites.length ? '' : ' — nothing stirs here'));
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
  currentLocalTile = null;
  refreshHud(player.tile);
  ui.setHint(WORLD_HINT);
  ui.showReturn(false);
  ui.fade(false);
}

// ---------------------------------------------------------------- battles ---

async function startBattle({ team, title, onWin, siteId, waves = null }) {
  const from = mode; // 'world' or 'local'
  battleReturn = { scene: from === 'local' ? 'local' : 'world', tile: currentLocalTile };
  mode = 'transition';
  worldRig.enabled = false;
  localRig.enabled = false;
  worldView.setHighlight(null);
  ui.tooltip(null);
  if (ui.modalOpen) ui.closeModal();
  ui.fade(true);
  await delay(460);

  const queue = waves ? waves.slice(1) : [];
  const first = waves ? waves[0] : { team, title };

  const handleEnd = async result => {
    mode = 'transition';
    ui.fade(true);
    await delay(200);
    if (result.lost) {
      clearSave(world.seed);
      meta.bump(s => { s.deaths++; s.runs++; });
      activeScene = 'world';
      mode = 'dead';
      worldRig.enabled = false;
      localRig.enabled = false;
      ui.fade(false);
      ui.showDeath(run, world, meta);
      return;
    }
    if (result.won && queue.length) {
      // gauntlet continues: a breath, then the next chamber
      const nxt = queue.shift();
      run.hp = Math.min(run.stats.maxHP, run.hp + 4);
      ui.toast(`A breath between chambers (+4 ❤) — deeper now.`, true);
      activeScene = 'battle';
      mode = 'battle';
      battle.start({ team: nxt.team, title: nxt.title, onEnd: handleEnd });
      ui.fade(false);
      return;
    }
    if (result.won) {
      announceFeats(meta.bump(s => { s.battles++; }));
      if (siteId) {
        run.clearedSites.add(siteId);
        checkGlint(battleReturn.tile);
      }
      if (onWin) onWin();
    }
    // return to where we came from (a flee mid-gauntlet also lands here)
    if (battleReturn.scene === 'local' && battleReturn.tile) {
      const tile = battleReturn.tile;
      localView.build(tile, world, sitesFor(tile));
      localRig.enabled = true;
      activeScene = 'local';
      mode = 'local';
      ui.setExploring(tile.name);
      ui.setHint(LOCAL_HINT);
      ui.showReturn(true);
    } else {
      activeScene = 'world';
      worldRig.enabled = true;
      mode = 'world';
      ui.setHint(WORLD_HINT);
      ui.showReturn(false);
    }
    refreshHud(player.tile);
    saveNow(true);
    ui.fade(false);
  };

  activeScene = 'battle';
  mode = 'battle';
  ui.setHint('click or press <b>space</b> when the marker crosses the gold band');
  battle.start({ team: first.team, title: first.title, onEnd: handleEnd });
  ui.fade(false);
}

// A dungeon descent: three chambers, then the Keeper hoarding its gift.
function startGauntlet(site, tile) {
  const biome = FOES[tile.biome] ? tile.biome : 'MEADOW';
  const tier = world.regionOf(tile).tier;
  const keeper = `Keeper of ${site.name.replace('Gate of ', '')}`;
  startBattle({
    siteId: site.id,
    onWin: () => {
      const got = run.gainShards(18 + tier * 8);
      ui.toast(`⚑ The vault is broken open — ☆ ${got} and the Keeper's gift are yours.`, true);
      announceFeats(meta.bump(s => { s.keepers++; }));
      const rng = mulberry32(Math.floor(hash2(tile.q, tile.r, world.seed + 1234) * 0xffffffff));
      const item = drawItem(rng, tile.biome, run.ownedIds, { source: 'boss', tier, unlocked: meta.unlockedIds });
      if (item) grantItem(item);
    },
    waves: [
      { team: { biome, tier, count: 2 }, title: `${site.name} · First Chamber` },
      { team: { biome, tier: tier + 1, count: 2 }, title: `${site.name} · Second Chamber` },
      { team: { biome, tier: tier + 1, count: 1, boss: true, bossName: keeper }, title: keeper },
    ],
  });
}

function checkGlint(tile) {
  if (!tile) return;
  const sites = world.getSites(tile);
  const meaningful = sites.filter(s => s.type === 'battle' || s.type === 'pedestal' || s.subtype === 'cache' || s.subtype === 'mystery');
  if (meaningful.every(s => run.clearedSites.has(s.id))) worldView.setGlint(tile, false);
}

// ------------------------------------------------------------ site actions ---

function grantItem(item) {
  const before = new Set(run.synergies.map(s => s.id));
  run.addItem(item);
  const fresh = run.synergies.filter(s => !before.has(s.id));
  audio.sfxPickup(item.rarity);
  if (fresh.length) {
    announceFeats(meta.bump(s => {
      for (const sy of fresh) if (!s.synergies.includes(sy.id)) s.synergies.push(sy.id);
    }));
  }
  ui.showItemCard(item, fresh, () => { refreshHud(player.tile); saveNow(true); });
}

function buildOffers(site, tile) {
  const rng = mulberry32(Math.floor(hash2(tile.q, tile.r, world.seed + 553) * 0xffffffff));
  const tier = world.regionOf(tile).tier;
  const markup = 1 + (run.flags.shopMarkup || 0);
  const offers = [
    { kind: 'consumable', id: 'charge', price: Math.round(6 * markup) },
    { kind: 'consumable', id: 'dew', price: Math.round(5 * markup) },
  ];
  if (rng() < 0.6) offers.push({ kind: 'consumable', id: 'feather', price: Math.round(8 * markup) });
  const pool = ['MEADOW', 'FOREST', 'MOUNTAIN', 'VOLCANO', 'DESERT', 'TUNDRA', 'SEA', 'CRYSTAL'][Math.floor(rng() * 8)];
  const item = drawItem(rng, pool, run.ownedIds, { source: 'shop', tier, unlocked: meta.unlockedIds });
  if (item && site.subtype !== 'wandering') {
    const base = { c: 14, u: 22, r: 34, a: 50 }[item.rarity] || 22;
    offers.push({ kind: 'item', item, price: Math.round((base + tier * 7) * markup) });
  }
  return offers;
}

function renderShop(site) {
  const extra = document.getElementById('modal-extra');
  extra.innerHTML = '';
  for (const offer of site.offers) {
    const sold = offer.sold;
    const row = document.createElement('div');
    row.className = 'ware';
    const label = offer.kind === 'item'
      ? `<b>${offer.item.name}</b> <span style="color:var(--ink-dim);font-size:12px">${offer.item.desc}</span>`
      : `${CONSUMABLES[offer.id].icon} ${CONSUMABLES[offer.id].name} <span style="color:var(--ink-dim);font-size:12px">${CONSUMABLES[offer.id].desc}</span>`;
    row.innerHTML = `<span>${label}</span><span class="price">${sold ? 'sold' : '☆ ' + offer.price}</span>`;
    if (!sold) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        if (!run.spendShards(offer.price)) { ui.toast('Not enough star-shards. The trader’s sympathy is complimentary.'); return; }
        offer.sold = offer.kind === 'item';
        if (offer.kind === 'item') grantItem(offer.item);
        else { run.consumables[offer.id]++; ui.toast(`${CONSUMABLES[offer.id].icon} ${CONSUMABLES[offer.id].name} acquired.`); }
        refreshHud(player.tile);
        saveNow(true);
        renderShop(site);
      });
    }
    extra.appendChild(row);
  }
}

const ACTION_LINES = {
  'Scout the Ground': 'You note the footing, the cover, and one suspiciously loose boulder. It will remember you too.',
  'Watch a Bout': 'Two duellists bow, clash, and settle a dispute over cheese tariffs. The crowd weeps openly.',
  'Rest': 'You rest. The stars rearrange themselves politely while you sleep.',
  'Seek an Audience': 'The court can see you at the third bell of next season. Bring a hat; the throne room has opinions.',
  'Explore': 'You wander the stones until the light changes. Something small and grateful follows you back to the path.',
  'Pay Respects': 'You bow. Far overhead, one star bows back — barely, but unmistakably.',
  'Search the Rubble': 'Beneath a cracked lintel you find a marble that shows the room behind you, three heartbeats late.',
  'Study the Warnings': 'The sixth language turns out to be a recipe. The apology, however, is sincere.',
  'Descend (soon™)': 'The stair breathes out cold air and patience. The deep places open in a later build.',
};

function handleAction(site, label, btn) {
  if (site.cleared && (site.type === 'battle' || site.type === 'pedestal' || site.subtype === 'cache' || site.subtype === 'mystery')) {
    ui.toast('That matter is already settled.');
    return;
  }
  if (label.startsWith('⚔') && site.gauntlet) {
    startGauntlet(site, currentLocalTile || player.tile);
    return;
  }
  if (label.startsWith('⚔') && site.team) {
    startBattle({
      team: site.team, title: site.name, siteId: site.id,
      onWin: site.team.boss && site.team.satellite ? () => {
        ui.toast('☄ The satellite’s heart is yours to claim.', true);
        announceFeats(meta.bump(s => {
          if (!s.sats.includes(site.team.satellite)) s.sats.push(site.team.satellite);
        }));
      } : null,
    });
    return;
  }
  if (label === 'Claim the Gift') {
    const rng = mulberry32(Math.floor(hash2(site.id.length * 31 + site.id.charCodeAt(0), site.id.charCodeAt(site.id.length - 3) || 7, world.seed + 999) * 0xffffffff));
    const tileHere = currentLocalTile || player.tile;
    const source = site.pool === 'ASTRAL' ? 'astral'
      : site.pool === 'BOSS' ? 'boss'
      : tileHere.secretRevealed ? 'secret' : 'pedestal';
    const item = drawItem(rng, site.pool, run.ownedIds,
      { source, tier: world.regionOf(tileHere).tier, unlocked: meta.unlockedIds });
    run.clearedSites.add(site.id);
    ui.closeModal();
    if (item) grantItem(item);
    else { const got = run.gainShards(20); ui.toast(`The pedestal stands empty of gifts — but ${got} ☆ pool in the hollow.`, true); }
    if (currentLocalTile) {
      localView.build(currentLocalTile, world, sitesFor(currentLocalTile));
      checkGlint(currentLocalTile);
    }
    refreshHud(player.tile);
    return;
  }
  if (label === 'Open the Cache') {
    run.clearedSites.add(site.id);
    if (site.cacheShards) {
      const got = run.gainShards(site.cacheShards);
      ui.toast(`☆ ${got} star-shards, freed from the dark.`, true);
    }
    if (site.cacheConsumables) {
      for (const [k, v] of Object.entries(site.cacheConsumables)) run.consumables[k] += v;
      ui.toast('✸ The keg holds star-charges and one very nervous dew bottle.', true);
    }
    saveNow(true);
    ui.closeModal();
    if (currentLocalTile) {
      localView.build(currentLocalTile, world, sitesFor(currentLocalTile));
      checkGlint(currentLocalTile);
    }
    refreshHud(player.tile);
    return;
  }
  if (label === 'Haggle') {
    const win = Math.random() < 0.5;
    run.shards = Math.max(0, run.shards + (win ? 1 : -1));
    refreshHud(player.tile);
    ui.toast(win
      ? 'You haggle masterfully and are up one star-shard. The trader applauds your rudeness. (+1 ☆)'
      : 'You haggle, lose the thread entirely, and somehow buy a receipt. (−1 ☆)');
    return;
  }
  if (label === 'Investigate') {
    const out = mysteryOutcome(mulberry32((Math.random() * 2 ** 31) | 0));
    run.shards = Math.max(0, run.shards + out.shards);
    run.clearedSites.add(site.id);
    refreshHud(player.tile);
    saveNow(true);
    ui.modalOutcome(out.text + (out.shards ? `  (${out.shards > 0 ? '+' : ''}${out.shards} ☆)` : ''));
    btn.disabled = true;
    if (currentLocalTile) checkGlint(currentLocalTile);
    return;
  }
  if (label === 'Gather Rumors') {
    const rumor = pick(mulberry32((Math.random() * 2 ** 31) | 0), [
      `They say ${pick(Math.random, world.dungeons.length ? world.dungeons : [{ name: 'a far vault' }]).name} has started humming at night.`,
      `A caravaneer swears one of the wardens naps at its post. Nobody will say which tier.`,
      `Sealed hollows hide in the rifts — walk the cracked hexes and let a star-charge speak.`,
      `Beyond the shallows, star-bridges reach the wandering worlds. The bosses there hoard astral relics.`,
      `The Umbral Choir is recruiting basses. No one asks what happened to the old ones.`,
    ]);
    ui.toast('🗣 ' + rumor);
    return;
  }
  if (label === 'Browse Wares') {
    site.offers ??= buildOffers(site, currentLocalTile || player.tile);
    renderShop(site);
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
  if (site.type === 'trader') {
    site.offers ??= buildOffers(site, currentLocalTile || player.tile);
    renderShop(site);
  }
}

// ------------------------------------------------------------- detonation ---

function detonate() {
  if (mode !== 'world' || player.isMoving) { ui.toast('Steady ground is required for demolition.'); return; }
  if (run.consumables.charge <= 0) { ui.toast('No star-charges left. Traders sell them, and foes sometimes drop them.'); return; }
  run.consumables.charge--;
  refreshHud(player.tile);
  const secret = neighborsOf(player.tile.q, player.tile.r)
    .map(([q, r]) => world.tiles.get(keyOf(q, r)))
    .find(t => t && t.secret);
  player.burstNow?.();
  audio.sfxDetonate();
  if (secret) {
    world.revealSecret(secret);
    worldView.revealSecretTile(secret);
    worldView.updateFog(player.tile, { animate: false });
    run.revealedSecrets.add(keyOf(secret.q, secret.r));
    audio.sfxReveal();
    announceFeats(meta.bump(s => { s.secrets++; }));
    ui.toast('✸ The blast peels the void back — a sealed hex stands revealed!', true);
  } else {
    ui.toast('✸ The blast echoes over nothing. The charge is spent; the void is unimpressed.');
  }
  saveNow(true);
}

// ----------------------------------------------------------------- buttons ---

ui.inventoryHandlers = {
  useDew: () => {
    if (run.consumables.dew <= 0 || run.hp >= run.stats.maxHP) return;
    run.consumables.dew--;
    run.hp = Math.min(run.stats.maxHP, run.hp + 15);
    ui.toast('❋ The star-dew glows going down. +15 HP.');
    refreshHud(player.tile);
    ui.renderInventory(run);
    saveNow(true);
  },
  useFeather: () => {
    if (run.consumables.feather <= 0) return;
    if (mode !== 'world' || player.isMoving) {
      ui.toast('The feather needs open sky — return to the world map and stand still.');
      return;
    }
    run.consumables.feather--;
    player.tile = world.start;
    player.path = [];
    player.hop = null;
    player.group.position.set(world.start.x, world.start.topY, world.start.z);
    worldView.updateFog(world.start, { animate: false });
    followPlayer = true;
    worldRig.panTo({ x: world.start.x, z: world.start.z });
    refreshHud(world.start);
    ui.renderInventory(run);
    ui.toast('➳ The feather remembers the way — you drift home to Starfall Vale.', true);
    saveNow(true);
  },
};

// the music of the spheres begins on the first human touch (autoplay policy)
const bootAudio = () => {
  audio.init();
  const reg = world.regionOf(player.tile);
  audio.setRegionMusic({
    biome: reg.dominantBiome, tier: reg.tier, id: reg.id, seed: world.seed,
    town: player.tile.landmark?.type === 'town' || player.tile.landmark?.type === 'capital',
  });
  updateAudioButton();
};
window.addEventListener('pointerdown', bootAudio, { once: true });
window.addEventListener('keydown', bootAudio, { once: true });

function updateAudioButton() {
  document.getElementById('btn-audio').textContent = audio.enabled ? '♪' : '♪̸';
  document.getElementById('btn-audio').style.opacity = audio.enabled ? 1 : 0.45;
}
updateAudioButton();
document.getElementById('btn-audio').addEventListener('click', () => {
  audio.setEnabled(!audio.enabled);
  updateAudioButton();
});

document.getElementById('btn-echoes').addEventListener('click', () => ui.toggleEchoes(meta));
document.getElementById('echo-close').addEventListener('click', () => ui.toggleEchoes(meta, false));

document.getElementById('btn-recenter').addEventListener('click', () => {
  if (mode !== 'world') return;
  followPlayer = true;
  worldRig.panTo({ x: player.group.position.x, z: player.group.position.z });
});
document.getElementById('btn-return').addEventListener('click', exitLocal);
document.getElementById('btn-detonate').addEventListener('click', detonate);
document.getElementById('btn-inventory').addEventListener('click', () => ui.toggleInventory(run));
document.getElementById('inv-close').addEventListener('click', () => ui.toggleInventory(run, false));
document.getElementById('btn-newrun').addEventListener('click', () => {
  location.href = '?seed=' + Math.floor(Math.random() * 1e6);
});

window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (ui.modalOpen) ui.closeModal();
    else if (!document.getElementById('inventory').classList.contains('hidden')) ui.toggleInventory(run, false);
    else if (!document.getElementById('echoes').classList.contains('hidden')) ui.toggleEchoes(meta, false);
    else if (mode === 'local') exitLocal();
  }
  if (e.code === 'KeyI' && mode !== 'battle') ui.toggleInventory(run);
});

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [worldCamera, localCamera, battle.camera]) {
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
  }
});

// -------------------------------------------------------------------- loop ---

window.__vael = {
  get mode() { return mode; },
  get playerTile() { return player.tile; },
  get isMoving() { return player.isMoving; },
  run, world, battle, view: worldView, meta, audio, announceFeats,
  pickAt: (x, y) => { const t = pickWorld(x, y); return t ? { q: t.q, r: t.r, name: t.name } : null; },
  travel: (q, r) => { const t = world.tiles.get(q + ',' + r); if (t && !t.void) travelTo(t); },
  warp: (q, r) => {
    const t = world.tiles.get(q + ',' + r);
    if (!t || t.void || mode !== 'world') return false;
    player.path = []; player.hop = null;
    player.tile = t;
    player.group.position.set(t.x, t.topY, t.z);
    run.hexesVisited.add(q + ',' + r);
    worldView.updateFog(t, { animate: false });
    worldRig.panTo({ x: t.x, z: t.z }, { instant: true });
    refreshHud(t);
    saveNow(true);
    return true;
  },
  testBattle: (tier = 1, biome = 'MEADOW', boss = false) =>
    startBattle({ team: { biome, tier, count: 2, boss }, title: 'Test Battle' }),
  openGateAt: (q, r) => { const t = world.tiles.get(q + ',' + r); if (t?.gate) challengeGate(t); },
  detonate,
  lookAt: (x, z, dist) => { worldRig.panTo({ x, z }, { instant: true }); if (dist) { worldRig.dist = dist; worldRig.apply(); } },
  localSites: () => currentLocalTile
    ? sitesFor(currentLocalTile).map(s => ({ id: s.id, name: s.name, type: s.type, actions: s.actions, cleared: s.cleared }))
    : [],
  act: (id, label) => {
    if (!currentLocalTile) return false;
    const site = sitesFor(currentLocalTile).find(s => s.id === id);
    if (site) handleAction(site, label, { disabled: false });
    return !!site;
  },
  smite: () => { for (const e of battle.enemies || []) if (!e.dead) e.hp = 1; },
  give: id => { import('./items.js').then(m => { const it = m.ITEMS.find(i => i.id === id); if (it) { run.addItem(it); refreshHud(player.tile); saveNow(true); } }); },
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

  if (activeScene === 'battle') {
    battle.update(dt);
    if (battle.scene) renderer.render(battle.scene, battle.camera);
  } else if (activeScene === 'local') {
    localRig.update(dt);
    localView.update(dt, localCamera);
    if (localView.scene) renderer.render(localView.scene, localCamera);
  } else {
    worldRig.update(dt);
    worldView.update(dt, worldCamera);
    player.layerY = worldView.layer.position.y;
    player.update(dt, worldCamera, worldRig.focus);
    renderer.render(worldScene, worldCamera);
  }

  if (firstFrame) {
    firstFrame = false;
    ui.loadingDone();
    if (restoredRun) {
      ui.toast(`The run continues — welcome back to <b>${player.tile.name}</b>.`, true);
    } else {
      ui.toast(`You wake in <b>${world.start.name}</b>, beneath the light of ${world.sun.name}.`, true);
      ui.toast('The rifts are sealed by warded causeways. Grow strong, then challenge the wardens.', true);
    }
  }
}
loop();
