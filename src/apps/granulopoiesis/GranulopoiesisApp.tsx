import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityProps } from '../registry'
import { Cell, type CellState } from './Cell'
import { generateBiopsy, newSeed, type Biopsy } from './biopsy'
import { makeLayout } from './layout'
import { Marrow } from './Marrow'
import { LAST_STAGE, STAGES } from './stages'
import { SPEEDS, type SpeedId, useSpeed } from './speed'
import { ParentPanel } from './ParentPanel'
import './granulopoiesis.css'

const fresh = (stage: number): CellState => ({ stage, prev: stage, tap: 0 })

/** The restart button waits this long after the last cell finishes, so a tap can't land on it. */
const AGAIN_DELAY_MS = 1800

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/** The biopsy described the way a hematopathology report would. */
function Report({ biopsy, neutrophils, count }: { biopsy: Biopsy; neutrophils: number; count: number }) {
  return (
    <header className="report">
      <div className="report-top">
        <span className="report-title">Bone marrow, core biopsy</span>
        <span className="report-count">
          Neutrophils: {neutrophils} / {count}
        </span>
      </div>
      <div className="report-dx">
        <span className="report-label">Diagnosis:</span> {biopsy.scenario.name}
      </div>
      <div className="report-meta">
        <span>
          <span className="report-label">Cellularity:</span> {biopsy.cellularity}% ({biopsy.forAge} for age)
        </span>
        {biopsy.blastPercent !== undefined && (
          <span>
            <span className="report-label">Blasts:</span> {biopsy.blastPercent}%
          </span>
        )}
        <span>
          <span className="report-label">Patient age:</span> {biopsy.age}
        </span>
        <span className="report-id">#{biopsy.seed}</span>
      </div>
    </header>
  )
}

export function GranulopoiesisApp({ onExit }: ActivityProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(stageRef)
  const [seed, setSeed] = useState(newSeed)
  const biopsy = useMemo(() => generateBiopsy(seed), [seed])
  const layout = useMemo(() => (w && h ? makeLayout(w, h, biopsy) : null), [w, h, biopsy])
  const [cells, setCells] = useState<CellState[]>([])
  const [speed, setSpeed] = useSpeed()
  const [panelOpen, setPanelOpen] = useState(false)
  // Bumped whenever a biopsy starts, so the report and the stage labels play again.
  const [epoch, setEpoch] = useState(0)
  const owner = useRef<Biopsy | null>(null)

  // Set up the cells for a new biopsy; on a resize or rotation keep each cell's progress.
  useEffect(() => {
    if (!layout) return
    const sameBiopsy = owner.current === biopsy
    owner.current = biopsy
    setCells((old) =>
      layout.cells.map((_, i) => (sameBiopsy && old[i] ? old[i] : fresh(biopsy.stages[i]))),
    )
  }, [layout, biopsy])

  // Decode every stage image up front so the first tap never waits on the network or decoder.
  useEffect(() => {
    STAGES.forEach((s) => {
      const img = new Image()
      img.src = s.src
    })
  }, [])

  const tap = (i: number) =>
    setCells((old) =>
      old.map((c, j) => {
        if (j !== i) return c
        const stage = Math.min(c.stage + 1, LAST_STAGE)
        // A tap during an animation jumps straight to the next stage and restarts the transition.
        return { stage, prev: c.stage, tap: c.tap + 1 }
      }),
    )

  /** Start a biopsy from `next`; the same seed replays the current one from the beginning. */
  const start = (next: number) => {
    if (next === seed) setCells(biopsy.stages.slice(0, cells.length).map(fresh))
    else setSeed(next)
    setEpoch((e) => e + 1)
    setPanelOpen(false)
  }

  const count = cells.length
  const neutrophils = cells.filter((c) => c.stage === LAST_STAGE).length
  const done = count > 0 && neutrophils === count

  const [againReady, setAgainReady] = useState(false)
  useEffect(() => {
    setAgainReady(false)
    if (!done) return
    const t = window.setTimeout(() => setAgainReady(true), AGAIN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [done])

  const durMs = SPEEDS[speed as SpeedId].ms

  return (
    <div className="granulo" style={{ '--dur': `${durMs}ms` } as React.CSSProperties}>
      <Report key={epoch} biopsy={biopsy} neutrophils={neutrophils} count={count} />
      <div className="stage" ref={stageRef}>
        {layout && <Marrow layout={layout} w={w} h={h} />}
        {layout &&
          layout.cells.map((p, i) =>
            cells[i] ? (
              <Cell
                key={i}
                index={i}
                epoch={epoch}
                x={p.x}
                y={p.y}
                d={layout.d}
                durMs={durMs}
                state={cells[i]}
                celebrate={done}
                onTap={() => tap(i)}
              />
            ) : null,
          )}
      </div>
      {done && againReady && (
        <button className="again" aria-label="New biopsy" onClick={() => start(newSeed())}>
          ↻
        </button>
      )}
      <ParentPanel
        open={panelOpen}
        onOpen={() => setPanelOpen(true)}
        onClose={() => setPanelOpen(false)}
        speed={speed}
        onSpeed={setSpeed}
        seed={seed}
        onStart={start}
        onNew={() => start(newSeed())}
        onExit={onExit}
      />
    </div>
  )
}
