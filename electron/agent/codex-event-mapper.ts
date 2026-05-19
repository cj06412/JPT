import { deletionBlockMessage, diffDeletesWholeFile, isDeletionCommand } from './codex-guard'
import type { AgentSessionCallbacks } from './session'

export type CodexMappedResult =
  | { blocked: false }
  | { blocked: true; threadId: string; turnId: string }

export function mapCodexNotification(
  notification: { method: string; params?: unknown },
  cb: Partial<AgentSessionCallbacks>,
): CodexMappedResult {
  const params = notification.params as Record<string, unknown> | undefined
  if (notification.method === 'item/agentMessage/delta') {
    const delta = typeof params?.delta === 'string' ? params.delta : ''
    if (delta) cb.onText?.(delta)
    return { blocked: false }
  }

  if (notification.method === 'turn/completed') {
    cb.onTurnComplete?.()
    return { blocked: false }
  }

  if (notification.method === 'error') {
    const raw = params?.message
    const nested = params?.error as Record<string, unknown> | undefined
    cb.onError?.(
      typeof raw === 'string'
        ? raw
        : typeof nested?.message === 'string'
          ? nested.message
          : 'Codex app-server error',
    )
    return { blocked: false }
  }

  if (notification.method === 'turn/diff/updated') {
    const diff = typeof params?.diff === 'string' ? params.diff : ''
    if (diffDeletesWholeFile(diff)) {
      cb.onError?.(deletionBlockMessage())
      return {
        blocked: true,
        threadId: String(params?.threadId ?? ''),
        turnId: String(params?.turnId ?? ''),
      }
    }
  }

  if (notification.method === 'item/started') {
    const item = params?.item as Record<string, unknown> | undefined
    if (item?.type === 'commandExecution' && typeof item.command === 'string' && isDeletionCommand(item.command)) {
      cb.onError?.(deletionBlockMessage())
      return {
        blocked: true,
        threadId: String(params?.threadId ?? ''),
        turnId: String(params?.turnId ?? ''),
      }
    }
  }

  return { blocked: false }
}
