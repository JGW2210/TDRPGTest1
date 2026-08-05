// Procedural generation of Vaeldrift: a shattered hexagonal disc of floating
// tiles — biomes, rifts, the four Celestial Courts, towns, dungeons, shrines,
// and per-hex explorable sites. Fully deterministic for a given seed.

import { CONFIG } from './config.js';
import { mulberry32, hash2, fbm } from './rng.js';
import { keyOf, axialToWorld, discCoords, neighborsOf, hexDist } from './hex.js';
import {
  BIOMES, KINGDOMS, DRIFTLAND_TOWNS, dungeonName, wildName,
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

  // ---- pass 1: terrain fields, voids, biomes ------------------------------
  for (const [q, r] of discCoords(R)) {
    const { x, z } = axialToWorld(q, r, size);
    const cDist = hexDist(q, r, 0, 0);
    const angle = Math.atan2(z, x);
    const h = hash2(q, r, seed);

    // The Hollow Star rift at the world's heart.
    let isVoid = cDist <= 1;

    // Rifts of shattered nothing wandering through the disc.
    const riftN = fbm(x * 0.085, z * 0.085, seed + 3311, 4);
    if (!isVoid && cDist > 5 && riftN > 0.665) isVoid = true;

    // The disc's rim crumbles away into the astral sea below.
    if (!isVoid && cDist >= R - 2) {
      const p = cDist === R ? 0.55 : cDist === R - 1 ? 0.32 : 0.15;
      if (h < p) isVoid = true;
    }

    const tile = { q, r, x, z, cDist, void: isVoid, biome: null, elev: 0, height: 1, floatY: 0, topY: 0, kingdom: null, landmark: null, name: '' };
    tiles.set(keyOf(q, r), tile);
    list.push(tile);
    if (isVoid) continue;

    // Elevation with an eastward ridge (the Cometborne mountains).
    let elev = fbm(x * 0.055, z * 0.055, seed + 101, 5);
    const eastness = Math.max(0, Math.cos(angle));
    const midband = Math.exp(-((cDist / R - 0.55) ** 2) / 0.06);
    elev = elev * 0.82 + 0.22 * eastness * midband;
    elev *= 1 - 0.35 * Math.max(0, (cDist / R - 0.85) / 0.15); // rim sinks

    const moist = fbm(x * 0.07, z * 0.07, seed + 202, 4);
    const temp = (z / maxZ) * 1.15 + (fbm(x * 0.09, z * 0.09, seed + 303, 3) - 0.5) * 0.55;
    const crystalN = fbm(x * 0.14, z * 0.14, seed + 404, 3);

    tile.elev = elev;
    tile.moist = moist;
    tile.temp = temp;
    tile.crystalN = crystalN;
  }

  // ---- volcano placement (western reaches, for the Umbral Choir) ----------
  let volcano = null, volScore = -Infinity;
  for (const t of list) {
    if (t.void) continue;
    const a = Math.atan2(t.z, t.x);
    if (angleDiff(a, Math.PI) > 0.55) continue;
    if (t.cDist < 12 || t.cDist > 19) continue;
    const s = t.elev + hash2(t.q, t.r, seed + 7) * 0.35;
    if (s > volScore) { volScore = s; volcano = t; }
  }
  // (a fallback for absurd seeds where the whole west is void)
  if (!volcano) volcano = list.find(t => !t.void && t.cDist > 10) || list[0];

  for (const t of list) {
    if (t.void) continue;
    const dVol = hexDist(t.q, t.r, volcano.q, volcano.r);
    if (dVol <= 2) t.biome = 'VOLCANO';
    else if (dVol <= 4 && hash2(t.q, t.r, seed + 8) > 0.4) t.biome = 'VOLCANO';
    else if (t.cDist <= 2) t.biome = 'CRYSTAL';
    else if (t.elev > 0.70) t.biome = 'MOUNTAIN';
    else if (t.elev < 0.24) t.biome = 'SEA';
    else if (t.crystalN > 0.705) t.biome = 'CRYSTAL';
    else if (t.temp < -0.40) t.biome = 'TUNDRA';
    else if (t.temp > 0.40 && t.moist < 0.52) t.biome = 'DESERT';
    else if (t.moist > 0.565) t.biome = 'FOREST';
    else t.biome = 'MEADOW';

    // Prism heights: seas sit low, peaks and the caldera rise.
    let hgt = 0.55 + t.elev * 2.4;
    if (t.biome === 'SEA') hgt = 0.5;
    if (t.biome === 'MOUNTAIN') hgt += 0.9;
    if (t.biome === 'VOLCANO') hgt += 0.6 + (hexDist(t.q, t.r, volcano.q, volcano.r) === 0 ? 0.9 : 0);
    t.height = hgt;
    t.floatY = (hash2(t.q, t.r, seed + 9) - 0.5) * 0.22;
    t.topY = t.floatY + t.height;
  }

  // ---- start tile: Starfall Vale, near the Hollow Star --------------------
  let start = null, startScore = -Infinity;
  for (const t of list) {
    if (t.void || t.cDist < 3 || t.cDist > 6) continue;
    if (t.biome === 'SEA' || t.biome === 'VOLCANO' || t.biome === 'MOUNTAIN') continue;
    const s = (t.biome === 'MEADOW' ? 2 : t.biome === 'FOREST' ? 1 : 0) + hash2(t.q, t.r, seed + 11);
    if (s > startScore) { startScore = s; start = t; }
  }
  if (!start) start = list.find(t => !t.void && t.cDist >= 3);

  // ---- connectivity: unreachable pockets fall into the rift ---------------
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
    for (const t of list) {
      if (!t.void && !reached.has(keyOf(t.q, t.r))) t.void = true;
    }
  }
  const land = list.filter(t => !t.void);

  // ---- the four Celestial Courts ------------------------------------------
  const kingdoms = KINGDOMS.map(k => ({ ...k, capitalTile: null, townTiles: [] }));
  for (const k of kingdoms) {
    let best = null, bestScore = -Infinity;
    for (const t of land) {
      const a = Math.atan2(t.z, t.x);
      if (angleDiff(a, k.angle) > 0.6) continue;
      if (t.cDist < 12 || t.cDist > 21) continue;
      if (t.biome === 'SEA') continue;
      const s = (k.biomes.includes(t.biome) ? 2.2 : 0) - Math.abs(t.cDist - 16) * 0.12 + hash2(t.q, t.r, seed + 21);
      if (s > bestScore) { bestScore = s; best = t; }
    }
    if (!best) best = land.reduce((acc, t) => { // pathological fallback
      const s = -angleDiff(Math.atan2(t.z, t.x), k.angle);
      return !acc || s > acc.s ? { t, s } : acc;
    }, null).t;
    k.capitalTile = best;
    best.landmark = { type: 'capital', name: k.capital, kingdom: k.id };
  }

  // territory: banner-glow of the nearest court, if close enough
  for (const t of land) {
    let bestK = null, bestD = Infinity;
    for (const k of kingdoms) {
      const d = hexDist(t.q, t.r, k.capitalTile.q, k.capitalTile.r);
      if (d < bestD) { bestD = d; bestK = k; }
    }
    if (bestD <= 8 + (hash2(t.q, t.r, seed + 22) - 0.5) * 3) t.kingdom = bestK.id;
  }
  for (const k of kingdoms) k.capitalTile.kingdom = k.id;

  // ---- towns ---------------------------------------------------------------
  const settlements = kingdoms.map(k => k.capitalTile);
  const rngTowns = mulberry32(seed + 31);
  for (const k of kingdoms) {
    const names = [...k.towns].sort(() => rngTowns() - 0.5);
    const cands = land
      .filter(t => t.kingdom === k.id && !t.landmark && t.biome !== 'SEA'
        && hexDist(t.q, t.r, k.capitalTile.q, k.capitalTile.r) >= 3
        && hexDist(t.q, t.r, k.capitalTile.q, k.capitalTile.r) <= 8)
      .sort((a, b) => hash2(b.q, b.r, seed + 32) - hash2(a.q, a.r, seed + 32));
    for (const t of cands) {
      if (k.townTiles.length >= 3) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 3)) continue;
      t.landmark = { type: 'town', name: names[k.townTiles.length], kingdom: k.id };
      k.townTiles.push(t);
      settlements.push(t);
    }
  }
  // free towns of the Driftlands — the first is Starfall Vale, where you wake
  start.landmark = { type: 'town', name: DRIFTLAND_TOWNS[0], kingdom: null };
  settlements.push(start);
  {
    let placed = 1;
    const cands = land
      .filter(t => !t.kingdom && !t.landmark && t.biome !== 'SEA' && t.cDist >= 6 && t.cDist <= 26)
      .sort((a, b) => hash2(b.q, b.r, seed + 33) - hash2(a.q, a.r, seed + 33));
    for (const t of cands) {
      if (placed >= DRIFTLAND_TOWNS.length) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 6)) continue;
      t.landmark = { type: 'town', name: DRIFTLAND_TOWNS[placed++], kingdom: null };
      settlements.push(t);
    }
  }

  // ---- dungeons ------------------------------------------------------------
  const dungeons = [];
  {
    const rng = mulberry32(seed + 41);
    const perBiome = {};
    const cands = land
      .filter(t => !t.landmark && t.cDist >= 4)
      .sort((a, b) => hash2(b.q, b.r, seed + 42) - hash2(a.q, a.r, seed + 42));
    for (const t of cands) {
      if (dungeons.length >= 12) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 3)) continue;
      if (dungeons.some(d => hexDist(t.q, t.r, d.q, d.r) < 4)) continue;
      if ((perBiome[t.biome] || 0) >= 3) continue;
      perBiome[t.biome] = (perBiome[t.biome] || 0) + 1;
      t.landmark = { type: 'dungeon', name: dungeonName(rng, t.biome), kingdom: t.kingdom };
      dungeons.push(t);
    }
  }

  // ---- minor shrines -------------------------------------------------------
  const shrines = [];
  {
    const cands = land
      .filter(t => !t.landmark && t.biome !== 'SEA')
      .sort((a, b) => hash2(b.q, b.r, seed + 51) - hash2(a.q, a.r, seed + 51));
    for (const t of cands) {
      if (shrines.length >= 14) break;
      if (settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 2)) continue;
      if (shrines.some(s => hexDist(t.q, t.r, s.q, s.r) < 3)) continue;
      if (dungeons.some(d => hexDist(t.q, t.r, d.q, d.r) < 2)) continue;
      t.landmark = { type: 'shrine', name: 'Wayshrine', kingdom: t.kingdom };
      shrines.push(t);
    }
  }

  // ---- wandering traders ---------------------------------------------------
  const traders = [];
  {
    const cands = land
      .filter(t => !t.landmark && t.biome !== 'SEA' && t.cDist >= 4 && t.cDist <= 20)
      .sort((a, b) => hash2(b.q, b.r, seed + 61) - hash2(a.q, a.r, seed + 61));
    for (const t of cands) {
      if (traders.length >= 3) break;
      if (traders.some(o => hexDist(t.q, t.r, o.tile.q, o.tile.r) < 8)) continue;
      traders.push({ tile: t });
    }
  }

  // ---- names ---------------------------------------------------------------
  for (const t of land) {
    if (t.landmark) t.name = t.landmark.name;
    else t.name = wildName(mulberry32(Math.floor(hash2(t.q, t.r, seed + 71) * 0xffffffff)), t.biome);
  }

  // ---- per-hex explorable sites (lazy, deterministic) ----------------------
  const siteCache = new Map();
  const kingdomById = Object.fromEntries(kingdoms.map(k => [k.id, k]));

  function getSites(tile) {
    const k = keyOf(tile.q, tile.r);
    if (siteCache.has(k)) return siteCache.get(k);
    const rng = mulberry32(Math.floor(hash2(tile.q, tile.r, seed + 81) * 0xffffffff));
    let sites = [];
    const lm = tile.landmark;
    if (lm?.type === 'capital') sites = capitalSites(rng, kingdomById[lm.kingdom]);
    else if (lm?.type === 'town') sites = townSites(rng, lm.name);
    else if (lm?.type === 'dungeon') sites = dungeonSites(rng, lm);
    else if (lm?.type === 'shrine') {
      sites = [makeSide(rng), makeBattle(rng, tile.biome)];
      sites[0].subtype = 'shrine';
    } else {
      const nBattles = 1 + (rng() < 0.4 ? 1 : 0);
      for (let i = 0; i < nBattles; i++) sites.push(makeBattle(rng, tile.biome));
      if (rng() < 0.3) sites.push(makeTrader(rng, 1, null));
      const nSide = 2 + (rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < nSide; i++) sites.push(makeSide(rng));
    }
    // one wildcard so even landmark hexes have a surprise
    if (sites.length < 6 && rng() < 0.65) sites.push(makeSide(rng));
    sites.forEach((s, i) => { s.id = k + ':' + i; });
    siteCache.set(k, sites);
    return sites;
  }

  return {
    seed, tiles, list, land, start, volcano,
    kingdoms, kingdomById, dungeons, shrines, traders,
    wonder: { name: 'The Hollow Star', flavor: 'The extinguished heart of the world, still turning.' },
    getSites,
  };
}
