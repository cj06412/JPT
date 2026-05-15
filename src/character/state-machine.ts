export type CharMode = 'idle' | 'walk' | 'cling' | 'held' | 'fall'

/** Stand still for 10s, then walk for 5s, repeat (spec: 站 10s 走 5s). */
export const IDLE_MS = 10_000
export const WALK_MS = 5_000

export interface CharState {
  mode: CharMode
  x: number              // pixel position (top-left of window in DIP)
  y: number              // floor y (or held-cursor y, or fall-current y)
  facing: 1 | -1
  pauseUntilMs: number
  speed: number          // px per ms

  // fall physics — only meaningful when mode === 'fall'
  fallStartMs: number    // monotonic ms when fall began
  fallStartX: number     // x at start of fall
  fallStartY: number     // y at start of fall (usually held release point)
  fallVx: number         // initial horizontal velocity (px/ms)

  // landing squash — only meaningful when mode === 'idle' after a fall completes
  squashUntilMs: number  // 0 means no squash active
}

export interface TickInput {
  now: number
  dt: number
  leftBound: number      // walking floor left edge
  rightBound: number     // walking floor right edge
  floorY: number         // y coord of the floor (top edge of character when standing)
  rightWall: number      // typically rightBound; cling snap reference
}

export function initialState(): CharState {
  return {
    mode: 'idle',
    x: 0,
    y: 0,
    facing: 1,
    pauseUntilMs: 0,
    speed: 0.05,
    fallStartMs: 0,
    fallStartX: 0,
    fallStartY: 0,
    fallVx: 0,
    squashUntilMs: 0,
  }
}

export function tick(state: CharState, input: TickInput): CharState {
  // held: caller updates position via updateHeld; tick just keeps state stable
  if (state.mode === 'held') return state

  // cling: stay attached to right wall; v1 keeps it static, v1.5 can add sway
  if (state.mode === 'cling') return state

  // fall: parabola — physics module handles math but we read it here to keep purity local
  // Caller-side physics (Task 2) computes nextX/nextY/landed; tick is just a transition gate.
  // For pure-function clarity we keep the same shape, but the physics update happens in the
  // rAF loop in App.tsx using physics.ts. Here we only handle the "already landed" branch.
  if (state.mode === 'fall') {
    return state
  }

  if (state.mode === 'idle') {
    // Unset timer (fresh start) — arm a 10s stand window without walking yet.
    if (state.pauseUntilMs === 0) {
      return { ...state, pauseUntilMs: input.now + IDLE_MS }
    }
    // Stand window elapsed (and any landing-squash finished) → walk for 5s.
    if (input.now >= state.pauseUntilMs && state.squashUntilMs <= input.now) {
      return { ...state, mode: 'walk', pauseUntilMs: input.now + WALK_MS }
    }
    return state
  }

  // mode === 'walk'
  // Walk window elapsed → stand for 10s.
  if (input.now >= state.pauseUntilMs) {
    return { ...state, mode: 'idle', pauseUntilMs: input.now + IDLE_MS }
  }
  const nextX = state.x + state.facing * state.speed * input.dt
  // Hitting a bound flips facing but keeps walking — the character only stops
  // when the 5s walk window ends, not at the wall.
  if (state.facing === 1 && nextX >= input.rightBound) {
    return { ...state, x: input.rightBound, facing: -1 }
  }
  if (state.facing === -1 && nextX <= input.leftBound) {
    return { ...state, x: input.leftBound, facing: 1 }
  }
  return { ...state, x: nextX }
}

/** Begin held state — call when user starts dragging the character. */
export function beginHeld(state: CharState, now: number): CharState {
  return { ...state, mode: 'held', pauseUntilMs: now }
}

/** Update held position — call on each mousemove during a drag. */
export function updateHeld(state: CharState, x: number, y: number): CharState {
  if (state.mode !== 'held') return state
  return { ...state, x, y }
}

/**
 * Release from held — pick cling (snap to right wall) or fall (parabola back to floor).
 * `rightWall` is the x coordinate at which we consider the character "at" the right edge.
 */
export function releaseHeld(
  state: CharState,
  now: number,
  rightWall: number,
  clingSnapPx: number = 30
): CharState {
  if (state.mode !== 'held') return state
  const nearRightWall = state.x >= rightWall - clingSnapPx
  if (nearRightWall) {
    return { ...state, mode: 'cling', x: rightWall, facing: -1, pauseUntilMs: now }
  }
  return {
    ...state,
    mode: 'fall',
    fallStartMs: now,
    fallStartX: state.x,
    fallStartY: state.y,
    fallVx: 0,
  }
}

/** Tap on a clinging character — re-enter idle on the floor. */
export function tapCling(state: CharState, now: number, floorY: number): CharState {
  if (state.mode !== 'cling') return state
  return {
    ...state,
    mode: 'idle',
    y: floorY,
    pauseUntilMs: now + IDLE_MS,
  }
}
