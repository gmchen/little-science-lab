import { SCENARIOS, VIGNETTES } from './cases'
import { clamp, mulberry32, pickWeighted, stepped } from './rng'
import { MAX_CELLS, MIN_CELLS, MIN_UNFINISHED, type Scenario } from './scenarios'
import { LAST_STAGE } from './stages'

export type CellularityForAge = 'hypocellular' | 'normocellular' | 'hypercellular'

export interface Biopsy {
  seed: number
  scenario: Scenario
  cellularity: number
  age: number
  /** How the cellularity compares with what is expected at this age. */
  forAge: CellularityForAge
  /** Share of blasts to show in the report, when blasts are a notable part of the marrow. */
  blastPercent?: number
  /** The clinical one-liner read before the marrow is examined (diagnosis withheld). */
  history: string
  /** Short morphology note shown with the diagnosis. */
  cue: string
  /** Initial stage of each cell, already shuffled. */
  stages: number[]
}

/** Rough expected marrow cellularity for an age: about 100 minus the age, kept within a plausible band. */
export const expectedCellularity = (age: number) => clamp(100 - age, 20, 90)
/** How far from the expected value still counts as normocellular for age. */
const FOR_AGE_TOLERANCE = 15
/** Blasts are reported once they make up at least this share of the shown cells. */
const REPORT_BLASTS_FROM = 30

/** Split `n` cells among the weights, giving leftovers to the largest remainders. */
function allocate(weights: number[], n: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / total) * n)
  const counts = exact.map(Math.floor)
  let left = n - counts.reduce((a, b) => a + b, 0)
  const order = exact.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left-- <= 0) break
    counts[i]++
  }
  return counts
}

/** Fill in `{age}`, and make a leading "A" agree with it ("An 8-year-old", "An 18-year-old", "A 7-year-old"). */
const fillAge = (template: string, age: number) => {
  const an = /^(8|11$|18$)/.test(String(age))
  return template.replace(/^A (?=\{age\})/, an ? 'An ' : 'A ').replace(/\{age\}/g, String(age))
}

export function generateBiopsy(seed: number): Biopsy {
  const rand = mulberry32(seed)
  const scenario = pickWeighted(SCENARIOS, rand)

  // A vignette for this scenario; its age limits narrow the scenario's own.
  const options = VIGNETTES.filter((v) => v.scenarioId === scenario.id)
  const vignette = options.length ? options[Math.floor(rand() * options.length)] : undefined
  let lo = scenario.age.min
  let hi = scenario.age.max
  if (vignette) {
    const a = Math.max(lo, vignette.ageMin ?? lo)
    const b = Math.min(hi, vignette.ageMax ?? hi)
    ;[lo, hi] = a <= b ? [a, b] : [vignette.ageMin ?? lo, vignette.ageMax ?? hi]
  }
  const age = lo + Math.floor(rand() * (hi - lo + 1))

  const expected = expectedCellularity(age)
  const { min: cMin, max: cMax, step } = scenario.cellularity
  // Whole steps counted from the minimum, like a heme-path report ("30%, 40%, ...").
  const cellularity = clamp(
    Math.max(
      5,
      scenario.cellularityFromAge
        ? clamp(cMin + Math.round((expected - cMin) / step) * step, cMin, cMax)
        : stepped(scenario.cellularity, rand),
    ),
    0,
    100,
  )
  const forAge =
    cellularity > expected + FOR_AGE_TOLERANCE
      ? 'hypercellular'
      : cellularity < expected - FOR_AGE_TOLERANCE
        ? 'hypocellular'
        : 'normocellular'

  const count = clamp(
    Math.round(MIN_CELLS + ((MAX_CELLS - MIN_CELLS) * (cellularity - 10)) / 90),
    MIN_CELLS,
    MAX_CELLS,
  )

  // A little per-biopsy variation so two marrows of one kind are not identical.
  let weights = scenario.stageWeights.map((w) => w * (0.75 + rand() * 0.5))
  let blastPercent = scenario.blasts ? stepped(scenario.blasts, rand) : undefined
  if (blastPercent !== undefined) {
    const rest = weights.slice(1)
    const restTotal = rest.reduce((a, b) => a + b, 0)
    weights = [blastPercent, ...rest.map((w) => (w / restTotal) * (100 - blastPercent!))]
  }

  const counts = allocate(weights, count)
  if (blastPercent === undefined) {
    const shown = Math.round(((counts[0] / count) * 100) / 10) * 10
    if (shown >= REPORT_BLASTS_FROM) blastPercent = shown
  }
  const excess = counts[LAST_STAGE] - (count - MIN_UNFINISHED)
  if (excess > 0) {
    counts[LAST_STAGE] -= excess
    counts[LAST_STAGE - 1] += excess
  }

  const stages = counts.flatMap((c, stage) => Array<number>(c).fill(stage))
  for (let i = stages.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[stages[i], stages[j]] = [stages[j], stages[i]]
  }

  const history = vignette
    ? fillAge(vignette.history, age)
    : `A ${age}-year-old patient undergoes a bone marrow biopsy.`
  const cue = fillAge(vignette?.morphologyCue || scenario.keyMorphology, age)

  return { seed, scenario, cellularity, age, forAge, blastPercent, history, cue, stages }
}

export const newSeed = () => 1 + Math.floor(Math.random() * 99999)
