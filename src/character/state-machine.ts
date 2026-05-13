export type CharMode = 'idle' | 'walk'

export interface CharState {
  mode: CharMode
  x: number              // pixel position
  facing: 1 | -1         // 1 = right, -1 = left
  pauseUntilMs: number   // monotonic timestamp; idle ends when now >= pauseUntilMs
  speed: number          // px per ms (0.05 ≈ 50 px/sec, "散步" 节奏)
}

export interface TickInput {
  now: number            // monotonic ms (performance.now())
  dt: number             // ms since last tick
  leftBound: number      // walking floor left edge
  rightBound: number     // walking floor right edge
}

export function initialState(): CharState {
  return {
    mode: 'idle',
    x: 0,
    facing: 1,
    pauseUntilMs: 0,
    speed: 0.05,
  }
}

export function tick(state: CharState, input: TickInput): CharState {
  if (state.mode === 'idle') {
    if (input.now >= state.pauseUntilMs) {
      return { ...state, mode: 'walk' }
    }
    return state
  }

  // mode === 'walk'
  const nextX = state.x + state.facing * state.speed * input.dt

  if (state.facing === 1 && nextX >= input.rightBound) {
    return {
      ...state,
      mode: 'idle',
      x: input.rightBound,
      facing: -1,
      pauseUntilMs: input.now + randomPauseMs(),
    }
  }
  if (state.facing === -1 && nextX <= input.leftBound) {
    return {
      ...state,
      mode: 'idle',
      x: input.leftBound,
      facing: 1,
      pauseUntilMs: input.now + randomPauseMs(),
    }
  }

  return { ...state, x: nextX }
}

function randomPauseMs(): number {
  // 0.5–14s 随机停顿，避免规律性
  return 500 + Math.random() * 13_500
}
