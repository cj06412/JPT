export type SlashCmd = 'clear' | 'copy' | 'help'

export interface SlashParsed {
  cmd: SlashCmd
}

const HELP_TEXT = `可用命令：
/clear — 清空当前对话（不删历史文件）
/copy — 复制最后一条 JPT 回复
/help — 显示这个帮助`

export function parseSlash(input: string): SlashParsed | null {
  const t = input.trim()
  if (!t.startsWith('/')) return null
  const word = t.slice(1).split(/\s+/)[0].toLowerCase()
  if (word === 'clear') return { cmd: 'clear' }
  if (word === 'copy') return { cmd: 'copy' }
  return { cmd: 'help' }
}

export function slashHelpText(): string {
  return HELP_TEXT
}
