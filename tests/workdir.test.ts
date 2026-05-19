import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { codexAgentsFileMatchesPersona, ensureWorkdir, writePersona } from '../electron/agent/workdir'

const tempDirs: string[] = []

function tempBasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jpt-workdir-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('JPT workdir persona files', () => {
  it('mirrors the persona into the default Codex AGENTS.md on startup', () => {
    const basePath = tempBasePath()
    const persona = '# Persona\n\n你是 JPT。'

    ensureWorkdir(basePath, persona)

    const codexAgents = fs.readFileSync(path.join(basePath, 'codex-workdir', 'AGENTS.md'), 'utf-8')
    expect(codexAgents).toBe(persona)
  })

  it('updates the default Codex AGENTS.md when the persona changes', () => {
    const basePath = tempBasePath()
    ensureWorkdir(basePath, '# Persona\n\n旧人格')

    writePersona(basePath, '# Persona\n\n新人格')

    const codexAgents = fs.readFileSync(path.join(basePath, 'codex-workdir', 'AGENTS.md'), 'utf-8')
    expect(codexAgents).toBe('# Persona\n\n新人格')
  })

  it('detects whether the default Codex AGENTS.md mirrors the persona', () => {
    const basePath = tempBasePath()
    ensureWorkdir(basePath, '# Persona\n\n你是 JPT。')

    expect(codexAgentsFileMatchesPersona(basePath)).toBe(true)

    fs.writeFileSync(path.join(basePath, 'codex-workdir', 'AGENTS.md'), '# stale', 'utf-8')

    expect(codexAgentsFileMatchesPersona(basePath)).toBe(false)
  })
})
