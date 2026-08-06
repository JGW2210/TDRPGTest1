// Roaming enemy packs: visible hunters that drift across the world map while
// the wanderer moves — one step of theirs per hop of yours. Packs near you
// hunt; stepping onto or beside one gives battle. Slain packs re-form far
// away after enough of your footsteps. Spawns come deterministically from
// worldgen (world.roamerSpawns); live state belongs here and is saved.

import { keyOf, neighborsOf, hexDist } from './hex.js';
import { mulberry32 } from './rng.js';

const RESPAWN_HOPS = 34;   // your hops before a slain pack re-forms
const AGGRO_RANGE = 3;     // packs this close start hunting you
const WANDER_CHANCE = 0.55;

export class RoamerSystem {
  constructor(world) {
    this.world = world;
    this.roamers = world.roamerSpawns
      .map(s => ({ ...s, dead: false, respawn: 0, cool: 0, tile: world.tiles.get(keyOf(s.q, s.r)) }))
      .filter(r => r.tile && !r.tile.void);
    this._rand = mulberry32((world.seed ^ 0x517a) >>> 0);
    this.onMove = null;      // (roamer, fromTile, toTile) — world3d hop animation
    this.onRespawn = null;   // (roamer) — world3d snaps the sprite to its new lair
  }

  byId(id) { return this.roamers.find(x => x.id === id); }
  at(tile) { return this.roamers.find(r => !r.dead && r.tile === tile); }

  _allowed(t, self) {
    return t && !t.void && !t.landmark && !t.gate && t.biome !== 'BRIDGE'
      && t.region === self.region
      && !this.roamers.some(o => o !== self && !o.dead && o.tile === t);
  }

  // one world-turn: every living pack takes a step; returns a pack that has
  // caught the wanderer (on or beside their hex), or null
  step(playerTile) {
    for (const r of this.roamers) {
      if (r.dead) {
        if (--r.respawn <= 0) this._respawn(r, playerTile);
        continue;
      }
      if (r.cool > 0) r.cool--;
      const d = hexDist(r.tile.q, r.tile.r, playerTile.q, playerTile.r);
      let next = null;
      if (d <= AGGRO_RANGE && d > 0 && r.cool === 0) {
        // hunt: take the neighbor that closes the gap, if any does
        const opts = neighborsOf(r.tile.q, r.tile.r)
          .map(([q, rr]) => this.world.tiles.get(keyOf(q, rr)))
          .filter(t => t === playerTile || this._allowed(t, r))
          .sort((a, b) => hexDist(a.q, a.r, playerTile.q, playerTile.r) - hexDist(b.q, b.r, playerTile.q, playerTile.r));
        next = opts[0] || null;
        if (next && hexDist(next.q, next.r, playerTile.q, playerTile.r) >= d) next = null;
      } else if (this._rand() < WANDER_CHANCE) {
        const opts = neighborsOf(r.tile.q, r.tile.r)
          .map(([q, rr]) => this.world.tiles.get(keyOf(q, rr)))
          .filter(t => t !== playerTile && this._allowed(t, r));
        if (opts.length) next = opts[Math.floor(this._rand() * opts.length)];
      }
      if (next) {
        const from = r.tile;
        r.tile = next;
        r.q = next.q; r.r = next.r;
        if (this.onMove) this.onMove(r, from, next);
      }
    }
    for (const r of this.roamers) {
      if (r.dead || r.cool > 0) continue;
      if (hexDist(r.tile.q, r.tile.r, playerTile.q, playerTile.r) <= 1) return r;
    }
    return null;
  }

  kill(id) {
    const r = this.byId(id);
    if (r) { r.dead = true; r.respawn = RESPAWN_HOPS; }
    return r;
  }

  // a fled-from pack loses the scent for a few of your hops
  calm(id, hops = 4) {
    const r = this.byId(id);
    if (r) r.cool = hops;
  }

  _respawn(r, playerTile) {
    const home = r.region >= 100
      ? this.world.satellites[r.region - 100]?.tiles
      : this.world.regions[r.region]?.tiles;
    const cands = (home || []).filter(t =>
      !t.siteKind && this._allowed(t, r)
      && hexDist(t.q, t.r, playerTile.q, playerTile.r) >= 8);
    if (!cands.length) { r.respawn = 10; return; } // nowhere quiet yet — try later
    const t = cands[Math.floor(this._rand() * cands.length)];
    r.dead = false;
    r.cool = 0;
    r.tile = t; r.q = t.q; r.r = t.r;
    if (this.onRespawn) this.onRespawn(r);
  }

  serialize() {
    return this.roamers.map(r => ({ id: r.id, q: r.q, r: r.r, dead: r.dead, respawn: r.respawn, cool: r.cool }));
  }

  restore(saved) {
    if (!Array.isArray(saved)) return;
    for (const s of saved) {
      const r = this.byId(s.id);
      if (!r) continue;
      const t = this.world.tiles.get(keyOf(s.q, s.r));
      if (t && !t.void) { r.tile = t; r.q = s.q; r.r = s.r; }
      r.dead = !!s.dead;
      r.respawn = s.respawn | 0;
      r.cool = s.cool | 0;
    }
  }
}
