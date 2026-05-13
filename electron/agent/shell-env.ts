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

  // Fallback: scan PATH from current process env
  const pathVar = process.env.PATH || ''
  const sep = isWindows ? ';' : ':'
  const ext = isWindows ? '.exe' : ''
  const pathDirs = pathVar.split(sep).filter(Boolean)
  for (const dir of pathDirs) {
    const candidate = path.join(dir, `claude${ext}`)
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}
