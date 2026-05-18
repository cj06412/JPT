export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonRpcId = number

export interface JsonRpcRequest<TParams = JsonValue> {
  jsonrpc: '2.0'
  id: JsonRpcId
  method: string
  params?: TParams
}

export interface JsonRpcNotification<TParams = JsonValue> {
  jsonrpc: '2.0'
  method: string
  params?: TParams
}

export interface JsonRpcResponse<TResult = JsonValue> {
  jsonrpc: '2.0'
  id: JsonRpcId
  result?: TResult
  error?: { code: number; message: string; data?: JsonValue }
}

export interface ThreadRef {
  id: string
}

export interface ThreadStartResponse {
  thread: ThreadRef
}

export interface ThreadResumeResponse {
  thread: ThreadRef
}

export interface TurnStartResponse {
  turn: { id: string }
}

export interface CodexTextInput {
  type: 'text'
  text: string
  text_elements: []
}

export interface AgentMessageDeltaNotification {
  threadId: string
  turnId: string
  itemId: string
  delta: string
}

export interface TurnCompletedNotification {
  threadId: string
  turn: { id: string; status?: string }
}

export interface TurnDiffUpdatedNotification {
  threadId: string
  turnId: string
  diff: string
}

export interface ErrorNotification {
  message?: string
  error?: { message?: string }
}

export type CodexServerNotification =
  | { method: 'item/agentMessage/delta'; params: AgentMessageDeltaNotification }
  | { method: 'turn/completed'; params: TurnCompletedNotification }
  | { method: 'turn/diff/updated'; params: TurnDiffUpdatedNotification }
  | { method: 'error'; params: ErrorNotification }
  | { method: string; params?: JsonValue }
