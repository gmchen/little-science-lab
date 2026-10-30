import type { Biopsy } from './biopsy'
import { clamp, mulberry32, type Rand } from './rng'
import { MAX_SIZE, STAGES } from './stages'

export interface Point {
  x: number
  y: number
}

export interface Adipocyte extends Point {
  /** Radius of the cell at its centre; the drawn outline is a packed polygon around it. */
  r: number
  /** Outline points (the cell, pressed against its neighbours like real fat). */
  poly: Point[]
  /** Smooth path data for the drawn shape. `round` is extra stroke used to round it off (0 = none). */
  path: string
  round: number
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
  /** Share of the area between the bone that the fat covers; cellularity is about 1 minus this. */
  fatFraction: number
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
 * Bone for a nicely cut H&E core, kept simple: bands of bone along one to three edges of the field,
 * like the boundary of the section. Each is thick in places and thin in others, and either runs off
 * the screen at both ends or stops with rounded ends. Nothing reaches into the middle.
 */
function makeBone(rand: Rand, w: number, h: number): Piece[] {
  const short = Math.min(w, h)
  const pieces: Piece[] = []
  const edges = [0, 1, 2, 3].sort(() => rand() - 0.5).slice(0, 1 + Math.floor(rand() * 3))
  for (const edge of edges) {
    const { o, a, n, len } = edgeGeometry(edge, w, h)
    const hw = short * (0.03 + rand() * 0.03)
    const t0 = rand() < 0.5 ? -0.08 : 0.05 + rand() * 0.3
    const t1 = t0 < 0 ? (rand() < 0.5 ? 1.08 : 0.5 + rand() * 0.4) : Math.min(1.08, t0 + 0.35 + rand() * 0.5)
    const nz = noise(rand)
    const spine = Array.from({ length: 30 }, (_, i) => {
      const s = i / 29
      const t = t0 + (t1 - t0) * s
      const depth = hw * (0.2 + 0.8 * (nz(s) - 0.5))
      return { x: o.x + a.x * len * t + n.x * depth, y: o.y + a.y * len * t + n.y * depth }
    })
    // Thick lumps along the band, so it swells and thins rather than keeping one width.
    const knobs: [number, number, number][] = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => [
      0.1 + rand() * 0.8,
      0.6 + rand() * 1.1,
      0.05 + rand() * 0.07,
    ])
    pieces.push(ribbon(rand, spine, hw, t0 > 0.02, t1 < 0.98, 1, 0.3, knobs))
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

interface Site {
  x: number
  y: number
  r: number
  /** A marrow cell's clear zone: a fat circle stops growing before it. */
  solid?: boolean
}

/**
 * The outline of fat cell `i`, found by walking outward from its centre in every direction until
 * something stops it: its own grown circle, a flat shared wall where it presses against another fat
 * cell (the double-bubble look; bigger cells claim more room), a flat edge against bone, or the edge
 * of the field. Free sides
 * stay round. The circle stops growing short of any marrow cell instead of bending around it. A pass
 * of averaging then softens the corners where a wall meets a curve.
 */
function fatOutline(i: number, sites: Site[], w: number, h: number, GROW: number, bone: Point[][]): Point[] {
  const WALL = 2.5
  const N = 96
  const s = sites[i]
  let R = s.r * GROW
  // A marrow cell stops the circle from growing (it never squashes the fat cell, which stays round).
  for (const t of sites) if (t.solid) R = Math.min(R, Math.hypot(t.x - s.x, t.y - s.y) - t.r - WALL)
  R = Math.max(R, 1)
  const near = sites.filter((t, j) => j !== i && !t.solid && Math.hypot(t.x - s.x, t.y - s.y) <= R + t.r * GROW)
  // Bone edges within reach: a fat cell flattens against bone just as it does against another fat cell.
  const BONE_GAP = 5
  const edges: [number, number, number, number][] = []
  for (const poly of bone) {
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k]
      const b = poly[(k + 1) % poly.length]
      if (Math.min(a.x, b.x) > s.x + R || Math.max(a.x, b.x) < s.x - R || Math.min(a.y, b.y) > s.y + R || Math.max(a.y, b.y) < s.y - R) continue
      edges.push([a.x, a.y, b.x - a.x, b.y - a.y])
    }
  }
  const reach: number[] = []
  for (let k = 0; k < N; k++) {
    const ux = Math.cos((2 * Math.PI * k) / N)
    const uy = Math.sin((2 * Math.PI * k) / N)
    let rho = R
    for (const t of near) {
      const dx = t.x - s.x
      const dy = t.y - s.y
      const along = ux * dx + uy * dy
      if (along <= 0) continue
      // Another fat cell: stop at the wall between them (the radical line of the two circles).
      rho = Math.min(rho, (dx * dx + dy * dy - t.r * t.r + s.r * s.r) / (2 * along))
    }
    // Stop at the first bone edge the ray meets.
    for (const [ax, ay, ex, ey] of edges) {
      const denom = ux * ey - uy * ex
      if (Math.abs(denom) < 1e-9) continue
      const t = ((ax - s.x) * ey - (ay - s.y) * ex) / denom
      const v = ((ax - s.x) * uy - (ay - s.y) * ux) / denom
      if (t > 0 && v >= 0 && v <= 1) rho = Math.min(rho, t - BONE_GAP)
    }
    // Stay inside the field.
    if (ux > 1e-6) rho = Math.min(rho, (w - 3 - s.x) / ux)
    if (ux < -1e-6) rho = Math.min(rho, (3 - s.x) / ux)
    if (uy > 1e-6) rho = Math.min(rho, (h - 3 - s.y) / uy)
    if (uy < -1e-6) rho = Math.min(rho, (3 - s.y) / uy)
    reach.push(Math.max(0, rho - WALL))
  }
  // Soften the corners: average each direction with its neighbours, twice.
  let soft = reach
  for (let pass = 0; pass < 2; pass++) {
    soft = soft.map((_, k) => (soft[(k + N - 2) % N] + 2 * soft[(k + N - 1) % N] + 3 * soft[k] + 2 * soft[(k + 1) % N] + soft[(k + 2) % N]) / 9)
  }
  // Only ever pull inward, so smoothing can't push an outline into a neighbour or a marrow cell.
  return soft.map((rho, k) => ({
    x: s.x + Math.min(rho, reach[k]) * Math.cos((2 * Math.PI * k) / N),
    y: s.y + Math.min(rho, reach[k]) * Math.sin((2 * Math.PI * k) / N),
  }))
}

/**
 * Fat cells. Cellularity is the share of the area between the bone that is NOT fat, so the fat has to
 * cover about 1 minus cellularity of it: mostly fat at 5% cellularity, hardly any at 95%. The marrow
 * cells are already placed; each is a solid obstacle, so the fat packs around it and never under it. Circles
 * can't tile a plane, so cells are placed as circles (never smaller than the biggest myeloid cell, a
 * promyelocyte, whose diameter is `d`) and then grown into packed polygons. Coverage is measured as
 * it goes and placement stops when it reaches the target.
 */
function makeFat(
  rand: Rand,
  w: number,
  h: number,
  d: number,
  cellularity: number,
  age: number,
  bone: Piece[],
  cells: Point[],
  stages: number[],
): { fat: Adipocyte[]; fraction: number } {
  const target = Math.min(0.93, 1 - cellularity / 100)
  if (target < 0.03) return { fat: [], fraction: 0 }

  // Sample points between the bone, used to measure how much of that area the fat covers.
  const step = Math.max(10, Math.min(w, h) / 50)
  const samples: Point[] = []
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      if (!bone.some((piece) => insidePoly({ x, y }, piece.poly))) samples.push({ x, y })
    }
  }

  const gap = 3
  // Room kept clear around each marrow cell: its drawn radius at its starting stage, plus a little.
  const obstacles: Site[] = cells.map((c, i) => ({
    x: c.x,
    y: c.y,
    r: (d * STAGES[stages[i] ?? 0].size) / MAX_SIZE / 2 + d * 0.07,
    solid: true,
  }))
  // No smaller than a blast (16 micrometers = 0.84 of `d`), the smallest of the early cells.
  const minR = d * 0.42
  const baseR = d * (0.66 + ((age - 20) / 60) * 0.1)
  const sites: Site[] = []
  const boneOutlines = bone.map((piece) => piece.poly)
  let outlines: Point[][] = []

  /** `grow` is how far past its circle a cell may spread into free space. */
  const measure = (grow = 1.2) => {
    const all = [...sites, ...obstacles]
    outlines = sites.map((_, i) => fatOutline(i, all, w, h, grow, boneOutlines))
    const boxes = outlines.map((poly) => {
      const xs = poly.map((q) => q.x)
      const ys = poly.map((q) => q.y)
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    })
    let covered = 0
    for (const q of samples) {
      for (let k = 0; k < outlines.length; k++) {
        const [x0, y0, x1, y1] = boxes[k]
        if (q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1 && outlines[k].length >= 3 && insidePoly(q, outlines[k])) {
          covered++
          break
        }
      }
    }
    return samples.length ? covered / samples.length : 0
  }

  let coverage = 0
  let added = 0
  // Largest first: fill each size until it stops fitting, then step down to smaller ones.
  sizes: for (let scale = 1.2; baseR * scale >= minR * 0.97; scale *= 0.94) {
    let fails = 0
    while (fails < 4) {
      const r = Math.max(minR, baseR * scale * (0.9 + rand() * 0.2))
      // Early cells get random breathing room; later ones sit snugly against what is already there.
      const wanted = coverage < target * 0.4 ? rand() * r * 0.5 : 0
      let best: Site | null = null
      let bestOff = Infinity
      for (let i = 0; i < 120; i++) {
        const x = r + gap + rand() * (w - 2 * (r + gap))
        const y = r + gap + rand() * (h - 2 * (r + gap))
        let clear = Infinity
        for (const f of sites) clear = Math.min(clear, Math.hypot(x - f.x, y - f.y) - f.r - r - gap)
        for (const o of obstacles) clear = Math.min(clear, Math.hypot(x - o.x, y - o.y) - o.r - r - gap)
        if (clear < 0 || Math.abs(Math.min(clear, r) - wanted) >= bestOff) continue
        // The circle starts clear of the bone and then grows to meet it, flattening against it.
        if (distToBone({ x, y }, bone) < r + gap) continue
        bestOff = Math.abs(Math.min(clear, r) - wanted)
        best = { x, y, r }
      }
      if (!best) {
        fails++
        continue
      }
      sites.push(best)
      fails = 0
      added++
      coverage = measure()
      // Even one minimum-size cell can overshoot a very small target; then leave the fat out.
      if (sites.length === 1 && coverage > target + 0.08) {
        sites.pop()
        coverage = 0
        break sizes
      }
      if (coverage >= target) break sizes
    }
  }
  // Once no more cells fit, let them spread further into the remaining gaps if the target isn't met yet.
  coverage = measure()
  for (const grow of [1.35, 1.5, 1.7, 2.0, 2.4, 3.0]) {
    if (coverage >= target - 0.03) break
    coverage = measure(grow)
  }
  const fat: Adipocyte[] = []
  sites.forEach((site, i) => {
    const poly = outlines[i]
    if (poly.length >= 3) fat.push({ ...site, poly, path: smoothClosed(poly), round: 0 })
  })
  return { fat, fraction: coverage }
}

export function makeLayout(w: number, h: number, biopsy: Biopsy): MarrowLayout {
  const short = Math.min(w, h)
  const rand = mulberry32(biopsy.seed * 7919 + 1)
  const want = biopsy.stages.length

  const pieces = makeBone(rand, w, h)
  const lacunae = makeLacunae(rand, pieces, w, h)
  const cellSeed = Math.floor(rand() * 1e9)
  const bone = pieces.map((p) => p.path)

  // The cells go down first, in a few patches among the bone; the fat is then packed around them to
  // match the cellularity, so a cell always sits in its own gap. If they don't all fit, they shrink
  // a little and try again.
  const minD = 56
  let d = Math.max(90, Math.min(190, short * 0.23))
  let cells: Point[] = []
  // A sparse marrow keeps its few cells together in one or two tight patches (which also leaves the
  // rest of the field free for fat); a cellular marrow spreads them out.
  const compact = biopsy.cellularity < 60
  for (let attempt = 0; attempt < 16; attempt++) {
    const cr = mulberry32(cellSeed + attempt)
    const pad = d * 0.55
    const placed: Point[] = []
    const patchCount = compact ? 1 : Math.max(2, Math.round(want / 4))
    const patches = Array.from({ length: patchCount }, () => ({
      x: pad + cr() * (w - 2 * pad),
      y: pad + cr() * (h - 2 * pad),
    }))
    const gauss = () => cr() + cr() + cr() - 1.5
    while (placed.length < want) {
      let pick: Point | null = null
      let pickScore = -Infinity
      const centroid = placed.length
        ? placed.reduce((m, c) => ({ x: m.x + c.x / placed.length, y: m.y + c.y / placed.length }), { x: 0, y: 0 })
        : patches[0]
      for (let i = 0; i < 40; i++) {
        let p = { x: pad + cr() * (w - 2 * pad), y: pad + cr() * (h - 2 * pad) }
        if (compact) {
          // Grow the patch outward: a new cell goes right next to one that is already placed.
          const base = placed.length ? placed[Math.floor(cr() * placed.length)] : patches[0]
          const ang = cr() * Math.PI * 2
          const dist = placed.length ? d * (1.05 + 0.2 * cr()) : 0
          p = { x: base.x + Math.cos(ang) * dist, y: base.y + Math.sin(ang) * dist }
          if (p.x < pad || p.y < pad || p.x > w - pad || p.y > h - pad) continue
        } else if (cr() < 0.7) {
          const c = patches[Math.floor(cr() * patches.length)]
          p = { x: c.x + gauss() * d * 1.6, y: c.y + gauss() * d * 1.6 }
          if (p.x < pad || p.y < pad || p.x > w - pad || p.y > h - pad) continue
        }
        if (distToBone(p, pieces) < d * 0.5) continue
        const nearest = placed.reduce((m, c) => Math.min(m, Math.hypot(p.x - c.x, p.y - c.y)), Infinity)
        if (nearest < d * 1.04) continue
        // Compact: keep the patch round (closest to its centre). Spread: as far from the others as possible.
        const score = placed.length === 0 ? cr() : compact ? -Math.hypot(p.x - centroid.x, p.y - centroid.y) : Math.min(nearest, d * 3)
        if (score > pickScore) {
          pickScore = score
          pick = p
        }
      }
      if (!pick) break
      placed.push(pick)
    }
    if (placed.length > cells.length) cells = placed
    if (placed.length >= want) break
    d = Math.max(minD, d * 0.95)
  }

  const { fat: adipocytes, fraction: fatFraction } = makeFat(rand, w, h, d, biopsy.cellularity, biopsy.age, pieces, cells, biopsy.stages)
  return { d, cells, adipocytes, bone, lacunae, fatFraction }
}
