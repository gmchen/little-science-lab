import { useRef } from 'react'
import { SPEEDS, type SpeedId } from './speed'

const HOLD_MS = 800

interface Props {
  open: boolean
  onOpen: () => void
  onClose: () => void
  speed: SpeedId
  onSpeed: (s: SpeedId) => void
  onReset: () => void
  onExit: () => void
}

/** Settings live behind a press-and-hold so a toddler's taps can't reach them. */
export function ParentPanel({ open, onOpen, onClose, speed, onSpeed, onReset, onExit }: Props) {
  const timer = useRef<number>(0)
  const cancel = () => window.clearTimeout(timer.current)

  return (
    <>
      <button
        className="gear"
        aria-label="Settings (press and hold)"
        onPointerDown={() => {
          cancel()
          timer.current = window.setTimeout(onOpen, HOLD_MS)
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
            <div className="row">
              <button onClick={onReset}>Reset marrow</button>
              <button onClick={onExit}>Exit</button>
              <button onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
