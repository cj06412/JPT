import { useEffect, useRef, useState } from 'react'
import { initialState, tick, CharState, beginHeld, updateHeld, releaseHeld, tapCling } from './state-machine'
import { fallStep } from './physics'
import { sampleAlphaScaled } from './alpha-map'
import { useAlphaMap } from './use-alpha-map'
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
  stateRef.current = state
  const boundsRef = useRef<WalkBounds | null>(null)

  const alphaMap = useAlphaMap(spriteUrl)
  const alphaMapRef = useRef(alphaMap)
  alphaMapRef.current = alphaMap

  // Drag tracking
  const dragRef = useRef<{ down: boolean; downX: number; downY: number; movedPast: boolean }>({
    down: false, downX: 0, downY: 0, movedPast: false,
  })
  // Window-relative cursor (for sample-on-mousemove); we receive it from main process
  // when the window is in passthrough mode and the OS forwards mousemove.
  const lastPassthroughRef = useRef(true)

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

  // Passthrough toggle helper
  const setPassthrough = (on: boolean) => {
    if (lastPassthroughRef.current === on) return
    lastPassthroughRef.current = on
    window.jpt.send('character:set-passthrough', on)
  }

  // Mouse handlers — only fire when window is non-passthrough OR forwarded
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const map = alphaMapRef.current
      const s = stateRef.current

      // Drag detection
      if (dragRef.current.down) {
        const dx = e.screenX - dragRef.current.downX
        const dy = e.screenY - dragRef.current.downY
        if (!dragRef.current.movedPast && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          dragRef.current.movedPast = true
          setState((cur) => beginHeld(cur, performance.now()))
        }
        if (dragRef.current.movedPast) {
          // window position should track cursor — set state.x/y to screen coords (top-left)
          // and main process will setBounds in the rAF loop.
          setState((cur) => updateHeld(cur, e.screenX - 48 /* half width */, e.screenY - 64 /* half height */))
          return
        }
      }

      // Alpha-mask hit testing (only meaningful while NOT in held/cling/fall)
      if (map && (s.mode === 'idle' || s.mode === 'walk')) {
        // e.clientX/Y are window-relative coords; sampleAlphaScaled handles
        // the source-vs-rendered sprite-size mismatch so we work with both
        // the 96×128 placeholder and the eventual 24×32 source art.
        const solid = sampleAlphaScaled(map, e.clientX, e.clientY, 96, 128)
        setPassthrough(!solid)
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
        // Click (no drag). Read the current mode synchronously via the ref so we
        // can decide WITHOUT calling setState (whose updater fires twice under
        // React 19 + StrictMode and would toggle the dialog open-close-open).
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

  // rAF tick loop — drives walk + fall integration + IPC position updates
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      const bounds = boundsRef.current
      const cur = stateRef.current
      if (bounds) {
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
          setState(next)
          window.jpt.send('character:set-position', next.x, next.y)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Visual transform: cling rotates 90°; landing squash applies vertical squish
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
        background: 'red', // visible fallback if the sprite PNG fails to load
        transform,
        transformOrigin: 'center',
        userSelect: 'none',
        pointerEvents: 'auto',
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
