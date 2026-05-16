import type { CharMode } from './state-machine'

export const WALK_FRAME_COUNT = 5
export const STAND_FRAME_COUNT = 2
export const STAND_FRAME_MS = 900 // calm breathing (2 frames = 1.8s full breath)
export const STRIDE_PX = 14       // walk advances ONE frame per 14px actually travelled
export const WALK_BOB_PX = 2      // body lifts 2px on the bob frames (SDV-style bounce)
// Which walk frame indices (0-based) lift up — the "airborne / passing" poses.
// One-line tweak if the real 5-frame art's lifted frames differ (or [] = off).
export const WALK_BOB_FRAMES = [1, 3]

export type FrameSet = 'stand' | 'walk'

export interface SpriteFrame {
  set: FrameSet
  index: number
  /** vertical lift in px (0 = grounded). Applied as translateY(-bobPx). */
  bobPx: number
}

/**
 * Which sprite image to show, plus its walk-bob lift.
 *  - walk → frame advances by DISTANCE walked (walkPx), not wall-clock time,
 *    so the legs never "skate" regardless of move speed. Passing frame bobs up.
 *  - idle → 2-frame breathing on a 900ms timer (breathing is independent of
 *    movement, so time-based is correct here).
 *  - cling / held / fall → static stand frame 0.
 * `nowMs` is any monotonic clock; `walkPx` is cumulative px travelled while
 * walking (reset to 0 by the caller when not walking).
 */
export function spriteFrame(mode: CharMode, nowMs: number, walkPx: number): SpriteFrame {
  if (mode === 'walk') {
    // 5-frame cycle, advanced by distance. WALK_BOB_FRAMES lift up; the rest
    // stay grounded.
    const index = Math.floor(walkPx / STRIDE_PX) % WALK_FRAME_COUNT
    return { set: 'walk', index, bobPx: WALK_BOB_FRAMES.includes(index) ? WALK_BOB_PX : 0 }
  }
  if (mode === 'idle') {
    return { set: 'stand', index: Math.floor(nowMs / STAND_FRAME_MS) % STAND_FRAME_COUNT, bobPx: 0 }
  }
  return { set: 'stand', index: 0, bobPx: 0 }
}
