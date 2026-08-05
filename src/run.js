// State of the current run. Death discards all of this and rolls a new world.

import { CONFIG } from './config.js';
import { ITEMS, SYNERGIES } from './items.js';

class Run {
  constructor() {
    this.items = [];              // item defs, in pickup order
    this.consumables = { charge: 2, dew: 1, feather: 0 };
    this.shards = 10;
    this.hp = CONFIG.battle.baseHP;
    this.clearedSites = new Set(); // site ids resolved this run
    this.openedGates = new Set();  // gate keys unlocked
    this.revealedSecrets = new Set();
    this.bossesDown = 0;
    this.battlesWon = 0;
    this.hexesVisited = new Set();
    this.reviveUsed = false;
    this._recompute();
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
      maxHP: CONFIG.battle.baseHP, atk: CONFIG.battle.baseAtk, spd: CONFIG.battle.baseSpd,
      luck: 0, dodge: 0, shardGain: 0, timingBonus: 0, blockBonus: 0,
    };
    const flags = {};
    const abilities = [];
    const tags = new Set();
    for (const it of this.items) {
      for (const [k, v] of Object.entries(it.stats || {})) s[k] = (s[k] || 0) + v;
      for (const [k, v] of Object.entries(it.flags || {})) {
        flags[k] = typeof v === 'number' ? (flags[k] || 0) + v : v;
      }
      if (it.ability) abilities.push({ ...it.ability });
      for (const t of it.tags || []) tags.add(t);
    }
    this.synergies = SYNERGIES.filter(sy => sy.tags.every(t => tags.has(t)));
    const has = id => this.synergies.some(sy => sy.id === id);
    if (has('eclipse')) s.atk += 2;
    if (has('steamveil')) { s.dodge += 10; delete flags.waterWeak; }
    if (flags.cooldownMinus) for (const a of abilities) a.cd = Math.max(1, a.cd - flags.cooldownMinus);

    s.maxHP = Math.max(10, s.maxHP);
    s.spd = Math.max(1, s.spd);
    s.atk = Math.max(1, s.atk);
    this.stats = s;
    this.flags = flags;
    this.abilities = abilities;
    this.tags = tags;
    if (this.hp > s.maxHP) this.hp = s.maxHP;
  }

  hasSynergy(id) { return this.synergies.some(sy => sy.id === id); }

  // rough strength score, used for danger comparison on gates
  get power() {
    return Math.round(this.stats.atk * 2 + this.stats.maxHP / 6 + this.stats.spd
      + this.stats.luck / 8 + this.items.length * 1.5);
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
