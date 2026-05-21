import { describe, it, expect, beforeEach } from 'vitest'
import { ConfigStore } from '../electron/config-store'
import type { ConfigSnapshot } from '../src/shared/config'

class FakeStore<T> {
  private data: Record<string, unknown> = {}
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] | undefined {
    return (this.data[key as string] as T[K]) ?? defaultValue
  }
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key as string] = value
  }
}

describe('ConfigStore', () => {
  let fake: FakeStore<ConfigSnapshot>
  let store: ConfigStore

  beforeEach(() => {
    fake = new FakeStore()
    store = new ConfigStore(fake as unknown as ConstructorParameters<typeof ConfigStore>[0])
  })

  it('returns defaults when nothing is set', () => {
    const snap = store.snapshot()
    expect(snap.characterDisplayName).toBe('JPT')
    expect(snap.userAddressName).toBe('小屿')
    expect(snap.fontSize).toBe('medium')
    expect(snap.soundsEnabled).toBe(true)
    expect(snap.launchAtStartup).toBe(true)
    expect(snap.proactiveMessages).toBe(false)
    expect(snap.agentBackend).toBe('claude')
    expect(snap.codexWorkdir).toBe('')
    expect(snap.codexIdleTimeoutMs).toBe(20 * 60_000)
    expect(snap.codexNoDeleteFiles).toBe(true)
    expect(snap.codexThreadId).toBe('')
  })

  it('applies partial updates without dropping other fields', () => {
    store.update({ fontSize: 'large' })
    const snap = store.snapshot()
    expect(snap.fontSize).toBe('large')
    expect(snap.characterDisplayName).toBe('JPT')
  })

  it('persists across snapshot reads', () => {
    store.update({ soundsEnabled: false })
    expect(store.snapshot().soundsEnabled).toBe(false)
    expect(store.snapshot().soundsEnabled).toBe(false)
  })

  it('persists Codex backend settings', () => {
    store.update({
      agentBackend: 'claude',
      codexWorkdir: 'C:\\Users\\LeoinTube\\project',
      codexThreadId: 'thread-123',
    })
    const snap = store.snapshot()
    expect(snap.agentBackend).toBe('claude')
    expect(snap.codexWorkdir).toBe('C:\\Users\\LeoinTube\\project')
    expect(snap.codexThreadId).toBe('thread-123')
  })
})
