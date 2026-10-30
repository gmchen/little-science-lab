import type { Range } from './rng'

/**
 * Game-generation presets, not diagnostic criteria. Only the six granulocytic stages are drawn, so
 * the percentages describe the cells on screen, not a full marrow differential (which also counts
 * erythroid cells, megakaryocytes, lymphocytes, etc.).
 *
 * The scenarios and vignettes themselves live in data/marrow_scenarios.csv and
 * data/marrow_vignettes.csv, loaded by cases.ts.
 */
export interface Scenario {
  id: string
  /** The diagnosis as a pathology report would word it; this is what the marrow screen shows. */
  name: string
  /** Short label for the case as an editor sees it, e.g. "AML, new diagnosis (adult)". Not shown in the game. */
  context?: string
  /** Relative chance of being drawn. A design preference, not disease prevalence. */
  weight: number
  /** Patient age in years. */
  age: Range
  /** Percent cellularity, picked in steps like a heme-path report. */
  cellularity: Range
  /** When true, cellularity follows the patient's age (roughly 100 minus age) instead of being drawn. */
  cellularityFromAge: boolean
  /** Percent of the drawn cells that are blasts, independent of cellularity. Omit to use stageWeights. */
  blasts?: Range
  /** Relative weight of each stage (Blast … Neutrophil). Index 0 is ignored when `blasts` is set. */
  stageWeights: number[]
  /** One-line morphology note shown when a vignette doesn't supply its own. */
  keyMorphology: string
  /** Caveat for whoever edits the data; not shown in the game. */
  caveat: string
}

/** A short clinical one-liner for a scenario. `{age}` is replaced with the generated age. */
export interface Vignette {
  id: string
  scenarioId: string
  ageMin?: number
  ageMax?: number
  history: string
  morphologyCue: string
  note: string
}

/** Tappable cells on screen, from the sparsest to the most crowded marrow. */
export const MIN_CELLS = 6
export const MAX_CELLS = 20
/** At least this many cells start short of neutrophil, so a biopsy never begins finished. */
export const MIN_UNFINISHED = 3
