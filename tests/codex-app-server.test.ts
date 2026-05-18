import { describe, expect, it } from 'vitest'
import { codexThreadRequestParams } from '../electron/agent/codex-app-server'

describe('codex app-server request params', () => {
  it('uses full agent mode with the JPT deletion guard instructions', () => {
    const params = codexThreadRequestParams('C:\\repo')

    expect(params).toMatchObject({
      cwd: 'C:\\repo',
      approvalPolicy: 'never',
      sandbox: 'danger-full-access',
    })
    expect(params.developerInstructions).toContain('must not delete entire files or directories')
    expect(params.developerInstructions).toContain('Remove-Item')
  })
})
