import { describe, it, expect } from 'vitest'
import {
  tick, initialState, CharState,
  beginHeld, updateHeld, releaseHeld, tapCling,
  IDLE_MS, WALK_MS,
} from '../src/character/state-machine'

describe('state-machine', () => {
  it('starts in idle facing right', () => {
    const s = initialState()
    expect(s.mode).toBe('idle')
    expect(s.facing).toBe(1)
  })

  it('idle with unset timer (pauseUntilMs 0) arms a 10s stand window, does not walk yet', () => {
    const s = initialState() // pauseUntilMs === 0
    const out = tick(s, { now: 5000, dt: 16, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(out.mode).toBe('idle')
    expect(out.pauseUntilMs).toBe(5000 + IDLE_MS)
  })

  it('idle transitions to walk after the 10s stand window expires, arming a 5s walk window', () => {
    const s0 = { ...initialState(), pauseUntilMs: 100 }
    const s1 = tick(s0, { now: 50, dt: 16, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(s1.mode).toBe('idle')
    const s2 = tick(s0, { now: 150, dt: 16, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(s2.mode).toBe('walk')
    expect(s2.pauseUntilMs).toBe(150 + WALK_MS)
  })

  it('walk returns to idle after the 5s walk window elapses, arming a 10s stand window', () => {
    const s: CharState = { ...initialState(), mode: 'walk', x: 500, facing: 1, pauseUntilMs: 1000 }
    const out = tick(s, { now: 1000, dt: 16, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(out.mode).toBe('idle')
    expect(out.pauseUntilMs).toBe(1000 + IDLE_MS)
  })

  it('walk advances x by speed * dt in facing direction (within the walk window)', () => {
    const s: CharState = {
      mode: 'walk',
      x: 100,
      y: 0,
      facing: 1,
      pauseUntilMs: 10_000_000, // walk window far in the future
      speed: 0.05, // px per ms
      fallStartMs: 0,
      fallStartX: 0,
      fallStartY: 0,
      fallVx: 0,
      squashUntilMs: 0,
    }
    const next = tick(s, { now: 1000, dt: 100, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(next.x).toBeCloseTo(105, 5)
    expect(next.mode).toBe('walk')
  })

  it('walk reverses facing at right bound but keeps walking (does not idle early)', () => {
    const s: CharState = {
      mode: 'walk',
      x: 990,
      y: 0,
      facing: 1,
      pauseUntilMs: 10_000_000,
      speed: 0.05,
      fallStartMs: 0,
      fallStartX: 0,
      fallStartY: 0,
      fallVx: 0,
      squashUntilMs: 0,
    }
    const next = tick(s, { now: 1000, dt: 1000, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(next.facing).toBe(-1)
    expect(next.mode).toBe('walk')
    expect(next.x).toBe(1000)
  })

  it('walk reverses facing at left bound but keeps walking', () => {
    const s: CharState = {
      mode: 'walk',
      x: 10,
      y: 0,
      facing: -1,
      pauseUntilMs: 10_000_000,
      speed: 0.05,
      fallStartMs: 0,
      fallStartX: 0,
      fallStartY: 0,
      fallVx: 0,
      squashUntilMs: 0,
    }
    const next = tick(s, { now: 1000, dt: 1000, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(next.facing).toBe(1)
    expect(next.mode).toBe('walk')
    expect(next.x).toBe(0)
  })

  it('beginHeld switches to held mode', () => {
    const s = { ...initialState(), x: 100, y: 200 }
    const out = beginHeld(s, 500)
    expect(out.mode).toBe('held')
    expect(out.pauseUntilMs).toBe(500)
  })

  it('updateHeld follows cursor only in held mode', () => {
    const s: CharState = { ...initialState(), mode: 'held', x: 100, y: 200 }
    const out = updateHeld(s, 300, 400)
    expect(out.x).toBe(300)
    expect(out.y).toBe(400)
  })

  it('updateHeld is a no-op outside held mode', () => {
    const s: CharState = { ...initialState(), mode: 'walk', x: 100, y: 200 }
    expect(updateHeld(s, 999, 999)).toBe(s)
  })

  it('releaseHeld within snap distance snaps to cling', () => {
    const s: CharState = { ...initialState(), mode: 'held', x: 1080, y: 500 }
    const out = releaseHeld(s, 1000, /*rightWall*/ 1100, /*snapPx*/ 30)
    expect(out.mode).toBe('cling')
    expect(out.x).toBe(1100)
    expect(out.facing).toBe(-1)
  })

  it('releaseHeld outside snap distance enters fall', () => {
    const s: CharState = { ...initialState(), mode: 'held', x: 500, y: 200 }
    const out = releaseHeld(s, 1000, /*rightWall*/ 1100, /*snapPx*/ 30)
    expect(out.mode).toBe('fall')
    expect(out.fallStartMs).toBe(1000)
    expect(out.fallStartX).toBe(500)
    expect(out.fallStartY).toBe(200)
  })

  it('tapCling exits cling and returns to idle on floor', () => {
    const s: CharState = { ...initialState(), mode: 'cling', x: 1100, y: 0 }
    const out = tapCling(s, 2000, /*floorY*/ 800)
    expect(out.mode).toBe('idle')
    expect(out.y).toBe(800)
    expect(out.pauseUntilMs).toBeGreaterThan(2000)
  })

  it('tick is a no-op in held mode', () => {
    const s: CharState = { ...initialState(), mode: 'held', x: 100 }
    const out = tick(s, { now: 1, dt: 1, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(out).toBe(s)
  })

  it('tick is a no-op in cling mode', () => {
    const s: CharState = { ...initialState(), mode: 'cling', x: 1000 }
    const out = tick(s, { now: 1, dt: 1, leftBound: 0, rightBound: 1000, floorY: 800, rightWall: 1000 })
    expect(out).toBe(s)
  })
})
