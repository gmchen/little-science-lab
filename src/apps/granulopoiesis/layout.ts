export interface Point {
  x: number
  y: number
}

export interface Adipocyte extends Point {
  r: number
}

export interface MarrowLayout {
  /** Diameter of the tap target of every cell, equal to a blast's visible diameter. */
  d: number
  cells: Point[]
  adipocytes: Adipocyte[]
  /** SVG path data for the trabecular bone along the screen edges. */
  bone: string[]
}

const TARGET_CELLS = 18
const MIN_CELLS = 15

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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

/** One wobbly slab of bone along an edge. `edge` points are in order along the edge, `inward` is the unit normal. */
function boneSlab(
  rand: () => number,
  from: Point,
  to: Point,
  inward: Point,
  thick: number,
): string {
  const steps = 10
  const pts: Point[] = []
  // Overshoot the screen by a margin so the slab always reaches the corners.
  const along = { x: to.x - from.x, y: to.y - from.y }
  const out = { x: -inward.x * 40, y: -inward.y * 40 }
  pts.push({ x: from.x - along.x * 0.05 + out.x, y: from.y - along.y * 0.05 + out.y })
  pts.push({ x: to.x + along.x * 0.05 + out.x, y: to.y + along.y * 0.05 + out.y })
  for (let i = steps; i >= 0; i--) {
    const t = i / steps
    const depth = thick * (0.45 + rand() * 0.75)
    pts.push({
      x: from.x + along.x * t + inward.x * depth,
      y: from.y + along.y * t + inward.y * depth,
    })
  }
  return smoothClosed(pts)
}

export function makeLayout(w: number, h: number): MarrowLayout {
  const rand = mulberry32(20240229)
  const short = Math.min(w, h)
  const thick = short * 0.075

  const bone = [
    boneSlab(rand, { x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: 1 }, thick),
    boneSlab(rand, { x: 0, y: h }, { x: w, y: h }, { x: 0, y: -1 }, thick),
    boneSlab(rand, { x: 0, y: 0 }, { x: 0, y: h }, { x: 1, y: 0 }, thick),
    boneSlab(rand, { x: w, y: 0 }, { x: w, y: h }, { x: -1, y: 0 }, thick),
  ]

  // Fat cells first, so the blasts are placed around them.
  const adipocytes: Adipocyte[] = []
  for (let tries = 0; tries < 400 && adipocytes.length < 5; tries++) {
    const r = short * (0.045 + rand() * 0.04)
    const a = {
      x: thick + r + rand() * (w - 2 * (thick + r)),
      y: thick + r + rand() * (h - 2 * (thick + r)),
      r,
    }
    if (adipocytes.every((b) => Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 1.6)) {
      adipocytes.push(a)
    }
  }

  let d = Math.max(80, Math.min(170, short * 0.2))
  for (let attempt = 0; attempt < 12; attempt++, d *= 0.93) {
    const pad = thick + d * 0.55
    const cells: Point[] = []
    while (cells.length < TARGET_CELLS) {
      // Best-candidate sampling spreads the cells out evenly.
      let best: Point | null = null
      let bestDist = 0
      for (let i = 0; i < 40; i++) {
        const p = { x: pad + rand() * (w - 2 * pad), y: pad + rand() * (h - 2 * pad) }
        if (adipocytes.some((a) => Math.hypot(p.x - a.x, p.y - a.y) < a.r + d * 0.5)) continue
        const nearest = cells.reduce((m, c) => Math.min(m, Math.hypot(p.x - c.x, p.y - c.y)), Infinity)
        if (nearest > bestDist) {
          bestDist = nearest
          best = p
        }
      }
      if (!best || bestDist < d * 1.04) break
      cells.push(best)
    }
    if (cells.length >= MIN_CELLS) return { d, cells, adipocytes, bone }
  }
  return { d, cells: [], adipocytes, bone }
}
