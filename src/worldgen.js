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
  NEBULA_NAMES, nebulaSites, DEITY, WOUND_WHISPERS, ISLETS,
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

    // Quadrant climates: the four Courts pull the weather to their compass
    // points — deserts gather south, tundra north, high stone east (the
    // volcano keeps the west) — while the world's heart stays a gentle vale.
    let elev = fbm(t.x * 0.045, t.z * 0.045, seed + 101, 5);
    const angle = Math.atan2(t.z, t.x);
    const eastness = Math.max(0, Math.cos(angle));
    const midband = Math.exp(-((t.cDist / R - 0.55) ** 2) / 0.09);
    elev = elev * 0.72 + 0.34 * eastness * midband;
    elev *= 1 - 0.35 * Math.max(0, (t.cDist / R - 0.85) / 0.15);

    let moist = fbm(t.x * 0.055, t.z * 0.055, seed + 202, 4);
    let temp = (t.z / maxZ) * 1.45 + (fbm(t.x * 0.07, t.z * 0.07, seed + 303, 3) - 0.5) * 0.38;

    // the homeland: no glass dunes or glacier bleeding into Starfall Vale
    const home = t.cDist <= 4 ? 1 : Math.max(0, 1 - (t.cDist - 4) / 9);
    if (home > 0) {
      temp *= 1 - 0.8 * home;
      moist += (0.5 - moist) * 0.55 * home;
      elev += (0.42 - elev) * 0.5 * home;
    }

    t.elev = elev;
    t.moist = moist;
    t.temp = temp;
    t.crystalN = fbm(t.x * 0.11, t.z * 0.11, seed + 404, 3) + eastness * 0.03;
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
    if (d2 - d1 < CONFIG.regions.riftWidth && t.cDist > 5) {
      // record the crossing even when the tile was already natural void —
      // otherwise a region ringed by natural rifts gets no causeway at all
      t.void = true;
      const pairKey = Math.min(r1, r2) + '-' + Math.max(r1, r2);
      const score = d1 + d2;
      const prev = barrierBest.get(pairKey);
      if (!prev || score < prev.score) barrierBest.set(pairKey, { tile: t, score, a: Math.min(r1, r2), b: Math.max(r1, r2) });
    }
  }

  // ---- pass 2.5: archipelago erosion ---------------------------------------
  // The rifts alone leave the pockets reading as slabs. Clumped noise gnaws
  // at every coastline — bays, fjords, ragged headlands — so each region
  // reads as a true island in the web, not a tile of a broken plate.
  {
    const thresholds = CONFIG.archipelago.erosion;
    for (let pass = 0; pass < thresholds.length; pass++) {
      const doomed = [];
      for (const t of list) {
        if (t.void || t.cDist <= 6) continue;
        const coastal = neighborsOf(t.q, t.r).some(([q, r]) => {
          const n = tiles.get(keyOf(q, r));
          return !n || n.void;
        });
        if (!coastal) continue;
        const n = fbm(t.x * 0.14 + pass * 9.1, t.z * 0.14 - pass * 7.3, seed + 2600 + pass, 3);
        if (n > thresholds[pass]) doomed.push(t);
      }
      for (const t of doomed) t.void = true;
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

  // ---- pass 3.2: speckle purge ---------------------------------------------
  // A lone desert hex in a meadow (or one meadow tile high in the tundra) is
  // noise, not terrain. Any tile out of step with its neighbourhood adopts
  // the local majority, so biomes arrive as contiguous sweeps.
  {
    const purgeable = new Set(['MEADOW', 'FOREST', 'MOUNTAIN', 'DESERT', 'TUNDRA', 'CRYSTAL', 'SEA', 'VOLCANO']);
    for (let iter = 0; iter < 2; iter++) {
      const changes = [];
      for (const t of list) {
        if (t.void || !purgeable.has(t.biome)) continue;
        if (t.cDist <= 4) continue;                                     // crater ring stands
        if (hexDist(t.q, t.r, volcano.q, volcano.r) <= 2) continue;     // the volcano stands
        const counts = {};
        let same = 0, n = 0;
        for (const [nq, nr] of neighborsOf(t.q, t.r)) {
          const nb = tiles.get(keyOf(nq, nr));
          if (!nb || nb.void) continue;
          n++;
          counts[nb.biome] = (counts[nb.biome] || 0) + 1;
          if (nb.biome === t.biome) same++;
        }
        if (n < 3 || same >= 2) continue;
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (top[1] >= 3 && purgeable.has(top[0])) changes.push([t, top[0]]);
      }
      for (const [t, b] of changes) { t.biome = b; applyHeight(t, seed, volcano); }
      if (!changes.length) break;
    }
  }

  // ---- pass 3.5: shallows-rivers and nebulas -------------------------------
  // The astral shallows no longer pool only in basins: winding rivers of
  // starlit water run out of the great lakes and through the regions (never
  // across a rift). The largest lakes cradle nebulas — named, visitable.
  const seaComponents = () => {
    const seen = new Set();
    const comps = [];
    for (const t of list) {
      if (t.void || t.biome !== 'SEA' || t.region >= 100 || seen.has(keyOf(t.q, t.r))) continue;
      const comp = [t];
      seen.add(keyOf(t.q, t.r));
      for (let i = 0; i < comp.length; i++) {
        for (const [nq, nr] of neighborsOf(comp[i].q, comp[i].r)) {
          const k = keyOf(nq, nr);
          const n = tiles.get(k);
          if (n && !n.void && n.biome === 'SEA' && n.region < 100 && !seen.has(k)) {
            seen.add(k);
            comp.push(n);
          }
        }
      }
      comps.push(comp);
    }
    return comps.sort((a, b) => b.length - a.length);
  };
  {
    const rngRiver = mulberry32(seed + 4100);
    const lakes = seaComponents();
    for (const lake of lakes.slice(0, 4)) {
      if (lake.length < 6) break;
      let cur = lake[Math.floor(rngRiver() * lake.length)];
      let dir = rngRiver() * Math.PI * 2;
      for (let step = 0; step < 24; step++) {
        dir += (fbm(cur.x * 0.13, cur.z * 0.13, seed + 4200, 3) - 0.5) * 1.7;
        const nbs = neighborsOf(cur.q, cur.r)
          .map(([q, r]) => tiles.get(keyOf(q, r)))
          .filter(n => n && !n.void && n.region === cur.region && n.region < 100
            && !['ROAD', 'BRIDGE', 'VOLCANO'].includes(n.biome));
        if (!nbs.length) break;
        const next = nbs.sort((a, b) => {
          const da = Math.abs(Math.atan2(a.z - cur.z, a.x - cur.x) - dir);
          const db = Math.abs(Math.atan2(b.z - cur.z, b.x - cur.x) - dir);
          return Math.min(da, Math.PI * 2 - da) - Math.min(db, Math.PI * 2 - db);
        })[0];
        if (next.biome === 'SEA' && step > 4) break;   // joined other waters
        next.biome = 'SEA';
        applyHeight(next, seed, volcano);
        cur = next;
      }
    }
    // nebulas rest inside the largest lakes, ringed entirely by water
    let placedNebulas = 0;
    for (const lake of seaComponents()) {
      if (placedNebulas >= NEBULA_NAMES.length || lake.length < 10) continue;
      const interior = lake.filter(t =>
        neighborsOf(t.q, t.r).every(([q, r]) => {
          const n = tiles.get(keyOf(q, r));
          return n && !n.void && n.biome === 'SEA';
        }));
      const spot = (interior.length ? interior : lake)
        .sort((a, b) => hash2(b.q, b.r, seed + 4300) - hash2(a.q, a.r, seed + 4300))[0];
      if (!spot || spot.landmark) continue;
      spot.landmark = { type: 'nebula', name: NEBULA_NAMES[placedNebulas++] };
    }
  }

  // ---- pass 4: satellites beyond the rim -----------------------------------
  const worldR = Math.sqrt(3) * size * R;
  const satellites = SATELLITES.map((def, i) => {
    const cx = Math.cos(def.angle) * worldR * 1.26;
    const cz = Math.sin(def.angle) * worldR * 1.26;
    const { q: cq, r: cr } = worldToAxial(cx, cz, size);
    const satTiles = [];
    // full areas now, not islands: radius-5 pockets with room to explore
    for (const [dq, dr] of discCoords(5)) {
      const q = cq + dq, r = cr + dr;
      if (tiles.has(keyOf(q, r))) continue;
      // ragged coastline so the worlds read as worlds, not coins
      if (hexDist(q, r, cq, cr) >= 4 && hash2(q, r, seed + 20) < 0.35) continue;
      const t = addTile(q, r, {
        biome: def.biome, region: 100 + i,
        elev: 0.45 + hash2(q, r, seed + 21) * 0.25,
      });
      applyHeight(t, seed, volcano);
      satTiles.push(t);
    }
    const center = satTiles.reduce((best, t) =>
      (!best || hexDist(t.q, t.r, cq, cr) < hexDist(best.q, best.r, cq, cr)) ? t : best, null);
    center.landmark = { type: 'satboss', name: def.boss.name, satellite: def.id, tier: 5 };
    const kept = keepComponent(satTiles, center, tiles);
    return { def, tiles: kept, center, cq, cr };
  });

  // ---- pass 4.6: the Wound in the Meridian ---------------------------------
  // A tier-6 eldritch pocket beyond the rim, sealed outside the world's
  // sight. It exists from the first hop — but tears open only for a wanderer
  // carrying three or more cosmic mutations.
  const wound = (() => {
    const angle = 1.6, cx = Math.cos(angle) * worldR * 1.42, cz = Math.sin(angle) * worldR * 1.42;
    const { q: cq, r: cr } = worldToAxial(cx, cz, size);
    const wTiles = [];
    for (const [dq, dr] of discCoords(4)) {
      const q = cq + dq, r = cr + dr;
      if (tiles.has(keyOf(q, r))) continue;
      if (hexDist(q, r, cq, cr) >= 3 && hash2(q, r, seed + 23) < 0.3) continue;
      const t = addTile(q, r, {
        biome: 'WOUND', region: 200, void: true, woundHidden: true,
        elev: 0.5 + hash2(q, r, seed + 24) * 0.3,
      });
      applyHeight(t, seed, volcano);
      wTiles.push(t);
    }
    const center = wTiles.reduce((best, t) =>
      (!best || hexDist(t.q, t.r, cq, cr) < hexDist(best.q, best.r, cq, cr)) ? t : best, null);
    center.landmark = { type: 'deity', name: DEITY.name };
    // ragged edges may split the pocket — keep only the center's piece
    const kept = keepComponent(wTiles, center, tiles);
    // whispering landmarks scattered through the pocket
    const whisperCands = kept
      .filter(t => t !== center)
      .sort((a, b) => hash2(b.q, b.r, seed + 25) - hash2(a.q, a.r, seed + 25));
    WOUND_WHISPERS.forEach((w, i) => {
      if (whisperCands[i * 2]) whisperCands[i * 2].landmark = { type: 'whisper', name: w.name };
    });
    return { tiles: kept, center, cq, cr, bridgeTiles: [], revealed: false };
  })();

  // (star-bridges are carved in pass 7.5, after sealing and connectivity,
  //  so their shores are guaranteed to survive both)

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
    // validate each candidate BEFORE union-find: a pair whose crossing is
    // uncarvable must not count as connecting its regions, or the union
    // thinks a region is linked while no causeway exists — an orphan pocket
    // that the connectivity pass then deletes wholesale.
    const pairs = [...barrierBest.values()]
      .map(p => {
        const nearLand = regionId => {
          let best = null, bestD = Infinity;
          for (const t of regions[regionId].tiles) {
            const d = hexDist(t.q, t.r, p.tile.q, p.tile.r);
            if (d < bestD) { bestD = d; best = t; }
          }
          return best;
        };
        const A = nearLand(p.a), B = nearLand(p.b);
        const dist = A && B ? hexDist(A.q, A.r, B.q, B.r) : Infinity;
        return { ...p, A, B, dist, mstScore: p.score + ((p.a === 0 || p.b === 0) ? 7 : 0) };
      })
      .filter(p => p.dist < Infinity)
      .sort((x, y) => x.mstScore - y.mstScore);
    const parent = Array.from({ length: K }, (_, i) => i);
    const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const chosen = [];
    // short crossings first; then relax the limit for anything still cut off
    // (a long causeway beats a region no one can ever enter)
    for (const maxDist of [12, 26]) {
      for (const p of pairs) {
        if (p.dist > maxDist) continue;
        if (find(p.a) !== find(p.b)) { parent[find(p.a)] = find(p.b); chosen.push(p); }
      }
    }
    let extras = 0;
    for (const p of pairs) {
      if (extras >= 3) break;
      if (p.dist > 12 || chosen.includes(p) || p.a === 0 || p.b === 0) continue;
      chosen.push(p);
      extras++;
    }
    return chosen;
  })();
  for (const { a, b, A, B } of chosenPairs) {
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
    if (!carved.length) {
      // zero-width rift: the two lands already touch. Stand the warden on
      // the boundary itself — one land tile becomes the warded crossing.
      const mid = line[Math.floor(line.length / 2)];
      const t = tiles.get(keyOf(mid.q, mid.r));
      if (!t || t.void || t.gate || t.landmark) continue;
      t.biome = 'ROAD';
      t.elev = 0.4;
      applyHeight(t, seed, volcano);
      carved.push(t);
    }
    const gateIdx = Math.floor(carved.length / 2);
    const gateTile = carved[gateIdx];
    gateTile.gate = {
      pair: [a, b], open: false,
      carvedInfo: { keys: carved.map(t => keyOf(t.q, t.r)), gateIdx, a, b },
    };
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

  // ---- pass 6.5: seal the rifts airtight -----------------------------------
  // The jittered voronoi can leave two regions' land directly adjacent, or a
  // causeway brushing the wrong region's shore — walkable bypasses around
  // the warden. Void every such crossing: the gates are the only doors.
  {
    // which region may touch each stretch of causeway (its own side of the gate)
    const roadSide = new Map();
    for (const g of gates) {
      const info = g.gate.carvedInfo;
      info.keys.forEach((k, i) => {
        if (i === info.gateIdx) return;
        roadSide.set(k, i < info.gateIdx ? info.a : info.b);
      });
    }
    // Land at a causeway's mouth anchors its region to the road. Each mouth
    // must keep at least one anchor — beyond that, mouth tiles are spendable
    // when sealing demands it.
    const protectedLand = new Set();
    const anchorEndpoint = new Map();   // tileKey -> endpointKey
    const anchorCount = new Map();      // endpointKey -> live anchors
    for (const g of gates) {
      const info = g.gate.carvedInfo;
      for (const [idx, regId] of [[0, info.a], [info.keys.length - 1, info.b]]) {
        const ek = info.keys[idx] + '|' + regId;
        const rt = tiles.get(info.keys[idx]);
        if (!rt) continue;
        for (const [nq, nr] of neighborsOf(rt.q, rt.r)) {
          const n = tiles.get(keyOf(nq, nr));
          if (n && !n.void && n.region === regId) {
            const k = keyOf(n.q, n.r);
            protectedLand.add(k);
            anchorEndpoint.set(k, ek);
            anchorCount.set(ek, (anchorCount.get(ek) || 0) + 1);
          }
        }
      }
    }
    // may this protected tile be spent? (only if its mouth keeps an anchor)
    const spendAnchor = k => {
      const ek = anchorEndpoint.get(k);
      if (!ek) return true;
      if ((anchorCount.get(ek) || 0) <= 1) return false;
      anchorCount.set(ek, anchorCount.get(ek) - 1);
      return true;
    };
    // rule 1: raw land of two regions must never touch
    for (const t of list) {
      if (t.void || t.gate || t.region >= 100) continue;
      if (t.biome === 'ROAD' || t.biome === 'BRIDGE') continue;
      for (const [nq, nr] of neighborsOf(t.q, t.r)) {
        const n = tiles.get(keyOf(nq, nr));
        if (!n || n.void || n.gate || n.region >= 100) continue;
        if (n.biome === 'ROAD' || n.biome === 'BRIDGE') continue;
        if (n.region === t.region) continue;
        const kt = keyOf(t.q, t.r), kn = keyOf(n.q, n.r);
        const tProt = protectedLand.has(kt), nProt = protectedLand.has(kn);
        if (tProt && nProt) {
          if (spendAnchor(kt)) t.void = true;
          else if (spendAnchor(kn)) n.void = true;
          // else: both mouths are down to their last anchor — leave the
          // crossing; both tiles sit beside the same gate, which still bars
          // onward travel along the road itself
        } else if (tProt) {
          n.void = true;
        } else if (nProt) {
          t.void = true;
        } else {
          const vt = hash2(t.q, t.r, seed + 66) >= hash2(n.q, n.r, seed + 66) ? t : n;
          vt.void = true;
        }
        if (t.void) break;
      }
    }
    // rule 2: land brushing a causeway on the far side of its gate
    for (const [k, allowed] of roadSide) {
      const rt = tiles.get(k);
      if (!rt || rt.void) continue;
      for (const [nq, nr] of neighborsOf(rt.q, rt.r)) {
        const n = tiles.get(keyOf(nq, nr));
        if (!n || n.void || n.gate || n.region >= 100) continue;
        if (n.biome === 'ROAD' || n.biome === 'BRIDGE') continue;
        if (n.region === allowed) continue;
        const nk = keyOf(n.q, n.r);
        if (!protectedLand.has(nk) || spendAnchor(nk)) n.void = true;
      }
    }
  }

  // ---- pass 6.75: re-anchor causeways the sealing cut adrift ---------------
  // Sealing can void the tiles between a causeway's mouth and its region's
  // body, orphaning the region (and every region beyond it). For each gate
  // endpoint, breadcrumb a path back to the region's largest fragment,
  // un-voiding same-region tiles — never stepping beside foreign land, so
  // no repair can re-open a leak.
  {
    const bodyCache = new Map();
    const bodyOf = regId => {
      if (bodyCache.has(regId)) return bodyCache.get(regId);
      const seen = new Set();
      let best = new Set();
      for (const t of regions[regId]?.tiles || []) {
        const k0 = keyOf(t.q, t.r);
        if (t.void || seen.has(k0) || t.biome === 'ROAD' || t.biome === 'BRIDGE') continue;
        const comp = new Set([k0]);
        seen.add(k0);
        const stack = [t];
        while (stack.length) {
          const cur = stack.pop();
          for (const [nq, nr] of neighborsOf(cur.q, cur.r)) {
            const k = keyOf(nq, nr);
            const n = tiles.get(k);
            if (n && !n.void && n.region === regId && !comp.has(k)
              && n.biome !== 'ROAD' && n.biome !== 'BRIDGE') {
              comp.add(k);
              seen.add(k);
              stack.push(n);
            }
          }
        }
        if (comp.size > best.size) best = comp;
      }
      bodyCache.set(regId, best);
      return best;
    };
    for (const g of gates) {
      const info = g.gate.carvedInfo;
      for (const [idx, regId] of [[0, info.a], [info.keys.length - 1, info.b]]) {
        const body = bodyOf(regId);
        if (!body.size) continue;
        const endT = tiles.get(info.keys[idx]);
        if (!endT) continue;
        const seen = new Set([keyOf(endT.q, endT.r)]);
        const parent = new Map();
        const queue = [endT];
        let found = null;
        while (queue.length && !found) {
          const cur = queue.shift();
          for (const [nq, nr] of neighborsOf(cur.q, cur.r)) {
            const k = keyOf(nq, nr);
            if (seen.has(k)) continue;
            const n = tiles.get(k);
            if (!n || n.region !== regId || n.gate || n.secret) continue;
            if (n.biome === 'ROAD' || n.biome === 'BRIDGE') continue;
            const touchesForeign = neighborsOf(n.q, n.r).some(([fq, fr]) => {
              const f = tiles.get(keyOf(fq, fr));
              return f && !f.void && f.region !== regId && f.region < 100
                && f.biome !== 'ROAD' && f.biome !== 'BRIDGE' && !f.gate;
            });
            if (touchesForeign) continue;
            seen.add(k);
            parent.set(k, cur);
            queue.push(n);
            if (body.has(k)) { found = n; break; }
          }
        }
        if (!found) continue;
        for (let node = found; node && node !== endT; node = parent.get(keyOf(node.q, node.r))) {
          if (node.void) { node.void = false; node.secret = false; }
        }
        bodyCache.delete(regId);   // the fragment map just changed
      }
    }
  }

  // ---- pass 6.8: plant the start on solid ground ---------------------------
  // Erosion and sealing can shatter the home region into fragments. The
  // start must stand in the largest one — the fragment the causeway mouths
  // re-anchor to — or the connectivity cull keeps only a splinter of the
  // world and drowns the rest.
  {
    const comps = [];
    const seen = new Set();
    for (const t of list) {
      if (t.void || t.region !== 0) continue;
      const k0 = keyOf(t.q, t.r);
      if (seen.has(k0)) continue;
      const comp = [t];
      seen.add(k0);
      for (let i = 0; i < comp.length; i++) {
        for (const [nq, nr] of neighborsOf(comp[i].q, comp[i].r)) {
          const k = keyOf(nq, nr);
          const n = tiles.get(k);
          if (n && !n.void && n.region === 0 && !seen.has(k)) { seen.add(k); comp.push(n); }
        }
      }
      comps.push(comp);
    }
    comps.sort((a, b) => b.length - a.length);
    const body = comps[0] || [];
    if (body.length && !body.includes(start)) {
      let best = null, bestScore = -Infinity;
      for (const t of body) {
        if (t.gate || t.landmark || t.biome === 'ROAD' || t.biome === 'BRIDGE') continue;
        if (!['MEADOW', 'FOREST', 'CRYSTAL', 'DESERT', 'TUNDRA'].includes(t.biome)) continue;
        const s = (t.biome === 'MEADOW' ? 2 : 1) - Math.abs(t.cDist - 6) * 0.15 + hash2(t.q, t.r, seed + 11);
        if (s > bestScore) { bestScore = s; best = t; }
      }
      start = best || body.find(t => !t.gate && !t.landmark) || body[0];
    }
  }

  // ---- pass 6.9: the water web ---------------------------------------------
  // The crossings are shallows now, not stone: where a channel meets a
  // region's shore, a narrow star-river is carved inland to the nearest
  // waters, so lake, river and warded crossing read as one glowing web.
  {
    const JOIN = CONFIG.archipelago.riverJoinDist;
    for (const g of gates) {
      const info = g.gate.carvedInfo;
      for (const [idx, regId] of [[0, info.a], [info.keys.length - 1, info.b]]) {
        const mouth = tiles.get(info.keys[idx]);
        if (!mouth) continue;
        const seen = new Set(), parent = new Map(), queue = [];
        for (const [nq, nr] of neighborsOf(mouth.q, mouth.r)) {
          const n = tiles.get(keyOf(nq, nr));
          if (n && !n.void && n.region === regId && !n.gate
            && n.biome !== 'ROAD' && n.biome !== 'BRIDGE') {
            queue.push(n);
            seen.add(keyOf(n.q, n.r));
          }
        }
        let found = null;
        while (queue.length && !found) {
          const cur = queue.shift();
          if (cur.biome === 'SEA') { found = cur; break; }
          if (hexDist(cur.q, cur.r, mouth.q, mouth.r) >= JOIN) continue;
          for (const [nq, nr] of neighborsOf(cur.q, cur.r)) {
            const k = keyOf(nq, nr);
            if (seen.has(k)) continue;
            const n = tiles.get(k);
            if (!n || n.void || n.region !== regId || n.gate || n.landmark || n.secret) continue;
            if (n.biome === 'ROAD' || n.biome === 'BRIDGE') continue;
            seen.add(k);
            parent.set(k, cur);
            queue.push(n);
          }
        }
        if (!found) continue;
        for (let node = found; node; node = parent.get(keyOf(node.q, node.r))) {
          if (node.biome !== 'SEA' && !node.landmark
            && hexDist(node.q, node.r, start.q, start.r) >= 2) {
            node.biome = 'SEA';
            applyHeight(node, seed, volcano);
          }
        }
      }
    }
  }

  // ---- pass 7: connectivity (gates count as passable) ----------------------
  // The outer worlds (satellites, the Wound) join the graph later via their
  // bridges, so the cull leaves everything beyond region 100 alone.
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
      if (!t.void && t.region < 100 && !reached.has(keyOf(t.q, t.r))) t.void = true;
    }
  }
  const land = list.filter(t => !t.void);

  // ---- pass 7.5: star-bridges — hidden until their seam is detonated -------
  // The wandering worlds hang visibly beyond the rim, but no road reaches
  // them: each bridge lies folded inside the void. A resonant seam waits on
  // the shore nearest each world; a star-charge there unfurls the whole span.
  const carveHiddenBridge = (fromTile, toTile, regionId, store) => {
    for (const { q, r } of hexLine(fromTile.q, fromTile.r, toTile.q, toTile.r)) {
      const k = keyOf(q, r);
      let t = tiles.get(k);
      if (t && !t.void) continue;
      if (!t) t = addTile(q, r, { region: regionId });
      t.void = true;
      t.hiddenBridge = true;
      t.biome = 'BRIDGE';
      t.elev = 0.3;
      applyHeight(t, seed, volcano);
      store.push(t);
    }
    if (store[0]) store[0].bridgeSeam = true;   // detonate beside this to unfurl
  };
  const pickShore = (cq, cr, preferSea) => {
    let shore = null, shoreScore = Infinity;
    for (const t of land) {
      if (t.region >= 100 || !t.biome || t.landmark || t.gate) continue;
      const d = hexDist(t.q, t.r, cq, cr);
      const score = d - (preferSea && t.biome === 'SEA' ? 6 : 0);
      if (score < shoreScore) { shoreScore = score; shore = t; }
    }
    return shore;
  };
  for (const sat of satellites) {
    const shore = pickShore(sat.cq, sat.cr, true);
    let landing = null, landScore = Infinity;
    for (const t of sat.tiles) {
      const d = hexDist(t.q, t.r, shore.q, shore.r);
      if (d < landScore) { landScore = d; landing = t; }
    }
    sat.shore = shore;
    sat.bridgeTiles = [];
    sat.revealed = false;
    shore.seamHint = sat.def.id;
    carveHiddenBridge(shore, landing, 100 + satellites.indexOf(sat), sat.bridgeTiles);
  }
  // the Wound's own folded span, revealed by mutation rather than blasting
  {
    const shore = pickShore(wound.cq, wound.cr, false);
    let landing = null, landScore = Infinity;
    for (const t of wound.tiles) {
      const d = hexDist(t.q, t.r, shore.q, shore.r);
      if (d < landScore) { landScore = d; landing = t; }
    }
    wound.shore = shore;
    carveHiddenBridge(shore, landing, 200, wound.bridgeTiles);
    for (const t of wound.bridgeTiles) { t.woundHidden = true; t.bridgeSeam = false; }
  }

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
      .filter(t => t.void && !t.hiddenBridge && !t.woundHidden && t.cDist > 5 && t.cDist < R - 1)
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

  // ---- pass 10.5: forgotten islets -----------------------------------------
  // Tiny worlds adrift in the rifts, holding on out of stubbornness. Each
  // hides until a star-charge on the humming shore unfurls its folded
  // footbridge — then a hermit, a wreck, or half an observatory waits.
  const islets = [];
  {
    const cands = list
      .filter(t => t.void && !t.secret && !t.hiddenBridge && !t.woundHidden
        && t.cDist > 8 && t.cDist < R - 1)
      .sort((a, b) => hash2(b.q, b.r, seed + 5100) - hash2(a.q, a.r, seed + 5100));
    const landWithin = (q, r, d) => {
      for (const [dq, dr] of discCoords(d)) {
        const n = tiles.get(keyOf(q + dq, r + dr));
        if (n && !n.void) return true;
      }
      return false;
    };
    // two sweeps: strict placement first, then a relaxed one so every world
    // gets its full complement of islets even when the rifts run narrow
    for (const [gap, spacing] of [[CONFIG.islets.minLandGap, 10], [2, 7]]) {
    for (const anchor of cands) {
      if (islets.length >= CONFIG.islets.count) break;
      if (anchor.isletHidden || anchor.isletBridge != null) continue;
      if (landWithin(anchor.q, anchor.r, gap)) continue;
      if (islets.some(o => hexDist(o.anchor.q, o.anchor.r, anchor.q, anchor.r) < spacing)) continue;
      // the islet: the anchor and a ragged handful of its void neighbours
      const clusterTiles = [anchor];
      for (const [nq, nr] of neighborsOf(anchor.q, anchor.r)) {
        const t = tiles.get(keyOf(nq, nr));
        if (!t || !t.void || t.secret || t.hiddenBridge || t.woundHidden || t.isletHidden) continue;
        if (hash2(nq, nr, seed + 5200) < 0.6) clusterTiles.push(t);
      }
      if (clusterTiles.length < 3) continue;
      // the nearest honest shore holds the seam
      let shore = null, sd = Infinity;
      for (const t of land) {
        if (t.region >= 100 || t.landmark || t.gate || t.seamHint || t.vantage) continue;
        if (t.biome === 'ROAD' || t.biome === 'BRIDGE') continue;
        const d = hexDist(t.q, t.r, anchor.q, anchor.r);
        if (d < sd) { sd = d; shore = t; }
      }
      if (!shore || sd > CONFIG.islets.maxBridge) continue;
      // the folded footbridge: pure void the whole way, touching no land —
      // a revealed span must never hand out a free crossing between regions
      const line = hexLine(shore.q, shore.r, anchor.q, anchor.r);
      const bridge = [];
      let ok = true;
      for (const { q, r } of line) {
        const t = tiles.get(keyOf(q, r));
        if (!t) { ok = false; break; }
        if (t === shore || clusterTiles.includes(t)) continue;
        if (!t.void || t.secret || t.hiddenBridge || t.woundHidden || t.isletHidden) { ok = false; break; }
        const bad = neighborsOf(q, r).some(([fq, fr]) => {
          const f = tiles.get(keyOf(fq, fr));
          return f && !f.void && (f.region !== shore.region
            || f.biome === 'ROAD' || f.biome === 'BRIDGE' || f.gate);
        });
        if (bad) { ok = false; break; }
        bridge.push(t);
      }
      if (!ok || !bridge.length) continue;

      const def = ISLETS[islets.length];
      for (const t of clusterTiles) {
        t.isletHidden = true;
        t.biome = 'ISLET';
        t.region = shore.region;
        t.elev = 0.5 + hash2(t.q, t.r, seed + 5300) * 0.2;
        applyHeight(t, seed, volcano);
      }
      anchor.landmark = { type: 'islet', name: def.name, islet: islets.length };
      for (const t of bridge) {
        t.isletHidden = true;
        t.isletBridge = islets.length;
        t.biome = 'BRIDGE';
        t.region = shore.region;
        t.elev = 0.3;
        applyHeight(t, seed, volcano);
      }
      bridge[0].isletSeam = true;   // detonate beside this to unfurl
      shore.isletHint = islets.length;
      islets.push({ def, tiles: clusterTiles, bridgeTiles: bridge, anchor, shore, revealed: false });
    }
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

  // ---- pass 12: regional site budgets --------------------------------------
  // The wilderness no longer sprouts sites on nearly every hex. Each region
  // seeds a small fixed troupe of visitable places — traders, mysteries,
  // caches, at most two item pedestals — and beyond them the horizon is
  // honestly empty. Battles out here come from the packs that roam it.
  {
    const brng = mulberry32((seed ^ 0x5173) >>> 0);
    for (const reg of regions) {
      const cands = reg.tiles
        .filter(t => placeable(t) && !t.crackHint && t.isletHint == null
          && !settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 2)
          && hexDist(t.q, t.r, start.q, start.r) >= 2)
        .sort((a, b) => hash2(b.q, b.r, seed + 93) - hash2(a.q, a.r, seed + 93));
      const kinds = ['pedestal', 'trader', 'cache'];
      if (brng() < 0.5) kinds.push('pedestal');
      if (brng() < 0.6) kinds.push('cache');
      const extras = 2 + Math.floor(brng() * 3); // 2-4 mysteries and small events
      for (let i = 0; i < extras; i++) kinds.push('side');
      const chosen = [];
      for (const t of cands) {
        if (!kinds.length) break;
        if (chosen.some(c => hexDist(c.q, c.r, t.q, t.r) < 3)) continue;
        t.siteKind = kinds.shift();
        t.hasSite = true;
        chosen.push(t);
      }
    }
    for (const sat of satellites) {
      // full areas deserve full budgets: relics, caches, a trader, events
      const kinds = ['pedestal', 'pedestal', 'cache', 'cache', 'trader', 'side', 'side'];
      const cands = sat.tiles
        .filter(t => !t.landmark)
        .sort((a, b) => hash2(b.q, b.r, seed + 93) - hash2(a.q, a.r, seed + 93));
      const chosen = [];
      for (const t of cands) {
        if (!kinds.length) break;
        if (chosen.some(c => hexDist(c.q, c.r, t.q, t.r) < 2)) continue;
        t.siteKind = kinds.shift();
        t.hasSite = true;
        chosen.push(t);
      }
    }
    // the Wound's own scattered horrors and hoards
    {
      const kinds = ['pedestal', 'cache', 'wound_battle', 'wound_battle', 'side'];
      const cands = wound.tiles
        .filter(t => !t.landmark)
        .sort((a, b) => hash2(b.q, b.r, seed + 95) - hash2(a.q, a.r, seed + 95));
      const chosen = [];
      for (const t of cands) {
        if (!kinds.length) break;
        if (chosen.some(c => hexDist(c.q, c.r, t.q, t.r) < 2)) continue;
        t.siteKind = kinds.shift();
        t.hasSite = true;
        chosen.push(t);
      }
    }
  }

  // ---- pass 13: roaming pack spawns ----------------------------------------
  // a handful of visible hunters per region; they drift while the wanderer
  // moves and give battle on contact (state lives in RoamerSystem)
  const roamerSpawns = [];
  {
    const rrng = mulberry32((seed ^ 0x9e37) >>> 0);
    let nextId = 0;
    const spawnIn = (tilesArr, regId, tier, n) => {
      const cands = tilesArr
        .filter(t => !t.void && !t.landmark && !t.gate && t.biome !== 'BRIDGE' && !t.siteKind
          && hexDist(t.q, t.r, start.q, start.r) >= 6
          && !settlements.some(s => hexDist(t.q, t.r, s.q, s.r) < 3))
        .sort((a, b) => hash2(b.q, b.r, seed + 94) - hash2(a.q, a.r, seed + 94));
      const placed = [];
      for (const t of cands) {
        if (placed.length >= n) break;
        if (placed.some(p => hexDist(p.q, p.r, t.q, t.r) < 4)) continue;
        placed.push(t);
        roamerSpawns.push({
          id: nextId++, q: t.q, r: t.r, region: regId, tier,
          biome: t.biome in BIOMES ? t.biome : 'MEADOW',
          count: 1 + (rrng() < 0.45 ? 1 : 0) + (tier >= 3 && rrng() < 0.4 ? 1 : 0),
        });
      }
    };
    for (const reg of regions) {
      spawnIn(reg.tiles, reg.id, reg.tier, 2 + Math.floor(rrng() * 2) + (reg.tier >= 3 ? 1 : 0));
    }
    // the wandering worlds run markedly hotter than the mainland
    satellites.forEach((sat, i) => spawnIn(sat.tiles, 100 + i, 5, 3));

    // shallows shoals: water-bound hunters that patrol lake and river alike
    // and never set a fin on dry land (post-seal components, so no shoal can
    // ever slip between regions)
    for (const lake of seaComponents()) {
      if (lake.length < 7) continue;
      const regTier = regions[lake[0].region]?.tier ?? 1;
      const spots = lake
        .filter(t => !t.landmark && !t.siteKind
          && hexDist(t.q, t.r, start.q, start.r) >= 6
          && !roamerSpawns.some(s => hexDist(s.q, s.r, t.q, t.r) < 4))
        .sort((a, b) => hash2(b.q, b.r, seed + 96) - hash2(a.q, a.r, seed + 96));
      const want = lake.length >= 16 ? 2 : 1;
      for (const t of spots.slice(0, want)) {
        roamerSpawns.push({
          id: nextId++, q: t.q, r: t.r, region: t.region,
          tier: Math.max(1, regTier + 1),   // the deep water is always meaner
          biome: 'SEA', water: true,
          count: 1 + (rrng() < 0.5 ? 1 : 0),
        });
      }
    }
  }

  // ---- pass 14: voices in the sky ------------------------------------------
  // Fixed celestial bodies get a vantage hex on the nearest shore: stand
  // there and the sky speaks. (The moving comet keeps its own counsel.)
  const skyAnchors = [
    { id: 'giant', angle: -1.0, dist: 1.5 },
    { id: 'third_sister', angle: Math.PI, dist: 1.3 },
    { id: 'ferry_lantern', angle: -0.2, dist: 1.25 },
    { id: 'door_ajar', angle: 2.05, dist: 1.35 },
  ];
  for (const a of skyAnchors) {
    a.x = Math.cos(a.angle) * worldR * a.dist;
    a.z = Math.sin(a.angle) * worldR * a.dist;
    let best = null, bd = Infinity;
    for (const t of land) {
      if (t.landmark || t.region >= 100 || t.biome === 'BRIDGE' || t.gate || t.siteKind
        || t.seamHint || t.isletHint != null) continue;
      const d = (t.x - a.x) ** 2 + (t.z - a.z) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    if (best) { best.vantage = a.id; a.tileKey = keyOf(best.q, best.r); }
  }

  // ---- names ---------------------------------------------------------------
  for (const t of land) {
    if (t.landmark) t.name = t.landmark.name;
    else if (t.biome === 'ROAD') t.name = 'Warded Shallows';
    else if (t.biome === 'BRIDGE') t.name = 'Star-Bridge';
    else t.name = wildName(mulberry32(Math.floor(hash2(t.q, t.r, seed + 81) * 0xffffffff)), t.biome);
  }
  // hidden tiles get their names now, ready for the day they surface
  for (const sat of satellites) for (const t of sat.bridgeTiles) t.name = 'Star-Bridge';
  for (const t of wound.bridgeTiles) t.name = 'A Bridge of Scar-Tissue';
  for (const t of wound.tiles) t.name = t.landmark ? t.landmark.name : 'The Wound in the Meridian';
  for (const isl of islets) {
    for (const t of isl.bridgeTiles) t.name = 'A Folded Footbridge';
    for (const t of isl.tiles) t.name = t.landmark ? t.landmark.name : isl.def.name;
  }

  // ---- per-hex explorable sites (lazy, deterministic, sparser) -------------
  const siteCache = new Map();
  const kingdomById = Object.fromEntries(kingdoms.map(k => [k.id, k]));
  const regionOf = t => t.region === 200
    ? { id: 200, tier: 6, name: 'The Wound in the Meridian', dominantBiome: 'WOUND' }
    : t.region >= 100
      ? { id: t.region, tier: 5, name: SATELLITES[t.region - 100]?.name || 'The Deep Sky', dominantBiome: t.biome }
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
      sites[2].team = { biome: tile.biome, tier: tier + 1, count: 1, boss: false, arena: true, bossKind: 'champion' };
      sites[3] = pedestalSite('BOSS'); // the Royal Reliquary yields a relic
      sites[3].name = 'Royal Reliquary';
    } else if (lm?.type === 'town') {
      sites = townSites(rng, lm.name);
      sites[2].team = { biome: tile.biome, tier, count: 1 + (rng() < 0.5 ? 1 : 0), boss: false };
    } else if (lm?.type === 'dungeon') {
      sites = dungeonSites(rng, lm);
      sites[1].team = { biome: tile.biome, tier: tier + 1, count: 1, boss: false, bossKind: 'guardian' };
      sites[2] = pedestalSite(tile.biome in BIOMES && ITEM_POOLS.has(tile.biome) ? tile.biome : 'ANY');
      sites[2].name = 'Vault Antechamber';
    } else if (lm?.type === 'shrine') {
      let holy = makeSide(rng);
      for (let i = 0; holy.bargain && i < 5; i++) holy = makeSide(rng);   // shrines don't haggle
      sites = [holy, battleSite()];
      sites[0].subtype = 'shrine';
      // paid full heal (dearer each time) + a once-per-shrine boon
      sites[0].actions = [...sites[0].actions, 'Offer Star-Shards', 'Commune with the Shrine'];
    } else if (lm?.type === 'satboss') {
      const def = SATELLITES.find(s => s.id === lm.satellite);
      sites = [{
        type: 'battle', subtype: 'boss', name: def.boss.name, enemy: def.boss.name,
        flavor: def.boss.flavor,
        actions: ['⚔ Challenge'],
        team: {
          biome: tile.biome, tier: 5, count: 1, boss: true,
          satellite: def.id, bossName: def.boss.name, bossKind: 'sat_' + def.id,
        },
      }, pedestalSite('ASTRAL')];
    } else if (lm?.type === 'nebula') {
      sites = nebulaSites(rng, lm.name);
      sites[1].team = { biome: 'SEA', tier: tier + 1, count: 2 };
    } else if (lm?.type === 'deity') {
      sites = [{
        type: 'battle', subtype: 'deity', name: DEITY.name, enemy: DEITY.name,
        flavor: DEITY.flavor,
        actions: ['⚔ Answer the Invitation'],
        team: { biome: 'WOUND', tier: 7, count: 1, boss: true, deity: true, bossName: DEITY.name, bossKind: 'deity' },
      }];
    } else if (lm?.type === 'islet') {
      const def = ISLETS[lm.islet] || ISLETS[0];
      if (def.id === 'hermit') {
        const tr = makeTrader(rng, 3, null);
        tr.name = 'The Hermit’s Rates';
        tr.flavor = def.flavor;
        sites = [tr, makeSide(rng)];
      } else if (def.id === 'wreck') {
        const b = battleSite(1);
        b.name = 'Hold of the Vainglory';
        b.flavor = 'Something nests in the cargo hold, wearing the captain’s coat. It does not intend to share the salvage.';
        b.team.count = 2;
        sites = [b, {
          type: 'side', subtype: 'cache', name: 'The Vainglory’s Manifest',
          flavor: 'Three crates survived the argument with gravity. The manifest lists nine. The void kept a healthy commission.',
          actions: ['Open the Cache'], cacheShards: 20 + Math.floor(rng() * 12) + tier * 5,
        }];
      } else {
        const p = pedestalSite('ASTRAL');
        p.name = 'The Brass Eye';
        p.flavor = 'The observatory’s great lens still cups a point of caught starlight. It has been waiting a long time for someone to claim the observation.';
        sites = [p, makeSide(rng)];
      }
    } else if (lm?.type === 'whisper') {
      const w = WOUND_WHISPERS.find(x => x.name === lm.name) || WOUND_WHISPERS[0];
      sites = [{
        type: 'side', subtype: 'whisper', name: w.name, flavor: w.flavor,
        actions: ['Listen Closely'],
      }];
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
    } else if (tile.siteKind) {
      // the region's budgeted troupe: the only marks on an otherwise empty wild
      const reg = regionOf(tile);
      if (tile.siteKind === 'wound_battle') {
        const b = battleSite(1);
        b.name = 'Where It Bleeds Through';
        b.flavor = 'The hex is thin here. Things press against the far side of it like faces against frost-glass, and some of them have pushed through.';
        b.team.count = 2 + (rng() < 0.5 ? 1 : 0);
        sites = [b];
      } else if (tile.siteKind === 'pedestal') {
        sites = [pedestalSite(pickPoolFor(tile, reg))];
      } else if (tile.siteKind === 'trader') {
        sites = [makeTrader(rng, reg.tier >= 3 ? 3 : 2, null)];
      } else if (tile.siteKind === 'cache') {
        sites = [rng() < 0.65
          ? {
            type: 'side', subtype: 'cache', name: 'Buried Shard-Cache',
            flavor: 'A hollow beneath a leaning stone, packed with shards someone meant to come back for. They will not be back.',
            actions: ['Open the Cache'], cacheShards: 10 + Math.floor(rng() * 8) + reg.tier * 5,
          }
          : {
            type: 'side', subtype: 'cache', name: 'Abandoned Supply Drop',
            flavor: 'A crate on cracked runners, still lashed tight. The manifest lists three items and one apology.',
            actions: ['Open the Cache'], cacheConsumables: rng() < 0.65 ? { charge: 2 } : { dew: 1 },
          }];
      } else {
        sites = [makeSide(rng)];
        if (rng() < 0.4) sites.push(makeSide(rng));
      }
    } else {
      sites = []; // empty horizon — what moves out here moves on its own
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
    kingdoms, kingdomById, dungeons, shrines, traders, roamerSpawns,
    regions, regionOf, gates, satellites, secrets, wound, skyAnchors, islets,
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
    // a star-charge on the resonant seam unfurls the whole span
    revealBridge(satIdx) {
      const sat = satellites[satIdx];
      if (!sat || sat.revealed) return false;
      sat.revealed = true;
      for (const t of sat.bridgeTiles) {
        t.void = false;
        t.hiddenBridge = false;
        if (!land.includes(t)) land.push(t);
      }
      if (sat.shore) sat.shore.seamHint = null;
      return true;
    },
    // a star-charge on the humming shore unfurls the folded footbridge
    revealIslet(i) {
      const isl = islets[i];
      if (!isl || isl.revealed) return false;
      isl.revealed = true;
      for (const t of [...isl.bridgeTiles, ...isl.tiles]) {
        t.void = false;
        t.isletHidden = false;
        if (!land.includes(t)) land.push(t);
      }
      if (isl.shore) isl.shore.isletHint = null;
      return true;
    },
    // three mutations, and the world admits what it has been hiding
    revealWound() {
      if (wound.revealed) return false;
      wound.revealed = true;
      for (const t of [...wound.bridgeTiles, ...wound.tiles]) {
        t.void = false;
        t.hiddenBridge = false;
        t.woundHidden = false;
        if (!land.includes(t)) land.push(t);
      }
      return true;
    },
  };
}

// Keep only the tiles of `group` connected to `anchor`; stray fragments are
// voided out of existence (ragged coastlines can split a disc).
function keepComponent(group, anchor, tiles) {
  const inGroup = new Set(group.map(t => keyOf(t.q, t.r)));
  const kept = new Set([keyOf(anchor.q, anchor.r)]);
  const stack = [anchor];
  while (stack.length) {
    const cur = stack.pop();
    for (const [nq, nr] of neighborsOf(cur.q, cur.r)) {
      const k = keyOf(nq, nr);
      if (!inGroup.has(k) || kept.has(k)) continue;
      kept.add(k);
      stack.push(tiles.get(k));
    }
  }
  const out = [];
  for (const t of group) {
    if (kept.has(keyOf(t.q, t.r))) out.push(t);
    else {
      t.void = true;
      t.hiddenBridge = false;
      t.woundHidden = false;
      t.landmark = null;
    }
  }
  return out;
}

function applyHeight(t, seed, volcano) {
  let hgt = 0.55 + t.elev * 2.4;
  if (t.biome === 'SEA') hgt = 0.5;
  if (t.biome === 'MOUNTAIN') hgt += 0.9;
  if (t.biome === 'VOLCANO') hgt += 0.6 + (volcano && t === volcano ? 0.9 : 0);
  if (t.biome === 'ROAD') hgt = 0.55;   // shallows crossings sit low, like fords
  if (t.biome === 'BRIDGE') hgt = 0.4;
  if (t.biome === 'SECRET') hgt = 1.1;
  if (t.biome === 'ISLET') hgt = 1.0;
  if (t.biome === 'WOUND') hgt += 0.5;
  t.height = hgt;
  t.floatY = (hash2(t.q, t.r, seed + 9) - 0.5) * 0.22;
  if (t.biome === 'BRIDGE') t.floatY += Math.sin(t.cDist * 0.7) * 0.3;
  t.topY = t.floatY + t.height;
}
