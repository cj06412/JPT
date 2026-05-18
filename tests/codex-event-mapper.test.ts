import { describe, expect, it, vi } from 'vitest'
import { mapCodexNotification } from '../electron/agent/codex-event-mapper'
import type { AgentSessionCallbacks } from '../electron/agent/session'

function callbacks() {
  return {
    onText: vi.fn(),
    onTurnComplete: vi.fn(),
    onError: vi.fn(),
  } as unknown as Partial<AgentSessionCallbacks>
}

describe('mapCodexNotification', () => {
  it('maps agent message deltas to text callbacks', () => {
    const cb = callbacks()
    const result = mapCodexNotification({ method: 'item/agentMessage/delta', params: { delta: 'hello' } }, cb)

    expect(result).toEqual({ blocked: false })
    expect(cb.onText).toHaveBeenCalledWith('hello')
  })

  it('maps turn completion', () => {
    const cb = callbacks()

    mapCodexNotification({ method: 'turn/completed', params: { threadId: 't1', turn: { id: 'turn1' } } }, cb)

    expect(cb.onTurnComplete).toHaveBeenCalled()
  })

  it('blocks whole-file deletion diffs', () => {
    const cb = callbacks()
    const result = mapCodexNotification({
      method: 'turn/diff/updated',
      params: { threadId: 't1', turnId: 'turn1', diff: 'deleted file mode 100644\n--- a/a.ts\n+++ /dev/null' },
    }, cb)

    expect(result).toEqual({ blocked: true, threadId: 't1', turnId: 'turn1' })
    expect(cb.onError).toHaveBeenCalledWith('这个操作会删除整个文件，我先停住了。')
  })
})
