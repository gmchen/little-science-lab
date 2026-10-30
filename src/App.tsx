import { useState } from 'react'
import { ACTIVITIES } from './apps/registry'

// With a single activity the hub is skipped, so a toddler can't wander out of it.
export function App() {
  const [activeId, setActiveId] = useState<string | null>(
    ACTIVITIES.length === 1 ? ACTIVITIES[0].id : null,
  )
  const active = ACTIVITIES.find((a) => a.id === activeId)

  if (active) {
    return <active.Component onExit={() => setActiveId(null)} />
  }

  return (
    <main className="hub">
      {ACTIVITIES.map((a) => (
        <button key={a.id} className="hub-tile" onClick={() => setActiveId(a.id)}>
          {a.title}
        </button>
      ))}
    </main>
  )
}
