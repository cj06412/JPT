import { describe, expect, it, vi } from 'vitest'
import * as os from 'node:os'
import * as path from 'node:path'
import { applyCodexWorkdirChange } from '../electron/agent/codex-workdir'
import { DEFAULT_CONFIG, type ConfigSnapshot } from '../src/shared/config'

class FakeConfig {
  private snap: ConfigSnapshot = { ...DEFAULT_CONFIG, codexThreadId: 'thread-old' }
  snapshot() { return this.snap }
  update(patch: Partial<ConfigSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    return this.snap
  }
}

describe('applyCodexWorkdirChange', () => {
  it('normalizes the path, clears the saved thread, updates Codex, and resets active Codex', async () => {
    const config = new FakeConfig()
    const target = path.join(os.tmpdir(), `jpt-codex-workdir-${Date.now()}`)
    const session = {
      activeBackendId: vi.fn(() => 'codex' as const),
      setCodexWorkdir: vi.fn(),
      clear: vi.fn().mockResolvedValue(undefined),
    }

    const resolved = await applyCodexWorkdirChange(target, 'C:\\Users\\x\\AppData\\Roaming\\JPT', config, session)

    expect(resolved).toBe(path.resolve(target))
    expect(config.snapshot().codexWorkdir).toBe(path.resolve(target))
    expect(config.snapshot().codexThreadId).toBe('')
    expect(session.setCodexWorkdir).toHaveBeenCalledWith(path.resolve(target))
    expect(session.clear).toHaveBeenCalled()
  })

  it('updates Codex workdir without clearing the active Claude backend', async () => {
    const config = new FakeConfig()
    const target = path.join(os.tmpdir(), `jpt-codex-workdir-${Date.now()}-claude`)
    const session = {
      activeBackendId: vi.fn(() => 'claude' as const),
      setCodexWorkdir: vi.fn(),
      clear: vi.fn().mockResolvedValue(undefined),
    }

    await applyCodexWorkdirChange(target, 'C:\\Users\\x\\AppData\\Roaming\\JPT', config, session)

    expect(session.setCodexWorkdir).toHaveBeenCalledWith(path.resolve(target))
    expect(session.clear).not.toHaveBeenCalled()
  })
})
