// All art in Vaeldrift is painted at runtime onto canvases — no image assets.

import * as THREE from 'three';
import { paintSpecies, paintBoss } from './monsters.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const RUNE_CHARS = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

// ------------------------------------------------------------ soft sprites ---

export function makeGlowTexture(color = '#ffffff') {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color + 'aa');
  grad.addColorStop(1, '#00000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

export function makeStarTexture() {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, '#cfd8ff');
  grad.addColorStop(1, '#00000000');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#ffffffcc';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 58); g.moveTo(6, 32); g.lineTo(58, 32); g.stroke();
  return toTexture(c);
}

export function makeMistTexture() {
  const [c, g] = canvas(256, 256);
  // a dense haze core so the shroud actually shrouds…
  const base = g.createRadialGradient(128, 128, 10, 128, 128, 120);
  base.addColorStop(0, 'rgba(190,200,255,0.55)');
  base.addColorStop(0.7, 'rgba(190,200,255,0.4)');
  base.addColorStop(1, 'rgba(190,200,255,0)');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  // …plus wispy billows for texture
  for (let i = 0; i < 46; i++) {
    const x = 30 + Math.random() * 196, y = 30 + Math.random() * 196;
    const r = 22 + Math.random() * 46;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.1 + Math.random() * 0.14;
    grad.addColorStop(0, `rgba(190,200,255,${a})`);
    grad.addColorStop(1, 'rgba(190,200,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  // fade the square's edges so instanced caps never show seams
  const edge = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = edge;
  g.fillRect(0, 0, 256, 256);
  return toTexture(c);
}

// -------------------------------------------------------------- base plane ---

export function makeNebulaTexture() {
  const [c, g] = canvas(1024, 1024);
  const grad = g.createRadialGradient(512, 512, 40, 512, 512, 520);
  grad.addColorStop(0, '#232a5e');
  grad.addColorStop(0.4, '#141a42');
  grad.addColorStop(0.75, '#0a0d26');
  grad.addColorStop(1, '#05060f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);

  // nebula wisps
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = 80 + Math.random() * 420;
    const x = 512 + Math.cos(a) * rr, y = 512 + Math.sin(a) * rr;
    const r = 30 + Math.random() * 110;
    const wisp = g.createRadialGradient(x, y, 0, x, y, r);
    const hue = Math.random() < 0.5 ? '120,90,220' : '70,110,200';
    wisp.addColorStop(0, `rgba(${hue},${0.05 + Math.random() * 0.08})`);
    wisp.addColorStop(1, `rgba(${hue},0)`);
    g.fillStyle = wisp;
    g.fillRect(0, 0, 1024, 1024);
  }
  // stars
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 1024, y = Math.random() * 1024;
    const r = Math.random() * 1.4 + 0.2;
    g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.7})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return toTexture(c);
}

export function makeRuneRingTexture(count = 40, color = '#8f9bff') {
  const [c, g] = canvas(1024, 1024);
  g.translate(512, 512);
  g.strokeStyle = color + '55';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 470, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 396, 0, Math.PI * 2); g.stroke();
  g.fillStyle = color;
  g.font = '54px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.translate(0, -433);
    g.fillText(RUNE_CHARS[(i * 7) % RUNE_CHARS.length], 0, 0);
    g.restore();
  }
  // tick marks between glyphs
  g.strokeStyle = color + '88';
  g.lineWidth = 2;
  for (let i = 0; i < count * 2; i++) {
    const a = ((i + 0.5) / (count * 2)) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.beginPath(); g.moveTo(0, -396); g.lineTo(0, -406); g.stroke();
    g.restore();
  }
  return toTexture(c);
}

// ------------------------------------------------------------ paper actors ---

// The wanderer's look grows with the hoard, Isaac-style: carried tags leave
// small marks, a completed set transforms cloak and eyes, and grand
// synergies rewrite the silhouette outright.

const SET_LOOK = {
  ember: { cloak: '#5c2a30', eye: '#ff8a45', trim: '#ff9a5a' },
  bloom: { cloak: '#2b5940', eye: '#7dffb8', trim: '#8affc4' },
  glass: { cloak: '#4a3a70', eye: '#d79bff', trim: '#d79bff' },
  moon:  { cloak: '#3a4468', eye: '#bcd8ff', trim: '#cfe0ff' },
  sun:   { cloak: '#6e5424', eye: '#ffd24a', trim: '#f5b942' },
  water: { cloak: '#28407a', eye: '#6f9bff', trim: '#8ab4ff' },
  card:  { cloak: '#5c2440', eye: '#ff7ab0', trim: '#d94f8e' },
};

export function makePlayerTexture(appearance = null) {
  const [c, g] = canvas(256, 320);
  g.translate(128, 160);
  const ap = appearance || { tagCounts: {}, completeSets: [], grand: [], itemCount: 0 };
  const n = tag => ap.tagCounts[tag] || 0;
  const done = tag => ap.completeSets.includes(tag);
  const grand = id => ap.grand.includes(id);

  // cosmic mutations override everything: the body remembers the Wound
  const muts = ap.mutations || [];
  const mut = id => muts.includes(id);
  const eldritch = muts.length >= 3;

  // colors: the first (up to two) complete sets claim cloak and eyes —
  // unless mutation has already claimed the flesh
  const looks = ap.completeSets.map(t => SET_LOOK[t]).filter(Boolean);
  const cloakC = eldritch ? '#150b26' : muts.length ? '#2a1633' : (looks[0]?.cloak || '#2c2f63');
  const trimC = eldritch ? '#a6ff57' : (looks[0]?.trim || '#f0c46a');
  const eyeC = eldritch ? '#a6ff57' : (looks[1]?.eye || looks[0]?.eye || '#5a4ee0');

  // torn vellum wings unfurl behind the cloak
  if (mut('tatter_wings')) {
    g.fillStyle = eldritch ? '#241238' : '#332046';
    g.strokeStyle = '#171938'; g.lineWidth = 4;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 40, -40);
      g.bezierCurveTo(s * 110, -110, s * 128, -30, s * 92, 10);
      g.lineTo(s * 104, 30); g.lineTo(s * 78, 26); g.lineTo(s * 84, 52); g.lineTo(s * 56, 34);
      g.closePath(); g.fill(); g.stroke();
    }
  }

  // cloak — a tall teardrop silhouette
  const cloakPath = () => {
    g.beginPath();
    g.moveTo(0, -118);
    g.bezierCurveTo(64, -104, 78, -10, 62, 118);
    g.bezierCurveTo(30, 132, -30, 132, -62, 118);
    g.bezierCurveTo(-78, -10, -64, -104, 0, -118);
    g.closePath();
  };
  g.fillStyle = cloakC;
  g.strokeStyle = '#171938';
  g.lineWidth = 7;
  cloakPath();
  g.fill(); g.stroke();

  // grand: STAINED GLASS panels the whole cloak in leaded facets
  if (grand('stained_glass')) {
    g.save();
    cloakPath(); g.clip();
    const panes = ['#b04a6e', '#4a5ab0', '#b0894a', '#4a9a70', '#7a4ab0'];
    for (let i = 0; i < 12; i++) {
      const px = -60 + (i % 4) * 40, py = -90 + Math.floor(i / 4) * 70;
      g.fillStyle = panes[i % panes.length] + '55';
      g.beginPath();
      g.moveTo(px, py); g.lineTo(px + 44, py + 12); g.lineTo(px + 30, py + 66); g.lineTo(px - 8, py + 50);
      g.closePath(); g.fill();
      g.strokeStyle = '#171938'; g.lineWidth = 3; g.stroke();
    }
    g.restore();
  }
  // grand: FULGURITE veins the cloak with fossilized lightning
  if (grand('fulgurite')) {
    g.save();
    cloakPath(); g.clip();
    g.strokeStyle = '#ffd9a0';
    g.shadowColor = '#ff8a45'; g.shadowBlur = 10;
    g.lineWidth = 3;
    for (const x0 of [-34, 6, 40]) {
      g.beginPath();
      let x = x0, y = -100;
      g.moveTo(x, y);
      while (y < 110) { x += (Math.sin(y * 0.21 + x0) > 0 ? 1 : -1) * (7 + (y % 13)); y += 24; g.lineTo(x, y); }
      g.stroke();
    }
    g.restore();
    g.shadowBlur = 0;
  }
  // grand: VERDANCE grows a climbing garden up the hem
  if (grand('verdance')) {
    g.save();
    cloakPath(); g.clip();
    g.strokeStyle = '#3f8a5a'; g.lineWidth = 4;
    for (const x0 of [-44, -8, 30]) {
      g.beginPath(); g.moveTo(x0, 122);
      g.bezierCurveTo(x0 - 14, 70, x0 + 18, 40, x0 + 2, -8);
      g.stroke();
      g.fillStyle = '#8affc4';
      for (let i = 0; i < 3; i++) {
        const t = 0.3 + i * 0.3;
        g.beginPath(); g.arc(x0 + Math.sin(t * 6 + x0) * 12, 122 - t * 120, 5, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }

  // trim
  g.strokeStyle = trimC;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-56, 104); g.quadraticCurveTo(0, 122, 56, 104);
  g.stroke();

  // small tag marks along the hem, before sets complete
  if (n('ember') && !done('ember')) {
    g.fillStyle = '#ff8a45';
    g.shadowColor = '#ff8a45'; g.shadowBlur = 8;
    for (let i = 0; i < Math.min(n('ember'), 2) + 1; i++) {
      g.beginPath(); g.arc(-30 + i * 26, 108, 4, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
  }
  if (n('water') && !done('water')) {
    g.strokeStyle = '#6f9bff'; g.lineWidth = 3;
    g.beginPath();
    for (let x = -48; x <= 48; x += 6) {
      const y = 96 + Math.sin(x * 0.35) * 4;
      x === -48 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }

  // hood interior + face
  g.fillStyle = '#101128';
  g.beginPath(); g.ellipse(0, -66, 44, 50, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e4f5';
  g.beginPath(); g.ellipse(0, -60, 34, 40, 0, 0, Math.PI * 2); g.fill();

  // halos & crowns for completed sets (drawn behind the hood edge)
  const haloY = -118;
  if (done('sun') || grand('eclipse')) {
    g.strokeStyle = '#f5b942';
    g.shadowColor = '#f5b942'; g.shadowBlur = 10;
    g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      g.beginPath();
      g.moveTo(Math.cos(a) * 52, haloY + 26 + Math.sin(a) * 40);
      g.lineTo(Math.cos(a) * 68, haloY + 26 + Math.sin(a) * 54);
      g.stroke();
    }
    g.shadowBlur = 0;
  }
  if (done('moon') || grand('eclipse')) {
    g.strokeStyle = '#cfe0ff';
    g.shadowColor = '#bcd8ff'; g.shadowBlur = 12;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(grand('eclipse') ? 24 : 0, haloY + 4, 26, -0.4, Math.PI + 0.4);
    g.stroke();
    g.shadowBlur = 0;
  }
  if (done('ember')) {
    g.fillStyle = '#ff8a45';
    g.shadowColor = '#ff5a2a'; g.shadowBlur = 12;
    for (let i = 0; i < 5; i++) {
      const x = -28 + i * 14;
      g.beginPath();
      g.moveTo(x, haloY + 14);
      g.quadraticCurveTo(x + 5, haloY - 4 - (i % 2) * 8, x + 2, haloY - 14 - (i % 3) * 6);
      g.quadraticCurveTo(x + 9, haloY + 2, x + 12, haloY + 14);
      g.closePath(); g.fill();
    }
    g.shadowBlur = 0;
  }
  if (done('bloom')) {
    for (let i = 0; i < 5; i++) {
      const x = -30 + i * 15, y = haloY + 10 - (i % 2) * 6;
      g.fillStyle = ['#ff9ad4', '#8affc4', '#ffd98a'][i % 3];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.beginPath(); g.ellipse(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.4, 3.4, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#5c3a20';
      g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
    }
  }
  if (done('glass')) {
    g.fillStyle = '#d79bff';
    g.shadowColor = '#b48aff'; g.shadowBlur = 10;
    for (let i = 0; i < 5; i++) {
      const x = -28 + i * 14, h = 12 + (i % 3) * 7;
      g.beginPath();
      g.moveTo(x - 5, haloY + 14); g.lineTo(x, haloY + 14 - h); g.lineTo(x + 5, haloY + 14);
      g.closePath(); g.fill();
    }
    g.shadowBlur = 0;
  }
  if (done('water')) {
    g.fillStyle = '#8ab4ff';
    g.shadowColor = '#6f9bff'; g.shadowBlur = 8;
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * (0.25 + i * 0.25);
      const x = Math.cos(a) * 56, y = haloY + 30 - Math.sin(a) * 34;
      g.beginPath();
      g.moveTo(x, y - 7);
      g.quadraticCurveTo(x + 6, y + 2, x, y + 6);
      g.quadraticCurveTo(x - 6, y + 2, x, y - 7);
      g.fill();
    }
    g.shadowBlur = 0;
  }
  if (done('card')) {
    for (let i = -1; i <= 1; i++) {
      g.save();
      g.translate(i * 22, haloY + (i === 0 ? -8 : 2));
      g.rotate(i * 0.35);
      g.fillStyle = '#efe6ff';
      g.strokeStyle = '#d94f8e'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(-8, -12, 16, 24, 3); g.fill(); g.stroke();
      g.fillStyle = '#d94f8e';
      g.font = 'bold 12px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['☾', '✶', '♄'][i + 1], 0, 0);
      g.restore();
    }
  }

  // grand: THE PALE HAND — a spectral hound at your shoulder
  if (grand('pale_hand')) {
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#cfe0ff';
    g.shadowColor = '#bcd8ff'; g.shadowBlur = 14;
    g.translate(-84, -30);
    g.beginPath();               // a lean sitting hound, all one stroke of mist
    g.moveTo(0, 40);
    g.bezierCurveTo(-16, 30, -14, -6, 2, -18);   // back
    g.lineTo(-2, -34);                            // ear
    g.lineTo(8, -22);
    g.bezierCurveTo(22, -20, 26, -8, 18, 2);      // muzzle & chest
    g.bezierCurveTo(24, 18, 16, 36, 8, 40);
    g.closePath(); g.fill();
    g.restore();
    g.shadowBlur = 0;
  }
  // grand: STEAMVEIL — coils of steam wreathe the shoulders
  if (grand('steamveil')) {
    g.save();
    g.globalAlpha = 0.4;
    g.strokeStyle = '#dfe8ff';
    g.lineWidth = 6; g.lineCap = 'round';
    for (const [sx, dir] of [[-62, 1], [62, -1]]) {
      g.beginPath();
      g.moveTo(sx, 40);
      g.bezierCurveTo(sx + 18 * dir, 6, sx - 14 * dir, -30, sx + 10 * dir, -66);
      g.stroke();
    }
    g.restore();
  }

  // eyes — stars normally; grand eclipse splits them sun/moon
  const eyeColors = grand('eclipse') ? ['#f5b942', '#bcd8ff']
    : grand('fulgurite') ? ['#ff8a45', '#d79bff'] : [eyeC, eyeC];
  [-14, 14].forEach((sx, i) => {
    g.fillStyle = eyeColors[i];
    if (ap.completeSets.length || ap.grand.length) { g.shadowColor = eyeColors[i]; g.shadowBlur = 9; }
    g.save();
    g.translate(sx, -60);
    g.beginPath();
    for (let p = 0; p < 8; p++) {
      const a = (p / 8) * Math.PI * 2;
      const rr = p % 2 === 0 ? 8 : 3.2;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    g.restore();
    g.shadowBlur = 0;
  });
  // gentle smile
  g.strokeStyle = '#8a84b8';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, -42, 10, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();

  // small chest pins for tags still gathering toward their set
  const pins = [];
  if (n('moon') && !done('moon')) pins.push(['☾', '#bcd8ff']);
  if (n('sun') && !done('sun')) pins.push(['☀', '#f5b942']);
  if (n('card') && !done('card')) pins.push(['♠', '#ff7ab0']);
  if (n('glass') && !done('glass')) pins.push(['◆', '#d79bff']);
  if (n('bloom') && !done('bloom')) pins.push(['❀', '#8affc4']);
  pins.slice(0, 3).forEach(([ch, col], i) => {
    g.fillStyle = col;
    g.font = 'bold 17px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, -26 + i * 26, -4);
  });

  // chest rune
  g.fillStyle = trimC;
  g.font = 'bold 40px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ᛟ', 0, 26);
  g.shadowColor = trimC; g.shadowBlur = 16;
  g.fillText('ᛟ', 0, 26);
  g.shadowBlur = 0;

  // a cord of trinkets — one bead per relic carried (capped)
  const beads = Math.min(ap.itemCount, 8);
  if (beads) {
    g.strokeStyle = '#8a7a58'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-46, 52); g.quadraticCurveTo(0, 66, 46, 52); g.stroke();
    for (let i = 0; i < beads; i++) {
      const t = (i + 0.5) / beads;
      const x = -46 + t * 92;
      const y = 52 + Math.sin(t * Math.PI) * 12;
      g.fillStyle = ['#f0c46a', '#9fe8ff', '#d79bff', '#8affc4'][i % 4];
      g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
    }
  }

  // staff with floating shard
  g.strokeStyle = '#6b5537';
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(76, 118); g.lineTo(92, -70); g.stroke();
  const shardC = eldritch ? '#a6ff57' : (looks[0]?.eye || '#9fe8ff');
  g.fillStyle = shardC;
  g.shadowColor = shardC; g.shadowBlur = 18;
  g.save();
  g.translate(93, -96);
  g.rotate(0.3);
  g.beginPath();
  g.moveTo(0, -20); g.lineTo(11, 0); g.lineTo(0, 20); g.lineTo(-11, 0);
  g.closePath(); g.fill();
  g.restore();
  g.shadowBlur = 0;

  // ---- cosmic mutations, drawn over everything the person used to be ----
  if (mut('maw_beneath')) {
    // the gentle face opens on something else
    g.fillStyle = '#1a0b20';
    g.beginPath(); g.ellipse(0, -52, 30, 34, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#efe6d5';
    for (let i = 0; i < 5; i++) {
      const x = -20 + i * 10;
      g.beginPath(); g.moveTo(x - 4, -70); g.lineTo(x, -52); g.lineTo(x + 4, -70); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x - 3, -32); g.lineTo(x, -46); g.lineTo(x + 3, -32); g.closePath(); g.fill();
    }
    glowDot(g, -12, -78, 4, '#ff4a6a'); glowDot(g, 12, -78, 4, '#ff4a6a');
  }
  if (mut('thousand_eyes')) {
    for (const [x, y, r] of [[-22, -80, 4], [0, -88, 5], [20, -78, 4], [-30, -58, 3.4], [30, -56, 3.4], [-8, -36, 3], [12, -34, 3]]) {
      glowDot(g, x, y, r, eldritch ? '#a6ff57' : '#ffd24a');
    }
  }
  if (mut('antler_deep')) {
    g.strokeStyle = '#241833'; g.lineWidth = 6; g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 18, -112);
      g.bezierCurveTo(s * 30, -134, s * 18, -144, s * 44, -156);
      g.stroke();
      g.beginPath(); g.moveTo(s * 24, -126); g.lineTo(s * 44, -134); g.stroke();
      g.beginPath(); g.moveTo(s * 30, -142); g.lineTo(s * 16, -150); g.stroke();
    }
  }
  if (mut('tide_gills')) {
    g.strokeStyle = '#57e0d4'; g.lineWidth = 3.5;
    g.shadowColor = '#57e0d4'; g.shadowBlur = 6;
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(s * (22 + i * 4), -70 + i * 10);
      g.quadraticCurveTo(s * (30 + i * 4), -66 + i * 10, s * (24 + i * 4), -58 + i * 10);
      g.stroke();
    }
    g.shadowBlur = 0;
    g.fillStyle = '#2a7a80';
    g.beginPath(); g.moveTo(-6, -116); g.lineTo(0, -142); g.lineTo(8, -114); g.closePath(); g.fill();
  }
  if (mut('starving_halo')) {
    g.strokeStyle = '#0c0614'; g.lineWidth = 7;
    g.beginPath(); g.arc(0, -136, 22, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#0c0614';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = Math.cos(a) * 22, y = -136 + Math.sin(a) * 22;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - Math.cos(a) * 9 - 3, y - Math.sin(a) * 9);
      g.lineTo(x - Math.cos(a) * 9 + 3, y - Math.sin(a) * 9);
      g.closePath(); g.fill();
    }
  }
  if (mut('hollow_chest')) {
    g.fillStyle = '#05030c';
    g.beginPath(); g.ellipse(0, 26, 22, 26, 0, 0, Math.PI * 2); g.fill();
    glowDot(g, 0, 26, 5, '#9fe8ff');
  }
  if (mut('voice_wound')) {
    g.fillStyle = '#a6ff57'; g.globalAlpha = 0.85;
    g.font = 'bold 15px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [x, y] of [[-34, 60], [-10, 78], [22, 64], [40, 84], [-42, 88]]) g.fillText('ᛗ', x, y);
    g.globalAlpha = 1;
  }
  if (eldritch) {
    // the full shape: tendrils where the hem used to end, and an aura
    g.strokeStyle = '#150b26'; g.lineWidth = 8; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = -48 + i * 24;
      g.beginPath();
      g.moveTo(x, 108);
      g.bezierCurveTo(x - 10, 128, x + 14, 138, x + (i % 2 ? -6 : 8), 154);
      g.stroke();
    }
    g.strokeStyle = '#a6ff5744'; g.lineWidth = 10;
    g.beginPath();
    g.moveTo(0, -122);
    g.bezierCurveTo(68, -108, 82, -10, 66, 122);
    g.moveTo(0, -122);
    g.bezierCurveTo(-68, -108, -82, -10, -66, 122);
    g.stroke();
  }

  return toTexture(c);
}

function glowDot(g, x, y, r, color) {
  g.fillStyle = color;
  g.shadowColor = color; g.shadowBlur = 10;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
}

export function makeTraderTexture() {
  const [c, g] = canvas(256, 224);
  g.translate(128, 112);
  // wheels
  g.fillStyle = '#3a2c18';
  for (const wx of [-52, 44]) {
    g.beginPath(); g.arc(wx, 74, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f0c46a';
    g.beginPath(); g.arc(wx, 74, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2c18';
  }
  // cart body
  g.fillStyle = '#6b4f2a';
  g.strokeStyle = '#33260f';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(-84, 8, 168, 58, 8);
  g.fill(); g.stroke();
  // canopy
  g.fillStyle = '#8e4fd9';
  g.beginPath();
  g.moveTo(-88, 12); g.quadraticCurveTo(0, -86, 88, 12);
  g.closePath(); g.fill();
  g.strokeStyle = '#f0c46a';
  g.lineWidth = 4;
  g.stroke();
  // hanging lantern
  g.fillStyle = '#ffd98a';
  g.shadowColor = '#ffd98a'; g.shadowBlur = 14;
  g.beginPath(); g.arc(96, 4, 10, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  // rune on canopy
  g.fillStyle = '#ffe9c9';
  g.font = 'bold 34px serif';
  g.textAlign = 'center';
  g.fillText('ᚠ', 0, -8);
  return toTexture(c);
}

// Every named species gets hand-authored art from the bestiary
// (monsters.js); bosses get one-off portraits. The parametric role bodies
// below remain as the fallback for anything unnamed.
export function makeEnemyTexture({ base, eye, role = 'brute', seed = 0.5, boss = false, accent = null, species = null, bossKind = null }) {
  const [c, g] = canvas(224, 224);
  g.translate(112, 124);
  const ink = 'rgba(0,0,0,0.45)';
  const dark = 'rgba(0,0,0,0.55)';
  const acc = accent || eye;

  const opts = { base, eye, accent: acc, seed, boss };
  if (bossKind && paintBoss(g, bossKind, opts)) return toTexture(c);
  if (species && paintSpecies(g, species, opts)) {
    if (boss) {   // a species standing in as a boss still earns a crown
      g.fillStyle = '#ff5a7a';
      g.shadowColor = '#ff5a7a'; g.shadowBlur = 12;
      g.beginPath();
      g.moveTo(-30, -88);
      for (let i = 0; i <= 4; i++) g.lineTo(-30 + i * 15, -88 - (i % 2 ? 22 : 6));
      g.lineTo(30, -80); g.lineTo(-30, -80);
      g.closePath(); g.fill();
      g.shadowBlur = 0;
    }
    return toTexture(c);
  }

  const blob = (rx, ry, wobble) => {
    g.beginPath();
    const lobes = 9;
    for (let i = 0; i <= lobes; i++) {
      const a = (i / lobes) * Math.PI * 2;
      const w = 1 + Math.sin(a * 3 + seed * 9) * wobble;
      const x = Math.cos(a) * rx * w, y = Math.sin(a) * ry * w;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
  };
  const horn = (a, len, w) => {
    g.save(); g.rotate(a);
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(-w, -46); g.lineTo(0, -46 - len); g.lineTo(w, -46);
    g.closePath(); g.fill();
    g.restore();
  };
  const glowEye = (x, y, r, slit = false) => {
    g.fillStyle = eye;
    g.shadowColor = eye; g.shadowBlur = 12;
    g.beginPath();
    if (slit) g.ellipse(x, y, r * 1.5, r * 0.55, -0.35, 0, Math.PI * 2);
    else g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  };

  if (role === 'swift') {
    // lean, storm-swept: a narrow body raked to one side, fins trailing
    g.save();
    g.rotate(-0.12);
    g.fillStyle = base; g.strokeStyle = ink; g.lineWidth = 6;
    blob(40, 74, 0.14);
    g.fill(); g.stroke();
    // swept fins
    g.fillStyle = dark;
    for (let i = 0; i < 3; i++) {
      const y = -40 + i * 32;
      g.beginPath();
      g.moveTo(26, y); g.lineTo(66 + i * 8, y + 10 + seed * 10); g.lineTo(26, y + 20);
      g.closePath(); g.fill();
    }
    // a speed stripe
    g.strokeStyle = acc; g.lineWidth = 5;
    g.globalAlpha = 0.7;
    g.beginPath(); g.moveTo(-20, -62); g.quadraticCurveTo(-38, 0, -16, 62); g.stroke();
    g.globalAlpha = 1;
    horn(-0.35, 28, 7);
    glowEye(-6, -30, 7, true);
    glowEye(14, -24, 6, true);
    g.restore();
  } else if (role === 'mystic') {
    // a robed cone under a hood, runes orbiting
    g.fillStyle = base; g.strokeStyle = ink; g.lineWidth = 6;
    g.beginPath();
    g.moveTo(0, -84);
    g.bezierCurveTo(40, -70, 56, 10, 46 + seed * 10, 74);
    g.quadraticCurveTo(0, 90, -46 - seed * 10, 74);
    g.bezierCurveTo(-56, 10, -40, -70, 0, -84);
    g.closePath(); g.fill(); g.stroke();
    // hood shadow
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(0, -46, 26, 22, 0, 0, Math.PI * 2); g.fill();
    // one great eye (or a column of three small)
    if (seed < 0.5) glowEye(0, -46, 10);
    else for (let i = 0; i < 3; i++) glowEye(0, -58 + i * 13, 4);
    // chest sigil
    g.fillStyle = acc;
    g.shadowColor = acc; g.shadowBlur = 10;
    g.font = 'bold 30px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(RUNE_CHARS[Math.floor(seed * RUNE_CHARS.length)], 0, 16);
    g.shadowBlur = 0;
    // orbiting runes
    g.fillStyle = acc; g.globalAlpha = 0.8;
    g.font = '20px serif';
    for (let i = 0; i < 3; i++) {
      const a = seed * 6 + i * 2.1;
      g.fillText(RUNE_CHARS[(i * 5 + Math.floor(seed * 7)) % RUNE_CHARS.length],
        Math.cos(a) * 76, -10 + Math.sin(a) * 52);
    }
    g.globalAlpha = 1;
  } else if (role === 'guard') {
    // an armored shell: hex plates, rivets, one visor slit
    g.fillStyle = base; g.strokeStyle = ink; g.lineWidth = 7;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      const r = 66 + (i % 2) * 6;
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.95;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath(); g.fill(); g.stroke();
    // plate seams
    g.strokeStyle = dark; g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-60, -14); g.lineTo(60, -14);
    g.moveTo(-52, 26); g.lineTo(52, 26);
    g.moveTo(0, -70); g.lineTo(0, -14);
    g.stroke();
    // rivets
    g.fillStyle = dark;
    for (const [rx, ry] of [[-46, -30], [46, -30], [-38, 44], [38, 44], [0, 60]]) {
      g.beginPath(); g.arc(rx, ry, 4, 0, Math.PI * 2); g.fill();
    }
    // visor slit
    g.fillStyle = eye;
    g.shadowColor = eye; g.shadowBlur = 14;
    g.beginPath(); g.roundRect(-30, -46, 60, 9, 4); g.fill();
    g.shadowBlur = 0;
    horn(-0.5, 18, 8); horn(0.5, 18, 8);
  } else {
    // brute: broad and heavy, underslung jaw, tusks, old scars
    g.fillStyle = base; g.strokeStyle = ink; g.lineWidth = 6;
    blob(76, 62, 0.16);
    g.fill(); g.stroke();
    // jaw
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(-52, 18); g.quadraticCurveTo(0, 46 + seed * 14, 52, 18);
    g.quadraticCurveTo(0, 64, -52, 18);
    g.closePath(); g.fill();
    // tusks
    g.fillStyle = '#efe6d5';
    for (const dx of [-34, 34]) {
      g.beginPath();
      g.moveTo(dx - 7, 26); g.lineTo(dx + (dx < 0 ? -6 : 6), -2 - seed * 8); g.lineTo(dx + 7, 26);
      g.closePath(); g.fill();
    }
    const horns = 1 + Math.floor(seed * 3);
    for (let i = 0; i < horns; i++) horn(-0.55 + i * (1.1 / Math.max(1, horns - 1) || 0), 34, 9);
    // scars
    g.strokeStyle = dark; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-58 + seed * 20, -34); g.lineTo(-42 + seed * 20, -14);
    g.moveTo(30, 4); g.lineTo(46, 20);
    g.stroke();
    glowEye(-18, -22, 6);
    glowEye(18, -22, 6);
  }

  // speckles common to all — every beast is individually weathered
  g.fillStyle = dark;
  for (let i = 0; i < 6; i++) {
    const a = seed * 31 + i * 2.4;
    g.beginPath();
    g.arc(Math.cos(a) * (30 + (i % 3) * 12), Math.sin(a) * 30 + 8, 2.5, 0, Math.PI * 2);
    g.fill();
  }

  // boss regalia: a jagged crown and an aura
  if (boss) {
    g.fillStyle = '#ff5a7a';
    g.shadowColor = '#ff5a7a'; g.shadowBlur = 12;
    g.beginPath();
    g.moveTo(-30, -78);
    for (let i = 0; i <= 4; i++) g.lineTo(-30 + i * 15, -78 - (i % 2 ? 22 : 6));
    g.lineTo(30, -70); g.lineTo(-30, -70);
    g.closePath(); g.fill();
    g.shadowBlur = 0;
  }
  return toTexture(c);
}

export function makeMysteryTexture() {
  const [c, g] = canvas(128, 128);
  g.translate(64, 64);
  g.strokeStyle = '#c9b3ff';
  g.lineWidth = 3;
  g.setLineDash([6, 5]);
  g.beginPath(); g.arc(0, 0, 48, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#e0d1ff';
  g.shadowColor = '#b48aff'; g.shadowBlur = 16;
  g.font = 'bold 64px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', 0, 4);
  g.shadowBlur = 0;
  return toTexture(c);
}

// ------------------------------------------------------------- text labels ---

export function makeLabelTexture(text, { color = '#ffffff', sub = null } = {}) {
  const font = '600 34px "Iowan Old Style", Palatino, Georgia, serif';
  const subFont = 'italic 22px Georgia, serif';
  const [m, mg] = canvas(4, 4);
  mg.font = font;
  const w = Math.ceil(mg.measureText(text).width);
  mg.font = subFont;
  const sw = sub ? Math.ceil(mg.measureText(sub).width) : 0;
  const W = Math.max(w, sw) + 44, H = sub ? 96 : 64;
  const [c, g] = canvas(W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 8;
  g.font = font;
  g.fillStyle = color;
  g.fillText(text, W / 2, sub ? 26 : H / 2);
  if (sub) {
    g.font = subFont;
    g.fillStyle = 'rgba(215,220,255,0.85)';
    g.fillText(sub, W / 2, 66);
  }
  const tex = toTexture(c);
  tex.userData = { w: W, h: H };
  return tex;
}
