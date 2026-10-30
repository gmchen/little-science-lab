import type { ComponentType } from 'react'
import { GranulopoiesisApp } from './granulopoiesis/GranulopoiesisApp'

export interface ActivityProps {
  /** Called when a parent asks to leave the activity (the app wraps this in a long-press). */
  onExit: () => void
}

export interface Activity {
  id: string
  title: string
  Component: ComponentType<ActivityProps>
}

// Add the logic gate and Galton board activities here.
export const ACTIVITIES: Activity[] = [
  { id: 'granulopoiesis', title: 'Bone marrow', Component: GranulopoiesisApp },
]
