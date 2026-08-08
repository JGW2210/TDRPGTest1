// State of the current run. Death discards all of this and rolls a new world.

import { CONFIG } from './config.js';
import { ITEMS, SYNERGIES, SETS } from './items.js';

class Run {
  constructor() {
    this.items = [];              // item defs, in pickup order
    this.consumables = { charge: 2, dew: 0, feather: 0 };
    this.shards = 10;
    this.hp = CONFIG.battle.vessels.base;   // half Star Vessels
    this.vesselBonus = 0;         // permanent halves earned (warden hearts)
    this.clearedSites = new Set(); // site ids resolved this run
    this.openedGates = new Set();  // gate keys unlocked
    this.revealedSecrets = new Set();
    this.bossesDown = 0;
    this.battlesWon = 0;
    this.hexesVisited = new Set();
    this.reviveUsed = false;
    this.shrineHeals = 0;          // wayshrine offerings this run (cost escalates)
    this.boons = [];               // blessings & bargains: { id, name, stats?, flags? }
    this.shrineBoons = new Set();  // shrine site ids already communed with
    this.vantageSeen = new Set();  // celestial voices already heard
    this.skyChats = {};            // speaker id → completed visits (dialogue sets cycle)
    this.keepsakes = [];           // statless errand tokens (names.KEEPSAKES ids)
    this.questsDone = new Set();   // speakers whose errands have paid out
    this.woundOpen = false;        // the Wound has torn open this run
    this.fallerArrived = false;    // the last visitor has come down this run
    this._recompute();
  }

  get mutationCount() { return this.items.filter(i => i.mutation).length; }

  addBoon(boon) {
    this.boons.push(boon);
    const before = this.stats.maxHP;
    this._recompute();
    if (this.stats.maxHP > before) this.hp += this.stats.maxHP - before;
    this.hp = Math.min(this.hp, this.stats.maxHP);
  }

  // A permanent Star Vessel gain (in halves) — warden hearts and the like.
  // The new capacity arrives full.
  addVessels(halves) {
    this.vesselBonus += halves;
    const before = this.stats.maxHP;
    this._recompute();
    if (this.stats.maxHP > before) this.hp += this.stats.maxHP - before;
    this.hp = Math.min(this.hp, this.stats.maxHP);
  }

  removeItem(id) {
    const i = this.items.findIndex(it => it.id === id);
    if (i < 0) return null;
    const [gone] = this.items.splice(i, 1);
    this._recompute();
    return gone;
  }

  get ownedIds() { return new Set(this.items.map(i => i.id)); }

  addItem(item) {
    this.items.push(item);
    const before = this.stats.maxHP;
    this._recompute();
    // gaining max HP also grants the difference as healing
    if (this.stats.maxHP > before) this.hp += this.stats.maxHP - before;
    this.hp = Math.min(this.hp, this.stats.maxHP);
  }

  _recompute() {
    const s = {
      vessel: 0, atk: CONFIG.battle.baseAtk, spd: CONFIG.battle.baseSpd,
      luck: 0, dodge: 0, shardGain: 0, focus: 0,
    };
    const flags = {};
    const abilities = [];
    const tagCounts = {};
    for (const it of this.items) {
      for (const [k, v] of Object.entries(it.stats || {})) s[k] = (s[k] || 0) + v;
      for (const [k, v] of Object.entries(it.flags || {})) {
        flags[k] = typeof v === 'number' ? (flags[k] || 0) + v : v;
      }
      if (it.ability) abilities.push({ ...it.ability });
      for (const t of it.tags || []) tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
    // blessings and bargains layer on top of the hoard
    for (const b of this.boons || []) {
      for (const [k, v] of Object.entries(b.stats || {})) s[k] = (s[k] || 0) + v;
      for (const [k, v] of Object.entries(b.flags || {})) {
        flags[k] = typeof v === 'number' ? (flags[k] || 0) + v : v;
      }
    }
    this.tagCounts = tagCounts;
    const setDone = tag => (tagCounts[tag] || 0) >= (SETS[tag]?.need ?? 3);
    this.synergies = SYNERGIES.filter(sy => sy.sets.every(setDone));
    const has = id => this.synergies.some(sy => sy.id === id);

    // set synergies
    if (has('cinderhost')) { s.atk += 1; flags.burnOnHit = (flags.burnOnHit || 0) + 1; }
    if (has('glassworks')) s.luck += 12;
    if (has('moonbound')) { s.dodge += 10; flags.firstStrikeDodge = true; }
    if (has('high_noon')) s.atk += 2;
    if (has('tideborne')) { s.dodge += 5; flags.afterBattleHeal = (flags.afterBattleHeal || 0) + 1; }
    // grand synergies
    if (has('fulgurite')) { s.atk += 2; flags.burnOnHit = (flags.burnOnHit || 0) + 2; }
    if (has('eclipse')) { s.atk += 3; s.focus += 2; }
    if (has('steamveil')) { s.dodge += 15; delete flags.waterWeak; flags.blockHeal = (flags.blockHeal || 0) + 2; }
    if (has('pale_hand')) flags.houndStrike = Math.max(flags.houndStrike || 0, 8);
    if (has('stained_glass')) { s.luck += 12; s.shardGain += 15; }
    if (flags.noFirstDodge) delete flags.firstStrikeDodge;   // the Eyes never close
    if (flags.cooldownMinus) for (const a of abilities) a.cd = Math.max(1, a.cd - flags.cooldownMinus);

    // max Star Vessels (halves): base + relic/boon vessels + earned hearts
    const V = CONFIG.battle.vessels;
    s.maxHP = Math.max(V.min, Math.min(V.cap, V.base + s.vessel + this.vesselBonus));
    s.spd = Math.max(1, s.spd);
    s.atk = Math.max(1, s.atk);
    this.stats = s;
    this.flags = flags;
    this.abilities = abilities;
    this.tags = new Set(Object.keys(tagCounts));
    if (this.hp > s.maxHP) this.hp = s.maxHP;
  }

  hasSynergy(id) { return this.synergies.some(sy => sy.id === id); }

  // What the wanderer looks like now — read by the texture painter.
  // Tags leave small marks, complete sets transform, grand synergies more so.
  get appearance() {
    const completeSets = [];
    for (const [tag, def] of Object.entries(SETS)) {
      if ((this.tagCounts[tag] || 0) >= def.need) completeSets.push(tag);
    }
    return {
      tagCounts: { ...this.tagCounts },
      completeSets,
      grand: this.synergies.filter(sy => sy.grand).map(sy => sy.id),
      itemCount: this.items.length,
      mutations: this.items.filter(i => i.mutation).map(i => i.id),
    };
  }

  // a stable signature so views only repaint when the look actually changes
  get appearanceSig() {
    const a = this.appearance;
    const tags = Object.keys(a.tagCounts).sort().map(t => t + Math.min(a.tagCounts[t], 3)).join(',');
    return tags + '|' + a.completeSets.join(',') + '|' + a.grand.join(',')
      + '|' + Math.min(a.itemCount, 8) + '|' + a.mutations.join(',');
  }

  // rough strength score, used for danger comparison on gates
  // (maxHP is in half-vessels now: base 10 halves contributes the same 5
  // points the old 30-HP pool did, so the expectedPower curve still holds)
  get power() {
    return Math.round(this.stats.atk * 2 + this.stats.maxHP / 2 + this.stats.spd
      + (this.stats.focus || 0) + this.items.length * 1.5);
  }

  gainShards(n) {
    const mult = 1 + (this.stats.shardGain || 0) / 100;
    const got = Math.max(0, Math.round(n * mult));
    this.shards += got;
    return got;
  }

  spendShards(n) {
    if (this.shards < n) return false;
    this.shards -= n;
    return true;
  }
}

export const run = new Run();
