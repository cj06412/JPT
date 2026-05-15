import type { CharMode } from './state-machine'

export const FRAME_COUNT = 4
export const FRAME_MS = 120

/**
 * Which sprite-sheet frame (0..3) to show. Only `walk` cycles; every other
 * mode is the static frame 0. `nowMs` is any monotonic clock (performance.now).
 */
export function walkFrame(mode: CharMode, nowMs: number): number {
  if (mode !== 'walk') return 0
  return Math.floor(nowMs / FRAME_MS) % FRAME_COUNT
}
