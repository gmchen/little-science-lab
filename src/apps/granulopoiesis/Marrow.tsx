import type { MarrowLayout } from './layout'

/** Flat, soft marrow cross-section: trabecular bone at the edges, fat cells in between. */
export function Marrow({ layout, w, h }: { layout: MarrowLayout; w: number; h: number }) {
  return (
    <svg className="marrow" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <rect width={w} height={h} fill="#fbe9dc" />
      {layout.adipocytes.map((a, i) => (
        <g key={i}>
          <circle cx={a.x} cy={a.y} r={a.r} fill="#fffdf9" stroke="#f1d5c9" strokeWidth={4} />
          <path
            d={`M${a.x - a.r * 0.62},${a.y - a.r * 0.35} A${a.r * 0.7},${a.r * 0.7} 0 0 1 ${a.x + a.r * 0.1},${a.y - a.r * 0.7}`}
            fill="none"
            stroke="#f6e6dc"
            strokeWidth={a.r * 0.08}
            strokeLinecap="round"
          />
        </g>
      ))}
      {layout.bone.map((d, i) => (
        <g key={i}>
          <path d={d} fill="#e9a5a8" />
          <path d={d} fill="none" stroke="#f3c6c4" strokeWidth={10} strokeLinejoin="round" opacity={0.7} />
        </g>
      ))}
    </svg>
  )
}
