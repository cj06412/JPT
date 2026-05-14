import { describe, it, expect } from 'vitest'
import { buildAlphaMap, sampleAlpha, sampleAlphaScaled } from '../src/character/alpha-map'

describe('buildAlphaMap', () => {
  // helper: build a 4-pixel ImageData where:
  //   (0,0) fully opaque, (1,0) fully transparent
  //   (0,1) half opaque (alpha=128), (1,1) just-above-threshold (alpha=31)
  function imageDataFromAlphas(width: number, height: number, alphas: number[]): ImageData {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < alphas.length; i++) {
      data[i * 4 + 0] = 0
      data[i * 4 + 1] = 0
      data[i * 4 + 2] = 0
      data[i * 4 + 3] = alphas[i]
    }
    return { data, width, height, colorSpace: 'srgb' } as unknown as ImageData
  }

  it('marks pixels above threshold as solid (1)', () => {
    const img = imageDataFromAlphas(2, 2, [255, 0, 128, 31])
    const map = buildAlphaMap(img, /*threshold*/ 30)
    expect(map.width).toBe(2)
    expect(map.height).toBe(2)
    expect(map.solid).toEqual(new Uint8Array([1, 0, 1, 1]))
  })

  it('threshold is strict greater-than', () => {
    const img = imageDataFromAlphas(2, 1, [30, 31])
    const map = buildAlphaMap(img, 30)
    expect(map.solid[0]).toBe(0)
    expect(map.solid[1]).toBe(1)
  })
})

describe('sampleAlpha', () => {
  const map = {
    width: 4,
    height: 4,
    solid: new Uint8Array([
      0, 0, 0, 0,
      0, 1, 1, 0,
      0, 1, 1, 0,
      0, 0, 0, 0,
    ]),
  }

  it('returns false for out-of-bounds coordinates', () => {
    expect(sampleAlpha(map, -1, 0)).toBe(false)
    expect(sampleAlpha(map, 0, 99)).toBe(false)
    expect(sampleAlpha(map, 4, 0)).toBe(false)
  })

  it('returns true inside the solid 2x2 center', () => {
    expect(sampleAlpha(map, 1, 1)).toBe(true)
    expect(sampleAlpha(map, 2, 2)).toBe(true)
  })

  it('returns false in the transparent border', () => {
    expect(sampleAlpha(map, 0, 0)).toBe(false)
    expect(sampleAlpha(map, 3, 3)).toBe(false)
  })
})

describe('sampleAlphaScaled', () => {
  const map = {
    width: 2, height: 2,
    solid: new Uint8Array([1, 0, 0, 1]),
  }

  it('1:1 scaling matches sampleAlpha', () => {
    expect(sampleAlphaScaled(map, 0, 0, 2, 2)).toBe(true)
    expect(sampleAlphaScaled(map, 1, 0, 2, 2)).toBe(false)
  })

  it('4x scaling maps 96-wide window to 24-wide sprite', () => {
    // A 2x2 sprite rendered at 4x = 8×8 window. Window (0,0)→sprite (0,0)=solid.
    // Window (4,0)→sprite (1,0)=transparent. Window (4,4)→sprite (1,1)=solid.
    const big = { width: 2, height: 2, solid: new Uint8Array([1, 0, 0, 1]) }
    expect(sampleAlphaScaled(big, 0, 0, 8, 8)).toBe(true)
    expect(sampleAlphaScaled(big, 4, 0, 8, 8)).toBe(false)
    expect(sampleAlphaScaled(big, 4, 4, 8, 8)).toBe(true)
    expect(sampleAlphaScaled(big, 7, 7, 8, 8)).toBe(true)
  })
})
