import type { Range } from './rng'

/**
 * Game-generation presets, not diagnostic criteria. Only the six granulocytic stages are drawn, so
 * the percentages describe the cells on screen, not a full marrow differential (which also counts
 * erythroid cells, megakaryocytes, lymphocytes, etc.).
 */
export interface Scenario {
  id: string
  name: string
  /** Relative chance of being drawn. A design preference, not disease prevalence. */
  weight: number
  /** Percent cellularity, picked in steps like a heme-path report. Omit when `age` sets it. */
  cellularity?: Range
  /** Patient age; cellularity becomes roughly 100 minus age. */
  age?: Range
  /** Percent of the drawn cells that are blasts. Independent of cellularity. Omit to use stageWeights. */
  blasts?: Range
  /** Relative weight of each stage (Blast … Neutrophil). Index 0 is ignored when `blasts` is set. */
  stageWeights: number[]
}

// Normal adult marrow, granulocytic cells only. Anchored on the University of Iowa pathology
// handbook (blasts 0-2, promyelocytes 2-6, myelocytes 3-7, metamyelocytes 5-9, bands 10-16,
// neutrophils 18-28 %) and widened toward textbook ranges, which put more in the myelocyte and
// metamyelocyte stages. Published ranges differ a lot; adjust here.
const NORMAL = [2, 6, 15, 17, 25, 35]
const HYPERCELLULAR = [3, 8, 20, 20, 22, 27]
// Chronic phase CML: marked left shift with a myelocyte peak and few blasts.
const CML = [3, 6, 30, 17, 20, 24]
// What is left over when blasts take their share in AML.
const AML_REST = [0, 15, 20, 15, 25, 25]

export const SCENARIOS: Scenario[] = [
  {
    id: 'normal',
    name: 'Normal marrow',
    weight: 2,
    age: { min: 30, max: 70, step: 10 },
    stageWeights: NORMAL,
  },
  {
    id: 'hypercellular',
    name: 'Hypercellular marrow',
    weight: 1.5,
    cellularity: { min: 70, max: 100, step: 10 },
    stageWeights: HYPERCELLULAR,
  },
  {
    id: 'hypocellular',
    name: 'Hypocellular marrow',
    weight: 1.5,
    cellularity: { min: 10, max: 40, step: 10 },
    stageWeights: NORMAL,
  },
  {
    id: 'aml',
    name: 'Acute myeloid leukemia',
    weight: 3,
    cellularity: { min: 30, max: 100, step: 10 },
    blasts: { min: 30, max: 90, step: 10 },
    stageWeights: AML_REST,
  },
  {
    id: 'cml',
    name: 'Chronic myeloid leukemia',
    weight: 2,
    cellularity: { min: 80, max: 100, step: 10 },
    stageWeights: CML,
  },
  {
    id: 'aplastic',
    name: 'Aplastic anemia',
    weight: 1,
    cellularity: { min: 10, max: 20, step: 10 },
    stageWeights: NORMAL,
  },
]

/** Age of the patient for scenarios that don't tie it to cellularity. */
export const PATIENT_AGE: Range = { min: 20, max: 80, step: 10 }

/** Tappable cells on screen, from the sparsest to the most crowded marrow. */
export const MIN_CELLS = 8
export const MAX_CELLS = 20
/**
 * Share of the screen covered by fat at 0 % cellularity; fat shrinks as cellularity rises. Round fat
 * cells can't tile the plane, so ~0.6 is about as full as they get.
 */
export const MAX_FAT_COVERAGE = 0.6
/** At least this many cells start short of neutrophil, so a biopsy never begins finished. */
export const MIN_UNFINISHED = 3
