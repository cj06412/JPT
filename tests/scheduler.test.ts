import { describe, expect, it } from 'vitest'
import { ACTIVE_FRAME_MS, nextLoopSchedule } from '../src/character/scheduler'

describe('nextLoopSchedule', () => {
  it('sleeps idle until the next walk window and resets dt clock', () => {
    expect(nextLoopSchedule({
      mode: 'idle',
      now: 1_000,
      pauseUntilMs: 11_000,
      squashUntilMs: 0,
    })).toEqual({ delayMs: 10_016, resetClock: true })
  })

  it('keeps landing-squash idle on the active frame cadence', () => {
    expect(nextLoopSchedule({
      mode: 'idle',
      now: 1_000,
      pauseUntilMs: 11_000,
      squashUntilMs: 1_500,
    })).toEqual({ delayMs: ACTIVE_FRAME_MS, resetClock: false })
  })

  it('limits moving modes to the active frame cadence without resetting dt', () => {
    expect(nextLoopSchedule({
      mode: 'walk',
      now: 1_000,
      pauseUntilMs: 2_000,
      squashUntilMs: 0,
    })).toEqual({ delayMs: ACTIVE_FRAME_MS, resetClock: false })
  })
})
