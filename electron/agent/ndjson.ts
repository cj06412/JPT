/**
 * Stateful line buffer for NDJSON streams.
 *
 * Claude CLI emits one JSON object per line on stdout. Our `child_process`
 * 'data' events arrive as arbitrary chunks (sometimes mid-line). This buffer
 * accumulates partial lines until a newline arrives, then parses each
 * complete line as JSON.
 *
 * Mirrors the `lineBuffer` + `processOutput` pattern in lil-agents'
 * ClaudeSession.swift:159-168.
 */
export class NdjsonBuffer {
  private buf = ''

  append(chunk: string): unknown[] {
    this.buf += chunk
    const out: unknown[] = []
    let nl: number
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).trim()
      this.buf = this.buf.slice(nl + 1)
      if (line.length === 0) continue
      out.push(JSON.parse(line))
    }
    return out
  }
}
