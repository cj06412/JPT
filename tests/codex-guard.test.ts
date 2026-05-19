import { describe, expect, it } from 'vitest'
import { blocksClientRequest, deletionBlockMessage, diffDeletesWholeFile, isDeletionCommand } from '../electron/agent/codex-guard'

describe('codex guard', () => {
  it('blocks common deletion shell commands', () => {
    expect(isDeletionCommand('rm src/a.ts')).toBe(true)
    expect(isDeletionCommand('del C:\\tmp\\a.txt')).toBe(true)
    expect(isDeletionCommand('Remove-Item .\\a.txt')).toBe(true)
    expect(isDeletionCommand('powershell -Command "Remove-Item .\\a.txt"')).toBe(true)
  })

  it('allows non-delete commands', () => {
    expect(isDeletionCommand('npm test')).toBe(false)
    expect(isDeletionCommand('git diff -- src/a.ts')).toBe(false)
  })

  it('blocks whole-file deletion diffs', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      'deleted file mode 100644',
      '--- a/src/a.ts',
      '+++ /dev/null',
    ].join('\n')

    expect(diffDeletesWholeFile(diff)).toBe(true)
  })

  it('allows line-level deletions in a modified file', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,2 +1,1 @@',
      '-const unused = 1',
      ' const kept = 2',
    ].join('\n')

    expect(diffDeletesWholeFile(diff)).toBe(false)
  })

  it('uses the approved user-facing block message', () => {
    expect(deletionBlockMessage()).toBe('这个操作会删除整个文件，我先停住了。')
  })

  it('blocks app-server fs/remove client requests', () => {
    expect(blocksClientRequest('fs/remove', { path: 'C:\\repo\\important.txt' })).toBe(true)
  })

  it('blocks app-server command/exec client requests with deletion commands', () => {
    expect(blocksClientRequest('command/exec', { command: ['powershell', '-Command', 'Remove-Item .\\important.txt'] })).toBe(true)
  })

  it('allows app-server client requests that are not destructive', () => {
    expect(blocksClientRequest('thread/start', { cwd: 'C:\\repo' })).toBe(false)
    expect(blocksClientRequest('command/exec', { command: ['npm', 'test'] })).toBe(false)
  })
})
