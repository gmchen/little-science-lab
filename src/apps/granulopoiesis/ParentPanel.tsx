import { useRef, useState } from 'react'
import { SPEEDS, type SpeedId } from './speed'

const HOLD_MS = 800

interface Props {
  open: boolean
  onOpen: () => void
  onClose: () => void
  speed: SpeedId
  onSpeed: (s: SpeedId) => void
  seed: number
  /** Start the biopsy with this seed; the current seed replays it. */
  onStart: (seed: number) => void
  onNew: () => void
  onExit: () => void
}

/** Settings live behind a press-and-hold so a toddler's taps can't reach them. */
export function ParentPanel({ open, onOpen, onClose, speed, onSpeed, seed, onStart, onNew, onExit }: Props) {
  const timer = useRef<number>(0)
  const cancel = () => window.clearTimeout(timer.current)
  const [typed, setTyped] = useState('')

  return (
    <>
      <button
        className="gear"
        aria-label="Settings (press and hold)"
        onPointerDown={() => {
          cancel()
          timer.current = window.setTimeout(() => {
            setTyped(String(seed))
            onOpen()
          }, HOLD_MS)
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
      >
        ⚙
      </button>
      {open && (
        <div className="panel-backdrop" onPointerDown={onClose}>
          <div className="panel" onPointerDown={(e) => e.stopPropagation()}>
            <h2>Transformation speed</h2>
            <div className="row">
              {(Object.keys(SPEEDS) as SpeedId[]).map((id) => (
                <button key={id} className={id === speed ? 'on' : ''} onClick={() => onSpeed(id)}>
                  {SPEEDS[id].label}
                </button>
              ))}
            </div>
            <h2>Biopsy #{seed}</h2>
            <div className="row">
              <button onClick={onNew}>New biopsy</button>
              <button onClick={() => onStart(seed)}>Replay this one</button>
            </div>
            <div className="row">
              <input
                className="seed-input"
                inputMode="numeric"
                value={typed}
                aria-label="Biopsy number"
                onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 9))}
              />
              <button disabled={!typed} onClick={() => onStart(Number(typed))}>
                Go to #
              </button>
            </div>
            <div className="row">
              <button onClick={onExit}>Exit</button>
              <button onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
