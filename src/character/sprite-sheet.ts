import type { CharMode } from './state-machine'

export const WALK_FRAME_COUNT = 4
export const STAND_FRAME_COUNT = 2
export const WALK_FRAME_MS = 120  // brisk walk cycle (4 frames = 480ms)
export const STAND_FRAME_MS = 900 // calm breathing (2 frames = 1.8s full breath)

export type FrameSet = 'stand' | 'walk'

export interface SpriteFrame {
  set: FrameSet
  index: number
}

/**
 * Which sprite image to show for the given mode at time `nowMs` (any
 * monotonic clock, e.g. performance.now). Frames are SEPARATE image files
 * (jpt-stand1/2, jpt-walk1..4), not a packed sheet:
 *  - walk → 4-frame cycle every 120ms
 *  - idle → 2-frame breathing every 900ms
 *  - cling / held / fall → static stand frame 0
 */
export function spriteFrame(mode: CharMode, nowMs: number): SpriteFrame {
  if (mode === 'walk') {
    return { set: 'walk', index: Math.floor(nowMs / WALK_FRAME_MS) % WALK_FRAME_COUNT }
  }
  if (mode === 'idle') {
    return { set: 'stand', index: Math.floor(nowMs / STAND_FRAME_MS) % STAND_FRAME_COUNT }
  }
  return { set: 'stand', index: 0 }
}
