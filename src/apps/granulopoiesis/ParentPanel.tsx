import { useRef, useState } from 'react'
import { useOfflineStatus, type OfflineStatus } from '../../offline'
import { SPEEDS, type Mode, type SpeedId } from './speed'

const OFFLINE_TEXT: Record<OfflineStatus, string> = {
  checking: 'Checking offline copy…',
  ready: '✓ Ready to use offline',
  'not-ready': 'Not saved for offline yet. Stay online and reopen the app.',
  unsupported: 'Offline mode is not available in this browser.',
}

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
  introOn: boolean
  onIntro: (on: boolean) => void
  mode: Mode
  onMode: (m: Mode) => void
  onExit: () => void
}

/** Settings live behind a press-and-hold so a toddler's taps can't reach them. */
export function ParentPanel({ open, onOpen, onClose, speed, onSpeed, seed, onStart, onNew, introOn, onIntro, mode, onMode, onExit }: Props) {
  const timer = useRef<number>(0)
  const cancel = () => window.clearTimeout(timer.current)
  const [typed, setTyped] = useState('')
  const offline = useOfflineStatus()

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
            <h2>Game</h2>
            <div className="row">
              <button className={mode === 'identify' ? 'on' : ''} onClick={() => onMode('identify')}>
                Identify cells
              </button>
              <button className={mode === 'differentiate' ? 'on' : ''} onClick={() => onMode('differentiate')}>
                Differentiate cells
              </button>
            </div>
            <h2>Transformation speed (Differentiate)</h2>
            <div className="row">
              {(Object.keys(SPEEDS) as SpeedId[]).map((id) => (
                <button key={id} className={id === speed ? 'on' : ''} onClick={() => onSpeed(id)}>
                  {SPEEDS[id].label}
                </button>
              ))}
            </div>
            <h2>Case introduction</h2>
            <div className="row">
              <button className={introOn ? 'on' : ''} onClick={() => onIntro(true)}>
                Show clinical vignette
              </button>
              <button className={introOn ? '' : 'on'} onClick={() => onIntro(false)}>
                Skip to the marrow
              </button>
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
            <h2>Offline</h2>
            <p className="offline-status">{OFFLINE_TEXT[offline]}</p>
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
