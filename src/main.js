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
import { BattleSystem, fmtV } from './battle.js';
import { ui } from './ui.js';
import { makeTrader, mysteryOutcome, BIOMES, FOES, SHRINE_BOONS, SKY_SPEAKERS, DROWNED, KEEPSAKES, ISLETS, VISITORS } from './names.js';
import { drawItem, drawMutation, CONSUMABLES, RARITY, ITEMS } from './items.js';
import { makeItemIconURL } from './textures.js';
import { run } from './run.js';
import { RoamerSystem } from './roamers.js';
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
const roamers = new RoamerSystem(world);
worldView.attachRoamers(roamers);
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

let mode = 'world';          // 'world' | 'transition' | 'local' | 'battle' | 'skyEvent' | 'dead'
let activeScene = 'world';   // 'world' | 'local' | 'battle'
let skyEvent = null;         // the camera is away with a celestial body (see below)
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
    const tile = applySave(saved, world, worldView, roamers);
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
    player.setAppearance(run.appearance, run.appearanceSig);
    if (run.mutationCount >= 5) openWound({ announce: false });
  }
}

let lastSave = 0;
function saveNow(force = false) {
  const now = performance.now();
  if (!force && now - lastSave < 1200) return;
  lastSave = now;
  saveRun(world, player, worldView, roamers);
}

ui.init(world);
refreshHud(player.tile);
ui.setHint(WORLD_HINT);

function refreshHud(tile) {
  ui.setLocation(tile, kingdomOf(tile));
  const reg = world.regionOf(tile);
  ui.setRegion(reg, threatFor(reg));
  ui.setShards(run.shards);
  ui.setStats(run);
  updateSkyButton(tile);
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

// What the land expects of you at each depth — fitted to the measured power
// of a wanderer who gathered ~70% of the previous areas' relics. At that
// pace every tier reads "even"; underfarm and the threat turns dire.
function expectedPower(tier) { return 14 + tier * 8; }

// The harsh floor: as the wanderer's power grows, every battle's effective
// tier rises to meet it, so no region ever goes soft. (Base power is ~20.)
function powerTier() { return Math.max(0, Math.floor((run.power - 18) / 12)); }

function threatFor(region) {
  const eff = Math.max(region.tier, powerTier());
  const ratio = run.power / expectedPower(eff);
  const t = ratio >= 1.35 ? { label: 'calm', color: '#7fd98a' }
    : ratio >= 1.0 ? { label: 'even', color: '#ffd98a' }
    : ratio >= 0.75 ? { label: 'dire', color: '#ff9a5a' }
    : { label: 'deadly', color: '#ff5a7a' };
  t.tier = eff;
  return t;
}

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
        `<div class="tt-biome">warded shallows crossing into ${world.regions[g.into].name}</div>` +
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
        (roamers.at(tile) && tile.fogState >= 2 ? `<div class="tt-extra" style="color:#ff9a5a">⚔ ${roamers.at(tile).species?.n || 'a hunting pack'} prowls here — step onto its hex to give battle</div>` : '') +
        (tile.hasGlint && tile.fogState >= 2 ? '<div class="tt-extra">✦ something glimmers here</div>' : '') +
        (tile.seamHint && tile.fogState >= 2 ? '<div class="tt-extra" style="color:#9fe8ff">✸ this shore hums — stand here and detonate a star-charge to unfurl the folded bridge</div>' : '') +
        (tile.isletHint != null && tile.fogState >= 2 ? '<div class="tt-extra" style="color:#d8ffb0">❂ this shore hums faintly — stand here and detonate a star-charge to reach what holds on out there</div>' : '') +
        (tile.vantage && tile.fogState >= 2 ? '<div class="tt-extra" style="color:#dfe6ff">☄ the sky leans close here</div>' : '') +
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
    if (target.region >= 100 && target.region < 200 && !world.satellites[target.region - 100]?.revealed) {
      ui.toast('☄ That world hangs beyond a bridge not yet unfurled. Its shore hums where the seam waits — bring a star-charge.');
    } else {
      ui.toast(world.gates.some(g => gateLocked(g))
        ? 'No open road leads there — a warden bars the way.'
        : 'The rift denies passage — no road threads that stretch of void.');
    }
    return;
  }
  followPlayer = true;
  // the Antler Crown's heavy gait forbids fast travel entirely
  const fast = !run.flags.heavyGait && (run.flags.fastTravel || path.length > CONFIG.fastPathLen);
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
      // first time beneath a speaking body, the sky arrests you: the rest
      // of the path is dropped and the camera goes to look
      if (tile.vantage && !run.vantageSeen.has(tile.vantage)) {
        const def = skyDefFor(tile);
        // only the four old voices summon; the quiet vantages wait for ☄
        if (def && def.voice) {
          player.path = [];
          player.onDone = null;
          saveNow(true);
          const tryStart = () => {
            if (skyEvent || mode !== 'world') return;   // a battle cut in — next visit calls again
            if (player.isMoving) { setTimeout(tryStart, 250); return; }
            startSkyEvent(def);
          };
          setTimeout(tryStart, 400);
        }
      }
      if ((tile.seamHint || tile.isletHint != null) && !seamNudged.has(keyOf(tile.q, tile.r))) {
        seamNudged.add(keyOf(tile.q, tile.r));
        ui.toast('✸ The shore HUMS beneath your feet — something folded waits in the void. A star-charge detonated here would answer it.', true);
      }
      if (followPlayer && !worldRig.dragMode) worldRig.panTo({ x: tile.x, z: tile.z });
      // the world takes its turn: every roaming pack steps once per hop
      const hunter = roamers.step(tile);
      if (hunter) {
        player.path = [];
        player.onDone = null;
        saveNow(true);
        engageRoamer(hunter);
      }
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
const seamNudged = new Set();   // humming shores already whispered about
function revealRegionMemory(tile) {
  const reg = world.regionOf(tile);
  if (reg.id >= 100 || revealedRegions.has(reg.id)) return;
  revealedRegions.add(reg.id);
  for (const t of reg.tiles || []) worldView.explored.add(keyOf(t.q, t.r));
  worldView.updateFog(tile, { animate: false });
  ui.toast(`The Meridian Compass charts ${reg.name} into memory.`, true);
}

// ---------------------------------------------- the speaking sky (events) ---
// Standing beneath a celestial body, the camera leaves your shoulder and
// goes to look at it. Dialogue advances only on a click, so it can be read;
// the rig is locked away for the duration and handed back afterwards.
// Voices (vantage hexes) summon you the first time and gift once per run;
// the wandering worlds' bodies wait to be beheld at will. Either kind can
// be replayed from the ☄ button whenever you stand in the right place.

// skyEvent (declared with the mode state above):
//   { def, idx, phase: 'out'|'hold'|'back', t, dur, from, to, backFrom, drift }

// Which speaker (if any) this tile can behold, with the dialogue the NEXT
// viewing should play: sets cycle per completed visit (run.skyChats), and a
// carried keepsake swaps in the speaker's quest payoff instead.
function skyDefFor(tile) {
  let sp = null;
  if (tile.vantage) sp = SKY_SPEAKERS.find(v => v.id === tile.vantage);
  else if (tile.region >= 100 && tile.region < 200) {
    const satId = world.satellites[tile.region - 100]?.def.id;
    sp = SKY_SPEAKERS.find(v => v.id === satId);
  }
  if (!sp) return null;
  const questReady = sp.quest && run.keepsakes.includes(sp.quest.token) && !run.questsDone.has(sp.id);
  const n = run.skyChats[sp.id] || 0;
  return {
    id: sp.id, name: sp.name,
    lines: questReady ? sp.quest.payoff : sp.sets[n % sp.sets.length],
    gift: sp.gift, voice: !!sp.summons, grants: sp.grants,
    quest: questReady ? sp.quest : null,
  };
}

function updateSkyButton(tile) {
  const btn = document.getElementById('btn-skyview');
  const def = mode === 'world' && !skyEvent ? skyDefFor(tile) : null;
  if (def) {
    btn.textContent = `☄ behold ${def.name.split(',')[0]}`;
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function startSkyEvent(def) {
  if (skyEvent || mode !== 'world' || player.isMoving) return;
  const body = worldView.skyBodyFor(def.id);
  if (!body) return;
  mode = 'skyEvent';
  document.body.classList.add('in-skyevent');
  worldView.setSkyLabelsVisible(false);   // no nameplates inside the frame
  worldRig.enabled = false;
  worldRig.velocity.set(0, 0, 0);
  worldRig.tween = null;
  worldView.setHighlight(null);
  ui.tooltip(null);
  audio.sfxReveal?.();
  const from = {
    pos: worldCamera.position.clone(),
    look: worldRig.focus.clone().add(new THREE.Vector3(0, 0.5, 0)),
  };
  const B = new THREE.Vector3(body.x, body.y, body.z);
  const dir = worldCamera.position.clone().sub(B);
  dir.y = 0;
  if (dir.lengthSq() < 1) dir.set(1, 0, 0);
  dir.normalize();
  const frame = body.frame || 14;
  const to = {
    pos: B.clone().addScaledVector(dir, frame).add(new THREE.Vector3(0, frame * 0.24, 0)),
    look: B.clone(),
  };
  skyEvent = { def, idx: 0, phase: 'out', t: 0, dur: 1.7, from, to, backFrom: null, drift: 0 };
  updateSkyButton(player.tile);
}

function showSkyLine() {
  const se = skyEvent;
  const el = document.getElementById('skyevent');
  el.classList.remove('hidden');
  document.getElementById('se-name').textContent = se.def.name;
  const lineEl = document.getElementById('se-line');
  lineEl.textContent = '“' + se.def.lines[se.idx] + '”';
  lineEl.classList.remove('reveal');
  void lineEl.offsetWidth;
  lineEl.classList.add('reveal');
  document.getElementById('se-hint').textContent =
    se.idx < se.def.lines.length - 1 ? 'click to continue ▸' : 'click to look away ▸';
}

function advanceSkyEvent() {
  const se = skyEvent;
  if (!se || se.phase !== 'hold') return;
  se.idx++;
  if (se.idx < se.def.lines.length) {
    audio.sfxHop?.();
    showSkyLine();
    return;
  }
  // the dialogue is done: the visit counts (sets cycle), first hearings of
  // a voice leave a gift, keepsakes fall, and carried errands pay out
  document.getElementById('skyevent').classList.add('hidden');
  const def = se.def;
  run.skyChats[def.id] = (run.skyChats[def.id] || 0) + 1;
  if (def.voice && !run.vantageSeen.has(def.id)) {
    run.vantageSeen.add(def.id);
    const gift = def.gift;
    if (gift?.shards) {
      const got = run.gainShards(gift.shards);
      ui.toast(`☄ Something small falls from the sky into your hand. (+${got} ☆)`, true);
    }
    if (gift?.boon) {
      run.addBoon(gift.boon);
      ui.toast(`☄ <b>${gift.boon.name}</b> settles over you like weather.`, true);
    }
  }
  // a body that sheds a keepsake does so once (never re-shed after delivery)
  if (def.grants && !run.keepsakes.includes(def.grants)) {
    const owner = SKY_SPEAKERS.find(s => s.quest?.token === def.grants);
    if (!owner || !run.questsDone.has(owner.id)) {
      run.keepsakes.push(def.grants);
      const kp = KEEPSAKES[def.grants];
      if (kp) ui.toast(`${kp.icon} You now carry <b>${kp.name}</b>.`, true);
    }
  }
  // the errand delivered: the token is spent, the speaker pays
  if (def.quest) {
    run.keepsakes = run.keepsakes.filter(k => k !== def.quest.token);
    run.questsDone.add(def.id);
    if (def.quest.reward === 'vessel') {
      run.addVessels(2);
      ui.toast('★ Vael kindles you a vessel — a small star, fired hollow. Your paper heart grows by one.', true);
    } else if (def.quest.reward === 'boon') {
      run.addBoon({ ...def.quest.boon });
      ui.toast(`☄ <b>${def.quest.boon.name}</b> settles over you like weather.`, true);
    } else if (def.quest.reward === 'astral') {
      const item = drawItem(
        mulberry32((world.seed * 131 + def.id.length * 17 + 9) >>> 0),
        'ASTRAL', run.ownedIds, { source: 'astral', tier: 3, unlocked: meta.unlockedIds });
      if (item) grantItem(item);
      else { const got = run.gainShards(30); ui.toast(`The sky pays in loose light instead. (+${got} ☆)`, true); }
    }
    announceFeats(meta.bump(s => { s.errands = (s.errands || 0) + 1; }));
  }
  saveNow(true);
  se.phase = 'back';
  se.t = 0;
  se.dur = 1.3;
  se.backFrom = { pos: worldCamera.position.clone(), look: se.to.look.clone() };
}

function endSkyEvent() {
  skyEvent = null;
  document.body.classList.remove('in-skyevent');
  worldView.setSkyLabelsVisible(true);
  mode = 'world';
  worldRig.enabled = true;
  worldRig.apply();
  refreshHud(player.tile);
}

// driven from the main loop while the camera is away with the sky
function updateSkyEvent(dt) {
  const se = skyEvent;
  if (!se) return;
  const ease = k => k * k * (3 - 2 * k);
  if (se.phase === 'out') {
    se.t += dt / se.dur;
    const k = ease(Math.min(1, se.t));
    worldCamera.position.lerpVectors(se.from.pos, se.to.pos, k);
    const look = se.from.look.clone().lerp(se.to.look, k);
    worldCamera.lookAt(look);
    if (se.t >= 1) {
      se.phase = 'hold';
      showSkyLine();
    }
  } else if (se.phase === 'hold') {
    // a slow, reverent drift while the body speaks
    se.drift += dt;
    const off = se.to.pos.clone().sub(se.to.look);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(se.drift * 0.35) * 0.1);
    worldCamera.position.copy(se.to.look).add(off);
    worldCamera.lookAt(se.to.look);
  } else if (se.phase === 'back') {
    se.t += dt / se.dur;
    const k = ease(Math.min(1, se.t));
    worldCamera.position.lerpVectors(se.backFrom.pos, se.from.pos, k);
    const look = se.backFrom.look.clone().lerp(se.from.look, k);
    worldCamera.lookAt(look);
    if (se.t >= 1) endSkyEvent();
  }
}

document.getElementById('skyevent').addEventListener('click', advanceSkyEvent);
window.addEventListener('keydown', e => {
  if (skyEvent && skyEvent.phase === 'hold' && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault();
    advanceSkyEvent();
  }
});
document.getElementById('btn-skyview').addEventListener('click', () => {
  const def = skyDefFor(player.tile);
  if (def) startSkyEvent(def);
});

function engageRoamer(pack) {
  const who = pack.species?.n || 'A prowling foe';
  ui.toast(`⚔ ${who}${pack.count > 1 ? ' and its pack fall' : ' falls'} upon you!`);
  startBattle({
    team: {
      biome: pack.biome, tier: pack.tier, count: pack.count, roamerId: pack.id,
      species: pack.species?.n, speciesRole: pack.species?.r,
    },
    title: pack.species ? pack.species.n + (pack.count > 1 ? ' Pack' : '') : 'The Prowler',
    onWin: () => {
      roamers.kill(pack.id);
      announceFeats(meta.bump(s => { s.packs = (s.packs || 0) + 1; }));
    },
  });
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
    flavor: `The shallows crossing into ${world.regions[g.into].name} is sealed behind folded starlight. The Warden rises from the star-water to meet you — ${'☠'.repeat(Math.min(5, g.tier))} tier ${g.tier}. ` +
      (ready ? 'Your power feels equal to this.' : 'Your power does not yet feel equal to this. It will let you try anyway.'),
    actions: ['⚔ Challenge the Warden', 'Withdraw'],
  }, {
    onAction: label => {
      if (label.startsWith('⚔')) {
        ui.closeModal();
        startBattle({
          team: { biome: g.biome, tier: g.tier, count: 1, boss: true, bossName: gateTile.landmark.name, bossKind: 'warden' },
          title: gateTile.landmark.name,
          onWin: () => {
            run.openedGates.add(keyOf(gateTile.q, gateTile.r));
            worldView.openGate(gateTile);
            audio.sfxGate();
            ui.toast(`⚑ The ward shatters — ${world.regions[g.into].name} lies open.`, true);
            announceFeats(meta.bump(s => { s.wardens++; if (g.tier >= 3) s.deepWarden = true; }));
            // every warden's broken ward condenses into a whole new vessel
            run.addVessels(2);
            ui.toast('★ A Star Vessel condenses from the shattered ward — your paper heart grows by one.', true);
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
  updateSkyButton(tile);
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
  // the harsh floor: authored tiers never lag the wanderer's power;
  // bosses stand a step above it
  const harden = t => t ? { ...t, tier: Math.max(t.tier ?? 0, powerTier() + (t.boss ? 1 : 0)) } : t;
  team = harden(team);
  if (waves) waves = waves.map(w => ({ ...w, team: harden(w.team) }));
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
      run.hp = Math.min(run.stats.maxHP, run.hp + 1);
      ui.toast(`A breath between chambers (+½★) — deeper now.`, true);
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
    // a fled-from pack loses your scent for a few hops
    if (result.fled && battle.team?.roamerId != null) roamers.calm(battle.team.roamerId);
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
  ui.setHint('strike: <b>click / space</b> on the gold band · block: <b>A S D</b> as the shapes reach the line');
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
      // deep keepers sometimes guard a change instead of a relic
      const item = (tier >= 3 && rng() < 0.25 && drawMutation(rng, run.ownedIds))
        || drawItem(rng, tile.biome, run.ownedIds, { source: 'boss', tier, unlocked: meta.unlockedIds });
      if (item) grantItem(item);
      // the sun's fallen spark sleeps in the vault nearest the fire-mountain
      if (keyOf(tile.q, tile.r) === world.sparkDungeonKey
        && !run.keepsakes.includes('fallen_spark') && !run.questsDone.has('sun')) {
        run.keepsakes.push('fallen_spark');
        ui.toast(`${KEEPSAKES.fallen_spark.icon} Among the Keeper’s hoard: <b>${KEEPSAKES.fallen_spark.name}</b> — cool to your hand alone.`, true);
      }
    },
    waves: [
      { team: { biome, tier, count: 2 }, title: `${site.name} · First Chamber` },
      { team: { biome, tier: tier + 1, count: 2 }, title: `${site.name} · Second Chamber` },
      { team: { biome, tier: tier + 1, count: 1, boss: true, bossName: keeper, bossKind: 'keeper' }, title: keeper },
    ],
  });
}

function checkGlint(tile) {
  if (!tile) return;
  const sites = world.getSites(tile);
  const meaningful = sites.filter(s => s.type === 'battle' || s.type === 'pedestal'
    || s.subtype === 'cache' || s.subtype === 'mystery' || s.subtype === 'bargain');
  if (meaningful.every(s => run.clearedSites.has(s.id))) worldView.setGlint(tile, false);
}

const statText = stats => Object.entries(stats || {})
  .map(([k, v]) => k === 'vessel' ? `${v > 0 ? '+' : '−'}${fmtV(v)} max`
    : `${v > 0 ? '+' : ''}${v}${k === 'luck' ? '% crit' : k === 'dodge' ? '% dodge' : ' ' + k.toUpperCase()}`)
  .join(', ');

// A bargain asks for something real; refusal is always free.
function resolveBargain(site) {
  if (run.clearedSites.has(site.id)) { ui.toast('The bargain is struck and done.'); return; }
  const b = site.bargain;
  const tile = currentLocalTile || player.tile;
  const tier = world.regionOf(tile).tier;
  const sigBefore = run.appearanceSig;
  if (b.cost === 'relic') {
    const cands = run.items.filter(i => !i.mutation);
    if (!cands.length) { ui.toast('You carry nothing it wants to eat.'); return; }
    const order = { c: 0, u: 1, r: 2, a: 3 };
    cands.sort((x, y) => order[x.rarity] - order[y.rarity]);
    const eaten = run.removeItem(cands[0].id);
    ui.toast(`The star swallows <b>${eaten.name}</b> whole, and chews with its whole face.`);
  } else if (b.cost.hp) {   // hp costs are half-vessels now
    if (run.hp <= b.cost.hp) { ui.toast('It would take more than you have left to give.'); return; }
    run.hp -= b.cost.hp;
  } else if (b.cost.vessel) {   // permanent halves traded away
    if (run.stats.maxHP - b.cost.vessel < CONFIG.battle.vessels.min + 2) {
      ui.toast('There is not enough of you left to trade away.'); return;
    }
    run.addBoon({ id: b.id + '_price', name: b.name + ' (the price)', stats: { vessel: -b.cost.vessel } });
  } else if (b.cost.shards) {
    if (!run.spendShards(b.cost.shards)) { ui.toast('Your purse does not meet the asking.'); return; }
  }
  run.clearedSites.add(site.id);
  ui.closeModal();
  const rngB = mulberry32((Math.random() * 2 ** 31) | 0);
  if (b.gain === 'draw_rare' || b.gain === 'draw_boosted') {
    const item = drawItem(rngB, world.regionOf(tile).dominantBiome, run.ownedIds,
      { source: b.gain === 'draw_rare' ? 'boss' : 'secret', tier, unlocked: meta.unlockedIds });
    if (item) grantItem(item);
    else { const got = run.gainShards(20); ui.toast(`It pays in loose light instead. (+${got} ☆)`, true); }
  } else if (b.gain === 'gamble_shards') {
    const got = run.gainShards(Math.floor(rngB() * 31));
    ui.toast(got >= 12 ? `The well echoes generously: +${got} ☆.`
      : got > 0 ? `The echo comes back thin: +${got} ☆.`
      : 'The well keeps your offering. The silence afterward is smug.', got >= 12);
  } else if (b.gain === 'mutation') {
    const m = drawMutation(rngB, run.ownedIds);
    if (m) grantItem(m);
    else { const got = run.gainShards(30); ui.toast(`The dust finds nothing left to improve — it pays you off. (+${got} ☆)`, true); }
  } else if (b.gain.boon) {
    run.addBoon(b.gain.boon);
    ui.toast(`<b>${b.gain.boon.name}</b> takes hold, for the rest of this run.`, true);
  }
  if (run.appearanceSig !== sigBefore) player.setAppearance(run.appearance, run.appearanceSig);
  if (currentLocalTile) {
    localView.build(currentLocalTile, world, sitesFor(currentLocalTile));
    checkGlint(currentLocalTile);
  }
  refreshHud(player.tile);
  saveNow(true);
}

// ------------------------------------------------------------ site actions ---

// Five mutations, and the world admits what it has been hiding.
function openWound({ announce = true } = {}) {
  if (run.woundOpen) return;
  run.woundOpen = true;
  world.revealWound();
  worldView.revealHiddenTiles([...world.wound.bridgeTiles, ...world.wound.tiles]);
  worldView.updateFog(player.tile, { animate: false });
  if (announce) {
    audio.sfxReveal();
    ui.toast('☒ Your fifth change is answered. Far past the rim, something TEARS…', true);
    ui.toast('☒ <b>The Wound in the Meridian</b> lies open. A scar-tissue bridge waits at the edge of the map.', true);
    ui.toast('☒ What is inside is beyond every warden you have faced. It sent the invitation anyway.', true);
  }
  announceFeats(meta.bump(s => { s.woundOpened = true; }));
  saveNow(true);
}

function grantItem(item) {
  const before = new Set(run.synergies.map(s => s.id));
  const sigBefore = run.appearanceSig;
  run.addItem(item);
  const fresh = run.synergies.filter(s => !before.has(s.id));
  audio.sfxPickup(item.rarity);
  if (item.mutation) {
    ui.toast('☒ The change goes deeper than cloth. Your paper body remembers a different shape…', true);
    announceFeats(meta.bump(s => { s.mutations = (s.mutations || 0) + 1; }));
    if (run.mutationCount >= 5) openWound();
  }
  // the hoard marks the wanderer: repaint the paper self if the look changed
  if (run.appearanceSig !== sigBefore) {
    player.setAppearance(run.appearance, run.appearanceSig);
    if (fresh.some(s => s.grand)) ui.toast('✦ Your paper form is rewritten by the union of sets.', true);
    else if (fresh.length) ui.toast('✦ The completed set re-inks your cloak.', true);
  }
  if (fresh.length) {
    announceFeats(meta.bump(s => {
      for (const sy of fresh) if (!s.synergies.includes(sy.id)) s.synergies.push(sy.id);
    }));
  }
  ui.showItemCard(item, fresh, () => { refreshHud(player.tile); saveNow(true); });
}

// Shops are lean now: relics come from a harshly weighted loot table (up to
// three, mostly common), consumables carry finite stock, and every rummage
// for fresh wares doubles in price until the cart is simply empty.
const SHOP_POOLS = ['MEADOW', 'FOREST', 'MOUNTAIN', 'VOLCANO', 'DESERT', 'TUNDRA', 'SEA', 'CRYSTAL'];
const MAX_RESTOCKS = 2;

function shopMarkup() {
  return (1 + (run.flags.shopMarkup || 0)) * (1 + run.items.length * 0.06);
}

function buildItemOffers(site, tile, rng) {
  if (site.subtype === 'wandering') return [];   // roadside carts carry no relics
  const tier = world.regionOf(tile).tier;
  const markup = shopMarkup();
  const count = 1 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);   // up to 3, rarely
  const offers = [];
  const taken = new Set(run.ownedIds);
  for (let i = 0; i < count; i++) {
    const pool = SHOP_POOLS[Math.floor(rng() * SHOP_POOLS.length)];
    const item = drawItem(rng, pool, taken, { source: 'shop', tier, unlocked: meta.unlockedIds });
    if (!item) continue;
    taken.add(item.id);
    const base = { c: 18, u: 30, r: 48, a: 80 }[item.rarity] || 30;
    offers.push({ kind: 'item', item, price: Math.round((base + tier * 8) * markup) });
  }
  return offers;
}

function buildOffers(site, tile, rngOverride = null) {
  const rng = rngOverride || mulberry32(Math.floor(hash2(tile.q, tile.r, world.seed + 553) * 0xffffffff));
  const markup = shopMarkup();
  const offers = [
    { kind: 'consumable', id: 'charge', price: Math.round(8 * markup), stock: 1 + (rng() < 0.4 ? 1 : 0) },
  ];
  if (rng() < 0.55) offers.push({ kind: 'consumable', id: 'dew', price: Math.round(12 * markup), stock: 1 });
  if (rng() < 0.5) offers.push({ kind: 'consumable', id: 'feather', price: Math.round(9 * markup), stock: 1 });
  offers.push(...buildItemOffers(site, tile, rng));
  return offers;
}

function renderShop(site) {
  const extra = document.getElementById('modal-extra');
  extra.innerHTML = '';
  for (const offer of site.offers) {
    const sold = offer.kind === 'item' ? offer.sold : offer.stock <= 0;
    const row = document.createElement('div');
    row.className = 'ware';
    const label = offer.kind === 'item'
      ? `<img class="ware-icon" alt="" src="${makeItemIconURL(offer.item)}" /><b>${offer.item.name}</b> <span style="color:var(--ink-dim);font-size:12px">${offer.item.desc}</span>`
      : `${CONSUMABLES[offer.id].icon} ${CONSUMABLES[offer.id].name}${offer.stock > 1 ? ` ×${offer.stock}` : ''} <span style="color:var(--ink-dim);font-size:12px">${CONSUMABLES[offer.id].desc}</span>`;
    row.innerHTML = `<span>${label}</span><span class="price">${sold ? 'sold out' : '☆ ' + offer.price}</span>`;
    if (!sold) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        if (!run.spendShards(offer.price)) { ui.toast('Not enough star-shards. The trader’s sympathy is complimentary.'); return; }
        if (offer.kind === 'item') { offer.sold = true; grantItem(offer.item); }
        else { offer.stock--; run.consumables[offer.id]++; ui.toast(`${CONSUMABLES[offer.id].icon} ${CONSUMABLES[offer.id].name} acquired.`); }
        refreshHud(player.tile);
        saveNow(true);
        renderShop(site);
      });
    }
    extra.appendChild(row);
  }
  // the rummage: re-rolls the relic shelf only, doubles each time, then ends
  if (site.subtype !== 'wandering') {
    const tile = currentLocalTile || player.tile;
    const restocks = site.restocks || 0;
    const row = document.createElement('div');
    row.className = 'ware';
    if (restocks >= MAX_RESTOCKS) {
      row.innerHTML = `<span>↻ Fresh stock <span style="color:var(--ink-dim);font-size:12px">the trader turns the cart out — nothing left but straw and apologies</span></span><span class="price">empty</span>`;
      row.style.opacity = 0.55;
    } else {
      const cost = Math.round((12 + world.regionOf(tile).tier * 4) * Math.pow(2, restocks));
      row.innerHTML = `<span>↻ Fresh stock <span style="color:var(--ink-dim);font-size:12px">the trader rummages deeper into the cart (${MAX_RESTOCKS - restocks} left)</span></span><span class="price">☆ ${cost}</span>`;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        if (!run.spendShards(cost)) { ui.toast('Not enough star-shards for a rummage.'); return; }
        site.restocks = (site.restocks || 0) + 1;
        site.offers = site.offers.filter(o => o.kind !== 'item')
          .concat(buildItemOffers(site, tile, mulberry32((Math.random() * 2 ** 31) | 0)));
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
      onWin: site.team.deity ? () => {
        announceFeats(meta.bump(s => { s.woundClosed = true; }));
        setTimeout(() => ui.showEnding(run, world, meta), 900);
      } : site.team.boss && site.team.satellite ? () => {
        ui.toast('☄ The satellite’s heart is yours to claim.', true);
        announceFeats(meta.bump(s => {
          if (!s.sats.includes(site.team.satellite)) s.sats.push(site.team.satellite);
        }));
        // the deep sky pays in changed flesh: satellite bosses seed mutations
        const m = drawMutation(mulberry32((Math.random() * 2 ** 31) | 0), run.ownedIds);
        if (m) grantItem(m);
      } : site.subtype === 'crash_guardian' ? () => {
        ui.toast('☄ The guardian falls. In the crater, the visitor stirs…', true);
        announceFeats(meta.bump(s => { s.crashes = (s.crashes || 0) + 1; }));
      } : null,
    });
    return;
  }
  if (site.bargain && label === site.bargain.action) {
    resolveBargain(site);
    return;
  }
  // The crashed visitor's body: its one set change, offered — or refused for
  // whatever it clutched in the fall. Either way, the guardian goes first.
  if (site.subtype === 'crash_body') {
    const def = VISITORS.find(v => v.id === site.visitor) || VISITORS[0];
    const tileHere = currentLocalTile || player.tile;
    const guard = world.getSites(tileHere).find(s => s.subtype === 'crash_guardian');
    if (guard && !run.clearedSites.has(guard.id)) {
      ui.modalOutcome(`${def.guardian.name} steps between you and the visitor. The introduction is not optional.`);
      return;
    }
    const mutItem = ITEMS.find(i => i.id === def.mutation);
    if (!mutItem || run.ownedIds.has(def.mutation)) {
      ui.modalOutcome('The visitor has given what it came to give. It sleeps now, and the crater keeps it.');
      return;
    }
    if (label === 'Approach the Visitor') {
      if (!site._offered) {
        site._offered = true;
        ui.modalOutcome(`The visitor stirs and offers its change: <b>${mutItem.name}</b> — ${mutItem.desc} `
          + `A change is forever, and the fifth tears the Wound open. Approach again to accept.`);
        return;
      }
      site._offered = false;
      grantItem(mutItem);
      run.clearedSites.add(site.id);
      refreshHud(player.tile);
      saveNow(true);
      return;
    }
    if (label === 'Refuse the Gift') {
      site._offered = false;
      if (run.clearedSites.has(site.id)) {
        ui.modalOutcome('The fall’s cargo is already yours. Only the change remains — and the visitor can wait far longer than you can.');
        return;
      }
      run.clearedSites.add(site.id);
      const rngC = mulberry32(Math.floor(hash2(tileHere.q, tileHere.r, world.seed + 7300) * 0xffffffff));
      const tier = world.regionOf(tileHere).tier;
      const got = run.gainShards(12 + tier * 5);
      const item = drawItem(rngC, world.regionOf(tileHere).dominantBiome, run.ownedIds,
        { source: 'boss', tier, unlocked: meta.unlockedIds });
      ui.modalOutcome(`You refuse the change. The visitor, unoffended, lets the fall’s cargo go instead. (+${got} ☆) `
        + `The change itself remains in the crater, for the day you want it.`);
      if (item) grantItem(item);
      refreshHud(player.tile);
      saveNow(true);
      return;
    }
  }
  if (label === 'Refuse') {
    ui.closeModal();
    ui.toast('You keep what is yours. The offer does not lower its price.');
    return;
  }
  if (label === 'Commune with the Shrine') {
    if (run.shrineBoons.has(site.id)) { ui.toast('The shrine has given what it will give this pilgrimage.'); return; }
    const tileHere = currentLocalTile || player.tile;
    const rng0 = mulberry32(Math.floor(hash2(tileHere.q * 13 + 5, tileHere.r * 7 + 3, world.seed + 4400) * 0xffffffff));
    const offer = SHRINE_BOONS[Math.floor(rng0() * SHRINE_BOONS.length)];
    if (!site._communeOffered) {
      site._communeOffered = true;
      const costTxt = offer.cost.shards ? `☆ ${offer.cost.shards}` : `${fmtV(offer.cost.hp)} of your ink`;
      ui.modalOutcome(`The shrine stirs. It offers ${offer.name} (${statText(offer.boon.stats)}) in exchange for ${costTxt}. Commune again to accept.`);
      return;
    }
    if (offer.cost.shards && !run.spendShards(offer.cost.shards)) {
      ui.toast('You lack the starlight the shrine asks.');
      return;
    }
    if (offer.cost.hp) {
      if (run.hp <= offer.cost.hp) { ui.toast('The shrine asks more ink than you can spare.'); return; }
      run.hp -= offer.cost.hp;
    }
    run.shrineBoons.add(site.id);
    run.addBoon({ id: offer.id, name: offer.name, stats: offer.boon.stats });
    audio.sfxHeal();
    ui.toast(`✚ ${offer.line} (${statText(offer.boon.stats)})`, true);
    refreshHud(player.tile);
    saveNow(true);
    return;
  }
  if (label === 'Listen' && site.subtype === 'drowned') {
    const def = DROWNED.find(d => d.id === site.drownedId);
    if (!def) return;
    const n = run.skyChats['d_' + def.id] || 0;
    run.skyChats['d_' + def.id] = n + 1;
    for (const line of def.sets[n % def.sets.length]) ui.modalOutcome(line);
    // the first listening: keepsakes fall, small mercies are given
    if (!run.clearedSites.has(site.id)) {
      run.clearedSites.add(site.id);
      if (def.grants && !run.keepsakes.includes(def.grants)) {
        const owner = SKY_SPEAKERS.find(s => s.quest?.token === def.grants);
        if (!owner || !run.questsDone.has(owner.id)) {
          run.keepsakes.push(def.grants);
          const kp = KEEPSAKES[def.grants];
          if (kp) ui.toast(`${kp.icon} You now carry <b>${kp.name}</b>.`, true);
        }
      }
      if (def.mercy === 'heal' && run.hp < run.stats.maxHP) {
        run.hp = run.stats.maxHP;
        audio.sfxHeal();
        ui.toast('✚ The font insists you are whole — and briefly, generously, you are.', true);
      } else if (def.mercy === 'shards') {
        const got = run.gainShards(12);
        ui.toast(`☆ Your footstep rings the bronze, barely — ${got} star-shards shiver loose from the old sound.`, true);
      } else if (def.mercy === 'dew') {
        run.consumables.dew++;
        ui.toast('❋ One impossible drop settles into your flask. (+1 star-dew)', true);
      }
    }
    refreshHud(player.tile);
    saveNow(true);
    return;
  }
  if (label === 'Read Her Name' && site.subtype === 'drowned') {
    const def = DROWNED.find(d => d.id === site.drownedId);
    if (!def?.quest || run.questsDone.has(def.id)) return;
    if (!run.keepsakes.includes(def.quest.token)) { ui.toast('Her name is not with you.'); return; }
    run.keepsakes = run.keepsakes.filter(k => k !== def.quest.token);
    run.questsDone.add(def.id);
    for (const line of def.payoff) ui.modalOutcome(line);
    const item = drawItem(mulberry32((world.seed * 131 + 77) >>> 0), 'ASTRAL', run.ownedIds,
      { source: 'astral', tier: 3, unlocked: meta.unlockedIds });
    if (item) grantItem(item);
    else { const got = run.gainShards(30); ui.toast(`Her thanks scatters into loose light. (+${got} ☆)`, true); }
    announceFeats(meta.bump(s => { s.errands = (s.errands || 0) + 1; }));
    refreshHud(player.tile);
    saveNow(true);
    return;
  }
  if (label === 'Listen Closely') {
    if (run.clearedSites.has(site.id)) { ui.toast('The whisper has said its piece.'); return; }
    run.clearedSites.add(site.id);
    const roll = Math.random();
    if (roll < 0.5) {
      const got = run.gainShards(10);
      ui.modalOutcome(`You listen. It tells you where something was buried before "buried" meant anything. (+${got} ☆)`);
    } else if (roll < 0.8) {
      run.addBoon({ id: 'whisper_' + site.id, name: 'A Whispered Truth', stats: { luck: 3 } });
      ui.modalOutcome('You listen. You will never repeat it, and it will never stop being useful. (+3% crit)');
    } else {
      run.hp = Math.max(1, run.hp - 1);
      ui.modalOutcome('You listen too long. Something on the far side listens back. (−½★)');
    }
    refreshHud(player.tile);
    saveNow(true);
    return;
  }
  if (label === 'Cradle a Newborn Star') {
    if (run.clearedSites.has(site.id)) { ui.toast('The nursery sleeps. Let it.'); return; }
    run.clearedSites.add(site.id);
    if (Math.random() < 0.55) {
      run.addBoon({ id: 'star_warmth', name: 'Newborn Starlight', stats: { luck: 4, vessel: 1 } });
      audio.sfxHeal();
      ui.modalOutcome('The little star settles in your palms, considers its options, and moves into your chest-rune. (+4% crit, +½ Star Vessel)');
    } else {
      const got = run.gainShards(16);
      ui.modalOutcome(`The star sneezes stardust all over you. Good manners require keeping it. (+${got} ☆)`);
    }
    refreshHud(player.tile);
    saveNow(true);
    return;
  }
  if (label === 'Claim the Gift') {
    const rng = mulberry32(Math.floor(hash2(site.id.length * 31 + site.id.charCodeAt(0), site.id.charCodeAt(site.id.length - 3) || 7, world.seed + 999) * 0xffffffff));
    const tileHere = currentLocalTile || player.tile;
    const source = site.pool === 'ASTRAL' ? 'astral'
      : site.pool === 'BOSS' ? 'boss'
      : tileHere.secretRevealed ? 'secret' : 'pedestal';
    // astral pedestals occasionally hold something far stranger
    const item = (source === 'astral' && rng() < 0.15 && drawMutation(rng, run.ownedIds))
      || drawItem(rng, site.pool, run.ownedIds,
        { source, tier: world.regionOf(tileHere).tier, unlocked: meta.unlockedIds });
    run.clearedSites.add(site.id);
    ui.closeModal();
    if (item) grantItem(item);
    else { const got = run.gainShards(20); ui.toast(`The pedestal stands empty of gifts — but ${got} ☆ pool in the hollow.`, true); }
    // the observatory's ledger gives up a page along with the observation
    const lmHere = tileHere.landmark;
    if (lmHere?.type === 'islet' && ISLETS[lmHere.islet]?.id === 'observatory'
      && !run.keepsakes.includes('star_name_page') && !run.questsDone.has('drowned_star')) {
      run.keepsakes.push('star_name_page');
      ui.toast(`${KEEPSAKES.star_name_page.icon} A page slips loose from the brass ledger: <b>${KEEPSAKES.star_name_page.name}</b>.`, true);
    }
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
  if (label === 'Offer Star-Shards') {
    const cost = 10 + run.shrineHeals * 6;
    if (run.hp >= run.stats.maxHP) { ui.toast('Your paper heart is already whole.'); return; }
    if (!run.spendShards(cost)) { ui.toast(`The shrine asks ☆ ${cost} — more than you carry.`); return; }
    run.shrineHeals++;
    run.hp = run.stats.maxHP;
    audio.sfxHeal();
    ui.toast(`✚ The wayshrine drinks ☆ ${cost} of starlight and re-folds every crease. (next offering: ☆ ${10 + run.shrineHeals * 6})`, true);
    refreshHud(player.tile);
    saveNow(true);
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
    if (out.boon) run.addBoon({ ...out.boon });
    if (out.hp) run.hp = Math.max(1, run.hp + out.hp);
    run.clearedSites.add(site.id);
    refreshHud(player.tile);
    saveNow(true);
    ui.modalOutcome(out.text
      + (out.shards ? `  (${out.shards > 0 ? '+' : ''}${out.shards} ☆)` : '')
      + (out.boon ? `  (${statText(out.boon.stats)})` : '')
      + (out.hp ? `  (${out.hp > 0 ? '+' : '−'}${fmtV(out.hp)})` : ''));
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
  // a carried name surfaces the drowned star's offer — never before
  if (site.subtype === 'drowned') {
    const def = DROWNED.find(d => d.id === site.drownedId);
    const ready = def?.quest && run.keepsakes.includes(def.quest.token) && !run.questsDone.has(def.id);
    site.actions = ready ? ['Listen', def.quest.action] : ['Listen'];
  }
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
  const neighbors = neighborsOf(player.tile.q, player.tile.r)
    .map(([q, r]) => world.tiles.get(keyOf(q, r)));
  const nearTiles = [player.tile, ...neighbors].filter(Boolean);
  const secret = neighbors.find(t => t && t.secret);
  // The humming shore itself is the trigger: standing on it — or right
  // beside it — is enough. The blast finds the folded seam on its own,
  // however the coastline twisted the span's first tile.
  let isletIdx = nearTiles.find(t => t.isletHint != null)?.isletHint;
  if (isletIdx == null) isletIdx = neighbors.find(t => t && t.isletHidden && t.isletSeam)?.isletBridge;
  let satIdx = null;
  const seamShore = nearTiles.find(t => t.seamHint);
  if (seamShore) satIdx = world.satellites.findIndex(s => s.def.id === seamShore.seamHint);
  if (satIdx == null || satIdx < 0) {
    const seam = neighbors.find(t => t && t.hiddenBridge && t.bridgeSeam);
    satIdx = seam ? seam.region - 100 : null;
  }
  player.burstNow?.();
  audio.sfxDetonate();
  if (isletIdx != null && world.islets[isletIdx] && !world.islets[isletIdx].revealed) {
    const isl = world.islets[isletIdx];
    world.revealIslet(isletIdx);
    worldView.revealHiddenTiles([...isl.bridgeTiles, ...isl.tiles]);
    if (isl.shore?.seamSprite) isl.shore.seamSprite.material.opacity = 0;
    worldView.updateFog(player.tile, { animate: false });
    audio.sfxReveal();
    audio.sfxGate();
    ui.toast('✸ The blast finds the hum in the shore — a folded footbridge shakes itself out over the void!', true);
    ui.toast(`❂ <b>${isl.def.name}</b> — ${isl.def.sub} — drifts within reach.`, true);
    announceFeats(meta.bump(s => { s.islets = (s.islets || 0) + 1; }));
    saveNow(true);
    return;
  }
  if (satIdx != null && satIdx >= 0 && world.satellites[satIdx] && !world.satellites[satIdx].revealed) {
    const sat = world.satellites[satIdx];
    world.revealBridge(satIdx);
    worldView.revealHiddenTiles(sat.bridgeTiles);
    if (sat.shore?.seamSprite) sat.shore.seamSprite.material.opacity = 0;
    worldView.updateFog(player.tile, { animate: false });
    audio.sfxReveal();
    audio.sfxGate();
    ui.toast(`✸ The blast strikes the resonant seam — a folded star-bridge UNFURLS across the void!`, true);
    ui.toast(`☄ The way to <b>${sat.def.name}</b> lies open. What waits there is stronger than this shore.`, true);
    announceFeats(meta.bump(s => { s.bridges = (s.bridges || 0) + 1; }));
    saveNow(true);
    return;
  }
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
    let amount = Math.min(6, 4 + (run.flags.dewPotency || 0));   // 2★, relics push to 3★
    if (run.flags.dewMuted) amount = Math.ceil(amount / 2);
    run.hp = Math.min(run.stats.maxHP, run.hp + amount);
    ui.toast(`❋ The star-dew glows going down. +${fmtV(amount)}.`);
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

// ---------------------------------------------------- the wanderer's menu ---

const gm = id => document.getElementById(id);
let menuOpen = false;

function toggleMenu(open = !menuOpen) {
  menuOpen = open;
  gm('gamemenu').classList.toggle('hidden', !open);
  if (open) {
    disarmRestarts();
    updateAudioButton();
  }
}

// restart buttons arm on the first click, fire on the second
function disarmRestarts() {
  for (const [id, label, note] of [
    ['gm-restart-seed', '↻ refold this world', 'the same meridian, the run begun anew'],
    ['gm-newworld', '☄ wake in a new world', 'this run is lost; a new meridian is drawn'],
  ]) {
    const b = gm(id);
    b.classList.remove('armed');
    b.innerHTML = `${label} <span class="gm-note">${note}</span>`;
  }
}

function armOrFire(btn, fire) {
  if (btn.classList.contains('armed')) { fire(); return; }
  disarmRestarts();
  btn.classList.add('armed');
  btn.innerHTML = 'are you certain? <span class="gm-note">the run will not be saved — press again</span>';
}

gm('btn-menu').addEventListener('click', () => toggleMenu());
gm('gm-continue').addEventListener('click', () => toggleMenu(false));
gm('gm-restart-seed').addEventListener('click', e => armOrFire(e.currentTarget, () => {
  clearSave(world.seed);
  location.reload();
}));
gm('gm-newworld').addEventListener('click', e => armOrFire(e.currentTarget, () => {
  clearSave(world.seed);
  location.href = location.pathname + '?seed=' + Math.floor(Math.random() * 1e6);
}));
gm('gm-echoes').addEventListener('click', () => {
  toggleMenu(false);
  ui.toggleEchoes(meta);
});

function updateAudioButton() {
  gm('gm-audio').textContent = audio.enabled ? '♪ music of the spheres — on' : '♪ music of the spheres — silenced';
}
updateAudioButton();
gm('gm-audio').addEventListener('click', () => {
  audio.setEnabled(!audio.enabled);
  updateAudioButton();
});

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
document.getElementById('btn-ascend').addEventListener('click', () => {
  clearSave(world.seed);   // the healed world is finished; a new one is drawn
  location.href = '?seed=' + Math.floor(Math.random() * 1e6);
});

window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (menuOpen) toggleMenu(false);
    else if (ui.modalOpen) ui.closeModal();
    else if (!document.getElementById('inventory').classList.contains('hidden')) ui.toggleInventory(run, false);
    else if (!document.getElementById('echoes').classList.contains('hidden')) ui.toggleEchoes(meta, false);
    else if (mode === 'local') exitLocal();
    else if (mode === 'world' || mode === 'battle') toggleMenu(true);
  }
  if (e.code === 'KeyI' && mode !== 'battle' && mode !== 'skyEvent') ui.toggleInventory(run);
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
  run, world, battle, view: worldView, meta, audio, announceFeats, roamers, powerTier,
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
  testBattle: (tier = 1, biome = 'MEADOW', boss = false, extra = {}) =>
    startBattle({ team: { biome, tier, count: 2, boss, ...extra }, title: extra.bossName || 'Test Battle' }),
  openGateAt: (q, r) => { const t = world.tiles.get(q + ',' + r); if (t?.gate) challengeGate(t); },
  detonate,
  revealIslet: i => {
    const isl = world.islets[i];
    if (!isl || !world.revealIslet(i)) return;
    worldView.revealHiddenTiles([...isl.bridgeTiles, ...isl.tiles]);
    worldView.updateFog(player.tile, { animate: false });
    saveNow(true);
  },
  lookAt: (x, z, dist) => { worldRig.panTo({ x, z }, { instant: true }); if (dist) { worldRig.dist = dist; worldRig.apply(); } },
  localSites: () => currentLocalTile
    ? sitesFor(currentLocalTile).map(s => ({ id: s.id, name: s.name, type: s.type, actions: s.actions, cleared: s.cleared }))
    : [],
  visit: (q, r) => {   // headless tests: dive into a tile's local diorama
    const t = world.tiles.get(q + ',' + r);
    if (t && !t.void && mode === 'world') { enterLocal(t); return true; }
    return false;
  },
  act: (id, label) => {
    if (!currentLocalTile) return false;
    const site = sitesFor(currentLocalTile).find(s => s.id === id);
    if (site) handleAction(site, label, { disabled: false });
    return !!site;
  },
  smite: () => { for (const e of battle.enemies || []) if (!e.dead) e.hp = 1; },
  get skyEventState() {
    return skyEvent ? { id: skyEvent.def.id, phase: skyEvent.phase, idx: skyEvent.idx } : null;
  },
  startSkyEvent: () => { const def = skyDefFor(player.tile); if (def) startSkyEvent(def); return !!def; },
  advanceSkyEvent,
  shopOffers: (q, r) => {
    const t = world.tiles.get(q + ',' + r);
    if (!t) return null;
    const site = sitesFor(t).find(s => s.type === 'trader');
    if (!site) return null;
    site.offers ??= buildOffers(site, t);
    return site.offers.map(o => o.kind === 'item'
      ? { kind: 'item', id: o.item.id, rarity: o.item.rarity, price: o.price, sold: !!o.sold }
      : { kind: o.kind, id: o.id, price: o.price, stock: o.stock });
  },
  give: id => { import('./items.js').then(m => {
    const it = m.ITEMS.find(i => i.id === id);
    if (!it) return;
    run.addItem(it);
    player.setAppearance(run.appearance, run.appearanceSig);
    if (it.mutation && run.mutationCount >= 5) openWound();
    refreshHud(player.tile);
    saveNow(true);
  }); },
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
    worldRig.update(dt);           // no-ops while a sky event holds the camera
    updateSkyEvent(dt);
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
      ui.toast('The islands are joined only by narrow warded shallows. Grow strong, then challenge the wardens at the fords.', true);
    }
  }
}
loop();
