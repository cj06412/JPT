import type { AgentMessage } from '../../src/shared/messages'

export interface AgentSessionCallbacks {
  onText: (chunk: string) => void
  onError: (msg: string) => void
  onSessionReady: () => void
  onTurnComplete: () => void
  onProcessExit: () => void
}

export interface AgentSession {
  isRunning(): boolean
  isBusy(): boolean
  history(): AgentMessage[]
  start(): Promise<void>
  send(message: string): void
  terminate(): void
  setCallbacks(cb: Partial<AgentSessionCallbacks>): void
}
