import { describe, it, expect } from 'vitest'
import { parseSlash } from '../src/dialog/slash'

describe('parseSlash', () => {
  it('returns null for normal text', () => {
    expect(parseSlash('你好')).toBeNull()
    expect(parseSlash('  帮我查天气  ')).toBeNull()
  })
  it('parses /clear', () => {
    expect(parseSlash('/clear')).toEqual({ cmd: 'clear' })
    expect(parseSlash('  /clear  ')).toEqual({ cmd: 'clear' })
  })
  it('parses /copy', () => {
    expect(parseSlash('/copy')).toEqual({ cmd: 'copy' })
  })
  it('parses /help', () => {
    expect(parseSlash('/help')).toEqual({ cmd: 'help' })
  })
  it('parses /backend without argument', () => {
    expect(parseSlash('/backend')).toEqual({ cmd: 'backend' })
  })
  it('parses /backend codex and /backend claude', () => {
    expect(parseSlash('/backend codex')).toEqual({ cmd: 'backend', backend: 'codex' })
    expect(parseSlash('/backend claude')).toEqual({ cmd: 'backend', backend: 'claude' })
  })
  it('unknown /backend target returns help', () => {
    expect(parseSlash('/backend gpt')).toEqual({ cmd: 'help' })
  })
  it('parses /workdir without path', () => {
    expect(parseSlash('/workdir')).toEqual({ cmd: 'workdir' })
  })
  it('parses /workdir with a Windows path', () => {
    expect(parseSlash('/workdir C:\\Users\\LeoinTube\\JPT')).toEqual({
      cmd: 'workdir',
      path: 'C:\\Users\\LeoinTube\\JPT',
    })
  })
  it('unknown slash returns help', () => {
    expect(parseSlash('/wat')).toEqual({ cmd: 'help' })
  })
  it('slash with trailing text is still a command', () => {
    expect(parseSlash('/clear everything')).toEqual({ cmd: 'clear' })
  })
})
