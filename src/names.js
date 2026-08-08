// The lore layer: biomes, the four Celestial Courts, and generators for
// every named thing in Vaeldrift. All generation is fed a seeded rng.

import { pick } from './rng.js';

export const WORLD_NAME = 'Vaeldrift';
export const WORLD_EPITHET = 'the Shattered Meridian';

// ---------------------------------------------------------------- biomes ---

export const BIOMES = {
  MEADOW:  { name: 'Starlit Meadow',  color: 0x6f9e4f, accent: 0xbfe08a, deco: 'grass'  },
  FOREST:  { name: 'Sighing Forest',  color: 0x2f7a54, accent: 0x64d9a0, deco: 'tree'   },
  MOUNTAIN:{ name: 'Cloudpiercers',   color: 0x8d8aa8, accent: 0xd4d2ef, deco: 'peak'   },
  VOLCANO: { name: 'Ember Wastes',    color: 0x4a3138, accent: 0xff7a45, deco: 'ember'  },
  DESERT:  { name: 'Glass Dunes',     color: 0xd9a75f, accent: 0xffe4a3, deco: 'cactus' },
  TUNDRA:  { name: 'Pale Expanse',    color: 0xb9d2e4, accent: 0xeaf7ff, deco: 'shard'  },
  SEA:     { name: 'Astral Shallows', color: 0x2b3a78, accent: 0x6f9bff, deco: 'sea'    },
  CRYSTAL: { name: 'Prism Fields',    color: 0x6d4a94, accent: 0xd79bff, deco: 'crystal'},
  ROAD:    { name: 'Warded Shallows', color: 0x33619e, accent: 0xf0c46a, deco: null     },
  BRIDGE:  { name: 'Star-Bridge',     color: 0x4a5aa8, accent: 0x9fe8ff, deco: null     },
  ISLET:   { name: 'Forgotten Islet', color: 0x4a5a7e, accent: 0xd8ffb0, deco: 'shard'  },
  LUNAR:   { name: 'Lunar Shale',     color: 0xc8c8de, accent: 0xf2f2ff, deco: 'shard'  },
  CRIMSON: { name: 'Crimson Waste',   color: 0x9e4a3c, accent: 0xff9a6a, deco: 'cactus' },
  VERDANT: { name: 'Verdant Drift',   color: 0x3c8a5e, accent: 0x8affc4, deco: 'crystal'},
  SECRET:  { name: 'Hollowed Secret', color: 0x54406e, accent: 0xffd98a, deco: 'crystal'},
  WOUND:   { name: 'The Wound',       color: 0x3a1430, accent: 0xa6ff57, deco: 'crystal'},
  CRASH:   { name: 'Fallen Shallows', color: 0x35476b, accent: 0xffb46a, deco: 'sea'    },
};

// ------------------------------------------------------------- satellites ---

export const SATELLITES = [
  {
    id: 'luna',
    name: 'The Pale Daughter',
    biome: 'LUNAR',
    angle: -2.2,
    boss: { name: 'The Tide-Warden Selureth', flavor: 'A moth-winged colossus of moonlight that keeps the tides of a sea that is no longer there.' },
  },
  {
    id: 'rubidus',
    name: 'Rubidus, the Rust Wanderer',
    biome: 'CRIMSON',
    angle: 0.6,
    boss: { name: 'The Oxidized King', flavor: 'A crowned engine of red dust and grievance. It remembers being a god of iron; the iron remembers otherwise.' },
  },
  {
    id: 'viridian',
    name: 'The Viridian Comet',
    biome: 'VERDANT',
    angle: 2.6,
    boss: { name: 'Rootmother of the Long Fall', flavor: 'A garden that learned to hunt during ten thousand years of falling. Its orbit is a stalk; its flowers are patient.' },
  },
];

// ------------------------------------------------------ forgotten islets ---
// Tiny worlds adrift in the void, each holding on out of sheer stubbornness.
// A folded footbridge waits beside the nearest shore; a star-charge on the
// humming shore unfurls it.

export const ISLETS = [
  {
    id: 'hermit',
    name: 'The Hermit’s Ledger',
    sub: 'a lamplit rock that keeps accounts',
    flavor: 'One hut, one lamp, one very long ledger. The hermit has been tallying what the world owes the void, and the margin notes are getting personal.',
  },
  {
    id: 'wreck',
    name: 'Wreck of the Vainglory',
    sub: 'a sky-ship that argued with gravity',
    flavor: 'The Vainglory set out to circle the Meridian in nine days. The void kept the ship; the cargo manifest survives, and so does some of the cargo.',
  },
  {
    id: 'observatory',
    name: 'The Sundered Observatory',
    sub: 'still watching, out of habit',
    flavor: 'Half an observatory, torn loose in the Shattering, its great brass eye still tracking a star that no longer rises. The astronomers left in a hurry. Their instruments did not.',
  },
];

// ------------------------------------------------------ crashed visitors ---
// Ten bodies that did not stay in the sky. One to three of them lie embedded
// in every world, each in a crater of fallen shallows ringed with its own
// debris; each came down with a guardian (or grew one on the way), and each
// carries exactly one set change for whoever survives the introduction.

export const VISITORS = [
  {
    id: 'iron_seed',
    name: 'The Iron Seed',
    sub: 'dropped, never planted',
    flavor: 'A riveted ovoid taller than a chapel, split along a single seam. Whatever was meant to grow from it is still inside, holding its breath. It has been holding it a very long time, and it is getting good at it.',
    guardian: { name: 'The Husk Gardener', role: 'guard',
      flavor: 'It tends the Seed with hands of bent hull-plate. Watering has not worked. Singing has not worked. It has lately begun considering what a seed this size might want to be fed.' },
    mutation: 'rivet_skin',
    color: '#aab4c8', glow: '#ffb46a',
  },
  {
    id: 'glasswing',
    name: 'The Glasswing',
    sub: 'the head of a comet that lost its argument',
    flavor: 'The comet came down mid-sentence. Its head survives as a teardrop of green-white glass; its tail lies strewn across the crater as a thousand bright commas. The argument, by all readings, is still going.',
    guardian: { name: 'The Tailless Rider', role: 'swift',
      flavor: 'Something rode that comet for an age, steering with its knees. It walked away from the landing. It has not yet forgiven the landing.' },
    mutation: 'comet_marrow',
    color: '#9fe8d8', glow: '#c9fff0',
  },
  {
    id: 'kneeling_star',
    name: 'The Kneeling Star',
    sub: 'it did not crash; it landed, and knelt',
    flavor: 'Every other visitor fell. This one descended. It rests in its crater in an attitude of perfect genuflection, light pooled around it like spilled prayer. Nobody knows what it is kneeling to. The candidates are all worrying.',
    guardian: { name: 'The Last Congregant', role: 'mystic',
      flavor: 'The star came down with a congregation. The others finished their worship and left. This one found something in the liturgy it cannot put down.' },
    mutation: 'pilgrim_tongue',
    color: '#ffd98a', glow: '#fff0c0',
  },
  {
    id: 'patient_egg',
    name: 'The Egg of Something Patient',
    sub: 'warm on the side facing away from the sun',
    flavor: 'A speckled stone egg the size of a watch-tower, sitting in its crater with the smugness of a thing exactly where it means to be. It is warm — but only on the side facing away from Vael, which the scholars agree is the wrong side, and do not discuss further.',
    guardian: { name: 'The Brood Sentry', role: 'brute',
      flavor: 'Whatever laid the egg left a sentry. The sentry has waited so long it has begun to think of the egg as its own, which will make the hatching awkward for everyone.' },
    mutation: 'patient_yolk',
    color: '#d8c9a8', glow: '#ffe9b0',
  },
  {
    id: 'chained_choir',
    name: 'The Chained Choir',
    sub: 'a meteor wrapped in chains older than its fall',
    flavor: 'A black meteor bound in seven great chains — and the chains show more wear than the fall could account for. Put an ear to the stone and it hums in close harmony. The chains, one supposes, are the reason it only hums.',
    guardian: { name: 'The Warden of Links', role: 'guard',
      flavor: 'Someone forged a warden to keep the chains taut. It does not know what the Choir sings about. It has standing orders never to learn.' },
    mutation: 'link_vow',
    color: '#a8b4d8', glow: '#cfd8ff',
  },
  {
    id: 'mirrorshard',
    name: 'The Sky’s Mirrorshard',
    sub: 'a piece of sky showing somewhere else’s weather',
    flavor: 'A shard of the firmament itself, snapped off in the Shattering and fallen point-first into the shallows. It still shows sky — just not this one. The clouds in it move against the wind, and once a day something very large swims across it.',
    guardian: { name: 'The Reflection That Stayed', role: 'swift',
      flavor: 'Stand before the shard and your reflection arrives a heartbeat late. This one belonged to somebody who walked away. It has had a long time to practice being them.' },
    mutation: 'elsewhere_eye',
    color: '#bfd8ff', glow: '#e6f0ff',
  },
  {
    id: 'burning_anvil',
    name: 'The Anvil That Fell Burning',
    sub: 'the forge-heart of an unfinished star',
    flavor: 'Stars are forged somewhere, on something. This is one of the somethings — an anvil the size of a barrow, still too hot to touch, its face scarred with the first draft of a sun that never went to press.',
    guardian: { name: 'The Unfinished Work', role: 'brute',
      flavor: 'The last thing on the anvil came down with it, half-made. It is angry the way only an unfinished thing can be: at everything, and specifically at you, who are finished.' },
    mutation: 'anvil_arm',
    color: '#ff8a5a', glow: '#ffc27a',
  },
  {
    id: 'knotted_star',
    name: 'The Knotted Star',
    sub: 'someone tied it; no one has untied it',
    flavor: 'A small star tied in a knot no sailor will admit to knowing. The knot predates the fall, the fall predates the maps, and the light leaks out along the crossings in thin, indignant lines.',
    guardian: { name: 'The Untier', role: 'mystic',
      flavor: 'It has worked at the knot for centuries with fingers grown specifically for the task. It is nearly certain the knot ties something IN. It picks at it anyway. It has to know.' },
    mutation: 'knot_memory',
    color: '#d79bff', glow: '#eccfff',
  },
  {
    id: 'door_splinter',
    name: 'A Splinter of the Door',
    sub: 'it fell when the Door was leaned upon',
    flavor: 'When the eldest daughter leaned past the Door Ajar, the frame gave — a little. This is the little: one splinter of a door that stands in the sky, buried here point-down like a thrown knife. The grain of it shows hinges all the way through.',
    guardian: { name: 'The Hinge-Keeper', role: 'guard',
      flavor: 'Doors have keepers on both sides. When the splinter fell, one came down with it — still keeping, out of principle, a door that is no longer attached to anything.' },
    mutation: 'threshold_step',
    color: '#9fb0ff', glow: '#d0daff',
  },
  {
    id: 'leviathan_skull',
    name: 'The Leviathan’s Skull',
    sub: 'the sky remembers when it swam',
    flavor: 'Before the Shattering, things swam between the moons the way whales swim between islands. This is the skull of one — vast, bleached by starlight, fallen brow-first so its empty gaze watches the crater rim like a tide line it still expects to turn.',
    guardian: { name: 'What Nested Inside', role: 'brute',
      flavor: 'A skull that size does not stay empty. Something moved in, redecorated, and has strong opinions about visitors — being, itself, the second one.' },
    mutation: 'leviathan_gut',
    color: '#cfd8c8', glow: '#f0f5e8',
  },
];

// ------------------------------------------------------ cosmic landmarks ---

export const CELESTIALS = {
  giant: { name: 'Thal-Vaur, the Sleeping Giant', sub: 'it has not turned over in an age' },
  comet: { id: 'errand', name: 'The Errand', sub: 'always going, never arriving' },
  shattermoons: [
    { id: 'm_sundered', name: 'The Sundered Daughter', sub: 'a moon that argued with the tide' },
    { id: 'm_grief', name: 'Grief-of-Glass', sub: 'still falling, very slowly' },
  ],
  constellations: [
    { id: 'c_ferryman', name: 'The Ferryman', sub: 'constellation' },
    { id: 'c_cup', name: 'The Spilled Cup', sub: 'constellation' },
    { id: 'c_hound', name: 'The Patient Hound', sub: 'constellation' },
    { id: 'c_cartographer', name: 'The Second Cartographer', sub: 'constellation' },
  ],
};

// ----------------------------------------------------------- region names ---

const REGION_PRE = {
  MEADOW: 'Lark', FOREST: 'Thorn', MOUNTAIN: 'Anvil', VOLCANO: 'Ember',
  DESERT: 'Glass', TUNDRA: 'Pale', SEA: 'Drift', CRYSTAL: 'Prism',
};
const REGION_SUF = ['march', 'reach', 'wild', 'verge', 'fold', 'deep', 'fell', 'hold'];

export function regionName(rng, dominantBiome) {
  const pre = REGION_PRE[dominantBiome] || 'Star';
  return 'The ' + pre + pick(rng, REGION_SUF);
}

// ---------------------------------------------------------- battle rosters ---
// role: brute (slow, heavy), swift (fast, light), mystic (burn/chill tricks),
// guard (armored, blocks)

export const FOES = {
  MEADOW:  [{ n: 'Runeboar', r: 'brute' }, { n: 'Meadow Wisp', r: 'swift' }, { n: 'Sickle Automaton', r: 'guard' }],
  FOREST:  [{ n: 'Bramble Wolfshade', r: 'swift' }, { n: 'Moss-Sung Treant', r: 'brute' }, { n: 'Owlbat', r: 'swift' }],
  MOUNTAIN:[{ n: 'Echo Wyvern', r: 'swift' }, { n: 'Granite Sentinel', r: 'guard' }, { n: 'Rockslide Gremlin', r: 'brute' }],
  VOLCANO: [{ n: 'Cinder Choirling', r: 'mystic' }, { n: 'Magma Seraph', r: 'brute' }, { n: 'Ash Salamander', r: 'swift' }],
  DESERT:  [{ n: 'Glasscoil Serpent', r: 'swift' }, { n: 'Sun-Bleached Revenant', r: 'brute' }, { n: 'Dune Mawfish', r: 'guard' }],
  TUNDRA:  [{ n: 'Frostmarrow Stag', r: 'mystic' }, { n: 'The Loosed Hound', r: 'swift' }, { n: 'Sleetclad Mammoth', r: 'brute' }],
  SEA:     [{ n: 'Star-Drowned Siren', r: 'mystic' }, { n: 'Void Angler', r: 'brute' }, { n: 'Brine Reflection', r: 'swift' }],
  CRYSTAL: [{ n: 'Prism Shard-Golem', r: 'guard' }, { n: 'Chiming Widow', r: 'mystic' }, { n: 'Facet Stalker', r: 'swift' }],
  ROAD:    [{ n: 'Toll Wraith', r: 'mystic' }, { n: 'Waylaid Knight', r: 'guard' }],
  BRIDGE:  [{ n: 'Bridge Haunt', r: 'mystic' }, { n: 'Star Remora', r: 'swift' }],
  LUNAR:   [{ n: 'Moon Moth', r: 'swift' }, { n: 'Pale Pilgrim', r: 'mystic' }, { n: 'Crater Hermit', r: 'guard' }],
  CRIMSON: [{ n: 'Rust Hound', r: 'swift' }, { n: 'Oxide Shambler', r: 'brute' }, { n: 'Dust Chorister', r: 'mystic' }],
  VERDANT: [{ n: 'Seed Sentinel', r: 'guard' }, { n: 'Vine Lasher', r: 'swift' }, { n: 'Bloom Horror', r: 'brute' }],
  SECRET:  [{ n: 'Hoard Mimic', r: 'brute' }],
  ISLET:   [{ n: 'Bridge Haunt', r: 'mystic' }, { n: 'Star Remora', r: 'swift' }],
  WOUND:   [{ n: 'Meridian Leech', r: 'swift' }, { n: 'Unfolded Pilgrim', r: 'mystic' }, { n: 'The Choir Below', r: 'brute' }],
  // fallen shallows scavengers: species that follow anything that falls
  CRASH:   [{ n: 'Star Remora', r: 'swift' }, { n: 'Rockslide Gremlin', r: 'brute' }, { n: 'Toll Wraith', r: 'mystic' }],
};

// species slug for art lookup: 'Sun-Bleached Revenant' -> 'sun_bleached_revenant'
export const speciesSlug = name =>
  name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');

const WARDEN_TITLES = {
  MEADOW: 'Warden of the Quiet Field', FOREST: 'Warden of Whispered Boughs',
  MOUNTAIN: 'Warden of the Broken Stair', VOLCANO: 'Warden of the Banked Fire',
  DESERT: 'Warden of the Standing Glass', TUNDRA: 'Warden of the Long White',
  SEA: 'Warden of the Undertow', CRYSTAL: 'Warden of the Facet Gate',
};
const WARDEN_NAMES = [
  'Ashkarel', 'Bruma', 'Cinderjaw', 'Dolmen', 'Evengard', 'Fyrn', 'Grendhal',
  'Hollowmere', 'Ironquill', 'Karst', 'Lodenbrand', 'Morrowgate',
];

export function wardenName(rng, biome, tier) {
  const title = WARDEN_TITLES[biome] || 'Warden of the Meridian';
  return `${pick(rng, WARDEN_NAMES)}, ${title} (Tier ${tier})`;
}

// ------------------------------------------------------ celestial courts ---

export const KINGDOMS = [
  {
    id: 'solar',
    name: 'The Solar Dominion',
    epithet: 'Legion of the Unsetting Gold',
    color: 0xf5b942,
    dark: 0x8f6410,
    biomes: ['DESERT', 'MEADOW'],
    angle: Math.PI / 2,            // south
    capital: 'Aurelith, Throne of Noon',
    towns: ['Zenith Gate', 'Gilded Hollow', 'The Brazen Steppe', 'Midsummer Toll'],
    runes: 'ᛋᛟᛚ',
    flavor: 'Sun-priests of the Dominion carry noon in glass lanterns, so their legions never march in shadow.',
  },
  {
    id: 'lunar',
    name: 'The Pale Tarot',
    epithet: 'Court of the Drawn Moon',
    color: 0xbcd8ff,
    dark: 0x5a7ab0,
    biomes: ['TUNDRA', 'FOREST'],
    angle: -Math.PI / 2,           // north
    capital: 'Selenost, the Shuffled City',
    towns: ["The Hermit's Rest", 'Tower of the Hanged Star', 'Two-of-Winters', 'Moonwake'],
    runes: 'ᛚᚢᚾ',
    flavor: 'Every dawn the Pale Tarot deals a card to name the day; the city rearranges its streets to match.',
  },
  {
    id: 'comet',
    name: 'The Cometborne Reaches',
    epithet: 'Clans of the Long Fall',
    color: 0x6fe0c8,
    dark: 0x2a7a6a,
    biomes: ['MOUNTAIN', 'CRYSTAL'],
    angle: 0,                      // east
    capital: 'Perihelion Hold',
    towns: ['Falling Harbor', 'Tailfire Crag', 'The Anchorage of Sparks', 'Windshorn'],
    runes: 'ᚲᛗᛏ',
    flavor: 'The Reaches ride tame comets between the peaks, mooring them to mountaintops like ships to piers.',
  },
  {
    id: 'umbral',
    name: 'The Umbral Choir',
    epithet: 'Congregation of the Quiet Flame',
    color: 0xd94f8e,
    dark: 0x7a2450,
    biomes: ['VOLCANO', 'CRYSTAL'],
    angle: Math.PI,                // west
    capital: 'Vesperfall, the Caldera Organ',
    towns: ['The Silent Crescendo', 'Ashveil', 'Duskchapel', 'Last Refrain'],
    runes: 'ᚢᛗᛒ',
    flavor: 'The Choir sings into the volcano and the volcano sings back; their hymns are written in smoke.',
  },
];

export const DRIFTLAND_TOWNS = [
  'Starfall Vale', "Wander's Toll", 'Gallows Meridian', 'The Halfway Lantern',
];

// ------------------------------------------------------------- dungeons ---

const DUNGEON_STYLES = {
  FOREST:   ['Grove-Temple of {X}', 'The Rootbound Vault of {X}', 'Mosswarren of {X}'],
  MOUNTAIN: ['Skyvault of {X}', 'The Hollow Summit of {X}', 'Stair of {X}'],
  VOLCANO:  ['Undercrypt of {X}', 'The Cinder Reliquary of {X}', 'Forge-Tomb of {X}'],
  DESERT:   ['Sun-Tomb of {X}', 'The Glass Catacomb of {X}', 'Mirage Vault of {X}'],
  TUNDRA:   ['Frozen Archive of {X}', 'The Pale Barrow of {X}', 'Hibernaculum of {X}'],
  SEA:      ['The Drowned Star of {X}', 'Tidelocked Sanctum of {X}'],
  CRYSTAL:  ['Prism Oubliette of {X}', 'The Refracted Halls of {X}'],
  MEADOW:   ['Barrow-Ring of {X}', 'The Sunken Court of {X}'],
};

const DUNGEON_PATRONS = [
  'the Sundered King', 'the Nine Regrets', 'the Molted Seraph', 'Old Meridian',
  'the Unlit Candle', 'the Star That Blinked', 'the Widow of Hours', 'the First Cartographer',
  'the Swallowed Choir', 'the Bone Zodiac', 'the Patient Comet', 'the Last Librarian',
];

export function dungeonName(rng, biome) {
  const styles = DUNGEON_STYLES[biome] || DUNGEON_STYLES.MEADOW;
  return pick(rng, styles).replace('{X}', pick(rng, DUNGEON_PATRONS));
}

// --------------------------------------------------------- wild hex names ---

const WILD_PRE = {
  MEADOW:  ['Lark', 'Clover', 'Amber', 'Whisper', 'Dapple', 'Hearth'],
  FOREST:  ['Moss', 'Owl', 'Thorn', 'Fern', 'Murmur', 'Glimmer'],
  MOUNTAIN:['Granite', 'Echo', 'Raven', 'Storm', 'Anvil', 'Vertigo'],
  VOLCANO: ['Ash', 'Cinder', 'Slag', 'Ember', 'Soot', 'Pyre'],
  DESERT:  ['Dune', 'Glass', 'Bleach', 'Mirage', 'Sirocco', 'Bone'],
  TUNDRA:  ['Frost', 'Pale', 'Sleet', 'Rime', 'Hush', 'Aurora'],
  SEA:     ['Star', 'Brine', 'Drift', 'Lull', 'Fathom', 'Mirror'],
  CRYSTAL: ['Prism', 'Facet', 'Chime', 'Glint', 'Shard', 'Halo'],
};
const WILD_SUF = {
  MEADOW:  ['field', ' Downs', ' Lea', 'run', ' Commons'],
  FOREST:  ['wood', ' Thicket', 'shade', ' Tangle', 'hollow'],
  MOUNTAIN:[' Tor', ' Reach', 'spire', ' Saddle', ' Teeth'],
  VOLCANO: [' Flats', 'fall', ' Vents', ' Scar', 'reach'],
  DESERT:  [' Sea', ' Flats', 'veil', ' Anvil', ' Waste'],
  TUNDRA:  [' Expanse', 'mere', ' Shelf', 'fall', ' Silence'],
  SEA:     [' Shallows', ' Sound', 'water', ' Mirror', ' Deep'],
  CRYSTAL: [' Fields', ' Garden', 'rest', ' Choir', ' Scatter'],
};

export function wildName(rng, biome) {
  const pre = WILD_PRE[biome] || WILD_PRE.MEADOW;
  const suf = WILD_SUF[biome] || WILD_SUF.MEADOW;
  return pick(rng, pre) + pick(rng, suf);
}

// ---------------------------------------------------------------- battles ---

const ENEMIES = {
  MEADOW:  ['a Runeboar sounder', 'a Meadow Wisp swarm', 'the Clover-Drunk Ogre', 'a lost Sickle Automaton'],
  FOREST:  ['a Bramblebound Wolfshade', 'the Moss-Sung Treant', 'a clutch of Owlbats', 'the Fern King’s wardens'],
  MOUNTAIN:['an Echo Wyvern', 'a Granite Sentinel', 'rockslide Gremlins', 'the Vertigo Twins'],
  VOLCANO: ['a Cinderwrought Choirling', 'a Magma Seraph', 'ash-caked Salamanders', 'the Slagheart Colossus'],
  DESERT:  ['a Glasscoil Serpent', 'a Sun-Bleached Revenant', 'dune-swimming Mawfish', 'the Mirage of Yourself'],
  TUNDRA:  ['a Frostmarrow Stag', 'the Hound card, loosed', 'auroral Haunts', 'a Sleetclad Mammoth'],
  SEA:     ['a Star-Drowned Siren', 'a Void Angler', 'the Undertow Chorus', 'brine-slick Reflections'],
  CRYSTAL: ['a Prism Shard-Golem', 'refracted Duelists', 'the Chiming Widow', 'a Facet-Faced Stalker'],
};

const BATTLE_SITES = [
  'Contested Crossing', 'Old Battlefield', 'Ambush Hollow', 'The Challenge Stone',
  'Broken Watchpost', 'Hunting Grounds', 'The Duelling Ring',
];

export function makeBattle(rng, biome) {
  const enemy = pick(rng, ENEMIES[biome] || ENEMIES.MEADOW);
  return {
    type: 'battle',
    subtype: 'skirmish',
    name: pick(rng, BATTLE_SITES),
    enemy,
    flavor: `Something waits here: ${enemy}. Banners of old challenges rot on their poles, and fresh rune-scratches on the stones spell a single word — "again."`,
    actions: ['⚔ Begin Skirmish', 'Scout the Ground'],
  };
}

// ---------------------------------------------------------------- traders ---

const WARES = [
  ['Bottled comet-tail (fizzy)', 12], ['Map of a place that moved', 8],
  ['Left-handed rune chisel', 5], ['Moth-silk travelling cloak', 20],
  ['Jar of yesterday’s sunlight', 15], ['Deck of blank tarot (they fill in)', 25],
  ['Whetstone made of quiet', 9], ['Volcanic chorus-honey', 11],
  ['Foldable campfire (patent pending)', 18], ['A very reassuring pebble', 2],
  ['Glass dune in an hourglass', 7], ['Umbral lullaby, sheet music', 13],
  ['Star-shard polish', 4], ['Boots that remember roads', 30],
];

const TRADER_NAMES = [
  'Marroweye Venn', 'the Twins Alike', 'Grandmother Halcyon', 'Pale Jack',
  'Sorrel the Unhurried', 'Madam Perihelion', 'the Bursar of Nowhere', 'Kindly Osk',
];

export function makeTrader(rng, tier, kingdom) {
  const wares = [];
  const used = new Set();
  const n = tier === 3 ? 5 : tier === 2 ? 4 : 3;
  while (wares.length < n) {
    const i = Math.floor(rng() * WARES.length);
    if (!used.has(i)) { used.add(i); wares.push(WARES[i]); }
  }
  const who = pick(rng, TRADER_NAMES);
  const names = {
    1: `${who}'s Wandering Cart`,
    2: 'The Stalls at the Crossing',
    3: kingdom ? `Grand Market of ${kingdom.name.replace('The ', 'the ')}` : 'The Grand Bazaar',
  };
  const flavors = {
    1: `A cart with too many wheels and one tired star-ox. ${who} claims every item fell off the same comet.`,
    2: `A huddle of awning-covered stalls run by ${who} and cousins. Prices are haggled in couplets.`,
    3: `Vaulted aisles of lantern-light and auctioneers' hymns. Anything can be bought here except directions out.`,
  };
  return {
    type: 'trader', subtype: ['', 'wandering', 'stalls', 'market'][tier],
    name: names[tier], flavor: flavors[tier], wares,
    actions: ['Browse Wares', 'Haggle'],
  };
}

// ------------------------------------------------------------- side areas ---

const RUINS = [
  { name: 'Toppled Star-Gate', flavor: 'Two pillars and half an arch. Step through and you arrive, disappointingly, exactly where you were — but three seconds younger.' },
  { name: 'The Cartographer’s Folly', flavor: 'A ruined observatory whose murals map this very hex, including a small painted figure that looks worryingly like you, standing where you stand.' },
  { name: 'Sunken Amphitheater', flavor: 'Stone benches face a stage of black glass. Applause starts, politely, whenever you speak.' },
  { name: 'Hollow Watchtower', flavor: 'The stairs go up forty steps and down sixty. Nobody has found the bottom, though several have found lunch.' },
];

const SHRINES = [
  { name: 'Shrine of the Patient Comet', flavor: 'A stone tail-streak wrapped around a bowl of never-melting ice. Offerings: one secret, spoken quickly.' },
  { name: 'Waystone of the Meridian', flavor: 'A rune-pillar humming at exactly the pitch of your own name. Travellers touch it for luck and leave with cold fingertips.' },
  { name: 'The Kneeling Moon', flavor: 'A crescent of white marble, face-down in the grass. If you kneel beside it, the night lasts four minutes longer for you alone.' },
  { name: 'Altar of Small Fires', flavor: 'Hundreds of thimble-sized candles, all lit, none dripping. One of them is yours. You will know it when you see it.' },
];

const MYSTERIES = [
  { name: 'A Door of Folded Starlight', flavor: 'It stands unsupported in the open, slightly ajar. Warm light and the smell of bread come through the gap.' },
  { name: 'The Abandoned Tea Set', flavor: 'Four cups, still steaming, arranged for five. The fifth place has only a note: "back shortly, start without us."' },
  { name: 'A Rune That Hums Your Name', flavor: 'Scratched on a boulder, glowing faintly. It is misspelled, and somehow that is worse.' },
  { name: 'The Molted Constellation', flavor: 'A snake-skin of stars, shed whole across the ground, still twinkling. Whatever wore it is bigger now.' },
  { name: 'A Ferryman With No River', flavor: 'He leans on his pole in the dry grass and asks, hopefully, if you are going anywhere at all.' },
];

const MYSTERY_OUTCOMES = [
  { text: 'You investigate. Something chimes approvingly in your pocket.', shards: +3 },
  { text: 'You investigate and come away with stardust on your sleeves and a coupon of dubious value.', shards: +1 },
  { text: 'You poke it. It pokes back, gently, and pays you for the privilege.', shards: +2 },
  { text: 'You leave an offering of two star-shards. The silence afterward feels grateful.', shards: -2 },
  { text: 'Nothing happens — audibly. But for the rest of the day, your shadow walks with better posture.', shards: 0 },
  { text: 'Beneath it: a purse someone hid from someone who is no longer anyone. It is heavy.', shards: +12 },
  { text: 'It was a trap, of the polite kind. You pay the toll and are complimented on your grace.', shards: -5 },
  { text: 'A voice explains, at length, the arrangement of the heavens. You emerge older but luckier.', shards: 0, boon: { id: 'starlore', name: 'Starlore', stats: { luck: 4 } } },
  { text: 'Something small and cold climbs into your pack and refuses to leave. It seems protective.', shards: 0, boon: { id: 'small_cold', name: 'A Small Cold Companion', stats: { dodge: 4 } } },
  { text: 'You touch it. The world flinches. Somewhere a bell you cannot hear stops ringing.', shards: 0, hp: -1 },
];

// ------------------------------------------------- sacrifice bargains ---
// Events that ask for something real. Each bargain's `cost` and `gain` are
// resolved by main.js; refusing is always free.

export const BARGAINS = [
  {
    id: 'hungering_star', name: 'A Hungering Star',
    flavor: 'A pale star sits in a nest of scorched grass, breathing. It is very hungry, and very honest about it: it eats relics, and it pays for its meals.',
    cost: 'relic', gain: 'draw_rare',
    action: 'Feed it the dimmest relic',
  },
  {
    id: 'tithe_stone', name: 'The Tithe-Stone',
    flavor: 'A basalt altar with a bowl worn smooth by centuries of palms. The inscription is one word: MORE. It wants blood, or what passes for it in paper.',
    cost: { hp: 2 }, gain: { boon: { id: 'tithe_edge', name: 'Tithe-Sharpened Edge', stats: { atk: 2 } } },
    action: 'Bleed into the bowl (−1★)',
  },
  {
    id: 'moth_court', name: 'The Court of Moths',
    flavor: 'A thousand moths arranged in the shape of a judge. They will trade fortune for warmth — a piece of your flame, forever this run.',
    cost: { vessel: 2 }, gain: { boon: { id: 'moth_favor', name: 'The Moths’ Favor', stats: { luck: 10, dodge: 5 } } },
    action: 'Give up your warmth (−1 Star Vessel)',
  },
  {
    id: 'unlit_door', name: 'A Door, Priced',
    flavor: 'A door of folded starlight, slightly ajar. The doorkeeper is a hand, palm up. It does not say what is behind the door. They never do.',
    cost: { shards: 25 }, gain: 'draw_boosted',
    action: 'Pay the hand (☆ 25)',
  },
  {
    id: 'echo_well', name: 'The Echo Well',
    flavor: 'A well that returns what is dropped into it, changed. Star-shards come back as something else. Sometimes better. The well makes no promises, only echoes.',
    cost: { shards: 12 }, gain: 'gamble_shards',
    action: 'Drop in a handful (☆ 12)',
  },
];

// ---------------------------------------------------- wayshrine boons ---
// Communing at a Wayshrine offers one seeded boon, once per shrine per run.

export const SHRINE_BOONS = [
  { id: 'pilgrim_stride', name: 'Pilgrim’s Stride', cost: { shards: 14 }, boon: { stats: { spd: 2 } },
    line: 'The shrine blesses your steps: the road will be shorter, both ways.' },
  { id: 'lantern_heart', name: 'Lantern Heart', cost: { shards: 14 }, boon: { stats: { vessel: 1 } },
    line: 'A small light takes up residence behind your chest-rune.' },
  { id: 'keen_omen', name: 'Keen Omen', cost: { shards: 16 }, boon: { stats: { luck: 6 } },
    line: 'The shrine shows you, briefly, where everything is going to be.' },
  { id: 'wardens_grace', name: 'Warden’s Grace', cost: { hp: 2 }, boon: { stats: { dodge: 6 } },
    line: 'The shrine takes a little of your ink and redraws your outline, slightly to the left of danger.' },
  { id: 'sharpened_meridian', name: 'Sharpened Meridian', cost: { shards: 20 }, boon: { stats: { atk: 2 } },
    line: 'The shrine hones your shadow to an edge.' },
];

// ------------------------------------------------ voices in the sky ---
// Every named body in the sky can be beheld from its vantage hex. Each
// speaker carries 2–3 SETS of dialogue that cycle per visit (never the
// same twice running), and together they converge on the one story:
// Vael burned alone and folded daughters from its light; the Meridian —
// the seam lacing sky to sea — held the world as one page; the eldest
// daughter leaned past the Door Ajar, something answered through her
// (the Wound), the seam snapped, and most of the daughters shattered.
// The wanderer is the newest page folded from the Meridian's book, sent
// to re-thread the world. Some speakers hide an errand in their FIRST
// set — a clue, never a prompt; carry the named keepsake back to them
// and the story pays out.
//
// def: { id, name, sets:[[lines]], summons?, gift?, quest? }
//   summons — the original four voices still arrest you on first arrival
//   gift    — granted once per run when a summoning voice first finishes
//   quest   — { token, payoff:[lines], reward } — played instead of a
//             set when the keepsake is carried; reward keys are handled
//             in main.js (vessel | boon | astral)

export const SKY_SPEAKERS = [
  {
    id: 'giant', name: 'Thal-Vaur, the Sleeping Giant', summons: true,
    gift: { shards: 6 },
    sets: [
      [
        '…you are standing on my dream again.',
        'Little wick. When I turn over, mind the tide of hills.',
        'Sleep is a country. I am its king. Go quietly.',
      ],
      [
        'Before the daughters there was my dream, and before my dream there was nothing worth waking for. Vael folded them of light; I dreamed them somewhere to stand. We do not compare labor.',
        'The breaking reached me as weather. I slept through the end of the world. I recommend it.',
      ],
      [
        'The Wound gnaws at the seam that laces my dream to your ground.',
        'If it frays through, little wick — wake me. You will know how. Everyone knows how. No one has dared.',
      ],
    ],
  },
  {
    id: 'third_sister', name: 'The Third Sister', summons: true,
    gift: { boon: { id: 'sisters_eye', name: 'The Sister’s Eye', flags: { visionPlus: 1 } } },
    quest: {
      token: 'sister_shard',
      payoff: [
        '…oh. Oh, she is warm. She was always warm, even mid-argument.',
        'You give a sister back a piece of her sister, and ask nothing. So take something anyway.',
        'The sky keeps its instruments sharp. You are one of ours now.',
      ],
      reward: 'astral',
    },
    sets: [
      [
        'My siblings shattered and I did not. Do you know why? Neither do I.',
        'I have watched every wanderer since the breaking. You walk like the fourth one. She made it further than most.',
        'If your road passes the Sundered Daughter — my sister, in seven pieces — bring me a splinter of her. I would hold her hand once more. Even a knuckle of it.',
      ],
      [
        'We were four who kept the near sky: the eldest at the Door, the Pale at the tides, the Sundered at the argument, and I at the watch.',
        'I watched. That is all I did. That is the whole of what I did.',
      ],
      [
        'The eldest leaned past the Door because something on the far side said her name in our mother’s voice.',
        'Nothing on the far side had a mother. Remember that, when a thing knows your name.',
      ],
    ],
  },
  {
    id: 'ferry_lantern', name: 'The Ferry Lantern', summons: true,
    gift: { shards: 4 },
    quest: {
      token: 'ferrymans_oar',
      payoff: [
        '…that is his oar. That is HIS OAR. Hold it up — no, higher.',
        'There. He will know the shape of it against my light from anywhere in the world.',
        'Go with the current, wanderer. You have made a lantern useful again.',
      ],
      reward: 'boon',
      boon: { id: 'ferrymans_blessing', name: 'The Ferryman’s Blessing', stats: { spd: 1 }, flags: { fastTravel: true } },
    },
    sets: [
      [
        'The ferryman hung me here and went to find his river. Hold your course; I am watching your feet.',
        'Left at the rift. He always said that. Left at the rift.',
        'If you ever walk a river to its end and find an oar laid down — bring it beneath me. I will burn the way home for him.',
      ],
      [
        'He rowed the daughters’ light down every river the Meridian inked. Passengers of light, and he never once tipped a fare into the sea.',
        'The rivers scattered at the breaking. A ferryman without his river is just a man holding the sky’s smallest fire.',
      ],
    ],
  },
  {
    id: 'door_ajar', name: 'A Door, Ajar (in the sky)', summons: true,
    gift: null,
    sets: [
      [
        'From the other side: the smell of bread, and a conversation that pauses when you look up.',
        '…no. Not yet. But it is kind of you to knock.',
      ],
      [
        'Through the gap: a hallway, and hung along it, portraits of five daughters. One frame is empty.',
        'The nail is bent, as if the picture was taken down in a hurry.',
        'You did not open this door. It has been ajar since she went through. Doors remember who leaned on them last.',
      ],
      [
        'The bread smell is bait, something whispers from the hinge-side.',
        'The pause in the conversation is a held breath. Knock less.',
      ],
    ],
  },
  // ---- the quiet vantages: beheld at will, never a summons --------------
  {
    id: 'sun', name: 'Vael, the Undying Sun',
    quest: {
      token: 'fallen_spark',
      payoff: [
        '…my spark. You carried it gently, and it remembers being mine.',
        'Then take a vessel of my keeping — a small star, fired hollow.',
        'Fill it with staying alive.',
      ],
      reward: 'vessel',
    },
    sets: [
      [
        'Little page. Stand out of my light; you are too flammable for a long audience.',
        'I burned alone before the daughters. I do not recommend it. The sky echoes, and the echo is you.',
        'In the breaking I shed sparks. The fire-mountain hoards one still, in the deep vault its keeper guards. Bring my spark home, and I will kindle you a vessel to carry it in.',
      ],
      [
        'You wear a binding-rune. I remember when it was written the first time — the ink was my noon, thinned with the sea.',
        'I made the daughters from my own light, because my reflection was lonely company. Do not tell them. They believe they were always.',
      ],
      [
        'I do not set. If I set, the page turns.',
        'And I am not finished reading you.',
      ],
    ],
  },
  {
    id: 'errand', name: 'The Errand',
    sets: [
      [
        'It slows, fractionally, as if noticing you — the way a courier nods without stopping.',
        'Its satchel of ice has been sealed since the world was one page. Whatever it carries, it was signed for.',
      ],
      [
        'They say the First Cartographer posted it before the breaking, addressed to the far side of the Door.',
        'It is still going. The Door is still ajar. Neither will yield first.',
        'You could swear it waved.',
      ],
      [
        'One day it will arrive, and the sky will have to decide what it was carrying all along.',
      ],
    ],
  },
  {
    id: 'c_ferryman', name: 'The Ferryman',
    sets: [
      [
        'Five stars in the shape of a man leaning on an oar. The sky drew him from memory, and missed him while drawing.',
        'He carried the daughters’ light down the rivers, once. The Meridian’s ink runs to the sea, and someone had to row it.',
      ],
      [
        'When the seam snapped, the rivers scattered like dropped string. He hung his lantern in the sky and went to find his water on foot.',
        'The constellation leans. Whatever he is now, some part of him is still listening for a current.',
      ],
      [
        'LEFT AT THE RIFT, the stars seem to spell. It is either directions or an epitaph.',
      ],
    ],
  },
  {
    id: 'c_cup', name: 'The Spilled Cup',
    sets: [
      [
        'A tilted bowl of stars, forever pouring. What it spills does not fall — it hangs, and glows, and is drunk by the grass at dawn.',
        'Star-dew is the spill. Every drop you have ever tasted left this cup before the breaking.',
      ],
      [
        'It held the first water — the sea the daughters were washed in when Vael folded them warm.',
        'The breaking knocked it over. It has not stopped pouring since, and it is not empty yet.',
      ],
      [
        'Some nights the cup rights itself a degree. Nobody speaks of it, in case it stops.',
      ],
    ],
  },
  {
    id: 'c_hound', name: 'The Patient Hound',
    sets: [
      [
        'A dog of stars, sitting. Not lying down — sitting. Waiting is work, and it is working.',
        'It belonged to the eldest daughter. It watched her lean past the Door, and it has faced that quarter of the sky ever since.',
      ],
      [
        'It does not howl. A howl is for grief, and the Hound has not agreed to grieve. She went through a door; doors open twice.',
        'When you stand here, its head tilts a fraction toward you. You smell faintly of her ink.',
      ],
    ],
  },
  {
    id: 'c_cartographer', name: 'The Second Cartographer',
    sets: [
      [
        'Stars in the shape of someone drawing — arm out, forever mid-line.',
        'The First Cartographer drew the Meridian itself: one clean seam, sky laced to sea. The world was the map. Then the seam snapped, and the First put down the pen.',
      ],
      [
        'The Second maps what broke. Every island, every rift, every warded ford — redrawn nightly, patiently, wrong by morning.',
        'Your memory of the hexes you have walked — the way the fog keeps them — that is the Second’s hand, sketching along behind you.',
      ],
      [
        'Two cartographers, one map, no argument: the First drew what should be, the Second draws what is.',
        'You walk the difference.',
      ],
    ],
  },
  {
    id: 'm_sundered', name: 'The Sundered Daughter',
    grants: 'sister_shard',   // a splinter falls into your hand at first behold
    sets: [
      [
        'A moon in seven pieces, holding formation out of habit. The cracks glow faintly, like a letter read too often.',
        'She argued with the tide — refused to let the sea go when the seam snapped, and held on until holding on was what broke her.',
        'A splinter of her drifts down, slow as a decision, and lands in your open hand. It is warm. You keep it.',
      ],
      [
        'The pieces keep her shape. On some nights they drift a hair closer together, as if she is remembering how.',
        'The Third Sister watches this quarter of the sky more than any other. Sisters know which grief is theirs.',
      ],
      [
        'Hold the splinter up: it hums toward the rest of her.',
        'Everything broken keeps one wish.',
      ],
    ],
  },
  {
    id: 'm_grief', name: 'Grief-of-Glass',
    sets: [
      [
        'A shattered moon falling so slowly that falling has become a place to live.',
        'She was the youngest. She shattered last — not from the snap, but from watching it. Glass breaks at the sound of glass.',
      ],
      [
        'Her pieces are mirrors. In each one, a different sky — some whole, some worse. She is deciding which one to land in.',
        'Do not look too long. One of the reflections looks back, and it prefers you to the view.',
      ],
    ],
  },
  // ---- the wandering worlds, beheld from their own ground ---------------
  {
    id: 'luna', name: 'The Pale Daughter',
    sets: [
      [
        'She hangs close enough to touch — a silver daughter, her craters like thumbprints in unfired clay.',
        'The tide she keeps has no sea left to pull. She pulls anyway. Somewhere beneath your feet, the dust obeys.',
        'Her light settles on your shoulders like a hand that has decided not to weigh anything.',
      ],
      [
        'Her sea dried when the seam snapped — the Meridian was its bed, and beds do not survive their rivers.',
        'She keeps the tide anyway. Duty outlives its object; ask any lighthouse.',
      ],
      [
        'She was made second, and kindest. When the eldest went through the Door, the Pale Daughter pulled the sea up over the world’s shoulders like a blanket.',
        'It was not enough. It was still kind.',
      ],
    ],
  },
  {
    id: 'rubidus', name: 'Rubidus, the Rust Wanderer',
    sets: [
      [
        'The red wanderer turns overhead, wearing its two rings like argument and rebuttal.',
        'Flakes of oxidized sky drift down so slowly they may never land. The ground here is the color of patience.',
        'Something inside it still cycles — one great piston-beat, once an age. You feel it in your teeth.',
      ],
      [
        'It is no daughter. It wandered in from a sky that ended, wearing its rings like luggage straps, and Vael let it stay.',
        'The sun is not lonely by choice. But it is hospitable by nature.',
      ],
      [
        'The Oxidized King below dreams of being this world’s heart again.',
        'The planet’s actual heart beats once an age, and wants nothing. That is why it is still beating.',
      ],
    ],
  },
  {
    id: 'viridian', name: 'The Viridian Comet',
    sets: [
      [
        'A garden falls forever above you, its frozen tail streaming like a hedge that lost an argument with the wind.',
        'Seeds ride the tail. Some have waited ten thousand years for soil. One of them has noticed yours.',
        'The green head flares gently as it turns — a lighthouse for things that grow.',
      ],
      [
        'The comet-garden was seeded from the Spilled Cup — one drop, one seed, ten thousand years of falling.',
        'Patience is a green thing.',
      ],
      [
        'When the world is bound whole again, they say, the Long Fall ends in soil.',
        'Every seed in the tail is aimed at that promise.',
      ],
    ],
  },
];

// ------------------------------------------------- drowned celestials ---
// Bodies that fell into the water and stayed. Each is a landmark hex in
// the shallows with cycling dialogue; some hold a keepsake or a small
// mercy. Their one-time effects are keyed by main.js on first Listen.

export const DROWNED = [
  {
    id: 'drowned_star', name: 'The Drowned Star', sub: 'face-down in the silt',
    quest: { token: 'star_name_page', action: 'Read Her Name', reward: 'astral' },
    payoff: [
      'You unfold the ledger page. Beneath a sketch of a falling light: her name. You read it aloud, and the water carries it down like a coin.',
      'The star turns over. The lake glows gold to its floor. I was HER, she says. I was her. And I am again.',
      'She presses something up through the water between you: her thanks, folded small, and blazing.',
    ],
    sets: [
      [
        'Below the surface: a star, face-down in the silt, its light thinned to a coin’s worth. It notices your shadow and stirs.',
        'I fell whole, it says, through the crack the breaking made — and the water closed over my name. I had one. It had three syllables. The fish wear it now.',
        'The watchers on the torn hill wrote us all in a brass-eyed ledger before the fall. If my name is anywhere, it is there. Read it to me, and I will remember the rest.',
      ],
      [
        'Names are how light finds its way home, it murmurs. Yours is stitched on your chest, little page. Guard the thread.',
      ],
      [
        'The water is kind, in the way of things with no bones. But kindness is not a name.',
      ],
    ],
  },
  {
    id: 'ferry_river', name: 'The Ferryman’s Mooring', sub: 'a river’s end, an oar laid down',
    grants: 'ferrymans_oar',
    sets: [
      [
        'A river ends here — or begins; the water is coy about direction. A mooring post leans in the shallows, a flat boat tied to nothing.',
        'Across the seat: an oar, laid down the way a tired man sets a tool he means to pick back up.',
        'You take the oar. The river does not object. Somewhere overhead, a lantern burns a fraction brighter.',
      ],
      [
        'The boat waits with the patience of furniture. The current combs the reeds.',
        'Any moment now, the water seems to say. Any moment now.',
      ],
    ],
  },
  {
    id: 'mirror_font', name: 'The Mirror-Font', sub: 'the sky will not look at it',
    mercy: 'heal',
    sets: [
      [
        'A round basin of starlit water, still as held breath. The sky refuses to look at it directly.',
        'This is where Vael first saw itself, before the daughters — and found the reflection unbearable company. Creation is what a lonely fire does with a mirror.',
        'You look. For one moment your reflection has five sisters standing behind it. Then it is only you — which is almost the same thing.',
      ],
      [
        'The font shows what is whole. Lean over it, and it insists — briefly, generously — that you are.',
      ],
    ],
  },
  {
    id: 'salt_bell', name: 'The Salt Bell', sub: 'its mouth full of sea',
    mercy: 'shards',
    sets: [
      [
        'A great bell lies half-sunk in the shallows, greened bronze, its mouth full of sea.',
        'It rang the tides for the Pale Daughter — flood, ebb, and the third ring: the one for weather that was really a warning about the sky.',
        'It rang once more, the day the seam snapped — so hard it jumped its tower and walked here on the sound. Bells take breaking personally.',
      ],
      [
        'Put your ear to the bronze. The third ring is still in there, circling, waiting for someone to need warning.',
      ],
    ],
  },
  {
    id: 'first_rain', name: 'The First Rain', sub: 'hanging, unfallen',
    mercy: 'dew',
    sets: [
      [
        'Rain hangs above the water, unfallen — a held shower of bright drops, each one round as a beginning.',
        'When the daughters shattered, Vael wept exactly once. Being fire, it wept upward. The rain has been deciding where to land ever since.',
        'One drop settles into your flask — cool, and impossibly heavy.',
      ],
      [
        'The rain waits. Grief is patient here: it will fall on the day the world is bound whole,',
        'and it will be the kind of rain gardens argue about for a thousand years.',
      ],
    ],
  },
];

// ------------------------------------------------------- keepsakes ---
// Statless tokens for the sky's errands. Never prompted — each is named
// only inside a speaker's first dialogue set.

export const KEEPSAKES = {
  fallen_spark: {
    name: 'A Fallen Spark', icon: '🜂',
    desc: 'A coal of the sun’s own noon, cool to every hand but one. Vael misses it.',
  },
  star_name_page: {
    name: 'A Ledger Page', icon: '⎘',
    desc: 'Torn from the observatory’s brass-eyed ledger. Under a sketch of a falling light, a name in careful ink.',
  },
  ferrymans_oar: {
    name: 'The Ferryman’s Oar', icon: '⑃',
    desc: 'Worn smooth by a thousand crossings of light. Laid down, never abandoned. The lantern would know it anywhere.',
  },
  sister_shard: {
    name: 'A Splinter of the Sundered Daughter', icon: '☽',
    desc: 'A warm sliver of a broken moon. It hums toward its sisters — all of them.',
  },
};

// ------------------------------------------------------ nebula sites ---

export const NEBULA_NAMES = ['The Cradle Nebula', 'The Widow’s Veil'];

export function nebulaSites(rng, name) {
  return [
    {
      type: 'side', subtype: 'nebula',
      name: 'The Star Nursery',
      flavor: 'Newborn stars drift in the shallows like lantern-fish, wobbling on their first light. One of them keeps bumping into your ankles, insistently.',
      actions: ['Cradle a Newborn Star'],
    },
    {
      type: 'battle', subtype: 'nebula',
      name: 'The Jealous Current',
      enemy: 'what guards the nursery',
      flavor: 'Something old coils beneath the star-spawn, and it has counted them, and it counts you as a thief on principle.',
      actions: ['⚔ Face the Current'],
    },
    {
      type: 'side', subtype: 'bargain', bargain: {
        id: 'nebula_shape', name: 'A Shape in the Dust',
        flavor: 'Deeper in the veil, the dust arranges itself into an outline of you — improved, according to its own opinions. It offers the trade with open, wrong hands.',
        cost: { vessel: 2 }, gain: 'mutation',
        action: 'Let it improve you (−1 Star Vessel)',
      },
      name: 'A Shape in the Dust',
      flavor: 'Deeper in the veil, the dust arranges itself into an outline of you — improved, according to its own opinions. It offers the trade with open, wrong hands.',
      actions: ['Let it improve you (−1 Star Vessel)'],
    },
  ];
}

// ------------------------------------------------------ the deity ---

export const DEITY = {
  name: 'Vhal-Suthek, the Wound Made Flesh',
  flavor: 'The rift that broke the Meridian was not an accident. It was a mouth, opening. What waits at its center has been patient for an age, and your changed body is the invitation it wrote for itself.',
  sub: 'the alternative end',
};

export const WOUND_WHISPERS = [
  { name: 'A Chorus of Hinges', flavor: 'The sound of every door in the world, opening at once, very slowly. It is coming from underneath the hex.' },
  { name: 'The Inverted Shrine', flavor: 'A wayshrine, upside down, its offerings falling forever into the sky. Praying here feels like being overheard.' },
  { name: 'Where the Map Ends', flavor: 'A cartographer’s desk, abandoned mid-stroke. The unfinished line on the vellum continues on its own when you are not looking directly at it.' },
];

const VISTAS = [
  { name: 'Meridian Overlook', flavor: 'From here the world’s broken edge is visible: hexes adrift over the rune-sea, holding formation out of habit.' },
  { name: 'The Long Field of Lanterns', flavor: 'Travellers hang lanterns here for those still travelling. Yours is already lit. That is probably fine.' },
];

const CAMPS = [
  { name: 'Cold Pilgrim Camp', flavor: 'Bedrolls, a rune-banked fire, and a pot of stew licking itself clean. The pilgrims are a day ahead of you, or a day behind.' },
  { name: 'Surveyor’s Rest', flavor: 'A tripod theodolite aimed at nothing. The logbook’s last entry: "hex count off by one. NOT counting again."' },
];

export function makeSide(rng) {
  const roll = rng();
  // a slice of the wild's events now drives a hard bargain
  if (roll >= 0.62 && roll < 0.8) {
    const b = pick(rng, BARGAINS);
    return {
      type: 'side', subtype: 'bargain', bargain: b,
      name: b.name, flavor: b.flavor,
      actions: [b.action, 'Refuse'],
    };
  }
  let pool, subtype;
  if (roll < 0.26) { pool = RUINS; subtype = 'ruin'; }
  else if (roll < 0.46) { pool = SHRINES; subtype = 'shrine'; }
  else if (roll < 0.62) { pool = MYSTERIES; subtype = 'mystery'; }
  else if (roll < 0.9) { pool = VISTAS; subtype = 'vista'; }
  else { pool = CAMPS; subtype = 'camp'; }
  const base = pick(rng, pool);
  return {
    type: 'side', subtype,
    name: base.name, flavor: base.flavor,
    actions: subtype === 'mystery' ? ['Investigate'] : ['Explore', 'Pay Respects'],
  };
}

export function mysteryOutcome(rng) { return pick(rng, MYSTERY_OUTCOMES); }

// -------------------------------------------------- landmark-specific sites ---

export function capitalSites(rng, kingdom) {
  return [
    {
      type: 'side', subtype: 'palace',
      name: `The ${['Throne', 'High Seat', 'Star Court'][Math.floor(rng() * 3)]} of ${kingdom.name.replace('The ', 'the ')}`,
      flavor: `${kingdom.flavor} Petitioners queue beneath banners of ${kingdom.runes}. The court will hear you — eventually.`,
      actions: ['Seek an Audience'],
    },
    makeTrader(rng, 3, kingdom),
    {
      type: 'battle', subtype: 'arena',
      name: 'The Grand Proving-Ring',
      enemy: 'the reigning champion',
      flavor: 'A lawful arena where the court settles matters of honor, taxes, and parking. Challengers are announced by trumpet and mild apology.',
      actions: ['⚔ Enter the Ring', 'Watch a Bout'],
    },
    {
      type: 'side', subtype: 'shrine',
      name: 'Royal Reliquary',
      flavor: `Behind sun-glass: the founding relic of the realm. Do not tap the glass. The relic taps back.`,
      actions: ['View the Relic'],
    },
  ];
}

export function townSites(rng, townName) {
  return [
    makeTrader(rng, 2, null),
    {
      type: 'side', subtype: 'tavern',
      name: `The ${pick(rng, ['Tilted', 'Thirsty', 'Second', 'Borrowed', 'Humming'])} ${pick(rng, ['Lantern', 'Comet', 'Hearth', 'Meridian', 'Cartwheel'])}`,
      flavor: `${townName}'s taproom. Rumors cost a drink; true rumors cost two. The fireplace burns driftwood from the world's edge and pops in whole sentences.`,
      actions: ['Gather Rumors', 'Rest'],
    },
    {
      type: 'battle', subtype: 'outskirts',
      name: 'Trouble at the Palisade',
      enemy: 'something the night watch refuses to describe',
      flavor: 'The watch-captain will pay in star-shards for anyone willing to walk the fence-line at dusk and hit whatever growls first.',
      actions: ['⚔ Take the Watch'],
    },
  ];
}

export function dungeonSites(rng, dungeon) {
  return [
    {
      type: 'battle', subtype: 'gate', gauntlet: true,
      name: `Gate of ${dungeon.name}`,
      flavor: 'The threshold is carved with a warning in six languages and one apology. Cold air breathes outward on a slow count of four. Three chambers wait below — and at the bottom, the Keeper, hoarding its gift.',
      actions: ['⚔ Descend into the Dark', 'Study the Warnings'],
    },
    {
      type: 'battle', subtype: 'guardian',
      name: 'The Threshold Guardian',
      enemy: 'the bound warden of the deep',
      flavor: 'It has guarded this door so long it has opinions about doors. It rises, joints chiming, politely furious.',
      actions: ['⚔ Challenge the Warden'],
    },
    {
      type: 'side', subtype: 'ruin',
      name: 'Looted Antechamber',
      flavor: 'Previous delvers left boot-prints, burn-marks, and an IOU. Something small survived the looting and is very glad to see you.',
      actions: ['Search the Rubble'],
    },
  ];
}
