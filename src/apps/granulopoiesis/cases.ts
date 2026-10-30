import { parseCsv } from '../../csv'
import vignettesCsv from './data/marrow_vignettes.csv?raw'
import scenariosCsv from './data/marrow_scenarios.csv?raw'
import type { Range } from './rng'
import type { Scenario, Vignette } from './scenarios'

const STAGE_COLUMNS = ['blast_wt', 'promyelo_wt', 'myelo_wt', 'metamyelo_wt', 'band_wt', 'neutrophil_wt']
const SCENARIO_REQUIRED = [
  'scenario_id',
  'display_name',
  'draw_weight',
  'age_min',
  'age_max',
  'cellularity_min_pct',
  'cellularity_max_pct',
  'cellularity_step',
  ...STAGE_COLUMNS,
]
const VIGNETTE_REQUIRED = ['vignette_id', 'scenario_id', 'clinical_vignette_template', 'morphology_cue_template']

export interface CaseLibrary {
  scenarios: Scenario[]
  vignettes: Vignette[]
  /** Everything wrong with the data. Bad rows are dropped and listed here, never silently kept. */
  problems: string[]
}

const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? NaN : Number(s))
const isTrue = (s: string | undefined) => /^(true|yes|1|y)$/i.test((s ?? '').trim())

function missingColumns(rows: Record<string, string>[], required: string[], file: string, problems: string[]) {
  const have = new Set(Object.keys(rows[0] ?? {}))
  const missing = required.filter((c) => !have.has(c))
  if (missing.length) problems.push(`${file}: missing column(s) ${missing.join(', ')}`)
  return missing.length > 0
}

/** Turn the two CSV texts into validated scenarios and vignettes. Pure, so it is easy to test. */
export function loadCases(scenariosText: string, vignettesText: string): CaseLibrary {
  const problems: string[] = []
  const scenarios: Scenario[] = []
  const vignettes: Vignette[] = []

  const sRows = parseCsv(scenariosText)
  if (!missingColumns(sRows, SCENARIO_REQUIRED, 'marrow_scenarios.csv', problems)) {
    const seen = new Set<string>()
    sRows.forEach((r, i) => {
      const where = `marrow_scenarios.csv row ${i + 2} (${r.scenario_id || 'no id'})`
      const bad = (msg: string) => problems.push(`${where}: ${msg}; row skipped`)
      const id = r.scenario_id
      if (!id) return bad('scenario_id is empty')
      if (seen.has(id)) return bad('duplicate scenario_id')
      const weight = num(r.draw_weight)
      const age: Range = { min: num(r.age_min), max: num(r.age_max), step: 1 }
      const cellularity: Range = {
        min: num(r.cellularity_min_pct),
        max: num(r.cellularity_max_pct),
        step: num(r.cellularity_step),
      }
      const stageWeights = STAGE_COLUMNS.map((c) => num(r[c]))
      if (!(weight >= 0)) return bad('draw_weight must be a number ≥ 0')
      if (!(age.min >= 0 && age.max >= age.min && age.max <= 120)) return bad('age_min/age_max must satisfy 0 ≤ min ≤ max ≤ 120')
      if (!(cellularity.min >= 0 && cellularity.max >= cellularity.min && cellularity.max <= 100))
        return bad('cellularity min/max must satisfy 0 ≤ min ≤ max ≤ 100')
      if (!(cellularity.step > 0)) return bad('cellularity_step must be > 0')
      if (stageWeights.some((w) => !(w >= 0))) return bad('stage weights must be numbers ≥ 0')
      let blasts: Range | undefined
      if (r.blast_pct_min || r.blast_pct_max) {
        blasts = { min: num(r.blast_pct_min), max: num(r.blast_pct_max), step: num(r.blast_pct_step) || 10 }
        if (!(blasts.min >= 0 && blasts.max >= blasts.min && blasts.max <= 100)) return bad('blast_pct_min/max must satisfy 0 ≤ min ≤ max ≤ 100')
      }
      const needed = blasts ? stageWeights.slice(1) : stageWeights
      if (!(needed.reduce((a, b) => a + b, 0) > 0)) return bad('stage weights are all zero')
      seen.add(id)
      scenarios.push({
        id,
        name: r.display_name || id,
        weight,
        age,
        cellularity,
        cellularityFromAge: isTrue(r.cellularity_from_age),
        blasts,
        stageWeights,
        keyMorphology: r.key_morphology ?? '',
        caveat: r.caveat ?? '',
      })
    })
  }

  const vRows = parseCsv(vignettesText)
  if (!missingColumns(vRows, VIGNETTE_REQUIRED, 'marrow_vignettes.csv', problems)) {
    const known = new Set(scenarios.map((s) => s.id))
    const seen = new Set<string>()
    vRows.forEach((r, i) => {
      const where = `marrow_vignettes.csv row ${i + 2} (${r.vignette_id || 'no id'})`
      const bad = (msg: string) => problems.push(`${where}: ${msg}; row skipped`)
      if (!r.vignette_id) return bad('vignette_id is empty')
      if (seen.has(r.vignette_id)) return bad('duplicate vignette_id')
      if (!known.has(r.scenario_id)) return bad(`scenario_id "${r.scenario_id}" does not exist in marrow_scenarios.csv`)
      if (!r.clinical_vignette_template) return bad('clinical_vignette_template is empty')
      const ageMin = r.age_min_override ? num(r.age_min_override) : undefined
      const ageMax = r.age_max_override ? num(r.age_max_override) : undefined
      if ((ageMin !== undefined && !(ageMin >= 0)) || (ageMax !== undefined && !(ageMax >= 0)))
        return bad('age overrides must be numbers ≥ 0')
      if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) return bad('age_min_override is above age_max_override')
      for (const t of [r.clinical_vignette_template, r.morphology_cue_template]) {
        for (const [, name] of t.matchAll(/\{(\w+)\}/g)) {
          if (name !== 'age') problems.push(`${where}: unknown placeholder {${name}} (only {age} is supported)`)
        }
      }
      if (!r.clinical_vignette_template.includes('{age}')) problems.push(`${where}: history has no {age} placeholder (allowed, but unusual)`)
      seen.add(r.vignette_id)
      vignettes.push({
        id: r.vignette_id,
        scenarioId: r.scenario_id,
        ageMin,
        ageMax,
        history: r.clinical_vignette_template,
        morphologyCue: r.morphology_cue_template ?? '',
        note: r.editor_note ?? '',
      })
    })
  }

  for (const s of scenarios) {
    if (!vignettes.some((v) => v.scenarioId === s.id)) problems.push(`scenario "${s.id}" has no vignettes; its cases will have a generic history`)
  }
  if (!scenarios.some((s) => s.weight > 0)) problems.push('no scenario has a draw_weight above 0')
  return { scenarios, vignettes, problems }
}

const library = loadCases(scenariosCsv, vignettesCsv)
for (const p of library.problems) console.warn(`[case library] ${p}`)
if (!library.scenarios.some((s) => s.weight > 0)) {
  throw new Error(`The case library has no usable scenarios:\n${library.problems.join('\n')}`)
}

export const SCENARIOS = library.scenarios
export const VIGNETTES = library.vignettes
export const CASE_PROBLEMS = library.problems
