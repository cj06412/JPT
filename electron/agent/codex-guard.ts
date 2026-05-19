const DELETE_COMMANDS = new Set(['rm', 'del', 'erase', 'rmdir', 'rd', 'remove-item'])

export function deletionBlockMessage(): string {
  return '这个操作会删除整个文件，我先停住了。'
}

export function isDeletionCommand(command: string): boolean {
  const normalized = command
    .replace(/[;&|()]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim().toLowerCase().replace(/^['"]+|['"]+$/g, ''))
    .filter(Boolean)

  return normalized.some((token) => DELETE_COMMANDS.has(token))
}

export function blocksClientRequest(method: string, params: unknown): boolean {
  if (method === 'fs/remove') return true
  if (method !== 'command/exec') return false
  if (!params || typeof params !== 'object') return false
  const command = (params as { command?: unknown }).command
  if (!Array.isArray(command)) return false
  return isDeletionCommand(command.map(String).join(' '))
}

export function diffDeletesWholeFile(diff: string): boolean {
  const lines = diff.split(/\r?\n/)
  if (lines.some((line) => line.startsWith('deleted file mode'))) return true
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].startsWith('--- a/') && lines[i + 1] === '+++ /dev/null') return true
  }
  return false
}
