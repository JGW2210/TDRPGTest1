// Run persistence: a run survives page reloads (same seed), and dies with
// the wanderer. Stored per-seed in localStorage.

import { ITEMS } from './items.js';
import { run } from './run.js';
import { keyOf } from './hex.js';

const KEY = seed => `vaeldrift_run_${seed}`;
const VERSION = 8; // v8: the faller (arrival crater reshuffles worldgen again) + fallerArrived; older saves discarded

export function saveRun(world, player, worldView, roamers = null) {
  try {
    const data = {
      v: VERSION,
      items: run.items.map(i => i.id),
      consumables: run.consumables,
      shards: run.shards,
      hp: run.hp,
      vesselBonus: run.vesselBonus,
      shrineHeals: run.shrineHeals,
      boons: run.boons,
      shrineBoons: [...run.shrineBoons],
      vantageSeen: [...run.vantageSeen],
      skyChats: run.skyChats,
      keepsakes: run.keepsakes,
      questsDone: [...run.questsDone],
      revealedBridges: world.satellites.map((s, i) => s.revealed ? i : -1).filter(i => i >= 0),
      revealedIslets: world.islets.map((s, i) => s.revealed ? i : -1).filter(i => i >= 0),
      fallerArrived: run.fallerArrived,
      roamers: roamers ? roamers.serialize() : null,
      reviveUsed: run.reviveUsed,
      bossesDown: run.bossesDown,
      battlesWon: run.battlesWon,
      clearedSites: [...run.clearedSites],
      openedGates: [...run.openedGates],
      revealedSecrets: [...run.revealedSecrets],
      hexesVisited: [...run.hexesVisited],
      explored: [...worldView.explored],
      player: [player.tile.q, player.tile.r],
    };
    localStorage.setItem(KEY(world.seed), JSON.stringify(data));
  } catch { /* private mode or full storage: play on without saving */ }
}

export function loadRun(world) {
  try {
    const raw = localStorage.getItem(KEY(world.seed));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(seed) {
  try { localStorage.removeItem(KEY(seed)); } catch { /* ignore */ }
}

// Re-hydrate the run and world visuals from a saved snapshot.
// Returns the tile the player should stand on.
export function applySave(data, world, worldView, roamers = null) {
  for (const id of data.items) {
    const item = ITEMS.find(i => i.id === id);
    if (item) run.items.push(item);
  }
  run.boons = Array.isArray(data.boons) ? data.boons : [];
  run.vesselBonus = data.vesselBonus | 0;
  run._recompute();
  run.consumables = { charge: 0, dew: 0, feather: 0, ...data.consumables };
  run.shards = data.shards;
  run.shrineHeals = data.shrineHeals | 0;
  run.shrineBoons = new Set(data.shrineBoons || []);
  run.vantageSeen = new Set(data.vantageSeen || []);
  run.skyChats = data.skyChats || {};
  run.keepsakes = Array.isArray(data.keepsakes) ? data.keepsakes : [];
  run.questsDone = new Set(data.questsDone || []);
  for (const idx of data.revealedBridges || []) {
    if (world.revealBridge(idx)) {
      worldView.revealHiddenTiles(world.satellites[idx].bridgeTiles);
    }
  }
  for (const idx of data.revealedIslets || []) {
    if (world.revealIslet(idx)) {
      const isl = world.islets[idx];
      worldView.revealHiddenTiles([...isl.bridgeTiles, ...isl.tiles]);
    }
  }
  run.fallerArrived = !!data.fallerArrived;
  if (run.fallerArrived) {
    const ft = world.revealFaller();   // the landing already happened
    if (ft) {
      worldView.revealHiddenTiles(ft);
      worldView.buildEjectaFor([world.crashes[world.crashes.length - 1]]);
    }
  }
  if (roamers && data.roamers) roamers.restore(data.roamers);
  run.reviveUsed = !!data.reviveUsed;
  run.bossesDown = data.bossesDown | 0;
  run.battlesWon = data.battlesWon | 0;
  run.clearedSites = new Set(data.clearedSites);
  run.openedGates = new Set(data.openedGates);
  run.revealedSecrets = new Set(data.revealedSecrets);
  run.hexesVisited = new Set(data.hexesVisited);
  run.hp = Math.min(Math.max(1, data.hp), run.stats.maxHP);

  for (const k of data.openedGates) {
    const t = world.tiles.get(k);
    if (t?.gate) worldView.openGate(t);
  }
  for (const k of data.revealedSecrets) {
    const t = world.tiles.get(k);
    if (t?.secret) {
      world.revealSecret(t);
      worldView.revealSecretTile(t);
    }
  }
  worldView.explored = new Set(data.explored);

  const [q, r] = data.player || [];
  const tile = world.tiles.get(keyOf(q, r));
  return tile && !tile.void ? tile : world.start;
}
