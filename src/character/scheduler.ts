import type { CharMode } from './state-machine'

// Transparent software-composited windows are expensive to move. 30fps is
// smooth enough for a desktop pet and halves the IPC/setBounds churn vs rAF.
export const ACTIVE_FRAME_MS = 33

export interface LoopScheduleInput {
  mode: CharMode
  now: number
  pauseUntilMs: number
  squashUntilMs: number
}

export interface LoopSchedule {
  delayMs: number
  resetClock: boolean
}

export function nextLoopSchedule(input: LoopScheduleInput): LoopSchedule {
  const stableIdle = input.mode === 'idle' && !(input.squashUntilMs > input.now)
  if (stableIdle) {
    return {
      delayMs: Math.max(0, input.pauseUntilMs - input.now) + 16,
      resetClock: true,
    }
  }
  return { delayMs: ACTIVE_FRAME_MS, resetClock: false }
}
