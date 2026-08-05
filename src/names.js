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
};

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
  let pool, subtype;
  if (roll < 0.3) { pool = RUINS; subtype = 'ruin'; }
  else if (roll < 0.55) { pool = SHRINES; subtype = 'shrine'; }
  else if (roll < 0.82) { pool = MYSTERIES; subtype = 'mystery'; }
  else if (roll < 0.92) { pool = VISTAS; subtype = 'vista'; }
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
      type: 'side', subtype: 'gate',
      name: `Gate of ${dungeon.name}`,
      flavor: 'The threshold is carved with a warning in six languages and one apology. Cold air breathes outward on a slow count of four.',
      actions: ['Descend (soon™)', 'Study the Warnings'],
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
