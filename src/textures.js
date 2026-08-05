// All art in Vaeldrift is painted at runtime onto canvases — no image assets.

import * as THREE from 'three';

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

export function makePlayerTexture() {
  const [c, g] = canvas(256, 320);
  g.translate(128, 160);

  // cloak — a tall teardrop silhouette
  g.fillStyle = '#2c2f63';
  g.strokeStyle = '#171938';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(0, -118);
  g.bezierCurveTo(64, -104, 78, -10, 62, 118);
  g.bezierCurveTo(30, 132, -30, 132, -62, 118);
  g.bezierCurveTo(-78, -10, -64, -104, 0, -118);
  g.closePath();
  g.fill(); g.stroke();

  // golden trim
  g.strokeStyle = '#f0c46a';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-56, 104); g.quadraticCurveTo(0, 122, 56, 104);
  g.stroke();

  // hood interior + face
  g.fillStyle = '#101128';
  g.beginPath(); g.ellipse(0, -66, 44, 50, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8e4f5';
  g.beginPath(); g.ellipse(0, -60, 34, 40, 0, 0, Math.PI * 2); g.fill();

  // star eyes
  g.fillStyle = '#5a4ee0';
  for (const sx of [-14, 14]) {
    g.save();
    g.translate(sx, -60);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? 8 : 3.2;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    g.restore();
  }
  // gentle smile
  g.strokeStyle = '#8a84b8';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, -42, 10, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();

  // chest rune
  g.fillStyle = '#f0c46a';
  g.font = 'bold 40px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ᛟ', 0, 26);
  g.shadowColor = '#f0c46a'; g.shadowBlur = 16;
  g.fillText('ᛟ', 0, 26);
  g.shadowBlur = 0;

  // staff with floating shard
  g.strokeStyle = '#6b5537';
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(76, 118); g.lineTo(92, -70); g.stroke();
  g.fillStyle = '#9fe8ff';
  g.shadowColor = '#9fe8ff'; g.shadowBlur = 18;
  g.save();
  g.translate(93, -96);
  g.rotate(0.3);
  g.beginPath();
  g.moveTo(0, -20); g.lineTo(11, 0); g.lineTo(0, 20); g.lineTo(-11, 0);
  g.closePath(); g.fill();
  g.restore();
  g.shadowBlur = 0;

  return toTexture(c);
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

// A parametric paper monster: blobby body, horns, glowing eyes.
export function makeEnemyTexture(baseColor, eyeColor, hornCount, seedRand) {
  const [c, g] = canvas(224, 224);
  g.translate(112, 124);
  g.fillStyle = baseColor;
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 6;
  g.beginPath();
  const lobes = 9;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = 62 + Math.sin(a * 3 + seedRand * 9) * 12 + seedRand * 8;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.92;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath(); g.fill(); g.stroke();
  // horns
  for (let i = 0; i < hornCount; i++) {
    const a = -Math.PI / 2 + (i - (hornCount - 1) / 2) * 0.55;
    g.save();
    g.rotate(a);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath();
    g.moveTo(-10, -52); g.lineTo(0, -96); g.lineTo(10, -52);
    g.closePath(); g.fill();
    g.restore();
  }
  // eyes
  const eyes = 1 + Math.floor(seedRand * 3);
  g.fillStyle = eyeColor;
  g.shadowColor = eyeColor; g.shadowBlur = 12;
  for (let i = 0; i < eyes; i++) {
    const x = (i - (eyes - 1) / 2) * 26;
    g.beginPath(); g.arc(x, -12, 8, 0, Math.PI * 2); g.fill();
  }
  g.shadowBlur = 0;
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
