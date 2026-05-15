import { theme } from '@shared/theme'

export interface ToolUseCardProps {
  tool: string
  summary: string
  result?: string
  isError?: boolean
}

/**
 * SDV-flavored scroll card for a tool call (spec §6.4). TodoWrite collapses
 * to a faint "▸ 思考中…" line; web tools show the action + (when the result
 * has arrived) a trimmed blurb.
 */
export function ToolUseCard({ tool, summary, result, isError }: ToolUseCardProps) {
  if (tool === 'TodoWrite') {
    return <div style={{ color: theme.paperInkFaded, fontStyle: 'italic', margin: '4px 0' }}>▸ 思考中…</div>
  }
  const icon = tool === 'WebSearch' ? '🔍' : tool === 'WebFetch' ? '🌐' : '🔧'
  return (
    <div
      style={{
        margin: '6px 0',
        border: `2px solid ${theme.woodOutline}`,
        background: '#e8c896',
        padding: '6px 10px',
        fontSize: 13,
        color: isError ? theme.error : theme.paperInk,
        boxShadow: '2px 2px 0 rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ fontWeight: 'bold' }}>{icon} {summary}</div>
      {result && (
        <div style={{ marginTop: 4, opacity: 0.85, whiteSpace: 'pre-wrap' }}>
          {isError ? '出错了：' : ''}{result}
        </div>
      )}
    </div>
  )
}
