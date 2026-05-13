import { describe, it, expect } from 'vitest'
import { NdjsonBuffer } from '../electron/agent/ndjson'

describe('NdjsonBuffer', () => {
  it('emits a single JSON object on a complete line', () => {
    const buf = new NdjsonBuffer()
    const out = buf.append('{"type":"hello"}\n')
    expect(out).toEqual([{ type: 'hello' }])
  })

  it('buffers a partial line until newline arrives', () => {
    const buf = new NdjsonBuffer()
    expect(buf.append('{"type":"hel')).toEqual([])
    expect(buf.append('lo"}\n')).toEqual([{ type: 'hello' }])
  })

  it('emits multiple objects from a chunk with multiple newlines', () => {
    const buf = new NdjsonBuffer()
    const out = buf.append('{"a":1}\n{"b":2}\n{"c":3}\n')
    expect(out).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })

  it('skips empty lines silently', () => {
    const buf = new NdjsonBuffer()
    const out = buf.append('{"a":1}\n\n{"b":2}\n')
    expect(out).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('throws on malformed JSON in a complete line', () => {
    const buf = new NdjsonBuffer()
    expect(() => buf.append('{not json}\n')).toThrow()
  })

  it('handles a chunk that completes one line and starts another', () => {
    const buf = new NdjsonBuffer()
    expect(buf.append('{"a":1}')).toEqual([])
    expect(buf.append('\n{"b":2')).toEqual([{ a: 1 }])
    expect(buf.append('}\n')).toEqual([{ b: 2 }])
  })
})
