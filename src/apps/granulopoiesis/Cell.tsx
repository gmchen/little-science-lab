import type { CSSProperties } from 'react'
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
  state: CellState
  celebrate: boolean
  onTap: () => void
}

export function Cell({ x, y, d, index, state, celebrate, onTap }: Props) {
  const to = STAGES[state.stage]
  const from = STAGES[state.prev]
  const advanced = state.prev !== state.stage
  const px = (size: number) => (d * size) / MAX_SIZE

  const style = {
    left: x - d / 2,
    top: y - d / 2,
    width: d,
    height: d,
    '--float-delay': `${-((index * 1.7) % 6)}s`,
    '--float-time': `${4.5 + ((index * 0.7) % 2.5)}s`,
    '--celebrate-delay': `${index * 70}ms`,
  } as CSSProperties

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
          className={`cell-pop${state.tap > 0 ? (state.stage === LAST_STAGE && !advanced ? ' wiggle' : ' pop') : ''}`}
        >
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
        {celebrate && <span className="ring" />}
      </span>
    </button>
  )
}
