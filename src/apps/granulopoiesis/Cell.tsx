import type { CSSProperties } from 'react'
import type { Mode } from './speed'
import { LAST_STAGE, MAX_SIZE, STAGES } from './stages'

export interface CellState {
  stage: number
  /** The stage shown before the latest tap; the crossfade runs from it to `stage`. */
  prev: number
  /** Bumped on every tap; used as a key so the animation restarts immediately. */
  tap: number
}

interface Props {
  x: number
  y: number
  d: number
  index: number
  /** Changes on reset so the opening stage label shows again. */
  epoch: number
  mode: Mode
  /** Length of the stage transition; the name label swaps from old to new around its midpoint. */
  durMs: number
  state: CellState
  celebrate: boolean
  onTap: () => void
}

/** Deterministic pseudo-random value in [0, 1) for a cell and a slot, so each cell keeps its own look. */
function rnd(index: number, slot: number) {
  const v = Math.sin(index * 12.9898 + slot * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/** Time the new name stays up after the swap. */
const LABEL_HOLD_MS = 1700
/** Transitions shorter than this are too quick to show the old and new names one after the other. */
const LABEL_SEQUENCE_MIN_MS = 500
/** Point in the crossfade where the new cell overtakes the old one, so the name swaps with it. */
const CROSSFADE_SWAP = 0.6

export function Cell({ x, y, d, index, epoch, mode, durMs, state, celebrate, onTap }: Props) {
  const identify = mode === 'identify'
  const to = STAGES[state.stage]
  const from = STAGES[state.prev]
  const advanced = state.prev !== state.stage
  // The old name shows first, then the new one as the cell changes. An instant change has no time
  // for that, so it shows "old → new" at once and the text is never out of step with the cell.
  const sequence = advanced && durMs >= LABEL_SEQUENCE_MIN_MS
  const swapMs = sequence ? durMs * CROSSFADE_SWAP : 0
  const px = (size: number) => (d * size) / MAX_SIZE

  // Three wandering waypoints in any direction, plus a slight sway.
  const reach = d * 0.06
  const drift: Record<string, string> = {}
  for (let k = 0; k < 3; k++) {
    drift[`--x${k}`] = `${((rnd(index, k * 3) - 0.5) * 2 * reach).toFixed(1)}px`
    drift[`--y${k}`] = `${((rnd(index, k * 3 + 1) - 0.5) * 2 * reach).toFixed(1)}px`
    drift[`--a${k}`] = `${((rnd(index, k * 3 + 2) - 0.5) * 12).toFixed(1)}deg`
  }

  const style = {
    left: x - d / 2,
    top: y - d / 2,
    width: d,
    height: d,
    ...drift,
    '--float-delay': `${-rnd(index, 20) * 10}s`,
    '--float-time': `${8 + rnd(index, 21) * 6}s`,
    '--celebrate-delay': `${index * 70}ms`,
    '--label-delay': `${state.tap === 0 ? index * 60 : 0}ms`,
    '--swap': `${swapMs}ms`,
    '--lead': sequence ? '120ms' : '0ms',
    '--hold': `${LABEL_HOLD_MS}ms`,
    '--total': `${swapMs + LABEL_HOLD_MS}ms`,
    '--label-size': `${Math.max(13, Math.min(20, d * 0.13))}px`,
  } as CSSProperties

  // Identify keeps the name hidden until the cell is tapped; the other mode shows each stage's name.
  const showLabel = identify ? state.tap > 0 : state.tap === 0 || advanced

  return (
    <button
      className={`cell${celebrate ? ' celebrate' : ''}`}
      style={style}
      aria-label={to.label}
      // Pointer-down rather than click: no tap delay, and fast repeated taps are never swallowed.
      onPointerDown={(e) => {
        e.preventDefault()
        onTap()
      }}
    >
      <span className="cell-float">
        <span
          key={state.tap}
          className={`cell-pop${state.tap > 0 ? (!identify && state.stage === LAST_STAGE && !advanced ? ' wiggle' : ' pop') : ''}`}
        >
          <span className="cell-rot" style={{ rotate: `${Math.round(rnd(index, 30) * 360)}deg` }}>
            {advanced && (
              <img
                className="cell-img morph-out"
                src={from.src}
                alt=""
                draggable={false}
                style={
                  {
                    width: px(from.size),
                    height: px(from.size),
                    '--k': to.size / from.size,
                  } as CSSProperties
                }
              />
            )}
            <img
              className={`cell-img${advanced ? ' morph-in' : ''}`}
              src={to.src}
              alt=""
              draggable={false}
              style={
                {
                  width: px(to.size),
                  height: px(to.size),
                  '--k': from.size / to.size,
                } as CSSProperties
              }
            />
          </span>
        </span>
        {identify && state.tap > 0 && (
          <span className="found-ring" style={{ width: px(to.size) + 14, height: px(to.size) + 14 }} />
        )}
        {celebrate && <span className="ring" />}
      </span>
      {showLabel && (
        <span key={`${epoch}-${state.tap}`} className="cell-label">
          {sequence && <span className="lbl-from">{from.label}</span>}
          <span className="lbl-to">{advanced && !sequence ? `${from.label} → ${to.label}` : to.label}</span>
        </span>
      )}
    </button>
  )
}
