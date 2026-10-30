import { clamp, mulberry32, pickWeighted, stepped } from './rng'
import { MAX_CELLS, MIN_CELLS, MIN_UNFINISHED, PATIENT_AGE, SCENARIOS, type Scenario } from './scenarios'
import { LAST_STAGE } from './stages'

export type CellularityForAge = 'hypocellular' | 'normocellular' | 'hypercellular'

export interface Biopsy {
  seed: number
  scenario: Scenario
  cellularity: number
  age: number
  /** How the cellularity compares with what is expected at this age (roughly 100 minus age). */
  forAge: CellularityForAge
  blastPercent?: number
  /** Initial stage of each cell, already shuffled. */
  stages: number[]
}

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

export function generateBiopsy(seed: number): Biopsy {
  const rand = mulberry32(seed)
  const scenario = pickWeighted(SCENARIOS, rand)

  const normalAge = scenario.age ? stepped(scenario.age, rand) : undefined
  const cellularity =
    normalAge !== undefined ? clamp(100 - normalAge, 10, 100) : stepped(scenario.cellularity!, rand)
  const age = normalAge ?? stepped(PATIENT_AGE, rand)
  const expected = clamp(100 - age, 20, 80)
  const forAge =
    cellularity > expected + 10 ? 'hypercellular' : cellularity < expected - 10 ? 'hypocellular' : 'normocellular'
  const blastPercent = scenario.blasts ? stepped(scenario.blasts, rand) : undefined

  const count = Math.round(MIN_CELLS + ((MAX_CELLS - MIN_CELLS) * (cellularity - 10)) / 90)

  // A little per-biopsy variation so two marrows of one kind are not identical.
  let weights = scenario.stageWeights.map((w) => w * (0.75 + rand() * 0.5))
  if (blastPercent !== undefined) {
    const rest = weights.slice(1)
    const restTotal = rest.reduce((a, b) => a + b, 0)
    weights = [blastPercent, ...rest.map((w) => (w / restTotal) * (100 - blastPercent))]
  }

  const counts = allocate(weights, count)
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

  return { seed, scenario, cellularity, age, forAge, blastPercent, stages }
}

export const newSeed = () => 1 + Math.floor(Math.random() * 99999)
