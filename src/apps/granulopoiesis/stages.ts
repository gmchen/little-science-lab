import blast from './cells/myeloblast.svg'
import promyelocyte from './cells/promyelocyte.svg'
import myelocyte from './cells/myelocyte.svg'
import metamyelocyte from './cells/metamyelocyte.svg'
import band from './cells/band.svg'
import neutrophil from './cells/neutrophil.svg'

export interface Stage {
  label: string
  src: string
  /**
   * Typical cell diameter in micrometers (mid-range of published smear values:
   * Taylor & Doty clinical hematology atlas, histologyguide.com). The promyelocyte is the largest.
   */
  size: number
}

export const STAGES: Stage[] = [
  { label: 'Blast', src: blast, size: 16 },
  { label: 'Promyelocyte', src: promyelocyte, size: 19 },
  { label: 'Myelocyte', src: myelocyte, size: 15 },
  { label: 'Metamyelocyte', src: metamyelocyte, size: 14 },
  { label: 'Band', src: band, size: 13 },
  { label: 'Neutrophil', src: neutrophil, size: 12 },
]

export const LAST_STAGE = STAGES.length - 1
/** Largest stage diameter; the tap target of every cell is sized to this. */
export const MAX_SIZE = Math.max(...STAGES.map((s) => s.size))
