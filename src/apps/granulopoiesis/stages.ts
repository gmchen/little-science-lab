import blast from './cells/myeloblast.svg'
import promyelocyte from './cells/promyelocyte.svg'
import myelocyte from './cells/myelocyte.svg'
import metamyelocyte from './cells/metamyelocyte.svg'
import band from './cells/band.svg'
import neutrophil from './cells/neutrophil.svg'

export interface Stage {
  label: string
  src: string
  /** Diameter of the cell in artwork units; relative sizes match the physical toy. */
  size: number
}

export const STAGES: Stage[] = [
  { label: 'Blast', src: blast, size: 384 },
  { label: 'Promyelocyte', src: promyelocyte, size: 384 },
  { label: 'Myelocyte', src: myelocyte, size: 288 },
  { label: 'Metamyelocyte', src: metamyelocyte, size: 288 },
  { label: 'Band', src: band, size: 192 },
  { label: 'Neutrophil', src: neutrophil, size: 192 },
]

export const LAST_STAGE = STAGES.length - 1
/** Largest artwork diameter; the tap target of every cell is sized to this. */
export const MAX_SIZE = 384
