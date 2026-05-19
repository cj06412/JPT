import { describe, expect, it, vi } from 'vitest'
import { AgentManager } from '../electron/agent/manager'
import type { AgentSession } from '../electron/agent/session'
import type { AgentBackendId } from '../src/shared/config'

function fakeBackend(id: AgentBackendId): AgentSession {
  return {
    id,
    isRunning: vi.fn(() => false),
    isBusy: vi.fn(() => false),
    history: vi.fn(() => []),
    start: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    clear: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
    setCallbacks: vi.fn(),
  }
}

function fakeCodexBackend(): AgentSession & { setWorkdir: ReturnType<typeof vi.fn> } {
  return {
    ...fakeBackend('codex'),
    setWorkdir: vi.fn(),
  }
}

describe('AgentManager', () => {
  it('starts only the selected backend lazily on send', async () => {
    const codex = fakeBackend('codex')
    const claude = fakeBackend('claude')
    const manager = new AgentManager(() => 'codex', { codex, claude })

    manager.send('hello')

    expect(codex.start).toHaveBeenCalled()
    await vi.waitFor(() => expect(codex.send).toHaveBeenCalledWith('hello'))
    expect(claude.send).not.toHaveBeenCalled()
  })

  it('terminates previous backend when switching', async () => {
    const codex = fakeBackend('codex')
    const claude = fakeBackend('claude')
    const manager = new AgentManager(() => 'codex', { codex, claude })

    await manager.switchTo('claude')

    expect(codex.terminate).toHaveBeenCalled()
    expect(claude.start).toHaveBeenCalled()
  })

  it('delegates clear to active backend', async () => {
    const codex = fakeBackend('codex')
    const claude = fakeBackend('claude')
    const manager = new AgentManager(() => 'codex', { codex, claude })

    await manager.clear()

    expect(codex.clear).toHaveBeenCalled()
  })

  it('updates the Codex workdir without touching Claude', () => {
    const codex = fakeCodexBackend()
    const claude = fakeBackend('claude')
    const manager = new AgentManager(() => 'codex', { codex, claude })

    manager.setCodexWorkdir('C:\\next')

    expect(codex.setWorkdir).toHaveBeenCalledWith('C:\\next', '')
    expect(claude.clear).not.toHaveBeenCalled()
  })

  it('surfaces backend startup failures instead of dropping the send promise', async () => {
    const codex = fakeBackend('codex')
    const claude = fakeBackend('claude')
    vi.mocked(codex.start).mockRejectedValueOnce(new Error('Codex not logged in'))
    const onError = vi.fn()
    const manager = new AgentManager(() => 'codex', { codex, claude })
    manager.setCallbacks({ onError })

    manager.send('hello')

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('Codex not logged in'))
    expect(codex.send).not.toHaveBeenCalled()
  })
})
