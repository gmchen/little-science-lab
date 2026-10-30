export type Rand = () => number

export function mulberry32(seed: number): Rand {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Range {
  min: number
  max: number
  step: number
}

/** A random value from min to max inclusive, in multiples of `step` from min. */
export function stepped(range: Range, rand: Rand): number {
  const n = Math.round((range.max - range.min) / range.step) + 1
  return range.min + range.step * Math.floor(rand() * n)
}

export function pickWeighted<T extends { weight: number }>(items: T[], rand: Rand): T {
  let r = rand() * items.reduce((sum, i) => sum + i.weight, 0)
  for (const item of items) {
    r -= item.weight
    if (r < 0) return item
  }
  return items[items.length - 1]
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
