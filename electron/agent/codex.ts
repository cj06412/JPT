import { mapCodexNotification } from './codex-event-mapper'
import type { AgentMessage } from '../../src/shared/messages'
import type { AgentSession, AgentSessionCallbacks } from './session'

export interface CodexThreadOptions {
  workdir: string
  threadId: string
  idleTimeoutMs: number
  saveThreadId: (threadId: string) => void
}

export interface CodexAppServerLike {
  start(): Promise<void>
  stop(): void
  threadStart(params: { cwd: string }): Promise<string>
  threadResume(threadId: string, params: { cwd: string }): Promise<string>
  turnStart(threadId: string, text: string): Promise<string>
  turnInterrupt(threadId: string, turnId: string): Promise<void>
  onNotification(listener: (notification: { method: string; params?: unknown }) => void): void
}

export class CodexBackend implements AgentSession {
  readonly id = 'codex' as const
  private running = false
  private busy = false
  private threadId = ''
  private msgs: AgentMessage[] = []
  private cb: Partial<AgentSessionCallbacks> = {}
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private currentResponseText = ''

  constructor(private client: CodexAppServerLike, private options: CodexThreadOptions) {
    this.threadId = options.threadId
    this.client.onNotification((notification) => this.handleNotification(notification))
  }

  isRunning() { return this.running }
  isBusy() { return this.busy }
  history(): AgentMessage[] { return [...this.msgs] }

  setCallbacks(cb: Partial<AgentSessionCallbacks>) {
    this.cb = { ...this.cb, ...cb }
  }

  async start(): Promise<void> {
    if (this.running) return
    await this.client.start()
    this.running = true
    if (this.threadId) {
      try {
        this.threadId = await this.client.threadResume(this.threadId, { cwd: this.options.workdir })
      } catch {
        this.threadId = await this.client.threadStart({ cwd: this.options.workdir })
      }
    } else {
      this.threadId = await this.client.threadStart({ cwd: this.options.workdir })
    }
    this.options.saveThreadId(this.threadId)
    this.cb.onSessionReady?.()
    this.bumpIdleTimer()
  }

  send(message: string): void {
    void this.sendAsync(message)
  }

  async clear(): Promise<void> {
    if (!this.running) await this.start()
    this.msgs = []
    this.currentResponseText = ''
    this.threadId = await this.client.threadStart({ cwd: this.options.workdir })
    this.options.saveThreadId(this.threadId)
    this.cb.onSessionReady?.()
    this.bumpIdleTimer()
  }

  terminate(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
    this.client.stop()
    this.running = false
    this.busy = false
    this.currentResponseText = ''
    this.cb.onProcessExit?.()
  }

  private async sendAsync(message: string): Promise<void> {
    try {
      if (!this.running) await this.start()
      if (!this.threadId) {
        this.cb.onError?.('Codex thread is not ready')
        return
      }
      this.busy = true
      this.currentResponseText = ''
      this.msgs.push({ role: 'user', text: message })
      await this.client.turnStart(this.threadId, message)
      this.bumpIdleTimer()
    } catch (e) {
      this.busy = false
      this.cb.onError?.(e instanceof Error ? e.message : String(e))
    }
  }

  private handleNotification(notification: { method: string; params?: unknown }): void {
    const params = notification.params as Record<string, unknown> | undefined
    if (notification.method === 'item/agentMessage/delta' && typeof params?.delta === 'string') {
      this.currentResponseText += params.delta
    }
    if (notification.method === 'turn/completed') {
      this.finishAssistantMessage()
      this.busy = false
      this.bumpIdleTimer()
    }

    const result = mapCodexNotification(notification, this.cb)
    if (result.blocked) {
      this.client.turnInterrupt(result.threadId, result.turnId).catch(() => {})
      this.busy = false
      this.bumpIdleTimer()
    }
    if (notification.method === 'error') {
      this.busy = false
      this.bumpIdleTimer()
    }
  }

  private finishAssistantMessage(): void {
    if (this.currentResponseText.length > 0) {
      this.msgs.push({ role: 'assistant', text: this.currentResponseText })
      this.currentResponseText = ''
    }
  }

  private bumpIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.terminate(), this.options.idleTimeoutMs)
    const maybeNodeTimer = this.idleTimer as { unref?: () => void }
    maybeNodeTimer.unref?.()
  }
}
