const params = new URLSearchParams(location.search);

export const CONFIG = {
  seed: (() => {
    const s = params.get('seed');
    return s == null ? 77 : (Number.isFinite(+s) ? Math.abs(Math.trunc(+s)) : hashCode(s));
  })(),

  mapRadius: 30,          // hexes from center to rim (~2,800 tiles)
  hexSize: 1.0,           // world units, center to corner
  tileGap: 0.05,
  baseY: -7.5,            // altitude of the cosmic base plane below the tiles

  visionRadius: 4,        // hexes fully lit around the player
  rimRadius: 6,           // hexes dimly lit at the edge of vision

  hopDuration: 0.27,      // seconds per hex hop
  maxLean: 0.5,           // radians of paper-token parallax lean

  camera: {
    startDist: 24,
    minDist: 8,
    maxDist: 110,
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
