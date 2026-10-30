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

const INTRO_KEY = 'little-science-lab.granulopoiesis.caseIntro'

/** Whether each new biopsy opens with its clinical vignette (on) or goes straight to the marrow (off). */
export function useIntroSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INTRO_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const set = (next: boolean) => {
    setOn(next)
    try {
      localStorage.setItem(INTRO_KEY, next ? 'on' : 'off')
    } catch {
      // ignore
    }
  }
  return [on, set]
}

export type Mode = 'identify' | 'differentiate'

const MODE_KEY = 'little-science-lab.granulopoiesis.mode'

/** Identify: tap a cell to see its name. Differentiate: tap a cell to mature it toward a neutrophil. */
export function useModeSetting(): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'differentiate' ? 'differentiate' : 'identify'
    } catch {
      return 'identify'
    }
  })
  const set = (next: Mode) => {
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // ignore
    }
  }
  return [mode, set]
}
