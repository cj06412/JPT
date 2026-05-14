import { describe, it, expect } from 'vitest'
import { fallStep, FallParams } from '../src/character/physics'

describe('fallStep', () => {
  const base: FallParams = {
    startX: 500,
    startY: 200,
    startMs: 1000,
    vx: 0,
    gravity: 0.0024,   // px/ms^2 — tuned for ~60Hz feel
    floorY: 800,
  }

  it('at t=0 returns start position, not landed', () => {
    const r = fallStep(base, /*now*/ 1000)
    expect(r.x).toBe(500)
    expect(r.y).toBe(200)
    expect(r.landed).toBe(false)
  })

  it('falls vertically when vx is 0', () => {
    const r = fallStep(base, 1100) // 100ms elapsed
    expect(r.x).toBe(500)
    expect(r.y).toBeGreaterThan(200)
    expect(r.y).toBeLessThan(800)
  })

  it('horizontal velocity advances x linearly', () => {
    const r = fallStep({ ...base, vx: 0.5 }, 1100) // 100ms * 0.5 = +50 px
    expect(r.x).toBeCloseTo(550, 1)
  })

  it('y is clamped at floorY and landed flag set', () => {
    const r = fallStep(base, 9999) // way past landing
    expect(r.y).toBe(800)
    expect(r.landed).toBe(true)
  })

  it('lands roughly when y=floorY using kinematic equation', () => {
    // y(t) = startY + (1/2) * g * t^2; solve for t when y = floorY
    // t = sqrt(2 * (floorY - startY) / g) = sqrt(2 * 600 / 0.0024) = sqrt(500000) ≈ 707.1ms
    // use ceil (708) so rawY just exceeds floorY and landed is true
    const r = fallStep(base, 1000 + 708)
    expect(r.landed).toBe(true)
    expect(r.y).toBe(800)
  })
})
