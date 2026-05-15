import { describe, it, expect } from 'vitest'
import { walkFrame } from '../src/character/sprite-sheet'

describe('walkFrame', () => {
  it('idle always shows frame 0', () => {
    expect(walkFrame('idle', 0)).toBe(0)
    expect(walkFrame('idle', 999999)).toBe(0)
  })
  it('held / cling / fall show frame 0 (no walk cycle)', () => {
    expect(walkFrame('held', 12345)).toBe(0)
    expect(walkFrame('cling', 12345)).toBe(0)
    expect(walkFrame('fall', 12345)).toBe(0)
  })
  it('walk cycles 0..3 every 120ms each (480ms full cycle)', () => {
    expect(walkFrame('walk', 0)).toBe(0)
    expect(walkFrame('walk', 119)).toBe(0)
    expect(walkFrame('walk', 120)).toBe(1)
    expect(walkFrame('walk', 240)).toBe(2)
    expect(walkFrame('walk', 360)).toBe(3)
    expect(walkFrame('walk', 480)).toBe(0)
    expect(walkFrame('walk', 600)).toBe(1)
  })
})
