import { describe, it, expect } from 'vitest'
import { pickProactive, shouldFire } from '../electron/proactive'

describe('pickProactive', () => {
  it('picks the message whose hour range contains the given hour', () => {
    expect(pickProactive(7)?.text).toContain('早上好')
    expect(pickProactive(13)?.text).toContain('午饭')
    expect(pickProactive(21)?.text).toContain('晚上')
    expect(pickProactive(2)?.text).toContain('凌晨')
  })
  it('every hour 0..23 maps to exactly one message', () => {
    for (let h = 0; h < 24; h++) expect(pickProactive(h)).not.toBeNull()
  })
})

describe('shouldFire', () => {
  it('false if disabled', () => {
    expect(shouldFire(false, 0, 999999999)).toBe(false)
  })
  it('false before the interval elapses', () => {
    expect(shouldFire(true, 1000, 1000 + 60_000)).toBe(false)
  })
  it('true once at least 90 min since last fire', () => {
    expect(shouldFire(true, 0, 90 * 60_000)).toBe(true)
    expect(shouldFire(true, 0, 90 * 60_000 + 1)).toBe(true)
  })
})
