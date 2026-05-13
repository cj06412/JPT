import { useEffect, useRef, useState } from 'react'
import { initialState, tick, CharState } from './state-machine'

interface WalkBounds {
  leftBound: number
  rightBound: number
  floorY: number
}

export function App() {
  const [state, setState] = useState<CharState>(() => initialState())
  const stateRef = useRef(state)
  const boundsRef = useRef<WalkBounds | null>(null)
  stateRef.current = state

  useEffect(() => {
    let mounted = true
    window.jpt
      .invoke<WalkBounds>('character:get-walk-bounds')
      .then((b) => {
        if (!mounted) return
        boundsRef.current = b
        // Initialize x at left edge
        setState((s) => ({ ...s, x: b.leftBound }))
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const bounds = boundsRef.current
      if (bounds) {
        const next = tick(stateRef.current, {
          now,
          dt,
          leftBound: bounds.leftBound,
          rightBound: bounds.rightBound,
        })
        if (next !== stateRef.current) {
          setState(next)
          window.jpt.send('character:set-position', next.x, bounds.floorY)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        width: 96,
        height: 128,
        background: 'red',
        transform: `scaleX(${state.facing})`,
        transformOrigin: 'center',
        cursor: 'pointer',
      }}
      onClick={() => window.jpt.send('character:click')}
    />
  )
}
