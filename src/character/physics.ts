/**
 * Pure-function parabolic fall.
 *
 * Released character undergoes constant horizontal velocity + gravity-pulled
 * vertical motion until y reaches `floorY`, at which point landed = true.
 * Used by character/App.tsx in the rAF loop while state.mode === 'fall'.
 */

export interface FallParams {
  startX: number
  startY: number
  startMs: number       // monotonic ms when fall began
  vx: number            // px/ms (horizontal velocity, kept constant)
  gravity: number       // px/ms^2 — try 0.0024 for SDV-ish weight
  floorY: number        // y coord at which the character is considered landed
}

export interface FallResult {
  x: number
  y: number
  landed: boolean
}

export function fallStep(p: FallParams, now: number): FallResult {
  const t = Math.max(0, now - p.startMs)
  const x = p.startX + p.vx * t
  // y(t) = startY + (1/2) * g * t^2
  const rawY = p.startY + 0.5 * p.gravity * t * t
  if (rawY >= p.floorY) {
    return { x, y: p.floorY, landed: true }
  }
  return { x, y: rawY, landed: false }
}
