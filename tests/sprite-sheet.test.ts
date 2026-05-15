import { describe, it, expect } from 'vitest'
import { spriteFrame } from '../src/character/sprite-sheet'

describe('spriteFrame', () => {
  it('idle breathes between 2 stand frames every 900ms', () => {
    expect(spriteFrame('idle', 0)).toEqual({ set: 'stand', index: 0 })
    expect(spriteFrame('idle', 899)).toEqual({ set: 'stand', index: 0 })
    expect(spriteFrame('idle', 900)).toEqual({ set: 'stand', index: 1 })
    expect(spriteFrame('idle', 1799)).toEqual({ set: 'stand', index: 1 })
    expect(spriteFrame('idle', 1800)).toEqual({ set: 'stand', index: 0 })
  })

  it('walk cycles 4 frames every 120ms (480ms full cycle)', () => {
    expect(spriteFrame('walk', 0)).toEqual({ set: 'walk', index: 0 })
    expect(spriteFrame('walk', 119)).toEqual({ set: 'walk', index: 0 })
    expect(spriteFrame('walk', 120)).toEqual({ set: 'walk', index: 1 })
    expect(spriteFrame('walk', 240)).toEqual({ set: 'walk', index: 2 })
    expect(spriteFrame('walk', 360)).toEqual({ set: 'walk', index: 3 })
    expect(spriteFrame('walk', 480)).toEqual({ set: 'walk', index: 0 })
    expect(spriteFrame('walk', 600)).toEqual({ set: 'walk', index: 1 })
  })

  it('cling / held / fall show the static stand frame 0', () => {
    expect(spriteFrame('cling', 12345)).toEqual({ set: 'stand', index: 0 })
    expect(spriteFrame('held', 12345)).toEqual({ set: 'stand', index: 0 })
    expect(spriteFrame('fall', 12345)).toEqual({ set: 'stand', index: 0 })
  })
})
