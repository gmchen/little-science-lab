import type { Biopsy } from './biopsy'

/**
 * The clinical vignette shown before the marrow is examined. The diagnosis is deliberately left out;
 * it appears with the marrow. Only the button continues, so a stray tap can't skip the history.
 */
export function CaseScreen({ biopsy, onBegin }: { biopsy: Biopsy; onBegin: () => void }) {
  return (
    <div className="case">
      <div className="case-card">
        <div className="case-kicker">Case #{biopsy.seed} · Clinical history</div>
        <p className="case-text">{biopsy.history}</p>
        <button
          className="case-go"
          onClick={onBegin}
        >
          Examine bone marrow
        </button>
      </div>
    </div>
  )
}
