export type FontSize = 'small' | 'medium' | 'large'
export type AgentBackendId = 'codex' | 'claude'

export interface ConfigSnapshot {
  characterDisplayName: string
  userAddressName: string
  fontSize: FontSize
  soundsEnabled: boolean
  launchAtStartup: boolean
  personaDoc: string         // raw markdown that gets written to workdir/CLAUDE.md on save
  proactiveMessages: boolean // opt-in time-based companionship nudges (spec §8.1, default off)
  agentBackend: AgentBackendId
  codexWorkdir: string
  codexIdleTimeoutMs: number
  codexNoDeleteFiles: true
  codexThreadId: string
}

export const DEFAULT_CONFIG: ConfigSnapshot = {
  characterDisplayName: 'JPT',
  userAddressName: '小屿',
  fontSize: 'medium',
  soundsEnabled: true,
  launchAtStartup: true,
  // empty means "use placeholder persona from workdir.ts"; user can edit via settings window
  personaDoc: '',
  proactiveMessages: false,
  agentBackend: 'codex',
  codexWorkdir: '',
  codexIdleTimeoutMs: 20 * 60_000,
  codexNoDeleteFiles: true,
  codexThreadId: '',
}
