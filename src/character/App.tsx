import { useEffect, useRef, useState } from 'react'
import { initialState, tick, CharState, beginHeld, updateHeld, releaseHeld, tapCling } from './state-machine'
import { fallStep } from './physics'
import spriteUrl from '../../assets/sprites/jpt-walk.png'

interface WalkBounds {
  leftBound: number
  rightBound: number
  floorY: number
}

const GRAVITY = 0.0024
const DRAG_THRESHOLD_PX = 5
const CLING_SNAP_PX = 30

export function App() {
  const [state, setState] = useState<CharState>(() => initialState())
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const boundsRef = useRef<WalkBounds | null>(null)

  // Drag tracking
  const dragRef = useRef({ down: false, downX: 0, downY: 0, movedPast: false })

  // Bounds query on mount
  useEffect(() => {
    let mounted = true
    window.jpt.invoke<WalkBounds>('character:get-walk-bounds').then((b) => {
      if (!mounted) return
      boundsRef.current = b
      setState((s) => ({ ...s, x: b.leftBound, y: b.floorY }))
    })
    return () => { mounted = false }
  }, [])

  // Mouse handlers — window receives all clicks (v1 skips pixel-level click-through)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.down) return
      const dx = e.screenX - dragRef.current.downX
      const dy = e.screenY - dragRef.current.downY
      if (!dragRef.current.movedPast && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        dragRef.current.movedPast = true
        setState((cur) => beginHeld(cur, performance.now()))
      }
      if (dragRef.current.movedPast) {
        const newX = e.screenX - 48
        const newY = e.screenY - 64
        setState((cur) => updateHeld(cur, newX, newY))
        window.jpt.send('character:set-position', newX, newY)
      }
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      dragRef.current = { down: true, downX: e.screenX, downY: e.screenY, movedPast: false }
    }
    const onMouseUp = () => {
      const wasDrag = dragRef.current.movedPast
      dragRef.current = { down: false, downX: 0, downY: 0, movedPast: false }
      if (wasDrag) {
        const bounds = boundsRef.current
        if (!bounds) return
        setState((cur) => releaseHeld(cur, performance.now(), bounds.rightBound, CLING_SNAP_PX))
      } else {
        const cur = stateRef.current
        if (cur.mode === 'cling') {
          const bounds = boundsRef.current
          if (bounds) setState(tapCling(cur, performance.now(), bounds.floorY))
        } else {
          window.jpt.send('character:click')
        }
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // rAF tick loop — drives walk + fall integration + IPC position updates.
  // Updater form so it composes with bounds-fetch's setState without races.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const bounds = boundsRef.current
      if (!bounds) {
        raf = requestAnimationFrame(loop)
        return
      }
      let positionToSend: { x: number; y: number } | null = null
      setState((cur) => {
        let next = cur
        if (cur.mode === 'fall') {
          const r = fallStep({
            startX: cur.fallStartX,
            startY: cur.fallStartY,
            startMs: cur.fallStartMs,
            vx: cur.fallVx,
            gravity: GRAVITY,
            floorY: bounds.floorY,
          }, now)
          next = { ...cur, x: r.x, y: r.y }
          if (r.landed) {
            next = { ...next, mode: 'idle', y: bounds.floorY, pauseUntilMs: now + 300, squashUntilMs: now + 200 }
          }
        } else {
          next = tick(cur, {
            now, dt,
            leftBound: bounds.leftBound, rightBound: bounds.rightBound,
            floorY: bounds.floorY, rightWall: bounds.rightBound,
          })
        }
        if (next !== cur) {
          positionToSend = { x: next.x, y: next.y }
          return next
        }
        return cur
      })
      if (positionToSend) {
        window.jpt.send('character:set-position', (positionToSend as { x: number; y: number }).x, (positionToSend as { x: number; y: number }).y)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Visual transform
  const isClinging = state.mode === 'cling'
  const squashActive = state.squashUntilMs > performance.now()
  const transform = [
    `scaleX(${state.facing})`,
    isClinging ? 'rotate(90deg)' : '',
    squashActive ? 'scale(1.4, 0.6)' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      style={{
        width: 96,
        height: 128,
        background: 'red',
        transform,
        transformOrigin: 'center',
        userSelect: 'none',
        cursor: 'pointer',
      }}
    >
      <img
        src={spriteUrl}
        alt="JPT"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  )
}
