import { describe, it, expect } from 'vitest'
import { spriteFrame, STRIDE_PX, WALK_FRAME_COUNT, DROP_FRAME_MS } from '../src/character/sprite-sheet'

describe('spriteFrame', () => {
  it('idle breathes 2 stand frames by time every 900ms, no bob', () => {
    expect(spriteFrame('idle', 0, 0)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
    expect(spriteFrame('idle', 899, 0)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
    expect(spriteFrame('idle', 900, 0)).toEqual({ set: 'stand', index: 1, bobPx: 0 })
    expect(spriteFrame('idle', 1800, 9999)).toEqual({ set: 'stand', index: 0, bobPx: 0 })
  })

  it('walk: one frame per STRIDE_PX travelled, cycling all frames; bob on 1 & 3', () => {
    const S = STRIDE_PX
    expect(spriteFrame('walk', 0, 0)).toEqual({ set: 'walk', index: 0, bobPx: 0 })
    expect(spriteFrame('walk', 0, S - 1)).toEqual({ set: 'walk', index: 0, bobPx: 0 })
    expect(spriteFrame('walk', 0, S)).toEqual({ set: 'walk', index: 1, bobPx: 2 })
    expect(spriteFrame('walk', 0, 2 * S)).toEqual({ set: 'walk', index: 2, bobPx: 0 })
    expect(spriteFrame('walk', 0, 3 * S)).toEqual({ set: 'walk', index: 3, bobPx: 2 })
    expect(spriteFrame('walk', 0, 4 * S)).toEqual({ set: 'walk', index: 4, bobPx: 0 })
    expect(spriteFrame('walk', 0, WALK_FRAME_COUNT * S)).toEqual({ set: 'walk', index: 0, bobPx: 0 })
  })

  it('walk frame is independent of time (no foot-slide): same distance → same frame', () => {
    expect(spriteFrame('walk', 0, 3 * STRIDE_PX)).toEqual({ set: 'walk', index: 3, bobPx: 2 })
    expect(spriteFrame('walk', 999999, 3 * STRIDE_PX)).toEqual({ set: 'walk', index: 3, bobPx: 2 })
  })

  it('held = the hanging frame (picked-up pose)', () => {
    expect(spriteFrame('held', 12345, 9999)).toEqual({ set: 'hold', index: 0, bobPx: 0 })
  })

  it('fall = a 2-frame dropping loop cycled by time (DROP_FRAME_MS each)', () => {
    expect(spriteFrame('fall', 0, 9999)).toEqual({ set: 'drop', index: 0, bobPx: 0 })
    expect(spriteFrame('fall', DROP_FRAME_MS - 1, 0)).toEqual({ set: 'drop', index: 0, bobPx: 0 })
    expect(spriteFrame('fall', DROP_FRAME_MS, 0)).toEqual({ set: 'drop', index: 1, bobPx: 0 })
    expect(spriteFrame('fall', 2 * DROP_FRAME_MS, 0)).toEqual({ set: 'drop', index: 0, bobPx: 0 })
    expect(spriteFrame('fall', 3 * DROP_FRAME_MS, 0)).toEqual({ set: 'drop', index: 1, bobPx: 0 })
  })

  it('cling = the watching frame (hanging on the wall)', () => {
    expect(spriteFrame('cling', 12345, 9999)).toEqual({ set: 'watch', index: 0, bobPx: 0 })
  })
})
