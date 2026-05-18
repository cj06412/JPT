import type { JsonRpcNotification, JsonRpcResponse, JsonValue } from './codex-protocol'

type Pending = {
  resolve: (value: JsonValue) => void
  reject: (error: Error) => void
}

export class CodexJsonRpcPeer {
  private nextId = 1
  private pending = new Map<number, Pending>()

  constructor(
    private writeLine: (line: string) => void,
    private onNotification: (notification: JsonRpcNotification) => void = () => {},
  ) {}

  request<T = JsonValue>(method: string, params: JsonValue): Promise<T> {
    const id = this.nextId++
    const payload = { jsonrpc: '2.0' as const, id, method, params }
    this.writeLine(JSON.stringify(payload) + '\n')
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })
    })
  }

  acceptLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return
    const msg = JSON.parse(trimmed) as JsonRpcResponse | JsonRpcNotification
    if ('id' in msg) {
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      if ('error' in msg && msg.error) {
        pending.reject(new Error(msg.error.message))
      } else {
        pending.resolve((msg as JsonRpcResponse).result ?? null)
      }
      return
    }
    this.onNotification(msg as JsonRpcNotification)
  }

  rejectAll(message: string): void {
    for (const [, pending] of this.pending) pending.reject(new Error(message))
    this.pending.clear()
  }
}
