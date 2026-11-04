import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityProps } from '../registry'
import { Cell, type CellState } from './Cell'
import { CaseScreen } from './CaseScreen'
import { Differential, Objective, activeStage, type StageDone } from './Differential'
import { generateBiopsy, newSeed, type Biopsy } from './biopsy'
import { makeLayout } from './layout'
import { Marrow } from './Marrow'
import { LAST_STAGE, STAGES } from './stages'
import { SPEEDS, type Mode, type SpeedId, useIntroSetting, useModeSetting, useSpeed } from './speed'
import { ParentPanel } from './ParentPanel'
import './granulopoiesis.css'

const fresh = (stage: number): CellState => ({ stage, prev: stage, tap: 0, counted: false })

const COUNTER_LABEL: Record<Mode, string> = {
  count: 'Counted',
  identify: 'Identified',
  differentiate: 'Neutrophils',
}

/** How long the banner celebrates a finished cell type before the next one is asked for. */
const STAGE_DONE_MS = 1000

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

/**
 * The diagnosis and what to notice, written the way a hematopathology report would. It describes the
 * biopsy as it started and stays put while the cells are being matured.
 */
function Report({
  biopsy,
  progress,
  count,
  mode,
  onInfo,
}: {
  biopsy: Biopsy
  progress: number
  count: number
  mode: Mode
  onInfo: () => void
}) {
  return (
    <header className="report">
      <div className="report-top">
        <span className="report-title">Bone marrow, core biopsy</span>
        <span className="report-right">
          <span className="report-count">
            {COUNTER_LABEL[mode]}: {progress} / {count}
          </span>
          <button className="report-info" aria-label="Read the clinical history of this case again" onClick={onInfo}>
            <span aria-hidden="true">ⓘ</span> <span className="info-text">Read the case again</span>
          </button>
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
      {biopsy.cue && <div className="report-cue">{biopsy.cue}</div>}
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
  const [introOn, setIntroOn] = useIntroSetting()
  const [mode, setModeSetting] = useModeSetting()
  const [panelOpen, setPanelOpen] = useState(false)
  // Set for a moment when every cell of the current type has been found.
  const [stageDone, setStageDone] = useState<StageDone | null>(null)
  const [nudge, setNudge] = useState<{ stage: number | undefined; n: number }>({ stage: undefined, n: 0 })
  // Bumped when the marrow is first shown for a biopsy, so the report and the stage labels play then.
  const [epoch, setEpoch] = useState(0)
  const owner = useRef<Biopsy | null>(null)
  // The clinical history is on screen until the marrow is examined (or reopened with the info button).
  const [caseOpen, setCaseOpen] = useState(introOn)
  const unseen = useRef(true)

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

  const tap = (i: number) => {
    // A tap on the wrong kind of cell in Count bobs the objective picture to point back at the target.
    const c = cells[i]
    const current = activeStage(cells)
    // A tap during the celebration ends it at once and counts as usual against the next type.
    if (stageDone) setStageDone(null)
    if (mode === 'count' && c && !c.counted) {
      if (c.stage !== current) {
        setNudge((p) => ({ stage: current, n: p.n + 1 }))
      } else if (!cells.some((x) => x !== c && !x.counted && x.stage === current)) {
        // That was the last cell of this type; celebrate unless it also finishes the whole marrow.
        if (cells.some((x) => !x.counted && x !== c)) {
          setStageDone({ stage: current, total: cells.filter((x) => x.stage === current).length })
        }
      }
    }
    setCells((old) =>
      old.map((c, j) => {
        if (j !== i) return c
        // Identify keeps the cell as it is and just counts the tap (which shows its name).
        if (mode === 'identify') return { ...c, prev: c.stage, tap: c.tap + 1 }
        // Count tallies the cell only when it is the stage being counted; any other tap shows its name.
        if (mode === 'count') return { ...c, prev: c.stage, tap: c.tap + 1, counted: c.counted || c.stage === activeStage(old) }
        const stage = Math.min(c.stage + 1, LAST_STAGE)
        // A tap during an animation jumps straight to the next stage and restarts the transition.
        return { ...c, stage, prev: c.stage, tap: c.tap + 1 }
      }),
    )
  }

  /** Move on to the marrow. The first time for a biopsy, this also starts the report and labels. */
  useEffect(() => {
    if (!stageDone) return
    const t = window.setTimeout(() => setStageDone(null), STAGE_DONE_MS)
    return () => window.clearTimeout(t)
  }, [stageDone])

  const examine = () => {
    setCaseOpen(false)
    if (unseen.current) {
      unseen.current = false
      setEpoch((e) => e + 1)
    }
  }

  /** Start a biopsy from `next`; the same seed replays the current one from the beginning. */
  const start = (next: number) => {
    if (next === seed) setCells(biopsy.stages.slice(0, cells.length).map(fresh))
    else setSeed(next)
    setPanelOpen(false)
    setStageDone(null)
    unseen.current = true
    if (introOn) {
      setCaseOpen(true)
    } else {
      unseen.current = false
      setEpoch((e) => e + 1)
    }
  }

  /** Switching games starts the current biopsy over, so the marrow always begins as it was drawn. */
  const switchMode = (next: Mode) => {
    if (next === mode) return
    setModeSetting(next)
    setCells(biopsy.stages.slice(0, cells.length).map(fresh))
    setEpoch((e) => e + 1)
    setPanelOpen(false)
    setStageDone(null)
  }

  const count = cells.length
  // Count tallies cells; Identify counts cells tapped at least once; Differentiate counts neutrophils.
  const progress =
    mode === 'count'
      ? cells.filter((c) => c.counted).length
      : mode === 'identify'
        ? cells.filter((c) => c.tap > 0).length
        : cells.filter((c) => c.stage === LAST_STAGE).length
  const done = count > 0 && progress === count

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
      <Report
        key={epoch}
        biopsy={biopsy}
        progress={progress}
        count={count}
        mode={mode}
        onInfo={() => setCaseOpen(true)}
      />
      {mode === 'count' && cells.length > 0 && (
        <Objective cells={cells} nudge={nudge.stage === activeStage(cells) ? nudge.n : 0} flash={stageDone} />
      )}
      <div className="work">
        <div className="stage" ref={stageRef}>
          {layout && <Marrow layout={layout} w={w} h={h} />}
          {layout &&
            layout.cells.map((p, i) =>
              cells[i] ? (
                <Cell
                  key={i}
                  index={i}
                  epoch={epoch}
                  mode={mode}
                  x={p.x}
                  y={p.y}
                  d={layout.d}
                  durMs={durMs}
                  state={cells[i]}
                  celebrate={done}
                  target={
                    mode === 'count' && cells.length && !stageDone ? STAGES[activeStage(cells) ?? 0].label : undefined
                  }
                  onTap={() => tap(i)}
                />
              ) : null,
            )}
          {done && againReady && (
            <button className="next-case" aria-label="Next case" onClick={() => start(newSeed())}>
              Next case <span className="next-case-arrow">→</span>
            </button>
          )}
        </div>
        {mode === 'count' && cells.length > 0 && <Differential cells={cells} flashStage={stageDone?.stage} />}
      </div>
      <ParentPanel
        open={panelOpen}
        onOpen={() => setPanelOpen(true)}
        onClose={() => setPanelOpen(false)}
        speed={speed}
        onSpeed={setSpeed}
        seed={seed}
        onStart={start}
        onNew={() => start(newSeed())}
        introOn={introOn}
        onIntro={setIntroOn}
        mode={mode}
        onMode={switchMode}
        onExit={onExit}
      />
      {caseOpen && <CaseScreen biopsy={biopsy} onBegin={examine} />}
    </div>
  )
}
