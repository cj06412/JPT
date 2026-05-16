import { describe, it, expect } from 'vitest'
import { spriteFrame } from '../src/character/sprite-sheet'

describe('spriteFrame', () => {
  it('idle breathes 2 stand frames by time every 900ms, no bob', () => {
    expect(spriteFrame('idle', 0, 0)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
    expect(spriteFrame('idle', 899, 0)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
    expect(spriteFrame('idle', 900, 0)).toEqual({ set: 'stand', index: 1, bobPx: 0 })
    expect(spriteFrame('idle', 1800, 9999)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
  })

  it('walk is a 5-frame cycle by DISTANCE (14px/frame); bob on frames 1 & 3', () => {
    expect(spriteFrame('walk', 0, 0)).toEqual({ set: 'walk', index: 0, bobPx: 0 })
    expect(spriteFrame('walk', 0, 13)).toEqual({ set: 'walk', index: 0, bobPx: 0 })
    expect(spriteFrame('walk', 0, 14)).toEqual({ set: 'walk', index: 1, bobPx: 2 })
    expect(spriteFrame('walk', 0, 28)).toEqual({ set: 'walk', index: 2, bobPx: 0 })
    expect(spriteFrame('walk', 0, 42)).toEqual({ set: 'walk', index: 3, bobPx: 2 })
    expect(spriteFrame('walk', 0, 56)).toEqual({ set: 'walk', index: 4, bobPx: 0 })
    expect(spriteFrame('walk', 0, 70)).toEqual({ set: 'walk', index: 0, bobPx: 0 })
    expect(spriteFrame('walk', 0, 84)).toEqual({ set: 'walk', index: 1, bobPx: 2 })
  })

  it('walk frame is independent of time (no foot-slide): same distance → same frame', () => {
    expect(spriteFrame('walk', 0, 42)).toEqual({ set: 'walk', index: 3, bobPx: 2 })
    expect(spriteFrame('walk', 999999, 42)).toEqual({ set: 'walk', index: 3, bobPx: 2 })
  })

  it('cling / held / fall = static stand frame 0, no bob', () => {
    expect(spriteFrame('cling', 12345, 9999)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
    expect(spriteFrame('held', 12345, 9999)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
    expect(spriteFrame('fall', 12345, 9999)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
  })
})
