import type { Biopsy } from './biopsy'
import { clamp, mulberry32, type Rand } from './rng'
import { MAX_FAT_COVERAGE } from './scenarios'

export interface Point {
  x: number
  y: number
}

export interface Adipocyte extends Point {
  r: number
}

export interface Lacuna extends Point {
  rx: number
  ry: number
  rot: number
}

export interface MarrowLayout {
  /** Diameter of the tap target of every cell, equal to the largest stage's visible diameter. */
  d: number
  cells: Point[]
  adipocytes: Adipocyte[]
  /** SVG path data for each piece of trabecular bone. */
  bone: string[]
  /** Osteocyte lacunae: the small dark holes seen in bone on H&E. */
  lacunae: Lacuna[]
}

interface Piece {
  path: string
  /** Outline used to keep cells and fat off the bone. */
  poly: Point[]
}

/** Closed smooth path through a list of points (midpoint quadratic smoothing). */
function smoothClosed(pts: Point[]): string {
  const n = pts.length
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const start = mid(pts[n - 1], pts[0])
  let d = `M${start.x.toFixed(1)},${start.y.toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n])
    d += ` Q${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${m.x.toFixed(1)},${m.y.toFixed(1)}`
  }
  return d + 'Z'
}

/** Smooth random curve on [0, 1] (eased interpolation between a few random values). */
function noise(rand: Rand, n = 5) {
  const v = Array.from({ length: n }, () => rand())
  return (s: number) => {
    const x = clamp(s, 0, 1) * (n - 1)
    const i = Math.min(n - 2, Math.floor(x))
    const f = x - i
    const t = f * f * (3 - 2 * f)
    return v[i] * (1 - t) + v[i + 1] * t
  }
}

/** A curving path that starts at `from` heading `heading`, bending steadily with some wobble. */
function walk(rand: Rand, from: Point, heading: number, length: number, bend: number, kinky = false): Point[] {
  const nz = noise(rand)
  // Some trabeculae turn sharply partway along, giving hooks and L shapes.
  const kinkAt = 0.25 + rand() * 0.25
  const kink = kinky && rand() < 0.5 ? (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.6) : 0
  const steps = Math.max(28, Math.round(length / 14))
  const step = length / steps
  const pts = [from]
  let p = from
  for (let i = 1; i <= steps; i++) {
    const s = i / steps
    const t = clamp((s - kinkAt) / 0.3, 0, 1)
    const hd = heading + bend * s + kink * t * t * (3 - 2 * t) + (nz(s) - 0.5) * 0.3
    p = { x: p.x + Math.cos(hd) * step, y: p.y + Math.sin(hd) * step }
    pts.push(p)
  }
  return pts
}

/**
 * Outline of a ribbon along `spine`, ending in rounded caps (never points). `tip` is the width at
 * the far end relative to the root, and `lumpy` how much the width wanders.
 */
function ribbon(rand: Rand, spine: Point[], halfWidth: number, capStart: boolean, capEnd: boolean, tip = 1, lumpy = 0.12, bumps: [number, number, number][] = []): Piece {
  const nz = noise(rand)
  const n = spine.length
  const dist = [0]
  for (let i = 1; i < n; i++) dist.push(dist[i - 1] + Math.hypot(spine[i].x - spine[i - 1].x, spine[i].y - spine[i - 1].y))
  const total = dist[n - 1]
  const left: Point[] = []
  const right: Point[] = []
  spine.forEach((p, i) => {
    const s = i / (n - 1)
    // Broad at the root, narrower toward the tip, with lumps and concavities along the way.
    // [position, extra width, spread] knobs, like the heavy spots where bone joins bone.
    const knobs = bumps.reduce((sum, [s0, amp, spread]) => sum + amp * Math.exp(-(((s - s0) / spread) ** 2)), 0)
    const k = (1 - (1 - tip) * Math.pow(s, 0.9)) * (1 - lumpy + 2 * lumpy * nz(s)) * (1 + knobs)
    const half = halfWidth * k
    // Semicircular end caps: the width closes up like a circle over the last `half` of length.
    const cap = (x: number) => Math.sqrt(Math.max(0, 1 - ((half - x) / half) ** 2))
    let width = half
    if (capStart && dist[i] < half) width = half * cap(dist[i])
    if (capEnd && total - dist[i] < half) width = half * cap(total - dist[i])
    width = Math.max(1, width)
    const a = spine[Math.max(i - 1, 0)]
    const b = spine[Math.min(i + 1, n - 1)]
    const tx = b.x - a.x
    const ty = b.y - a.y
    const tl = Math.hypot(tx, ty) || 1
    left.push({ x: p.x - (ty / tl) * width, y: p.y + (tx / tl) * width })
    right.push({ x: p.x + (ty / tl) * width, y: p.y - (tx / tl) * width })
  })
  const poly = [...left, ...right.reverse()]
  return { path: smoothClosed(poly), poly }
}

/** Where an edge starts, which way it runs, which way is inward, and its length. */
function edgeGeometry(edge: number, w: number, h: number) {
  const o = [{ x: 0, y: 0 }, { x: 0, y: h }, { x: 0, y: 0 }, { x: w, y: 0 }][edge]
  const a = [{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 1 }][edge]
  const n = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }][edge]
  return { o, a, n, len: edge < 2 ? w : h }
}

/**
 * Bone for a nicely cut H&E core. Along one to three edges runs a band of bone, thick in places and
 * thin in others, like the boundary of the section. Trabeculae sweep off those bands at a slant,
 * all leaning the same way around the field so they never point at one another, then end inside.
 * Nothing crosses from one edge to another, and pieces only touch where a branch joins its parent.
 */
function makeBone(rand: Rand, w: number, h: number): Piece[] {
  const short = Math.min(w, h)
  const pieces: Piece[] = []

  /** True if a ribbon with this spine stays clear of every other piece (apart from its parent's root). */
  const clear = (spine: Point[], hw: number, parent?: Piece, rootFrac = 0.5) =>
    spine.every((p, i) => {
      const rooted = parent !== undefined && i / (spine.length - 1) < rootFrac
      return pieces.every((piece) => (rooted && piece === parent ? true : distToBone(p, [piece]) > hw * 1.1 + 24))
    })
  /** Tips must stay well inside the field, so no piece ever reaches a second edge. */
  const tipOk = (p: Point, margin: number) => p.x > margin && p.y > margin && p.x < w - margin && p.y < h - margin

  // Bands along the edges.
  const bands: { piece: Piece; spine: Point[]; edge: number; hw: number }[] = []
  const edges = [0, 1, 2, 3].sort(() => rand() - 0.5).slice(0, 1 + Math.floor(rand() * 3))
  for (const edge of edges) {
    const { o, a, n, len } = edgeGeometry(edge, w, h)
    const hw = short * (0.022 + rand() * 0.02)
    const t0 = rand() < 0.5 ? -0.08 : 0.05 + rand() * 0.3
    const t1 = t0 < 0 ? (rand() < 0.5 ? 1.08 : 0.5 + rand() * 0.4) : Math.min(1.08, t0 + 0.35 + rand() * 0.5)
    const nz = noise(rand)
    const spine = Array.from({ length: 30 }, (_, i) => {
      const s = i / 29
      const t = t0 + (t1 - t0) * s
      const depth = hw * (0.2 + 0.8 * (nz(s) - 0.5))
      return { x: o.x + a.x * len * t + n.x * depth, y: o.y + a.y * len * t + n.y * depth }
    })
    const knobs: [number, number, number][] = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => [
      0.1 + rand() * 0.8,
      0.6 + rand() * 1.1,
      0.05 + rand() * 0.07,
    ])
    const piece = ribbon(rand, spine, hw, t0 > 0.02, t1 < 0.98, 1, 0.3, knobs)
    pieces.push(piece)
    bands.push({ piece, spine, edge, hw })
  }

  // Trabeculae sweep off the bands, all in the same rotational sense (clockwise or the reverse).
  const swirl = rand() < 0.5 ? 1 : -1
  const lean = [1, -1, -1, 1] // which way along each edge a clockwise sweep leans
  const nStruts = 2 + Math.floor(rand() * 3)
  for (let r = 0; r < nStruts; r++) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const band = bands[Math.floor(rand() * bands.length)]
      const { a, n } = edgeGeometry(band.edge, w, h)
      const inside = band.spine.filter((p) => tipOk(p, 0))
      if (inside.length < 6) continue
      const root = inside[Math.floor(inside.length * (0.15 + rand() * 0.7))]
      const slant = 0.6 + rand() * 0.6
      const sign = swirl * lean[band.edge]
      const heading = Math.atan2(n.y * Math.cos(slant) + a.y * sign * Math.sin(slant), n.x * Math.cos(slant) + a.x * sign * Math.sin(slant))
      const hw = short * (0.055 + rand() * 0.03)
      const spine = walk(rand, root, heading, short * (0.28 + rand() * 0.2), sign * (0.1 + rand() * 0.5))
      if (!tipOk(spine[spine.length - 1], short * 0.1) || !clear(spine, hw, band.piece)) continue
      const piece = ribbon(rand, spine, hw, false, true, 0.45, 0.16, [[0.04, 0.5, 0.12]])
      pieces.push(piece)

      // Sometimes it splits into a Y further along, the body bulging at the fork.
      if (rand() < 0.5) {
        const k = Math.floor(spine.length * (0.4 + rand() * 0.25))
        const p0 = spine[Math.max(k - 1, 0)]
        const p1 = spine[Math.min(k + 1, spine.length - 1)]
        const side = rand() < 0.5 ? -1 : 1
        const arm = walk(rand, spine[k], Math.atan2(p1.y - p0.y, p1.x - p0.x) + side * (0.5 + rand() * 0.35), short * (0.14 + rand() * 0.14), side * 0.3)
        const local = hw * (1 - 0.5 * (k / (spine.length - 1)))
        if (tipOk(arm[arm.length - 1], short * 0.08) && clear(arm, local * 0.7, piece, 0.45)) {
          pieces.push(ribbon(rand, arm, local * 0.8, false, true, 0.55, 0.16))
        }
      }
      break
    }
  }

  // Now and then a chunky fragment cut through the field.
  if (rand() < 0.4) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const start = { x: w * 0.12 + rand() * w * 0.76, y: h * 0.12 + rand() * h * 0.76 }
      const hw = short * (0.05 + rand() * 0.03)
      const spine = walk(rand, start, rand() * Math.PI * 2, short * (0.1 + rand() * 0.1), (rand() - 0.5) * 1.6)
      if (!spine.every((q) => tipOk(q, short * 0.08)) || !clear(spine, hw)) continue
      pieces.push(ribbon(rand, spine, hw, true, true, 0.8, 0.2))
      break
    }
  }
  return pieces
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function insidePoly(p: Point, poly: Point[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Distance from `p` to the bone outline (0 when `p` is inside the bone). */
function distToBone(p: Point, pieces: Piece[]) {
  let best = Infinity
  for (const { poly } of pieces) {
    if (insidePoly(p, poly)) return 0
    for (let i = 0; i < poly.length; i++) {
      best = Math.min(best, distToSegment(p, poly[i], poly[(i + 1) % poly.length]))
    }
  }
  return best
}

function polyArea(poly: Point[]) {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

/** A scattering of osteocyte lacunae inside each piece of bone, kept away from its edge. */
function makeLacunae(rand: Rand, pieces: Piece[], w: number, h: number): Lacuna[] {
  const out: Lacuna[] = []
  for (const { poly } of pieces) {
    const xs = poly.map((p) => p.x)
    const ys = poly.map((p) => p.y)
    const x0 = Math.max(0, Math.min(...xs))
    const x1 = Math.min(w, Math.max(...xs))
    const y0 = Math.max(0, Math.min(...ys))
    const y1 = Math.min(h, Math.max(...ys))
    let want = Math.min(5, Math.round(polyArea(poly) / 6000))
    for (let tries = 0; tries < 300 && want > 0; tries++) {
      const p = { x: x0 + rand() * (x1 - x0), y: y0 + rand() * (y1 - y0) }
      if (!insidePoly(p, poly)) continue
      let edge = Infinity
      for (let i = 0; i < poly.length; i++) edge = Math.min(edge, distToSegment(p, poly[i], poly[(i + 1) % poly.length]))
      if (edge < 9 || out.some((l) => Math.hypot(l.x - p.x, l.y - p.y) < 16)) continue
      out.push({ ...p, rx: 2.6 + rand() * 1.8, ry: 1.5 + rand() * 1, rot: rand() * 180 })
      want--
    }
  }
  return out
}

/**
 * Fat cells, sized relative to the cells (a bit over a blast's width, larger with age). Coverage
 * rises as cellularity falls, so the field stays packed with either fat or cells. They never overlap
 * each other, the edges or the bone.
 */
function makeFat(rand: Rand, w: number, h: number, d: number, cellularity: number, age: number, bone: Piece[], cells: Point[]): Adipocyte[] {
  const gap = 4
  const coverage = Math.max(0.02, MAX_FAT_COVERAGE * (1 - cellularity / 100))
  const target = coverage * w * h
  // Real fat cells are ~3x a blast's width; shown nearer 1.3x so the cells stay big enough to tap and there are plenty of them.
  const baseR = d * (0.3 + ((age - 20) / 60) * 0.08)
  const fat: Adipocyte[] = []
  let area = 0
  // Largest first: fill each size until it stops fitting, then step down to smaller ones that fill
  // the gaps, until the target coverage is reached.
  for (let scale = 1.2; scale > 0.4 && area < target; scale *= 0.88) {
    let fails = 0
    while (fails < 6 && area < target) {
      // Don't let one large cell overshoot a small remaining target.
      const left = Math.sqrt((target - area) / Math.PI)
      const r = Math.min(baseR * scale * (0.9 + rand() * 0.2), Math.max(left * 1.3, baseR * 0.3))
      // Early cells get random breathing room; later, smaller ones sit snugly. Taking the spot whose
      // room is closest to a random target keeps the fat from all snuggling into the same clumps.
      const wanted = area < target * 0.5 ? rand() * r * 0.35 : 0
      let best: Adipocyte | null = null
      let bestOff = Infinity
      for (let i = 0; i < 24; i++) {
        const x = r + gap + rand() * (w - 2 * (r + gap))
        const y = r + gap + rand() * (h - 2 * (r + gap))
        let clear = Math.min(x - r - gap, y - r - gap, w - x - r - gap, h - y - r - gap)
        for (const f of fat) clear = Math.min(clear, Math.hypot(x - f.x, y - f.y) - f.r - r - gap)
        for (const c of cells) clear = Math.min(clear, Math.hypot(x - c.x, y - c.y) - r - d * 0.5)
        if (clear < -0.5 || Math.abs(clear - wanted) >= bestOff) continue
        clear = Math.min(clear, distToBone({ x, y }, bone) - r - gap)
        if (clear < -0.5) continue
        bestOff = Math.abs(clear - wanted)
        best = { x, y, r }
      }
      if (best) {
        fat.push(best)
        area += Math.PI * r * r
        fails = 0
      } else {
        fails++
      }
    }
  }
  return fat
}

export function makeLayout(w: number, h: number, biopsy: Biopsy): MarrowLayout {
  const short = Math.min(w, h)
  const rand = mulberry32(biopsy.seed * 7919 + 1)
  const want = biopsy.stages.length

  const pieces = makeBone(rand, w, h)
  const lacunae = makeLacunae(rand, pieces, w, h)
  const cellSeed = Math.floor(rand() * 1e9)
  const bone = pieces.map((p) => p.path)

  // Cells first, spread evenly among the bone; the fat then fills the space around them. If they
  // don't all fit, they shrink a little and try again.
  const minD = 56
  let d = Math.max(90, Math.min(190, short * 0.23))
  let cells: Point[] = []
  for (let attempt = 0; attempt < 16; attempt++) {
    const cr = mulberry32(cellSeed + attempt)
    const pad = d * 0.55
    const placed: Point[] = []
    while (placed.length < want) {
      // Best-candidate sampling spreads the cells out evenly.
      let pick: Point | null = null
      let pickDist = 0
      for (let i = 0; i < 40; i++) {
        const p = { x: pad + cr() * (w - 2 * pad), y: pad + cr() * (h - 2 * pad) }
        if (distToBone(p, pieces) < d * 0.5) continue
        const nearest = placed.reduce((m, c) => Math.min(m, Math.hypot(p.x - c.x, p.y - c.y)), Infinity)
        if (nearest > pickDist) {
          pickDist = nearest
          pick = p
        }
      }
      if (!pick || pickDist < d * 1.04) break
      placed.push(pick)
    }
    if (placed.length > cells.length) cells = placed
    if (placed.length >= want) break
    d = Math.max(minD, d * 0.95)
  }

  const adipocytes = makeFat(rand, w, h, d, biopsy.cellularity, biopsy.age, pieces, cells)
  return { d, cells, adipocytes, bone, lacunae }
}
