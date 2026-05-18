import type { AgentMessage } from '../../src/shared/messages'
import type { AgentBackendId } from '../../src/shared/config'

export interface AgentSessionCallbacks {
  onText: (chunk: string) => void
  onError: (msg: string) => void
  onSessionReady: () => void
  onTurnComplete: () => void
  onProcessExit: () => void
  onToolUse: (tool: string, summary: string) => void
  onToolResult: (summary: string, isError: boolean) => void
}

export interface AgentSession {
  id: AgentBackendId
  isRunning(): boolean
  isBusy(): boolean
  history(): AgentMessage[]
  start(): Promise<void>
  send(message: string): void
  clear(): Promise<void>
  terminate(): void
  setCallbacks(cb: Partial<AgentSessionCallbacks>): void
}
