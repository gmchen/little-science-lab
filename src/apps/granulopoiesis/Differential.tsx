import type { CSSProperties } from 'react'
import type { CellState } from './Cell'
import { MAX_SIZE, STAGES } from './stages'

/** The stage being counted now: the first one, in maturation order, with a cell not yet tallied. */
export function activeStage(cells: CellState[]): number | undefined {
  const s = STAGES.findIndex((_, i) => cells.some((c) => c.stage === i && !c.counted))
  return s < 0 ? undefined : s
}

/** Whole-number percentages that add up to exactly 100 (largest remainder), as on a real differential. */
function percents(totals: number[]): number[] {
  const n = totals.reduce((a, b) => a + b, 0)
  if (!n) return totals.map(() => 0)
  const exact = totals.map((t) => (t * 100) / n)
  const out = exact.map(Math.floor)
  const order = exact.map((e, i) => [e - out[i], i]).sort((a, b) => b[0] - a[0])
  const leftover = 100 - out.reduce((a, b) => a + b, 0)
  for (let k = 0; k < leftover; k++) out[order[k][1]]++
  return out
}

/** A cell type whose cells have all just been found. */
export interface StageDone {
  stage: number
  total: number
}

/** A cell picture drawn at its true size relative to the other stages. */
function StageIcon({ stage, className }: { stage: number; className: string }) {
  const s = STAGES[stage]
  return (
    <span className={className} style={{ '--icon': `${(s.size / MAX_SIZE) * 100}%` } as CSSProperties}>
      <img src={s.src} alt="" draggable={false} />
    </span>
  )
}

/**
 * What to do right now, in large type: the cell to look for, how many there are, and how many are
 * found. `nudge` changes after a wrong tap so the picture bobs to point back at the target.
 */
export function Objective({ cells, nudge, flash }: { cells: CellState[]; nudge: number; flash: StageDone | null }) {
  const active = activeStage(cells)
  // For a moment after the last cell of a type is found, the banner celebrates before moving on.
  if (flash) {
    const name = STAGES[flash.stage].label
    return (
      <div className="objective finished stage-done" key={`done-${flash.stage}`} role="status">
        <span className="obj-burst">
          <span className="obj-check">✓</span>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="spark" style={{ '--a': `${i * 36}deg`, '--i': i } as CSSProperties} />
          ))}
        </span>
        <span className="obj-name">{flash.total === 1 ? `${name} found!` : `All ${flash.total} ${name}s found!`}</span>
      </div>
    )
  }
  if (active === undefined) {
    return (
      <div className="objective finished" role="status">
        <span className="obj-check">✓</span>
        <span className="obj-name">All {cells.length} cells counted</span>
      </div>
    )
  }
  const total = cells.filter((c) => c.stage === active).length
  const found = cells.filter((c) => c.stage === active && c.counted).length
  return (
    // Keyed by stage so the banner slides in again whenever the target changes.
    <div className="objective" key={active} role="status">
      <StageIcon key={nudge} stage={active} className={`obj-icon${nudge ? ' nudge' : ''}`} />
      <span className="obj-text">
        <span className="obj-kicker">Find every</span>
        <span className="obj-name">{STAGES[active].label}</span>
      </span>
      <span className="obj-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`obj-dot${i < found ? ' on' : ''}`} />
        ))}
      </span>
      <span className="obj-count">
        {found} of {total}
      </span>
    </div>
  )
}

/**
 * The differential as it builds: one row per cell type, in order. The bar grows to the type's share of
 * all the cells as it is counted, so a finished marrow reads like a differential report.
 */
export function Differential({ cells, flashStage }: { cells: CellState[]; flashStage?: number }) {
  const totals = STAGES.map((_, i) => cells.filter((c) => c.stage === i).length)
  const counted = STAGES.map((_, i) => cells.filter((c) => c.stage === i && c.counted).length)
  const share = percents(totals)
  const active = activeStage(cells)

  return (
    <aside className="diff" aria-label="Differential count">
      <div className="diff-title">
        Differential <span className="diff-n">n = {cells.length}</span>
      </div>
      <ul className="diff-rows">
        {STAGES.map((s, i) => {
          const state = active === undefined || i < active ? 'done' : i === active ? 'active' : 'todo'
          const fill = state === 'done' ? share[i] : state === 'active' ? (share[i] * counted[i]) / totals[i] : 0
          const value =
            state === 'done' ? (totals[i] ? `${share[i]}%` : 'none') : state === 'active' ? `${counted[i]} / ${totals[i]}` : '–'
          return (
            <li key={s.label} className={`diff-row ${state}${flashStage === i ? ' just-done' : ''}`}>
              <StageIcon stage={i} className="diff-icon" />
              <span className="diff-name">{s.label}</span>
              <span className="diff-bar">
                <span className="diff-fill" style={{ width: `${fill}%` }} />
              </span>
              <span className="diff-tally">{value}</span>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
