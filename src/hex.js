// Axial-coordinate hex math for a pointy-top layout.

export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export const keyOf = (q, r) => q + ',' + r;

export function axialToWorld(q, r, size) {
  return { x: size * Math.sqrt(3) * (q + r / 2), z: size * 1.5 * r };
}

export function worldToAxial(x, z, size) {
  const q = (Math.sqrt(3) / 3 * x - z / 3) / size;
  const r = (2 / 3 * z) / size;
  return axialRound(q, r);
}

export function axialRound(qf, rf) {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

export function hexDist(aq, ar, bq, br) {
  return (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(aq + ar - bq - br)) / 2;
}

// All axial coords within radius R of origin (a hexagonal disc).
export function discCoords(R) {
  const out = [];
  for (let q = -R; q <= R; q++) {
    const rMin = Math.max(-R, -q - R), rMax = Math.min(R, -q + R);
    for (let r = rMin; r <= rMax; r++) out.push([q, r]);
  }
  return out;
}

export function neighborsOf(q, r) {
  return DIRS.map(([dq, dr]) => [q + dq, r + dr]);
}

// A* over the tile map. `tiles` is a Map of key -> tile with tile.void flag.
// Returns array of tiles from start (exclusive) to goal (inclusive), or null.
export function findPath(tiles, start, goal) {
  if (start === goal) return [];
  const startKey = keyOf(start.q, start.r), goalKey = keyOf(goal.q, goal.r);
  const open = new MinHeap();
  const came = new Map(), gScore = new Map();
  gScore.set(startKey, 0);
  open.push(hexDist(start.q, start.r, goal.q, goal.r), startKey);

  while (open.size > 0) {
    const curKey = open.pop();
    if (curKey === goalKey) {
      const path = [];
      let k = goalKey;
      while (k !== startKey) { path.push(tiles.get(k)); k = came.get(k); }
      return path.reverse();
    }
    const cur = tiles.get(curKey);
    const g = gScore.get(curKey);
    for (const [nq, nr] of neighborsOf(cur.q, cur.r)) {
      const nKey = keyOf(nq, nr);
      const n = tiles.get(nKey);
      if (!n || n.void) continue;
      const ng = g + 1;
      if (ng < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, ng);
        came.set(nKey, curKey);
        open.push(ng + hexDist(nq, nr, goal.q, goal.r), nKey);
      }
    }
  }
  return null;
}

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(pri, val) {
    const a = this.a;
    a.push([pri, val]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0][1];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
