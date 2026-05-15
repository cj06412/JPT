import completeUrl from '../../assets/sounds/complete.mp3?url'
import clickUrl from '../../assets/sounds/click.mp3?url'
import typeUrl from '../../assets/sounds/type.mp3?url'

const URLS = { complete: completeUrl, click: clickUrl, type: typeUrl } as const
export type SoundName = keyof typeof URLS

let enabled = true
export function setSoundsEnabled(on: boolean) { enabled = on }

const cache: Partial<Record<SoundName, HTMLAudioElement>> = {}

export function playSound(name: SoundName) {
  if (!enabled) return
  let a = cache[name]
  if (!a) {
    a = new Audio(URLS[name])
    a.volume = 0.4
    cache[name] = a
  }
  // Restart even if mid-play (rapid type sounds).
  a.currentTime = 0
  a.play().catch(() => { /* autoplay/format errors are non-fatal */ })
}
