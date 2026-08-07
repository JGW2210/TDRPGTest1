// The Constellation of Echoes: persistent, cross-run progression. Feats
// inscribe echoes; echoes unlock new relics into the draw pools forever.

import { ITEMS } from './items.js';

const KEY = 'vaeldrift_meta';

export const FEATS = [
  { id: 'first_steps', name: 'First Steps', desc: 'Walk 50 hexes (across all runs)', check: m => m.stats.hexes >= 50, unlocks: 5 },
  { id: 'wayfarer', name: 'Wayfarer', desc: 'Walk 600 hexes', check: m => m.stats.hexes >= 600, unlocks: 6 },
  { id: 'first_blood', name: 'First Blood', desc: 'Win 5 battles', check: m => m.stats.battles >= 5, unlocks: 5 },
  { id: 'veteran', name: 'Veteran of the Meridian', desc: 'Win 40 battles', check: m => m.stats.battles >= 40, unlocks: 6 },
  { id: 'wardenbane', name: 'Wardenbane', desc: 'Fell your first Warden', check: m => m.stats.wardens >= 1, unlocks: 5 },
  { id: 'deepbreaker', name: 'Deepbreaker', desc: 'Fell a Warden of tier 3 or deeper', check: m => m.stats.deepWarden, unlocks: 6 },
  { id: 'keepers_end', name: 'The Keeper’s End', desc: 'Clear a dungeon descent', check: m => m.stats.keepers >= 1, unlocks: 5 },
  { id: 'vaultbreaker', name: 'Vaultbreaker', desc: 'Clear 5 dungeon descents', check: m => m.stats.keepers >= 5, unlocks: 5 },
  { id: 'moonfall', name: 'Moonfall', desc: 'Defeat the boss of the Pale Daughter', check: m => m.stats.sats?.includes('luna'), unlocks: 4 },
  { id: 'rustfall', name: 'Rustfall', desc: 'Defeat the boss of Rubidus', check: m => m.stats.sats?.includes('rubidus'), unlocks: 4 },
  { id: 'bloomfall', name: 'Bloomfall', desc: 'Defeat the boss of the Viridian Comet', check: m => m.stats.sats?.includes('viridian'), unlocks: 4 },
  { id: 'stargazer', name: 'Stargazer', desc: 'Stand upon all three wandering worlds', check: m => (m.stats.visitedSats || []).length >= 3, unlocks: 5 },
  { id: 'alchemist', name: 'Alchemist', desc: 'Ignite your first synergy', check: m => (m.stats.synergies || []).length >= 1, unlocks: 5 },
  { id: 'constellator', name: 'Constellator', desc: 'Ignite 4 different synergies (ever)', check: m => (m.stats.synergies || []).length >= 4, unlocks: 6 },
  { id: 'cracksman', name: 'Cracksman', desc: 'Blast open 3 sealed hexes', check: m => m.stats.secrets >= 3, unlocks: 5 },
  { id: 'powder_monkey', name: 'Powder Monkey', desc: 'Blast open 12 sealed hexes', check: m => m.stats.secrets >= 12, unlocks: 5 },
  { id: 'once_burned', name: 'Once Burned', desc: 'Die', check: m => m.stats.deaths >= 1, unlocks: 4 },
  { id: 'ash_repeated', name: 'Ash, Repeated', desc: 'Die 8 times', check: m => m.stats.deaths >= 8, unlocks: 5 },
  { id: 'magpie', name: 'Magpie', desc: 'Carry 12 relics in a single run', check: m => m.stats.maxItems >= 12, unlocks: 5 },
  { id: 'star_rich', name: 'Star-Rich', desc: 'Hold 150 star-shards at once', check: m => m.stats.maxShards >= 150, unlocks: 5 },
  { id: 'seamfinder', name: 'Seam-Finder', desc: 'Unfurl a hidden star-bridge', check: m => (m.stats.bridges || 0) >= 1, unlocks: 5 },
  { id: 'islefinder', name: 'Uncharted', desc: 'Reach a forgotten islet no map admits to', check: m => (m.stats.islets || 0) >= 1, unlocks: 4 },
  { id: 'changed', name: 'Changed', desc: 'Carry a cosmic mutation', check: m => (m.stats.mutations || 0) >= 1, unlocks: 4 },
  { id: 'thrice_changed', name: 'Thrice-Changed', desc: 'Tear open the Wound in the Meridian', check: m => !!m.stats.woundOpened, unlocks: 5 },
  { id: 'the_other_end', name: 'The Other End', desc: 'Close the Wound: defeat what waits inside', check: m => !!m.stats.woundClosed, unlocks: 8 },
];

class Meta {
  constructor() {
    this.data = { v: 1, feats: [], unlocked: [], stats: {
      hexes: 0, battles: 0, wardens: 0, deepWarden: false, keepers: 0,
      deaths: 0, secrets: 0, maxItems: 0, maxShards: 0, runs: 0,
      sats: [], visitedSats: [], synergies: [],
      bridges: 0, mutations: 0, woundOpened: false, woundClosed: false, packs: 0, islets: 0,
    } };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.v === 1) this.data = { ...this.data, ...parsed, stats: { ...this.data.stats, ...parsed.stats } };
      }
    } catch { /* fresh */ }
    this._save();
  }

  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }

  // All item ids currently in the draw pools: core items + earned unlocks.
  get unlockedIds() {
    const s = new Set(this.data.unlocked);
    for (const it of ITEMS) if (it.core) s.add(it.id);
    return s;
  }

  get lockedCount() { return ITEMS.length - this.unlockedIds.size; }

  // Bump a stat, then see whether any feats newly complete.
  // Returns [{feat, unlockedItems}] for the caller to announce.
  bump(fn) {
    fn(this.data.stats);
    const news = [];
    for (const feat of FEATS) {
      if (this.data.feats.includes(feat.id)) continue;
      if (feat.check(this.data)) {
        this.data.feats.push(feat.id);
        news.push({ feat, unlockedItems: this._unlockNext(feat.unlocks) });
      }
    }
    this._save();
    return news;
  }

  _unlockNext(n) {
    const have = this.unlockedIds;
    const out = [];
    for (const it of ITEMS) {
      if (out.length >= n) break;
      if (!have.has(it.id) && !this.data.unlocked.includes(it.id)) {
        this.data.unlocked.push(it.id);
        out.push(it);
      }
    }
    return out;
  }
}

export const meta = new Meta();
