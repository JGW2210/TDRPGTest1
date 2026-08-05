// The roguelike layer: a Binding-of-Isaac-style table of items and abilities.
// Items are drawn blind from biome-linked pools; many carry downsides, and
// certain tag pairs ignite synergies that change how battles play.
//
// stat keys: maxHP, atk, spd, luck (crit %), dodge (%), shardGain (%),
//            timingBonus (widens/boosts timing), blockBonus
// flag keys are read directly by the battle engine / world systems.

import { pick } from './rng.js';

export const ITEMS = [
  // ------------------------------------------------------------- MEADOW ---
  {
    id: 'clover_locket', pool: 'MEADOW', name: 'Cloverheart Locket',
    stats: { maxHP: 10, atk: -1 }, tags: ['bloom'],
    flags: { afterBattleHeal: 3 },
    desc: '+10 max HP, −1 ATK. Heal 3 after each battle.',
    flavor: 'Four leaves, three wishes, two owners, one heartbeat.',
  },
  {
    id: 'runeboar_tusk', pool: 'MEADOW', name: 'Runeboar Tusk',
    stats: { atk: 2 }, tags: [],
    flags: { chargeDropBonus: 0.15 },
    desc: '+2 ATK. Foes drop star-charges more often.',
    flavor: 'Still warm. Still stubborn.',
  },
  {
    id: 'dawn_thimble', pool: 'MEADOW', name: 'Dawn Thimble',
    stats: {}, tags: ['sun'],
    flags: { firstHitPerfect: true },
    desc: 'Your first strike each battle is automatically Perfect.',
    flavor: 'It fits the finger you point with.',
  },
  // ------------------------------------------------------------- FOREST ---
  {
    id: 'owlbat_whistle', pool: 'FOREST', name: 'Owlbat Whistle',
    stats: {}, tags: [],
    ability: { id: 'echo_shriek', name: 'Echo Shriek', cd: 3, kind: 'aoe', mult: 0.7, desc: 'Strike every foe for 70% ATK.' },
    desc: 'Grants ability: Echo Shriek (all foes, 70% ATK, 3-turn cooldown).',
    flavor: 'Silent to you. Unforgettable to everyone else.',
  },
  {
    id: 'mosscloak', pool: 'FOREST', name: 'Mosscloak',
    stats: { dodge: 15, spd: -1 }, tags: ['bloom'],
    desc: '+15% dodge, −1 SPD.',
    flavor: 'Grows on you.',
  },
  {
    id: 'fernking_crown', pool: 'FOREST', name: 'The Fern King’s Crown',
    stats: { atk: 2, maxHP: 5 }, tags: ['bloom'],
    flags: { shopMarkup: 0.25 },
    desc: '+2 ATK, +5 max HP. Merchants resent royalty: shop prices +25%.',
    flavor: 'Heavy is the head. Itchy, also.',
  },
  // ----------------------------------------------------------- MOUNTAIN ---
  {
    id: 'echo_hammer', pool: 'MOUNTAIN', name: 'Echo Hammer',
    stats: {}, tags: [],
    flags: { perfectEcho: 0.5 },
    desc: 'Perfect strikes echo, repeating for 50% damage.',
    flavor: 'Every blow lands twice: once on the foe, once on the mountain’s memory.',
  },
  {
    id: 'granite_skin', pool: 'MOUNTAIN', name: 'Granite Skin',
    stats: { spd: -2 }, tags: [],
    flags: { firstHitHalved: true },
    desc: 'The first blow you take each battle is halved. −2 SPD.',
    flavor: 'You are 4% gravel now. It suits you.',
  },
  {
    id: 'vertigo_charm', pool: 'MOUNTAIN', name: 'Vertigo Charm',
    stats: { spd: 3, luck: 5 }, tags: [],
    desc: '+3 SPD, +5% crit.',
    flavor: 'The trick is to fall upward, socially.',
  },
  // ------------------------------------------------------------ VOLCANO ---
  {
    id: 'emberheart', pool: 'VOLCANO', name: 'Emberheart',
    stats: {}, tags: ['ember'],
    flags: { burnOnHit: 2, waterWeak: 2 },
    desc: 'Your strikes Burn (2/turn, 2 turns). Take +2 damage from water foes.',
    flavor: 'A coal that chose you as its fireplace.',
  },
  {
    id: 'choir_coal', pool: 'VOLCANO', name: 'Choir Coal',
    stats: {}, tags: ['ember'],
    ability: { id: 'cinder_hymn', name: 'Cinder Hymn', cd: 4, kind: 'burn_all', burn: 3, desc: 'Set every foe Burning (3/turn, 3 turns).' },
    desc: 'Grants ability: Cinder Hymn (burn all foes, 4-turn cooldown).',
    flavor: 'It hums in your pack. The key is always dread-minor.',
  },
  {
    id: 'slag_plate', pool: 'VOLCANO', name: 'Slag Plate',
    stats: { maxHP: 12, spd: -2 }, tags: ['ember'],
    desc: '+12 max HP, −2 SPD.',
    flavor: 'Forged from the volcano’s discarded opinions.',
  },
  // ------------------------------------------------------------- DESERT ---
  {
    id: 'glass_quill', pool: 'DESERT', name: 'Glass Quill',
    stats: { luck: 12 }, tags: ['glass'],
    flags: { critShatter: 2 },
    desc: '+12% crit. Crits shatter: your next strike gains +2 damage.',
    flavor: 'Writes only in past tense.',
  },
  {
    id: 'mirage_veil', pool: 'DESERT', name: 'Mirage Veil',
    stats: { dodge: 20, maxHP: -5 }, tags: ['glass'],
    desc: '+20% dodge, −5 max HP. You are slightly less real now.',
    flavor: 'Wear it and stand somewhere you are not.',
  },
  {
    id: 'sunbrand', pool: 'DESERT', name: 'Sunbrand',
    stats: {}, tags: ['sun'],
    flags: { fullHPAtk: 3 },
    desc: '+3 ATK while at full HP.',
    flavor: 'The mark of noon, which forgives nothing.',
  },
  // ------------------------------------------------------------- TUNDRA ---
  {
    id: 'frostmarrow_ring', pool: 'TUNDRA', name: 'Frostmarrow Ring',
    stats: {}, tags: ['moon'],
    flags: { chillOnHit: 1 },
    desc: 'Your strikes Chill, stacking −1 to the foe’s ATK.',
    flavor: 'Cold enough to slow an argument.',
  },
  {
    id: 'pale_hound_card', pool: 'TUNDRA', name: 'Pale Card: “The Hound”',
    stats: {}, tags: ['card', 'moon'],
    flags: { houndStrike: 6 },
    desc: 'As each battle begins, the Hound is dealt: 6 damage to a random foe.',
    flavor: 'It is drawn. It was always going to be drawn.',
  },
  {
    id: 'sleet_mantle', pool: 'TUNDRA', name: 'Sleet Mantle',
    stats: { blockBonus: 1 }, tags: ['moon'],
    desc: 'Your Block window is 50% wider.',
    flavor: 'The storm signs its work; this is a forgery good enough to fool it.',
  },
  // ---------------------------------------------------------------- SEA ---
  {
    id: 'siren_scale', pool: 'SEA', name: 'Siren Scale',
    stats: {}, tags: ['water'],
    flags: { perfectHeal: 3 },
    desc: 'Perfect strikes restore 3 HP.',
    flavor: 'Still singing, very quietly, about you.',
  },
  {
    id: 'fathom_pearl', pool: 'SEA', name: 'Fathom Pearl',
    stats: { maxHP: 5, atk: 1, spd: 1, luck: 5, shardGain: -33 }, tags: ['water'],
    desc: '+5 HP, +1 ATK, +1 SPD, +5% crit — but shard finds −33%.',
    flavor: 'Everything the deep owns, it lends at interest.',
  },
  {
    id: 'anglers_lure', pool: 'SEA', name: 'Void Angler’s Lure',
    stats: {}, tags: ['water'],
    flags: { fewerFoes: true },
    desc: 'Wild battles muster one fewer foe (minimum 1).',
    flavor: 'Whatever it is fishing for, it is not you. Probably.',
  },
  // ------------------------------------------------------------ CRYSTAL ---
  {
    id: 'prism_core', pool: 'CRYSTAL', name: 'Prism Core',
    stats: { timingBonus: 1 }, tags: ['glass'],
    desc: 'All your timing multipliers are raised by +0.15.',
    flavor: 'Light enters confused and leaves determined.',
  },
  {
    id: 'chime_shard', pool: 'CRYSTAL', name: 'Chime Shard',
    stats: {}, tags: ['glass'],
    ability: { id: 'resonance', name: 'Resonance', cd: 4, kind: 'stun', desc: 'Ring a foe’s bones: it loses its next turn.' },
    desc: 'Grants ability: Resonance (stun one foe, 4-turn cooldown).',
    flavor: 'Struck once, it rings forever; the trick is aiming the forever.',
  },
  {
    id: 'facet_eye', pool: 'CRYSTAL', name: 'Facet Eye',
    stats: { luck: 10 }, tags: ['glass'],
    flags: { seeIntent: true },
    desc: '+10% crit. You see what each foe intends to do next.',
    flavor: 'Blink schedule: never.',
  },
  // ---------------------------------------------------------------- ANY ---
  {
    id: 'shard_purse', pool: 'ANY', name: 'Star-Shard Purse',
    stats: { shardGain: 50 }, tags: [],
    flags: { extraFoeChance: 0.25 },
    desc: 'Shard finds +50%. Trouble finds you too: +25% chance of an extra foe.',
    flavor: 'It jingles. Everything within a mile knows it jingles.',
  },
  {
    id: 'boots_remember', pool: 'ANY', name: 'Boots That Remember',
    stats: { spd: 2 }, tags: [],
    flags: { fastTravel: true },
    desc: '+2 SPD. You hop the world map much faster.',
    flavor: 'They know the way home. They are simply not telling.',
  },
  {
    id: 'patient_comet', pool: 'ANY', name: 'The Patient Comet',
    stats: {}, tags: ['sun'],
    flags: { extraActionEvery: 4 },
    desc: 'Every 4th turn, take a second action.',
    flavor: 'It has waited nine thousand years. It can wait for your turn.',
  },
  {
    id: 'reassuring_pebble', pool: 'ANY', name: 'A Very Reassuring Pebble',
    stats: { maxHP: 5 }, tags: [],
    desc: '+5 max HP. It’s going to be okay.',
    flavor: 'Smooth. Round. Unshakeably on your side.',
  },
  // --------------------------------------------------------------- BOSS ---
  {
    id: 'wardens_sigil', pool: 'BOSS', name: 'Warden’s Sigil',
    stats: { atk: 3, maxHP: 10 }, tags: [],
    desc: '+3 ATK, +10 max HP.',
    flavor: 'Authority, transferable upon defeat. See reverse for terms.',
  },
  {
    id: 'sundered_crown', pool: 'BOSS', name: 'The Sundered Crown',
    stats: { maxHP: -5 }, tags: ['card'],
    flags: { cooldownMinus: 1 },
    desc: 'Ability cooldowns −1 turn. −5 max HP: crowns are heavy, even broken.',
    flavor: 'Its former head insists this is all part of the plan.',
  },
  {
    id: 'meridian_compass', pool: 'BOSS', name: 'Meridian Compass',
    stats: { spd: 1 }, tags: [],
    flags: { revealRegion: true },
    desc: '+1 SPD. Entering a region charts it all into hazy memory.',
    flavor: 'It points to where you will eventually have been.',
  },
  // -------------------------------------------------------------- ASTRAL ---
  {
    id: 'lunar_grace', pool: 'ASTRAL', name: 'Lunar Grace',
    stats: {}, tags: ['moon'],
    flags: { reviveOnce: true },
    desc: 'Once per run, death becomes moonlight: revive at half HP.',
    flavor: 'The Pale Daughter keeps one promise per pilgrim.',
  },
  {
    id: 'crimson_mote', pool: 'ASTRAL', name: 'Crimson Mote',
    stats: { atk: 2 }, tags: ['ember'],
    flags: { burnDouble: true },
    desc: '+2 ATK. All Burn damage you inflict is doubled.',
    flavor: 'A spark from Rubidus, still furious about the rain.',
  },
  {
    id: 'cometborne_sail', pool: 'ASTRAL', name: 'Cometborne Sail',
    stats: { spd: 3, dodge: 10 }, tags: ['sun'],
    flags: { fastTravel: true },
    desc: '+3 SPD, +10% dodge, and you hop the world map much faster.',
    flavor: 'Catches a wind that blows only between worlds.',
  },
];

// Synergies: both tags present → the effect ignites. Checked by the battle
// engine via run.hasSynergy(id).
export const SYNERGIES = [
  {
    id: 'fulgurite', tags: ['ember', 'glass'], name: 'FULGURITE',
    desc: 'Fire through glass: your crits also Burn (3/turn, 3 turns).',
  },
  {
    id: 'pale_hand', tags: ['moon', 'card'], name: 'THE PALE HAND',
    desc: 'The Hound hunts in moonlight: its opening strike also Chills (−2 ATK).',
  },
  {
    id: 'steamveil', tags: ['ember', 'water'], name: 'STEAMVEIL',
    desc: 'Fire meets sea: your water weakness is annulled and steam grants +10% dodge.',
  },
  {
    id: 'eclipse', tags: ['sun', 'moon'], name: 'ECLIPSE',
    desc: 'Sun and moon align: +2 ATK, and Perfect windows widen.',
  },
];

// --------------------------------------------------------------- drawing ---

const POOL_FALLBACK = ['ANY'];

export function drawItem(rng, pool, ownedIds) {
  const tryPools = [pool, ...POOL_FALLBACK];
  for (const p of tryPools) {
    const cands = ITEMS.filter(i => i.pool === p && !ownedIds.has(i.id));
    if (cands.length) return pick(rng, cands);
  }
  const any = ITEMS.filter(i => !ownedIds.has(i.id));
  return any.length ? pick(rng, any) : null;
}

export const CONSUMABLES = {
  charge: {
    id: 'charge', name: 'Star-Charge', icon: '✸',
    desc: 'Detonate on the world map to blast open an adjacent sealed hex — or hurl in battle for heavy damage to all foes.',
  },
  dew: {
    id: 'dew', name: 'Star-Dew', icon: '❋',
    desc: 'Drink to restore 15 HP. Usable in and out of battle.',
  },
  feather: {
    id: 'feather', name: 'Homing Feather', icon: '➳',
    desc: 'Whisks you back to Starfall Vale from anywhere on the world map.',
  },
};
