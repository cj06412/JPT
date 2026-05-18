import type { AgentBackendId } from '@shared/config'

export type SlashCmd = 'clear' | 'copy' | 'help' | 'backend' | 'workdir'

export type SlashParsed =
  | { cmd: 'clear' | 'copy' | 'help' }
  | { cmd: 'backend'; backend?: AgentBackendId }
  | { cmd: 'workdir'; path?: string }

const HELP_TEXT = `可用命令：
/clear — 清空当前对话（不删历史文件）
/copy — 复制最后一条 JPT 回复
/backend — 显示当前 AI 后端
/backend codex — 切到 Codex
/backend claude — 切到 Claude
/workdir — 显示当前 Codex 工作目录
/workdir C:\\path\\to\\project — 设置 Codex 工作目录
/help — 显示这个帮助`

export function parseSlash(input: string): SlashParsed | null {
  const t = input.trim()
  if (!t.startsWith('/')) return null
  const [, rawWord = '', rest = ''] = t.match(/^\/(\S+)(?:\s+([\s\S]*))?$/) ?? []
  const word = rawWord.toLowerCase()
  if (word === 'clear') return { cmd: 'clear' }
  if (word === 'copy') return { cmd: 'copy' }
  if (word === 'help') return { cmd: 'help' }
  if (word === 'backend') {
    const backend = rest.trim().toLowerCase()
    if (!backend) return { cmd: 'backend' }
    if (backend === 'codex' || backend === 'claude') return { cmd: 'backend', backend }
    return { cmd: 'help' }
  }
  if (word === 'workdir') {
    const path = rest.trim()
    return path ? { cmd: 'workdir', path } : { cmd: 'workdir' }
  }
  return { cmd: 'help' }
}

export function slashHelpText(): string {
  return HELP_TEXT
}
