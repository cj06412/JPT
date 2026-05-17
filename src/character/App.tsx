import { useEffect, useRef, useState } from 'react'
import { initialState, tick, CharState, beginHeld, updateHeld, releaseHeld, tapCling, IDLE_MS } from './state-machine'
import { fallStep } from './physics'
import { spriteFrame } from './sprite-sheet'
import stand1Url from '../../assets/sprites/jpt-stand1.png'
import stand2Url from '../../assets/sprites/jpt-stand2.png'
import walk1Url from '../../assets/sprites/walk1.png'
import walk2Url from '../../assets/sprites/walk2.png'
import walk3Url from '../../assets/sprites/walk3.png'
import walk4Url from '../../assets/sprites/walk4.png'
import walk5Url from '../../assets/sprites/walk5.png'
import hangingUrl from '../../assets/sprites/jpt-hanging.png'
import drop1Url from '../../assets/sprites/droping1.png'
import drop2Url from '../../assets/sprites/droping2.png'
import landingUrl from '../../assets/sprites/landing.png'
import watchingUrl from '../../assets/sprites/watching.png'

const STAND_FRAMES = [stand1Url, stand2Url]
const WALK_FRAMES = [walk1Url, walk2Url, walk3Url, walk4Url, walk5Url]
const DROP_FRAMES = [drop1Url, drop2Url]
// Every frame is mounted at once and toggled by visibility — swapping a single
// <img>'s src between large PNGs faster than the browser can decode them made
// later frames never paint (they reverted before decode finished).
const ALL_FRAMES = [stand1Url, stand2Url, walk1Url, walk2Url, walk3Url, walk4Url, walk5Url, hangingUrl, drop1Url, drop2Url, landingUrl, watchingUrl]

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
  // Cumulative px walked — drives the walk frame by DISTANCE (no foot-slide).
  const walkPxRef = useRef(0)
  // Wakes the rAF loop when it has self-suspended at idle (set by the rAF
  // effect; called from input/dialog handlers so a sleeping pet reacts).
  const kickRef = useRef<() => void>(() => {})

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
      } else {
        // Dialog closed — wake the (suspended) loop so the pet resumes.
        kickRef.current()
      }
    })
    return () => { off() }
  }, [])

  // Idle "breathing" is now a pure CSS keyframe (compositor-driven, ~0 CPU) —
  // see the jpt-breath-a/b animation below. We deliberately do NOT force a
  // 150ms React re-render anymore: that re-rendered the whole transparent
  // always-on-top window 6.7×/s forever, which (under software compositing)
  // pinned ~half a CPU core at idle. The rAF loop only re-renders when state
  // actually changes (walk/fall), so idle now produces zero frames.

  // Bounds query on mount + on multi-screen / taskbar changes
  useEffect(() => {
    let mounted = true
    const fetchBounds = () => {
      window.jpt.invoke<WalkBounds>('character:get-walk-bounds').then((b) => {
        if (!mounted) return
        boundsRef.current = b
        // keep x in range, snap y to new floor
        setState((s) => ({ ...s, x: Math.min(Math.max(s.x, b.leftBound), b.rightBound), y: b.floorY }))
        kickRef.current() // bounds (re)loaded — ensure the loop is running
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
        kickRef.current() // resume the loop to animate the fall / cling
      } else {
        const cur = stateRef.current
        if (cur.mode === 'cling') {
          setState(tapCling(cur, performance.now()))
          kickRef.current() // resume the loop to animate the drop
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
  //
  // PERF: a perpetual requestAnimationFrame keeps the (software-composited,
  // transparent, always-on-top) compositor pipeline running at full frame
  // rate 24/7 even when nothing changes — that pinned ~half a CPU core at
  // idle. So the loop SELF-SUSPENDS once the character is stably idle: it
  // sleeps with a single setTimeout until the idle→walk moment, producing
  // zero frames meanwhile. Input/dialog handlers call kickRef.current() to
  // wake it. Active-drag / dialog-open also suspend (no animation needed).
  useEffect(() => {
    let raf = 0
    let wake: ReturnType<typeof setTimeout> | null = null
    let last = performance.now()
    let stopped = false

    const kick = () => {
      if (wake != null) { clearTimeout(wake); wake = null }
      if (raf === 0 && !stopped) { last = performance.now(); raf = requestAnimationFrame(loop) }
    }

    const loop = (now: number) => {
      raf = 0
      if (stopped) return
      const dt = now - last
      last = now
      // Suspend (no reschedule) while actively dragging — the drag handler
      // owns position then — or while the dialog is open (character frozen,
      // spec §3.1). Resumed by kick() on mouseup / dialog-close.
      if ((dragRef.current.down && dragRef.current.movedPast) || dialogOpenRef.current) {
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
          next = { ...next, mode: 'idle', y: bounds.floorY, pauseUntilMs: now + IDLE_MS, squashUntilMs: now + 1000 }
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
      // Accumulate walked distance so the walk frame advances by travel, not
      // time (kills foot-sliding). Reset when not walking so each walk starts
      // mid-stride-free on frame 0.
      if (next.mode === 'walk') {
        walkPxRef.current += Math.abs(next.x - cur.x)
      } else {
        walkPxRef.current = 0
      }
      if (next !== cur) {
        setState(next)
        window.jpt.send('character:set-position', next.x, next.y)
      }
      // Schedule: keep animating only while something is actually moving.
      // Stable idle (not mid-landing) → sleep until the idle→walk moment.
      const stable = next.mode === 'idle' && !(next.squashUntilMs > now)
      if (stable) {
        // If no state change happened this tick, the visible frame may still
        // be stale (e.g. landing.png after squash expired) — one clean render
        // so the CSS breathing settles in before we sleep.
        if (next === cur) setState((s) => ({ ...s }))
        const delay = Math.max(0, next.pauseUntilMs - now) + 16
        wake = setTimeout(() => { wake = null; last = performance.now(); raf = requestAnimationFrame(loop) }, delay)
      } else {
        raf = requestAnimationFrame(loop)
      }
    }
    kickRef.current = kick
    raf = requestAnimationFrame(loop)
    return () => {
      stopped = true
      if (raf) cancelAnimationFrame(raf)
      if (wake != null) clearTimeout(wake)
      kickRef.current = () => {}
    }
  }, [])

  // Visual transform
  const isClinging = state.mode === 'cling'
  // For 200ms after a fall lands, show the landing.png impact frame. The
  // fall-land handler sets squashUntilMs = now + 200 as that timer. No more
  // scale() squash — the real art shouldn't be distorted.
  const landingActive = state.squashUntilMs > performance.now()
  // Idle breathing: the 2 stand frames cross-swap via a pure CSS keyframe
  // (no React re-render, no JS timer) — see jpt-breath-a/b below.
  const breathing = state.mode === 'idle' && !landingActive
  const transform = [
    `scaleX(${state.facing})`,
    isClinging ? 'rotate(90deg)' : '',
  ].filter(Boolean).join(' ')

  // idle breathes between 2 stand frames (time); walk advances by distance
  // walked (no foot-slide) and bobs up on the passing frame.
  const sf = spriteFrame(state.mode, performance.now(), walkPxRef.current)
  const activeSrc =
    landingActive ? landingUrl
    : sf.set === 'walk' ? WALK_FRAMES[sf.index]
    : sf.set === 'hold' ? hangingUrl
    : sf.set === 'drop' ? DROP_FRAMES[sf.index]
    : sf.set === 'watch' ? watchingUrl
    : STAND_FRAMES[sf.index]
  const animation = state.mode === 'cling' ? 'jpt-sway 1.8s ease-in-out infinite' : 'none'
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
          position: 'relative',
          animation,          // cling sway (none for walk/idle)
          transform: `translateY(${-sf.bobPx}px)`, // SDV-style walk bounce
        }}
      >
        {ALL_FRAMES.map((src) => {
          const isStand = src === stand1Url || src === stand2Url
          // While idle: both stand frames stay visible and a pure-CSS
          // antiphase opacity keyframe swaps them (no re-render). Otherwise:
          // the usual "only the active frame is painted" model.
          const breathImg = breathing && isStand
          return (
            <img
              key={src}
              src={src}
              alt="JPT"
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',      // square source art, never distorted in the 96x128 box
                objectPosition: 'bottom',  // feet planted on the floor, not floating/centered
                imageRendering: 'pixelated',
                // landing.png is rendered bigger (grows up from the feet). Capped
                // by the 96×128 character window — anything past that clips.
                transform: src === landingUrl ? 'scale(1.2)' : undefined,
                transformOrigin: 'bottom center',
                animation: breathImg
                  ? `${src === stand1Url ? 'jpt-breath-a' : 'jpt-breath-b'} 1.8s infinite`
                  : undefined,
                visibility: breathImg ? 'visible' : src === activeSrc ? 'visible' : 'hidden',
              }}
            />
          )
        })}
      </div>
      <style>{`
        @keyframes jpt-sway {
          0%,100% { transform: translateX(0) rotate(0deg); }
          50%     { transform: translateX(1px) rotate(2deg); }
        }
        /* Idle breathing: hard 900ms swap between the 2 stand frames,
           compositor-only (opacity), zero React re-renders. */
        @keyframes jpt-breath-a {
          0%,49.9%   { opacity: 1; }
          50%,100%   { opacity: 0; }
        }
        @keyframes jpt-breath-b {
          0%,49.9%   { opacity: 0; }
          50%,100%   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
