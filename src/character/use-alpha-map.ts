import { useEffect, useState } from 'react'
import { AlphaMap, buildAlphaMap } from './alpha-map'

const ALPHA_THRESHOLD = 30 // mirrors lil-agents' CharacterContentView.swift

/**
 * Load a sprite PNG, draw it onto an offscreen canvas, read pixels, build alpha map.
 * Returns null until the PNG has loaded. URL is whatever Vite resolves the import to —
 * pass a static string like '/src/character/jpt-walk.png' or use a runtime URL.
 */
export function useAlphaMap(url: string): AlphaMap | null {
  const [map, setMap] = useState<AlphaMap | null>(null)
  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setMap(buildAlphaMap(data, ALPHA_THRESHOLD))
    }
    img.onerror = () => {
      // PNG missing or corrupt — keep map=null so the renderer falls back to bbox-clickable.
      console.error(`[JPT] failed to load sprite for alpha map: ${url}`)
    }
    img.src = url
    return () => { cancelled = true }
  }, [url])
  return map
}
