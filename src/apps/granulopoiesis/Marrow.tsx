import type { MarrowLayout } from './layout'

/** Flat, soft marrow cross-section: trabecular bone at the edges, fat cells in between. */
export function Marrow({ layout, w, h }: { layout: MarrowLayout; w: number; h: number }) {
  return (
    <svg className="marrow" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <rect width={w} height={h} fill="#fbe9dc" />
      {layout.adipocytes.map((a, i) => (
        <g key={i}>
          {/* Thin outline, then the white body; the round-joined strokes are what round the corners. */}
          <path d={a.path} fill="#f1d5c9" stroke="#f1d5c9" strokeWidth={a.round * 2 + 3} strokeLinejoin="round" />
          <path d={a.path} fill="#fffdf9" stroke="#fffdf9" strokeWidth={Math.max(a.round * 2, 0.1)} strokeLinejoin="round" />
          <path
            d={`M${a.x - a.r * 0.62},${a.y - a.r * 0.35} A${a.r * 0.7},${a.r * 0.7} 0 0 1 ${a.x + a.r * 0.1},${a.y - a.r * 0.7}`}
            fill="none"
            stroke="#f6e6dc"
            strokeWidth={a.r * 0.08}
            strokeLinecap="round"
          />
        </g>
      ))}
      {/* The "goo" filter merges overlapping pieces and rounds off the crotch of each fork. */}
      <defs>
        <filter id="bone-goo" filterUnits="userSpaceOnUse" x={0} y={0} width={w} height={h} colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={6} result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" />
        </filter>
      </defs>
      <g filter="url(#bone-goo)">
        {layout.bone.map((d, i) => (
          <path key={i} d={d} fill="#d96fa3" stroke="#d96fa3" strokeWidth={5} strokeLinejoin="round" />
        ))}
      </g>
      <g filter="url(#bone-goo)">
        {layout.bone.map((d, i) => (
          <path key={i} d={d} fill="#ee93bd" />
        ))}
      </g>
      {layout.lacunae.map((l, i) => (
        <ellipse
          key={i}
          cx={l.x}
          cy={l.y}
          rx={l.rx}
          ry={l.ry}
          transform={`rotate(${l.rot.toFixed(0)} ${l.x} ${l.y})`}
          fill="#b8578a"
          opacity={0.35}
        />
      ))}
    </svg>
  )
}
