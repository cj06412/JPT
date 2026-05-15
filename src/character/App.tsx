import { useEffect, useRef, useState } from 'react'
import { initialState, tick, CharState, beginHeld, updateHeld, releaseHeld, tapCling } from './state-machine'
import { fallStep } from './physics'
import { walkFrame, FRAME_COUNT } from './sprite-sheet'
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

  // Dialog visibility — when dialog is open, freeze the character (spec §3.1)
  const dialogOpenRef = useRef(false)
  useEffect(() => {
    const off = window.jpt.on('character:dialog-visibility', (...args: unknown[]) => {
      const visible = Boolean(args[0])
      dialogOpenRef.current = visible
      if (visible) {
        // Snap to idle on the floor so the character looks stopped, not paused
        // mid-walk. After dialog closes, idle naturally transitions back to walk.
        setState((cur) => ({ ...cur, mode: 'idle', pauseUntilMs: 0, squashUntilMs: 0 }))
      }
    })
    return () => { off() }
  }, [])

  // Bounds query on mount + on multi-screen / taskbar changes
  useEffect(() => {
    let mounted = true
    const fetchBounds = () => {
      window.jpt.invoke<WalkBounds>('character:get-walk-bounds').then((b) => {
        if (!mounted) return
        boundsRef.current = b
        // keep x in range, snap y to new floor
        setState((s) => ({ ...s, x: Math.min(Math.max(s.x, b.leftBound), b.rightBound), y: b.floorY }))
      })
    }
    fetchBounds()
    const off = window.jpt.on('character:bounds-changed', fetchBounds)
    return () => { mounted = false; off() }
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
      // Don't tick while the user is actively dragging — drag handler is the
      // sole owner of state during that period.
      // Also don't tick while the dialog is open — character should freeze
      // (spec §3.1: "进入 dialog open 子状态时角色固定不动直到对话框关闭").
      if ((dragRef.current.down && dragRef.current.movedPast) || dialogOpenRef.current) {
        raf = requestAnimationFrame(loop)
        return
      }
      const bounds = boundsRef.current
      if (!bounds) {
        raf = requestAnimationFrame(loop)
        return
      }
      // Read stateRef synchronously. Compute next. setState(next) value-form
      // — earlier we tried updater-form to fix a y-race, but updaters fire at
      // React commit time AFTER this tick body returns, so any IPC outside
      // the updater never ran. The y-race is now prevented by clamping y to
      // bounds.floorY for all non-fall/held modes inside this loop, so even
      // if stateRef.current.y is stale (e.g. 0 before bounds-fetch commits),
      // the position sent to main is always correct.
      const cur = stateRef.current
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
        // Force y to floor for idle / walk — defends against the stale-stateRef y-race
        if (next.mode === 'idle' || next.mode === 'walk') {
          if (next.y !== bounds.floorY) next = { ...next, y: bounds.floorY }
        }
      }
      if (next !== cur) {
        setState(next)
        window.jpt.send('character:set-position', next.x, next.y)
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

  const frame = walkFrame(state.mode, performance.now())
  const animation =
    state.mode === 'idle' ? 'jpt-breathe 2.6s ease-in-out infinite'
    : state.mode === 'cling' ? 'jpt-sway 1.8s ease-in-out infinite'
    : 'none'
  return (
    <div
      style={{
        width: 96,
        height: 128,
        transform,            // facing flip / cling rotate / squash
        transformOrigin: 'center',
        userSelect: 'none',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'red',
          overflow: 'hidden',
          position: 'relative',
          animation,          // breathe / sway — translate only, no transform clash
        }}
      >
        <img
          src={spriteUrl}
          alt="JPT"
          draggable={false}
          style={{
            position: 'absolute',
            left: `${-frame * 96}px`,
            top: 0,
            width: `${FRAME_COUNT * 96}px`,
            height: 128,
            display: 'block',
            imageRendering: 'pixelated',
          }}
        />
      </div>
      <style>{`
        @keyframes jpt-breathe {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-2px); }
        }
        @keyframes jpt-sway {
          0%,100% { transform: translateX(0) rotate(0deg); }
          50%     { transform: translateX(1px) rotate(2deg); }
        }
      `}</style>
    </div>
  )
}
