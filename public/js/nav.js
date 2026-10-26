// Navigation helpers with no three.js dependency, so they can be unit tested in Node.
// blocked(): circle vs axis-aligned box collision. findPath(): A* on a 0.5-unit grid, then smoothed.
export const CELL = 0.5;

export function blocked(solids, x, z, r) {
  for (const s of solids) {
    if (x > s.minX - r && x < s.maxX + r && z > s.minZ - r && z < s.maxZ + r) return true;
  }
  return false;
}

// round: true for the circular island, false for square fields.
export function buildNav(solids, limit, radius, round = false) {
  const n = Math.ceil((limit * 2) / CELL);
  const cells = new Uint8Array(n * n);
  const nav = { n, limit, radius, round, solids, cells };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -limit + (i + 0.5) * CELL;
      const z = -limit + (j + 0.5) * CELL;
      cells[j * n + i] = isInside(nav, x, z) && !blocked(solids, x, z, radius) ? 0 : 1;
    }
  }
  return nav;
}

export function isInside(nav, x, z) {
  if (Math.abs(x) > nav.limit || Math.abs(z) > nav.limit) return false;
  return !nav.round || Math.hypot(x, z) <= nav.limit;
}

export function isFree(nav, x, z) {
  return isInside(nav, x, z) && !blocked(nav.solids, x, z, nav.radius);
}

const cellOf = (nav, v) => Math.min(nav.n - 1, Math.max(0, Math.floor((v + nav.limit) / CELL)));
const centerOf = (nav, i) => -nav.limit + (i + 0.5) * CELL;

// Nearest walkable cell to (x, z) within a few cells, or -1.
function nearestFreeCell(nav, x, z) {
  const ci = cellOf(nav, x);
  const cj = cellOf(nav, z);
  for (let r = 0; r <= 6; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= nav.n || j >= nav.n) continue;
        if (nav.cells[j * nav.n + i] === 0) return j * nav.n + i;
      }
    }
  }
  return -1;
}

// Binary min-heap keyed by f score.
class Heap {
  constructor() { this.a = []; }
  push(f, v) {
    const a = this.a;
    a.push({ f, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.v;
  }
  get size() { return this.a.length; }
}

function lineFree(nav, x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(d / 0.2));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (!isFree(nav, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
  }
  return true;
}

// Returns [{x, z}, ...] waypoints ending at the goal, or null when the goal cannot be reached.
export function findPath(nav, sx, sz, gx, gz, maxNodes = 12000) {
  const n = nav.n;
  const start = cellOf(nav, sz) * n + cellOf(nav, sx);
  const goal = nearestFreeCell(nav, gx, gz);
  if (goal < 0) return null;
  if (start === goal) return [{ x: gx, z: gz }];

  const g = new Float32Array(n * n).fill(Infinity);
  const came = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  const gi = goal % n;
  const gj = Math.floor(goal / n);
  const h = (idx) => {
    const dx = Math.abs((idx % n) - gi);
    const dz = Math.abs(Math.floor(idx / n) - gj);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };

  g[start] = 0;
  const open = new Heap();
  open.push(h(start), start);
  let expanded = 0;
  let found = false;
  while (open.size && expanded < maxNodes) {
    const cur = open.pop();
    if (closed[cur]) continue;
    if (cur === goal) { found = true; break; }
    closed[cur] = 1;
    expanded++;
    const ci = cur % n;
    const cj = Math.floor(cur / n);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nidx = nj * n + ni;
        if (nav.cells[nidx] || closed[nidx]) continue;
        // no diagonal corner cutting through blocked cells
        if (di && dj && (nav.cells[cj * n + ni] || nav.cells[nj * n + ci])) continue;
        const step = di && dj ? Math.SQRT2 : 1;
        const ng = g[cur] + step;
        if (ng < g[nidx]) {
          g[nidx] = ng;
          came[nidx] = cur;
          open.push(ng + h(nidx), nidx);
        }
      }
    }
  }
  if (!found) return null;

  const cells = [];
  for (let c = goal; c !== start && c !== -1; c = came[c]) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => ({ x: centerOf(nav, c % n), z: centerOf(nav, Math.floor(c / n)) }));
  pts.push({ x: gx, z: gz });

  // smooth: jump to the farthest waypoint that is in a straight, clear line
  const out = [];
  let cx = sx;
  let cz = sz;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineFree(nav, cx, cz, pts[j].x, pts[j].z)) j--;
    out.push(pts[j]);
    cx = pts[j].x;
    cz = pts[j].z;
    i = j + 1;
  }
  return out;
}
