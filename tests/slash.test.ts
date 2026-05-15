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
  it('unknown slash returns help', () => {
    expect(parseSlash('/wat')).toEqual({ cmd: 'help' })
  })
  it('slash with trailing text is still a command', () => {
    expect(parseSlash('/clear everything')).toEqual({ cmd: 'clear' })
  })
})
