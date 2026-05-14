import * as fs from 'node:fs'
import * as path from 'node:path'

export interface HistoryEntry {
  ts: number             // unix ms
  role: 'user' | 'assistant' | 'error' | 'toolUse' | 'toolResult'
  text?: string
  tool?: string
  summary?: string
  isError?: boolean
}

/**
 * Daily-rotating append-only JSONL history. Each day's events go to
 * <baseDir>/history/YYYY-MM-DD.jsonl. Failures are swallowed and logged —
 * history is best-effort; we never want history I/O to break the chat.
 */
export class HistoryStore {
  private dir: string

  constructor(baseDir: string) {
    this.dir = path.join(baseDir, 'history')
    fs.mkdirSync(this.dir, { recursive: true })
  }

  append(entry: HistoryEntry): void {
    try {
      const date = new Date(entry.ts)
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      const file = path.join(this.dir, `${yyyy}-${mm}-${dd}.jsonl`)
      fs.appendFileSync(file, JSON.stringify(entry) + '\n', 'utf-8')
    } catch (e) {
      console.error('[JPT] history append failed:', e instanceof Error ? e.message : e)
    }
  }
}
