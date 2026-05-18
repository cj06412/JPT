import { describe, expect, it, vi } from 'vitest'
import { CodexJsonRpcPeer } from '../electron/agent/codex-jsonrpc'

describe('CodexJsonRpcPeer', () => {
  it('writes JSON-RPC requests with incrementing ids', async () => {
    const writes: string[] = []
    const peer = new CodexJsonRpcPeer((line) => writes.push(line))
    const pending = peer.request('thread/start', { cwd: 'C:\\x' })

    expect(writes[0]).toContain('"method":"thread/start"')
    expect(writes[0]).toContain('"id":1')
    peer.acceptLine('{"jsonrpc":"2.0","id":1,"result":{"thread":{"id":"t1"}}}')
    await expect(pending).resolves.toEqual({ thread: { id: 't1' } })
  })

  it('dispatches notifications', () => {
    const onNotification = vi.fn()
    const peer = new CodexJsonRpcPeer(() => {}, onNotification)

    peer.acceptLine('{"jsonrpc":"2.0","method":"item/agentMessage/delta","params":{"delta":"hi"}}')

    expect(onNotification).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'item/agentMessage/delta',
      params: { delta: 'hi' },
    })
  })

  it('rejects request promise on JSON-RPC error response', async () => {
    const peer = new CodexJsonRpcPeer(() => {})
    const pending = peer.request('thread/start', {})

    peer.acceptLine('{"jsonrpc":"2.0","id":1,"error":{"code":-1,"message":"bad"}}')

    await expect(pending).rejects.toThrow('bad')
  })
})
