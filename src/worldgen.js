// Procedural generation of Vaeldrift, run two: the disc is carved by void
// rifts into a spiderweb of region pockets joined only by boss-warded
// causeways; satellites orbit beyond the rim, reached by star-bridges from
// the astral shallows; sealed secret hexes hide in the void. Deterministic
// for a given seed.

import { CONFIG } from './config.js';
import { mulberry32, hash2, fbm } from './rng.js';
import { keyOf, axialToWorld, worldToAxial, discCoords, neighborsOf, hexDist, hexLine } from './hex.js';
import {
  BIOMES, KINGDOMS, DRIFTLAND_TOWNS, SATELLITES, dungeonName, wildName, regionName, wardenName,
  makeBattle, makeTrader, makeSide, capitalSites, townSites, dungeonSites,
} from './names.js';

const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
};

export function generateWorld(seed) {
  const R = CONFIG.mapRadius;
  const size = CONFIG.hexSize;
  const maxZ = size * 1.5 * R;
  const tiles = new Map();
  const list = [];

  const addTile = (q, r, props = {}) => {
    const { x, z } = axialToWorld(q, r, size);
    const t = {
      q, r, x, z, cDist: hexDist(q, r, 0, 0), void: false, biome: null,
      elev: 0.5, height: 1, floatY: 0, topY: 0, kingdom: null, landmark: null,
      name: '', region: -1, gate: null, secret: false, crackHint: false,
      ...props,
    };
    tiles.set(keyOf(q, r), t);
    list.push(t);
    return t;
  };

  // ---- pass 1: the main disc — terrain fields and natural voids ------------
  for (const [q, r] of discCoords(R)) {
    const t = addTile(q, r);
    const h = hash2(q, r, seed);

    // The Sun burns in a crater at the world's heart.
    if (t.cDist <= 2) { t.void = true; continue; }

    // a few natural rifts (region borders will add the real ones)
    const riftN = fbm(t.x * 0.085, t.z * 0.085, seed + 3311, 4);
    if (t.cDist > 6 && riftN > 0.72) { t.void = true; continue; }

    // the rim crumbles
    if (t.cDist >= R - 2) {
      const p = t.cDist === R ? 0.55 : t.cDist === R - 1 ? 0.32 : 0.15;
      if (h < p) { t.void = true; continue; }
    }

    let elev = fbm(t.x * 0.045, t.z * 0.045, seed + 101, 5);
    const angle = Math.atan2(t.z, t.x);
    const eastness = Math.max(0, Math.cos(angle));
    const midband = Math.exp(-((t.cDist / R - 0.55) ** 2) / 0.06);
    elev = elev * 0.82 + 0.22 * eastness * midband;
    elev *= 1 - 0.35 * Math.max(0, (t.cDist / R - 0.85) / 0.15);

    t.elev = elev;
    t.moist = fbm(t.x * 0.055, t.z * 0.055, seed + 202, 4);
    t.temp = (t.z / maxZ) * 1.15 + (fbm(t.x * 0.07, t.z * 0.07, seed + 303, 3) - 0.5) * 0.55;
    t.crystalN = fbm(t.x * 0.11, t.z * 0.11, seed + 404, 3);
  }

  // ---- pass 2: region seeds and jittered voronoi pockets -------------------
  const K = CONFIG.regions.count;
  const seeds = [];
  {
    const cands = list
      .filter(t => !t.void && t.cDist >= 5 && t.cDist <= R - 5)
      .sort((a, b) => hash2(b.q, b.r, seed + 500) - hash2(a.q, a.r, seed + 500));
    // seed 0: the pocket that holds the Sun and Starfall Vale
    let central = null, bestC = Infinity;
    for (const t of cands) if (t.cDist < bestC) { bestC = t.cDist; central = t; }
    seeds.push(central);
    for (const t of cands) {
      if (seeds.length >= K) break;
      if (seeds.every(s => hexDist(t.q, t.r, s.q, s.r) >= CONFIG.regions.seedSpacing)) seeds.push(t);
    }
  }

  const jitter = (t, i) =>
    (fbm(t.x * 0.09 + i * 37.7, t.z * 0.09 - i * 23.3, seed + 900 + i, 3) - 0.5) * 4.4;

  const barrierBest = new Map(); // "a-b" -> {tile, score}
  for (const t of list) {
    if (t.cDist <= 2) continue; // sun crater
    let d1 = Infinity, d2 = Infinity, r1 = -1, r2 = -1;
    for (let i = 0; i < seeds.length; i++) {
      const d = hexDist(t.q, t.r, seeds[i].q, seeds[i].r) + jitter(t, i);
      if (d < d1) { d2 = d1; r2 = r1; d1 = d; r1 = i; }
      else if (d < d2) { d2 = d; r2 = i; }
    }
    t.region = r1;
    if (t.void) continue;
    if (d2 - d1 < CONFIG.regions.riftWidth && t.cDist > 5) {
      t.void = true;
      const pairKey = Math.min(r1, r2) + '-' + Math.max(r1, r2);
      const score = d1 + d2;
      const prev = barrierBest.get(pairKey);
      if (!prev || score < prev.score) barrierBest.set(pairKey, { tile: t, score, a: Math.min(r1, r2), b: Math.max(r1, r2) });
    }
  }

  // ---- pass 3: biomes on surviving land ------------------------------------
  let volcano = null, volScore = -Infinity;
  for (const t of list) {
    if (t.void) continue;
    const a = Math.atan2(t.z, t.x);
    if (angleDiff(a, Math.PI) > 0.55) continue;
    if (t.cDist < 18 || t.cDist > 30) continue;
    const s = t.elev + hash2(t.q, t.r, seed + 7) * 0.35;
    if (s > volScore) { volScore = s; volcano = t; }
  }
  if (!volcano) volcano = list.find(t => !t.void && t.cDist > 15) || list.find(t => !t.void);

  for (const t of list) {
    if (t.void) continue;
    const dVol = hexDist(t.q, t.r, volcano.q, volcano.r);
    if (dVol <= 2) t.biome = 'VOLCANO';
    else if (dVol <= 4 && hash2(t.q, t.r, seed + 8) > 0.4) t.biome = 'VOLCANO';
    else if (t.cDist <= 4) t.biome = 'CRYSTAL';
    else if (t.elev > 0.70) t.biome = 'MOUNTAIN';
    else if (t.elev < 0.24) t.biome = 'SEA';
    else if (t.crystalN > 0.705) t.biome = 'CRYSTAL';
    else if (t.temp < -0.40) t.biome = 'TUNDRA';
    else if (t.temp > 0.40 && t.moist < 0.52) t.biome = 'DESERT';
    else if (t.moist > 0.565) t.biome = 'FOREST';
    else t.biome = 'MEADOW';
    applyHeight(t, seed, volcano);
  }

  // ---- pass 4: satellites beyond the rim -----------------------------------
  const worldR = Math.sqrt(3) * size * R;
  const satellites = SATELLITES.map((def, i) => {
    const cx = Math.cos(def.angle) * worldR * 1.22;
    const cz = Math.sin(def.angle) * worldR * 1.22;
    const { q: cq, r: cr } = worldToAxial(cx, cz, size);
    const satTiles = [];
    for (const [dq, dr] of discCoords(3)) {
      const q = cq + dq, r = cr + dr;
      if (tiles.has(keyOf(q, r))) continue;
      const t = addTile(q, r, {
        biome: def.biome, region: 100 + i,
        elev: 0.45 + hash2(q, r, seed + 21) * 0.2,
      });
      applyHeight(t, seed, volcano);
      satTiles.push(t);
    }
    const center = satTiles.reduce((best, t) =>
      (!best || hexDist(t.q, t.r, cq, cr) < hexDist(best.q, best.r, cq, cr)) ? t : best, null);
    center.landmark = { type: 'satboss', name: def.boss.name, satellite: def.id, tier: 4 };
    return { def, tiles: satTiles, center, cq, cr };
  });

  // ---- pass 5: star-bridges from the shallows to each satellite ------------
  for (const sat of satellites) {
    // nearest shore: prefer an astral-shallows tile facing the satellite
    let shore = null, shoreScore = Infinity;
    for (const t of list) {
      if (t.void || t.region >= 100 || !t.biome) continue;
      const d = hexDist(t.q, t.r, sat.cq, sat.cr);
      const score = d - (t.biome === 'SEA' ? 6 : 0);
      if (score < shoreScore) { shoreScore = score; shore = t; }
    }
    let landing = null, landScore = Infinity;
    for (const t of sat.tiles) {
      const d = hexDist(t.q, t.r, shore.q, shore.r);
      if (d < landScore) { landScore = d; landing = t; }
    }
    sat.shore = shore;
    for (const { q, r } of hexLine(shore.q, shore.r, landing.q, landing.r)) {
      const k = keyOf(q, r);
      let t = tiles.get(k);
      if (t && !t.void) continue;
      if (t && t.void) { t.void = false; }
      else t = addTile(q, r, { region: 100 + satellites.indexOf(sat) });
      t.biome = 'BRIDGE';
      t.elev = 0.3;
      applyHeight(t, seed, volcano);
    }
  }

  // ---- pass 6: start tile, causeways, gates, region tiers ------------------
  let start = null, startScore = -Infinity;
  for (const t of list) {
    if (t.void || t.region !== 0 || t.cDist < 4 || t.cDist > 9) continue;
    if (!['MEADOW', 'FOREST', 'CRYSTAL', 'DESERT', 'TUNDRA'].includes(t.biome)) continue;
    const s = (t.biome === 'MEADOW' ? 2 : 1) + hash2(t.q, t.r, seed + 11);
    if (s > startScore) { startScore = s; start = t; }
  }
  if (!start) start = list.find(t => !t.void && t.region === 0) || list.find(t => !t.void);

  // region metadata
  const regions = seeds.map((s, i) => ({
    id: i, seedTile: s, tier: Infinity, name: '', dominantBiome: 'MEADOW', tiles: [],
  }));
  for (const t of list) if (!t.void && t.region >= 0 && t.region < 100) regions[t.region]?.tiles.push(t);
  for (const reg of regions) {
    const counts = {};
    for (const t of reg.tiles) counts[t.biome] = (counts[t.biome] || 0) + 1;
    reg.dominantBiome = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'MEADOW';
  }

  // Choose which region pairs get causeways: a spanning tree (so everything
  // is reachable) plus a few extra cross-links for the spiderweb. Pairs
  // touching the start pocket are penalized so the web gains depth instead
  // of hubbing on home.
  const gates = [];
  const rngGates = mulberry32(seed + 3000);
  const chosenPairs = (() => {
    const pairs = [...barrierBest.values()]
      .map(p => ({ ...p, mstScore: p.score + ((p.a === 0 || p.b === 0) ? 7 : 0) }))
      .sort((x, y) => x.mstScore - y.mstScore);
    const parent = Array.from({ length: K }, (_, i) => i);
    const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const chosen = [];
    for (const p of pairs) {
      if (find(p.a) !== find(p.b)) { parent[find(p.a)] = find(p.b); chosen.push(p); }
    }
    let extras = 0;
    for (const p of pairs) {
      if (extras >= 3) break;
      if (chosen.includes(p) || p.a === 0 || p.b === 0) continue;
      chosen.push(p);
      extras++;
    }
    return chosen;
  })();
  for (const { tile: cross, a, b } of chosenPairs) {
    const nearLand = regionId => {
      let best = null, bestD = Infinity;
      for (const t of regions[regionId].tiles) {
        const d = hexDist(t.q, t.r, cross.q, cross.r);
        if (d < bestD) { bestD = d; best = t; }
      }
      return best;
    };
    const A = nearLand(a), B = nearLand(b);
    if (!A || !B || hexDist(A.q, A.r, B.q, B.r) > 12) continue;
    const line = hexLine(A.q, A.r, B.q, B.r);
    const carved = [];
    for (const { q, r } of line) {
      const t = tiles.get(keyOf(q, r));
      if (t && t.void && t.cDist > 2) {
        t.void = false;
        t.biome = 'ROAD';
        t.elev = 0.4;
        applyHeight(t, seed, volcano);
        carved.push(t);
      }
    }
    if (!carved.length) continue;
    const gateTile = carved[Math.floor(carved.length / 2)];
    gateTile.gate = { pair: [a, b], open: false };
    gates.push(gateTile);
  }

  // region tiers = causeway-graph distance from the start's pocket
  {
    const adj = new Map();
    for (const g of gates) {
      const [a, b] = g.gate.pair;
      (adj.get(a) ?? adj.set(a, []).get(a)).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)).push(a);
    }
    regions[0].tier = 0;
    const queue = [0];
    while (queue.length) {
      const cur = queue.shift();
      for (const nb of adj.get(cur) || []) {
        if (regions[nb].tier > regions[cur].tier + 1) {
          regions[nb].tier = regions[cur].tier + 1;
          queue.push(nb);
        }
      }
    }
    const usedNames = new Set();
    for (const reg of regions) {
      if (!Number.isFinite(reg.tier)) reg.tier = 3; // orphaned pocket fallback
      const rngN = mulberry32(seed + 41 + reg.id);
      let tries = 0;
      do { reg.name = regionName(rngN, reg.dominantBiome); } while (usedNames.has(reg.name) && ++tries < 8);
      usedNames.add(reg.name);
    }
    for (const g of gates) {
      const [a, b] = g.gate.pair;
      const deep = regions[a].tier >= regions[b].tier ? regions[a] : regions[b];
      g.gate.tier = Math.max(1, deep.tier);
      g.gate.into = deep.id;
      g.gate.biome = deep.dominantBiome;
      g.gate.name = wardenName(rngGates, deep.dominantBiome, g.gate.tier);
      g.landmark = { type: 'gate', name: g.gate.name, tier: g.gate.tier };
    }
  }

  // ---- pass 7: connectivity (gates count as passable) ----------------------
  {
    const reached = new Set([keyOf(start.q, start.r)]);
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop();
      for (const [nq, nr] of neighborsOf(cur.q, cur.r)) {
        const k = keyOf(nq, nr);
        const n = tiles.get(k);
        if (n && !n.void && !reached.has(k)) { reached.add(k); stack.push(n); }
      }
    }
    for (const t of list) if (!t.void && !reached.has(keyOf(t.q, t.r))) t.void = true;
  }
  const land = list.filter(t => !t.void);

  // ---- pass 8: the four Celestial Courts (flavor layer) --------------------
  const kingdoms = KINGDOMS.map(k => ({ ...k, capitalTile: null, townTiles: [] }));
  for (const k of kingdoms) {
    let best = null, bestScore = -Infinity;
    for (const t of land) {
      if (t.region >= 100 || t.biome === 'SEA' || t.biome === 'ROAD' || t.biome === 'BRIDGE' || t.landmark) continue;
      const a = Math.atan2(t.z, t.x);
      if (angleDiff(a, k.angle) > 0.6) continue;
      if (t.cDist < 18 || t.cDist > 34) continue;
      const s = (k.biomes.includes(t.biome) ? 2.2 : 0) - Math.abs(t.cDist - 25) * 0.08 + hash2(t.q, t.r, seed + 21);
      if (s > bestScore) { bestScore = s; best = t; }
    }
    if (!best) best = land.find(t => t.region < 100 && !t.landmark && t.biome !== 'ROAD');
    k.capitalTile = best;
    best.landmark = { type: 'capital', name: k.capital, kingdom: k.id };
  }
  for (const t of land) {
    if (t.region >= 100) continue;
    let bestK = null, bestD = Infinity;
    for (const k of kingdoms) {
      const d = hexDist(t.q, t.r, k.capitalTile.q, k.capitalTile.r);
      if (d < bestD) { bestD = d; bestK = k; }
    }
    if (bestD <= 10 + (hash2(t.q, t.r, seed + 22) - 0.5) * 3) t.kingdom = bestK.id;
  }
  for (const k of kingdoms) k.capitalTile.kingdom = k.id;

  // ---- pass 9: settlements, dungeons, shrines ------------------------------
  const settlements = kingdoms.map(k => k.capitalTile);
  const rngTowns = mulberry32(seed + 31);
  const placeable = t => !t.landmark && !t.gate && t.region < 100
    && !['SEA', 'ROAD', 'BRIDGE'].includes(t.biome);
  for (const k of kingdoms) {
    const names = [...k.towns].sort(() => rngTowns() - 0.5);
    const cands = land
      .filter(t => t.kingdom === k.id && placeable(t)
        && hexDist(t.q, t.r, k.capitalTile.q, k.capitalTile.r) >= 3
        && hexDist(t.q, t.r, k.capitalTile.q, k.capitalTile.r) <= 9)
      .sort((a, b) => hash2(b.q, b.r, seed + 32) - hash2(a.q, a.r, seed + 32));
    for (const t of cands) {
      if (k.townTiles.length >= 3) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 4)) continue;
      t.landmark = { type: 'town', name: names[k.townTiles.length], kingdom: k.id };
      k.townTiles.push(t);
      settlements.push(t);
    }
  }
  start.landmark = { type: 'town', name: DRIFTLAND_TOWNS[0], kingdom: null };
  settlements.push(start);
  {
    let placed = 1;
    const cands = land
      .filter(t => !t.kingdom && placeable(t) && t.cDist >= 8 && t.cDist <= 40)
      .sort((a, b) => hash2(b.q, b.r, seed + 33) - hash2(a.q, a.r, seed + 33));
    for (const t of cands) {
      if (placed >= DRIFTLAND_TOWNS.length) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 8)) continue;
      t.landmark = { type: 'town', name: DRIFTLAND_TOWNS[placed++], kingdom: null };
      settlements.push(t);
    }
  }

  const dungeons = [];
  {
    const rng = mulberry32(seed + 41);
    const perBiome = {};
    const cands = land
      .filter(t => placeable(t) && t.cDist >= 6)
      .sort((a, b) => hash2(b.q, b.r, seed + 42) - hash2(a.q, a.r, seed + 42));
    for (const t of cands) {
      if (dungeons.length >= 10) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 4)) continue;
      if (dungeons.some(d => hexDist(t.q, t.r, d.q, d.r) < 6)) continue;
      if ((perBiome[t.biome] || 0) >= 2) continue;
      perBiome[t.biome] = (perBiome[t.biome] || 0) + 1;
      t.landmark = { type: 'dungeon', name: dungeonName(rng, t.biome), kingdom: t.kingdom };
      dungeons.push(t);
    }
  }

  const shrines = [];
  {
    const cands = land
      .filter(t => placeable(t))
      .sort((a, b) => hash2(b.q, b.r, seed + 51) - hash2(a.q, a.r, seed + 51));
    for (const t of cands) {
      if (shrines.length >= 12) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 3)) continue;
      if (shrines.some(s => hexDist(t.q, t.r, s.q, s.r) < 5)) continue;
      if (dungeons.some(d => hexDist(t.q, t.r, d.q, d.r) < 3)) continue;
      t.landmark = { type: 'shrine', name: 'Wayshrine', kingdom: t.kingdom };
      shrines.push(t);
    }
  }

  // ---- pass 10: sealed secret hexes ----------------------------------------
  const secrets = [];
  {
    const cands = list
      .filter(t => t.void && t.cDist > 5 && t.cDist < R - 1)
      .sort((a, b) => hash2(b.q, b.r, seed + 61) - hash2(a.q, a.r, seed + 61));
    for (const v of cands) {
      if (secrets.length >= CONFIG.secrets.count) break;
      const nbs = neighborsOf(v.q, v.r).map(([q, r]) => tiles.get(keyOf(q, r))).filter(Boolean);
      const landNbs = nbs.filter(n => !n.void);
      if (landNbs.length < 1 || landNbs.length > 4) continue;
      // never breach a rift between two different regions
      const regs = new Set(landNbs.map(n => n.region));
      if (regs.size !== 1) continue;
      if (landNbs.some(n => n.landmark || n.gate)) continue;
      if (secrets.some(s => hexDist(s.q, s.r, v.q, v.r) < 7)) continue;
      v.secret = true;
      v.region = landNbs[0].region;
      secrets.push(v);
      for (const n of landNbs) n.crackHint = true;
    }
  }

  // ---- pass 11: wandering traders ------------------------------------------
  const traders = [];
  {
    const cands = land
      .filter(t => placeable(t) && t.cDist >= 5 && t.cDist <= 30)
      .sort((a, b) => hash2(b.q, b.r, seed + 71) - hash2(a.q, a.r, seed + 71));
    for (const t of cands) {
      if (traders.length >= 3) break;
      if (traders.some(o => hexDist(t.q, t.r, o.tile.q, o.tile.r) < 12)) continue;
      traders.push({ tile: t });
    }
  }

  // ---- names ---------------------------------------------------------------
  for (const t of land) {
    if (t.landmark) t.name = t.landmark.name;
    else if (t.biome === 'ROAD') t.name = 'Warded Causeway';
    else if (t.biome === 'BRIDGE') t.name = 'Star-Bridge';
    else t.name = wildName(mulberry32(Math.floor(hash2(t.q, t.r, seed + 81) * 0xffffffff)), t.biome);
  }

  // ---- per-hex explorable sites (lazy, deterministic, sparser) -------------
  const siteCache = new Map();
  const kingdomById = Object.fromEntries(kingdoms.map(k => [k.id, k]));
  const regionOf = t => t.region >= 100
    ? { id: t.region, tier: 4, name: SATELLITES[t.region - 100]?.name || 'The Deep Sky', dominantBiome: t.biome }
    : regions[t.region] || regions[0];

  function getSites(tile) {
    const k = keyOf(tile.q, tile.r);
    if (siteCache.has(k)) return siteCache.get(k);
    const rng = mulberry32(Math.floor(hash2(tile.q, tile.r, seed + 91) * 0xffffffff));
    const tier = regionOf(tile).tier;
    let sites = [];
    const lm = tile.landmark;

    const battleSite = (extraTier = 0, boss = false) => {
      const b = makeBattle(rng, tile.biome in BIOMES ? tile.biome : 'MEADOW');
      b.team = { biome: tile.biome, tier: tier + extraTier, count: 1 + (rng() < 0.4 ? 1 : 0) + (tier >= 3 && rng() < 0.4 ? 1 : 0), boss };
      return b;
    };
    const pedestalSite = pool => ({
      type: 'pedestal', subtype: 'pedestal',
      name: 'Waiting Pedestal',
      pool,
      flavor: 'A rune-carved column holds a single gift, face-down in folded light. The pedestal does not explain itself. Pedestals never do.',
      actions: ['Claim the Gift'],
    });

    if (lm?.type === 'capital') {
      sites = capitalSites(rng, kingdomById[lm.kingdom]);
      sites[2].team = { biome: tile.biome, tier: tier + 1, count: 1, boss: false, arena: true };
      sites[3] = pedestalSite('BOSS'); // the Royal Reliquary yields a relic
      sites[3].name = 'Royal Reliquary';
    } else if (lm?.type === 'town') {
      sites = townSites(rng, lm.name);
      sites[2].team = { biome: tile.biome, tier, count: 1 + (rng() < 0.5 ? 1 : 0), boss: false };
    } else if (lm?.type === 'dungeon') {
      sites = dungeonSites(rng, lm);
      sites[1].team = { biome: tile.biome, tier: tier + 1, count: 2, boss: false };
      sites[2] = pedestalSite(tile.biome in BIOMES && ITEM_POOLS.has(tile.biome) ? tile.biome : 'ANY');
      sites[2].name = 'Vault Antechamber';
    } else if (lm?.type === 'shrine') {
      sites = [makeSide(rng), battleSite()];
      sites[0].subtype = 'shrine';
    } else if (lm?.type === 'satboss') {
      const def = SATELLITES.find(s => s.id === lm.satellite);
      sites = [{
        type: 'battle', subtype: 'boss', name: def.boss.name, enemy: def.boss.name,
        flavor: def.boss.flavor,
        actions: ['⚔ Challenge'],
        team: { biome: tile.biome, tier: 4, count: 1, boss: true, satellite: def.id, bossName: def.boss.name },
      }, pedestalSite('ASTRAL')];
    } else if (tile.biome === 'ROAD') {
      sites = rng() < 0.3 ? [battleSite()] : [];
    } else if (tile.biome === 'BRIDGE') {
      sites = rng() < 0.35 ? [battleSite(1)] : [];
    } else if (tile.secretRevealed) {
      const roll = rng();
      if (roll < CONFIG.secrets.pedestalChance) sites = [pedestalSite(pickPoolFor(tile, regionOf(tile)))];
      else if (roll < CONFIG.secrets.pedestalChance + CONFIG.secrets.cacheChance) {
        sites = [{
          type: 'side', subtype: 'cache', name: 'Sealed Shard-Cache',
          flavor: 'Someone hid this hoard inside the world itself and never came back for it. Their loss is arithmetic now.',
          actions: ['Open the Cache'], cacheShards: 14 + Math.floor(rng() * 10) + tier * 4,
        }];
      } else {
        sites = [{
          type: 'side', subtype: 'cache', name: 'Smuggler’s Powder Keg',
          flavor: 'Crates of star-charges and a note: "do NOT stack near the dew." The dew is stacked near it.',
          actions: ['Open the Cache'], cacheConsumables: { charge: 2, dew: 1 },
        }];
      }
    } else {
      // wilderness: sparse and purposeful — many hexes hold nothing at all
      if (hash2(tile.q, tile.r, seed + 92) < (tile.region >= 100 ? 0.6 : 0.45)) {
        sites.push(battleSite());
        if (rng() < 0.18) sites.push(pedestalSite(pickPoolFor(tile, regionOf(tile))));
        if (rng() < 0.3) sites.push(makeSide(rng));
        if (rng() < 0.25) sites.push(makeSide(rng));
      }
    }
    if (lm && sites.length < 5 && rng() < 0.5) sites.push(makeSide(rng));
    sites.forEach((s, i) => { s.id = k + ':' + i; });
    siteCache.set(k, sites);
    return sites;
  }

  const ITEM_POOLS = new Set(['MEADOW', 'FOREST', 'MOUNTAIN', 'VOLCANO', 'DESERT', 'TUNDRA', 'SEA', 'CRYSTAL']);
  function pickPoolFor(tile, region) {
    if (ITEM_POOLS.has(tile.biome)) return tile.biome;
    if (ITEM_POOLS.has(region.dominantBiome)) return region.dominantBiome;
    return 'ANY';
  }

  return {
    seed, tiles, list, land, start, volcano,
    kingdoms, kingdomById, dungeons, shrines, traders,
    regions, regionOf, gates, satellites, secrets,
    sun: { name: 'Vael, the Undying Sun', flavor: 'The world’s heart, still burning in its crater of sky.' },
    getSites,
    revealSecret(v) {
      v.void = false;
      v.secret = false;
      v.secretRevealed = true;
      v.biome = 'SECRET';
      v.elev = 0.5;
      applyHeight(v, seed, volcano);
      v.name = 'Hollowed Secret';
      if (!land.includes(v)) land.push(v);
    },
  };
}

function applyHeight(t, seed, volcano) {
  let hgt = 0.55 + t.elev * 2.4;
  if (t.biome === 'SEA') hgt = 0.5;
  if (t.biome === 'MOUNTAIN') hgt += 0.9;
  if (t.biome === 'VOLCANO') hgt += 0.6 + (volcano && t === volcano ? 0.9 : 0);
  if (t.biome === 'ROAD') hgt = 0.85;
  if (t.biome === 'BRIDGE') hgt = 0.4;
  if (t.biome === 'SECRET') hgt = 1.1;
  t.height = hgt;
  t.floatY = (hash2(t.q, t.r, seed + 9) - 0.5) * 0.22;
  if (t.biome === 'BRIDGE') t.floatY += Math.sin(t.cDist * 0.7) * 0.3;
  t.topY = t.floatY + t.height;
}
