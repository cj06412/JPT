import { describe, expect, it } from 'vitest'
import { ClaudeSession } from '../electron/agent/claude'

describe('ClaudeSession backend shape', () => {
  it('identifies itself as the Claude backend and supports clear', () => {
    const session = new ClaudeSession('C:\\Users\\LeoinTube\\JPT\\workdir')

    expect(session.id).toBe('claude')
    expect(typeof session.clear).toBe('function')
  })
})
