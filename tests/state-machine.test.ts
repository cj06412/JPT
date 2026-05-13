import { describe, it, expect } from 'vitest'
import { tick, initialState, CharState } from '../src/character/state-machine'

describe('state-machine', () => {
  it('starts in idle facing right', () => {
    const s = initialState()
    expect(s.mode).toBe('idle')
    expect(s.facing).toBe(1)
  })

  it('idle transitions to walk after pause expires', () => {
    const s0 = { ...initialState(), pauseUntilMs: 100 }
    const s1 = tick(s0, { now: 50, dt: 16, leftBound: 0, rightBound: 1000 })
    expect(s1.mode).toBe('idle')
    const s2 = tick(s0, { now: 150, dt: 16, leftBound: 0, rightBound: 1000 })
    expect(s2.mode).toBe('walk')
  })

  it('walk advances x by speed * dt in facing direction', () => {
    const s: CharState = {
      mode: 'walk',
      x: 100,
      facing: 1,
      pauseUntilMs: 0,
      speed: 0.05, // px per ms
    }
    const next = tick(s, { now: 1000, dt: 100, leftBound: 0, rightBound: 1000 })
    expect(next.x).toBeCloseTo(105, 5)
  })

  it('walk reverses facing at right bound', () => {
    const s: CharState = {
      mode: 'walk',
      x: 990,
      facing: 1,
      pauseUntilMs: 0,
      speed: 0.05,
    }
    const next = tick(s, { now: 1000, dt: 1000, leftBound: 0, rightBound: 1000 })
    expect(next.facing).toBe(-1)
    expect(next.mode).toBe('idle')
  })

  it('walk reverses facing at left bound', () => {
    const s: CharState = {
      mode: 'walk',
      x: 10,
      facing: -1,
      pauseUntilMs: 0,
      speed: 0.05,
    }
    const next = tick(s, { now: 1000, dt: 1000, leftBound: 0, rightBound: 1000 })
    expect(next.facing).toBe(1)
    expect(next.mode).toBe('idle')
  })
})
