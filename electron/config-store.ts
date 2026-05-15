import type { ConfigSnapshot } from '../src/shared/config'
import { DEFAULT_CONFIG } from '../src/shared/config'

/**
 * Wrapper around electron-store that hides the raw key-value API behind a typed
 * snapshot/update pair. Renderers only see this via IPC ('settings:get' /
 * 'settings:set') — they never touch the store directly.
 *
 * Constructor takes the raw store interface so we can swap in an in-memory
 * implementation in tests without depending on electron-store at all.
 */
export interface RawStore<T> {
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] | undefined
  set<K extends keyof T>(key: K, value: T[K]): void
}

export class ConfigStore {
  constructor(private store: RawStore<ConfigSnapshot>) {}

  snapshot(): ConfigSnapshot {
    return {
      characterDisplayName: this.store.get('characterDisplayName', DEFAULT_CONFIG.characterDisplayName)!,
      userAddressName: this.store.get('userAddressName', DEFAULT_CONFIG.userAddressName)!,
      fontSize: this.store.get('fontSize', DEFAULT_CONFIG.fontSize)!,
      soundsEnabled: this.store.get('soundsEnabled', DEFAULT_CONFIG.soundsEnabled)!,
      launchAtStartup: this.store.get('launchAtStartup', DEFAULT_CONFIG.launchAtStartup)!,
      personaDoc: this.store.get('personaDoc', DEFAULT_CONFIG.personaDoc)!,
      proactiveMessages: this.store.get('proactiveMessages', DEFAULT_CONFIG.proactiveMessages)!,
    }
  }

  update(patch: Partial<ConfigSnapshot>): ConfigSnapshot {
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) this.store.set(k as keyof ConfigSnapshot, v as never)
    }
    return this.snapshot()
  }
}
