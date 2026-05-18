import { describe, it, expect, vi, beforeEach } from 'vitest'
import { candidateBinaryNames, findBinaryInPaths } from '../electron/agent/shell-env'
import * as fs from 'node:fs'

vi.mock('node:fs')

describe('findBinaryInPaths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the first existing path', () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => p === '/usr/local/bin/claude'
    )
    const result = findBinaryInPaths('claude', [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      '/Users/x/.local/bin/claude',
    ])
    expect(result).toBe('/usr/local/bin/claude')
  })

  it('returns null if no path matches', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const result = findBinaryInPaths('claude', [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ])
    expect(result).toBeNull()
  })

  it('returns the earliest match in the input array', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true) // every path exists
    const result = findBinaryInPaths('claude', [
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
    ])
    expect(result).toBe('/opt/homebrew/bin/claude')
  })
})

describe('candidateBinaryNames', () => {
  it('includes Windows cmd shims for codex', () => {
    expect(candidateBinaryNames('codex', true)).toEqual(['codex.exe', 'codex.cmd', 'codex'])
  })

  it('keeps Unix names extensionless', () => {
    expect(candidateBinaryNames('codex', false)).toEqual(['codex'])
  })
})
