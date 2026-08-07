// The bestiary's face: one hand-authored painter per named species, plus
// one-off portraits for every boss kind. Painters draw onto a 224x224 canvas
// whose origin is already translated to (112, 124) by makeEnemyTexture.
// Each receives o = { base, accent, eye, seed, boss }.

const INK = 'rgba(0,0,0,0.45)';
const DARK = 'rgba(0,0,0,0.55)';
const BONE = '#efe6d5';

// ------------------------------------------------------------ helper kit ---

const body = (g, o, draw) => {
  g.fillStyle = o.base;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  draw();
  g.fill(); g.stroke();
};

const blobPath = (g, rx, ry, wobble, seed) => {
  g.beginPath();
  for (let i = 0; i <= 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const w = 1 + Math.sin(a * 3 + seed * 9) * wobble;
    const x = Math.cos(a) * rx * w, y = Math.sin(a) * ry * w;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
};

const glowEye = (g, x, y, r, color, slit = false) => {
  g.fillStyle = color;
  g.shadowColor = color; g.shadowBlur = 12;
  g.beginPath();
  if (slit) g.ellipse(x, y, r * 1.5, r * 0.55, -0.3, 0, Math.PI * 2);
  else g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
};

const teeth = (g, x0, x1, y, n, h, color = BONE) => {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1)) * (x1 - x0);
    g.beginPath();
    g.moveTo(x - 4, y); g.lineTo(x, y + h); g.lineTo(x + 4, y);
    g.closePath(); g.fill();
  }
};

const wing = (g, sx, y, len, color, flip = 1) => {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(sx, y);
  g.quadraticCurveTo(sx + len * flip, y - 34, sx + len * 1.15 * flip, y - 6);
  g.quadraticCurveTo(sx + len * 0.7 * flip, y + 10, sx, y + 14);
  g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
};

const legs = (g, count, y, spread, len, w, color) => {
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = -spread + (count === 1 ? spread : (i / (count - 1)) * spread * 2);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < 0 ? -6 : 6), y + len); g.stroke();
  }
};

const runeOrbit = (g, chars, color, r, seed) => {
  g.fillStyle = color;
  g.globalAlpha = 0.85;
  g.font = '19px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < chars.length; i++) {
    const a = seed * 6 + (i / chars.length) * Math.PI * 2;
    g.fillText(chars[i], Math.cos(a) * r, -8 + Math.sin(a) * r * 0.7);
  }
  g.globalAlpha = 1;
};

// -------------------------------------------------------------- species ---

const SPECIES = {
  // ═══ MEADOW ═══
  runeboar(g, o) {
    body(g, o, () => blobPath(g, 74, 54, 0.08, o.seed));
    // snout
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.ellipse(48, 8, 26, 20, 0.15, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = DARK;
    g.beginPath(); g.arc(60, 6, 4, 0, Math.PI * 2); g.arc(60, 14, 4, 0, Math.PI * 2); g.fill();
    // tusks & bristle ridge
    teeth(g, 30, 58, 24, 2, 16);
    g.strokeStyle = DARK; g.lineWidth = 4;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-52 + i * 18, -46); g.lineTo(-48 + i * 18, -62); g.stroke(); }
    // glowing rune brand
    g.fillStyle = o.accent; g.shadowColor = o.accent; g.shadowBlur = 10;
    g.font = 'bold 26px serif'; g.textAlign = 'center'; g.fillText('ᚱ', -20, 4);
    g.shadowBlur = 0;
    glowEye(g, 26, -18, 5, o.eye);
  },
  meadow_wisp(g, o) {
    // a knot of living light: layered glows + a trailing spark tail
    for (const [r, a] of [[54, 0.16], [36, 0.3], [20, 0.7]]) {
      g.fillStyle = o.eye; g.globalAlpha = a;
      g.beginPath(); g.arc(0, -12, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = o.eye; g.lineWidth = 4; g.shadowColor = o.eye; g.shadowBlur = 14;
    g.beginPath(); g.moveTo(6, 10);
    g.bezierCurveTo(30, 34, -8, 52, 14, 78); g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    for (const [x, y] of [[-8, -18], [10, -8]]) { g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fill(); }
  },
  sickle_automaton(g, o) {
    // boxy torso, scythe arm, single lens
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.roundRect(-42, -50, 84, 96, 8); g.fill(); g.stroke();
    g.strokeStyle = DARK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-42, -14); g.lineTo(42, -14); g.moveTo(-42, 18); g.lineTo(42, 18); g.stroke();
    legs(g, 2, 46, 22, 22, 8, DARK);
    // scythe arm
    g.strokeStyle = DARK; g.lineWidth = 7;
    g.beginPath(); g.moveTo(42, -30); g.lineTo(74, -52); g.stroke();
    g.fillStyle = BONE;
    g.beginPath(); g.moveTo(74, -52); g.quadraticCurveTo(96, -30, 78, -2);
    g.quadraticCurveTo(86, -32, 68, -46); g.closePath(); g.fill();
    glowEye(g, 0, -32, 10, o.eye);
    g.fillStyle = o.accent; g.font = 'bold 20px serif'; g.textAlign = 'center'; g.fillText('ᛋ', 0, 4);
  },

  // ═══ FOREST ═══
  bramble_wolfshade(g, o) {
    // a lean wolf of shadow and thorn
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-70, 20);
      g.quadraticCurveTo(-40, -34, 10, -30);       // back
      g.lineTo(26, -52); g.lineTo(38, -30);        // ear
      g.quadraticCurveTo(74, -26, 78, -6);         // muzzle
      g.lineTo(58, 2);
      g.quadraticCurveTo(30, 26, -22, 30);
      g.quadraticCurveTo(-56, 40, -70, 20);        // haunch
      g.closePath();
    });
    legs(g, 3, 28, 34, 26, 7, o.base);
    // thorn spikes along the spine
    g.fillStyle = DARK;
    for (let i = 0; i < 5; i++) {
      const x = -56 + i * 18, y = 6 - i * 7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y - 18); g.lineTo(x + 12, y - 2); g.closePath(); g.fill();
    }
    teeth(g, 58, 74, -8, 3, 8);
    glowEye(g, 42, -22, 5, o.eye, true);
  },
  moss_sung_treant(g, o) {
    // trunk torso, branch arms, moss beard
    g.fillStyle = '#4a3a26'; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-30, 70); g.lineTo(-24, -50); g.lineTo(24, -50); g.lineTo(30, 70); g.closePath();
    g.fill(); g.stroke();
    g.strokeStyle = '#4a3a26'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-24, -20); g.lineTo(-64, -48); g.moveTo(-64, -48); g.lineTo(-78, -30); g.stroke();
    g.beginPath(); g.moveTo(24, -14); g.lineTo(62, -44); g.moveTo(62, -44); g.lineTo(80, -52); g.stroke();
    // canopy + moss beard
    g.fillStyle = o.base;
    for (const [x, y, r] of [[-20, -66, 26], [16, -74, 30], [0, -52, 24]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = o.accent; g.globalAlpha = 0.5;
    g.beginPath(); g.ellipse(0, -6, 26, 14, 0, 0, Math.PI); g.fill();
    g.globalAlpha = 1;
    glowEye(g, -10, -28, 5, o.eye); glowEye(g, 12, -28, 5, o.eye);
  },
  owlbat(g, o) {
    // round fluff, huge eyes, ear-wings
    body(g, o, () => blobPath(g, 46, 52, 0.06, o.seed));
    wing(g, -40, -10, -46, o.base, 1);
    wing(g, 40, -10, 46, o.base, 1);
    g.fillStyle = DARK;
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 14, -48); g.lineTo(s * 30, -76); g.lineTo(s * 38, -44); g.closePath(); g.fill();
    }
    glowEye(g, -16, -18, 12, o.eye); glowEye(g, 16, -18, 12, o.eye);
    g.fillStyle = DARK;
    g.beginPath(); g.moveTo(-5, -2); g.lineTo(0, 8); g.lineTo(5, -2); g.closePath(); g.fill();
  },

  // ═══ MOUNTAIN ═══
  echo_wyvern(g, o) {
    // winged serpent trailing echo rings
    g.strokeStyle = o.accent; g.globalAlpha = 0.4; g.lineWidth = 3;
    for (const r of [66, 84]) { g.beginPath(); g.arc(10, -10, r, -0.8, 1.2); g.stroke(); }
    g.globalAlpha = 1;
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-64, 46);
      g.bezierCurveTo(-40, 6, -20, -6, 4, -22);
      g.bezierCurveTo(22, -36, 44, -36, 58, -24);   // head
      g.lineTo(46, -8);
      g.bezierCurveTo(20, 2, -18, 28, -50, 58);
      g.closePath();
    });
    wing(g, 0, -26, 52, o.base);
    wing(g, -8, -18, -44, o.base);
    teeth(g, 46, 58, -22, 2, 7);
    glowEye(g, 40, -28, 5, o.eye, true);
  },
  granite_sentinel(g, o) {
    // a cracked standing slab with buried eyes
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-46, 70); g.lineTo(-54, -40); g.lineTo(-20, -70); g.lineTo(30, -66); g.lineTo(50, -20); g.lineTo(44, 70);
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = DARK; g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(-30, -50); g.lineTo(-12, -20); g.lineTo(-20, 12);
    g.moveTo(24, -40); g.lineTo(12, -6); g.lineTo(26, 30);
    g.stroke();
    g.fillStyle = o.accent; g.font = '17px serif'; g.textAlign = 'center';
    g.fillText('ᛒ', -26, 40); g.fillText('ᚹ', 22, 52);
    glowEye(g, -8, -40, 6, o.eye); glowEye(g, 14, -36, 4, o.eye);
  },
  rockslide_gremlin(g, o) {
    // small hunched thing with enormous hands, mid-pebble-throw
    body(g, o, () => blobPath(g, 40, 44, 0.12, o.seed));
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.ellipse(-52, 10, 20, 26, 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(52, -6, 20, 26, -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = DARK;
    for (const [x, y, r] of [[66, -46, 5], [80, -66, 4], [58, -74, 3]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    teeth(g, -14, 16, 16, 4, -8);
    glowEye(g, -10, -12, 6, o.eye); glowEye(g, 12, -14, 6, o.eye);
  },

  // ═══ VOLCANO ═══
  cinder_choirling(g, o) {
    // a robed singer, mouth a furnace, notes of smoke
    body(g, o, () => {
      g.beginPath();
      g.moveTo(0, -74);
      g.bezierCurveTo(36, -60, 44, 10, 38, 66);
      g.quadraticCurveTo(0, 80, -38, 66);
      g.bezierCurveTo(-44, 10, -36, -60, 0, -74);
      g.closePath();
    });
    // furnace mouth
    g.fillStyle = o.eye; g.shadowColor = o.eye; g.shadowBlur = 16;
    g.beginPath(); g.ellipse(0, -22, 14, 20, 0, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    glowEye(g, -16, -48, 4, o.eye); glowEye(g, 16, -48, 4, o.eye);
    g.fillStyle = o.accent; g.font = '19px serif';
    g.fillText('♪', -36, -66); g.fillText('♬', 34, -80); g.fillText('♪', 10, -96);
    g.strokeStyle = DARK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-24, 28); g.quadraticCurveTo(0, 40, 24, 28); g.stroke();
  },
  magma_seraph(g, o) {
    // winged figure of cooling stone over molten seams
    body(g, o, () => blobPath(g, 40, 62, 0.08, o.seed));
    wing(g, -34, -18, -56, DARK);
    wing(g, 34, -18, 56, DARK);
    // molten seams
    g.strokeStyle = o.eye; g.shadowColor = o.eye; g.shadowBlur = 8; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-16, -50); g.lineTo(-6, -10); g.lineTo(-18, 30);
    g.moveTo(14, -44); g.lineTo(8, 0); g.lineTo(20, 44);
    g.stroke(); g.shadowBlur = 0;
    // halo
    g.strokeStyle = o.accent; g.lineWidth = 4;
    g.beginPath(); g.arc(0, -76, 20, 0, Math.PI * 2); g.stroke();
    glowEye(g, -10, -52, 5, o.eye); glowEye(g, 10, -52, 5, o.eye);
  },
  ash_salamander(g, o) {
    // low slinking lizard, ember-spotted, tail curling
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-70, 30);
      g.quadraticCurveTo(-30, 6, 20, 10);
      g.quadraticCurveTo(52, 10, 66, 22);        // head
      g.quadraticCurveTo(52, 40, 20, 40);
      g.quadraticCurveTo(-30, 44, -70, 30);
      g.closePath();
    });
    g.strokeStyle = o.base; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-66, 32); g.bezierCurveTo(-92, 24, -84, -6, -62, -12); g.stroke();
    legs(g, 3, 40, 34, 18, 6, DARK);
    g.fillStyle = o.eye; g.shadowColor = o.eye; g.shadowBlur = 8;
    for (const [x, y] of [[-34, 24], [-4, 20], [26, 22], [-52, 30]]) {
      g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
    glowEye(g, 54, 20, 4, o.eye, true);
  },

  // ═══ DESERT ═══
  glasscoil_serpent(g, o) {
    // translucent coiled snake, sun caught in the loops
    g.globalAlpha = 0.75;
    g.strokeStyle = o.base; g.lineWidth = 16; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-58, 46);
    g.bezierCurveTo(-70, -10, 20, -20, 26, 16);
    g.bezierCurveTo(30, 44, -30, 48, -20, 12);
    g.stroke();
    g.globalAlpha = 1;
    g.strokeStyle = INK; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-58, 46); g.bezierCurveTo(-70, -10, 20, -20, 26, 16); g.stroke();
    // head rearing
    body(g, o, () => { g.beginPath(); g.ellipse(30, -38, 18, 24, 0.3, 0, Math.PI * 2); });
    teeth(g, 24, 40, -18, 2, 8);
    glowEye(g, 30, -44, 5, o.eye, true);
    g.fillStyle = o.accent; g.globalAlpha = 0.6;
    g.beginPath(); g.arc(-24, 22, 7, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  },
  sun_bleached_revenant(g, o) {
    // a wrapped skeletal walker under a dead sun-disc
    g.fillStyle = o.accent; g.globalAlpha = 0.35;
    g.beginPath(); g.arc(0, -78, 24, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-26, -58); g.lineTo(26, -58); g.lineTo(34, 20); g.lineTo(18, 70);
      g.lineTo(-18, 70); g.lineTo(-34, 20);
      g.closePath();
    });
    // bandage wraps
    g.strokeStyle = BONE; g.lineWidth = 4; g.globalAlpha = 0.8;
    for (let y = -46; y < 60; y += 14) {
      g.beginPath(); g.moveTo(-32, y); g.lineTo(32, y + 6); g.stroke();
    }
    g.globalAlpha = 1;
    // hollow rib window
    g.fillStyle = DARK;
    g.beginPath(); g.roundRect(-14, -10, 28, 30, 6); g.fill();
    glowEye(g, -9, -40, 5, o.eye); glowEye(g, 9, -40, 5, o.eye);
  },
  dune_mawfish(g, o) {
    // a maw bursting from a sand mound
    g.fillStyle = o.accent; g.globalAlpha = 0.5;
    g.beginPath(); g.ellipse(0, 52, 78, 22, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-52, 52);
      g.quadraticCurveTo(-58, -30, 0, -50);
      g.quadraticCurveTo(58, -30, 52, 52);
      g.closePath();
    });
    // the maw
    g.fillStyle = DARK;
    g.beginPath(); g.ellipse(0, -2, 34, 26, 0, 0, Math.PI * 2); g.fill();
    teeth(g, -28, 28, -22, 6, 12);
    teeth(g, -24, 24, 18, 5, -10);
    glowEye(g, -30, -38, 5, o.eye); glowEye(g, 30, -38, 5, o.eye);
    // dorsal fin
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-8, -50); g.lineTo(4, -78); g.lineTo(16, -48); g.closePath(); g.fill(); g.stroke();
  },

  // ═══ TUNDRA ═══
  frostmarrow_stag(g, o) {
    // a gaunt stag, antlers holding a sliver of moon
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-56, 34);
      g.quadraticCurveTo(-30, -2, 8, -12);
      g.lineTo(22, -44);                      // neck
      g.quadraticCurveTo(34, -58, 48, -52);   // head
      g.lineTo(44, -36); g.lineTo(20, -8);
      g.quadraticCurveTo(0, 24, -40, 44);
      g.closePath();
    });
    legs(g, 3, 34, 36, 32, 5, o.base);
    // antlers
    g.strokeStyle = BONE; g.lineWidth = 4; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(30 + s * 4, -56);
      g.bezierCurveTo(24 + s * 14, -84, 40 + s * 18, -92, 34 + s * 26, -104);
      g.stroke();
      g.beginPath(); g.moveTo(30 + s * 8, -74); g.lineTo(38 + s * 16, -80); g.stroke();
    }
    // caught moon
    g.fillStyle = o.accent; g.shadowColor = o.accent; g.shadowBlur = 12;
    g.beginPath(); g.arc(34, -96, 8, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    glowEye(g, 38, -46, 4, o.eye, true);
  },
  the_loosed_hound(g, o) {
    // the card's hound, mid-lunge, one edge still paper
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-66, 30);
      g.quadraticCurveTo(-30, -18, 20, -26);
      g.lineTo(30, -46); g.lineTo(42, -28);   // ear
      g.quadraticCurveTo(72, -22, 76, -8);    // muzzle
      g.lineTo(52, 4);
      g.quadraticCurveTo(10, 22, -50, 44);
      g.closePath();
    });
    legs(g, 3, 30, 36, 26, 6, o.base);
    // the card edge it never fully left
    g.strokeStyle = o.accent; g.lineWidth = 3;
    g.setLineDash([7, 5]);
    g.strokeRect(-84, -50, 58, 84);
    g.setLineDash([]);
    teeth(g, 56, 72, -8, 3, 8);
    glowEye(g, 44, -22, 5, o.eye, true);
  },
  sleetclad_mammoth(g, o) {
    // a dome of fur and patience with great curling tusks
    body(g, o, () => blobPath(g, 80, 60, 0.05, o.seed));
    // fur strokes
    g.strokeStyle = DARK; g.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const x = -64 + i * 18;
      g.beginPath(); g.moveTo(x, 34); g.lineTo(x - 4, 56); g.stroke();
    }
    // trunk
    g.strokeStyle = o.base; g.lineWidth = 13; g.lineCap = 'round';
    g.beginPath(); g.moveTo(58, 0); g.bezierCurveTo(84, 18, 78, 46, 62, 58); g.stroke();
    // tusks
    g.strokeStyle = BONE; g.lineWidth = 7;
    g.beginPath(); g.moveTo(48, 22); g.bezierCurveTo(88, 30, 96, 2, 84, -14); g.stroke();
    g.beginPath(); g.moveTo(36, 30); g.bezierCurveTo(66, 44, 82, 30, 80, 12); g.stroke();
    glowEye(g, 34, -18, 5, o.eye);
    // sleet crust
    g.fillStyle = '#eaf7ff'; g.globalAlpha = 0.7;
    g.beginPath(); g.ellipse(-10, -48, 56, 16, 0.1, 0, Math.PI); g.fill();
    g.globalAlpha = 1;
  },

  // ═══ SEA ═══
  star_drowned_siren(g, o) {
    // a fish-tailed figure crowned in drowned stars, hair like current
    body(g, o, () => {
      g.beginPath();
      g.moveTo(0, -64);
      g.bezierCurveTo(26, -56, 30, -10, 18, 18);
      g.bezierCurveTo(40, 34, 48, 58, 34, 74);   // tail sweep
      g.quadraticCurveTo(12, 60, -2, 40);
      g.bezierCurveTo(-30, 12, -26, -54, 0, -64);
      g.closePath();
    });
    // hair current
    g.strokeStyle = o.accent; g.lineWidth = 5; g.lineCap = 'round'; g.globalAlpha = 0.8;
    for (const dy of [-58, -48, -38]) {
      g.beginPath(); g.moveTo(-6, dy); g.bezierCurveTo(-40, dy + 4, -56, dy + 20, -74, dy + 16); g.stroke();
    }
    g.globalAlpha = 1;
    // star crown
    g.fillStyle = '#fff'; g.shadowColor = o.eye; g.shadowBlur = 10;
    for (const [x, y] of [[-10, -74], [2, -80], [14, -72]]) {
      g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
    glowEye(g, -2, -52, 5, o.eye); glowEye(g, 12, -50, 5, o.eye);
    // tail fin
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(34, 74); g.lineTo(58, 62); g.lineTo(52, 86); g.closePath(); g.fill(); g.stroke();
  },
  void_angler(g, o) {
    // vast maw, needle teeth, a lure of borrowed starlight
    body(g, o, () => blobPath(g, 66, 52, 0.1, o.seed));
    // gaping jaw
    g.fillStyle = DARK;
    g.beginPath();
    g.moveTo(-50, 6); g.quadraticCurveTo(0, -18, 54, -2);
    g.quadraticCurveTo(10, 40, -50, 6);
    g.closePath(); g.fill();
    teeth(g, -40, 44, -4, 7, 11);
    teeth(g, -36, 36, 20, 6, -9);
    // lure
    g.strokeStyle = o.base; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-10, -48); g.bezierCurveTo(-16, -80, 16, -84, 24, -72); g.stroke();
    g.fillStyle = '#fff'; g.shadowColor = '#9fe8ff'; g.shadowBlur = 18;
    g.beginPath(); g.arc(26, -70, 7, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    glowEye(g, -26, -22, 5, o.eye);
  },
  brine_reflection(g, o) {
    // your own outline, wrong, made of water
    g.globalAlpha = 0.8;
    g.fillStyle = o.base; g.strokeStyle = o.accent; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, -70);
    g.bezierCurveTo(38, -62, 46, -6, 37, 70);
    g.quadraticCurveTo(0, 82, -37, 70);
    g.bezierCurveTo(-46, -6, -38, -62, 0, -70);
    g.closePath(); g.fill(); g.stroke();
    g.globalAlpha = 1;
    // the face refuses to resolve: ripple lines instead
    g.strokeStyle = o.accent; g.lineWidth = 3;
    for (const dy of [-46, -36, -26]) {
      g.beginPath(); g.moveTo(-20, dy); g.quadraticCurveTo(0, dy + 5, 20, dy); g.stroke();
    }
    // your star-eyes, drowned dim
    glowEye(g, -12, -40, 5, o.eye); glowEye(g, 12, -40, 5, o.eye);
    // a dripping hem
    g.fillStyle = o.base;
    for (let i = 0; i < 4; i++) {
      const x = -28 + i * 19;
      g.beginPath(); g.moveTo(x, 70); g.quadraticCurveTo(x + 4, 88, x + 8, 70); g.fill();
    }
  },

  // ═══ CRYSTAL ═══
  prism_shard_golem(g, o) {
    // stacked refracting facets
    g.strokeStyle = INK; g.lineWidth = 5;
    const facets = [
      [0, 40, 44, 34, o.base], [-30, 2, 26, 30, o.accent], [26, -2, 24, 26, o.base],
      [0, -34, 30, 28, o.accent], [0, -70, 18, 22, o.base],
    ];
    for (const [x, y, rx, ry, col] of facets) {
      g.fillStyle = col; g.globalAlpha = 0.9;
      g.beginPath();
      g.moveTo(x, y - ry); g.lineTo(x + rx, y); g.lineTo(x, y + ry); g.lineTo(x - rx, y);
      g.closePath(); g.fill(); g.stroke();
    }
    g.globalAlpha = 1;
    glowEye(g, 0, -70, 6, o.eye);
    // refracted gleams
    g.strokeStyle = '#fff'; g.globalAlpha = 0.5; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-20, 20); g.lineTo(-6, 6); g.moveTo(18, -20); g.lineTo(26, -30); g.stroke();
    g.globalAlpha = 1;
  },
  chiming_widow(g, o) {
    // a bell-bodied spider, legs of dark wire
    g.strokeStyle = DARK; g.lineWidth = 5; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const y = -26 + i * 16;
        g.beginPath();
        g.moveTo(s * 20, y);
        g.lineTo(s * (54 + i * 6), y - 14);
        g.lineTo(s * (70 + i * 5), y + 18);
        g.stroke();
      }
    }
    // bell abdomen
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-32, -34);
      g.quadraticCurveTo(0, -56, 32, -34);
      g.lineTo(38, 28); g.lineTo(-38, 28);
      g.closePath();
    });
    g.fillStyle = o.accent;
    g.beginPath(); g.arc(0, 38, 7, 0, Math.PI * 2); g.fill();   // the clapper
    glowEye(g, -10, -20, 4, o.eye); glowEye(g, 10, -20, 4, o.eye);
    glowEye(g, 0, -32, 3, o.eye);
  },
  facet_stalker(g, o) {
    // angular prowling cat, all planes and edges
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-70, 28); g.lineTo(-38, -12); g.lineTo(6, -20); g.lineTo(30, -46);
    g.lineTo(44, -44); g.lineTo(40, -28); g.lineTo(64, -18); g.lineTo(56, 0);
    g.lineTo(20, 6); g.lineTo(-16, 26); g.lineTo(-48, 46);
    g.closePath(); g.fill(); g.stroke();
    legs(g, 3, 30, 34, 26, 6, o.base);
    // facet lines
    g.strokeStyle = o.accent; g.lineWidth = 2.5; g.globalAlpha = 0.8;
    g.beginPath();
    g.moveTo(-38, -12) ; g.lineTo(-20, 16); g.moveTo(6, -20); g.lineTo(2, 8); g.moveTo(30, -28); g.lineTo(48, -6);
    g.stroke();
    g.globalAlpha = 1;
    glowEye(g, 38, -36, 4, o.eye, true);
  },

  // ═══ ROAD & BRIDGE ═══
  toll_wraith(g, o) {
    body(g, o, () => {
      g.beginPath();
      g.moveTo(0, -72);
      g.bezierCurveTo(34, -60, 40, -4, 30, 40);
      // ragged hem
      for (let x = 30; x >= -30; x -= 12) g.lineTo(x, 40 + ((x / 12) % 2 ? 16 : 30));
      g.bezierCurveTo(-40, -4, -34, -60, 0, -72);
      g.closePath();
    });
    g.fillStyle = DARK;
    g.beginPath(); g.ellipse(0, -46, 20, 16, 0, 0, Math.PI * 2); g.fill();
    glowEye(g, -8, -46, 4, o.eye); glowEye(g, 8, -46, 4, o.eye);
    // the toll coin, held out
    g.strokeStyle = o.base; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(30, -20); g.lineTo(58, -30); g.stroke();
    g.fillStyle = o.accent; g.shadowColor = o.accent; g.shadowBlur = 10;
    g.beginPath(); g.arc(66, -34, 9, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  },
  waylaid_knight(g, o) {
    // a knight who never made it, shield first
    body(g, o, () => {
      g.beginPath(); g.roundRect(-26, -58, 52, 110, 10);
    });
    // helm
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.arc(0, -60, 20, Math.PI, 0); g.lineTo(20, -46); g.lineTo(-20, -46); g.closePath();
    g.fill(); g.stroke();
    glowEye(g, 0, -56, 8, o.eye, true);
    // battered shield
    g.fillStyle = o.accent; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-58, -34); g.lineTo(-24, -40); g.lineTo(-22, 10); g.lineTo(-40, 30); g.lineTo(-58, 8);
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = DARK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-50, -20); g.lineTo(-34, 0); g.stroke();
    // spear stub
    g.strokeStyle = '#6b5537'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(30, 30); g.lineTo(52, -64); g.stroke();
  },
  bridge_haunt(g, o) {
    // an arch of the bridge itself, walking
    g.globalAlpha = 0.85;
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-52, 60); g.lineTo(-52, -10);
      g.quadraticCurveTo(0, -70, 52, -10);
      g.lineTo(52, 60); g.lineTo(28, 60); g.lineTo(28, 6);
      g.quadraticCurveTo(0, -30, -28, 6);
      g.lineTo(-28, 60);
      g.closePath();
    });
    g.globalAlpha = 1;
    // rune keystone
    g.fillStyle = o.accent; g.shadowColor = o.accent; g.shadowBlur = 10;
    g.font = 'bold 24px serif'; g.textAlign = 'center'; g.fillText('ᚷ', 0, -44);
    g.shadowBlur = 0;
    glowEye(g, -38, 8, 5, o.eye); glowEye(g, 38, 8, 5, o.eye);
  },
  star_remora(g, o) {
    // a sleek hanger-on with a star-shaped sucker
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-66, 6);
      g.quadraticCurveTo(-20, -26, 40, -12);
      g.quadraticCurveTo(66, -4, 58, 10);
      g.quadraticCurveTo(-20, 30, -66, 6);
      g.closePath();
    });
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-62, 6); g.lineTo(-84, -10); g.lineTo(-80, 22); g.closePath(); g.fill(); g.stroke();
    // star sucker
    g.fillStyle = o.accent; g.shadowColor = o.accent; g.shadowBlur = 10;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? 16 : 7;
      g.lineTo(44 + Math.cos(a) * rr, -30 + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    g.shadowBlur = 0;
    glowEye(g, 30, -4, 4, o.eye, true);
  },

  // ═══ LUNAR ═══
  moon_moth(g, o) {
    for (const s of [-1, 1]) {
      g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 5;
      g.beginPath();
      g.moveTo(s * 6, -10);
      g.bezierCurveTo(s * 66, -66, s * 92, -20, s * 54, 8);
      g.bezierCurveTo(s * 78, 26, s * 44, 52, s * 10, 26);
      g.closePath(); g.fill(); g.stroke();
      // wing moons
      g.fillStyle = o.accent; g.globalAlpha = 0.9;
      g.beginPath(); g.arc(s * 44, -20, 9, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // furred body
    g.fillStyle = DARK;
    g.beginPath(); g.ellipse(0, 4, 12, 34, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = DARK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-4, -28); g.quadraticCurveTo(-14, -48, -8, -56); g.stroke();
    g.beginPath(); g.moveTo(4, -28); g.quadraticCurveTo(14, -48, 8, -56); g.stroke();
    glowEye(g, -5, -24, 4, o.eye); glowEye(g, 5, -24, 4, o.eye);
  },
  pale_pilgrim(g, o) {
    body(g, o, () => {
      g.beginPath();
      g.moveTo(0, -70);
      g.bezierCurveTo(30, -58, 36, 20, 30, 70);
      g.quadraticCurveTo(0, 80, -30, 70);
      g.bezierCurveTo(-36, 20, -30, -58, 0, -70);
      g.closePath();
    });
    // deep hood, no face — only a crescent
    g.fillStyle = DARK;
    g.beginPath(); g.ellipse(0, -44, 20, 18, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = o.eye; g.shadowColor = o.eye; g.shadowBlur = 10; g.lineWidth = 4;
    g.beginPath(); g.arc(2, -44, 9, -1.2, 1.6); g.stroke();
    g.shadowBlur = 0;
    // pilgrim staff with bell
    g.strokeStyle = '#8a8aa0'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(40, 70); g.lineTo(48, -60); g.stroke();
    g.fillStyle = o.accent;
    g.beginPath(); g.arc(48, -66, 7, 0, Math.PI * 2); g.fill();
  },
  crater_hermit(g, o) {
    // a crab wearing a crater
    g.fillStyle = o.accent; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.arc(0, -16, 52, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = DARK;
    for (const [x, y, r] of [[-24, -38, 8], [10, -52, 6], [30, -32, 9]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    body(g, o, () => { g.beginPath(); g.ellipse(0, 4, 44, 24, 0, 0, Math.PI * 2); });
    legs(g, 4, 20, 42, 20, 6, o.base);
    // claws
    for (const s of [-1, 1]) {
      g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.ellipse(s * 58, 2, 16, 11, s * 0.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = DARK;
      g.beginPath(); g.moveTo(s * 66, -4); g.lineTo(s * 82, -12); g.lineTo(s * 70, 6); g.closePath(); g.fill();
    }
    glowEye(g, -10, -4, 4, o.eye); glowEye(g, 10, -4, 4, o.eye);
  },

  // ═══ CRIMSON ═══
  rust_hound(g, o) {
    body(g, o, () => {
      g.beginPath();
      g.moveTo(-64, 26); g.lineTo(-30, -14); g.lineTo(10, -22); g.lineTo(20, -44);
      g.lineTo(34, -26); g.lineTo(70, -16); g.lineTo(60, 0); g.lineTo(16, 8); g.lineTo(-40, 40);
      g.closePath();
    });
    legs(g, 3, 28, 34, 24, 6, o.base);
    // flaking rust plates
    g.fillStyle = o.accent; g.globalAlpha = 0.7;
    for (const [x, y] of [[-30, 0], [-6, -10], [24, -16]]) {
      g.beginPath(); g.rect(x, y, 12, 8); g.fill();
    }
    g.globalAlpha = 1;
    teeth(g, 52, 66, -16, 3, 7);
    glowEye(g, 34, -30, 4, o.eye, true);
  },
  oxide_shambler(g, o) {
    // a heap that remembers being a machine
    body(g, o, () => blobPath(g, 70, 56, 0.18, o.seed));
    // protruding scrap
    g.fillStyle = DARK;
    g.beginPath(); g.rect(-50, -50, 20, 12); g.rect(20, -58, 14, 22); g.rect(-8, -66, 10, 16); g.fill();
    // one working gear-eye and rust drips
    g.strokeStyle = o.accent; g.lineWidth = 4;
    g.beginPath(); g.arc(14, -18, 14, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(14 + Math.cos(a) * 14, -18 + Math.sin(a) * 14);
      g.lineTo(14 + Math.cos(a) * 20, -18 + Math.sin(a) * 20);
      g.stroke();
    }
    glowEye(g, 14, -18, 6, o.eye);
    g.strokeStyle = o.accent; g.globalAlpha = 0.7; g.lineWidth = 3;
    for (const x of [-30, -6, 34]) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 2, 48); g.stroke(); }
    g.globalAlpha = 1;
  },
  dust_chorister(g, o) {
    // a column of red dust with too many mouths
    g.fillStyle = o.base; g.globalAlpha = 0.85;
    for (let i = 0; i < 5; i++) {
      const w = 46 - i * 6;
      g.beginPath(); g.ellipse(Math.sin(i * 1.8 + o.seed * 6) * 8, 56 - i * 30, w, 18, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // mouths at several heights, all singing
    g.fillStyle = DARK;
    for (const [x, y, w] of [[-12, 24, 16], [14, -8, 12], [-8, -40, 14]]) {
      g.beginPath(); g.ellipse(x, y, w, 7, 0, 0, Math.PI * 2); g.fill();
      teeth(g, x - w + 4, x + w - 4, y - 5, 3, 5);
    }
    glowEye(g, -14, -62, 5, o.eye); glowEye(g, 12, -66, 5, o.eye);
  },

  // ═══ VERDANT ═══
  seed_sentinel(g, o) {
    // armored in seed-pod plates
    body(g, o, () => {
      g.beginPath();
      g.moveTo(0, -66); g.lineTo(38, -40) ; g.lineTo(44, 30); g.lineTo(0, 70); g.lineTo(-44, 30); g.lineTo(-38, -40);
      g.closePath();
    });
    // pod plates
    g.fillStyle = o.accent; g.strokeStyle = INK; g.lineWidth = 3; g.globalAlpha = 0.85;
    for (const [x, y] of [[-20, -20], [20, -20], [0, 10], [-18, 34], [18, 34]]) {
      g.beginPath(); g.ellipse(x, y, 11, 15, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    g.globalAlpha = 1;
    glowEye(g, -10, -46, 5, o.eye); glowEye(g, 10, -46, 5, o.eye);
    // sprout plume
    g.strokeStyle = '#3f8a5a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -66); g.quadraticCurveTo(6, -84, 18, -88); g.stroke();
    g.fillStyle = '#8affc4';
    g.beginPath(); g.ellipse(20, -90, 7, 4, 0.5, 0, Math.PI * 2); g.fill();
  },
  vine_lasher(g, o) {
    // a core knot with whip-vines mid-swing
    body(g, o, () => blobPath(g, 34, 38, 0.14, o.seed));
    g.strokeStyle = o.base; g.lineWidth = 8; g.lineCap = 'round';
    const whips = [[-80, -40], [76, -52], [84, 24], [-70, 40]];
    for (const [ex, ey] of whips) {
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(ex * 0.4, ey * 0.9 - 20, ex, ey);
      g.stroke();
      g.fillStyle = o.accent;
      g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + 8, ey - 10); g.lineTo(ex + 12, ey + 4); g.closePath(); g.fill();
    }
    glowEye(g, 0, -8, 7, o.eye);
    g.strokeStyle = DARK; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 8, 12, 0.2, Math.PI - 0.2); g.stroke();
  },
  bloom_horror(g, o) {
    // a flower that eats
    g.strokeStyle = '#3f8a5a'; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 74); g.bezierCurveTo(-10, 40, 8, 20, 0, -8); g.stroke();
    // petals
    g.fillStyle = o.accent; g.strokeStyle = INK; g.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + o.seed;
      g.save();
      g.translate(0, -26); g.rotate(a);
      g.beginPath(); g.ellipse(0, -34, 14, 30, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    }
    // the mouth at the center
    g.fillStyle = DARK;
    g.beginPath(); g.arc(0, -26, 22, 0, Math.PI * 2); g.fill();
    teeth(g, -16, 16, -42, 5, 9);
    teeth(g, -14, 14, -12, 4, -8);
    glowEye(g, -26, -52, 4, o.eye); glowEye(g, 26, -52, 4, o.eye);
    // leaf arms
    g.fillStyle = '#3f8a5a';
    g.beginPath(); g.ellipse(-30, 40, 22, 9, 0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(30, 46, 22, 9, -0.5, 0, Math.PI * 2); g.fill();
  },

  // ═══ SECRET ═══
  hoard_mimic(g, o) {
    // the chest, mid-betrayal
    g.fillStyle = '#6b4f2a'; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.roundRect(-56, -6, 112, 62, 8); g.fill(); g.stroke();
    // lid agape
    g.fillStyle = '#7a5a32';
    g.beginPath();
    g.moveTo(-56, -6); g.lineTo(-64, -58); g.lineTo(60, -44); g.lineTo(56, -6);
    g.closePath(); g.fill(); g.stroke();
    // maw & tongue
    g.fillStyle = DARK;
    g.beginPath(); g.moveTo(-52, -6); g.lineTo(52, -6); g.lineTo(44, 14); g.lineTo(-44, 14); g.closePath(); g.fill();
    teeth(g, -46, 48, -6, 8, 12);
    g.strokeStyle = '#d94f6e'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(20, 28, 48, 20, 62, 38); g.stroke();
    // spilling shards
    g.fillStyle = o.accent; g.shadowColor = o.accent; g.shadowBlur = 8;
    for (const [x, y] of [[-30, -18], [-10, -26], [16, -20]]) {
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
    glowEye(g, -20, -34, 5, o.eye); glowEye(g, 18, -32, 5, o.eye);
  },

  // ═══ WOUND ═══
  meridian_leech(g, o) {
    // a segmented worm of un-space, sucker first
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 5;
    for (let i = 5; i >= 0; i--) {
      const x = -58 + i * 4, y = 40 - i * 22;
      g.beginPath(); g.ellipse(x + Math.sin(i * 1.4) * 16, y, 30 - i * 2.5, 20, 0, 0, Math.PI * 2);
      g.fill(); g.stroke();
    }
    // the sucker face
    g.fillStyle = DARK;
    g.beginPath(); g.arc(-44, -72, 20, 0, Math.PI * 2); g.fill();
    g.strokeStyle = o.eye; g.lineWidth = 3;
    for (const r of [7, 13, 19]) { g.beginPath(); g.arc(-44, -72, r, 0, Math.PI * 2); g.stroke(); }
    teeth(g, -58, -30, -86, 5, 6, o.accent);
    glowEye(g, -20, -50, 4, o.eye); glowEye(g, -8, -38, 3, o.eye);
  },
  unfolded_pilgrim(g, o) {
    // a paper person opened along every fold, wrongly
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, -74); g.lineTo(28, -40) ; g.lineTo(64, -48); g.lineTo(40, -8);
    g.lineTo(70, 22); g.lineTo(26, 26); g.lineTo(30, 70); g.lineTo(0, 42);
    g.lineTo(-30, 70); g.lineTo(-26, 26); g.lineTo(-70, 22); g.lineTo(-40, -8);
    g.lineTo(-64, -48); g.lineTo(-28, -40);
    g.closePath(); g.fill(); g.stroke();
    // fold creases
    g.strokeStyle = DARK; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, -74); g.lineTo(0, 42);
    g.moveTo(-64, -48); g.lineTo(64, -48);
    g.moveTo(-70, 22); g.lineTo(70, 22);
    g.stroke();
    // too many star-eyes, arranged wrong
    for (const [x, y] of [[-16, -52], [14, -50], [0, -30], [-28, -14], [30, -16]]) {
      glowEye(g, x, y, 4, o.eye);
    }
    g.strokeStyle = '#8a84b8'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 2, 10, 0.75 * Math.PI, 0.25 * Math.PI); g.stroke();  // the smile, inverted
  },
  the_choir_below(g, o) {
    // a rising mass that is mostly mouths
    body(g, o, () => blobPath(g, 72, 60, 0.2, o.seed));
    g.fillStyle = DARK;
    const mouths = [[-34, -20, 18, 9], [22, -34, 14, 8], [2, 8, 22, 11], [-20, 34, 12, 6], [40, 12, 13, 7]];
    for (const [x, y, w, h] of mouths) {
      g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill();
      teeth(g, x - w + 4, x + w - 4, y - h + 2, 4, 5, o.accent);
    }
    // singing lines rising
    g.strokeStyle = o.accent; g.globalAlpha = 0.7; g.lineWidth = 2.5;
    for (const x of [-40, 0, 36]) {
      g.beginPath(); g.moveTo(x, -58); g.bezierCurveTo(x - 8, -78, x + 8, -88, x, -104); g.stroke();
    }
    g.globalAlpha = 1;
    glowEye(g, -8, -44, 5, o.eye);
  },
};

// ------------------------------------------------------------ boss kinds ---

const BOSSES = {
  warden(g, o) {
    // a monolith knight of folded starlight — the standard door-boss
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-40, 84); g.lineTo(-50, -30); g.lineTo(-24, -76); g.lineTo(24, -76); g.lineTo(50, -30); g.lineTo(40, 84);
    g.closePath(); g.fill(); g.stroke();
    // barrier shards orbiting
    g.fillStyle = o.accent; g.globalAlpha = 0.85;
    for (let i = 0; i < 4; i++) {
      const a = o.seed * 5 + i * 1.6;
      const x = Math.cos(a) * 78, y = -10 + Math.sin(a) * 54;
      g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 9, y); g.lineTo(x, y + 14); g.lineTo(x - 9, y);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    // the visor — one long judging light
    g.fillStyle = o.eye; g.shadowColor = o.eye; g.shadowBlur = 16;
    g.beginPath(); g.roundRect(-28, -56, 56, 8, 4); g.fill();
    g.shadowBlur = 0;
    // seal on the chest
    g.strokeStyle = o.accent; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 4, 20, 0, Math.PI * 2); g.stroke();
    g.fillStyle = o.accent; g.font = 'bold 26px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ᛟ', 0, 4);
  },
  keeper(g, o) {
    // the vault made ambulatory: a strongbox golem with a keyhole heart
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.roundRect(-54, -64, 108, 128, 10); g.fill(); g.stroke();
    g.strokeStyle = DARK; g.lineWidth = 4;
    g.strokeRect(-54, -24, 108, 0);
    for (const [x, y] of [[-42, -50], [42, -50], [-42, 50], [42, 50]]) {
      g.fillStyle = DARK; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    }
    // keyhole heart
    g.fillStyle = DARK;
    g.beginPath(); g.arc(0, 6, 16, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-8, 16); g.lineTo(8, 16); g.lineTo(14, 44); g.lineTo(-14, 44); g.closePath(); g.fill();
    g.strokeStyle = o.eye; g.shadowColor = o.eye; g.shadowBlur = 10; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 6, 20, 0, Math.PI * 2); g.stroke();
    g.shadowBlur = 0;
    glowEye(g, -20, -44, 6, o.eye); glowEye(g, 20, -44, 6, o.eye);
    // chained treasures dangling
    g.strokeStyle = '#8a7a58'; g.lineWidth = 3;
    for (const x of [-30, 30]) {
      g.beginPath(); g.moveTo(x, 64); g.lineTo(x, 84); g.stroke();
      g.fillStyle = '#f0c46a';
      g.beginPath(); g.arc(x, 90, 6, 0, Math.PI * 2); g.fill();
    }
  },
  guardian(g, o) {
    // the threshold guardian: a chained statue that stood up anyway
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath();
    g.moveTo(-34, 80); g.lineTo(-40, -20); g.lineTo(-16, -50); g.lineTo(0, -80);
    g.lineTo(16, -50); g.lineTo(40, -20); g.lineTo(34, 80);
    g.closePath(); g.fill(); g.stroke();
    // the chains it wears like a stole
    g.strokeStyle = DARK; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-40, -14); g.bezierCurveTo(-10, 24, 14, 20, 40, -8); g.stroke();
    g.beginPath(); g.moveTo(-36, 6); g.bezierCurveTo(-6, 40, 20, 38, 38, 12); g.stroke();
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = DARK; g.lineWidth = 3;
      g.beginPath(); g.arc(-30 + i * 15, 22 + Math.sin(i) * 6, 5, 0, Math.PI * 2); g.stroke();
    }
    glowEye(g, -10, -46, 5, o.eye); glowEye(g, 10, -46, 5, o.eye);
    g.fillStyle = o.accent; g.font = '20px serif'; g.textAlign = 'center';
    g.fillText('ᚦ', 0, 56);
  },
  champion(g, o) {
    // the reigning champion: plume, belt, and unearned confidence
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 6;
    g.beginPath(); g.roundRect(-34, -52, 68, 118, 12); g.fill(); g.stroke();
    // plumed helm
    g.fillStyle = o.base;
    g.beginPath(); g.arc(0, -56, 22, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#d94f6e'; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -76); g.bezierCurveTo(18, -96, 42, -92, 54, -76); g.stroke();
    glowEye(g, 0, -56, 8, o.eye, true);
    // the belt
    g.fillStyle = '#f0c46a'; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.roundRect(-36, 8, 72, 18, 6); g.fill(); g.stroke();
    g.fillStyle = DARK; g.font = 'bold 13px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('★', 0, 17);
    // twin sabres
    g.strokeStyle = BONE; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-40, 0); g.lineTo(-72, -50); g.moveTo(40, 0); g.lineTo(72, -50); g.stroke();
  },
  sat_luna(g, o) {
    // Selureth: a moth-winged colossus of moonlight
    for (const s of [-1, 1]) {
      g.fillStyle = '#cfe0ff'; g.globalAlpha = 0.85;
      g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath();
      g.moveTo(s * 8, -20);
      g.bezierCurveTo(s * 84, -88, s * 108, -20, s * 62, 10);
      g.bezierCurveTo(s * 92, 34, s * 48, 66, s * 12, 30);
      g.closePath(); g.fill(); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#8fa8e0';
      g.beginPath(); g.arc(s * 54, -30, 11, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(s * 44, 30, 7, 0, Math.PI * 2); g.fill();
    }
    // the tide-warden's body: a slender moonlit pillar
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 5;
    g.beginPath(); g.ellipse(0, 6, 16, 56, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#cfe0ff'; g.shadowColor = '#cfe0ff'; g.shadowBlur = 14; g.lineWidth = 5;
    g.beginPath(); g.arc(0, -66, 16, -1.1, Math.PI + 1.1); g.stroke();
    g.shadowBlur = 0;
    glowEye(g, -6, -46, 5, o.eye); glowEye(g, 6, -46, 5, o.eye);
    // feathered antennae
    g.strokeStyle = DARK; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-5, -58); g.quadraticCurveTo(-20, -84, -12, -96); g.stroke();
    g.beginPath(); g.moveTo(5, -58); g.quadraticCurveTo(20, -84, 12, -96); g.stroke();
  },
  sat_rubidus(g, o) {
    // the Oxidized King: a crowned engine of red dust and grievance
    g.fillStyle = o.base; g.strokeStyle = INK; g.lineWidth = 7;
    g.beginPath(); g.roundRect(-52, -44, 104, 108, 8); g.fill(); g.stroke();
    // engine grille
    g.strokeStyle = DARK; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-36, -8 + i * 14); g.lineTo(36, -8 + i * 14); g.stroke(); }
    // pistons for arms
    for (const s of [-1, 1]) {
      g.fillStyle = DARK;
      g.beginPath(); g.roundRect(s * 52, -30, s * 26, 18, 4); g.fill();
      g.strokeStyle = o.accent; g.lineWidth = 3;
      g.beginPath(); g.moveTo(s * 60, -21); g.lineTo(s * 84, -21); g.stroke();
    }
    // the crown, oversized and rusted
    g.fillStyle = o.accent; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-44, -44);
    for (let i = 0; i <= 5; i++) g.lineTo(-44 + i * 17.6, i % 2 ? -92 : -58);
    g.lineTo(44, -44);
    g.closePath(); g.fill(); g.stroke();
    glowEye(g, -18, -22, 7, o.eye); glowEye(g, 18, -22, 7, o.eye);
    // grievance exhaust
    g.fillStyle = o.accent; g.globalAlpha = 0.5;
    for (const [x, y, r] of [[-62, -58, 8], [-72, -74, 6], [-80, -88, 4]]) {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  },
  sat_viridian(g, o) {
    // the Rootmother: a hunting garden
    // root skirt
    g.strokeStyle = '#3f8a5a'; g.lineWidth = 8; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = -44 + i * 22;
      g.beginPath(); g.moveTo(x, 30); g.bezierCurveTo(x - 10, 56, x + 14, 70, x + 4, 92); g.stroke();
    }
    body(g, o, () => blobPath(g, 56, 48, 0.12, o.seed));
    // her bloom-crown of patient flowers
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + (i / 4) * Math.PI;
      const x = Math.cos(a) * 52, y = -30 + Math.sin(a) * 40;
      g.fillStyle = ['#ff9ad4', '#ffd98a', '#8affc4'][i % 3];
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2;
        g.beginPath(); g.ellipse(x + Math.cos(pa) * 7, y + Math.sin(pa) * 7, 5, 5, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = DARK;
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    // her quiet face
    glowEye(g, -14, -12, 6, o.eye); glowEye(g, 14, -12, 6, o.eye);
    g.strokeStyle = DARK; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 8, 12, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    // one reaching hunter-vine
    g.strokeStyle = '#3f8a5a'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(50, -20); g.bezierCurveTo(90, -40, 96, -70, 78, -92); g.stroke();
    g.fillStyle = '#d94f6e';
    g.beginPath(); g.ellipse(76, -96, 10, 6, -0.6, 0, Math.PI * 2); g.fill();
  },
  deity(g, o) {
    // Vhal-Suthek: the Wound made flesh — a torn opening ringed with eyes
    // the tear itself
    g.fillStyle = '#0a0512';
    g.strokeStyle = o.accent; g.lineWidth = 5;
    g.shadowColor = o.accent; g.shadowBlur = 18;
    g.beginPath();
    g.moveTo(0, -96);
    g.bezierCurveTo(34, -60, 30, -10, 12, 40);
    g.bezierCurveTo(6, 66, -6, 66, -12, 40);
    g.bezierCurveTo(-30, -10, -34, -60, 0, -96);
    g.closePath(); g.fill(); g.stroke();
    g.shadowBlur = 0;
    // the ring of watching eyes
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + o.seed;
      const x = Math.cos(a) * 82, y = -14 + Math.sin(a) * 66;
      glowEye(g, x, y, i % 3 === 0 ? 7 : 4.5, o.eye);
    }
    // tendrils reaching from the tear
    g.strokeStyle = o.base; g.lineWidth = 6; g.lineCap = 'round';
    for (const [ex, ey] of [[-84, 40], [-64, 84], [70, 68], [88, 22]]) {
      g.beginPath();
      g.moveTo(0, 20);
      g.bezierCurveTo(ex * 0.3, ey * 0.2, ex * 0.7, ey * 1.1, ex, ey);
      g.stroke();
    }
    // the inverted star at its heart
    g.fillStyle = o.eye; g.shadowColor = o.eye; g.shadowBlur = 20;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 === 0 ? 18 : 7;
      g.lineTo(Math.cos(a) * rr, -22 + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    g.shadowBlur = 0;
    // whisper-runes falling out of it
    runeOrbit(g, ['ᛉ', 'ᛟ', 'ᚦ', 'ᛞ'], o.accent, 100, o.seed);
  },
};

export function paintSpecies(g, slug, o) {
  const painter = SPECIES[slug];
  if (!painter) return false;
  painter(g, o);
  return true;
}

export function paintBoss(g, kind, o) {
  const painter = BOSSES[kind];
  if (!painter) return false;
  painter(g, o);
  return true;
}
