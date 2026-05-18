import type { AgentBackendId } from '../../src/shared/config'
import type { AgentMessage } from '../../src/shared/messages'
import type { AgentSession, AgentSessionCallbacks } from './session'

export class AgentManager implements AgentSession {
  private cb: Partial<AgentSessionCallbacks> = {}
  private activeId: AgentBackendId | null = null

  constructor(
    private getSelectedBackend: () => AgentBackendId,
    private backends: Record<AgentBackendId, AgentSession>,
  ) {}

  get id(): AgentBackendId { return this.active().id }
  isRunning(): boolean { return this.active().isRunning() }
  isBusy(): boolean { return this.active().isBusy() }
  history(): AgentMessage[] { return this.active().history() }

  async start(): Promise<void> {
    await this.activate(this.getSelectedBackend())
  }

  send(message: string): void {
    void this.sendAsync(message)
  }

  async clear(): Promise<void> {
    await this.active().clear()
  }

  terminate(): void {
    for (const backend of Object.values(this.backends)) backend.terminate()
    this.activeId = null
  }

  setCallbacks(cb: Partial<AgentSessionCallbacks>): void {
    this.cb = { ...this.cb, ...cb }
    for (const backend of Object.values(this.backends)) backend.setCallbacks(this.cb)
  }

  async switchTo(id: AgentBackendId): Promise<void> {
    await this.activate(id)
  }

  activeBackendId(): AgentBackendId {
    return this.active().id
  }

  setCodexWorkdir(workdir: string): void {
    const codex = this.backends.codex as AgentSession & { setWorkdir?: (workdir: string, threadId?: string) => void }
    codex.setWorkdir?.(workdir, '')
  }

  private async sendAsync(message: string): Promise<void> {
    const backend = this.active()
    if (!backend.isRunning()) await backend.start()
    backend.send(message)
  }

  private active(): AgentSession {
    const id = this.activeId ?? this.getSelectedBackend()
    const backend = this.backends[id]
    if (this.activeId !== id) {
      this.activeId = id
      backend.setCallbacks(this.cb)
    }
    return backend
  }

  private async activate(id: AgentBackendId): Promise<void> {
    for (const [backendId, backend] of Object.entries(this.backends) as Array<[AgentBackendId, AgentSession]>) {
      if (backendId !== id) backend.terminate()
    }
    this.activeId = id
    const backend = this.backends[id]
    backend.setCallbacks(this.cb)
    await backend.start()
  }
}
