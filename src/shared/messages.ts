export type AgentRole = 'user' | 'assistant' | 'error' | 'toolUse' | 'toolResult'

export interface AgentMessage {
  role: AgentRole
  text: string
}
