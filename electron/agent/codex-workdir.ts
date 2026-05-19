import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AgentBackendId, ConfigSnapshot } from '../../src/shared/config'

export interface CodexWorkdirConfig {
  snapshot(): ConfigSnapshot
  update(patch: Partial<ConfigSnapshot>): ConfigSnapshot
}

export interface CodexWorkdirSession {
  activeBackendId?: () => AgentBackendId
  setCodexWorkdir?: (workdir: string) => void
  clear(): Promise<void>
}

export async function applyCodexWorkdirChange(
  workdir: string,
  userDataPath: string,
  config: CodexWorkdirConfig,
  session: CodexWorkdirSession,
): Promise<string> {
  const resolved = path.resolve(workdir.trim() || path.join(userDataPath, 'codex-workdir'))
  fs.mkdirSync(resolved, { recursive: true })
  config.update({ codexWorkdir: resolved, codexThreadId: '' })
  session.setCodexWorkdir?.(resolved)
  if (!session.activeBackendId || session.activeBackendId() === 'codex') {
    await session.clear()
  }
  return resolved
}
