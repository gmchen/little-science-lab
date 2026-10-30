import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityProps } from '../registry'
import { Cell, type CellState } from './Cell'
import { makeLayout } from './layout'
import { Marrow } from './Marrow'
import { LAST_STAGE, STAGES } from './stages'
import { SPEEDS, type SpeedId, useSpeed } from './speed'
import { ParentPanel } from './ParentPanel'
import './granulopoiesis.css'

const fresh = (n: number): CellState[] => Array.from({ length: n }, () => ({ stage: 0, prev: 0, tap: 0 }))

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

export function GranulopoiesisApp({ onExit }: ActivityProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(stageRef)
  const layout = useMemo(() => (w && h ? makeLayout(w, h) : null), [w, h])
  const [cells, setCells] = useState<CellState[]>([])
  const [speed, setSpeed] = useSpeed()
  const [panelOpen, setPanelOpen] = useState(false)
  const [epoch, setEpoch] = useState(0)

  // Keep each cell's progress when the screen is resized or rotated and the layout changes.
  const count = layout?.cells.length ?? 0
  useEffect(() => {
    setCells((old) => (old.length === count ? old : [...old, ...fresh(count)].slice(0, count)))
  }, [count])

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

  const reset = () => {
    setCells(fresh(count))
    setEpoch((e) => e + 1)
    setPanelOpen(false)
  }

  const neutrophils = cells.filter((c) => c.stage === LAST_STAGE).length
  const done = count > 0 && neutrophils === count

  return (
    <div
      className="granulo"
      style={{ '--dur': `${SPEEDS[speed as SpeedId].ms}ms` } as React.CSSProperties}
    >
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
                state={cells[i]}
                celebrate={done}
                onTap={() => tap(i)}
              />
            ) : null,
          )}
      </div>
      <div className="counter">
        Neutrophils: {neutrophils} / {count}
      </div>
      {done && (
        <button className="again" aria-label="Start again" onClick={reset}>
          ↻
        </button>
      )}
      <ParentPanel
        open={panelOpen}
        onOpen={() => setPanelOpen(true)}
        onClose={() => setPanelOpen(false)}
        speed={speed}
        onSpeed={setSpeed}
        onReset={reset}
        onExit={onExit}
      />
    </div>
  )
}
