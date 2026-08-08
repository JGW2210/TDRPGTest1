const params = new URLSearchParams(location.search);

export const CONFIG = {
  seed: (() => {
    const s = params.get('seed');
    return s == null ? 77 : (Number.isFinite(+s) ? Math.abs(Math.trunc(+s)) : hashCode(s));
  })(),

  mapRadius: 50,          // hexes from center to rim (~7,650 tiles)
  hexSize: 1.0,           // world units, center to corner
  tileGap: 0.05,
  baseY: -7.5,            // altitude of the cosmic base plane below the tiles

  visionRadius: 4,        // hexes fully lit around the player
  rimRadius: 6,           // hexes dimly lit at the edge of vision

  hopDuration: 0.27,      // seconds per hex hop
  hopDurationFast: 0.16,  // used on long journeys (> fastPathLen hops)
  fastPathLen: 7,
  maxLean: 0.5,           // radians of paper-token parallax lean

  regions: {
    count: 10,            // target region pockets
    seedSpacing: 16,      // min hex distance between region seeds
    riftWidth: 2.1,       // voronoi-border band converted to void rift
  },

  crashes: {
    min: 1, max: 3,       // crashed visitors embedded per world
    spacing: 14,          // min hex distance between crash craters
    fromStart: 10,        // craters keep this far from Starfall Vale
  },

  archipelago: {
    erosion: [0.60, 0.66],// coastal-erosion noise thresholds (two passes)
    riverJoinDist: 7,     // how far a channel mouth reaches for a river join
  },

  secrets: {
    count: 26,            // sealed hexes hidden in the void
    pedestalChance: 0.55, // what a secret holds: item pedestal…
    cacheChance: 0.3,     // …or a shard cache (else consumables)
  },

  islets: {
    count: 3,             // forgotten islets hidden out in the void
    minLandGap: 3,        // islets keep this far from any shore
    maxBridge: 8,         // longest folded footbridge to an islet
  },

  battle: {
    // Star Vessels: your life is 5 star-shaped vessels, counted internally
    // in HALF-vessel units. Damage only comes in halves — no numeric chip.
    vessels: { base: 10, cap: 20, min: 4 },   // half-vessels: 5★ start, 10★ cap, 2★ floor
    baseAtk: 5,
    baseSpd: 5,
    // What a fully MISSED block costs, in half-vessels, by region tier.
    // Perfect and good blocks nullify damage outright (their price is
    // focus); heavies/crushes double the base; nothing exceeds 3 vessels.
    damage: {
      low: 1, mid: 2, high: 3,   // halves per missed hit: t0–1 / t2–3 / t4+
      midTier: 2, highTier: 4,
      heavyMult: 2, heavyCap: 6, // charged & crushing blows, capped at 3★
      bossPlus: 1, enragePlus: 1,
      chillPer: 3,               // every 3 Chill stacks soften a foe's hits by ½★
      trap: 1,                   // springing a trap-shape costs ½★
    },
    // Focus: 5 stages, full at each battle's start. Sloppy blocks drain it,
    // perfect blocks restore it, and low focus narrows your ATTACK windows
    // (never the block lanes — defense stays winnable at any focus).
    focus: {
      max: 5, min: 1,
      good: 0.5, missBlock: 1, trap: 0.5, burnTick: 0.5,
      heavyLanded: 1,            // a landed heavy/crush costs this EXTRA
      perfectBlock: 0.5, brace: 0.5,
      minScale: 0.6,             // strike-band width at focus 1
    },
    // Enemy HP curve (their ATK no longer drives player damage — the
    // damage table above does). Gently quadratic: tuned (Monte-Carlo,
    // round 12) against player offense, which is unchanged this round.
    enemy: { hp0: 13, hpT: 7, hpQ: 0.35, atk0: 2.4, atkT: 1.45, atkQ: 0.09 },
    // The strike minigame: the gold band lands somewhere new every swing,
    // the marker's speed and direction vary, and the bands are narrow.
    // Every bar now COALESCES first — energy gathers where the band will
    // be, the track fades in, and only then does the marker fly.
    timing: {
      travel: 0.72,        // base seconds across the track (round 13: faster)
      perfectHalf: 0.05,   // half-width of the gold band on strikes
      blockHalf: 0.045,    // legacy width (block is a lane minigame now)
      dodgeHalf: 0.035,    // …when dodging a crush (no good band at all)
      goodPad: 0.085,      // the good band extends this far past the gold
      reverseChance: 0.35, // odds the marker sweeps right-to-left
      gather: 0.45,        // seconds of energy-coalescing before the sweep
    },
    // The three stances. Stronger attacks read harder: faster markers,
    // thinner bands, and less time to watch the energy gather.
    //  swift — one generous bar; a perfect marks an OPENING (next attack
    //          +opening, grown by openingPlus relics) and grants poise.
    //  star  — the 3-bar chain.
    //  heavy — Meteor Edge is a 3-bar chain of knife-slits: each perfect
    //          lands 1.5× (heavyPlus spreads across the chain), a good
    //          keeps the chain at 0.6×, a miss grazes and SHATTERS it.
    attacks: {
      swift: { mult: 0.85, speed: 0.8, band: 1.4, gather: 0.5, opening: 0.35 },
      star: { speed: 1.0, band: 1.0, gather: 0.45 },
      heavy: {
        mult: 1.5, good: 0.6, miss: 0.25, hits: 3,
        speed: 1.32, ramp: 0.12, band: 0.62, shrinkRamp: 0.94, gather: 0.3,
      },
    },
    perfectMult: 1.5,
    goodMult: 1.2,
    missMult: 0.5,         // a dropped beat truly costs now
    comboHits: 3,          // Star Strike chains up to this many bars
    comboMult: 0.5,        // each landed combo hit carries this share of ATK
    // Blocking is a falling-note minigame: shapes descend three lanes
    // (A / S / D) and each is graded by how close to the hit-line you
    // press. Traps mix in at depth — press one and the feint bites.
    lanes: {
      fall: 1.05,          // seconds a note takes to descend (round 13: faster)
      lead: 0.38,          // panel coalesces this long before the first note
      perfectWin: 0.07,    // |Δt| from the hit-line for a PERFECT
      goodWin: 0.15,       // |Δt| for a good press
      dodgeWin: 0.06,      // crush leaps allow only this (no good grade)
      spacing: 0.36,       // seconds between notes in a pattern
      trapWin: 0.15,       // pressing within this of a trap springs it
      fadePortion: 0.3,    // notes fade in over this share of their fall
    },
  },

  camera: {
    startDist: 24,
    minDist: 8,
    maxDist: 170,
    minPitch: 0.55,       // radians above horizon
    maxPitch: 1.35,
    startPitch: 0.95,
  },
};

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
