import { describe, expect, it, vi } from 'vitest'
import { CodexBackend, type CodexAppServerLike } from '../electron/agent/codex'

type FakeCodexClient = CodexAppServerLike & {
  emit: (notification: { method: string; params?: unknown }) => void
  emitExit: () => void
}

function fakeClient(): FakeCodexClient {
  let listener: (notification: { method: string; params?: unknown }) => void = () => {}
  let exitListener: () => void = () => {}
  const client = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    threadStart: vi.fn().mockResolvedValue('thread-1'),
    threadResume: vi.fn().mockResolvedValue('thread-1'),
    turnStart: vi.fn().mockResolvedValue('turn-1'),
    turnInterrupt: vi.fn().mockResolvedValue(undefined),
    onNotification: vi.fn((nextListener) => { listener = nextListener }),
    onExit: vi.fn((nextListener) => { exitListener = nextListener }),
    emit: (notification: { method: string; params?: unknown }) => listener(notification),
    emitExit: () => exitListener(),
  }
  return client
}

describe('CodexBackend', () => {
  it('starts app-server and creates a thread when no saved thread exists', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: '',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })

    await backend.start()

    expect(client.start).toHaveBeenCalled()
    expect(client.threadStart).toHaveBeenCalledWith(expect.objectContaining({ cwd: 'C:\\repo' }))
  })

  it('resumes a saved thread before creating a new one', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: 'thread-old',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })

    await backend.start()

    expect(client.threadResume).toHaveBeenCalledWith('thread-old', expect.objectContaining({ cwd: 'C:\\repo' }))
    expect(client.threadStart).not.toHaveBeenCalled()
  })

  it('sends turns to the active thread', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: '',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })

    await backend.start()
    backend.send('hello')
    await Promise.resolve()

    expect(client.turnStart).toHaveBeenCalledWith('thread-1', 'hello')
  })

  it('clear creates a fresh thread in the same workdir', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: 'thread-old',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })

    await backend.start()
    await backend.clear()

    expect(client.threadStart).toHaveBeenCalledWith(expect.objectContaining({ cwd: 'C:\\repo' }))
  })

  it('records streamed assistant text in history when a turn completes', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: '',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })

    await backend.start()
    backend.send('hello')
    await Promise.resolve()
    client.emit({ method: 'item/agentMessage/delta', params: { delta: 'hi ' } })
    client.emit({ method: 'item/agentMessage/delta', params: { delta: 'there' } })
    client.emit({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1' } } })

    expect(backend.history().at(-1)).toEqual({ role: 'assistant', text: 'hi there' })
    expect(backend.isBusy()).toBe(false)
  })

  it('interrupts a turn when the delete guard blocks a diff', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: '',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })

    await backend.start()
    client.emit({
      method: 'turn/diff/updated',
      params: { threadId: 'thread-1', turnId: 'turn-1', diff: 'deleted file mode 100644\n--- a/a.ts\n+++ /dev/null' },
    })
    await Promise.resolve()

    expect(client.turnInterrupt).toHaveBeenCalledWith('thread-1', 'turn-1')
    expect(backend.isBusy()).toBe(false)
  })

  it('marks itself stopped when the app-server exits and restarts on the next send', async () => {
    const client = fakeClient()
    const backend = new CodexBackend(client, {
      workdir: 'C:\\repo',
      threadId: '',
      idleTimeoutMs: 20 * 60_000,
      saveThreadId: vi.fn(),
    })

    await backend.start()
    client.emitExit()

    expect(backend.isRunning()).toBe(false)

    backend.send('hello again')

    expect(client.start).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(client.turnStart).toHaveBeenCalledWith('thread-1', 'hello again'))
  })
})
