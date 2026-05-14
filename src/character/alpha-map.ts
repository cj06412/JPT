/**
 * Pure helpers for sprite alpha-mask sampling.
 *
 * Used by character/App.tsx to decide whether the cursor is over a solid
 * pixel (toggle off click-through) or a transparent pixel (toggle on).
 * Mirrors lil-agents' alpha threshold (30/255) — see
 * https://github.com/ryanstephen/lil-agents/blob/main/LilAgents/CharacterContentView.swift
 */

export interface AlphaMap {
  width: number
  height: number
  solid: Uint8Array      // length = width * height; 1 = solid, 0 = transparent
}

export function buildAlphaMap(img: ImageData, threshold: number): AlphaMap {
  const { width, height, data } = img
  const solid = new Uint8Array(width * height)
  for (let i = 0; i < solid.length; i++) {
    // RGBA layout: alpha is at offset 3 within each 4-byte pixel
    solid[i] = data[i * 4 + 3] > threshold ? 1 : 0
  }
  return { width, height, solid }
}

export function sampleAlpha(map: AlphaMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false
  return map.solid[y * map.width + x] === 1
}

/**
 * Sample the alpha map using window-relative coordinates.
 *
 * The sprite PNG may be sized differently from the on-screen render — placeholder
 * is 96×128 (1:1), real art will likely be 24×32 source rendered at 4× = 96×128.
 * This helper scales window coords into sprite-native coords so the same caller
 * works regardless of the underlying art's native resolution.
 */
export function sampleAlphaScaled(
  map: AlphaMap,
  windowX: number,
  windowY: number,
  windowW: number,
  windowH: number,
): boolean {
  const sx = Math.floor(windowX * map.width / windowW)
  const sy = Math.floor(windowY * map.height / windowH)
  return sampleAlpha(map, sx, sy)
}
