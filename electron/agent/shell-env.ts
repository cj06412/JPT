import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Pure helper: find the first existing executable path from a candidate list.
 * Easier to test than the full PATH-aware resolver below.
 */
export function findBinaryInPaths(
  _name: string,
  candidates: string[]
): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

export function candidateBinaryNames(name: string, isWindows: boolean): string[] {
  return isWindows ? [`${name}.exe`, `${name}.cmd`, name] : [name]
}

function resolveFromPath(name: string, isWindows: boolean): string | null {
  const pathVar = process.env.PATH || ''
  const sep = isWindows ? ';' : ':'
  const pathDirs = pathVar.split(sep).filter(Boolean)
  for (const dir of pathDirs) {
    for (const binary of candidateBinaryNames(name, isWindows)) {
      const candidate = path.join(dir, binary)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

/**
 * Resolve `claude` binary path.
 *
 * On Windows: .cmd shim from npm global, or installer location.
 * On macOS / Linux: ~/.local/bin (Claude installer), or homebrew, or npm global.
 *
 * Mirrors lil-agents' ShellEnvironment.swift findBinary fallbacks.
 */
export function resolveClaudePath(): string | null {
  const home = os.homedir()
  const isWindows = process.platform === 'win32'

  const candidates: string[] = isWindows
    ? [
        path.join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        path.join(home, '.local', 'bin', 'claude.exe'),
      ]
    : [
        path.join(home, '.local', 'bin', 'claude'),
        path.join(home, '.claude', 'local', 'bin', 'claude'),
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
      ]

  const direct = findBinaryInPaths('claude', candidates)
  if (direct) return direct
  return resolveFromPath('claude', isWindows)
}

export function resolveCodexPath(): string | null {
  const home = os.homedir()
  const isWindows = process.platform === 'win32'

  const candidates: string[] = isWindows
    ? [
        path.join(home, 'AppData', 'Roaming', 'npm', 'codex.cmd'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'codex'),
      ]
    : [
        path.join(home, '.local', 'bin', 'codex'),
        '/opt/homebrew/bin/codex',
        '/usr/local/bin/codex',
      ]

  const direct = findBinaryInPaths('codex', candidates)
  if (direct) return direct
  return resolveFromPath('codex', isWindows)
}
