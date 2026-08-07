const params = new URLSearchParams(location.search);

export const CONFIG = {
  seed: (() => {
    const s = params.get('seed');
    return s == null ? 77 : (Number.isFinite(+s) ? Math.abs(Math.trunc(+s)) : hashCode(s));
  })(),

  mapRadius: 45,          // hexes from center to rim (~6,200 tiles)
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
    seedSpacing: 15,      // min hex distance between region seeds
    riftWidth: 1.7,       // voronoi-border band converted to void rift
  },

  secrets: {
    count: 26,            // sealed hexes hidden in the void
    pedestalChance: 0.55, // what a secret holds: item pedestal…
    cacheChance: 0.3,     // …or a shard cache (else consumables)
  },

  battle: {
    baseHP: 30,
    baseAtk: 5,
    baseSpd: 5,
    // The timing minigame: the gold band lands somewhere new every swing,
    // the marker's speed and direction vary, and the bands are narrow.
    timing: {
      travel: 0.85,        // base seconds across the track
      perfectHalf: 0.05,   // half-width of the gold band on strikes
      blockHalf: 0.045,    // …when blocking
      dodgeHalf: 0.035,    // …when dodging a crush (no good band at all)
      goodPad: 0.085,      // the good band extends this far past the gold
      reverseChance: 0.35, // odds the marker sweeps right-to-left
    },
    perfectMult: 1.5,
    goodMult: 1.2,
    missMult: 0.5,         // a dropped beat truly costs now
    blockPerfect: 0.15,    // damage multiplier on a perfect block
    blockGood: 0.6,        // …on a good block
    comboHits: 3,          // Star Strike chains up to this many bars
    comboMult: 0.5,        // each landed combo hit carries this share of ATK
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
