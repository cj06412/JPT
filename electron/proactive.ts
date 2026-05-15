import { PROACTIVE_MESSAGES, ProactiveMsg } from '../src/shared/proactive-messages'

const MIN_INTERVAL_MS = 90 * 60_000 // 90 minutes between proactive nudges

/** Message for a given local hour (0-23). First range match wins. */
export function pickProactive(hour: number): ProactiveMsg | null {
  for (const m of PROACTIVE_MESSAGES) {
    if (hour >= m.fromHour && hour < m.toHour) return m
  }
  return null
}

/** Whether a proactive message is due. `nowMs` / `lastFireMs` are epoch ms. */
export function shouldFire(enabled: boolean, lastFireMs: number, nowMs: number): boolean {
  if (!enabled) return false
  return nowMs - lastFireMs >= MIN_INTERVAL_MS
}
