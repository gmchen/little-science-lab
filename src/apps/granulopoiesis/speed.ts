import { useState } from 'react'

/** Transformation lengths to compare; every tap also gets a short pop regardless of speed. */
export const SPEEDS = {
  instant: { label: 'Instant', ms: 0 },
  quick: { label: 'Quick (0.9 s)', ms: 900 },
  slow: { label: 'Slow (2 s)', ms: 2000 },
} as const

export type SpeedId = keyof typeof SPEEDS

const KEY = 'little-science-lab.granulopoiesis.speed'

function load(): SpeedId {
  try {
    const v = localStorage.getItem(KEY)
    if (v && v in SPEEDS) return v as SpeedId
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return 'quick'
}

export function useSpeed(): [SpeedId, (s: SpeedId) => void] {
  const [speed, setSpeed] = useState<SpeedId>(load)
  const set = (s: SpeedId) => {
    setSpeed(s)
    try {
      localStorage.setItem(KEY, s)
    } catch {
      // ignore
    }
  }
  return [speed, set]
}
